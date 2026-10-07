"use client";

import Link from "next/link";
import type { FormEvent, TouchEvent as ReactTouchEvent } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { copyPreviousWeek, saveDinnerPlan } from "@/app/actions";
import { quickAddRecipeAndPlan } from "@/app/quick-add-actions";
import { scaleIngredientLines } from "@/lib/ingredient-scaling";

type PlannerMode = "day" | "week" | "month";

type Recipe = {
  id: string;
  name: string;
  description?: string | null;
  source_url?: string | null;
  image_url?: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings?: number | null;
  ingredients?: unknown;
  instructions?: unknown;
  tags?: string[];
  dietary_tags?: string[];
  is_favorite?: boolean;
};

type MealPlanItem = {
  id: string;
  meal_date: string;
  meal_type: string;
  recipe_id: string | null;
  custom_label: string | null;
  status: string;
  notes: string | null;
  planned_servings: number | null;
};

type Props = {
  householdId: string;
  timeZone: string;
  recipes: Recipe[];
  mealPlanItems: MealPlanItem[];
  weekStart: string;
  currentWeekStart: string;
  dayAnchor: string;
  monthAnchor: string;
  initialMode: PlannerMode;
  onNotify?: (text: string, tone?: "success" | "info" | "error") => void;
};

type PickerDay = {
  day: string;
  mealDate: string;
} | null;

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const monthDayShortNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function sundayFor(value: string) {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
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

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
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

function ingredientLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item) {
        const text = (item as { text?: unknown }).text;
        return typeof text === "string" ? text.trim() : "";
      }
      return "";
    })
    .filter(Boolean);
}

function instructionLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function safeWebUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function recipePhotoUrl(value: string | null | undefined) {
  const url = safeWebUrl(value);
  return url?.includes("/storage/v1/object/public/recipe-photos/") ? url : null;
}

