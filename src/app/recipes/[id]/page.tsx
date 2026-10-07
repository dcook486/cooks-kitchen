import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteRecipeFromDetail, removeRecipePhoto, updateRecipe } from "@/app/recipes/actions";
import { RecipePhotoUploader } from "@/components/recipe-photo-uploader";
import { SubmitButton } from "@/components/submit-button";
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
  const editing = query.edit === "1";
  const totalMinutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  return (
    <main className="recipe-detail-shell">
      <div className="recipe-detail-nav">
        <Link className="back-link" href="/?section=recipes">← Recipe bank</Link>
        <span>{household?.name ?? "Shared household"}</span>
      </div>

      {query.saved === "1" && <div className="form-alert success recipe-save-alert" role="status">Recipe updated.</div>}
      {query.imported === "1" && <div className="form-alert success recipe-save-alert">Recipe imported and added to your shared recipe bank.</div>}
      {query.photo === "1" && <div className="form-alert success recipe-save-alert">Recipe photo saved.</div>}
      {query.photo_removed === "1" && <div className="form-alert success recipe-save-alert">Recipe photo removed.</div>}

      {!editing ? (
        <>
          <header className="recipe-detail-hero">
            <div className="recipe-detail-title">
              <p className="eyebrow">{recipe.is_favorite ? "⭐ FAMILY FAVORITE" : "SHARED RECIPE"}</p>
              <h1>{recipe.name}</h1>
              {recipe.description && <p className="recipe-detail-description">{recipe.description}</p>}
              <div className="tag-row recipe-detail-tags">
                {[...recipe.tags, ...recipe.dietary_tags].map((tag) => <span className="badge" key={tag}>{tag}</span>)}
              </div>
            </div>
            <div className="recipe-detail-actions">
              <Link className="primary link-button" href={`/recipes/${recipe.id}?edit=1`}>Edit recipe</Link>
              {sourceUrl && <a className="secondary link-button" href={sourceUrl} target="_blank" rel="noreferrer">Original recipe ↗</a>}
            </div>
          </header>

          <section className="recipe-stats" aria-label="Recipe details">
            <div><span>Prep</span><strong>{recipe.prep_minutes != null ? `${recipe.prep_minutes} min` : "—"}</strong></div>
            <div><span>Cook</span><strong>{recipe.cook_minutes != null ? `${recipe.cook_minutes} min` : "—"}</strong></div>
            <div><span>Total</span><strong>{totalMinutes ? `${totalMinutes} min` : "—"}</strong></div>
            <div><span>Servings</span><strong>{recipe.servings ?? "—"}</strong></div>
          </section>

          {imageUrl ? (
            <section className="recipe-photo-block">
              <div className="recipe-user-photo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={recipe.name} />
              </div>
              <div className="recipe-photo-controls">
                <RecipePhotoUploader recipeId={recipe.id} householdId={recipe.household_id} hasPhoto />
                <form action={removeRecipePhoto}>
                  <input type="hidden" name="id" value={recipe.id} />
                  <SubmitButton className="text-button" pendingLabel="Removing…" confirmMessage="Remove this photo from the recipe?">Remove photo</SubmitButton>
                </form>
              </div>
            </section>
          ) : (
            <section className="recipe-photo-prompt">
              <div>
                <p className="eyebrow">OPTIONAL PHOTO</p>
                <h3>Add your own photo</h3>
                <p>Use a photo of your family&apos;s version instead of relying on an image hosted by the recipe website.</p>
              </div>
              <RecipePhotoUploader recipeId={recipe.id} householdId={recipe.household_id} />
            </section>
          )}

          <div className="recipe-cook-grid">
            <section className="recipe-cook-card ingredients-card">
              <div className="recipe-section-heading">
                <p className="eyebrow">WHAT YOU NEED</p>
                <h2>Ingredients</h2>
              </div>
              {ingredients.length ? (
                <ul className="ingredient-list">
                  {ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}
                </ul>
              ) : <p className="recipe-empty-copy">No ingredients have been added yet.</p>}
            </section>

            <section className="recipe-cook-card instructions-card">
              <div className="recipe-section-heading">
                <p className="eyebrow">HOW TO MAKE IT</p>
                <h2>Instructions</h2>
              </div>
              {instructions.length ? (
                <ol className="instruction-list">
                  {instructions.map((instruction, index) => (
                    <li key={`${instruction}-${index}`}><span>{index + 1}</span><p>{instruction}</p></li>
                  ))}
                </ol>
              ) : <p className="recipe-empty-copy">No instructions have been added yet.</p>}
            </section>
          </div>

          <div className="recipe-danger-zone">
            <form action={deleteRecipeFromDetail}>
              <input type="hidden" name="id" value={recipe.id} />
              <SubmitButton className="danger-link" pendingLabel="Deleting…" confirmMessage={`Delete “${recipe.name}”? It will be removed from your household’s recipe bank for everyone. This can’t be undone.`}>Delete recipe</SubmitButton>
            </form>
          </div>
        </>
      ) : (
        <section className="recipe-edit-card">
          <div className="form-title recipe-edit-heading">
            <div><p className="eyebrow">EDIT RECIPE</p><h1>{recipe.name}</h1></div>
            <Link className="secondary link-button" href={`/recipes/${recipe.id}`}>Cancel</Link>
          </div>

          <form className="recipe-edit-form" action={updateRecipe}>
            <input type="hidden" name="id" value={recipe.id} />
            <div className="form-grid two">
              <label>Recipe name<input name="name" defaultValue={recipe.name} required /></label>
              <label>Source URL<input name="source_url" type="url" defaultValue={recipe.source_url ?? ""} placeholder="https://…" /></label>
            </div>
            <label>Description<textarea name="description" rows={3} defaultValue={recipe.description ?? ""} /></label>
            <div className="form-grid three">
              <label>Prep minutes<input name="prep_minutes" type="number" min="0" inputMode="numeric" defaultValue={recipe.prep_minutes ?? ""} /></label>
              <label>Cook minutes<input name="cook_minutes" type="number" min="0" inputMode="numeric" defaultValue={recipe.cook_minutes ?? ""} /></label>
              <label>Servings<input name="servings" type="number" min="0.5" step="0.5" inputMode="decimal" defaultValue={recipe.servings ?? ""} /></label>
            </div>
            <div className="form-grid two">
              <label><span className="field-label">Tags <span className="field-hint">(comma-separated)</span></span><input name="tags" defaultValue={recipe.tags.join(", ")} placeholder="quick, mexican, freezer" /></label>
              <label><span className="field-label">Dietary tags <span className="field-hint">(comma-separated)</span></span><input name="dietary_tags" defaultValue={recipe.dietary_tags.join(", ")} placeholder="gluten-free, dairy-free" /></label>
            </div>
            <div className="form-grid two recipe-long-fields">
              <label><span className="field-label">Ingredients <span className="field-hint">(one per line)</span></span><textarea name="ingredients" rows={12} defaultValue={ingredients.join("\n")} /></label>
              <label><span className="field-label">Instructions <span className="field-hint">(one step per line)</span></span><textarea name="instructions" rows={12} defaultValue={instructions.join("\n")} /></label>
            </div>
            <div className="form-footer recipe-edit-footer">
              <label className="favorite-check"><input type="checkbox" name="is_favorite" defaultChecked={recipe.is_favorite} /> ⭐ Family favorite</label>
              <div className="inline-actions">
                <Link className="secondary link-button" href={`/recipes/${recipe.id}`}>Cancel</Link>
                <SubmitButton className="primary" pendingLabel="Saving…">Save changes</SubmitButton>
              </div>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
