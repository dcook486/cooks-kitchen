import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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
type ResolvedAddress = { address: string; family: number };

const MAX_HTML_BYTES = 3_000_000;
const MAX_REDIRECTS = 5;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function decodeHtml(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const raw = entity.slice(hex ? 2 : 1);
      const codePoint = Number.parseInt(raw, hex ? 16 : 10);
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
      .replace(/<\/p\s*>/gi, "\n")
      .replace(/<\/li\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[\t\r ]+/g, " ")
    .replace(/ *\n+ */g, "\n")
    .trim();
}

function textLines(value: unknown) {
  return plainText(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
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

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function privateIp(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  const version = isIP(normalized);
  if (version === 4) return privateIpv4(normalized);
  if (version !== 6) return true;

  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    if (isIP(mapped) === 4) return privateIpv4(mapped);
  }
  return false;
}

async function assertSafeRecipeUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("Enter a valid recipe URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Recipe links must use http or https.");
  if (url.username || url.password) throw new Error("Recipe links cannot include credentials.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new Error("Recipe links must use a standard web port.");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("That address is not available for recipe import.");
  }

  if (isIP(hostname)) {
    if (privateIp(hostname)) throw new Error("That address is not available for recipe import.");
  } else {
    let addresses: ResolvedAddress[] = [];
    try {
      addresses = await lookup(hostname, { all: true, verbatim: true });
    } catch {
      throw new Error("Cook’s Kitchen could not reach that website.");
    }
    if (!addresses.length || addresses.some((entry) => privateIp(entry.address))) {
      throw new Error("That address is not available for recipe import.");
    }
  }

  return url;
}

async function fetchRecipeHtml(input: string) {
  let current = await assertSafeRecipeUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Cook's Kitchen Recipe Importer/1.0",
      },
      signal: AbortSignal.timeout(12_000),
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("The recipe website returned an incomplete redirect.");
      current = await assertSafeRecipeUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`The recipe website returned ${response.status}.`);

    const type = (response.headers.get("content-type") ?? "").toLowerCase();
    if (type && !type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      throw new Error("That link does not appear to be a recipe webpage.");
    }

    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_HTML_BYTES) throw new Error("That webpage is too large to import safely.");

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) throw new Error("That webpage is too large to import safely.");
    return { html, finalUrl: current.toString() };
  }

  throw new Error("The recipe website redirected too many times.");
}

function typeNames(value: unknown) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.split(/[\/#]/).pop()?.toLowerCase() ?? "");
}

function findRecipeNode(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findRecipeNode(item);
      if (match) return match;
    }
    return null;
  }

  if (!isRecord(value)) return null;
  if (typeNames(value["@type"]).includes("recipe")) return value;

  if (value["@graph"]) {
    const graphMatch = findRecipeNode(value["@graph"]);
    if (graphMatch) return graphMatch;
  }

  for (const key of ["mainEntity", "mainEntityOfPage", "subjectOf", "itemListElement"]) {
    if (value[key]) {
      const nested = findRecipeNode(value[key]);
      if (nested) return nested;
    }
  }

  return null;
}

function extractRecipeJsonLd(html: string) {
  const scriptPattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptPattern.exec(html))) {
    const raw = match[1]
      .replace(/^\s*<!--/, "")
      .replace(/-->\s*$/, "")
      .trim();
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw) as unknown;
      const recipe = findRecipeNode(parsed);
      if (recipe) return recipe;
    } catch {
      // Some sites publish malformed JSON-LD; keep checking other blocks.
    }
  }

  return null;
}

