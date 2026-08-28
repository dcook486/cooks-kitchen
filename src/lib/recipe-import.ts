export type ImportedRecipe = {
  source_url: string;
  name: string;
  description: string;
  image_url: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  dietary_tags: string[];
  structured: boolean;
  warnings: string[];
};

type JsonRecord = Record<string, unknown>;

const MAX_HTML_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const codePoint = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function plainText(value: unknown) {
  if (typeof value !== "string") return "";
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|li)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
}

function textLines(value: unknown) {
  return plainText(value).split("\n").map((line) => line.trim()).filter(Boolean);
}

function unique(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isBlockedHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".lan")) return true;

  if (host.includes(":")) return true;

  const parts = host.split(".");
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part))) {
    const numbers = parts.map(Number);
    if (numbers.some((part) => part < 0 || part > 255)) return true;
    const [a, b] = numbers;
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }

  return false;
}

function safeRecipeUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid recipe URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Recipe links must use http or https.");
  if (url.username || url.password) throw new Error("Recipe links cannot include credentials.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Recipe links must use a standard web port.");
  if (isBlockedHostname(url.hostname)) throw new Error("That address is not available for recipe import.");
  return url;
}

async function fetchRecipeHtml(input: string) {
  let current = safeRecipeUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "Cook's Kitchen Recipe Importer/1.0" },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The recipe website returned an incomplete redirect.");
      current = safeRecipeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`The recipe website returned ${response.status}.`);

    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type && !type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("That link does not appear to be a recipe webpage.");

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("That webpage is too large to import safely.");

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) throw new Error("That webpage is too large to import safely.");
    return { html, finalUrl: current.toString() };
  }

  throw new Error("The recipe website redirected too many times.");
}

function typeNames(value: unknown) {
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.split(/[\/#]/).pop()?.toLowerCase() ?? "");
}

function collectRecipeNodes(value: unknown, output: JsonRecord[]) {
  if (Array.isArray(value)) {
    for (const item of value) collectRecipeNodes(item, output);
    return;
  }
  if (!isRecord(value)) return;
  if (typeNames(value["@type"]).includes("recipe")) output.push(value);

  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "subjectOf", "itemListElement"]) {
    if (value[key]) collectRecipeNodes(value[key], output);
  }
}

function recipeNodeScore(recipe: JsonRecord) {
  const ingredients = ingredientLines(recipe.recipeIngredient ?? recipe.ingredients).length;
  const instructions = instructionLines(recipe.recipeInstructions ?? recipe.instructions).length;
  const hasTime = [recipe.prepTime, recipe.cookTime, recipe.totalTime].some((value) => durationMinutes(value) != null);
  const hasYield = servingsNumber(recipe.recipeYield) != null;

  return (
    ingredients * 3 +
    instructions * 4 +
    (plainText(recipe.name) ? 5 : 0) +
    (plainText(recipe.description) ? 2 : 0) +
    (hasTime ? 3 : 0) +
    (hasYield ? 3 : 0)
  );
}

function extractRecipeJsonLd(html: string) {
  const pattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const candidates: JsonRecord[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    const raw = match[1].replace(/^\s*<!--/, "").replace(/-->\s*$/, "").trim();
    if (!raw) continue;
    try {
      collectRecipeNodes(JSON.parse(raw) as unknown, candidates);
    } catch {
      // Keep checking other structured-data blocks.
    }
  }

  return candidates.sort((left, right) => recipeNodeScore(right) - recipeNodeScore(left))[0] ?? null;
}

function metaAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tag))) attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  return attributes;
}

function metaContent(html: string, key: string) {
  const target = key.toLowerCase();
  const pattern = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const attributes = metaAttributes(match[0]);
    if ((attributes.property ?? attributes.name ?? "").toLowerCase() === target) return attributes.content ?? "";
  }
  return "";
}

function titleText(html: string) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match ? plainText(match[1]) : "";
}

function durationMinutes(value: unknown) {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!match) return null;
  const total = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60;
  return total > 0 ? Math.round(total) : 0;
}

