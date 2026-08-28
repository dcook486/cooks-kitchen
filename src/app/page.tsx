import { redirect } from "next/navigation";
import { KitchenDashboard } from "@/components/kitchen-dashboard";
import { LandingPage } from "@/components/landing-page";
import { createClient } from "@/lib/supabase/server";

type HomeProps = {
  searchParams: Promise<{
    week?: string | string[];
    planner?: string;
    day?: string;
    month?: string;
    section?: string;
    invite?: string;
    joined?: string;
    share_error?: string;
  }>;
};

function localIsoDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

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
  if (Number.isNaN(date.getTime())) return null;
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

function sundayFor(value: string) {
  const date = dateFromIso(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function firstOfMonth(value: string) {
  const date = dateFromIso(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export default async function Home({ searchParams }: HomeProps) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) return <LandingPage />;

  const params = await searchParams;
  if (params.section === "household") {
    const householdParams = new URLSearchParams();
    if (params.invite) householdParams.set("invite", params.invite);
    if (params.joined) householdParams.set("joined", params.joined);
    if (params.share_error) householdParams.set("share_error", params.share_error);
    const query = householdParams.toString();
    redirect(query ? `/household?${query}` : "/household");
  }

  let { data: membership } = await supabase.from("household_members").select("household_id, role").eq("user_id", userId).limit(1).maybeSingle();

  if (!membership) {
    const { data: userData } = await supabase.auth.getUser();
    const pendingInvite = userData.user?.user_metadata?.pending_household_invite;
    if (typeof pendingInvite === "string" && /^[0-9a-f-]{36}$/i.test(pendingInvite)) {
      const { error } = await supabase.rpc("accept_household_invitation", { invite_token: pendingInvite });
      if (!error) {
        const result = await supabase.from("household_members").select("household_id, role").eq("user_id", userId).limit(1).maybeSingle();
        membership = result.data;
      }
    }
  }

  if (!membership) redirect("/onboarding");

  const [{ data: household }, { data: recipes }, { data: profile }] = await Promise.all([
    supabase.from("households").select("id, name, kitchen_name, tagline, timezone").eq("id", membership.household_id).single(),
    supabase.from("recipes").select("*").eq("household_id", membership.household_id).order("is_favorite", { ascending: false }).order("name", { ascending: true }),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
  ]);
  if (!household) redirect("/onboarding");

  const today = localIsoDate(household.timezone);
  const currentWeekStart = mondayFor(today)!;
  const plannerMode = params.planner === "month" ? "month" : params.planner === "day" ? "day" : "week";
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const requestedDay = typeof params.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : null;
  const requestedMonth = typeof params.month === "string" && /^\d{4}-\d{2}$/.test(params.month) ? `${params.month}-01` : null;

  let selectedWeekStart = requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek)
    ? mondayFor(requestedWeek) ?? currentWeekStart
    : currentWeekStart;

  if (plannerMode === "day" && requestedDay && !requestedWeek) {
    selectedWeekStart = mondayFor(requestedDay) ?? currentWeekStart;
  }

  let dayAnchor = requestedDay ?? (selectedWeekStart === currentWeekStart ? today : selectedWeekStart);
  if (mondayFor(dayAnchor) !== selectedWeekStart) dayAnchor = selectedWeekStart;

  let monthAnchor = requestedMonth ?? firstOfMonth(plannerMode === "day" ? dayAnchor : addDays(selectedWeekStart, 3)) ?? firstOfMonth(today)!;
  if (plannerMode === "month" && requestedMonth && !requestedWeek) {
    selectedWeekStart = mondayFor(monthAnchor) ?? currentWeekStart;
  }

  monthAnchor = firstOfMonth(monthAnchor) ?? firstOfMonth(today)!;
  const monthGridStart = sundayFor(monthAnchor)!;
  const monthGridEnd = addDays(monthGridStart, 41);
  const firstPlanWeek = mondayFor(monthGridStart)!;
  const lastPlanWeek = mondayFor(monthGridEnd)!;

  const { data: monthPlans } = await supabase
    .from("meal_plans")
    .select("id, week_start")
    .eq("household_id", membership.household_id)
    .gte("week_start", firstPlanWeek)
    .lte("week_start", lastPlanWeek)
    .order("week_start", { ascending: true });

  let mealPlanItems: Array<{ id: string; meal_date: string; meal_type: string; recipe_id: string | null; custom_label: string | null; status: string; notes: string | null; planned_servings: number | null }> = [];
  const planIds = (monthPlans ?? []).map((plan) => plan.id);
  if (planIds.length) {
    const { data: items } = await supabase
      .from("meal_plan_items")
      .select("id, meal_date, meal_type, recipe_id, custom_label, status, notes, planned_servings")
      .in("meal_plan_id", planIds)
      .gte("meal_date", monthGridStart)
      .lte("meal_date", monthGridEnd)
      .order("meal_date", { ascending: true });
    mealPlanItems = items ?? [];
  }

  const initialView = params.section === "recipes" ? "recipes" : "week";

  return (
    <KitchenDashboard
      household={household}
      recipes={recipes ?? []}
      displayName={profile?.display_name ?? "Cook"}
      mealPlanItems={mealPlanItems}
      weekStart={selectedWeekStart}
      currentWeekStart={currentWeekStart}
      dayAnchor={dayAnchor}
      monthAnchor={monthAnchor}
      initialPlannerMode={plannerMode}
      initialView={initialView}
    />
  );
}
