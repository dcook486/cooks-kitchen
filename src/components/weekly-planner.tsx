"use client";

import Link from "next/link";
import { saveDinnerPlan } from "@/app/actions";

type Recipe = {
  id: string;
  name: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
};

type MealPlanItem = {
  id: string;
  meal_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_label: string | null;
  status: string;
  notes: string | null;
};

type Props = {
  householdId: string;
  recipes: Recipe[];
  mealPlanItems: MealPlanItem[];
  weekStart: string;
  currentWeekStart: string;
};

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function addDays(value: string, amount: number) {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromIso(value));
}

function formatWeekLabel(weekStart: string) {
  const end = addDays(weekStart, 6);
  const startDate = dateFromIso(weekStart);
  const endDate = dateFromIso(end);
  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();

  if (sameMonth) {
    const month = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(startDate);
    return `${month} ${startDate.getUTCDate()}–${endDate.getUTCDate()}`;
  }

  return `${formatShortDate(weekStart)} – ${formatShortDate(end)}`;
}

function selectionFor(item: MealPlanItem | undefined) {
  if (!item) return "none";
  if (item.status === "planned" && item.recipe_id) return `recipe:${item.recipe_id}`;
  if (["leftovers", "eating_out", "skipped"].includes(item.status)) return item.status;
  return "none";
}

function labelFor(item: MealPlanItem | undefined, recipes: Recipe[]) {
  if (!item) return { title: "Not planned yet", meta: "Choose a dinner below", emoji: "○" };

  if (item.status === "leftovers") return { title: "Leftovers", meta: "Use what’s already in the fridge", emoji: "↻" };
  if (item.status === "eating_out") return { title: "Eating out", meta: "No cooking tonight", emoji: "🍽️" };
  if (item.status === "skipped") return { title: "No dinner planned", meta: "Intentionally left open", emoji: "—" };

  const recipe = recipes.find((entry) => entry.id === item.recipe_id);
  if (!recipe) return { title: item.custom_label || "Planned dinner", meta: "Saved to this week", emoji: "✓" };

  const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return {
    title: recipe.name,
    meta: minutes ? `${minutes} min total` : "From your recipe bank",
    emoji: "✓",
  };
}

export function WeeklyPlanner({ householdId, recipes, mealPlanItems, weekStart, currentWeekStart }: Props) {
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const isCurrentWeek = weekStart === currentWeekStart;

  return (
    <section>
      <div className="section-heading week-heading">
        <div>
          <p className="eyebrow">DINNER AT A GLANCE</p>
          <h2>{isCurrentWeek ? "This week" : `Week of ${formatShortDate(weekStart)}`}</h2>
          <p className="week-range">{formatWeekLabel(weekStart)}</p>
        </div>
        <div className="inline-actions week-actions">
          <Link className="secondary link-button" href={`/?week=${previousWeek}`}>← Previous</Link>
          {!isCurrentWeek && <Link className="secondary link-button" href="/">This week</Link>}
          <Link className="secondary link-button" href={`/?week=${nextWeek}`}>Next →</Link>
        </div>
      </div>

      <div className="week-grid">
        {dayNames.map((day, index) => {
          const mealDate = addDays(weekStart, index);
          const item = mealPlanItems.find((entry) => entry.meal_date === mealDate && entry.meal_type === "dinner");
          const summary = labelFor(item, recipes);

          return (
            <article className={`day-card ${item ? "planned-day" : ""}`} key={mealDate}>
              <div className="day-name">{day}</div>
              <div className="day-date">{formatShortDate(mealDate)}</div>

              <div className="meal-slot">
                <div className="meal-emoji">{summary.emoji}</div>
                <div className={`meal-name ${item ? "" : "muted-meal"}`}>{summary.title}</div>
                <div className="meal-meta">{summary.meta}</div>
              </div>

              <form className="meal-picker" action={saveDinnerPlan}>
                <input type="hidden" name="household_id" value={householdId} />
                <input type="hidden" name="week_start" value={weekStart} />
                <input type="hidden" name="meal_date" value={mealDate} />
                <label>
                  Dinner
                  <select name="selection" defaultValue={selectionFor(item)}>
                    <option value="none">No plan</option>
                    <option value="leftovers">Leftovers</option>
                    <option value="eating_out">Eating out</option>
                    <option value="skipped">Skip dinner</option>
                    {recipes.length > 0 && <option disabled>──────────</option>}
                    {recipes.map((recipe) => (
                      <option key={recipe.id} value={`recipe:${recipe.id}`}>{recipe.name}</option>
                    ))}
                  </select>
                </label>
                <button className="save-meal" type="submit">Save</button>
              </form>
            </article>
          );
        })}
      </div>

      {!recipes.length && (
        <div className="coming-next">
          <span>Recipe bank empty</span>
          Add at least one recipe to start assigning dinners. Leftovers and Eating out are available anytime.
        </div>
      )}
    </section>
  );
}
