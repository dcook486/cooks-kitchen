import { redirect } from "next/navigation";
import { login, signup } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Props = {
  searchParams: Promise<{ error?: string; message?: string; mode?: string }>;
};

export default async function LoginPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.sub) redirect("/");

  const params = await searchParams;
  const signupMode = params.mode === "signup";

  return (
    <main className="auth-page">
      <section className="auth-brand">
        <p className="eyebrow">A SHARED TABLE FOR YOUR FAMILY</p>
        <h1>Cook&apos;s Kitchen</h1>
        <p className="auth-lede">
          Keep your go-to recipes, plan dinner together, and turn the week into one simple grocery list.
        </p>
        <div className="auth-preview" aria-hidden="true">
          <div><span>Mon</span><strong>Chicken enchiladas</strong></div>
          <div><span>Tue</span><strong>Sheet-pan salmon</strong></div>
          <div><span>Wed</span><strong>Taco bowls</strong></div>
        </div>
      </section>

      <section className="auth-card">
        <p className="eyebrow">{signupMode ? "CREATE YOUR KITCHEN" : "WELCOME BACK"}</p>
        <h2>{signupMode ? "Start cooking together" : "Sign in"}</h2>
        <p className="auth-subcopy">
          {signupMode ? "Create your account first. We’ll set up your shared household next." : "Pick up where you left off."}
        </p>

        {params.error && <div className="form-alert error">{params.error}</div>}
        {params.message && <div className="form-alert success">{params.message}</div>}

        <form className="stack-form">
          {signupMode && (
            <label>
              Your name
              <input name="display_name" autoComplete="name" placeholder="David" required />
            </label>
          )}
          <label>
            Email
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete={signupMode ? "new-password" : "current-password"} minLength={8} required />
          </label>
          <button className="primary wide" formAction={signupMode ? signup : login}>
            {signupMode ? "Create account" : "Sign in"}
          </button>
        </form>

        <a className="auth-switch" href={signupMode ? "/login" : "/login?mode=signup"}>
          {signupMode ? "Already have an account? Sign in" : "New here? Create an account"}
        </a>
      </section>
    </main>
  );
}
