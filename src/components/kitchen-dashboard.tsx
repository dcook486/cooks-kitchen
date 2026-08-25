"use client";

import { useMemo, useState } from "react";
import { addRecipe, toggleFavorite } from "@/app/actions";
import { AccountMenu } from "@/components/account-menu";
import { WeeklyPlanner } from "@/components/weekly-planner";

type View = "week" | "recipes";
type PlannerMode = "week" | "month";

type Household = { id: string; name: string; timezone: string };
type Recipe = {
  id: string; name: string; description: string | null; source_url: string | null; image_url: string | null;
  prep_minutes: number | null; cook_minutes: number | null; servings: number | null; ingredients: unknown;
  instructions: unknown; tags: string[]; dietary_tags: string[]; is_favorite: boolean;
};
type MealPlanItem = { id: string; meal_date: string; meal_type: string; recipe_id: string | null; custom_label: string | null; status: string; notes: string | null };

type Props = {
  household: Household;
  recipes: Recipe[];
  displayName: string;
  mealPlanItems: MealPlanItem[];
  weekStart: string;
  currentWeekStart: string;
  monthAnchor: string;
  initialPlannerMode: PlannerMode;
  initialView: View;
};

const views: Array<{ id: View; label: string; mobileLabel: string; icon: string }> = [
  { id: "week", label: "This week", mobileLabel: "Week", icon: "▦" },
  { id: "recipes", label: "Recipes", mobileLabel: "Recipes", icon: "⌑" },
];

function totalMinutes(recipe: Recipe) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return total || null;
}
function ingredientCount(recipe: Recipe) { return Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0; }

