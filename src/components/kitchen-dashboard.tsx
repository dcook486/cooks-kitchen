"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { addRecipe, toggleFavorite } from "@/app/actions";
import { deleteRecipeNow } from "@/app/recipes/actions";
import { AccountMenu } from "@/components/account-menu";
import { GettingStarted } from "@/components/getting-started";
import { InstallHint } from "@/components/install-hint";
import { Toast, ToastRegion, type ToastMessage } from "@/components/toast";
import { WeeklyPlanner } from "@/components/weekly-planner";
import { flushRecipeChange, useUndoable } from "@/lib/use-undoable";

type View = "week" | "recipes";
type PlannerMode = "day" | "week" | "month";

type Household = { id: string; name: string; kitchen_name: string; tagline: string | null; timezone: string };
type Recipe = {
  id: string; name: string; description: string | null; source_url: string | null; image_url: string | null;
  prep_minutes: number | null; cook_minutes: number | null; servings: number | null; ingredients: unknown;
  instructions: unknown; tags: string[]; dietary_tags: string[]; is_favorite: boolean;
};
type MealPlanItem = { id: string; meal_date: string; meal_type: string; recipe_id: string | null; custom_label: string | null; status: string; notes: string | null; planned_servings: number | null };

type Props = {
  household: Household;
  recipes: Recipe[];
  displayName: string;
  mealPlanItems: MealPlanItem[];
  weekStart: string;
  currentWeekStart: string;
  dayAnchor: string;
  monthAnchor: string;
  initialPlannerMode: PlannerMode;
  initialView: View;
  memberCount: number;
  justOnboarded: boolean;
  deletedRecipeId: string | null;
};

const views: Array<{ id: View; label: string; mobileLabel: string; icon: string }> = [
  { id: "week", label: "The Plan", mobileLabel: "The Plan", icon: "▦" },
  { id: "recipes", label: "Recipes", mobileLabel: "Recipes", icon: "⌑" },
];

function totalMinutes(recipe: Recipe) {
  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return total || null;
}
function ingredientCount(recipe: Recipe) { return Array.isArray(recipe.ingredients) ? recipe.ingredients.length : 0; }

function FavoriteToggleButton({ recipe }: { recipe: Recipe }) {
  const { pending } = useFormStatus();
  const label = recipe.is_favorite ? `Remove ${recipe.name} from favorites` : `Add ${recipe.name} to favorites`;
  return (
    <button className={`icon-button${pending ? " is-pending" : ""}`} type="submit" title={recipe.is_favorite ? "Remove favorite" : "Add favorite"} aria-label={label} aria-busy={pending || undefined} disabled={pending}>
      {pending ? "…" : recipe.is_favorite ? "⭐" : "☆"}
    </button>
  );
}

