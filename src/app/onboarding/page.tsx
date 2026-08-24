import { redirect } from "next/navigation";
import { createHousehold, logout } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function OnboardingPage({ searchParams }: Props) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/");

  const params = await searchParams;

  return (
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="onboarding-icon">🍳</div>
        <p className="eyebrow">ONE QUICK SETUP</p>
        <h1>Name your kitchen</h1>
        <p>This is the shared space where your family&apos;s recipes, weekly plan, and grocery list will live.</p>
        {params.error && <div className="form-alert error">{params.error}</div>}
        <form className="stack-form">
          <label>
            Household name
            <input name="name" defaultValue="Cook Family" required />
          </label>
          <div className="timezone-note">
            <strong>Central Time</strong>
            <span>America/Chicago · handles CST and CDT automatically</span>
          </div>
          <button className="primary wide" formAction={createHousehold}>Create our kitchen</button>
        </form>
        <form action={logout}><button className="text-button">Sign out</button></form>
      </section>
    </main>
  );
}
