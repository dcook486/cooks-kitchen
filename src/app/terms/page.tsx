export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-shell">
        <a className="profile-back" href="/">← Back to Cook&apos;s Kitchen</a>
        <article className="legal-card">
          <p className="eyebrow">COOK&apos;S KITCHEN</p>
          <h1>Terms of Use</h1>
          <p className="legal-effective">Effective August 27, 2026</p>

          <div className="legal-content">
            <section>
              <h2>Using Cook&apos;s Kitchen</h2>
              <p>Cook&apos;s Kitchen is a household meal-planning and recipe-management service. You may use it for lawful personal and household purposes and are responsible for activity performed through your account.</p>
            </section>

            <section>
              <h2>Your account</h2>
              <p>Keep your sign-in credentials secure and use an email address you control. If you join a shared household, other household members can see and update shared recipes, meal plans, and household settings according to the permissions available in the product.</p>
            </section>

            <section>
              <h2>Your content</h2>
              <p>You retain responsibility for recipes, notes, photos, and other content you add. By adding content to a shared household, you allow the other members of that household to access and use that content within Cook&apos;s Kitchen.</p>
            </section>

            <section>
              <h2>Recipe imports</h2>
              <p>Recipe-import tools are provided for convenience and may not always extract information correctly. You are responsible for reviewing imported ingredients, instructions, allergy information, cooking temperatures, and other details before relying on them.</p>
            </section>

            <section>
              <h2>Not professional advice</h2>
              <p>Cook&apos;s Kitchen is not a medical, dietary, allergy, food-safety, or nutrition service. Information stored or generated in the product should not replace appropriate professional guidance or your own food-safety judgment.</p>
            </section>

            <section>
              <h2>Beta availability</h2>
              <p>During beta, features may change, experience interruptions, or contain errors. Cook&apos;s Kitchen may modify or discontinue beta functionality as the product develops.</p>
            </section>

            <section>
              <h2>Account and household deletion</h2>
              <p>You may delete your account from your Profile page. Household owners are responsible for transferring ownership before leaving a shared household. If a sole owner deletes their account, the associated household and household-scoped content may also be permanently deleted.</p>
            </section>

            <section>
              <h2>Acceptable use</h2>
              <p>Do not misuse the service, attempt to access another household without authorization, interfere with the service, upload unlawful content, or use Cook&apos;s Kitchen in a way that violates applicable law or another person&apos;s rights.</p>
            </section>

            <section>
              <h2>Changes</h2>
              <p>These terms may be updated as Cook&apos;s Kitchen evolves. Continuing to use the service after material updates means the updated terms will apply to future use.</p>
            </section>
          </div>

          <div className="legal-footer-links">
            <a className="secondary link-button" href="/privacy">Read Privacy Policy</a>
            <a className="secondary link-button" href="/login">Sign in</a>
          </div>
        </article>
      </div>
    </main>
  );
}
