import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AccountMenu } from "@/components/account-menu";
import { HouseholdSharing } from "@/components/household-sharing";

type Props = {
  searchParams: Promise<{
    invite?: string;
    joined?: string;
    share_error?: string;
  }>;
};

export default async function HouseholdPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/household");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) redirect("/onboarding");

  const [{ data: household }, { data: profile }, { data: memberRows }] = await Promise.all([
    supabase.from("households").select("id, name").eq("id", membership.household_id).single(),
    supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    supabase
      .from("household_members")
      .select("user_id, role, created_at")
      .eq("household_id", membership.household_id)
      .order("created_at", { ascending: true }),
  ]);

  if (!household) redirect("/onboarding");

  const memberIds = (memberRows ?? []).map((row) => row.user_id);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", memberIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const members = (memberRows ?? []).map((row) => ({
    ...row,
    display_name: profileMap.get(row.user_id) ?? "Household member",
  }));

  let invitations: Array<{
    id: string;
    invited_email: string;
    token: string;
    expires_at: string;
    created_at: string;
  }> = [];

  if (membership.role === "owner") {
    const { data } = await supabase
      .from("household_invitations")
      .select("id, invited_email, token, expires_at, created_at")
      .eq("household_id", membership.household_id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    invitations = data ?? [];
  }

  const params = await searchParams;
  const displayName = profile?.display_name ?? "Cook";

  return (
    <div className="app-shell household-page-shell">
      <header className="topbar household-page-topbar">
        <div className="brand-block">
          <a className="profile-back" href="/">← Back to kitchen</a>
          <p className="eyebrow">ACCOUNT &amp; SHARING</p>
          <h1>Household</h1>
        </div>
        <AccountMenu displayName={displayName} />
      </header>

      <main className="household-page-main">
        <HouseholdSharing
          householdId={household.id}
          householdName={household.name}
          role={membership.role}
          members={members}
          invitations={invitations}
          generatedInviteToken={params.invite ?? null}
          joined={params.joined === "1"}
          shareError={params.share_error ?? null}
        />
      </main>
    </div>
  );
}
