/**
 * Reads the conversation out of a public ChatGPT share page (chatgpt.com/share/…).
 *
 * The page embeds its data as a React Router "turbo-stream" payload inside
 * `streamController.enqueue("…")` scripts. That format is undocumented and can change at any
 * time, so every step here is defensive and there are two simpler fallbacks:
 * scanning the payload's string table, then the server-rendered HTML text.
 */
import { textLooksLikeRecipe } from "./import-input";
import { parseRecipeText } from "./recipe-text-parser";

export type ChatMessage = { role: string; text: string };
export type DecodedShare = { title: string; messages: ChatMessage[]; method: "turbo-stream" | "string-table" | "html" | "none" };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const ENQUEUE_PATTERN = /streamController\.enqueue\(\s*("(?:[^"\\]|\\.)*")\s*\)/g;
const MAX_NODES = 200_000;

function enqueuedPayload(html: string) {
  const chunks: string[] = [];
  for (const match of html.matchAll(ENQUEUE_PATTERN)) {
    try {
      const value = JSON.parse(match[1]) as unknown;
      if (typeof value === "string") chunks.push(value);
    } catch {
      // Ignore malformed chunks; others may still decode.
    }
  }
  return chunks.join("");
}

function flatTable(payload: string): Json[] | null {
  const firstLine = payload.split("\n", 1)[0];
  if (!firstLine?.startsWith("[")) return null;
  try {
    const parsed = JSON.parse(firstLine) as unknown;
    return Array.isArray(parsed) ? (parsed as Json[]) : null;
  } catch {
    return null;
  }
}

/** Rebuilds the object graph from turbo-stream's flat, index-referenced table. */
export function hydrateTurboStream(table: Json[]): unknown {
  const memo = new Map<number, unknown>();
  let visited = 0;

  function value(ref: Json, depth: number): unknown {
    if (typeof ref !== "number") return null;
    if (ref < 0) return ref === -2 ? Number.NaN : ref === -6 ? Infinity : ref === -3 ? -Infinity : ref === -4 ? -0 : ref === -5 ? null : undefined;
    if (memo.has(ref)) return memo.get(ref);
    if (ref >= table.length || depth > 80 || (visited += 1) > MAX_NODES) return null;
    const node = table[ref];

    if (Array.isArray(node)) {
      // Typed values (dates, promises, maps…) are tagged with a one-letter string; we don't need them.
      if (typeof node[0] === "string") {
        memo.set(ref, null);
        return null;
      }
      const output: unknown[] = [];
      memo.set(ref, output);
      for (const item of node) output.push(value(item, depth + 1));
      return output;
    }
    if (node && typeof node === "object") {
      const output: Record<string, unknown> = {};
      memo.set(ref, output);
      for (const [key, item] of Object.entries(node)) {
        const keyIndex = key.startsWith("_") ? Number(key.slice(1)) : Number.NaN;
        const name = Number.isInteger(keyIndex) && typeof table[keyIndex] === "string" ? (table[keyIndex] as string) : key;
        output[name] = value(item, depth + 1);
      }
      return output;
    }
    memo.set(ref, node);
    return node;
  }

  return value(0, 0);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function messageFrom(value: unknown): (ChatMessage & { key: string; time: number }) | null {
  if (!isRecord(value) || !isRecord(value.author) || !isRecord(value.content)) return null;
  const role = typeof value.author.role === "string" ? value.author.role : "";
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  if (!role || metadata.is_visually_hidden_from_conversation === true) return null;
  const parts = Array.isArray(value.content.parts) ? value.content.parts : [];
  const text = [
    ...parts.filter((part): part is string => typeof part === "string"),
    ...(typeof value.content.text === "string" ? [value.content.text] : []),
  ].join("\n").trim();
  if (!text) return null;
  const time = typeof value.create_time === "number" ? value.create_time : 0;
  return { role, text, key: typeof value.id === "string" ? value.id : `${role}:${text}`, time };
}

function findConversation(root: unknown) {
  const stack: unknown[] = [root];
  const seen = new Set<unknown>();
  let mapping: Record<string, unknown> | null = null;
  let title = "";
  const loose: unknown[] = [];

  while (stack.length && seen.size < MAX_NODES) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (isRecord(node)) {
      if (Array.isArray(node.linear_conversation)) {
        const messages = node.linear_conversation.map((entry) => (isRecord(entry) ? messageFrom(entry.message) : null));
        const list = messages.filter((message): message is NonNullable<typeof message> => Boolean(message));
        if (list.length) return { title: typeof node.title === "string" ? node.title : "", list };
      }
      if (!mapping && isRecord(node.mapping)) {
        mapping = node.mapping;
        if (typeof node.title === "string") title = node.title;
      }
      if (node.author && node.content) loose.push(node);
      for (const child of Object.values(node)) stack.push(child);
    } else if (Array.isArray(node)) {
      for (const child of node) stack.push(child);
    }
  }

  const candidates = mapping
    ? Object.values(mapping).map((entry) => (isRecord(entry) ? messageFrom(entry.message) : null))
    : loose.map(messageFrom);
  const unique = new Map<string, NonNullable<ReturnType<typeof messageFrom>>>();
  for (const message of candidates) if (message && !unique.has(message.key)) unique.set(message.key, message);
  const list = [...unique.values()].sort((left, right) => left.time - right.time);
  return { title, list };
}

