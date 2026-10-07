/**
 * Decides what someone typed or pasted into the import box. Pure and dependency-free so the
 * client (live hint) and the server (actual import) agree on the same rules.
 */

export const MAX_IMPORT_INPUT_CHARS = 30_000;

export type ShareLinkKind = "chatgpt-share" | "chatgpt-private" | "claude-share" | "gemini-share" | "social" | null;

export type ImportInput =
  | { kind: "empty" }
  | { kind: "url"; url: string; share: ShareLinkKind }
  | { kind: "text"; text: string }
  | { kind: "name"; name: string };

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?]/gi;

function normalizeUrl(candidate: string): string | null {
  let value = candidate.trim();
  if (/^www\.[^\s]+\.[a-z]{2,}/i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function classifyShareLink(input: string): ShareLinkKind {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname;
  if (host === "chatgpt.com" || host === "chat.openai.com") {
    if (/^\/share\/[\w-]+/.test(path)) return "chatgpt-share";
    if (/^\/(?:g\/[^/]+\/)?c\/[\w-]+/.test(path)) return "chatgpt-private";
    return null;
  }
  if (host === "claude.ai" && /^\/share\//.test(path)) return "claude-share";
  if ((host === "gemini.google.com" && /^\/share\//.test(path)) || (host === "g.co" && /^\/gemini\/share\//.test(path))) return "gemini-share";
  // Logged-in social apps never expose the recipe text to a server.
  if (/(?:^|\.)(?:instagram\.com|tiktok\.com|facebook\.com|fb\.watch|threads\.net|threads\.com)$/.test(host)) return "social";
  return null;
}

function urlResult(url: string): ImportInput {
  return { kind: "url", url, share: classifyShareLink(url) };
}

/** True when text has the shape of a recipe (an ingredients section or several quantity lines). */
export function textLooksLikeRecipe(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  const hasIngredientsHeading = lines.some((line) => /^(?:#{1,6}\s*)?(?:\*\*|__)?[^\w]*(?:ingredients?|what you(?:'|’)ll need|you(?:'|’)ll need)\b/i.test(line));
  const quantityLines = lines.filter((line) => /^(?:[-*+•]\s*)?(?:\d|[¼½¾⅓⅔⅛]|a (?:pinch|handful|dash)\b)/i.test(line)).length;
  return hasIngredientsHeading || quantityLines >= 3;
}

export function detectImportInput(raw: string): ImportInput {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return { kind: "empty" };

  // A lone link, with or without https:// in front.
  if (!/\s/.test(text)) {
    const url = normalizeUrl(text);
    if (url) return urlResult(url);
  }

  // Share sheets often send "Check out this recipe https://…": treat a short blurb with exactly one link as that link.
  const links = text.match(URL_PATTERN) ?? [];
  if (links.length === 1 && text.length <= 280 && !textLooksLikeRecipe(text)) {
    const url = normalizeUrl(links[0]);
    if (url) return urlResult(url);
  }

  if (!text.includes("\n") && text.length <= 120 && !textLooksLikeRecipe(text)) return { kind: "name", name: text };
  return { kind: "text", text: text.slice(0, MAX_IMPORT_INPUT_CHARS) };
}

export const PASTE_GUIDANCE = "Copy the recipe text and paste it here instead.";
export const CHATGPT_PRIVATE_MESSAGE = "That’s a private chat link. In ChatGPT tap Share → Copy link, or copy the recipe text and paste it here.";
