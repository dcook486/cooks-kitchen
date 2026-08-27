"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function currentUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

function householdError(message: string): never {
  redirect(`/household?share_error=${encodeURIComponent(message)}`);
}

export async function createHouseholdInvitation(formData: FormData) {
  const { supabase, userId } = await currentUser();
  const householdId = clean(formData.get("household_id"));
  const email = clean(formData.get("email")).toLowerCase();

  if (!householdId || !email || !email.includes("@")) {
    householdError("Enter a valid email address.");
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.role !== "owner") householdError("Only the household owner can send invitations.");

  const { error: revokeError } = await supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("household_id", householdId)
    .ilike("invited_email", email)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (revokeError) householdError(revokeError.message);

  const { data: invitation, error } = await supabase
    .from("household_invitations")
    .insert({ household_id: householdId, invited_email: email, invited_by: userId })
    .select("token")
    .single();

  if (error || !invitation) householdError(error?.message ?? "Could not create invitation.");

  revalidatePath("/household");
  redirect(`/household?invite=${invitation.token}`);
}

export async function revokeHouseholdInvitation(formData: FormData) {
  const { supabase, userId } = await currentUser();
  const householdId = clean(formData.get("household_id"));
  const id = clean(formData.get("id"));
  if (!householdId || !id) householdError("Could not identify that invitation.");

  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.role !== "owner") householdError("Only the household owner can revoke invitations.");

  const { error } = await supabase
    .from("household_invitations")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("household_id", householdId)
    .is("accepted_at", null)
    .is("revoked_at", null);

  if (error) householdError(error.message);

  revalidatePath("/household");
  redirect("/household?household_notice=invite-revoked");
}

export async function removeHouseholdMember(formData: FormData) {
  const { supabase, userId } = await currentUser();
  const householdId = clean(formData.get("household_id"));
  const memberUserId = clean(formData.get("user_id"));

  if (!householdId || !memberUserId) householdError("Could not identify that household member.");
  if (memberUserId === userId) householdError("Use Leave household to remove your own access.");

  const { data: ownerMembership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (ownerMembership?.role !== "owner") householdError("Only the household owner can remove members.");

  const { data: targetMembership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", memberUserId)
    .maybeSingle();

  if (!targetMembership) householdError("That person is no longer in the household.");
  if (targetMembership.role === "owner") householdError("Transfer ownership before removing the household owner.");

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", memberUserId);

  if (error) householdError(error.message);

  revalidatePath("/", "layout");
  revalidatePath("/household");
  redirect("/household?household_notice=member-removed");
}

export async function transferHouseholdOwnership(formData: FormData) {
  const { supabase } = await currentUser();
  const householdId = clean(formData.get("household_id"));
  const newOwnerUserId = clean(formData.get("user_id"));
  if (!householdId || !newOwnerUserId) householdError("Choose a household member to become the new owner.");

  const { error } = await supabase.rpc("transfer_household_ownership", {
    target_household_id: householdId,
    new_owner_user_id: newOwnerUserId,
  });

  if (error) householdError(error.message);

  revalidatePath("/", "layout");
  revalidatePath("/household");
  redirect("/household?household_notice=ownership-transferred");
}

export async function leaveHousehold(formData: FormData) {
  const { supabase } = await currentUser();
  const householdId = clean(formData.get("household_id"));
  if (!householdId) householdError("Could not identify your household.");

  const { error } = await supabase.rpc("leave_household", { target_household_id: householdId });
  if (error) householdError(error.message);

  revalidatePath("/", "layout");
  revalidatePath("/household");
  redirect("/onboarding?left=1");
}

export async function acceptHouseholdInvitation(formData: FormData) {
  const { supabase } = await currentUser();
  const token = clean(formData.get("token"));
  if (!token) redirect("/");

  const { error } = await supabase.rpc("accept_household_invitation", { invite_token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  revalidatePath("/household");
  redirect("/household?joined=1");
}
