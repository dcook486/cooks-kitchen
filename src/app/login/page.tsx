import { redirect } from "next/navigation";
import { login } from "@/app/actions";
import { signupWithEmail } from "@/app/email-auth-actions";
import { createClient } from "@/lib/supabase/server";
import GoogleSignInButton from "./google-sign-in-button";

type Props = {
  searchParams: Promise<{ error?: string; message?: string; mode?: string; next?: string; invite?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const next = params.next?.startsWith("/") && !params.next.startsWith("//") ? params.next : "/";
  const inviteToken = params.invite ?? "";

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect(next);

  const signupMode = params.mode === "signup";
  const queryBits = new URLSearchParams();
  queryBits.set("next", next);
  if (inviteToken) queryBits.set("invite", inviteToken);
  if (!signupMode) queryBits.set("mode", "signup");
  const switchHref = signupMode
    ? `/login?${new URLSearchParams({ next, ...(inviteToken ? { invite: inviteToken } : {}) }).toString()}`
    : `/login?${queryBits.toString()}`;

  const inviteHeading = signupMode ? "Create an account to join" : "Join your household";

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <p className="eyebrow">A SHARED TABLE FOR YOUR FAMILY</p>
        <h1>Cook&apos;s Kitchen</h1>
        <p className="auth-lede">
          Keep your go-to recipes and plan dinner together in one shared household.
        </p>
        <div className="auth-preview" aria-hidden="true">
          <div><span>Mon</span><strong>Chicken enchiladas</strong></div>
          <div><span>Tue</span><strong>Sheet-pan salmon</strong></div>
          <div><span>Wed</span><strong>Taco bowls</strong></div>
        </div>
      </section>

      <section className={`auth-card ${inviteToken ? "invite-auth-card" : ""}`}>
        <p className="eyebrow">{inviteToken ? "HOUSEHOLD INVITATION" : signupMode ? "CREATE YOUR KITCHEN" : "WELCOME BACK"}</p>
        <h2>{inviteToken ? inviteHeading : signupMode ? "Start cooking together" : "Sign in"}</h2>
        <p className="auth-subcopy">
          {inviteToken
            ? signupMode
              ? "Create an account with the email address that received the invitation."
              : "The fastest way in is Google. Choose the Google account that matches the email address your invitation was sent to."
            : signupMode
              ? "Create your account first. We’ll set up your shared household next."
              : "Pick up where you left off."}
        </p>

        {params.error && <div className="form-alert error">{params.error}</div>}
        {params.message && <div className="form-alert success">{params.message}</div>}

        <GoogleSignInButton next={next} label={inviteToken ? "Continue with Google to join" : "Continue with Google"} />

        {inviteToken && (
          <div className="invite-google-helper">
            <span aria-hidden="true">✓</span>
            <p><strong>No new password needed.</strong> Google will bring you back here to confirm joining the household.</p>
          </div>
        )}

        <div className="auth-divider" aria-hidden="true">
          <span />
          <strong>{inviteToken ? "OR USE EMAIL" : "OR"}</strong>
          <span />
        </div>

        <form className="stack-form">
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="invite_token" value={inviteToken} />
          {signupMode && (
            <label>
              Your name
              <input name="display_name" autoComplete="name" placeholder="Your name" required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span className="auth-label-row">
              <span>Password</span>
              {!signupMode && !inviteToken && <a href="/forgot-password">Forgot password?</a>}
            </span>
            <input name="password" type="password" autoComplete={signupMode ? "new-password" : "current-password"} minLength={8} required />
          </label>
          <button className="primary wide" formAction={signupMode ? signupWithEmail : login}>
            {signupMode ? "Create account" : inviteToken ? "Sign in and continue" : "Sign in"}
          </button>
        </form>

        <a className="auth-switch" href={switchHref}>
          {signupMode
            ? inviteToken ? "Already have an account? Sign in" : "Already have an account? Sign in"
            : inviteToken ? "Don’t use Google? Create an email/password account" : "New here? Create an account"}
        </a>
        <div className="auth-legal-links">
          <a href="/privacy">Privacy</a>
          <span>·</span>
          <a href="/terms">Terms</a>
        </div>
      </section>
    </main>
  );
}
