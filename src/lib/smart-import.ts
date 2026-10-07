import { cleanChatTitle, decodeChatGptShareHtml, pickRecipeMessage } from "@/lib/chatgpt-share";
import { CHATGPT_PRIVATE_MESSAGE, detectImportInput, PASTE_GUIDANCE, type ImportInput } from "@/lib/import-input";
import { extractRecipeFromUrl, type ImportedRecipe } from "@/lib/recipe-import-fallback";
import { fetchPageHtml } from "@/lib/recipe-import";
import { parseRecipeText } from "@/lib/recipe-text-parser";

/** An import problem the person can fix by pasting the recipe text instead. */
export class PasteInsteadError extends Error {
  readonly pasteInstead = true;
}

export type SmartImportResult = {
  recipe: ImportedRecipe;
  origin: "web" | "chatgpt" | "text" | "name";
};

function inferDietaryTags(text: string) {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (/gluten[- ]free/.test(lower)) tags.push("gluten-free");
  if (/dairy[- ]free/.test(lower)) tags.push("dairy-free");
  if (/\bvegan\b/.test(lower)) tags.push("vegan");
  if (/\bvegetarian\b/.test(lower)) tags.push("vegetarian");
  if (/\bketo\b/.test(lower)) tags.push("keto");
  return tags;
}

/** Turns parsed text into the same shape the URL importer produces, for the shared review form. */
export function recipeFromText(text: string, options: { sourceUrl?: string; fallbackName?: string; warning?: string } = {}): ImportedRecipe {
  const parsed = parseRecipeText(text);
  const warnings: string[] = [];
  if (options.warning) warnings.push(options.warning);

  let instructions = parsed.instructions;
  if (!parsed.found) {
    // No list structure at all: keep the paragraphs as steps so nothing is lost, and say so.
    instructions = text
      .split(/\n\s*\n/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .filter((block) => block.length > 20 && block !== parsed.name);
    warnings.push("We couldn’t spot a separate ingredient list. Move the ingredients into their own box before saving.");
  } else {
    if (!parsed.ingredients.length) warnings.push("No ingredients were found. Add them before saving.");
    if (!parsed.instructions.length) warnings.push("No steps were found. Add them before saving.");
  }

  const name = parsed.name || options.fallbackName || "";
  if (!name) warnings.push("Give this recipe a name before saving.");

  return {
    source_url: options.sourceUrl ?? "",
    name: name || "Untitled recipe",
    description: parsed.description,
    image_url: "",
    prep_minutes: parsed.prep_minutes,
    cook_minutes: parsed.cook_minutes ?? (parsed.prep_minutes == null ? parsed.total_minutes : null),
    servings: parsed.servings,
    ingredients: parsed.ingredients,
    instructions,
    tags: [],
    dietary_tags: inferDietaryTags(`${name} ${parsed.description}`),
    structured: parsed.found,
    warnings,
  };
}

export async function importFromChatGptShare(url: string): Promise<ImportedRecipe> {
  let html: string;
  try {
    ({ html } = await fetchPageHtml(url, { timeoutMs: 10_000 }));
  } catch {
    throw new PasteInsteadError(`We couldn’t open that ChatGPT link. Make sure it’s a shared link (Share → Copy link), or ${PASTE_GUIDANCE.charAt(0).toLowerCase()}${PASTE_GUIDANCE.slice(1)}`);
  }

  let message: ReturnType<typeof pickRecipeMessage> = null;
  let title = "";
  try {
    const decoded = decodeChatGptShareHtml(html);
    title = cleanChatTitle(decoded.title);
    message = pickRecipeMessage(decoded.messages);
  } catch {
    message = null;
  }
  if (!message) {
    throw new PasteInsteadError(`We couldn’t find a recipe in that ChatGPT conversation. In ChatGPT, copy the recipe reply and paste it here.`);
  }

  const recipe = recipeFromText(message.text, {
    sourceUrl: url,
    fallbackName: title,
    warning: "Read from a shared ChatGPT conversation. Double-check amounts and steps before saving.",
  });
  // Generic page titles ("Recipe Generator") make poor names when the reply had a better one.
  if (recipe.name === "Untitled recipe" && title) recipe.name = title;
  return recipe;
}

export async function importFromDetected(input: ImportInput): Promise<SmartImportResult> {
  switch (input.kind) {
    case "empty":
      throw new Error("Paste a recipe link or the recipe text first.");
    case "name":
      return {
        origin: "name",
        recipe: {
          source_url: "",
          name: input.name,
          description: "",
          image_url: "",
          prep_minutes: null,
          cook_minutes: null,
          servings: null,
          ingredients: [],
          instructions: [],
          tags: [],
          dietary_tags: [],
          structured: false,
          warnings: ["That looks like just a name. Add the ingredients and steps below, or paste the whole recipe instead."],
        },
      };
    case "text":
      return { origin: "text", recipe: recipeFromText(input.text, { warning: "Read from pasted text. Double-check amounts and steps before saving." }) };
    case "url":
      if (input.share === "chatgpt-private") throw new PasteInsteadError(CHATGPT_PRIVATE_MESSAGE);
      if (input.share === "claude-share" || input.share === "gemini-share") {
        const app = input.share === "claude-share" ? "Claude" : "Gemini";
        throw new PasteInsteadError(`${app} share links can’t be read automatically yet. In ${app}, copy the recipe reply and paste the text here.`);
      }
      if (input.share === "social") {
        throw new PasteInsteadError("Social media posts can’t be read automatically. Copy the caption or description that has the recipe and paste it here.");
      }
      if (input.share === "chatgpt-share") return { origin: "chatgpt", recipe: await importFromChatGptShare(input.url) };
      return { origin: "web", recipe: await extractRecipeFromUrl(input.url) };
  }
}

export function importRecipeFromInput(raw: string) {
  return importFromDetected(detectImportInput(raw));
}
