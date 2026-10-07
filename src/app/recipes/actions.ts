"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { deleteRecipeById, photoPathFromPublicUrl, removeRecipePhotoById, UUID_PATTERN } from "@/lib/recipe-mutations";
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

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) redirect("/login");
  return { supabase, userId };
}

export async function updateRecipe(formData: FormData) {
  const { supabase } = await authenticatedClient();
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
      source_url: webUrlOrNull(formData.get("source_url")),
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

export async function saveRecipePhotoPath(formData: FormData) {
  const { supabase } = await authenticatedClient();
  const id = clean(formData.get("id"));
  const path = clean(formData.get("path"));
  if (!id || !path) throw new Error("Missing recipe photo information.");

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, household_id, image_url")
    .eq("id", id)
    .maybeSingle();

  if (recipeError || !recipe) throw new Error("That recipe is not available to this household.");

  const expectedPrefix = `${recipe.household_id}/${recipe.id}/`;
  if (!path.startsWith(expectedPrefix) || path.includes("..")) throw new Error("Invalid recipe photo path.");

  const oldPath = photoPathFromPublicUrl(recipe.image_url);
  const { data: publicData } = supabase.storage.from("recipe-photos").getPublicUrl(path);

  const { error } = await supabase
    .from("recipes")
    .update({ image_url: publicData.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);

  if (oldPath && oldPath !== path) {
    await supabase.storage.from("recipe-photos").remove([oldPath]);
  }

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
}

export async function removeRecipePhoto(formData: FormData) {
  const { supabase } = await authenticatedClient();
  const id = clean(formData.get("id"));
  if (!id) return;

  await removeRecipePhotoById(supabase, id);

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  redirect(`/recipes/${id}?photo_removed=1`);
}

export async function deleteRecipeFromDetail(formData: FormData) {
  const { supabase } = await authenticatedClient();
  const id = clean(formData.get("id"));
  if (!id) return;

  await deleteRecipeById(supabase, id);

  revalidatePath("/");
  redirect("/?section=recipes");
}

type UndoableResult = { ok: true } | { ok: false; error: string };

/** Runs a recipe delete once its undo window has passed. Returns instead of redirecting. */
export async function deleteRecipeNow(id: string): Promise<UndoableResult> {
  const { supabase } = await authenticatedClient();
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Unknown recipe." };
  try {
    await deleteRecipeById(supabase, id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete that recipe." };
  }
  revalidatePath("/");
  return { ok: true };
}

/** Removes a recipe photo once its undo window has passed. Returns instead of redirecting. */
export async function removeRecipePhotoNow(id: string): Promise<UndoableResult> {
  const { supabase } = await authenticatedClient();
  if (!UUID_PATTERN.test(id)) return { ok: false, error: "Unknown recipe." };
  try {
    await removeRecipePhotoById(supabase, id);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not remove that photo." };
  }
  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  return { ok: true };
}
