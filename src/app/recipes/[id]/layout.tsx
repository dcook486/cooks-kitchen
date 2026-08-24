import type { ReactNode } from "react";
import { RecipeHistory } from "@/components/recipe-history";
import { createClient } from "@/lib/supabase/server";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

function localDateKey(timeZone: string) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }

  const parts = formatter.formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export default async function RecipeLayout({ children, params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("household_id")
    .eq("id", id)
    .maybeSingle();

  if (!recipe) return children;

  const { data: household } = await supabase
    .from("households")
    .select("timezone")
    .eq("id", recipe.household_id)
    .maybeSingle();

  const today = localDateKey(household?.timezone ?? "America/Chicago");
  const { data: historyRows } = await supabase
    .from("meal_plan_items")
    .select("meal_date")
    .eq("recipe_id", id)
    .eq("meal_type", "dinner")
    .eq("status", "planned")
    .lt("meal_date", today)
    .order("meal_date", { ascending: false });

  const dates = Array.from(
    new Set((historyRows ?? []).map((row) => row.meal_date).filter((date): date is string => Boolean(date))),
  );

  return (
    <>
      {children}
      <RecipeHistory dates={dates} />
    </>
  );
}
