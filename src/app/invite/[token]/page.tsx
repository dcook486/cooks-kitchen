import { redirect } from "next/navigation";
import { acceptHouseholdInvitation } from "@/app/household-actions";
import { createClient } from "@/lib/supabase/server";
import { SwitchInviteAccountButton } from "./switch-account-button";

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

function InviteUnavailable() {
  return (
    <main className="onboarding-page invite-landing-page">
      <section className="onboarding-card invite-card refreshed-invite-card">
        <div className="onboarding-icon">🔒</div>
        <p className="eyebrow">HOUSEHOLD INVITATION</p>
        <h1>Invite unavailable</h1>
        <p>This invitation has expired, been revoked, already been used, or could not be found.</p>
        <a className="primary link-button wide" href="/">Return to Cook&apos;s Kitchen</a>
      </section>
    </main>
  );
}

export default async function InvitePage({ params, searchParams }: Props) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const validTokenFormat = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  if (!validTokenFormat) return <InviteUnavailable />;

  // Check only whether this bearer-token invitation is usable before asking someone
  // to authenticate. The public RPC deliberately exposes no household or email data.
  const { data: inviteAvailable, error: availabilityError } = await supabase.rpc(
    "is_household_invitation_available",
    { invite_token: token },
  );

  if (availabilityError || inviteAvailable !== true) return <InviteUnavailable />;

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}&invite=${encodeURIComponent(token)}`);
  }

  const [{ data, error }, { data: userData }] = await Promise.all([
    supabase.rpc("get_household_invitation", { invite_token: token }),
    supabase.auth.getUser(),
  ]);
  const invitation = Array.isArray(data) ? data[0] : null;

  if (error || !invitation) return <InviteUnavailable />;

  const expired = new Date(invitation.expires_at).getTime() <= Date.now();
  const unavailable = Boolean(invitation.accepted_at || invitation.revoked_at || expired);
  const currentEmail = userData.user?.email?.toLowerCase() ?? "";
  const invitedEmail = String(invitation.invited_email).toLowerCase();
  const wrongAccount = Boolean(currentEmail && currentEmail !== invitedEmail);

  return (
    <main className="onboarding-page invite-landing-page">
      <section className="onboarding-card invite-card refreshed-invite-card">
        <div className="invite-household-mark" aria-hidden="true">CK</div>
        <p className="eyebrow">YOU&apos;RE INVITED</p>
        <h1>Join {invitation.household_name}</h1>
        <p className="invite-lede">
          Share the same recipes and weekly dinner plan with everyone in this household.
        </p>

        <div className="invite-account-summary">
          <span>Invitation for</span>
          <strong>{invitation.invited_email}</strong>
          {currentEmail && <small>You&apos;re signed in as {currentEmail}</small>}
        </div>

        {query.error && <div className="form-alert error">{query.error}</div>}

        {unavailable ? (
          <div className="form-alert error">This invitation has expired, been revoked, or already been used.</div>
        ) : wrongAccount ? (
          <div className="invite-wrong-account">
            <div className="form-alert error">
              This invitation belongs to <strong>{invitation.invited_email}</strong>, but you&apos;re signed in as <strong>{currentEmail}</strong>.
            </div>
            <p>Switch to the invited Google account and we&apos;ll bring you right back to this invitation.</p>
            <SwitchInviteAccountButton token={token} />
          </div>
        ) : (
          <>
            <div className="invite-ready-note">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Your account matches the invitation</strong>
                <p>One more click will add you to {invitation.household_name}.</p>
              </div>
            </div>
            <form action={acceptHouseholdInvitation} className="stack-form invite-accept-form">
              <input type="hidden" name="token" value={token} />
              <button className="primary wide" type="submit">Join {invitation.household_name}</button>
            </form>
          </>
        )}

        <a className="auth-switch" href="/">Not now</a>
      </section>
    </main>
  );
}
