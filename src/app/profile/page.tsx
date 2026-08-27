import { redirect } from "next/navigation";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

type Props = {
  searchParams: Promise<{ message?: string; error?: string }>;
};

function safeAvatarUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;

    let avatarUrl = url.toString();
    if (url.hostname.endsWith("googleusercontent.com")) {
      avatarUrl = avatarUrl.replace(/=s\d+(?:-c)?(?:-[a-z0-9-]+)?$/i, "=s256");
    }
    return avatarUrl;
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
  let householdMemberCount = 0;
  if (membership?.household_id) {
    const [{ data: household }, { count }] = await Promise.all([
      supabase.from("households").select("name").eq("id", membership.household_id).maybeSingle(),
      supabase.from("household_members").select("user_id", { count: "exact", head: true }).eq("household_id", membership.household_id),
    ]);
    householdName = household?.name ?? null;
    householdMemberCount = count ?? 0;
  }

  const metadata = user.user_metadata ?? {};
  const displayName = profile?.display_name ?? metadata.display_name ?? metadata.full_name ?? metadata.name ?? "Cook";
  const avatarUrl = safeAvatarUrl(metadata.avatar_url) ?? safeAvatarUrl(metadata.picture);
  const providers = Array.isArray(user.app_metadata?.providers)
    ? user.app_metadata.providers.filter((provider): provider is string => typeof provider === "string")
    : typeof user.app_metadata?.provider === "string"
      ? [user.app_metadata.provider]
      : [];
  const hasEmailPassword = providers.includes("email");
  const isSharedOwner = membership?.role === "owner" && householdMemberCount > 1;
  const deletionConsequence = membership?.role === "owner"
    ? "Because you are the only member, this will also permanently delete this household, its recipes, and its meal plan."
    : householdName
      ? "Your login and household access will be removed, but the shared household, recipes, and meal plan will remain for the other members."
      : "Your Cook's Kitchen account and profile will be permanently deleted.";

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
            <div className="profile-account-actions">
              {householdName && <a className="secondary link-button wide profile-household-link" href="/household">Manage household</a>}
              {hasEmailPassword && <a className="secondary link-button wide" href={`/forgot-password?email=${encodeURIComponent(user.email ?? "")}`}>Reset password</a>}
            </div>
          </section>
        </div>

        <section className="profile-card profile-danger-zone">
          <div className="profile-danger-copy">
            <p className="eyebrow">ACCOUNT DELETION</p>
            <h2>Delete account</h2>
            {isSharedOwner ? (
              <p>You own a shared household with other members. To protect everyone&apos;s recipes and meal plan, transfer ownership to another member before deleting your account.</p>
            ) : (
              <p>{deletionConsequence} This cannot be undone.</p>
            )}
          </div>
          {isSharedOwner ? (
            <a className="secondary link-button profile-transfer-link" href="/household">Transfer ownership →</a>
          ) : (
            <DeleteAccountForm consequence={deletionConsequence} />
          )}
        </section>

        <div className="profile-legal-links">
          <a href="/privacy">Privacy</a>
          <span>·</span>
          <a href="/terms">Terms</a>
        </div>
      </div>
    </main>
  );
}
