export default function AuthErrorPage() {
  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="onboarding-icon">🥄</div>
        <p className="eyebrow">SIGN-IN LINK PROBLEM</p>
        <h1>That link didn&apos;t work</h1>
        <p>It may have expired or already been used. Return to sign in and try again.</p>
        <a className="primary link-button" href="/login">Back to sign in</a>
      </section>
    </main>
  );
}
