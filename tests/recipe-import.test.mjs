// Script-based tests for the recipe import helpers (no extra dependencies).
// Run with `npm test`: compiles src/lib/* to .test-build/ (CommonJS), then runs node:test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const parser = require("../.test-build/recipe-text-parser.js");
const input = require("../.test-build/import-input.js");
const chatgpt = require("../.test-build/chatgpt-share.js");
const direct = require("../.test-build/recipe-import.js");
const fallback = require("../.test-build/recipe-import-fallback.js");

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

// Minimal turbo-stream encoder (flat table, `_<keyIndex>: valueIndex` objects) for synthetic share pages.
function encodeTurboStream(root) {
  const table = [];
  const seen = new Map();
  const add = (value) => {
    if (value === null) return -5;
    if (value === undefined) return -7;
    if (typeof value !== "object") {
      const key = `${typeof value}:${value}`;
      if (seen.has(key)) return seen.get(key);
      seen.set(key, table.length);
      table.push(value);
      return table.length - 1;
    }
    const index = table.length;
    table.push(null);
    if (Array.isArray(value)) table[index] = value.map(add);
    else {
      const encoded = {};
      for (const [key, item] of Object.entries(value)) encoded[`_${add(key)}`] = add(item);
      table[index] = encoded;
    }
    return index;
  };
  add(root);
  return table;
}

function sharePage(table, title = "ChatGPT - Dinner ideas") {
  const literal = JSON.stringify(`${JSON.stringify(table)}\n`).replace(/</g, "\\u003c");
  return `<html><head><title>${title}</title></head><body><script>window.__reactRouterContext.streamController.enqueue(${literal});</script></body></html>`;
}

const message = (role, text, time, extra = {}) => ({
  id: `${role}-${time}`,
  author: { role },
  create_time: time,
  content: { content_type: "text", parts: [text] },
  metadata: extra,
});

const CHILI = "Here's a cozy chili.\n\n## Beef Chili\n\n### Ingredients\n- 1 lb ground beef\n- 1 onion, diced\n- 1 can beans\n\n### Instructions\n1. Brown the beef.\n2. Add the rest and simmer 30 minutes.";
const VEGGIE = "Sure! Here's a vegetarian version.\n\n## Three-Bean Chili\n\n**Ingredients**\n- 1 onion, diced\n- 3 cans beans, drained\n- 1 can crushed tomatoes\n\n**Instructions**\n1. Soften the onion.\n2. Add the beans and tomatoes and simmer 30 minutes.\n\nWould you like a cornbread recipe to go with it?";

// ---------- text parser ----------

test("parses a ChatGPT-style recipe reply with sub-groups, joined steps and times", () => {
  const recipe = parser.parseRecipeText(fixture("cg-assistant.md"));
  assert.equal(recipe.found, true);
  assert.equal(recipe.name, "Creamy Garlic Chicken with Spinach & Rice");
  assert.match(recipe.description, /^A comforting, flavorful one-pan meal/);
  assert.equal(recipe.servings, 2);
  assert.equal(recipe.prep_minutes, 10);
  assert.equal(recipe.cook_minutes, 30);
  assert.equal(recipe.total_minutes, 40);
  assert.equal(recipe.ingredients.length, 13);
  assert.equal(recipe.ingredients[0], "Main Ingredients:");
  assert.ok(recipe.ingredients.includes("Other Ingredients:"));
  assert.ok(recipe.ingredients.includes("1½ cups chicken stock (or water + bouillon)"));
  assert.equal(recipe.instructions.length, 5);
  assert.match(recipe.instructions[0], /^Prepare the Chicken \(5 minutes\): Slice the chicken/);
  // Tips, substitutions, serving ideas and storage notes are skipped.
  const everything = [...recipe.ingredients, ...recipe.instructions].join("\n");
  assert.doesNotMatch(everything, /curdling|No cream\?|green salad|freezing|Launch in Dock/);
});

test("parses a chatty reply with 'For the …' labels and pipe-separated times", () => {
  const recipe = parser.parseRecipeText(fixture("sample2.md"));
  assert.equal(recipe.name, "One-Pan Lemon Garlic Chicken Orzo");
  assert.equal(recipe.servings, 4);
  assert.equal(recipe.prep_minutes, 10);
  assert.equal(recipe.cook_minutes, 20);
  assert.deepEqual(recipe.ingredients.filter((line) => line.endsWith(":")), ["For the chicken:", "For the orzo:"]);
  assert.equal(recipe.ingredients.length, 13);
  assert.equal(recipe.instructions.length, 4);
  assert.match(recipe.instructions[0], /^Season & sear: Pat the chicken dry/);
  assert.doesNotMatch(recipe.instructions.join(" "), /Would you like|Enjoy/i);
});

