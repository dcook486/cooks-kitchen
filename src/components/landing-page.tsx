export function LandingPage() {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <div className="landing-nav-actions">
          <a className="landing-text-link" href="/login?next=/">Sign in</a>
          <a className="landing-button small" href="/login?mode=signup&next=/">Create your kitchen</a>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker"><span aria-hidden="true">♥</span> Plan together. Eat together.</p>
          <h1>A calmer way to answer <em>what&apos;s for dinner?</em></h1>
          <p className="landing-lede">
            Keep the recipes your household loves, build a dinner plan for the week or month, and give everyone one shared place to see what&apos;s coming.
          </p>
          <div className="landing-hero-actions">
            <a className="landing-button" href="/login?mode=signup&next=/">Start your kitchen</a>
            <a className="landing-secondary-button" href="/login?next=/">I already have an account</a>
          </div>
          <div className="landing-proof" aria-label="Cook's Kitchen highlights">
            <span>Shared household</span>
            <span>Week + month planning</span>
            <span>Your recipe bank</span>
          </div>
        </div>

        <div className="landing-preview-wrap">
          <div className="landing-preview-accent landing-preview-accent-one" aria-hidden="true" />
          <div className="landing-preview-accent landing-preview-accent-two" aria-hidden="true" />
          <div className="landing-preview" aria-label="Example weekly dinner plan">
            <div className="landing-preview-top">
              <div className="landing-preview-title">
                <span className="landing-preview-mini-mark" aria-hidden="true"><img src="/cooks-kitchen-circle-v2.webp" alt="" /></span>
                <div>
                  <p className="eyebrow">THE PLAN</p>
                  <h2>This week</h2>
                </div>
              </div>
              <div className="landing-preview-toggle"><span className="active">Week</span><span>Month</span></div>
            </div>
            <div className="landing-preview-grid">
              <div className="landing-day-card planned"><span>MON</span><strong>Chicken enchiladas</strong><small>From your recipe bank</small></div>
              <div className="landing-day-card planned"><span>TUE</span><strong>Eating out</strong><small>No cooking tonight</small></div>
              <div className="landing-day-card planned featured"><span>WED</span><strong>Blackened ranch chicken</strong><small>30 min total</small></div>
              <div className="landing-day-card"><span>THU</span><strong>Not planned yet</strong><small>Choose a dinner</small></div>
            </div>
            <div className="landing-preview-bottom">
              <span>One plan for the whole household</span>
              <span className="landing-preview-heart" aria-hidden="true">♥</span>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-how">
        <div className="landing-section-heading">
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>Built around the way families actually plan dinner.</h2>
          <p>Start with what you already cook. Plan only as far ahead as you want. Keep the whole household on the same page.</p>
        </div>
        <div className="landing-feature-grid">
          <article>
            <span className="landing-step">01</span>
            <h3>Keep the recipes you love</h3>
            <p>Build a simple family recipe bank. Add recipes yourself or paste a link and pull in the useful details.</p>
          </article>
          <article>
            <span className="landing-step">02</span>
            <h3>Make the plan</h3>
            <p>Choose dinners by week or month, including recipes, leftovers, eating out, or an intentionally open night.</p>
          </article>
          <article>
            <span className="landing-step">03</span>
            <h3>Share your kitchen</h3>
            <p>Invite the people you cook with so the recipe bank and dinner plan belong to the household, not one person.</p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <img
          className="landing-cta-badge"
          src="/cooks-kitchen-circle-v2.webp"
          alt=""
          aria-hidden="true"
        />
        <p className="eyebrow">YOUR KITCHEN, YOUR PLAN</p>
        <h2>Make dinner planning one less thing to think about.</h2>
        <p>Create your household, give your kitchen a name, and start with the meals you already love.</p>
        <a className="landing-button" href="/login?mode=signup&next=/">Create your kitchen</a>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <img src="/cooks-kitchen-circle-v2.webp" alt="" aria-hidden="true" />
          <strong>Cook&apos;s Kitchen</strong>
        </div>
        <span>Plan together. Eat together.</span>
      </footer>
    </main>
  );
}
