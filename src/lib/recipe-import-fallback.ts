import {
  extractRecipeFromUrl as extractDirectRecipe,
  type ImportedRecipe,
} from "./recipe-import";
import { parseRecipeText } from "./recipe-text-parser";

const MAX_READER_CHARS = 1_500_000;

function validateTarget(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid recipe URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Recipe links must use http or https.");
  }
  if (url.username || url.password) throw new Error("Recipe links cannot include credentials.");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error("Recipe links must use a standard web port.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".lan") ||
    host.includes(":")
  ) {
    throw new Error("That address is not available for recipe import.");
  }

  const parts = host.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
    const numbers = parts.map(Number);
    if (numbers.some((part) => part < 0 || part > 255)) {
      throw new Error("That address is not available for recipe import.");
    }
    const [a, b] = numbers;
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    ) {
      throw new Error("That address is not available for recipe import.");
    }
  }

  url.hash = "";
  return url;
}

function shouldTryRenderedFallback(error: unknown) {
  if (!(error instanceof Error)) return true;
  const message = error.message.toLowerCase();

  if (
    message.includes("valid recipe url") ||
    message.includes("must use http") ||
    message.includes("cannot include credentials") ||
    message.includes("standard web port") ||
    message.includes("not available for recipe import") ||
    message.includes("too large") ||
    message.includes("does not appear to be a recipe webpage")
  ) {
    return false;
  }

  return (
    /returned\s+(?:4\d\d|5\d\d)/.test(message) ||
    message.includes("too long to respond") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("connection")
  );
}

function cleanMarkdown(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)(?=\[)/g, "$1 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .replace(/\\([#>*_`])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function readerMarkdown(raw: string) {
  const marker = "Markdown Content:";
  const index = raw.indexOf(marker);
  return index >= 0 ? raw.slice(index + marker.length).trim() : raw.trim();
}

function titleFromReader(raw: string, markdown: string) {
  const metadataTitle = raw.match(/^Title:\s*(.+)$/im)?.[1]?.trim();
  if (metadataTitle) return cleanMarkdown(metadataTitle);

  const headingTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return headingTitle ? cleanMarkdown(headingTitle) : "Imported recipe";
}

function headingAt(lines: string[], index: number): string | null {
  const atx = lines[index].match(/^\s*#{1,6}\s+(.+?)\s*$/);
  if (atx) return atx[1];
  // Setext headings ("Ingredients" underlined with ==== or ----), common in rendered-page markdown.
  const next = lines[index + 1];
  if (next !== undefined && lines[index].trim() && /^\s*(?:=+|-{2,})\s*$/.test(next) && !/^\s*[-*+]\s/.test(lines[index])) return lines[index].trim();
  return null;
}

function section(markdown: string, names: string[]) {
  const lines = markdown.split("\n");
  const normalizedNames = names.map((name) => name.toLowerCase());
  let start = -1;

  for (let i = 0; i < lines.length; i += 1) {
    const title = headingAt(lines, i);
    if (title === null) continue;
    const heading = cleanMarkdown(title).toLowerCase();
    if (normalizedNames.some((name) => heading === name || heading.startsWith(`${name} `))) {
      start = /^\s*#/.test(lines[i]) ? i + 1 : i + 2;
      break;
    }
  }

  if (start < 0) return [];

  const output: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    if (headingAt(lines, i) !== null) break;
    output.push(lines[i]);
  }
  return output;
}

export function ingredientLines(markdown: string) {
  return section(markdown, ["ingredients", "ingredient list"])
    .map((line) => line.trim())
    .filter((line) => /^[-*+]\s+/.test(line))
    .map((line) => cleanMarkdown(line.replace(/^[-*+]\s+/, "")))
    .filter((line) => {
      const lower = line.toLowerCase();
      return Boolean(line) &&
        line.length <= 350 &&
        !/^\d+(?:\/\d+)?x$/i.test(line) &&
        !lower.startsWith("original recipe") &&
        !lower.includes("automatically adjusted");
    });
}