export function WeeklyPlanner({ householdId, timeZone, recipes, mealPlanItems, weekStart, currentWeekStart, dayAnchor, monthAnchor, initialMode, onNotify }: Props) {
  const previousWeek = addDays(weekStart, -7);
  const nextWeek = addDays(weekStart, 7);
  const isCurrentWeek = weekStart === currentWeekStart;
  const today = localIsoDate(timeZone);
  const currentMonth = firstOfMonth(today);
  const normalizedMonth = firstOfMonth(monthAnchor);
  const previousMonth = addMonths(normalizedMonth, -1);
  const nextMonth = addMonths(normalizedMonth, 1);
  const monthGridStart = sundayFor(normalizedMonth);
  const monthDates = Array.from({ length: 42 }, (_, index) => addDays(monthGridStart, index));

  const [mode, setMode] = useState<PlannerMode>(initialMode);
  const [dayDate, setDayDate] = useState(dayAnchor);
  const [pickerDay, setPickerDay] = useState<PickerDay>(null);
  const [query, setQuery] = useState("");
  const [plannerRecipes, setPlannerRecipes] = useState<Recipe[]>(recipes);
  const [optimisticSelections, setOptimisticSelections] = useState<Record<string, string>>({});
  const [optimisticServings, setOptimisticServings] = useState<Record<string, number | null>>({});
  const [pendingRecipeId, setPendingRecipeId] = useState<string | null>(null);
  const [servingCount, setServingCount] = useState("");
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickUrl, setQuickUrl] = useState("");
  const [quickError, setQuickError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const pickerTriggerRef = useRef<HTMLElement | null>(null);
  const [quickAdding, startQuickAddTransition] = useTransition();
  const [copyingWeek, startCopyWeekTransition] = useTransition();
  const [autoFocusSearch, setAutoFocusSearch] = useState(false);
  const weekGridRef = useRef<HTMLDivElement>(null);
  const servingPanelRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{ startY: number; delta: number } | null>(null);

  const activeItem = pickerDay
    ? mealPlanItems.find((entry) => entry.meal_date === pickerDay.mealDate && entry.meal_type === "dinner")
    : undefined;
  const activeSelection = pickerDay
    ? optimisticSelections[pickerDay.mealDate] ?? selectionFor(activeItem)
    : "none";

  const dayItem = mealPlanItems.find((entry) => entry.meal_date === dayDate && entry.meal_type === "dinner");
  const daySelection = optimisticSelections[dayDate] ?? selectionFor(dayItem);
  const daySummary = summaryForSelection(daySelection, plannerRecipes);
  const dayRecipe = daySummary.recipeId ? plannerRecipes.find((recipe) => recipe.id === daySummary.recipeId) : undefined;
  const originalDayIngredients = ingredientLines(dayRecipe?.ingredients);
  const dayPlannedServings = optimisticServings[dayDate] ?? dayItem?.planned_servings ?? dayRecipe?.servings ?? null;
  const dayIngredients = scaleIngredientLines(originalDayIngredients, dayRecipe?.servings, dayPlannedServings);
  const dayInstructions = instructionLines(dayRecipe?.instructions);
  const dayPhoto = recipePhotoUrl(dayRecipe?.image_url);
  const daySource = safeWebUrl(dayRecipe?.source_url);
  const dayTotalMinutes = dayRecipe ? (dayRecipe.prep_minutes ?? 0) + (dayRecipe.cook_minutes ?? 0) : 0;
  const dayTags = dayRecipe ? [...(dayRecipe.tags ?? []), ...(dayRecipe.dietary_tags ?? [])] : [];
  const daySaving = savingDate === dayDate && isPending;

  const filteredRecipes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return plannerRecipes;
    return plannerRecipes.filter((recipe) => recipe.name.toLowerCase().includes(needle));
  }, [query, plannerRecipes]);

  useEffect(() => {
    setPlannerRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    setDayDate(dayAnchor);
  }, [dayAnchor]);

  // On phones, bring today's card into view when the current week first loads.
  const scrolledToTodayRef = useRef(false);
  useEffect(() => {
    if (scrolledToTodayRef.current || mode !== "week" || !isCurrentWeek) return;
    // Wait for late content above the planner (getting-started card, install tip) to settle first.
    const timer = window.setTimeout(() => {
      scrolledToTodayRef.current = true;
      if (!window.matchMedia("(max-width: 660px)").matches) return;
      if (window.location.hash || window.scrollY > 0) return;
      const card = weekGridRef.current?.querySelector<HTMLElement>(".today-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      // Only scroll when today's card is (partly) hidden behind the bottom nav or below the fold.
      if (rect.bottom <= window.innerHeight - 96) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      card.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [mode, isCurrentWeek]);

  // Keep the "How many servings?" step visible after picking a recipe on a small screen.
  useEffect(() => {
    if (!pendingRecipeId || !pickerDay) return;
    const frame = window.requestAnimationFrame(() => {
      servingPanelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingRecipeId, pickerDay]);

  useEffect(() => {
    if (!pickerDay) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move keyboard/screen-reader focus into the dialog (unless something inside, like search, already has it).
    const focusFrame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerDay(null);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      // Keep Tab inside the open dialog.
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), a[href], select:not([disabled]), textarea:not([disabled])"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      // Return focus to whatever opened the picker.
      const trigger = pickerTriggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true });
    };
  }, [pickerDay]);

  function switchMode(nextMode: PlannerMode) {
    setMode(nextMode);
    const url = new URL(window.location.href);

    if (nextMode === "day") {
      const focusDay = mode === "month" ? normalizedMonth : dayDate;
      setDayDate(focusDay);
      url.searchParams.set("planner", "day");
      url.searchParams.set("day", focusDay);
      url.searchParams.delete("month");
      url.searchParams.delete("week");
    } else if (nextMode === "month") {
      url.searchParams.set("planner", "month");
      url.searchParams.set("month", normalizedMonth.slice(0, 7));
      url.searchParams.delete("day");
      url.searchParams.delete("week");
    } else {
      url.searchParams.delete("planner");
      url.searchParams.delete("month");
      url.searchParams.delete("day");
      if (weekStart === currentWeekStart) url.searchParams.delete("week");
      else url.searchParams.set("week", weekStart);
    }
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  function openPicker(day: string, mealDate: string) {
    const existingItem = mealPlanItems.find((entry) => entry.meal_date === mealDate && entry.meal_type === "dinner");
    const existingRecipe = existingItem?.recipe_id
      ? plannerRecipes.find((recipe) => recipe.id === existingItem.recipe_id)
      : undefined;

    pickerTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setSaveError("");
    setQuery("");
    setShowQuickAdd(false);
    setQuickName("");
    setQuickUrl("");
    setQuickError("");
    setPendingRecipeId(existingItem?.recipe_id ?? null);
    setServingCount(String(existingItem?.planned_servings ?? existingRecipe?.servings ?? (existingRecipe ? 4 : "")));
    // Jumping straight into search pops the keyboard over the sheet on phones, so only do it with a mouse.
    setAutoFocusSearch(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
    setPickerDay({ day, mealDate });
  }

  function closePicker() {
    if (quickAdding) return;
    setPickerDay(null);
  }

  function onSheetTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1 || quickAdding) return;
    sheetDragRef.current = { startY: event.touches[0].clientY, delta: 0 };
  }

  function onSheetTouchMove(event: ReactTouchEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    const sheet = dialogRef.current;
    if (!drag || !sheet) return;
    drag.delta = Math.max(0, event.touches[0].clientY - drag.startY);
    sheet.style.transition = "none";
    sheet.style.transform = drag.delta ? `translateY(${drag.delta}px)` : "";
  }

  function onSheetTouchEnd() {
    const drag = sheetDragRef.current;
    const sheet = dialogRef.current;
    sheetDragRef.current = null;
    if (!drag || !sheet) return;
    sheet.style.transition = "";
    if (drag.delta > 90) {
      closePicker();
    } else {
      sheet.style.transform = "";
    }
  }

  function chooseDinner(selection: string, plannedServings: number | null = null) {
    if (!pickerDay) return;
    const mealDate = pickerDay.mealDate;
    const previousSelection = optimisticSelections[mealDate] ?? selectionFor(activeItem);
    const previousServings = optimisticServings[mealDate] ?? activeItem?.planned_servings ?? null;

    setOptimisticSelections((current) => ({ ...current, [mealDate]: selection }));
    setOptimisticServings((current) => ({ ...current, [mealDate]: plannedServings }));
    setPickerDay(null);
    setPendingRecipeId(null);
    setServingCount("");
    setSavingDate(mealDate);

    const formData = new FormData();
    formData.set("household_id", householdId);
    formData.set("week_start", mondayFor(mealDate));
    formData.set("meal_date", mealDate);
    formData.set("selection", selection);
    if (plannedServings != null) formData.set("planned_servings", String(plannedServings));

    startTransition(async () => {
      try {
        await saveDinnerPlan(formData);
      } catch {
        setOptimisticSelections((current) => ({ ...current, [mealDate]: previousSelection }));
        setOptimisticServings((current) => ({ ...current, [mealDate]: previousServings }));
        setSaveError(`We couldn’t save dinner for ${formatWeekday(mealDate)}, ${formatShortDate(mealDate)}. Check your connection and try again.`);
      } finally {
        setSavingDate((current) => current === mealDate ? null : current);
      }
    });
  }

  function selectRecipeForDinner(recipe: Recipe) {
    setPendingRecipeId(recipe.id);
    const existingServings = activeItem?.recipe_id === recipe.id ? activeItem.planned_servings : null;
    setServingCount(String(existingServings ?? recipe.servings ?? 4));
  }

  function confirmRecipeDinner() {
    if (!pendingRecipeId) return;
    const servings = Number(servingCount);
    chooseDinner(`recipe:${pendingRecipeId}`, Number.isFinite(servings) && servings > 0 ? servings : null);
  }

  function submitQuickAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pickerDay || quickAdding) return;

    const name = quickName.trim();
    const sourceUrl = quickUrl.trim();
    if (!name && !sourceUrl) {
      setQuickError("Enter a recipe name or paste a recipe URL.");
      return;
    }

    const mealDate = pickerDay.mealDate;
    const formData = new FormData();
    formData.set("household_id", householdId);
    formData.set("week_start", mondayFor(mealDate));
    formData.set("meal_date", mealDate);
    formData.set("name", name);
    formData.set("source_url", sourceUrl);
    setQuickError("");

    startQuickAddTransition(async () => {
      let result: Awaited<ReturnType<typeof quickAddRecipeAndPlan>>;
      try {
        result = await quickAddRecipeAndPlan(formData);
      } catch {
        setQuickError("We couldn’t add that recipe. Check your connection and try again.");
        return;
      }
      if (!result.ok) {
        setQuickError(result.error);
        return;
      }

      setPlannerRecipes((current) => {
        if (current.some((recipe) => recipe.id === result.recipe.id)) return current;
        return [...current, result.recipe].sort((a, b) => a.name.localeCompare(b.name));
      });
      setOptimisticSelections((current) => ({ ...current, [mealDate]: `recipe:${result.recipe.id}` }));
      setPickerDay(null);
      setShowQuickAdd(false);
      setQuickName("");
      setQuickUrl("");
      setQuickError("");
    });
  }

  function copyLastWeek() {
    if (copyingWeek) return;
    const formData = new FormData();
    formData.set("household_id", householdId);
    formData.set("week_start", weekStart);
    const weekDates = dayNames.map((_, index) => addDays(weekStart, index));

    startCopyWeekTransition(async () => {
      let result: Awaited<ReturnType<typeof copyPreviousWeek>>;
      try {
        result = await copyPreviousWeek(formData);
      } catch {
        onNotify?.("We couldn’t copy last week. Check your connection and try again.", "error");
        return;
      }
      if (!result.ok) {
        onNotify?.(`We couldn’t copy last week: ${result.error}`, "error");
        return;
      }
      if (result.copied > 0) {
        // Let freshly copied days show through any "cleared" optimistic state from earlier in this visit.
        setOptimisticSelections((current) => {
          const next = { ...current };
          for (const date of weekDates) if (next[date] === "none") delete next[date];
          return next;
        });
        const kept = result.keptExisting ? ` Kept ${result.keptExisting} ${result.keptExisting === 1 ? "day" : "days"} you’d already planned.` : "";
        onNotify?.(`Copied ${result.copied} ${result.copied === 1 ? "dinner" : "dinners"} from last week.${kept}`);
      } else if (result.sourceCount === 0) {
        onNotify?.("Nothing to copy. Last week doesn’t have any dinners planned.", "info");
      } else {
        onNotify?.("Nothing to copy. Every day last week planned is already filled in this week.", "info");
      }
    });
  }

  const headingTitle = mode === "day"
    ? formatWeekday(dayDate)
    : mode === "week"
      ? (isCurrentWeek ? "This week" : `Week of ${formatShortDate(weekStart)}`)
      : formatMonthLabel(normalizedMonth);

  const headingCopy = mode === "day"
    ? formatFullDate(dayDate)
    : mode === "week"
      ? formatWeekLabel(weekStart)
      : "See the whole month, then tap any day to plan dinner.";

  return (
    <section>
      <div className="section-heading week-heading planner-heading">
        <div>
          <p className="eyebrow">{mode === "day" ? "DINNER IN DETAIL" : "DINNER AT A GLANCE"}</p>
          <h2>{headingTitle}</h2>
          <p className="week-range">{headingCopy}</p>
        </div>

        <div className="planner-heading-controls">
          <div className="planner-view-toggle" role="group" aria-label="Planner view">
            <button type="button" className={mode === "day" ? "active" : ""} onClick={() => switchMode("day")} aria-pressed={mode === "day"}>Day</button>
            <button type="button" className={mode === "week" ? "active" : ""} onClick={() => switchMode("week")} aria-pressed={mode === "week"}>Week</button>
            <button type="button" className={mode === "month" ? "active" : ""} onClick={() => switchMode("month")} aria-pressed={mode === "month"}>Month</button>
          </div>

          {mode === "day" ? (
            <div className="inline-actions week-actions" aria-label="Day navigation">
              <Link className="secondary link-button week-step" href={`/?planner=day&day=${addDays(dayDate, -1)}`} aria-label="Previous day">←<span className="label-long"> Previous</span></Link>
              {dayDate !== today && <Link className="secondary link-button" href={`/?planner=day&day=${today}`}>Today</Link>}
              <Link className="secondary link-button week-step" href={`/?planner=day&day=${addDays(dayDate, 1)}`} aria-label="Next day"><span className="label-long">Next </span>→</Link>
            </div>
          ) : mode === "week" ? (
            <div className="inline-actions week-actions" aria-label="Week navigation">
              <Link className="secondary link-button week-step" href={`/?week=${previousWeek}`} aria-label="Previous week">←<span className="label-long"> Previous</span></Link>
              {!isCurrentWeek && <Link className="secondary link-button" href="/">This week</Link>}
              <Link className="secondary link-button week-step" href={`/?week=${nextWeek}`} aria-label="Next week"><span className="label-long">Next </span>→</Link>
              <button className="secondary copy-week-button" type="button" onClick={copyLastWeek} disabled={copyingWeek} aria-busy={copyingWeek || undefined} title="Fill this week’s empty days with last week’s dinners">
                {copyingWeek ? "Copying…" : "Copy last week"}
              </button>
            </div>
          ) : (
            <div className="inline-actions week-actions" aria-label="Month navigation">
              <Link className="secondary link-button week-step" href={`/?planner=month&month=${previousMonth.slice(0, 7)}`} aria-label="Previous month">←<span className="label-long"> Previous</span></Link>
              {normalizedMonth !== currentMonth && <Link className="secondary link-button" href={`/?planner=month&month=${currentMonth.slice(0, 7)}`}>This month</Link>}
              <Link className="secondary link-button week-step" href={`/?planner=month&month=${nextMonth.slice(0, 7)}`} aria-label="Next month"><span className="label-long">Next </span>→</Link>
            </div>
          )}
        </div>
      </div>

      {saveError && (
        <div className="form-alert error planner-save-error" role="alert">
          <span>{saveError}</span>
          <button className="text-button" type="button" onClick={() => setSaveError("")} aria-label="Dismiss message">×</button>
        </div>
      )}

      {mode === "day" ? (
        dayRecipe ? (
          <div className="day-detail-view">
            <section className="day-recipe-hero">
              <div className="day-recipe-hero-copy">
                <div className="day-detail-kicker-row">
                  <p className="eyebrow">{dayDate === today ? "TONIGHT" : "DINNER"}</p>
                  {dayRecipe.is_favorite && <span className="day-favorite-pill">★ Favorite</span>}
                </div>
                <h3>{dayRecipe.name}</h3>
                <p className="day-recipe-description">{dayRecipe.description || "A recipe from your shared kitchen."}</p>
                {dayTags.length > 0 && <div className="tag-row day-detail-tags">{dayTags.map((tag) => <span className="badge" key={tag}>{tag}</span>)}</div>}
                <div className="day-detail-actions">
                  <button className="primary" type="button" onClick={() => openPicker(formatWeekday(dayDate), dayDate)}>Change dinner</button>
                  <Link className="secondary link-button" href={`/recipes/${dayRecipe.id}`}>Open full recipe →</Link>
                  {daySource && <a className="secondary link-button" href={daySource} target="_blank" rel="noreferrer">Original recipe ↗</a>}
                </div>
                {daySaving && <span className="auto-save-status saving day-saving">Saving…</span>}
              </div>
              {dayPhoto && (
                <div className="day-recipe-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={dayPhoto} alt={dayRecipe.name} />
                </div>
              )}
            </section>

            <section className="day-recipe-stats" aria-label="Recipe timing and servings">
              <div><span>Prep</span><strong>{dayRecipe.prep_minutes != null ? `${dayRecipe.prep_minutes} min` : "—"}</strong></div>
              <div><span>Cook</span><strong>{dayRecipe.cook_minutes != null ? `${dayRecipe.cook_minutes} min` : "—"}</strong></div>
              <div><span>Total</span><strong>{dayTotalMinutes ? `${dayTotalMinutes} min` : "—"}</strong></div>
              <div><span>Planned servings</span><strong>{dayPlannedServings ?? dayRecipe.servings ?? "—"}</strong></div>
            </section>

            {dayItem?.notes && (
              <section className="day-plan-note">
                <span>Plan note</span>
                <p>{dayItem.notes}</p>
              </section>
            )}

            <div className="day-cook-grid">
              <section className="day-cook-card">
                <div className="day-cook-card-heading"><p className="eyebrow">WHAT YOU NEED</p><h3>Ingredients</h3>{dayRecipe.servings && dayPlannedServings && dayRecipe.servings !== dayPlannedServings && <span className="day-scaling-note">Scaled from {dayRecipe.servings} to {dayPlannedServings} servings</span>}</div>
                {dayIngredients.length ? (
                  <ul className="day-ingredient-list">
                    {dayIngredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}
                  </ul>
                ) : <p className="day-empty-copy">No ingredients have been added to this recipe yet.</p>}
              </section>

              <section className="day-cook-card">
                <div className="day-cook-card-heading"><p className="eyebrow">HOW TO MAKE IT</p><h3>Instructions</h3></div>
                {dayInstructions.length ? (
                  <ol className="day-instruction-list">
                    {dayInstructions.map((instruction, index) => (
                      <li key={`${instruction}-${index}`}><span>{index + 1}</span><p>{instruction}</p></li>
                    ))}
                  </ol>
                ) : <p className="day-empty-copy">No instructions have been added to this recipe yet.</p>}
              </section>
            </div>
          </div>
        ) : (
          <section className={`day-plan-empty ${daySelection !== "none" ? "has-quick-plan" : ""}`}>
            <div className="day-plan-empty-icon" aria-hidden="true">{daySummary.emoji}</div>
            <p className="eyebrow">DINNER</p>
            <h3>{daySummary.title}</h3>
            <p>{daySummary.meta}</p>
            {dayItem?.notes && <div className="day-plan-note compact"><span>Plan note</span><p>{dayItem.notes}</p></div>}
            <button className="primary" type="button" onClick={() => openPicker(formatWeekday(dayDate), dayDate)}>{daySelection === "none" ? "Choose dinner" : "Change dinner"}</button>
            {daySaving && <span className="auto-save-status saving">Saving…</span>}
          </section>
        )
      ) : mode === "week" ? (
        <>
        <div className="week-grid" ref={weekGridRef}>
          {dayNames.map((day, index) => {
            const mealDate = addDays(weekStart, index);
            const item = mealPlanItems.find((entry) => entry.meal_date === mealDate && entry.meal_type === "dinner");
            const selection = optimisticSelections[mealDate] ?? selectionFor(item);
            const summary = summaryForSelection(selection, plannerRecipes);
            const isToday = mealDate === today;
            const hasPlan = selection !== "none";
            const saving = savingDate === mealDate && isPending;

            return (
              <article className={`day-card ${hasPlan ? "planned-day" : ""} ${isToday ? "today-card" : ""}`} key={mealDate}>
                <div className="day-card-heading">
                  <div>
                    <div className="day-name"><span className="label-long">{day}</span><span className="label-short">{day.slice(0, 3)}</span></div>
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
                  <button className={`meal-picker-button ${hasPlan ? "has-selection" : ""}`} type="button" onClick={() => openPicker(day, mealDate)} aria-haspopup="dialog" aria-label={`${hasPlan ? "Change" : "Choose"} dinner for ${day}, ${formatShortDate(mealDate)}`}>
                    <span className="meal-picker-button-copy">
                      <strong className="label-long">{hasPlan ? "Change dinner" : "Choose dinner"}</strong>
                      <strong className="label-short" aria-hidden="true">{hasPlan ? "Change" : "＋ Add"}</strong>
                    </span>
                  </button>
                  {saving && <span className="auto-save-status saving">Saving…</span>}
                </div>
              </article>
            );
          })}
        </div>
        <nav className="week-bottom-pager" aria-label="Change week">
          <Link className="secondary link-button" href={`/?week=${previousWeek}`}>← Previous week</Link>
          {isCurrentWeek
            ? <Link className="secondary link-button" href={`/?week=${nextWeek}`}>Next week →</Link>
            : <Link className="secondary link-button" href="/">This week</Link>}
        </nav>
        </>
      ) : (
        <div className="month-calendar-shell">
          <div className="month-weekdays" aria-hidden="true">
            {monthDayShortNames.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="month-calendar-grid">
            {monthDates.map((mealDate) => {
              const item = mealPlanItems.find((entry) => entry.meal_date === mealDate && entry.meal_type === "dinner");
              const selection = optimisticSelections[mealDate] ?? selectionFor(item);
              const summary = summaryForSelection(selection, plannerRecipes);
              const hasPlan = selection !== "none";
              const inMonth = mealDate.slice(0, 7) === normalizedMonth.slice(0, 7);
              const isToday = mealDate === today;
              const saving = savingDate === mealDate && isPending;
              const date = dateFromIso(mealDate);

              return (
                <button type="button" key={mealDate} className={`month-day ${inMonth ? "" : "outside-month"} ${hasPlan ? "has-plan" : ""} ${isToday ? "today" : ""}`} onClick={() => openPicker(formatWeekday(mealDate), mealDate)} aria-label={`${formatWeekday(mealDate)}, ${formatShortDate(mealDate)}. ${hasPlan ? summary.title : "No dinner planned"}.`}>
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

      {!plannerRecipes.length && (
        <div className="coming-next">
          <span>Recipe bank empty</span>
          Add a recipe right from the dinner picker, or use Leftovers and Eating out anytime.
        </div>
      )}

      {pickerDay && (
        <div className="meal-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePicker();
        }}>
          <div className="meal-modal" role="dialog" aria-modal="true" aria-labelledby="meal-modal-title" ref={dialogRef} tabIndex={-1}>
            <div className="meal-modal-header" onTouchStart={onSheetTouchStart} onTouchMove={onSheetTouchMove} onTouchEnd={onSheetTouchEnd} onTouchCancel={onSheetTouchEnd}>
              <span className="sheet-grabber" aria-hidden="true" />
              <div>
                <p className="eyebrow">{pickerDay.day.toUpperCase()} · {formatShortDate(pickerDay.mealDate).toUpperCase()}</p>
                <h3 id="meal-modal-title">What’s for dinner?</h3>
                <p className="meal-modal-subtitle">Pick a recipe, choose a quick option, or add something new.</p>
              </div>
              <button className="meal-modal-close" type="button" onClick={() => setPickerDay(null)} aria-label="Close dinner picker" disabled={quickAdding}>×</button>
            </div>

            <div className="meal-modal-body">
              <div className="meal-quick-grid" aria-label="Quick dinner options">
                {quickChoices.map((choice) => (
                  <button key={choice.value} className={`meal-choice-card quick ${activeSelection === choice.value ? "selected" : ""}`} type="button" onClick={() => chooseDinner(choice.value)} disabled={quickAdding}>
                    <span className="meal-choice-icon" aria-hidden="true">{choice.icon}</span>
                    <span className="meal-choice-copy"><strong>{choice.title}</strong><span>{choice.description}</span></span>
                    {activeSelection === choice.value && <span className="meal-choice-check" aria-hidden="true">✓</span>}
                  </button>
                ))}
              </div>

              <div className="meal-modal-divider"><span>FROM YOUR RECIPES</span></div>

              {plannerRecipes.length > 5 && (
                <label className="meal-recipe-search">
                  <span className="meal-recipe-search-icon" aria-hidden="true">⌕</span>
                  <input autoFocus={autoFocusSearch} type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipes…" aria-label="Search recipes" disabled={quickAdding} />
                </label>
              )}

              {filteredRecipes.length ? (
                <div className="meal-recipe-list">
                  {filteredRecipes.map((recipe) => {
                    const selected = pendingRecipeId === recipe.id;
                    return (
                      <button key={recipe.id} className={`meal-choice-card recipe ${selected ? "selected" : ""}`} type="button" onClick={() => selectRecipeForDinner(recipe)} disabled={quickAdding}>
                        <span className="meal-recipe-mark" aria-hidden="true">{recipe.name.slice(0, 1).toUpperCase()}</span>
                        <span className="meal-choice-copy"><strong>{recipe.name}</strong><span>{recipeMeta(recipe)}</span></span>
                        <span className="meal-choice-arrow" aria-hidden="true">{selected ? "✓" : "→"}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="meal-modal-empty">
                  <span>⌕</span>
                  <strong>{plannerRecipes.length ? "No recipes found" : "No recipes yet"}</strong>
                  <p>{plannerRecipes.length ? "Try a different search or add a new recipe below." : "Add your first recipe without leaving the planner."}</p>
                </div>
              )}

              {pendingRecipeId && (() => {
                const selectedRecipe = plannerRecipes.find((recipe) => recipe.id === pendingRecipeId);
                if (!selectedRecipe) return null;
                const numericServings = Number(servingCount);
                const validServings = Number.isFinite(numericServings) && numericServings > 0;

                return (
                  <div className="meal-serving-panel" ref={servingPanelRef}>
                    <div className="meal-serving-copy">
                      <strong>How many servings?</strong>
                      <span>{selectedRecipe.servings ? `Recipe originally makes ${selectedRecipe.servings}.` : "Choose how much you plan to make."}</span>
                    </div>
                    <div className="meal-serving-controls">
                      <button type="button" onClick={() => setServingCount(String(Math.max(0.5, (validServings ? numericServings : 1) - 1)))} aria-label="Decrease servings">−</button>
                      <label><span>Servings</span><input type="number" min="0.5" step="0.5" inputMode="decimal" value={servingCount} onChange={(event) => setServingCount(event.target.value)} /></label>
                      <button type="button" onClick={() => setServingCount(String((validServings ? numericServings : 0) + 1))} aria-label="Increase servings">＋</button>
                    </div>
                    <button className="primary meal-serving-confirm" type="button" onClick={confirmRecipeDinner} disabled={!validServings || quickAdding}>Plan {validServings ? numericServings : ""} servings</button>
                  </div>
                );
              })()}

              <div className="meal-quick-add-block">
                {!showQuickAdd ? (
                  <button className="meal-quick-add-trigger" type="button" onClick={() => { setShowQuickAdd(true); setQuickError(""); }}><span aria-hidden="true">＋</span> Add a new recipe</button>
                ) : (
                  <form className="meal-quick-add-form" onSubmit={submitQuickAdd}>
                    <div className="meal-quick-add-heading"><div><strong>Add & plan it</strong><span>Paste a recipe link to import the details, or just enter a name for now.</span></div></div>
                    <label>Recipe URL <span>(optional)</span><input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" value={quickUrl} onChange={(event) => setQuickUrl(event.target.value)} placeholder="https://example.com/recipe" disabled={quickAdding} /></label>
                    <label>Recipe name <span>(optional if URL is provided)</span><input type="text" autoComplete="off" enterKeyHint="done" value={quickName} onChange={(event) => setQuickName(event.target.value)} placeholder="Blackened ranch chicken" disabled={quickAdding} /></label>
                    {quickError && <p className="meal-quick-add-error" role="alert">{quickError}</p>}
                    <div className="meal-quick-add-actions">
                      <button className="meal-quick-add-cancel" type="button" disabled={quickAdding} onClick={() => { setShowQuickAdd(false); setQuickError(""); setQuickName(""); setQuickUrl(""); }}>Cancel</button>
                      <button className="meal-quick-add-submit" type="submit" disabled={quickAdding}>{quickAdding ? (quickUrl.trim() ? "Importing…" : "Adding…") : "Add & plan dinner"}</button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {activeSelection !== "none" && !showQuickAdd && (
              <div className="meal-modal-footer"><button className="meal-clear-button" type="button" onClick={() => chooseDinner("none")} disabled={quickAdding}>Clear dinner plan</button></div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
