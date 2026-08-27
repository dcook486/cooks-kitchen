export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <a className="profile-back" href="/">← Back to Cook&apos;s Kitchen</a>
        <article className="legal-card">
          <p className="eyebrow">COOK&apos;S KITCHEN</p>
          <h1>Privacy Policy</h1>
          <p className="legal-effective">Effective August 27, 2026</p>

          <div className="legal-content">
            <section>
              <h2>What Cook&apos;s Kitchen collects</h2>
              <p>Cook&apos;s Kitchen stores the information needed to provide the service, including your account email, display name, household membership, saved recipes, meal plans, household settings, invitations, and photos you choose to upload.</p>
            </section>

            <section>
              <h2>Google sign-in</h2>
              <p>If you use Google to sign in, Cook&apos;s Kitchen receives basic account information needed to identify your account, such as your email address, name, and profile image. Cook&apos;s Kitchen does not receive your Google password.</p>
            </section>

            <section>
              <h2>How information is used</h2>
              <p>Your information is used to operate Cook&apos;s Kitchen, keep your household&apos;s recipes and meal plan synchronized, provide shared-household features, secure accounts, troubleshoot problems, and improve the product.</p>
            </section>

            <section>
              <h2>Shared households</h2>
              <p>People who belong to the same Cook&apos;s Kitchen household can see and update shared household content such as recipes and meal plans. Your account email is not displayed as part of the normal recipe or planner experience, although household owners may use email addresses when sending invitations.</p>
            </section>

            <section>
              <h2>Service providers</h2>
              <p>Cook&apos;s Kitchen relies on third-party infrastructure providers for functions such as hosting, authentication, database storage, and file storage. These providers process information as needed to operate the service.</p>
            </section>

            <section>
              <h2>Selling personal information</h2>
              <p>Cook&apos;s Kitchen does not sell your personal information to advertisers.</p>
            </section>

            <section>
              <h2>Account deletion</h2>
              <p>You can delete your Cook&apos;s Kitchen account from your Profile page. If you are the only member of a household you own, deleting your account also deletes that household and its household-scoped data. If other people belong to a household you own, you must transfer ownership before deleting your account.</p>
            </section>

            <section>
              <h2>Security and retention</h2>
              <p>Cook&apos;s Kitchen uses reasonable technical safeguards and authenticated access controls to protect household data. Information is retained while needed to provide the service and may be removed when you delete your account or household, subject to ordinary infrastructure backups and operational retention.</p>
            </section>

            <section>
              <h2>Changes to this policy</h2>
              <p>This policy may be updated as Cook&apos;s Kitchen adds features or changes how the service operates. The effective date above will be updated when material changes are made.</p>
            </section>
          </div>

          <div className="legal-footer-links">
            <a className="secondary link-button" href="/terms">Read Terms of Use</a>
            <a className="secondary link-button" href="/login">Sign in</a>
          </div>
        </article>
      </div>
    </main>
  );
}
