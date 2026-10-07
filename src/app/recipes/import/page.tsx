import Link from "next/link";
import { redirect } from "next/navigation";
import { SmartImport } from "@/components/smart-import";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Props = {
  searchParams: Promise<{ url?: string | string[]; error?: string | string[]; next?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localPathOrNull(value: string | undefined) {
  const path = value?.trim() ?? "";
  return path.startsWith("/") && !path.startsWith("//") ? path : null;
}

export default async function ImportRecipePage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/login?next=/recipes/import");

  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");

  const { data: household } = await supabase
    .from("households")
    .select("name")
    .eq("id", membership.household_id)
    .maybeSingle();

  const requestedUrl = first(params.url)?.trim() ?? "";
  const requestedNext = localPathOrNull(first(params.next));
  const backHref = requestedNext ?? "/?section=recipes";
  const initialError = first(params.error) ?? "";

  return (
    <main className="recipe-detail-shell import-recipe-shell">
      <div className="recipe-detail-nav">
        <Link className="back-link" href={backHref}>{requestedNext ? "← Back to setup" : "← Recipe bank"}</Link>
        <span>{household?.name ?? "Shared household"}</span>
      </div>

      <header className="import-heading">
        <div>
          <p className="eyebrow">ADD A RECIPE FASTER</p>
          <h1>Import a recipe</h1>
          <p>Paste a link to a recipe site or a ChatGPT share link, or paste the recipe text itself. You&apos;ll review everything before it&apos;s saved.</p>
        </div>
      </header>

      <SmartImport
        householdId={membership.household_id}
        initialUrl={requestedUrl}
        initialError={initialError}
        requestedNext={requestedNext}
        backHref={backHref}
      />
    </main>
  );
}
