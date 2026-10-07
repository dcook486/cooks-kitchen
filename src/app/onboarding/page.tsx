import Link from "next/link";
import { redirect } from "next/navigation";
import { addRecipe, logout, saveDinnerPlan } from "@/app/actions";
import { OnboardingHouseholdForm } from "@/components/onboarding-household-form";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ error?: string; step?: string }> };

type Recipe = {
  id: string;
  name: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
};

function localIsoDate(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function familyDefaults(displayName: string) {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const familyName = parts.length > 1 ? parts.at(-1)! : parts[0] ?? "My";
  const possessive = familyName.endsWith("s") ? `${familyName}'` : `${familyName}'s`;
  return {
    householdName: familyName === "My" ? "My Family" : `${familyName} Family`,
    kitchenName: familyName === "My" ? "My Kitchen" : `${possessive} Kitchen`,
  };
}

function Progress({ active }: { active: 1 | 2 | 3 }) {
  const steps = [
    { number: 1, label: "Your kitchen" },
    { number: 2, label: "Recipes" },
    { number: 3, label: "First dinner" },
  ] as const;

  return (
    <div className="onboarding-progress" aria-label={`Setup step ${active} of 3`}>
      {steps.map((step) => (
        <div className={`onboarding-progress-step ${step.number === active ? "active" : ""} ${step.number < active ? "done" : ""}`} key={step.number}>
          <span>{step.number < active ? "✓" : step.number}</span>
          <strong>{step.label}</strong>
        </div>
      ))}
    </div>
  );
}

function BrandMark() {
  return (
    <div className="onboarding-brand-mark">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/cooks-kitchen-circle-v2.webp" alt="" />
    </div>
  );
}

export default async function OnboardingPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/login");

  const params = await searchParams;
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const [{ data: userData }, { data: profile }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
    ]);
    const metadata = userData.user?.user_metadata ?? {};
    const displayName = String(profile?.display_name ?? metadata.display_name ?? metadata.full_name ?? metadata.name ?? "My");
    const defaults = familyDefaults(displayName);

    return (
      <main className="onboarding-page onboarding-refresh-page">
        <section className="onboarding-flow">
          <BrandMark />
          <Progress active={1} />
          <div className="onboarding-card onboarding-refresh-card">
            <div className="onboarding-copy-block">
              <p className="eyebrow">WELCOME TO COOK&apos;S KITCHEN</p>
              <h1>Make it yours.</h1>
              <p>Start with the name your household will see every time you open the kitchen. This takes about a minute.</p>
            </div>
            {params.error && <div className="form-alert error">{params.error}</div>}
            <OnboardingHouseholdForm defaultHouseholdName={defaults.householdName} defaultKitchenName={defaults.kitchenName} />
          </div>
          <form action={logout} className="onboarding-signout"><button className="text-button" type="submit">Sign out</button></form>
        </section>
      </main>
    );
  }

  const step = params.step === "plan" ? "plan" : params.step === "recipes" ? "recipes" : null;
  if (!step) redirect("/");

  const [{ data: household }, { data: recipeRows }] = await Promise.all([
    supabase.from("households").select("id, name, kitchen_name, timezone").eq("id", membership.household_id).maybeSingle(),
    supabase
      .from("recipes")
      .select("id, name, prep_minutes, cook_minutes")
      .eq("household_id", membership.household_id)
      .order("created_at", { ascending: true }),
  ]);

  if (!household) redirect("/");
  const recipes = (recipeRows ?? []) as Recipe[];

  if (step === "recipes") {
    const target = 3;
    const filled = Math.min(recipes.length, target);
    const nextAfterImport = "/onboarding?step=recipes";

    return (
      <main className="onboarding-page onboarding-refresh-page">
        <section className="onboarding-flow">
          <BrandMark />
          <Progress active={2} />
          <div className="onboarding-card onboarding-refresh-card onboarding-wide-card">
            <div className="onboarding-copy-block">
              <p className="eyebrow">BUILD YOUR STARTER RECIPE BANK</p>
              <h1>Add a few favorites.</h1>
              <p>Two or three go-to meals are enough to make your first plan feel useful. Add names quickly or import a full recipe from a link.</p>
            </div>

            <div className="onboarding-recipe-progress">
              <div>
                <strong>{recipes.length} {recipes.length === 1 ? "recipe" : "recipes"} added</strong>
                <span>{recipes.length >= target ? "Great start — you can always add more later." : `A starter set of ${target} works well.`}</span>
              </div>
              <div className="onboarding-recipe-dots" aria-label={`${filled} of ${target} suggested starter recipes added`}>
                {Array.from({ length: target }, (_, index) => <span className={index < filled ? "filled" : ""} key={index} />)}
              </div>
            </div>

            {recipes.length > 0 && (
              <div className="onboarding-added-recipes">
                {recipes.slice(-5).map((recipe) => {
                  const total = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
                  return (
                    <div key={recipe.id}>
                      <span aria-hidden="true">✓</span>
                      <strong>{recipe.name}</strong>
                      <small>{total ? `${total} min` : "Added"}</small>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="onboarding-recipe-options">
              <form className="onboarding-quick-recipe" action={addRecipe}>
                <input type="hidden" name="household_id" value={household.id} />
                <input type="hidden" name="next" value="/onboarding?step=recipes" />
                <div>
                  <p className="eyebrow">QUICK ADD</p>
                  <h2>Just add the name</h2>
                  <p>Perfect for a meal you already know by heart. Fill in the details whenever you want.</p>
                </div>
                <label>
                  Recipe name
                  <div className="onboarding-inline-input">
                    <input name="name" placeholder="Taco bowls" required autoComplete="off" />
                    <SubmitButton className="primary" pendingLabel="Adding…">Add</SubmitButton>
                  </div>
                </label>
              </form>

              <div className="onboarding-import-option">
                <div>
                  <p className="eyebrow">IMPORT FROM THE WEB</p>
                  <h2>Have a recipe link?</h2>
                  <p>Paste the URL and Cook&apos;s Kitchen will pull in ingredients, instructions, timing, and servings for you.</p>
                </div>
                <Link className="secondary link-button wide" href={`/recipes/import?next=${encodeURIComponent(nextAfterImport)}`}>Import a recipe →</Link>
              </div>
            </div>

            <div className="onboarding-step-footer">
              <span>{recipes.length ? "You can keep adding, or move on when you're ready." : "No pressure — you can also skip this and add recipes later."}</span>
              <Link className="primary link-button" href="/onboarding?step=plan">{recipes.length ? "Continue to first dinner →" : "Skip to planning →"}</Link>
            </div>
          </div>
          <Link className="onboarding-skip-link" href="/">Skip setup and explore Cook&apos;s Kitchen</Link>
        </section>
      </main>
    );
  }

  const today = localIsoDate(household.timezone || "America/Chicago");

  return (
    <main className="onboarding-page onboarding-refresh-page">
      <section className="onboarding-flow">
        <BrandMark />
        <Progress active={3} />
        <div className="onboarding-card onboarding-refresh-card">
          <div className="onboarding-copy-block">
            <p className="eyebrow">ONE LAST STEP</p>
            <h1>Put dinner on the plan.</h1>
            <p>Pick one dinner and a date. That&apos;s enough to see how your kitchen comes together.</p>
          </div>

          <form className="stack-form onboarding-first-plan" action={saveDinnerPlan}>
            <input type="hidden" name="household_id" value={household.id} />
            <input type="hidden" name="next" value="/?onboarding=complete" />
            <label>
              Dinner date
              <input type="date" name="meal_date" defaultValue={today} required />
            </label>
            <label>
              What&apos;s for dinner?
              <select name="selection" defaultValue={recipes[0] ? `recipe:${recipes[0].id}` : "eating_out"} required>
                {recipes.map((recipe) => <option key={recipe.id} value={`recipe:${recipe.id}`}>{recipe.name}</option>)}
                {recipes.length > 0 && <option disabled>──────────</option>}
                <option value="leftovers">Leftovers</option>
                <option value="eating_out">Eating out</option>
              </select>
            </label>
            <div className="onboarding-plan-preview">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Your plan starts simple.</strong>
                <p>After this, use Day, Week, or Month view to add the rest whenever you&apos;re ready.</p>
              </div>
            </div>
            <SubmitButton className="primary wide onboarding-primary" pendingLabel="Opening your kitchen…">Plan dinner &amp; open my kitchen →</SubmitButton>
          </form>

          <Link className="onboarding-skip-link inside" href="/">Skip this and open my kitchen</Link>
        </div>
      </section>
    </main>
  );
}
