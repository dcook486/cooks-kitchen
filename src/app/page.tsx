import { redirect } from "next/navigation";
import { KitchenDashboard } from "@/components/kitchen-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
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

  return (
    <KitchenDashboard
      household={household}
      recipes={recipes ?? []}
      displayName={profile?.display_name ?? "Cook"}
    />
  );
}