export function instructionLines(markdown: string) {
  const source = section(markdown, ["directions", "instructions", "method", "preparation"]);
  const steps: string[] = [];

  let previousBlank = true;
  for (const rawLine of source) {
    const line = rawLine.trim();
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    const bulleted = line.match(/^[-*+]\s+(.+)$/);
    const candidate = numbered?.[1] ?? bulleted?.[1] ?? "";
    const cleaned = cleanMarkdown(candidate);
    if (cleaned && cleaned.length <= 1800) {
      steps.push(cleaned);
    } else if (line && steps.length && (!previousBlank || /^\s{2,}/.test(rawLine))) {
      // Text wrapped under "1. **Sear the chicken**" belongs to that step.
      const last = steps[steps.length - 1];
      const extra = cleanMarkdown(line);
      if (extra) steps[steps.length - 1] = /[.:!?]$/.test(last) ? `${last} ${extra}` : `${last}: ${extra}`;
    }
    previousBlank = !line;
  }

  if (steps.length) return steps;

  return source
    .map((line) => cleanMarkdown(line))
    .filter((line) => line.length > 25 && line.length <= 1800 && !/^\[?button/i.test(line));
}

function durationMinutes(value: string) {
  const lower = value.toLowerCase();
  const hours = Number(lower.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/)?.[1] ?? 0);
  const minutes = Number(lower.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/)?.[1] ?? 0);
  const total = hours * 60 + minutes;
  if (total > 0) return Math.round(total);
  const plain = lower.match(/^\s*(\d+(?:\.\d+)?)\s*$/)?.[1];
  return plain ? Number(plain) : null;
}

function labeledValue(markdown: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`${escaped}:?\\s*(?:\\n\\s*)?([^\\n]+)`, "i"))?.[1]?.trim() ?? "";
}

function servingsFromMarkdown(markdown: string) {
  const value = labeledValue(markdown, "Servings");
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function firstDescription(markdown: string) {
  const lines = markdown.split("\n");
  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line.trim()));
  const start = titleIndex >= 0 ? titleIndex + 1 : 0;

  for (let i = start; i < Math.min(lines.length, start + 45); i += 1) {
    const line = lines[i].trim();
    if (/^#{1,6}\s+/.test(line)) break;
    if (!line || /^[-*+]\s+/.test(line) || /^\d+[.)]\s+/.test(line) || line.startsWith("![")) continue;
    const cleaned = cleanMarkdown(line);
    const lower = cleaned.toLowerCase();
    if (
      cleaned.length >= 45 &&
      cleaned.length <= 700 &&
      !lower.startsWith("submitted by") &&
      !lower.startsWith("updated on") &&
      !lower.startsWith("tested by") &&
      !lower.startsWith("save") &&
      !lower.startsWith("rate") &&
      !lower.includes("reviews")
    ) {
      return cleaned;
    }
  }

  return "";
}

