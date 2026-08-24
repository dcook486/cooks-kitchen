import Link from "next/link";
import { redirect } from "next/navigation";
import { saveImportedRecipe } from "@/app/recipes/import/actions";
import { extractRecipeFromUrl, type ImportedRecipe } from "@/lib/recipe-import-fallback";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Props = {
  searchParams: Promise<{ url?: string | string[]; error?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ImportRecipePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/recipes/import");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", membership.household_id)
    .maybeSingle();

  const requestedUrl = first(params.url)?.trim() ?? "";
  let imported: ImportedRecipe | null = null;
  let extractionError = first(params.error) ?? "";

  if (requestedUrl && !extractionError) {
    try {
      imported = await extractRecipeFromUrl(requestedUrl);
    } catch (error) {
      extractionError = error instanceof Error ? error.message : "Cook’s Kitchen could not import that recipe.";
    }
  }

  return (
    <main className="recipe-detail-shell import-recipe-shell">
      <div className="recipe-detail-nav">
        <Link className="back-link" href="/?section=recipes">← Recipe bank</Link>
        <span>{household?.name ?? "Shared household"}</span>
      </div>

      <header className="import-heading">
        <div>
          <p className="eyebrow">ADD A RECIPE FASTER</p>
          <h1>Import from a link</h1>
          <p>Paste a recipe webpage and Cook&apos;s Kitchen will pull in the useful details for you to review before saving.</p>
        </div>
      </header>

      <form className="import-url-card" method="get">
        <label htmlFor="recipe-url">Recipe URL</label>
        <div className="import-url-row">
          <input
            id="recipe-url"
            name="url"
            type="url"
            defaultValue={requestedUrl}
            placeholder="https://www.example.com/favorite-recipe"
            required
          />
          <button className="primary" type="submit">Extract recipe</button>
        </div>
        <p className="import-helper">Works best with sites that publish standard Recipe data. You&apos;ll always get a chance to edit before saving.</p>
      </form>

      {extractionError && <div className="form-alert error import-alert">{extractionError}</div>}

      {imported && (
        <section className="recipe-edit-card import-preview-card">
          <div className="form-title recipe-edit-heading">
            <div>
              <p className="eyebrow">REVIEW IMPORT</p>
              <h2>{imported.structured ? "Recipe found" : "Page basics found"}</h2>
            </div>
            <a className="secondary link-button" href={imported.source_url} target="_blank" rel="noreferrer">View source ↗</a>
          </div>

          {imported.warnings.map((warning) => (
            <div className="form-alert import-warning" key={warning}>{warning}</div>
          ))}

          <div className="import-photo-note">
            <strong>Photos are yours.</strong>
            <span>Cook&apos;s Kitchen won&apos;t copy the recipe website&apos;s image. After saving, you can upload your own photo of the dish.</span>
          </div>

          <form className="recipe-edit-form" action={saveImportedRecipe}>
            <input type="hidden" name="household_id" value={membership.household_id} />
            <div className="form-grid two">
              <label>Recipe name<input name="name" defaultValue={imported.name} required /></label>
              <label>Source URL<input name="source_url" type="url" defaultValue={imported.source_url} /></label>
            </div>
            <label>Description<textarea name="description" rows={3} defaultValue={imported.description} /></label>
            <div className="form-grid three">
              <label>Prep minutes<input name="prep_minutes" type="number" min="0" inputMode="numeric" defaultValue={imported.prep_minutes ?? ""} /></label>
              <label>Cook minutes<input name="cook_minutes" type="number" min="0" inputMode="numeric" defaultValue={imported.cook_minutes ?? ""} /></label>
              <label>Servings<input name="servings" type="number" min="0.5" step="0.5" inputMode="decimal" defaultValue={imported.servings ?? ""} /></label>
            </div>
            <div className="form-grid two">
              <label>Tags<input name="tags" defaultValue={imported.tags.join(", ")} placeholder="quick, mexican, freezer" /></label>
              <label>Dietary tags<input name="dietary_tags" defaultValue={imported.dietary_tags.join(", ")} placeholder="gluten-free, dairy-free" /></label>
            </div>
            <div className="form-grid two recipe-long-fields">
              <label>Ingredients<textarea name="ingredients" rows={14} defaultValue={imported.ingredients.join("\n")} placeholder="One ingredient per line" /></label>
              <label>Instructions<textarea name="instructions" rows={14} defaultValue={imported.instructions.join("\n")} placeholder="One step per line" /></label>
            </div>
            <div className="form-footer recipe-edit-footer">
              <label className="favorite-check"><input type="checkbox" name="is_favorite" /> ⭐ Family favorite</label>
              <div className="inline-actions">
                <Link className="secondary link-button" href="/?section=recipes">Cancel</Link>
                <button className="primary" type="submit">Save to recipe bank</button>
              </div>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
