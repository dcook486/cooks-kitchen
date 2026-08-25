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
