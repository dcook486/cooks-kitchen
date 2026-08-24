import { redirect } from "next/navigation";
import { acceptHouseholdInvitation } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}&invite=${encodeURIComponent(token)}`);
  }

  const { data, error } = await supabase.rpc("get_household_invitation", { invite_token: token });
  const invitation = Array.isArray(data) ? data[0] : null;

  if (error || !invitation) {
    return (
      <main className="onboarding-page">
        <section className="onboarding-card">
          <div className="onboarding-icon">🔒</div>
          <p className="eyebrow">HOUSEHOLD INVITATION</p>
          <h1>Invite unavailable</h1>
          <p>This invitation could not be found or is no longer available.</p>
          <a className="primary link-button wide" href="/">Return to Cook&apos;s Kitchen</a>
        </section>
      </main>
    );
  }

  const expired = new Date(invitation.expires_at).getTime() <= Date.now();
  const unavailable = Boolean(invitation.accepted_at || invitation.revoked_at || expired);

  return (
    <main className="onboarding-page">
      <section className="onboarding-card invite-card">
        <div className="onboarding-icon">👥</div>
        <p className="eyebrow">YOU&apos;RE INVITED</p>
        <h1>Join {invitation.household_name}</h1>
        <p>
          Join this household to share the same recipe bank and weekly dinner plan. This invitation is for <strong>{invitation.invited_email}</strong>.
        </p>

        {query.error && <div className="form-alert error">{query.error}</div>}
        {unavailable ? (
          <div className="form-alert error">This invitation has expired, been revoked, or already been used.</div>
        ) : (
          <form action={acceptHouseholdInvitation} className="stack-form invite-accept-form">
            <input type="hidden" name="token" value={token} />
            <button className="primary wide" type="submit">Join household</button>
          </form>
        )}
        <a className="auth-switch" href="/">Not now</a>
      </section>
    </main>
  );
}
