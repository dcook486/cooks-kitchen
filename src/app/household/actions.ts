"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateHouseholdIdentity(formData: FormData) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/household");

  const householdId = clean(formData.get("household_id"));
  const householdName = clean(formData.get("household_name"));
  const kitchenName = clean(formData.get("kitchen_name"));
  const tagline = clean(formData.get("tagline"));

  if (!householdId || !householdName || !kitchenName) {
    redirect("/household?identity_error=Household%20name%20and%20kitchen%20name%20are%20required.");
  }
  if (householdName.length > 80 || kitchenName.length > 80 || tagline.length > 120) {
    redirect("/household?identity_error=One%20of%20those%20fields%20is%20too%20long.");
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (membership?.role !== "owner") {
    redirect("/household?identity_error=Only%20the%20household%20owner%20can%20change%20shared%20kitchen%20settings.");
  }

  const { error } = await supabase
    .from("households")
    .update({
      name: householdName,
      kitchen_name: kitchenName,
      tagline: tagline || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", householdId);

  if (error) redirect(`/household?identity_error=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  revalidatePath("/household");
  redirect("/household?identity_saved=1");
}
