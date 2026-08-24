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

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return supabase;
}

export async function updateRecipe(formData: FormData) {
  const supabase = await authenticatedClient();
  const id = clean(formData.get("id"));
  const name = clean(formData.get("name"));

  if (!id || !name) return;

  const ingredients = lines(formData.get("ingredients")).map((text) => ({ text }));
  const instructions = lines(formData.get("instructions"));

  const { error } = await supabase
    .from("recipes")
    .update({
      name,
      description: clean(formData.get("description")) || null,
      source_url: clean(formData.get("source_url")) || null,
      prep_minutes: numberOrNull(formData.get("prep_minutes")),
      cook_minutes: numberOrNull(formData.get("cook_minutes")),
      servings: numberOrNull(formData.get("servings")),
      ingredients,
      instructions,
      tags: list(formData.get("tags")),
      dietary_tags: list(formData.get("dietary_tags")),
      is_favorite: formData.get("is_favorite") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}?saved=1`);
}

export async function deleteRecipeFromDetail(formData: FormData) {
  const supabase = await authenticatedClient();
  const id = clean(formData.get("id"));
  if (!id) return;

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/");
  redirect("/?section=recipes");
}
