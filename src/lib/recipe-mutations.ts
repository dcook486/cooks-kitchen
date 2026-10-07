import type { createClient } from "@/lib/supabase/server";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const RECIPE_PHOTO_MARKER = "/storage/v1/object/public/recipe-photos/";

export function photoPathFromPublicUrl(value: string | null) {
  if (!value) return null;
  const index = value.indexOf(RECIPE_PHOTO_MARKER);
  if (index < 0) return null;
  const encodedPath = value.slice(index + RECIPE_PHOTO_MARKER.length);
  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

/** Permanently deletes a recipe (RLS limits this to household members) and cleans up its photo. */
export async function deleteRecipeById(supabase: ServerSupabase, id: string) {
  const { data: recipe } = await supabase.from("recipes").select("image_url").eq("id", id).maybeSingle();
  const path = photoPathFromPublicUrl(recipe?.image_url ?? null);

  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (path) await supabase.storage.from("recipe-photos").remove([path]);
}

/** Clears a recipe's photo and removes the stored file. */
export async function removeRecipePhotoById(supabase: ServerSupabase, id: string) {
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  if (recipeError || !recipe) throw new Error("That recipe is not available to this household.");
  const path = photoPathFromPublicUrl(recipe.image_url);

  const { error } = await supabase
    .from("recipes")
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  if (path) await supabase.storage.from("recipe-photos").remove([path]);
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