function parseMetaAttributes(tag: string) {
  const attributes: Record<string, string> = {};
  const attributePattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match: RegExpExecArray | null;
  while ((match = attributePattern.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function metaContent(html: string, key: string) {
  const target = key.toLowerCase();
  const metaPattern = /<meta\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = metaPattern.exec(html))) {
    const attributes = parseMetaAttributes(match[0]);
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
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  const total = days * 1440 + hours * 60 + minutes + seconds / 60;
  return total > 0 ? Math.round(total) : 0;
}

function servingsNumber(value: unknown) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  if (typeof candidate !== "string") return null;
  const match = candidate.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function stringValues(value: unknown) {
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (typeof value !== "string") return [];
  return value
    .split(/[,;]/)
    .map((item) => plainText(item))
    .filter(Boolean);
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
  if (!Array.isArray(value)) return typeof value === "string" ? textLines(value) : [];
  return value.flatMap((item) => textLines(item));
}

function instructionLines(value: unknown): string[] {
  if (typeof value === "string") return textLines(value);
  if (Array.isArray(value)) return value.flatMap(instructionLines);
  if (!isRecord(value)) return [];

  if (value.itemListElement) {
    const nested = instructionLines(value.itemListElement);
    if (nested.length) return nested;
  }
  if (value.steps) {
    const nested = instructionLines(value.steps);
    if (nested.length) return nested;
  }
  return textLines(value.text ?? value.name);
}

function dietaryTags(recipe: JsonRecord, searchableText: string) {
  const values = stringValues(recipe.suitableForDiet).map((item) => item.toLowerCase());
  const combined = `${values.join(" ")} ${searchableText.toLowerCase()}`;
  const tags: string[] = [];

  if (combined.includes("glutenfreediet") || /gluten[- ]free/.test(combined)) tags.push("gluten-free");
  if (/dairy[- ]free/.test(combined)) tags.push("dairy-free");
  if (combined.includes("vegandiet") || /\bvegan\b/.test(combined)) tags.push("vegan");
  if (combined.includes("vegetariandiet") || /\bvegetarian\b/.test(combined)) tags.push("vegetarian");
  if (combined.includes("ketogenicdiet") || /\bketo\b/.test(combined)) tags.push("keto");

  return unique(tags);
}

function structuredRecipe(recipe: JsonRecord, sourceUrl: string): ImportedRecipe {
  const ingredients = ingredientLines(recipe.recipeIngredient ?? recipe.ingredients);
  const instructions = instructionLines(recipe.recipeInstructions ?? recipe.instructions);
  const keywords = stringValues(recipe.keywords);
  const categories = stringValues(recipe.recipeCategory);
  const cuisines = stringValues(recipe.recipeCuisine);
  const tags = unique([...categories, ...cuisines, ...keywords]).slice(0, 14);
  const searchable = [plainText(recipe.name), plainText(recipe.description), ...tags].join(" ");
  const warnings: string[] = [];

  if (!ingredients.length) warnings.push("No ingredients were found. Review and add them before saving.");
  if (!instructions.length) warnings.push("No instructions were found. Review and add them before saving.");

  const prep = durationMinutes(recipe.prepTime);
  const cook = durationMinutes(recipe.cookTime);
  const total = durationMinutes(recipe.totalTime);

  return {
    source_url: sourceUrl,
    name: plainText(recipe.name) || "Imported recipe",
    description: plainText(recipe.description),
    image_url: imageValue(recipe.image, sourceUrl),
    prep_minutes: prep,
    cook_minutes: cook ?? (prep == null && total != null ? total : null),
    servings: servingsNumber(recipe.recipeYield),
    ingredients,
    instructions,
    tags,
    dietary_tags: dietaryTags(recipe, searchable),
    structured: true,
    warnings,
  };
}

function fallbackRecipe(html: string, sourceUrl: string): ImportedRecipe {
  const name = plainText(metaContent(html, "og:title")) || plainText(metaContent(html, "twitter:title")) || titleText(html) || "Imported recipe";
  const description = plainText(metaContent(html, "og:description")) || plainText(metaContent(html, "description"));
  const image = metaContent(html, "og:image") || metaContent(html, "twitter:image");

  return {
    source_url: sourceUrl,
    name,
    description,
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
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Paste a recipe URL first.");

  let fetched: { html: string; finalUrl: string };
  try {
    fetched = await fetchRecipeHtml(trimmed);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new Error("That recipe website took too long to respond.");
    throw error;
  }

  const node = extractRecipeJsonLd(fetched.html);
  return node ? structuredRecipe(node, fetched.finalUrl) : fallbackRecipe(fetched.html, fetched.finalUrl);
}