function servingsNumber(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  if (typeof candidate !== "string") return null;
  const match = candidate.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function stringValues(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (typeof value !== "string") return [];
  return value.split(/[,;]/).map((item) => plainText(item)).filter(Boolean);
}

function imageValue(value: unknown, baseUrl: string): string {
  let candidate = "";
  if (typeof value === "string") candidate = value;
  else if (Array.isArray(value)) {
    for (const item of value) {
      const found = imageValue(item, baseUrl);
      if (found) return found;
    }
    return "";
  } else if (isRecord(value)) {
    candidate = typeof value.url === "string" ? value.url : typeof value.contentUrl === "string" ? value.contentUrl : "";
  }

  if (!candidate) return "";
  try {
    const url = new URL(candidate, baseUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function ingredientLines(value: unknown) {
  return Array.isArray(value) ? value.flatMap((item) => textLines(item)) : textLines(value);
}

function instructionLines(value: unknown): string[] {
  if (typeof value === "string") return textLines(value);
  if (Array.isArray(value)) return value.flatMap(instructionLines);
  if (!isRecord(value)) return [];
  if (value.itemListElement) {
    const lines = instructionLines(value.itemListElement);
    if (lines.length) return lines;
  }
  if (value.steps) {
    const lines = instructionLines(value.steps);
    if (lines.length) return lines;
  }
  return textLines(value.text ?? value.name);
}

function dietaryTags(recipe: JsonRecord, searchable: string) {
  const combined = `${stringValues(recipe.suitableForDiet).join(" ")} ${searchable}`.toLowerCase();
  const tags: string[] = [];
  if (combined.includes("glutenfreediet") || /gluten[- ]free/.test(combined)) tags.push("gluten-free");
  if (/dairy[- ]free/.test(combined)) tags.push("dairy-free");
  if (combined.includes("vegandiet") || /\bvegan\b/.test(combined)) tags.push("vegan");
  if (combined.includes("vegetariandiet") || /\bvegetarian\b/.test(combined)) tags.push("vegetarian");
  if (combined.includes("ketogenicdiet") || /\bketo\b/.test(combined)) tags.push("keto");
  return unique(tags);
}

function fromStructuredData(recipe: JsonRecord, sourceUrl: string): ImportedRecipe {
  const ingredients = ingredientLines(recipe.recipeIngredient ?? recipe.ingredients);
  const instructions = instructionLines(recipe.recipeInstructions ?? recipe.instructions);
  const tags = unique([
    ...stringValues(recipe.recipeCategory),
    ...stringValues(recipe.recipeCuisine),
    ...stringValues(recipe.keywords),
  ]).slice(0, 14);
  const warnings: string[] = [];
  if (!ingredients.length) warnings.push("No ingredients were found. Review and add them before saving.");
  if (!instructions.length) warnings.push("No instructions were found. Review and add them before saving.");

  const prep = durationMinutes(recipe.prepTime);
  const cook = durationMinutes(recipe.cookTime);
  const total = durationMinutes(recipe.totalTime);
  const name = plainText(recipe.name) || "Imported recipe";
  const description = plainText(recipe.description);

  return {
    source_url: sourceUrl,
    name,
    description,
    image_url: imageValue(recipe.image, sourceUrl),
    prep_minutes: prep,
    cook_minutes: cook ?? (prep == null && total != null ? total : null),
    servings: servingsNumber(recipe.recipeYield),
    ingredients,
    instructions,
    tags,
    dietary_tags: dietaryTags(recipe, [name, description, ...tags].join(" ")),
    structured: true,
    warnings,
  };
}

function fromPageBasics(html: string, sourceUrl: string): ImportedRecipe {
  const image = metaContent(html, "og:image") || metaContent(html, "twitter:image");
  return {
    source_url: sourceUrl,
    name: plainText(metaContent(html, "og:title")) || plainText(metaContent(html, "twitter:title")) || titleText(html) || "Imported recipe",
    description: plainText(metaContent(html, "og:description")) || plainText(metaContent(html, "description")),
    image_url: imageValue(image, sourceUrl),
    prep_minutes: null,
    cook_minutes: null,
    servings: null,
    ingredients: [],
    instructions: [],
    tags: [],
    dietary_tags: [],
    structured: false,
    warnings: ["This website did not expose standard recipe data, so Cook’s Kitchen only pulled the page basics. Add or paste the ingredients and instructions before saving."],
  };
}

export async function extractRecipeFromUrl(input: string): Promise<ImportedRecipe> {
  if (!input.trim()) throw new Error("Paste a recipe URL first.");
  let fetched: { html: string; finalUrl: string };
  try {
    fetched = await fetchRecipeHtml(input.trim());
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("That recipe website took too long to respond.");
    throw error;
  }

  const recipe = extractRecipeJsonLd(fetched.html);
  return recipe ? fromStructuredData(recipe, fetched.finalUrl) : fromPageBasics(fetched.html, fetched.finalUrl);
}
