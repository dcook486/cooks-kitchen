import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RecipesIndexPage() {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) {
    redirect(`/login?next=${encodeURIComponent("/?section=recipes")}`);
  }

  redirect("/?section=recipes");
}
