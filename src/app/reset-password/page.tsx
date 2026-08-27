import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePassword } from "@/app/password-actions";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    redirect("/forgot-password?error=Your%20reset%20link%20is%20no%20longer%20valid.%20Request%20a%20new%20one.");
  }

  return (
    <main className="auth-page auth-single-page">
      <section className="auth-brand auth-recovery-brand">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Choose a new password.</h1>
        <p className="auth-lede">Use something you don&apos;t reuse elsewhere. After saving it, we&apos;ll sign you out so you can sign back in normally.</p>
      </section>

      <section className="auth-card">
        <p className="eyebrow">NEW PASSWORD</p>
        <h2>Reset your password</h2>
        <p className="auth-subcopy">Your reset link was verified. Enter your new password below.</p>
        {params.error && <div className="form-alert error">{params.error}</div>}
        <form className="stack-form" action={updatePassword}>
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            Confirm new password
            <input name="confirm_password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="primary wide" type="submit">Save new password</button>
        </form>
        <Link className="auth-switch" href="/">Cancel</Link>
      </section>
    </main>
  );
}