export function KitchenDashboard({ household, recipes, displayName, mealPlanItems, weekStart, currentWeekStart, monthAnchor, initialPlannerMode, initialView }: Props) {
  const [view, setView] = useState<View>(initialView);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  const visibleRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (favoriteOnly && !recipe.is_favorite) return false;
      if (!needle) return true;
      return [recipe.name, recipe.description ?? "", ...recipe.tags, ...recipe.dietary_tags].join(" ").toLowerCase().includes(needle);
    });
  }, [favoriteOnly, query, recipes]);

  function selectView(nextView: View) {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "week") url.searchParams.delete("section");
    else url.searchParams.set("section", nextView);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function tabLabel(tab: View) {
    if (tab === "recipes") return `Recipes · ${recipes.length}`;
    return "This week";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">{household.name.toUpperCase()}</p>
          <h1>Cook&apos;s Kitchen</h1>
          <p className="welcome-line">Welcome back, {displayName}.</p>
        </div>
        <AccountMenu displayName={displayName} />
      </header>

      <nav className="tabs desktop-tabs" aria-label="App sections">
        {views.map((tab) => (
          <button key={tab.id} className={`tab ${view === tab.id ? "active" : ""}`} onClick={() => selectView(tab.id)} aria-current={view === tab.id ? "page" : undefined}>
            {tabLabel(tab.id)}
          </button>
        ))}
      </nav>

      <main>
        {view === "week" && <WeeklyPlanner householdId={household.id} timeZone={household.timezone} recipes={recipes} mealPlanItems={mealPlanItems} weekStart={weekStart} currentWeekStart={currentWeekStart} monthAnchor={monthAnchor} initialMode={initialPlannerMode} />}

        {view === "recipes" && (
          <section>
            <div className="section-heading">
              <div><p className="eyebrow">YOUR SHARED RECIPE BANK</p><h2>Recipes</h2></div>
              <div className="inline-actions recipe-actions">
                <a className="secondary link-button" href="/recipes/import">Import from URL</a>
                <button className="primary" onClick={() => setShowAddRecipe((value) => !value)}>{showAddRecipe ? "Close" : "+ Add recipe"}</button>
              </div>
            </div>

            {showAddRecipe && (
              <form className="recipe-form" action={async (formData) => { await addRecipe(formData); setShowAddRecipe(false); }}>
                <input type="hidden" name="household_id" value={household.id} />
                <div className="form-title"><div><p className="eyebrow">NEW GO-TO</p><h3>Add a recipe</h3></div><span>Only the name is required.</span></div>
                <div className="form-grid two">
                  <label>Recipe name<input name="name" placeholder="Chicken enchiladas" required /></label>
                  <label>Source URL<input name="source_url" type="url" placeholder="https://…" /></label>
                </div>
                <label>Description<textarea name="description" rows={2} placeholder="Creamy, weeknight-friendly, and great for leftovers." /></label>
                <div className="form-grid three">
                  <label>Prep minutes<input name="prep_minutes" type="number" min="0" inputMode="numeric" /></label>
                  <label>Cook minutes<input name="cook_minutes" type="number" min="0" inputMode="numeric" /></label>
                  <label>Servings<input name="servings" type="number" min="1" step="0.5" inputMode="decimal" /></label>
                </div>
                <div className="form-grid two">
                  <label>Tags<input name="tags" placeholder="quick, mexican, freezer" /></label>
                  <label>Dietary tags<input name="dietary_tags" placeholder="gluten-free, dairy-free" /></label>
                </div>
                <div className="form-grid two">
                  <label>Ingredients<textarea name="ingredients" rows={6} placeholder={"1 lb chicken breast\n8 tortillas\n2 cups enchilada sauce"} /></label>
                  <label>Instructions<textarea name="instructions" rows={6} placeholder={"Cook and shred chicken\nFill tortillas\nBake until bubbling"} /></label>
                </div>
                <div className="form-footer">
                  <label className="favorite-check"><input type="checkbox" name="is_favorite" /> ⭐ Make this a favorite</label>
                  <button className="primary" type="submit">Save recipe</button>
                </div>
              </form>
            )}

            <div className="recipe-toolbar">
              <input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes, tags, dietary needs…" aria-label="Search recipes" />
              <button className={`secondary ${favoriteOnly ? "selected" : ""}`} onClick={() => setFavoriteOnly((value) => !value)} aria-pressed={favoriteOnly}>⭐ Favorites</button>
            </div>

            {visibleRecipes.length ? (
              <div className="recipe-grid">
                {visibleRecipes.map((recipe) => {
                  const minutes = totalMinutes(recipe);
                  return (
                    <article className="recipe-card" key={recipe.id}>
                      <div className="recipe-card-top">
                        <form action={toggleFavorite}>
                          <input type="hidden" name="id" value={recipe.id} /><input type="hidden" name="next" value={String(!recipe.is_favorite)} />
                          <button className="icon-button" title={recipe.is_favorite ? "Remove favorite" : "Add favorite"} aria-label={recipe.is_favorite ? `Remove ${recipe.name} from favorites` : `Add ${recipe.name} to favorites`}>{recipe.is_favorite ? "⭐" : "☆"}</button>
                        </form>
                        <span className="minutes">{minutes ? `${minutes} min` : `${ingredientCount(recipe)} ingredients`}</span>
                      </div>
                      <h3><a className="recipe-open-link" href={`/recipes/${recipe.id}`}>{recipe.name}</a></h3>
                      <p>{recipe.description || "A family recipe ready for the weekly plan."}</p>
                      <div className="tag-row">{[...recipe.tags, ...recipe.dietary_tags].slice(0, 4).map((tag) => <span className="badge" key={tag}>{tag}</span>)}</div>
                      <div className="recipe-card-footer">
                        <span>{recipe.servings ? `Serves ${recipe.servings}` : "Shared recipe"}</span>
                        <a className="recipe-card-open" href={`/recipes/${recipe.id}`}>Open recipe →</a>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><div>🥘</div><h3>{recipes.length ? "No recipes match" : "Your recipe bank is ready"}</h3><p>{recipes.length ? "Try a different search or show all recipes." : "Add the meals you already love. They’ll appear immediately in your weekly planner."}</p>{!recipes.length && <button className="primary" onClick={() => setShowAddRecipe(true)}>Add your first recipe</button>}</div>
            )}
          </section>
        )}
      </main>

      <nav className="mobile-bottom-nav" aria-label="App sections">
        {views.map((tab) => (
          <button key={tab.id} className={view === tab.id ? "active" : ""} onClick={() => selectView(tab.id)} aria-current={view === tab.id ? "page" : undefined}>
            <span className="mobile-nav-icon" aria-hidden="true">{tab.icon}</span>
            <span>{tab.mobileLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
