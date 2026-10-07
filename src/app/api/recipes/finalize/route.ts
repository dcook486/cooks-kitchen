import { revalidatePath } from "next/cache";
import { deleteRecipeById, removeRecipePhotoById, UUID_PATTERN } from "@/lib/recipe-mutations";
import { createClient } from "@/lib/supabase/server";

/**
 * Finalizes an undoable recipe action (delete recipe / remove photo) when the page is being left
 * before the undo window ends. Called with fetch(..., { keepalive: true }) from the browser.
 * Same-origin JSON only; Supabase RLS still limits changes to the user's own household.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin) {
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = "";
    }
    if (!host || originHost !== host) return Response.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return Response.json({ ok: false, error: "Unsupported content type" }, { status: 415 });
  }

  let body: { kind?: unknown; id?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id : "";
  const kind = body.kind;
  if (!UUID_PATTERN.test(id) || (kind !== "delete_recipe" && kind !== "remove_photo")) {
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !data?.claims?.sub) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  try {
    if (kind === "delete_recipe") await deleteRecipeById(supabase, id);
    else await removeRecipePhotoById(supabase, id);
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Could not finish that change." }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath(`/recipes/${id}`);
  return Response.json({ ok: true });
}
