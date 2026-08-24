import { redirect } from "next/navigation";
import { KitchenDashboard } from "@/components/kitchen-dashboard";
import { createClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{ week?: string | string[] }>;
};

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

function mondayFor(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;

  const weekday = date.getUTCDay();
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export default async function Home({ searchParams }: HomeProps) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const [{ data: household }, { data: recipes }, { data: profile }] = await Promise.all([
    supabase.from("households").select("id, name, timezone").eq("id", membership.household_id).single(),
    supabase
      .from("recipes")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("is_favorite", { ascending: false })
      .order("name", { ascending: true }),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);

  if (!household) redirect("/onboarding");

  const currentWeekStart = mondayFor(localIsoDate(household.timezone))!;
  const params = await searchParams;
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const selectedWeekStart = requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
    ? mondayFor(requestedWeek) ?? currentWeekStart
    : currentWeekStart;

  const { data: mealPlan } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("household_id", membership.household_id)
    .eq("week_start", selectedWeekStart)
    .maybeSingle();

  let mealPlanItems: Array<{
    id: string;
    meal_date: string;
    meal_type: string;
    recipe_id: string | null;
    custom_label: string | null;
    status: string;
    notes: string | null;
  }> = [];

  if (mealPlan) {
    const { data: items } = await supabase
      .from("meal_plan_items")
      .select("id, meal_date, meal_type, recipe_id, custom_label, status, notes")
      .eq("meal_plan_id", mealPlan.id)
      .order("meal_date", { ascending: true });
    mealPlanItems = items ?? [];
  }

  return (
    <KitchenDashboard
      household={household}
      recipes={recipes ?? []}
      displayName={profile?.display_name ?? "Cook"}
      mealPlanItems={mealPlanItems}
      weekStart={selectedWeekStart}
      currentWeekStart={currentWeekStart}
    />
  );
}
