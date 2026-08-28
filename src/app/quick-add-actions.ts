"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { extractRecipeFromUrl } from "@/lib/recipe-import-fallback";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

export type QuickAddedRecipe = {
  id: string;
  name: string;
  description: string | null;
  source_url: string | null;
  image_url: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  ingredients: unknown;
  instructions: unknown;
  tags: string[];
  dietary_tags: string[];
  is_favorite: boolean;
};

type QuickAddResult =
  | { ok: true; recipe: QuickAddedRecipe }
  | { ok: false; error: string };

export async function quickAddRecipeAndPlan(formData: FormData): Promise<QuickAddResult> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) return { ok: false, error: "Please sign in again and retry." };

  const householdId = clean(formData.get("household_id"));
  const weekStart = clean(formData.get("week_start"));
  const mealDate = clean(formData.get("meal_date"));
  const requestedName = clean(formData.get("name"));
  const sourceUrl = clean(formData.get("source_url"));

  if (!householdId || !weekStart || !mealDate) {
    return { ok: false, error: "Cook’s Kitchen could not determine which dinner to update." };
  }
  if (!requestedName && !sourceUrl) {
    return { ok: false, error: "Enter a recipe name or paste a recipe URL." };
  }

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return { ok: false, error: "You do not have access to this household." };

  let imported: Awaited<ReturnType<typeof extractRecipeFromUrl>> | null = null;
  if (sourceUrl) {
    try {
      imported = await extractRecipeFromUrl(sourceUrl);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Cook’s Kitchen could not import that recipe link.",
      };
    }
  }

  const name = requestedName || imported?.name || "Imported recipe";
  const ingredients = (imported?.ingredients ?? []).map((text) => ({ text }));

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .insert({
      household_id: householdId,
      name,
      description: imported?.description || null,
      source_url: imported?.source_url || sourceUrl || null,
      image_url: null,
      prep_minutes: imported?.prep_minutes ?? null,
      cook_minutes: imported?.cook_minutes ?? null,
      servings: imported?.servings ?? null,
      ingredients,
      instructions: imported?.instructions ?? [],
      tags: imported?.tags ?? [],
      dietary_tags: imported?.dietary_tags ?? [],
      is_favorite: false,
      created_by: userId,
    })
    .select("id, name, description, source_url, image_url, prep_minutes, cook_minutes, servings, ingredients, instructions, tags, dietary_tags, is_favorite")
    .single();

  if (recipeError || !recipe) {
    return { ok: false, error: recipeError?.message ?? "Could not add that recipe." };
  }

  const { data: existingPlan, error: planLookupError } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("household_id", householdId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (planLookupError) return { ok: false, error: planLookupError.message };

  let mealPlanId = existingPlan?.id;
  if (!mealPlanId) {
    const { data: newPlan, error: planError } = await supabase
      .from("meal_plans")
      .insert({ household_id: householdId, week_start: weekStart, created_by: userId })
      .select("id")
      .single();
    if (planError || !newPlan) {
      return { ok: false, error: planError?.message ?? "Could not create the meal plan." };
    }
    mealPlanId = newPlan.id;
  }

  const { error: itemError } = await supabase.from("meal_plan_items").upsert(
    {
      meal_plan_id: mealPlanId,
      meal_date: mealDate,
      meal_type: "dinner",
      recipe_id: recipe.id,
      custom_label: null,
      status: "planned",
      notes: null,
      planned_servings: recipe.servings,
    },
    { onConflict: "meal_plan_id,meal_date,meal_type" },
  );

  if (itemError) return { ok: false, error: itemError.message };

  revalidatePath("/");
  return { ok: true, recipe: recipe as QuickAddedRecipe };
}