test("parses a plain family recipe card without markdown", () => {
  const recipe = parser.parseRecipeText(fixture("sample3.txt"));
  assert.equal(recipe.name, "Grandma Jo's Chili");
  assert.equal(recipe.servings, 8);
  assert.equal(recipe.total_minutes, 90);
  assert.equal(recipe.ingredients.length, 7);
  assert.equal(recipe.ingredients[0], "2 lbs ground beef");
  assert.equal(recipe.instructions.length, 3);
});

test("headerless recipes fall back to bullets and numbered lines", () => {
  const recipe = parser.parseRecipeText("Weeknight Tacos\n- 1 lb ground turkey\n- 8 tortillas\n- 1 cup salsa\n1. Brown the turkey.\n2. Warm the tortillas and fill.");
  assert.equal(recipe.name, "Weeknight Tacos");
  assert.deepEqual(recipe.ingredients, ["1 lb ground turkey", "8 tortillas", "1 cup salsa"]);
  assert.deepEqual(recipe.instructions, ["Brown the turkey.", "Warm the tortillas and fill."]);
});

test("headerless lists: notes after the steps aren't ingredients, adjacent links keep a space", () => {
  const recipe = parser.parseRecipeText("* 1 [tsp](https://x.test/tsp)[baking powder](https://x.test/bp)\n* 1 cup milk\n\n1. Mix.\n2. Cook.\n\n* Serve with syrup.\n* Try buttermilk instead of milk.");
  assert.deepEqual(recipe.ingredients, ["1 tsp baking powder", "1 cup milk"]);
  assert.deepEqual(recipe.instructions, ["Mix.", "Cook."]);
});

test("decimal quantities are not mistaken for numbered steps", () => {
  const recipe = parser.parseRecipeText("Ingredients\n1.5 lb chicken thighs\n2 tbsp oil\n\nSteps\n1. Heat the oil.\n2. Cook the chicken.");
  assert.deepEqual(recipe.ingredients, ["1.5 lb chicken thighs", "2 tbsp oil"]);
  assert.equal(recipe.instructions.length, 2);
});

test("setext headings and 'Makes about N servings' are understood", () => {
  const recipe = parser.parseRecipeText("Pancakes\n========\nMakes about 6 servings.\n\nIngredients\n-----------\n* 1 cup flour\n* 1 egg\n* 1 cup milk\n\nMethod\n------\nWhisk everything together.\nCook on a hot griddle.");
  assert.equal(recipe.name, "Pancakes");
  assert.equal(recipe.servings, 6);
  assert.deepEqual(recipe.ingredients, ["1 cup flour", "1 egg", "1 cup milk"]);
  assert.deepEqual(recipe.instructions, ["Whisk everything together.", "Cook on a hot griddle."]);
});

test("emoji headings still count as sections", () => {
  const recipe = parser.parseRecipeText("🍝 Garlic Pasta\n\n🛒 Ingredients\n- 8 oz spaghetti\n- 4 cloves garlic\n\n👩‍🍳 Instructions\n1. Boil the pasta.\n2. Toss with garlic oil.");
  assert.equal(recipe.ingredients.length, 2);
  assert.equal(recipe.instructions.length, 2);
});

test("durations: hours, minutes, fractions and ranges", () => {
  assert.equal(parser.durationTextMinutes("1 hour 15 minutes"), 75);
  assert.equal(parser.durationTextMinutes("25–30 minutes"), 30);
  assert.equal(parser.durationTextMinutes("1½ hours"), 90);
  assert.equal(parser.durationTextMinutes("about 40 min"), 40);
  assert.equal(parser.durationTextMinutes("overnight"), null);
});

test("text with no recipe structure reports found=false", () => {
  const recipe = parser.parseRecipeText("Thanks so much! We loved it last night and the kids asked for seconds.");
  assert.equal(recipe.found, false);
  assert.deepEqual(recipe.ingredients, []);
});

// ---------- input detection ----------

