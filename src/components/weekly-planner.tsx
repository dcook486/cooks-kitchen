"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { saveDinnerPlan } from "@/app/actions";

type PlannerMode = "week" | "month";

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
  timeZone: string;
  recipes: Recipe[];
  mealPlanItems: MealPlanItem[];
  weekStart: string;
  currentWeekStart: string;
  monthAnchor: string;
  initialMode: PlannerMode;
};

type PickerDay = {
  day: string;
  mealDate: string;
} | null;

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayShortNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const quickChoices = [
  { value: "leftovers", icon: "↻", title: "Leftovers", description: "Use what’s already in the fridge" },
  { value: "eating_out", icon: "🍽️", title: "Eating out", description: "No cooking tonight" },
  { value: "skipped", icon: "—", title: "Leave it open", description: "No dinner plan for this night" },
];

function dateFromIso(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

function addDays(value: string, amount: number) {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function mondayFor(value: string) {
  const date = dateFromIso(value);
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

function firstOfMonth(value: string) {
  const date = dateFromIso(value);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function addMonths(value: string, amount: number) {
  const date = dateFromIso(firstOfMonth(value));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

function localIsoDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromIso(value));
}

function formatWeekday(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(dateFromIso(value));
}

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(dateFromIso(value));
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

function summaryForSelection(selection: string, recipes: Recipe[]) {
  if (selection === "none") {
    return { title: "Not planned yet", meta: "Choose a dinner", emoji: "○", recipeId: null as string | null, kind: "empty" };
  }
  if (selection === "leftovers") return { title: "Leftovers", meta: "Use what’s already in the fridge", emoji: "↻", recipeId: null, kind: "leftovers" };
  if (selection === "eating_out") return { title: "Eating out", meta: "No cooking tonight", emoji: "🍽️", recipeId: null, kind: "eating-out" };
  if (selection === "skipped") return { title: "No dinner planned", meta: "Intentionally left open", emoji: "—", recipeId: null, kind: "skipped" };

  if (selection.startsWith("recipe:")) {
    const recipeId = selection.slice("recipe:".length);
    const recipe = recipes.find((entry) => entry.id === recipeId);
    if (recipe) {
      const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
      return {
        title: recipe.name,
        meta: minutes ? `${minutes} min total` : "From your recipe bank",
        emoji: "✓",
        recipeId: recipe.id,
        kind: "recipe",
      };
    }
  }

  return { title: "Planned dinner", meta: "Saved to this week", emoji: "✓", recipeId: null, kind: "recipe" };
}

function recipeMeta(recipe: Recipe) {
  const minutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  return minutes ? `${minutes} min total` : "From your recipe bank";
}

export function WeeklyPlanner({ householdId, timeZone, recipes, mealPlanItems, weekStart, currentWeekStart, monthAnchor, initialMode }: Props) {
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const isCurrentWeek = weekStart === currentWeekStart;
  const today = localIsoDate(timeZone);
  const currentMonth = firstOfMonth(today);
  const normalizedMonth = firstOfMonth(monthAnchor);
  const previousMonth = addMonths(normalizedMonth, -1);
  const nextMonth = addMonths(normalizedMonth, 1);
  const monthGridStart = mondayFor(normalizedMonth);
  const monthDates = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));

  const [mode, setMode] = useState<PlannerMode>(initialMode);
  const [pickerDay, setPickerDay] = useState<PickerDay>(null);
  const [query, setQuery] = useState("");
  const [optimisticSelections, setOptimisticSelections] = useState<Record<string, string>>({});
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeItem = pickerDay
    ? mealPlanItems.find((entry) => entry.meal_date === pickerDay.mealDate && entry.meal_type === "dinner")
    : undefined;
  const activeSelection = pickerDay
    ? optimisticSelections[pickerDay.mealDate] ?? selectionFor(activeItem)
    : "none";

  const filteredRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recipes;
    return recipes.filter((recipe) => recipe.name.toLowerCase().includes(needle));
  }, [query, recipes]);

  useEffect(() => {
    if (!pickerDay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerDay(null);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerDay]);

  function switchMode(nextMode: PlannerMode) {
    setMode(nextMode);
    const url = new URL(window.location.href);
    if (nextMode === "month") {
      url.searchParams.set("planner", "month");
      url.searchParams.set("month", normalizedMonth.slice(0, 7));
    } else {
      url.searchParams.delete("planner");
      url.searchParams.delete("month");
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  function openPicker(day: string, mealDate: string) {
    setQuery("");
    setPickerDay({ day, mealDate });
  }

  function chooseDinner(selection: string) {
    if (!pickerDay) return;
    const mealDate = pickerDay.mealDate;
    const previousSelection = optimisticSelections[mealDate] ?? selectionFor(activeItem);

    setOptimisticSelections((current) => ({ ...current, [mealDate]: selection }));
    setPickerDay(null);
    setSavingDate(mealDate);

    const formData = new FormData();
    formData.set("household_id", householdId);
    formData.set("week_start", mondayFor(mealDate));
    formData.set("meal_date", mealDate);
    formData.set("selection", selection);

    startTransition(async () => {
      try {
        await saveDinnerPlan(formData);
      } catch {
        setOptimisticSelections((current) => ({ ...current, [mealDate]: previousSelection }));
      } finally {
        setSavingDate((current) => current === mealDate ? null : current);
      }
    });
  }

  const headingTitle = mode === "week"
    ? (isCurrentWeek ? "This week" : `Week of ${formatShortDate(weekStart)}`)
    : formatMonthLabel(normalizedMonth);

  return (
    <section>
      <div className="section-heading week-heading planner-heading">
        <div>
          <p className="eyebrow">DINNER AT A GLANCE</p>
          <h2>{headingTitle}</h2>
          <p className="week-range">{mode === "week" ? formatWeekLabel(weekStart) : "See the whole month, then tap any day to plan dinner."}</p>
        </div>

        <div className="planner-heading-controls">
          <div className="planner-view-toggle" role="group" aria-label="Planner view">
            <button type="button" className={mode === "week" ? "active" : ""} onClick={() => switchMode("week")} aria-pressed={mode === "week"}>Week</button>
            <button type="button" className={mode === "month" ? "active" : ""} onClick={() => switchMode("month")} aria-pressed={mode === "month"}>Month</button>
          </div>

          {mode === "week" ? (
            <div className="inline-actions week-actions" aria-label="Week navigation">
              <Link className="secondary link-button" href={`/?week=${previousWeek}`}>← Previous</Link>
              {!isCurrentWeek && <Link className="secondary link-button" href="/">This week</Link>}
              <Link className="secondary link-button" href={`/?week=${nextWeek}`}>Next →</Link>
            </div>
          ) : (
            <div className="inline-actions week-actions" aria-label="Month navigation">
              <Link className="secondary link-button" href={`/?planner=month&month=${previousMonth.slice(0, 7)}`}>← Previous</Link>
              {normalizedMonth !== currentMonth && <Link className="secondary link-button" href={`/?planner=month&month=${currentMonth.slice(0, 7)}`}>This month</Link>}
              <Link className="secondary link-button" href={`/?planner=month&month=${nextMonth.slice(0, 7)}`}>Next →</Link>
            </div>
          )}
        </div>
      </div>

      {mode === "week" ? (
        <div className="week-grid">
          {dayNames.map((day, index) => {
            const mealDate = addDays(weekStart, index);
            const item = mealPlanItems.find((entry) => entry.meal_date === mealDate && entry.meal_type === "dinner");
            const selection = optimisticSelections[mealDate] ?? selectionFor(item);
            const summary = summaryForSelection(selection, recipes);
            const isToday = mealDate === today;
            const hasPlan = selection !== "none";
            const saving = savingDate === mealDate && isPending;

            return (
              <article className={`day-card ${hasPlan ? "planned-day" : ""} ${isToday ? "today-card" : ""}`} key={mealDate}>
                <div className="day-card-heading">
                  <div>
                    <div className="day-name">{day}</div>
                    <div className="day-date">{formatShortDate(mealDate)}</div>
                  </div>
                  {isToday && <span className="today-pill">Today</span>}
                </div>

                <div className="meal-slot">
                  <div className="meal-emoji">{summary.emoji}</div>
                  <div className={`meal-name ${hasPlan ? "" : "muted-meal"}`}>
                    {summary.recipeId ? <Link className="meal-name-link" href={`/recipes/${summary.recipeId}`}>{summary.title}</Link> : summary.title}
                  </div>
                  <div className="meal-meta">{summary.meta}</div>
                </div>

                <div className="meal-picker-modern">
                  <button
                    className={`meal-picker-button ${hasPlan ? "has-selection" : ""}`}
                    type="button"
                    onClick={() => openPicker(day, mealDate)}
                    aria-haspopup="dialog"
                  >
                    <span className="meal-picker-button-copy"><strong>{hasPlan ? "Change dinner" : "Choose dinner"}</strong></span>
                  </button>
                  {saving && <span className="auto-save-status saving">Saving…</span>}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="month-calendar-shell">
          <div className="month-weekdays" aria-hidden="true">
            {dayShortNames.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="month-calendar-grid">
            {monthDates.map((mealDate) => {
              const item = mealPlanItems.find((entry) => entry.meal_date === mealDate && entry.meal_type === "dinner");
              const selection = optimisticSelections[mealDate] ?? selectionFor(item);
              const summary = summaryForSelection(selection, recipes);
              const hasPlan = selection !== "none";
              const inMonth = mealDate.slice(0, 7) === normalizedMonth.slice(0, 7);
              const isToday = mealDate === today;
              const saving = savingDate === mealDate && isPending;
              const date = dateFromIso(mealDate);

              return (
                <button
                  type="button"
                  key={mealDate}
                  className={`month-day ${inMonth ? "" : "outside-month"} ${hasPlan ? "has-plan" : ""} ${isToday ? "today" : ""}`}
                  onClick={() => openPicker(formatWeekday(mealDate), mealDate)}
                  aria-label={`${formatWeekday(mealDate)}, ${formatShortDate(mealDate)}. ${hasPlan ? summary.title : "No dinner planned"}.`}
                >
                  <span className="month-day-top">
                    <span className="month-day-number">{date.getUTCDate()}</span>
                    {isToday && <span className="month-today-dot" aria-label="Today">Today</span>}
                  </span>
                  {hasPlan ? (
                    <span className={`month-meal-pill ${summary.kind}`}>
                      <span className="month-meal-icon" aria-hidden="true">{summary.emoji}</span>
                      <span className="month-meal-title">{summary.title}</span>
                    </span>
                  ) : (
                    <span className="month-empty-hint"><span aria-hidden="true">＋</span><span className="month-empty-copy">Add dinner</span></span>
                  )}
                  {saving && <span className="month-saving">Saving…</span>}
                </button>
              );
            })}
          </div>
          <p className="month-mobile-help">Tap a day to choose or change dinner.</p>
        </div>
      )}

      {!recipes.length && (
        <div className="coming-next">
          <span>Recipe bank empty</span>
          Add at least one recipe to start assigning dinners. Leftovers and Eating out are available anytime.
        </div>
      )}

      {pickerDay && (
        <div className="meal-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPickerDay(null);
        }}>
          <div className="meal-modal" role="dialog" aria-modal="true" aria-labelledby="meal-modal-title">
            <div className="meal-modal-header">
              <div>
                <p className="eyebrow">{pickerDay.day.toUpperCase()} · {formatShortDate(pickerDay.mealDate).toUpperCase()}</p>
                <h3 id="meal-modal-title">What’s for dinner?</h3>
                <p>Pick a recipe or choose a quick option for the night.</p>
              </div>
              <button className="meal-modal-close" type="button" onClick={() => setPickerDay(null)} aria-label="Close dinner picker">×</button>
            </div>

            <div className="meal-modal-body">
              <div className="meal-quick-grid" aria-label="Quick dinner options">
                {quickChoices.map((choice) => (
                  <button
                    key={choice.value}
                    className={`meal-choice-card quick ${activeSelection === choice.value ? "selected" : ""}`}
                    type="button"
                    onClick={() => chooseDinner(choice.value)}
                  >
                    <span className="meal-choice-icon" aria-hidden="true">{choice.icon}</span>
                    <span className="meal-choice-copy">
                      <strong>{choice.title}</strong>
                      <span>{choice.description}</span>
                    </span>
                    {activeSelection === choice.value && <span className="meal-choice-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>

              <div className="meal-modal-divider"><span>FROM YOUR RECIPES</span></div>

              {recipes.length > 5 && (
                <label className="meal-recipe-search">
                  <span className="meal-recipe-search-icon" aria-hidden="true">⌕</span>
                  <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes…" aria-label="Search recipes" />
                </label>
              )}

              {filteredRecipes.length ? (
                <div className="meal-recipe-list">
                  {filteredRecipes.map((recipe) => {
                    const value = `recipe:${recipe.id}`;
                    const selected = activeSelection === value;
                    return (
                      <button
                        key={recipe.id}
                        className={`meal-choice-card recipe ${selected ? "selected" : ""}`}
                        type="button"
                        onClick={() => chooseDinner(value)}
                      >
                        <span className="meal-recipe-mark" aria-hidden="true">{recipe.name.slice(0, 1).toUpperCase()}</span>
                        <span className="meal-choice-copy">
                          <strong>{recipe.name}</strong>
                          <span>{recipeMeta(recipe)}</span>
                        </span>
                        <span className="meal-choice-arrow" aria-hidden="true">{selected ? "✓" : "→"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="meal-modal-empty">
                  <span>⌕</span>
                  <strong>No recipes found</strong>
                  <p>Try a different search.</p>
                </div>
              )}
            </div>

            {activeSelection !== "none" && (
              <div className="meal-modal-footer">
                <button className="meal-clear-button" type="button" onClick={() => chooseDinner("none")}>Clear dinner plan</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
