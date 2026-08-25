import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

type Props = {
  searchParams: Promise<{ message?: string; error?: string }>;
};

function safeAvatarUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CK";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function providerLabel(provider: string) {
  if (provider === "google") return "Google";
  if (provider === "email") return "Email & password";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}

export default async function ProfilePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user) redirect("/login?next=/profile");

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("household_members").select("role, household_id").eq("user_id", user.id).limit(1).maybeSingle(),
  ]);

  let householdName: string | null = null;
  if (membership?.household_id) {
    const { data: household } = await supabase.from("households").select("name").eq("id", membership.household_id).maybeSingle();
    householdName = household?.name ?? null;
  }

  const metadata = user.user_metadata ?? {};
  const displayName = profile?.display_name ?? metadata.display_name ?? metadata.full_name ?? metadata.name ?? "Cook";
  const avatarUrl = safeAvatarUrl(metadata.avatar_url) ?? safeAvatarUrl(metadata.picture);
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
    : typeof user.app_metadata?.provider === "string"
      ? [user.app_metadata.provider]
      : [];

  return (
    <main className="profile-page">
      <div className="profile-shell">
        <a className="profile-back" href="/">← Back to Cook&apos;s Kitchen</a>

        <section className="profile-card profile-hero">
          <span
            className={`profile-avatar-large ${avatarUrl ? "has-image" : ""}`}
            style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            aria-hidden="true"
          >
            {!avatarUrl && initialsFor(String(displayName))}
          </span>
          <div>
            <p className="eyebrow">YOUR ACCOUNT</p>
            <h1>{displayName}</h1>
            <p>{user.email}</p>
          </div>
        </section>

        {params.error && <div className="form-alert error profile-alert">{params.error}</div>}
        {params.message && <div className="form-alert success profile-alert">{params.message}</div>}

        <div className="profile-grid">
          <section className="profile-card">
            <p className="eyebrow">PROFILE</p>
            <h2>How you appear</h2>
            <p className="profile-section-copy">This name is shown to the people in your shared household.</p>

            <form action={updateProfile} className="stack-form profile-form">
              <label>
                Display name
                <input name="display_name" defaultValue={String(displayName)} maxLength={60} autoComplete="name" required />
              </label>
              <button className="primary" type="submit">Save changes</button>
            </form>
          </section>

          <section className="profile-card">
            <p className="eyebrow">ACCOUNT</p>
            <h2>Sign-in details</h2>
            <dl className="profile-details">
              <div>
                <dt>Email</dt>
                <dd>{user.email ?? "Not available"}</dd>
              </div>
              <div>
                <dt>Sign-in methods</dt>
                <dd>{providers.length ? providers.map(providerLabel).join(" · ") : "Email account"}</dd>
              </div>
              <div>
                <dt>Household</dt>
                <dd>{householdName ?? "No household"}{membership?.role ? ` · ${membership.role === "owner" ? "Owner" : "Member"}` : ""}</dd>
              </div>
            </dl>
            {householdName && <a className="secondary link-button wide profile-household-link" href="/?section=household">Manage household</a>}
          </section>
        </div>
      </div>
    </main>
  );
}