test("detects links, names and pasted recipe text", () => {
  assert.equal(input.detectImportInput("   ").kind, "empty");
  const url = input.detectImportInput("  https://www.allrecipes.com/recipe/24074/alysias-basic-meat-lasagna/  ");
  assert.equal(url.kind, "url");
  assert.equal(url.url, "https://www.allrecipes.com/recipe/24074/alysias-basic-meat-lasagna/");
  assert.equal(input.detectImportInput("www.budgetbytes.com/one-pot-chili-mac/").kind, "url");
  assert.equal(input.detectImportInput("Check this out! https://chatgpt.com/share/abc-123 so good").kind, "url");
  assert.deepEqual(input.detectImportInput("Blackened ranch chicken"), { kind: "name", name: "Blackened ranch chicken" });
  assert.equal(input.detectImportInput(fixture("sample3.txt")).kind, "text");
  // A recipe that mentions a link is still text, not a URL import.
  assert.equal(input.detectImportInput(`${fixture("cg-assistant.md")}\nhttps://example.com`).kind, "text");
});

test("pasted text is capped", () => {
  const detected = input.detectImportInput(`Ingredients\n${"- 1 cup flour\n".repeat(5000)}`);
  assert.equal(detected.kind, "text");
  assert.equal(detected.text.length, input.MAX_IMPORT_INPUT_CHARS);
});

test("classifies chat share links and social posts", () => {
  assert.equal(input.classifyShareLink("https://chatgpt.com/share/696b4ca3-357c-8004-b1fb-2af2146485a9"), "chatgpt-share");
  assert.equal(input.classifyShareLink("https://chat.openai.com/share/abc"), "chatgpt-share");
  assert.equal(input.classifyShareLink("https://chatgpt.com/c/6960f21c-1d3c"), "chatgpt-private");
  assert.equal(input.classifyShareLink("https://chatgpt.com/g/g-p-123/c/6960f21c"), "chatgpt-private");
  assert.equal(input.classifyShareLink("https://claude.ai/share/549c846d"), "claude-share");
  assert.equal(input.classifyShareLink("https://gemini.google.com/share/abc"), "gemini-share");
  assert.equal(input.classifyShareLink("https://g.co/gemini/share/abc"), "gemini-share");
  assert.equal(input.classifyShareLink("https://www.instagram.com/reel/xyz/"), "social");
  assert.equal(input.classifyShareLink("https://www.tiktok.com/@cook/video/1"), "social");
  assert.equal(input.classifyShareLink("https://www.seriouseats.com/the-best-chili-recipe"), null);
  assert.match(input.CHATGPT_PRIVATE_MESSAGE, /private chat link.*Share → Copy link/);
});

// ---------- ChatGPT share pages ----------

test("decodes a real (trimmed, sanitized) ChatGPT share page", () => {
  const decoded = chatgpt.decodeChatGptShareHtml(fixture("chatgpt-share.html"));
  assert.equal(decoded.method, "turbo-stream");
  assert.equal(decoded.title, "Recipe Generator");
  assert.deepEqual(decoded.messages.map((m) => m.role), ["user", "assistant"]);
  const picked = chatgpt.pickRecipeMessage(decoded.messages);
  assert.ok(picked);
  const recipe = parser.parseRecipeText(picked.text);
  assert.equal(recipe.name, "Creamy Garlic Chicken with Spinach & Rice");
  assert.equal(recipe.ingredients.length, 13);
  assert.equal(recipe.instructions.length, 5);
});

test("picks the latest recipe in a multi-turn chat and ignores hidden/system messages", () => {
  const html = sharePage(encodeTurboStream({
    loaderData: { route: { serverResponse: { data: {
      title: "Dinner ideas",
      linear_conversation: [
        { message: message("system", "You are ChatGPT.", 1, { is_visually_hidden_from_conversation: true }) },
        { message: message("user", "Chili recipe please", 2) },
        { message: message("assistant", CHILI, 3) },
        { message: message("user", "Make it vegetarian", 4) },
        { message: message("assistant", VEGGIE, 5) },
        { message: message("user", "Thanks!", 6) },
        { message: message("assistant", "You're welcome! Enjoy.", 7) },
      ],
    } } } },
  }));
  const decoded = chatgpt.decodeChatGptShareHtml(html);
  assert.equal(decoded.method, "turbo-stream");
  assert.equal(decoded.title, "Dinner ideas");
  assert.ok(!decoded.messages.some((m) => m.role === "system"));
  const recipe = parser.parseRecipeText(chatgpt.pickRecipeMessage(decoded.messages).text);
  assert.equal(recipe.name, "Three-Bean Chili");
  assert.equal(recipe.instructions.length, 2);
});

