"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { saveImportedRecipe } from "@/app/recipes/import/actions";
import { previewRecipeImport, type ImportPreviewState } from "@/app/recipes/import/preview-action";
import { PasteButton } from "@/components/paste-button";
import { SubmitButton } from "@/components/submit-button";
import { CHATGPT_PRIVATE_MESSAGE, detectImportInput, MAX_IMPORT_INPUT_CHARS, type ImportInput } from "@/lib/import-input";
import type { ImportedRecipe } from "@/lib/recipe-import-fallback";

type Props = {
  householdId: string;
  initialUrl: string;
  initialError: string;
  requestedNext: string | null;
  backHref: string;
};

type Hint = { tone: "info" | "warn"; text: string };

function hintFor(input: ImportInput): Hint {
  switch (input.kind) {
    case "empty":
      return { tone: "info", text: "Paste a link to any recipe site or a ChatGPT share link, or paste the recipe text itself." };
    case "name":
      return { tone: "info", text: "Just a name? That works. Paste the whole recipe or a link to fill in the rest automatically." };
    case "text":
      return { tone: "info", text: "Recipe text: we’ll sort it into a name, ingredients and steps for you to check." };
    case "url":
      if (input.share === "chatgpt-share") return { tone: "info", text: "ChatGPT link: we’ll read the recipe from the shared conversation." };
      if (input.share === "chatgpt-private") return { tone: "warn", text: CHATGPT_PRIVATE_MESSAGE };
      if (input.share === "claude-share" || input.share === "gemini-share") return { tone: "warn", text: "Claude and Gemini links can’t be read automatically yet. Copy the recipe reply and paste the text here." };
      if (input.share === "social") return { tone: "warn", text: "Social posts can’t be read automatically. Copy the caption that has the recipe and paste it here." };
      return { tone: "info", text: "Recipe link: we’ll pull in the details from the page." };
  }
}

function pendingLabel(input: ImportInput) {
  if (input.kind === "url") return input.share === "chatgpt-share" ? "Reading ChatGPT link…" : "Reading recipe…";
  return "Reading text…";
}

