"use client";

import { useMemo, useState } from "react";
import { addRecipe, deleteRecipe, logout, toggleFavorite } from "@/app/actions";

type View = "week" | "recipes" | "grocery";

type Household = {
  id: string;
  name: string;
  timezone: string;
};

type Recipe = {
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

type Props = {
  household: Household;
  recipes: Recipe[];
  displayName: string;
};

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function totalMinutes(recipe: Recipe) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return total || null;
}

function ingredientCount(recipe: Recipe) {
  return Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0;
}

export function KitchenDashboard({ household, recipes, displayName }: Props) {
  const [view, setView] = useState<View>(recipes.length ? "recipes" : "week");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddRecipe, setShowAddRecipe] = useState(false);

  const visibleRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (favoriteOnly && !recipe.is_favorite) return false;
      if (!needle) return true;
      return [recipe.name, recipe.description ?? "", ...recipe.tags, ...recipe.dietary_tags]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [favoriteOnly, query, recipes]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">{household.name.toUpperCase()}</p>
          <h1>Cook&apos;s Kitchen</h1>
          <p className="welcome-line">Welcome back, {displayName}.</p>
        </div>
        <div className="account-actions">
          <span className="sync-pill">● Live &amp; shared</span>
          <form action={logout}><button className="secondary">Sign out</button></form>
        </div>
      </header>

      <nav className="tabs" aria-label="App sections">
        {(["week", "recipes", "grocery"] as View[]).map((tab) => (
          <button
            key={tab}
            className={`tab ${view === tab ? "active" : ""}`}
            onClick={() => setView(tab)}
          >
            {tab === "week" ? "This week" : tab === "recipes" ? `Recipes · ${recipes.length}` : "Grocery list"}
          </button>
        ))}
      </nav>

      <main>
        {view === "week" && (
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">DINNER AT A GLANCE</p>
                <h2>This week</h2>
              </div>
              <button className="primary" onClick={() => setView("recipes")}>Choose from recipes</button>
            </div>

            <div className="week-grid">
              {days.map((day, index) => {
                const suggestion = recipes[index % Math.max(recipes.length, 1)];
                return (
                  <article className="day-card" key={day}>
                    <div className="day-name">{day}</div>
                    <div className="day-date">Dinner</div>
                    <div className="meal-slot">
                      {suggestion ? (
                        <>
                          <div className="meal-name muted-meal">Not planned yet</div>
                          <div className="meal-meta">Try {suggestion.name}</div>
                          <button className="mini-link" onClick={() => setView("recipes")}>View recipe bank →</button>
                        </>
                      ) : (
                        <button className="empty-slot" onClick={() => setView("recipes")}>+ Add recipes first</button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="coming-next">
              <span>Next build</span>
              The weekly planner will save these dinner slots to Supabase and feed the grocery list automatically.
            </div>
          </section>
        )}

        {view === "recipes" && (
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">YOUR SHARED RECIPE BANK</p>
                <h2>Recipes</h2>
              </div>
              <button className="primary" onClick={() => setShowAddRecipe((value) => !value)}>
                {showAddRecipe ? "Close" : "+ Add recipe"}
              </button>
            </div>

            {showAddRecipe && (
              <form className="recipe-form" action={async (formData) => {
                await addRecipe(formData);
                setShowAddRecipe(false);
              }}>
                <input type="hidden" name="household_id" value={household.id} />
                <div className="form-title">
                  <div><p className="eyebrow">NEW GO-TO</p><h3>Add a recipe</h3></div>
                  <span>Only the name is required.</span>
                </div>
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
              <input
                className="search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search recipes, tags, dietary needs…"
              />
              <button className={`secondary ${favoriteOnly ? "selected" : ""}`} onClick={() => setFavoriteOnly((value) => !value)}>
                ⭐ Favorites
              </button>
            </div>

            {visibleRecipes.length ? (
              <div className="recipe-grid">
                {visibleRecipes.map((recipe) => {
                  const minutes = totalMinutes(recipe);
                  return (
                    <article className="recipe-card" key={recipe.id}>
                      <div className="recipe-card-top">
                        <form action={toggleFavorite}>
                          <input type="hidden" name="id" value={recipe.id} />
                          <input type="hidden" name="next" value={String(!recipe.is_favorite)} />
                          <button className="icon-button" title={recipe.is_favorite ? "Remove favorite" : "Add favorite"}>
                            {recipe.is_favorite ? "⭐" : "☆"}
                          </button>
                        </form>
                        <span className="minutes">{minutes ? `${minutes} min` : `${ingredientCount(recipe)} ingredients`}</span>
                      </div>
                      <h3>{recipe.name}</h3>
                      <p>{recipe.description || "A family recipe ready for the weekly plan."}</p>
                      <div className="tag-row">
                        {[...recipe.tags, ...recipe.dietary_tags].slice(0, 4).map((tag) => <span className="badge" key={tag}>{tag}</span>)}
                      </div>
                      <div className="recipe-card-footer">
                        <span>{recipe.servings ? `Serves ${recipe.servings}` : "Shared recipe"}</span>
                        <form action={deleteRecipe}>
                          <input type="hidden" name="id" value={recipe.id} />
                          <button className="danger-link">Delete</button>
                        </form>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <div>🥘</div>
                <h3>{recipes.length ? "No recipes match" : "Your recipe bank is ready"}</h3>
                <p>{recipes.length ? "Try a different search or show all recipes." : "Add the meals you already love. We’ll use them to power the weekly planner next."}</p>
                {!recipes.length && <button className="primary" onClick={() => setShowAddRecipe(true)}>Add your first recipe</button>}
              </div>
            )}
          </section>
        )}

        {view === "grocery" && (
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">AUTOMATICALLY BUILT</p>
                <h2>Grocery list</h2>
              </div>
            </div>
            <div className="empty-state grocery-empty">
              <div>🛒</div>
              <h3>Recipes are connected. Planning is next.</h3>
              <p>Once dinners are assigned to the week, Cook&apos;s Kitchen will combine their ingredients into one checkable list.</p>
            </div>
          </section>
        )}
      </main>

      <footer className="foundation-note">
        <span>Live Supabase data</span>
        {household.name} · {household.timezone}
      </footer>
    </div>
  );
}