test("falls back to the message mapping, ordered by time", () => {
  const html = sharePage(encodeTurboStream({
    data: { title: "Chili", mapping: {
      b: { message: message("assistant", CHILI, 20) },
      a: { message: message("user", "Chili please", 10) },
      root: { message: null },
    } },
  }));
  const decoded = chatgpt.decodeChatGptShareHtml(html);
  assert.deepEqual(decoded.messages.map((m) => m.role), ["user", "assistant"]);
  assert.equal(decoded.title, "Chili");
});

test("falls back to recipe-looking strings, then to page text", () => {
  const strings = chatgpt.decodeChatGptShareHtml(sharePage(["unexpected shape", CHILI]));
  assert.equal(strings.method, "string-table");
  assert.ok(chatgpt.pickRecipeMessage(strings.messages));

  const html = "<html><head><title>ChatGPT - Soup</title></head><body><main><h2>Tomato Soup</h2><h3>Ingredients</h3><ul><li>2 cans tomatoes</li><li>1 onion</li><li>2 cups stock</li></ul><h3>Instructions</h3><ol><li>Simmer everything.</li><li>Blend.</li></ol></main></body></html>";
  const page = chatgpt.decodeChatGptShareHtml(html);
  assert.equal(page.method, "html");
  assert.equal(parser.parseRecipeText(chatgpt.pickRecipeMessage(page.messages).text).ingredients.length, 3);
});

test("unreadable or recipe-free share pages decode to nothing without throwing", () => {
  assert.equal(chatgpt.decodeChatGptShareHtml("<html><body>Log in</body></html>").messages.length, 0);
  assert.equal(chatgpt.decodeChatGptShareHtml('<script>streamController.enqueue("[{\\"broken");</script>').method, "none");
  const chatty = sharePage(encodeTurboStream({ linear_conversation: [{ message: message("assistant", "Hi! How can I help?", 1) }] }));
  assert.equal(chatgpt.pickRecipeMessage(chatgpt.decodeChatGptShareHtml(chatty).messages), null);
});

test("hydrator survives cycles and huge reference chains", () => {
  const cyclic = [{ _1: 0 }, "self"];
  assert.doesNotThrow(() => chatgpt.hydrateTurboStream(cyclic));
  const deep = Array.from({ length: 5000 }, (_, i) => [i + 1]);
  deep.push("end");
  assert.doesNotThrow(() => chatgpt.hydrateTurboStream(deep));
});

test("strips the 'ChatGPT - ' title prefix", () => {
  assert.equal(chatgpt.cleanChatTitle("ChatGPT - Recipe Generator"), "Recipe Generator");
  assert.equal(chatgpt.cleanChatTitle("Lasagna"), "Lasagna");
});

// ---------- web page fallbacks ----------

test("reads schema.org microdata when a page has no JSON-LD", () => {
  const html = `<div itemscope itemtype="https://schema.org/Recipe">
    <h1 itemprop="name">Old-School Meatloaf</h1>
    <meta itemprop="prepTime" content="PT15M"><meta itemprop="cookTime" content="PT1H">
    <span itemprop="recipeYield">6 servings</span>
    <ul><li itemprop="recipeIngredient">2 lb ground beef</li><li itemprop="recipeIngredient">1 cup <b>breadcrumbs</b></li></ul>
    <ol><li itemprop="recipeInstructions">Mix everything.</li><li itemprop="recipeInstructions">Bake 1 hour.</li></ol>
  </div>`;
  const recipe = direct.extractRecipeMicrodata(html);
  assert.equal(recipe.name, "Old-School Meatloaf");
  assert.equal(recipe.prepTime, "PT15M");
  assert.equal(recipe.cookTime, "PT1H");
  assert.deepEqual(recipe.recipeIngredient, ["2 lb ground beef", "1 cup breadcrumbs"]);
  assert.deepEqual(recipe.recipeInstructions, ["Mix everything.", "Bake 1 hour."]);
  assert.equal(direct.extractRecipeMicrodata("<p>No recipe here</p>"), null);
});

test("reader-markdown fallback handles setext headings and wrapped numbered steps", () => {
  const markdown = "Ingredients\n-----------\n\n* 2 cups flour\n* 1 tsp salt\n\nProcedure\n---------\n\nDirections\n----------\n\n1. **Mix the dough**\n   Stir the flour and salt with water.\n2. Knead for 10 minutes.\n\nNotes\n-----\nKeeps for a day.";
  assert.deepEqual(fallback.ingredientLines(markdown), ["2 cups flour", "1 tsp salt"]);
  assert.deepEqual(fallback.instructionLines(markdown), ["Mix the dough: Stir the flour and salt with water.", "Knead for 10 minutes."]);
});