export function SmartImport({ householdId, initialUrl, initialError, requestedNext, backHref }: Props) {
  const [state, formAction, pending] = useActionState<ImportPreviewState, FormData>(previewRecipeImport, { status: "idle" });
  const [input, setInput] = useState(initialUrl);
  const [dismissedNonce, setDismissedNonce] = useState<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const autoRunRef = useRef(false);
  const detected = useMemo(() => detectImportInput(input), [input]);
  const hint = hintFor(detected);

  // Links from elsewhere (/recipes/import?url=…) import once, then drop the param so a reload doesn't re-import.
  useEffect(() => {
    if (!initialUrl || autoRunRef.current) return;
    autoRunRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("url");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    const data = new FormData();
    data.set("input", initialUrl);
    startTransition(() => formAction(data));
  }, [initialUrl, formAction]);

  const readyNonce = state.status === "ready" ? state.nonce : null;
  useEffect(() => {
    if (readyNonce == null) return;
    const frame = window.requestAnimationFrame(() => reviewRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
    return () => window.cancelAnimationFrame(frame);
  }, [readyNonce]);

  function submitText(text: string) {
    const data = new FormData();
    data.set("input", text);
    startTransition(() => formAction(data));
  }

  const showReview = state.status === "ready" && state.nonce !== dismissedNonce;
  const error = state.status === "error" ? state : null;

  return (
    <>
      <form ref={formRef} className="import-url-card smart-import-card" action={formAction} aria-busy={pending || undefined}>
        <label className="smart-import-label" htmlFor="recipe-input">Recipe link or text</label>
        <textarea
          ref={textareaRef}
          id="recipe-input"
          name="input"
          className="smart-import-input"
          rows={3}
          value={input}
          maxLength={MAX_IMPORT_INPUT_CHARS}
          onChange={(event) => setInput(event.target.value)}
          placeholder={"https://www.example.com/favorite-recipe\n…or paste the whole recipe here"}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          onKeyDown={(event) => {
            // Enter submits a single link; Shift+Enter (or any text with line breaks) adds a new line.
            if (event.key === "Enter" && !event.shiftKey && detected.kind === "url" && !input.includes("\n")) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          disabled={pending}
        />
        <p className={`smart-import-hint ${hint.tone}`} aria-live="polite">{hint.text}</p>
        <div className="smart-import-actions">
          <PasteButton
            label="Paste & import"
            disabled={pending}
            onText={(text) => {
              setInput(text);
              submitText(text);
            }}
          />
          <button className="primary smart-import-submit" type="submit" disabled={pending || detected.kind === "empty"} aria-busy={pending || undefined}>
            {pending ? pendingLabel(detected) : "Import recipe"}
          </button>
        </div>
        <p className="import-helper">From ChatGPT: open the chat, tap Share → Copy link, and paste it here. Or copy the recipe reply itself. You’ll always review everything before it’s saved.</p>
      </form>

      {(initialError && state.status === "idle") && <div className="form-alert error import-alert" role="alert">{initialError}</div>}

      {error && (
        <div className="form-alert error import-alert" role="alert">
          <span>{error.message}</span>
          {error.pasteTip && (
            <span className="import-alert-tip">
              Tip: open the recipe, select the ingredients and steps, copy them, then come back and paste. Or <Link href={backHref}>add it by hand</Link>.
            </span>
          )}
        </div>
      )}

      {showReview && state.status === "ready" && (
        <div ref={reviewRef} className="import-review-anchor">
          <ImportReview
            key={state.nonce}
            recipe={state.recipe}
            origin={state.origin}
            householdId={householdId}
            requestedNext={requestedNext}
            backHref={backHref}
            onStartOver={() => {
              setDismissedNonce(state.nonce);
              setInput("");
              window.requestAnimationFrame(() => textareaRef.current?.focus());
            }}
          />
        </div>
      )}
    </>
  );
}

type ReviewProps = {
  recipe: ImportedRecipe;
  origin: "web" | "chatgpt" | "text" | "name";
  householdId: string;
  requestedNext: string | null;
  backHref: string;
  onStartOver: () => void;
};

function reviewTitle(recipe: ImportedRecipe, origin: ReviewProps["origin"]) {
  if (origin === "chatgpt") return "Recipe from ChatGPT";
  if (origin === "text") return recipe.structured ? "Recipe from your text" : "Text added";
  if (origin === "name") return "Start with the basics";
  return recipe.structured ? "Recipe found" : "Page basics found";
}

export function ImportReview({ recipe, origin, householdId, requestedNext, backHref, onStartOver }: ReviewProps) {
  return (
    <section className="recipe-edit-card import-preview-card">
      <div className="form-title recipe-edit-heading">
        <div>
          <p className="eyebrow">REVIEW IMPORT</p>
          <h2>{reviewTitle(recipe, origin)}</h2>
        </div>
        <div className="inline-actions import-review-links">
          {recipe.source_url && <a className="secondary link-button" href={recipe.source_url} target="_blank" rel="noreferrer">View source ↗</a>}
          <button className="secondary" type="button" onClick={onStartOver}>Start over</button>
        </div>
      </div>

      {recipe.warnings.map((warning) => (
        <div className="form-alert import-warning" key={warning}>{warning}</div>
      ))}

      <div className="import-photo-note">
        <strong>Photos are yours.</strong>
        <span>Cook&apos;s Kitchen won&apos;t copy images from other sites. After saving, you can upload your own photo of the dish.</span>
      </div>

      <form className="recipe-edit-form" action={saveImportedRecipe}>
        <input type="hidden" name="household_id" value={householdId} />
        {requestedNext && <input type="hidden" name="next" value={requestedNext} />}
        <div className="form-grid two">
          <label>Recipe name<input name="name" defaultValue={recipe.name} required autoComplete="off" autoCapitalize="words" enterKeyHint="next" /></label>
          <label>Source URL<input name="source_url" type="url" inputMode="url" defaultValue={recipe.source_url} placeholder="Optional" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next" /></label>
        </div>
        <label>Description<textarea name="description" rows={3} defaultValue={recipe.description} /></label>
        <div className="form-grid three">
          <label>Prep minutes<input name="prep_minutes" type="number" min="0" inputMode="numeric" enterKeyHint="next" defaultValue={recipe.prep_minutes ?? ""} /></label>
          <label>Cook minutes<input name="cook_minutes" type="number" min="0" inputMode="numeric" enterKeyHint="next" defaultValue={recipe.cook_minutes ?? ""} /></label>
          <label>Servings<input name="servings" type="number" min="0.5" step="0.5" inputMode="decimal" enterKeyHint="next" defaultValue={recipe.servings ?? ""} /></label>
        </div>
        <div className="form-grid two">
          <label><span className="field-label">Tags <span className="field-hint">(comma-separated)</span></span><input name="tags" defaultValue={recipe.tags.join(", ")} placeholder="quick, mexican, freezer" autoComplete="off" autoCapitalize="none" enterKeyHint="next" /></label>
          <label><span className="field-label">Dietary tags <span className="field-hint">(comma-separated)</span></span><input name="dietary_tags" defaultValue={recipe.dietary_tags.join(", ")} placeholder="gluten-free, dairy-free" autoComplete="off" autoCapitalize="none" enterKeyHint="next" /></label>
        </div>
        <div className="form-grid two recipe-long-fields">
          <label><span className="field-label">Ingredients <span className="field-hint">(one per line)</span></span><textarea name="ingredients" rows={14} defaultValue={recipe.ingredients.join("\n")} placeholder="One ingredient per line" /></label>
          <label><span className="field-label">Instructions <span className="field-hint">(one step per line)</span></span><textarea name="instructions" rows={14} defaultValue={recipe.instructions.join("\n")} placeholder="One step per line" /></label>
        </div>
        <div className="form-footer recipe-edit-footer sticky-save-bar">
          <label className="favorite-check"><input type="checkbox" name="is_favorite" /> ⭐ Family favorite</label>
          <div className="inline-actions">
            <Link className="secondary link-button" href={backHref}>Cancel</Link>
            <SubmitButton className="primary" pendingLabel="Saving…">{requestedNext ? "Save & return to setup" : "Save to recipe bank"}</SubmitButton>
          </div>
        </div>
      </form>
    </section>
  );
}
