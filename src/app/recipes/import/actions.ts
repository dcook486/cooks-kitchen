"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function list(value: FormDataEntryValue | null) {
  return clean(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function lines(value: FormDataEntryValue | null) {
  return clean(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function webUrlOrNull(value: FormDataEntryValue | null) {
  const text = clean(value);
  if (!text) return null;
  try {
    const parsed = new URL(text);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function saveImportedRecipe(formData: FormData) {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/recipes/import");

  const householdId = clean(formData.get("household_id"));
  const name = clean(formData.get("name"));
  if (!householdId || !name) redirect("/recipes/import?error=Recipe%20name%20is%20required.");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!membership) throw new Error("You do not have access to this household.");

  const ingredients = lines(formData.get("ingredients")).map((text) => ({ text }));
  const instructions = lines(formData.get("instructions"));

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      name,
      description: clean(formData.get("description")) || null,
      source_url: webUrlOrNull(formData.get("source_url")),
      image_url: null,
      prep_minutes: numberOrNull(formData.get("prep_minutes")),
      cook_minutes: numberOrNull(formData.get("cook_minutes")),
      servings: numberOrNull(formData.get("servings")),
      ingredients,
      instructions,
      tags: list(formData.get("tags")),
      dietary_tags: list(formData.get("dietary_tags")),
      is_favorite: formData.get("is_favorite") === "on",
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !recipe) throw new Error(error?.message ?? "Could not save imported recipe.");

  revalidatePath("/");
  redirect(`/recipes/${recipe.id}?imported=1`);
}