function imageFromMarkdown(markdown: string) {
  const headingIndex = markdown.search(/^#\s+/m);
  const ingredientIndex = markdown.search(/^#{1,6}\s+ingredients\b/im);
  const sliceStart = headingIndex >= 0 ? headingIndex : 0;
  const sliceEnd = ingredientIndex > sliceStart ? ingredientIndex : Math.min(markdown.length, sliceStart + 12_000);
  const area = markdown.slice(sliceStart, sliceEnd);

  const matches = [...area.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g)];
  for (const match of matches) {
    const alt = (match[1] ?? "").toLowerCase();
    const url = match[2] ?? "";
    if (!url || alt.includes("logo") || alt.includes("icon") || alt.includes("avatar")) continue;
    return url;
  }
  return "";
}

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

async function extractThroughReader(input: string): Promise<ImportedRecipe> {
  const target = validateTarget(input);
  const readerUrl = `https://r.jina.ai/${target.toString()}`;

  let response: Response;
  try {
    response = await fetch(readerUrl, {
      headers: {
        Accept: "text/plain",
        "X-Timeout": "20",
      },
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    });
  } catch {
    throw new Error("That recipe website blocked automatic import. Copy the ingredients and steps from the page and paste them here instead.");
  }

  if (!response.ok) {
    throw new Error("That recipe website blocked automatic import. Copy the ingredients and steps from the page and paste them here instead.");
  }

  const raw = await response.text();
  if (!raw || raw.length > MAX_READER_CHARS) {
    throw new Error("Cook’s Kitchen could not read that recipe page reliably.");
  }

  const markdown = readerMarkdown(raw);
  let ingredients = ingredientLines(markdown);
  let instructions = instructionLines(markdown);
  if (!ingredients.length && !instructions.length) {
    // Some rendered pages lose their headings; fall back to the shape of the lists.
    const shaped = parseRecipeText(markdown);
    if (shaped.ingredients.length >= 2 && shaped.instructions.length >= 1) {
      ingredients = shaped.ingredients;
      instructions = shaped.instructions;
    }
  }
  const name = titleFromReader(raw, markdown);
  const description = firstDescription(markdown);
  const warnings: string[] = [
    "This site blocked the direct importer, so Cook’s Kitchen used a rendered-page fallback. Review the extracted details before saving.",
  ];

  if (!ingredients.length) warnings.push("No ingredients were found. Add or paste them before saving.");
  if (!instructions.length) warnings.push("No instructions were found. Add or paste them before saving.");

  return {
    source_url: target.toString(),
    name,
    description,
    image_url: imageFromMarkdown(markdown),
    prep_minutes: durationMinutes(labeledValue(markdown, "Prep Time")),
    cook_minutes: durationMinutes(labeledValue(markdown, "Cook Time")),
    servings: servingsFromMarkdown(markdown),
    ingredients,
    instructions,
    tags: [],
    dietary_tags: inferDietaryTags(`${name} ${description}`),
    structured: ingredients.length > 0 || instructions.length > 0,
    warnings,
  };
}

// Only worth the slower rendered-page reader when the core of the recipe is missing;
// a missing serving count or time is quicker to type than to wait for.
function needsRenderedDetails(recipe: ImportedRecipe) {
  return !recipe.ingredients.length || !recipe.instructions.length;
}

function mergeRecipeDetails(primary: ImportedRecipe, rendered: ImportedRecipe): ImportedRecipe {
  const ingredients =
    rendered.ingredients.length > primary.ingredients.length ? rendered.ingredients : primary.ingredients;
  const instructions =
    rendered.instructions.length > primary.instructions.length ? rendered.instructions : primary.instructions;
  const filledFromRendered =
    ingredients !== primary.ingredients ||
    instructions !== primary.instructions ||
    (primary.servings == null && rendered.servings != null) ||
    (primary.prep_minutes == null && rendered.prep_minutes != null) ||
    (primary.cook_minutes == null && rendered.cook_minutes != null);

  const warnings = primary.warnings.filter((warning) => {
    const lower = warning.toLowerCase();
    if (ingredients.length && lower.startsWith("no ingredients")) return false;
    if (instructions.length && lower.startsWith("no instructions")) return false;
    if (ingredients.length && instructions.length && lower.includes("only pulled the page basics")) return false;
    return true;
  });

  if (filledFromRendered) {
    warnings.push("Cook’s Kitchen filled missing details from the rendered recipe page. Review everything before saving.");
  }
  if (!ingredients.length) warnings.push("No ingredients were found. Add or paste them before saving.");
  if (!instructions.length) warnings.push("No instructions were found. Add or paste them before saving.");

  return {
    ...primary,
    name: primary.name !== "Imported recipe" ? primary.name : rendered.name,
    description: primary.description || rendered.description,
    image_url: primary.image_url || rendered.image_url,
    prep_minutes: primary.prep_minutes ?? rendered.prep_minutes,
    cook_minutes: primary.cook_minutes ?? rendered.cook_minutes,
    servings: primary.servings ?? rendered.servings,
    ingredients,
    instructions,
    tags: primary.tags.length ? primary.tags : rendered.tags,
    dietary_tags: Array.from(new Set([...primary.dietary_tags, ...rendered.dietary_tags])),
    structured: primary.structured || rendered.structured,
    warnings: Array.from(new Set(warnings)),
  };
}

export type { ImportedRecipe };

export async function extractRecipeFromUrl(input: string): Promise<ImportedRecipe> {
  validateTarget(input.trim());

  let direct: ImportedRecipe;
  try {
    direct = await extractDirectRecipe(input);
  } catch (error) {
    if (!shouldTryRenderedFallback(error)) throw error;
    return extractThroughReader(input);
  }

  if (!needsRenderedDetails(direct)) return direct;

  try {
    const rendered = await extractThroughReader(input);
    return mergeRecipeDetails(direct, rendered);
  } catch {
    return direct;
  }
}