export function KitchenDashboard({ household, recipes, displayName, mealPlanItems, weekStart, currentWeekStart, dayAnchor, monthAnchor, initialPlannerMode, initialView, memberCount, justOnboarded, deletedRecipeId }: Props) {
  const router = useRouter();
  const [view, setView] = useState<View>(initialView);
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [showAddRecipe, setShowAddRecipe] = useState(false);
  const [recipeNotice, setRecipeNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [savingRecipe, startSavingRecipe] = useTransition();
  const recipeNameRef = useRef<HTMLInputElement>(null);
  const [deletedOnArrival] = useState(() => {
    // A recipe deleted from its detail page arrives as ?deleted=<id>: hide it and offer Undo before deleting for real.
    const recipe = deletedRecipeId ? recipes.find((entry) => entry.id === deletedRecipeId) : undefined;
    return recipe ? { id: recipe.id, name: recipe.name } : null;
  });
  const pendingDelete = useUndoable<{ id: string; name: string }>({
    initial: deletedOnArrival,
    commit: async (item) => {
      const result = await deleteRecipeNow(item.id);
      if (!result.ok) {
        notify(`Couldn’t delete “${item.name}”, so it’s back in your recipe bank.`, "error");
        router.refresh();
      }
      return result.ok;
    },
    flush: (item) => flushRecipeChange("delete_recipe", item.id),
  });
  const isRecipeHidden = pendingDelete.isHidden;
  const activeRecipes = useMemo(() => recipes.filter((recipe) => !isRecipeHidden(recipe.id)), [isRecipeHidden, recipes]);
  const hasPlannedDinner = mealPlanItems.some((item) => item.meal_type === "dinner" && item.status !== "skipped");

  useEffect(() => {
    if (showAddRecipe) recipeNameRef.current?.focus();
  }, [showAddRecipe]);

  function notify(text: string, tone: ToastMessage["tone"] = "success") {
    setToast({ id: `${Date.now()}-${Math.random()}`, text, tone });
  }

  // Drop ?deleted= so a refresh doesn't replay it (the pending delete itself lives in state).
  useEffect(() => {
    if (!deletedRecipeId) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("deleted");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [deletedRecipeId]);

  useEffect(() => {
    if (!justOnboarded) return;
    // Drop ?onboarding=complete so a refresh doesn't replay the welcome state.
    const url = new URL(window.location.href);
    url.searchParams.delete("onboarding");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [justOnboarded]);

  function submitNewRecipe(event: FormEvent<HTMLFormElement>) {
    // Handled manually (not via form action) so a failed save keeps what the user typed.
    event.preventDefault();
    if (savingRecipe) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("name") ?? "").trim();
    setRecipeNotice(null);
    startSavingRecipe(async () => {
      try {
        await addRecipe(formData);
        setShowAddRecipe(false);
        notify(`Saved “${name}” to your recipe bank. It’s ready to plan.`);
      } catch {
        setRecipeNotice({ kind: "error", text: "We couldn’t save that recipe. Check your connection and try again — your entries are still here." });
      }
    });
  }

  function openAddRecipe() {
    selectView("recipes");
    setRecipeNotice(null);
    setShowAddRecipe(true);
  }

  function clearRecipeFilters() {
    setQuery("");
    setFavoriteOnly(false);
  }

  const visibleRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return activeRecipes.filter((recipe) => {
      if (favoriteOnly && !recipe.is_favorite) return false;
      if (!needle) return true;
      return [recipe.name, recipe.description ?? "", ...recipe.tags, ...recipe.dietary_tags].join(" ").toLowerCase().includes(needle);
    });
  }, [favoriteOnly, query, activeRecipes]);

  function selectView(nextView: View) {
    setView(nextView);
    const url = new URL(window.location.href);
    if (nextView === "week") url.searchParams.delete("section");
    else url.searchParams.set("section", nextView);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const hasCoPlanner = memberCount > 1;
  const inviteLabel = hasCoPlanner ? `Household · ${memberCount}` : "Invite co-planner";
  const inviteTitle = hasCoPlanner ? "Manage who shares this kitchen" : "Invite a partner or family member to plan with you";

  function tabLabel(tab: View) {
    if (tab === "recipes") return `Recipes · ${activeRecipes.length}`;
    return "The Plan";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <p className="eyebrow">{household.name.toUpperCase()}</p>
          <h1>{household.kitchen_name || "Cook's Kitchen"}</h1>
          {household.tagline && <p className="kitchen-tagline">{household.tagline}</p>}
        </div>
        <AccountMenu displayName={displayName} />
      </header>

      <nav className="tabs desktop-tabs" aria-label="App sections">
        {views.map((tab) => (
          <button key={tab.id} type="button" className={`tab ${view === tab.id ? "active" : ""}`} onClick={() => selectView(tab.id)} aria-current={view === tab.id ? "page" : undefined}>
            {tabLabel(tab.id)}
          </button>
        ))}
        <Link className={`tab-invite-link ${hasCoPlanner ? "has-members" : ""}`} href="/household" title={inviteTitle}>
          <span aria-hidden="true">{hasCoPlanner ? "👥" : "＋"}</span> {inviteLabel}
        </Link>
      </nav>

      <main>
        <InstallHint />

        <GettingStarted
          recipeCount={activeRecipes.length}
          hasPlannedDinner={hasPlannedDinner}
          memberCount={memberCount}
          justOnboarded={justOnboarded}
          onAddRecipe={openAddRecipe}
          onOpenPlan={() => selectView("week")}
        />

        {view === "week" && <WeeklyPlanner householdId={household.id} timeZone={household.timezone} recipes={activeRecipes} mealPlanItems={mealPlanItems} weekStart={weekStart} currentWeekStart={currentWeekStart} dayAnchor={dayAnchor} monthAnchor={monthAnchor} initialMode={initialPlannerMode} onNotify={notify} />}

        {view === "recipes" && (
          <section>
            <div className="section-heading">
              <div><p className="eyebrow">YOUR SHARED RECIPE BANK</p><h2>Recipes</h2></div>
              <div className="inline-actions recipe-actions">
                <Link className="secondary link-button" href="/recipes/import">Import from URL</Link>
                <button className="primary" type="button" onClick={() => { setRecipeNotice(null); setShowAddRecipe((value) => !value); }} aria-expanded={showAddRecipe}>{showAddRecipe ? "Close form" : "+ Add recipe"}</button>
              </div>
            </div>

            {recipeNotice && (
              <div className={`form-alert ${recipeNotice.kind} recipe-notice`} role={recipeNotice.kind === "error" ? "alert" : "status"}>
                <span>{recipeNotice.text}</span>
                <button className="text-button" type="button" onClick={() => setRecipeNotice(null)} aria-label="Dismiss message">×</button>
              </div>
            )}

            {showAddRecipe && (
              <form className="recipe-form" onSubmit={submitNewRecipe} aria-busy={savingRecipe || undefined}>
                <input type="hidden" name="household_id" value={household.id} />
                <div className="form-title"><div><p className="eyebrow">NEW GO-TO</p><h3>Add a recipe</h3></div><span>Only the name is required.</span></div>
                <div className="form-grid two">
                  <label>Recipe name<input ref={recipeNameRef} name="name" placeholder="Chicken enchiladas" required autoComplete="off" /></label>
                  <label>Source URL<input name="source_url" type="url" placeholder="https://…" /></label>
                </div>
                <label>Description<textarea name="description" rows={2} placeholder="Creamy, weeknight-friendly, and great for leftovers." /></label>
                <div className="form-grid three">
                  <label>Prep minutes<input name="prep_minutes" type="number" min="0" inputMode="numeric" /></label>
                  <label>Cook minutes<input name="cook_minutes" type="number" min="0" inputMode="numeric" /></label>
                  <label>Servings<input name="servings" type="number" min="1" step="0.5" inputMode="decimal" /></label>
                </div>
                <div className="form-grid two">
                  <label><span className="field-label">Tags <span className="field-hint">(comma-separated)</span></span><input name="tags" placeholder="quick, mexican, freezer" /></label>
                  <label><span className="field-label">Dietary tags <span className="field-hint">(comma-separated)</span></span><input name="dietary_tags" placeholder="gluten-free, dairy-free" /></label>
                </div>
                <div className="form-grid two">
                  <label><span className="field-label">Ingredients <span className="field-hint">(one per line)</span></span><textarea name="ingredients" rows={6} placeholder={"1 lb chicken breast\n8 tortillas\n2 cups enchilada sauce"} /></label>
                  <label><span className="field-label">Instructions <span className="field-hint">(one step per line)</span></span><textarea name="instructions" rows={6} placeholder={"Cook and shred chicken\nFill tortillas\nBake until bubbling"} /></label>
                </div>
                <div className="form-footer">
                  <label className="favorite-check"><input type="checkbox" name="is_favorite" /> ⭐ Make this a favorite</label>
                  <button className="primary" type="submit" disabled={savingRecipe}>{savingRecipe ? "Saving…" : "Save recipe"}</button>
                </div>
              </form>
            )}

            <div className="recipe-toolbar">
              <input className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes, tags, dietary needs…" aria-label="Search recipes" />
              <button className={`secondary ${favoriteOnly ? "selected" : ""}`} type="button" onClick={() => setFavoriteOnly((value) => !value)} aria-pressed={favoriteOnly}>⭐ Favorites</button>
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
                          <FavoriteToggleButton recipe={recipe} />
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
              <div className="empty-state">
                <div aria-hidden="true">🥘</div>
                <h3>{activeRecipes.length ? "No recipes match" : "Your recipe bank is ready"}</h3>
                <p>{activeRecipes.length ? (favoriteOnly && !query.trim() ? "None of your recipes are favorites yet. Tap the ☆ on a recipe to add it." : "Try a different search or show all recipes.") : "Add the meals you already love — type a name or paste a link. They’ll appear immediately in your planner."}</p>
                {activeRecipes.length ? (
                  <button className="secondary" type="button" onClick={clearRecipeFilters}>Show all recipes</button>
                ) : (
                  <div className="inline-actions empty-state-actions">
                    <button className="primary" type="button" onClick={openAddRecipe}>Add your first recipe</button>
                    <Link className="secondary link-button" href="/recipes/import">Import from a link</Link>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <nav className="mobile-bottom-nav" aria-label="App sections">
        {views.map((tab) => (
          <button key={tab.id} type="button" className={view === tab.id ? "active" : ""} onClick={() => selectView(tab.id)} aria-current={view === tab.id ? "page" : undefined}>
            <span className="mobile-nav-icon" aria-hidden="true">{tab.icon}</span>
            <span>{tab.mobileLabel}</span>
          </button>
        ))}
        <Link className="mobile-nav-link" href="/household" title={inviteTitle}>
          <span className="mobile-nav-icon" aria-hidden="true">{hasCoPlanner ? "👥" : "＋"}</span>
          <span>{hasCoPlanner ? "Household" : "Invite"}</span>
        </Link>
      </nav>

      <ToastRegion>
        {pendingDelete.pending && (
          <Toast
            key={`undo-${pendingDelete.pending.id}`}
            message={`Deleted “${pendingDelete.pending.name}”`}
            tone="info"
            duration={7000}
            actionLabel="Undo"
            onAction={() => {
              pendingDelete.undo();
              notify("Recipe restored.");
            }}
            onDismiss={pendingDelete.expire}
          />
        )}
        {toast && <Toast key={toast.id} message={toast.text} tone={toast.tone} onDismiss={() => setToast(null)} />}
      </ToastRegion>
    </div>
  );
}
