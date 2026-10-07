import Link from "next/link";
import { updateRecipe } from "@/app/recipes/actions";
import { DeleteRecipeButton, FlashToast, RecipePhotoSection } from "@/components/recipe-detail-actions";
import { CookingLists } from "@/components/cooking-mode";
import { SubmitButton } from "@/components/submit-button";

export type RecipeDetail = {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  source_url: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  tags: string[];
  dietary_tags: string[];
  is_favorite: boolean;
};

type Props = {
  recipe: RecipeDetail;
  householdName: string | null;
  ingredients: string[];
  instructions: string[];
  sourceUrl: string | null;
  imageUrl: string | null;
  editing: boolean;
  flags: { saved?: boolean; imported?: boolean; photo?: boolean; photoRemoved?: boolean };
};

const FLASH_PARAMS = ["saved", "imported", "photo", "photo_removed"];

/** Presentational recipe detail / edit screen (data is loaded by the route). */
export function RecipeDetailView({ recipe, householdName, ingredients, instructions, sourceUrl, imageUrl, editing, flags }: Props) {
  const totalMinutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);

  return (
    <main className="recipe-detail-shell">
      <div className="recipe-detail-nav">
        <Link className="back-link" href="/?section=recipes">← Recipe bank</Link>
        <span>{householdName ?? "Shared household"}</span>
      </div>

      {flags.saved && <FlashToast message="Recipe updated." params={FLASH_PARAMS} />}
      {flags.imported && <FlashToast message="Recipe imported and added to your shared recipe bank." params={FLASH_PARAMS} />}
      {flags.photo && <FlashToast message="Recipe photo saved." params={FLASH_PARAMS} />}
      {flags.photoRemoved && <FlashToast message="Recipe photo removed." params={FLASH_PARAMS} />}

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

          <RecipePhotoSection recipeId={recipe.id} householdId={recipe.household_id} recipeName={recipe.name} imageUrl={imageUrl} />

          <CookingLists ingredients={ingredients} instructions={instructions} />

          <div className="recipe-danger-zone">
            <DeleteRecipeButton recipeId={recipe.id} />
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
              <label>Recipe name<input name="name" defaultValue={recipe.name} required autoComplete="off" autoCapitalize="words" enterKeyHint="next" /></label>
              <label>Source URL<input name="source_url" type="url" inputMode="url" defaultValue={recipe.source_url ?? ""} placeholder="https://…" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /></label>
            </div>
            <label>Description<textarea name="description" rows={3} defaultValue={recipe.description ?? ""} /></label>
            <div className="form-grid three">
              <label>Prep minutes<input name="prep_minutes" type="number" min="0" inputMode="numeric" enterKeyHint="next" defaultValue={recipe.prep_minutes ?? ""} /></label>
              <label>Cook minutes<input name="cook_minutes" type="number" min="0" inputMode="numeric" enterKeyHint="next" defaultValue={recipe.cook_minutes ?? ""} /></label>
              <label>Servings<input name="servings" type="number" min="0.5" step="0.5" inputMode="decimal" enterKeyHint="next" defaultValue={recipe.servings ?? ""} /></label>
            </div>
            <div className="form-grid two">
              <label><span className="field-label">Tags <span className="field-hint">(comma-separated)</span></span><input name="tags" defaultValue={recipe.tags.join(", ")} placeholder="quick, mexican, freezer" autoComplete="off" autoCapitalize="none" enterKeyHint="next" /></label>
              <label><span className="field-label">Dietary tags <span className="field-hint">(comma-separated)</span></span><input name="dietary_tags" defaultValue={recipe.dietary_tags.join(", ")} placeholder="gluten-free, dairy-free" autoComplete="off" autoCapitalize="none" enterKeyHint="next" /></label>
            </div>
            <div className="form-grid two recipe-long-fields">
              <label><span className="field-label">Ingredients <span className="field-hint">(one per line)</span></span><textarea name="ingredients" rows={12} defaultValue={ingredients.join("\n")} /></label>
              <label><span className="field-label">Instructions <span className="field-hint">(one step per line)</span></span><textarea name="instructions" rows={12} defaultValue={instructions.join("\n")} /></label>
            </div>
            <div className="form-footer recipe-edit-footer sticky-save-bar">
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