/** Very small HTML → text conversion that keeps headings, list items and paragraphs on their own lines. */
export function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<h([1-6])\b[^>]*>/gi, (_, level: string) => `\n${"#".repeat(Number(level))} `)
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|h[1-6]|li|ul|ol|section|article|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function pageTitle(html: string) {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)?.[1];
  const title = og ?? html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return title.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").trim();
}

export function cleanChatTitle(title: string) {
  return title.replace(/^\s*ChatGPT\s*[-–—:|]\s*/i, "").trim();
}

export function decodeChatGptShareHtml(html: string): DecodedShare {
  const fallbackTitle = pageTitle(html);
  const payload = enqueuedPayload(html);
  const table = payload ? flatTable(payload) : null;

  if (table) {
    try {
      const { title, list } = findConversation(hydrateTurboStream(table));
      if (list.length) return { title: title || fallbackTitle, messages: list.map(({ role, text }) => ({ role, text })), method: "turbo-stream" };
    } catch {
      // Fall through to the string-table scan.
    }
    // Structure changed? Long strings that look like recipes are still in the table.
    const strings = table.filter((item): item is string => typeof item === "string" && item.length > 120 && textLooksLikeRecipe(item));
    if (strings.length) return { title: fallbackTitle, messages: strings.map((text) => ({ role: "assistant", text })), method: "string-table" };
  }

  const text = htmlToText(html.match(/<main\b[\s\S]*<\/main>/i)?.[0] ?? html);
  if (textLooksLikeRecipe(text)) return { title: fallbackTitle, messages: [{ role: "assistant", text }], method: "html" };
  return { title: fallbackTitle, messages: [], method: "none" };
}

/**
 * The most recent assistant reply that actually contains a recipe (handles "make it vegetarian" follow-ups).
 * When that reply has ingredients but no steps and a later reply carries the method ("Now the steps…"),
 * the steps are appended so the recipe isn't split in half.
 */
export function pickRecipeMessage(messages: ChatMessage[]): ChatMessage | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant" || !textLooksLikeRecipe(message.text)) continue;
    const parsed = parseRecipeText(message.text);
    if (!parsed.ingredients.length) continue;
    if (parsed.instructions.length) return message;

    for (let j = i + 1; j < messages.length; j += 1) {
      if (messages[j].role !== "assistant") continue;
      const later = parseRecipeText(messages[j].text);
      if (!later.instructions.length) continue;
      const method = later.instructions.map((step, index) => `${index + 1}. ${step}`).join("\n");
      return { role: "assistant", text: `${message.text}\n\n## Instructions\n\n${method}` };
    }
    return message;
  }
  return null;
}
