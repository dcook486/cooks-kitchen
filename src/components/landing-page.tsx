export function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <a className="landing-brand" href="/" aria-label="Cook's Kitchen home">
          <span className="landing-brand-mark">CK</span>
          <span>Cook&apos;s Kitchen</span>
        </a>
        <div className="landing-nav-actions">
          <a className="landing-text-link" href="/login?next=/">Sign in</a>
          <a className="landing-button small" href="/login?mode=signup&next=/">Create your kitchen</a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">A SHARED DINNER PLAN FOR REAL LIFE</p>
          <h1>Spend less time deciding what&apos;s for dinner.</h1>
          <p className="landing-lede">
            Cook&apos;s Kitchen gives your household one simple place to keep favorite recipes, plan the week or month, and make dinner decisions together.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-button" href="/login?mode=signup&next=/">Start your kitchen</a>
            <a className="landing-secondary-button" href="/login?next=/">I already have an account</a>
          </div>
          <p className="landing-fine-print">Free to get started. Google sign-in makes setup quick.</p>
        </div>

        <div className="landing-preview" aria-label="Example weekly dinner plan">
          <div className="landing-preview-top">
            <div>
              <p className="eyebrow">THE PLAN</p>
              <h2>This week</h2>
            </div>
            <div className="landing-preview-toggle"><span className="active">Week</span><span>Month</span></div>
          </div>
          <div className="landing-preview-grid">
            <div className="landing-day-card planned"><span>MON</span><strong>Chicken enchiladas</strong><small>From your recipe bank</small></div>
            <div className="landing-day-card planned"><span>TUE</span><strong>Eating out</strong><small>No cooking tonight</small></div>
            <div className="landing-day-card planned"><span>WED</span><strong>Blackened ranch chicken</strong><small>30 min total</small></div>
            <div className="landing-day-card"><span>THU</span><strong>Not planned yet</strong><small>Choose a dinner</small></div>
          </div>
        </div>
      </section>

      <section className="landing-how">
        <div className="landing-section-heading">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>Simple enough to actually use every week.</h2>
        </div>
        <div className="landing-feature-grid">
          <article>
            <span className="landing-step">1</span>
            <h3>Save your go-to recipes</h3>
            <p>Add recipes manually or paste a recipe link and let Cook&apos;s Kitchen pull in the useful details.</p>
          </article>
          <article>
            <span className="landing-step">2</span>
            <h3>Build the plan</h3>
            <p>Plan dinner by week or month. Choose recipes, leftovers, eating out, or leave a night open.</p>
          </article>
          <article>
            <span className="landing-step">3</span>
            <h3>Share one household</h3>
            <p>Invite the people you cook with so everyone sees the same recipes and the same dinner plan.</p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <p className="eyebrow">YOUR KITCHEN, YOUR PLAN</p>
        <h2>Make dinner planning one less thing to think about.</h2>
        <p>Create your household, give your kitchen a name, and start with the meals you already love.</p>
        <a className="landing-button" href="/login?mode=signup&next=/">Create your kitchen</a>
      </section>

      <footer className="landing-footer">
        <strong>Cook&apos;s Kitchen</strong>
        <span>Shared meal planning for households.</span>
      </footer>
    </main>
  );
}
