import { notFound, redirect } from "next/navigation";
import { RecipeDetailView } from "@/components/recipe-detail-view";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; saved?: string; imported?: string; photo?: string; photo_removed?: string }>;
};

type Recipe = {
  id: string;
  household_id: string;
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

function ingredientLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item && typeof item.text === "string") return item.text.trim();
      return "";
    })
    .filter(Boolean);
}

function instructionLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function safeWebUrl(value: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function recipePhotoUrl(value: string | null) {
  const url = safeWebUrl(value);
  return url?.includes("/storage/v1/object/public/recipe-photos/") ? url : null;
}

export default async function RecipePage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) redirect(`/login?next=${encodeURIComponent(`/recipes/${id}`)}`);

  const { data: recipeData, error } = await supabase
    .from("recipes")
    .select("id, household_id, name, description, source_url, image_url, prep_minutes, cook_minutes, servings, ingredients, instructions, tags, dietary_tags, is_favorite")
    .eq("id", id)
    .maybeSingle();

  if (error || !recipeData) notFound();
  const recipe = recipeData as Recipe;

  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", recipe.household_id)
    .maybeSingle();

  const ingredients = ingredientLines(recipe.ingredients);
  const instructions = instructionLines(recipe.instructions);
  const sourceUrl = safeWebUrl(recipe.source_url);
  const imageUrl = recipePhotoUrl(recipe.image_url);

  return (
    <RecipeDetailView
      recipe={recipe}
      householdName={household?.name ?? null}
      ingredients={ingredients}
      instructions={instructions}
      sourceUrl={sourceUrl}
      imageUrl={imageUrl}
      editing={query.edit === "1"}
      flags={{ saved: query.saved === "1", imported: query.imported === "1", photo: query.photo === "1", photoRemoved: query.photo_removed === "1" }}
    />
  );
}
