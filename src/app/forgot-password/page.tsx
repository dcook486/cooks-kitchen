import Link from "next/link";
import { requestPasswordReset } from "@/app/password-actions";

type Props = {
  searchParams: Promise<{ error?: string; sent?: string; email?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <main className="auth-page auth-single-page">
      <section className="auth-brand auth-recovery-brand">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Back to the kitchen.</h1>
        <p className="auth-lede">We&apos;ll send a secure link to the email address on your Cook&apos;s Kitchen account.</p>
      </section>

      <section className="auth-card">
        <p className="eyebrow">RESET PASSWORD</p>
        <h2>{sent ? "Check your email" : "Forgot your password?"}</h2>
        {sent ? (
          <>
            <p className="auth-subcopy">If an account exists for <strong>{params.email ?? "that email address"}</strong>, a password-reset link is on its way. The link will bring you back here to choose a new password.</p>
            <Link className="primary link-button wide" href="/login">Return to sign in</Link>
            <p className="auth-recovery-note">Didn&apos;t get it? Check spam, then wait a minute before requesting another link.</p>
          </>
        ) : (
          <>
            <p className="auth-subcopy">Enter the email you use to sign in. For privacy, we&apos;ll show the same confirmation whether or not that address has an account.</p>
            {params.error && <div className="form-alert error">{params.error}</div>}
            <form className="stack-form" action={requestPasswordReset}>
              <label>
                Email
                <input name="email" type="email" autoComplete="email" defaultValue={params.email ?? ""} placeholder="you@example.com" required />
              </label>
              <button className="primary wide" type="submit">Send reset link</button>
            </form>
            <Link className="auth-switch" href="/login">← Back to sign in</Link>
          </>
        )}
      </section>
    </main>
  );
}
