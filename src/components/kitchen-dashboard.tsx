"use client";

import { useMemo, useState } from "react";
import { days, initialWeek, recipes } from "@/lib/demo-data";
import type { WeekPlan } from "@/lib/types";

type View = "week" | "recipes" | "grocery";

const recipeFor = (id: string) => recipes.find((recipe) => recipe.id === id);

function makeWeek(): WeekPlan {
  const pool = [...recipes];
  const next: WeekPlan = {};
  days.forEach((day, index) => {
    if (index === 4) return void (next[day.key] = { type: "out" });
    if (index === 6) return void (next[day.key] = { type: "leftovers" });
    const recipe = pool.splice(Math.floor(Math.random() * pool.length), 1)[0] ?? recipes[0];
    next[day.key] = { type: "recipe", recipeId: recipe.id };
  });
  return next;
}

export function KitchenDashboard() {
  const [view, setView] = useState<View>("week");
  const [week, setWeek] = useState<WeekPlan>(initialWeek);
  const [favoriteOnly, setFavoriteOnly] = useState(false);

  const groceries = useMemo(() => {
    const grouped: Record<string, Array<{ name: string; amount: number; unit: string }>> = {};
    const merged = new Map<string, { name: string; amount: number; unit: string; category: string }>();

    Object.values(week).forEach((slot) => {
      if (slot?.type !== "recipe") return;
      recipeFor(slot.recipeId)?.ingredients.forEach((item) => {
        const key = `${item.name.toLowerCase()}|${item.unit}`;
        const current = merged.get(key);
        merged.set(key, { ...item, amount: (current?.amount ?? 0) + item.amount });
      });
    });

    merged.forEach(({ category, ...item }) => (grouped[category] ??= []).push(item));
    return grouped;
  }, [week]);

  const visibleRecipes = favoriteOnly ? recipes.filter((recipe) => recipe.favorite) : recipes;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div><p className="eyebrow">WEEKLY DINNER PLANNER</p><h1>Cook&apos;s Kitchen</h1></div>
        <button className="primary" onClick={() => setWeek(makeWeek())}>✨ Plan my week</button>
      </header>

      <nav className="tabs" aria-label="App sections">
        {(["week", "recipes", "grocery"] as View[]).map((tab) => (
          <button key={tab} className={`tab ${view === tab ? "active" : ""}`} onClick={() => setView(tab)}>
            {tab === "week" ? "This week" : tab === "recipes" ? "Recipes" : "Grocery list"}
          </button>
        ))}
      </nav>

      {view === "week" && <section>
        <div className="section-heading">
          <div><p className="eyebrow">DINNER AT A GLANCE</p><h2>This week</h2></div>
          <div className="inline-actions"><button className="secondary" onClick={() => setWeek({})}>Clear week</button><button className="secondary" onClick={() => setWeek(makeWeek())}>🎲 Surprise me</button></div>
        </div>
        <div className="week-grid">
          {days.map((day) => {
            const slot = week[day.key];
            const recipe = slot?.type === "recipe" ? recipeFor(slot.recipeId) : undefined;
            return <article className="day-card" key={day.key}>
              <div className="day-name">{day.label}</div><div className="day-date">Dinner</div>
              <div className="meal-slot">
                {!slot && <div className="empty-slot">+ Choose dinner</div>}
                {recipe && <><div className="meal-name">{recipe.name}</div><div className="meal-meta">{recipe.minutes} min · {recipe.category}</div><div className="tag-row">{recipe.tags.slice(0,2).map((tag) => <span className="badge" key={tag}>{tag}</span>)}</div></>}
                {slot?.type === "out" && <><div className="meal-emoji">🍽️</div><div className="meal-name">Eating out</div></>}
                {slot?.type === "leftovers" && <><div className="meal-emoji">🥡</div><div className="meal-name">Leftovers</div></>}
              </div>
            </article>;
          })}
        </div>
      </section>}

      {view === "recipes" && <section>
        <div className="section-heading"><div><p className="eyebrow">YOUR GO-TO BANK</p><h2>Recipes</h2></div><button className="primary">+ Add recipe</button></div>
        <div className="recipe-toolbar"><div className="search-placeholder">Search recipes, tags, ingredients…</div><button className={`secondary ${favoriteOnly ? "selected" : ""}`} onClick={() => setFavoriteOnly(!favoriteOnly)}>⭐ Favorites</button><button className="secondary">✨ Suggest something new</button></div>
        <div className="recipe-grid">{visibleRecipes.map((recipe) => <article className="recipe-card" key={recipe.id}><div className="recipe-card-top"><span className="recipe-icon">{recipe.favorite ? "⭐" : "🍴"}</span><span className="minutes">{recipe.minutes} min</span></div><h3>{recipe.name}</h3><p>{recipe.category}</p><div className="tag-row">{recipe.tags.map((tag) => <span className="badge" key={tag}>{tag}</span>)}</div></article>)}</div>
      </section>}

      {view === "grocery" && <section>
        <div className="section-heading"><div><p className="eyebrow">BASED ON THIS WEEK</p><h2>Grocery list</h2></div><button className="secondary">Reset checks</button></div>
        <div className="grocery-summary"><div><strong>{Object.values(groceries).flat().length} grocery items</strong><div>Generated from this week&apos;s recipes</div></div><div>Check off what you already have.</div></div>
        <div className="grocery-list">{Object.entries(groceries).sort(([a],[b]) => a.localeCompare(b)).map(([category, items]) => <section className="grocery-group" key={category}><h3>{category}</h3>{items.map((item) => <label className="grocery-item" key={`${item.name}-${item.unit}`}><input type="checkbox" /><span>{item.name}<span className="qty">{item.amount} {item.unit}</span></span></label>)}</section>)}</div>
      </section>}

      <footer className="foundation-note"><span>Production foundation</span>UI is running on demo data until Supabase is connected.</footer>
    </div>
  );
}
