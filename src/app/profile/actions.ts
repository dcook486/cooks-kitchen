"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateProfile(formData: FormData) {
  const displayName = clean(formData.get("display_name"));

  if (!displayName) {
    redirect("/profile?error=Enter%20a%20name%20to%20display%20in%20Cook%27s%20Kitchen.");
  }

  if (displayName.length > 60) {
    redirect("/profile?error=Keep%20your%20display%20name%20under%2060%20characters.");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, updated_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  redirect("/profile?message=Profile%20updated.");
}

export async function deleteAccount(formData: FormData) {
  const confirmation = clean(formData.get("confirmation"));
  if (confirmation !== "DELETE") {
    redirect("/profile?error=Type%20DELETE%20exactly%20to%20confirm%20account%20deletion.");
  }

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/login");

  const { error } = await supabase.rpc("delete_own_account", { confirm_text: confirmation });
  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`);
  }

  // The user row is gone at this point. This clears the local auth cookies when possible.
  await supabase.auth.signOut().catch(() => undefined);
  revalidatePath("/", "layout");
  redirect("/login?message=Your%20Cook%27s%20Kitchen%20account%20has%20been%20deleted.");
}
