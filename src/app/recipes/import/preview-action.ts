"use server";

import { MAX_IMPORT_INPUT_CHARS, detectImportInput } from "@/lib/import-input";
import type { ImportedRecipe } from "@/lib/recipe-import-fallback";
import { PasteInsteadError, importFromDetected, type SmartImportResult } from "@/lib/smart-import";
import { createClient } from "@/lib/supabase/server";

export type ImportPreviewState =
  | { status: "idle" }
  | { status: "error"; message: string; pasteTip: boolean; nonce: number }
  | { status: "ready"; recipe: ImportedRecipe; origin: SmartImportResult["origin"]; nonce: number };

/**
 * Reads a link or pasted text and returns the recipe for the review form. Runs as a POST
 * (server action) so pasted text never lands in the URL, and reloading doesn't re-import.
 */
export async function previewRecipeImport(_previous: ImportPreviewState, formData: FormData): Promise<ImportPreviewState> {
  const nonce = Date.now();
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) {
    return { status: "error", message: "Please sign in again, then retry the import.", pasteTip: false, nonce };
  }

  const raw = typeof formData.get("input") === "string" ? String(formData.get("input")) : "";
  const detected = detectImportInput(raw.slice(0, MAX_IMPORT_INPUT_CHARS));
  if (detected.kind === "empty") {
    return { status: "error", message: "Paste a recipe link or the recipe text first.", pasteTip: false, nonce };
  }

  try {
    const result = await importFromDetected(detected);
    return { status: "ready", recipe: result.recipe, origin: result.origin, nonce };
  } catch (error) {
    if (error instanceof PasteInsteadError) return { status: "error", message: error.message, pasteTip: true, nonce };
    const message = error instanceof Error && error.message ? error.message : "Cook’s Kitchen couldn’t import that recipe.";
    return { status: "error", message, pasteTip: detected.kind === "url", nonce };
  }
}
