import { redirect } from "next/navigation";
import { KitchenDashboard } from "@/components/kitchen-dashboard";
import { createClient } from "@/lib/supabase/server";

type HomeProps = { searchParams: Promise<{ week?: string | string[]; section?: string; invite?: string; joined?: string; share_error?: string }> };

function localIsoDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function mondayFor(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const weekday = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return date.toISOString().slice(0, 10);
}

export default async function Home({ searchParams }: HomeProps) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login");

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

  const [{ data: household }, { data: recipes }, { data: profile }, { data: memberRows }] = await Promise.all([
    supabase.from("households").select("id, name, timezone").eq("id", membership.household_id).single(),
    supabase.from("recipes").select("*").eq("household_id", membership.household_id).order("is_favorite", { ascending: false }).order("name", { ascending: true }),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase.from("household_members").select("user_id, role, created_at").eq("household_id", membership.household_id).order("created_at", { ascending: true }),
  ]);
  if (!household) redirect("/onboarding");

  const memberIds = (memberRows ?? []).map((row) => row.user_id);
  const { data: profiles } = memberIds.length ? await supabase.from("profiles").select("id, display_name").in("id", memberIds) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const members = (memberRows ?? []).map((row) => ({ ...row, display_name: profileMap.get(row.user_id) ?? "Household member" }));

  let invitations: Array<{ id: string; invited_email: string; token: string; expires_at: string; created_at: string }> = [];
  if (membership.role === "owner") {
    const { data } = await supabase.from("household_invitations").select("id, invited_email, token, expires_at, created_at").eq("household_id", membership.household_id).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
    invitations = data ?? [];
  }

  const currentWeekStart = mondayFor(localIsoDate(household.timezone))!;
  const params = await searchParams;
  const requestedWeek = Array.isArray(params.week) ? params.week[0] : params.week;
  const selectedWeekStart = requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) ? mondayFor(requestedWeek) ?? currentWeekStart : currentWeekStart;

  const { data: mealPlan } = await supabase.from("meal_plans").select("id").eq("household_id", membership.household_id).eq("week_start", selectedWeekStart).maybeSingle();
  let mealPlanItems: Array<{ id: string; meal_date: string; meal_type: string; recipe_id: string | null; custom_label: string | null; status: string; notes: string | null }> = [];
  if (mealPlan) {
    const { data: items } = await supabase.from("meal_plan_items").select("id, meal_date, meal_type, recipe_id, custom_label, status, notes").eq("meal_plan_id", mealPlan.id).order("meal_date", { ascending: true });
    mealPlanItems = items ?? [];
  }

  const initialView = params.section === "household" ? "household" : params.section === "recipes" ? "recipes" : "week";

  return <KitchenDashboard household={household} recipes={recipes ?? []} displayName={profile?.display_name ?? "Cook"} mealPlanItems={mealPlanItems} weekStart={selectedWeekStart} currentWeekStart={currentWeekStart} members={members} invitations={invitations} role={membership.role} initialView={initialView} generatedInviteToken={params.invite ?? null} joined={params.joined === "1"} shareError={params.share_error ?? null} />;
}
