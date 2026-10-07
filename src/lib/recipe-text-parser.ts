/**
 * No-AI parser that turns free-form recipe text (ChatGPT markdown, notes, texts, captions)
 * into structured fields. Dependency-free so it can run anywhere and be unit tested.
 */

export type ParsedRecipeText = {
  name: string;
  description: string;
  servings: number | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  ingredients: string[];
  instructions: string[];
  /** True when at least ingredients or steps were found. */
  found: boolean;
};

type Section = "intro" | "ingredients" | "steps" | "other";

const INGREDIENT_HEADING = /^(?:the\s+)?(?:ingredients?|ingredient list|what you(?:'|’)ll need|you(?:'|’)ll need|you will need|shopping list)\b/i;
const STEP_HEADING = /^(?:the\s+)?(?:instructions?|directions?|method|steps?|preparation|prep(?:aration)? steps|how to make(?: it)?|cooking instructions)\b/i;
const OTHER_HEADING = /^(?:tips?|chef(?:'|’)s tips?|notes?|recipe notes|substitutions?|swaps?|variations?|serving suggestions?|serve with|what to serve|to serve|storage|storing|leftovers|make[- ]ahead|freezing|reheating|how to tell|doneness|nutrition|equipment|tools|why (?:this|it) works|faq|optional add-ons|enjoy)/i;
// "Prep time", "Cook: 20 min", "Bake 25 minutes", "Serves 4" (but not a step heading like "Cook the noodles").
const META_LABEL = /^(?:prep|cook|cooking|total|active|inactive|bake|baking|ready)\s*(?:time\b|(?=\s*[:\-–|]|\s*$|\s+\d|\s+in\b))|^(?:serves|servings|yield|makes|portions)\b/i;
const GENERIC_TITLE = /^(?:recipe generator|recipe|the recipe|here(?:'|’)s|absolutely|sure|of course|great|okay|ok)\b/i;
const CHATTER = /^(?:absolutely|sure|of course|great (?:choice|question|idea)|here(?:'|’)s|here is|okay|ok[,!]|happy to|i(?:'|’)d be|i hope|hope you|let me know|would you like|want me to|do you want|if you(?:'|’)d like|if you want|enjoy|bon app[ée]tit|feel free)/i;
const BULLET = /^(?:[-*+•▪◦‣–]|\u2022)\s+(.+)$/;
const NUMBERED = /^(?:step\s*)?(\d{1,2})\s*[.):]\s+(.+)$/i;

/** Remove markdown emphasis/links/emoji and collapse whitespace. */
export function cleanRecipeLine(line: string) {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)(?=\[)/g, "$1 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/(^|[\s(])[*_](\S(?:[^*_]*\S)?)[*_](?=$|[\s).,;:!?])/g, "$1$2")
    .replace(/[\p{Extended_Pictographic}\u200d\uFE0F\u20E3]/gu, "")
    .replace(/\\([#>*_`\-.])/g, "$1")
    .replace(/[ \t\u00a0]+/g, " ")
    .trim();
}

function stripTrailingColon(value: string) {
  return value.replace(/\s*:\s*$/, "").trim();
}

/** Returns heading text when the line is a heading (markdown #, a bold-only line, or a short "Label:" line). */
function headingText(line: string, nextLine: string | undefined): string | null {
  const atx = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
  if (atx) return stripTrailingColon(cleanRecipeLine(atx[1]));
  const bold = line.match(/^(?:\*\*|__)([^*_]+?)(?:\*\*|__)\s*:?\s*$/) ?? line.match(/^(?:\*\*|__)([^*_]+?):(?:\*\*|__)\s*$/);
  if (bold) return stripTrailingColon(cleanRecipeLine(bold[1]));
  if (nextLine !== undefined && /^(?:=+|-{2,})\s*$/.test(nextLine) && !BULLET.test(line)) return stripTrailingColon(cleanRecipeLine(line));
  const cleaned = cleanRecipeLine(line);
  if (/:$/.test(cleaned) && cleaned.length <= 48 && !/^\d/.test(cleaned) && !BULLET.test(line)) return stripTrailingColon(cleaned);
  if ((INGREDIENT_HEADING.test(cleaned) || STEP_HEADING.test(cleaned)) && cleaned.length <= 40 && !/[.!?]$/.test(cleaned)) return cleaned;
  return null;
}

function headingSection(heading: string): Section | null {
  const text = heading.replace(/^[^\p{L}\d]+/u, "");
  if (INGREDIENT_HEADING.test(text)) return "ingredients";
  if (STEP_HEADING.test(text)) return "steps";
  if (OTHER_HEADING.test(text)) return "other";
  return null;
}

function toNumber(value: string) {
  const unicode: Record<string, number> = { "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3 };
  const mixed = value.match(/^(\d+)\s*([¼½¾⅓⅔])$/);
  if (mixed) return Number(mixed[1]) + unicode[mixed[2]];
  if (unicode[value] !== undefined) return unicode[value];
  const fraction = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1]) + Number(fraction[2]) / Number(fraction[3]);
  const simple = value.match(/^(\d+)\/(\d+)$/);
  if (simple) return Number(simple[1]) / Number(simple[2]);
  return Number(value);
}

/** "1 hour 15 minutes", "25–30 min", "1 1/2 hours" → minutes (ranges use the upper bound). */
export function durationTextMinutes(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase().replace(/[–—]/g, "-");
  const num = String.raw`(\d+(?:\s+\d+\/\d+|\s*[¼½¾⅓⅔]|\.\d+|\/\d+)?)`;
  const pick = (unit: string) => {
    const match = lower.match(new RegExp(`${num}(?:\\s*(?:-|to)\\s*${num})?\\s*(?:${unit})\\b`));
    if (!match) return 0;
    return toNumber((match[2] ?? match[1]).trim());
  };
  const total = pick("h|hr|hrs|hours?") * 60 + pick("m|min|mins|minutes?");
  return total > 0 ? Math.round(total) : null;
}

function labeledValue(lines: string[], labels: RegExp): string {
  for (let i = 0; i < lines.length; i += 1) {
    // Several labels can share a line: "Serves: 4 | Prep time: 10 minutes | Cook time: 20 minutes".
    for (const part of lines[i].split(/\s*[|•·]\s*/)) {
      const match = part.match(labels);
      if (!match) continue;
      const rest = part.slice((match.index ?? 0) + match[0].length).replace(/^\s*(?:time)?\s*[:\-–]?\s*/i, "").trim();
      if (rest) return rest;
      // Heading-style label with the value on the next line ("### Prep Time" / "10 minutes").
      const next = lines[i + 1];
      if (next && next.length <= 40) return next;
    }
  }
  return "";
}

function servingsFrom(lines: string[]): number | null {
  const joined = lines.join("\n");
  const patterns = [
    /\b(?:serves|servings|yield|makes|portions)\b\s*(?:about|approximately|approx\.?|up to)?\s*[:\-–]?\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)(?:\s*[-–]\s*\d+)?\s+(?:servings|portions|people)\b/i,
  ];
  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (value > 0 && value <= 100) return value;
    }
  }
  return null;
}

function looksLikeIngredient(line: string) {
  return /^(?:\d|[¼½¾⅓⅔⅛]|a (?:pinch|handful|dash|few)\b|one\b|two\b|three\b|salt\b|pinch\b)/i.test(line);
}

function isChatter(line: string) {
  return CHATTER.test(line) || (/\?$/.test(line) && line.length < 160);
}

function joinStep(title: string, body: string) {
  if (!title) return body;
  return /[.:!?]$/.test(title) ? `${title} ${body}` : `${title}: ${body}`;
}

/** Folds a sub-bullet into a step: "season with: 1 tsp salt; ½ tsp pepper". */
function appendBullet(step: string, item: string) {
  if (!step) return item;
  return /[.!?:;]$/.test(step) ? `${step} ${item}` : `${step}; ${item}`;
}

/** "1. Prep", "Step 2: Heat the grill", "Step 3", "4) Rest" used as a heading → the title ("" when only a number). */
function numberedHeading(heading: string): string | null {
  const numbered = heading.match(/^(?:step\s*)?\d{1,2}(?:\s*[.):]|\s+[-–—])\s+(.+)$/i);
  if (numbered) return numbered[1].trim();
  const step = heading.match(/^step\s*\d{1,2}\s*[.:\-–—]?\s*(.*)$/i);
  return step ? step[1].trim() : null;
}

// Asides inside steps that are commentary, not instructions ("**My pick:** …", "If you're using a Traeger, I'd …").
const STEP_ASIDE = /^(?:my (?:pick|take|tip|favorite)|pro tip|tip|note|chef(?:'|’)s note|optional tip)\b[^:]{0,20}:|\b(?:I(?:'|’)d|I would|I recommend|I like to|I prefer)\b/i;

const STEP_INTRO = /\b(?:how to make|steps|directions|instructions|method)\b/i;

type OpenStep = { kind: "numbered" | "bullet" | "heading" | "plain"; hasBody: boolean; label: boolean; listTail?: boolean };

export function parseRecipeText(input: string): ParsedRecipeText {
  const rawLines = input.replace(/\r\n?/g, "\n").split("\n").map((line) => line.replace(/\s+$/, ""));
  const cleanedAll = rawLines.map(cleanRecipeLine).filter(Boolean);

  let section: Section = "intro";
  // "other" reached by prose rather than an explicit heading ("Tips", "Storage"): steps may still follow.
  let softOther = false;
  let sawIngredientBullets = false;
  let previousBlank = true;
  let open: OpenStep | null = null;
  let listMode = false;
  let pendingLabel = "";
  const introHeadings: string[] = [];
  const introLines: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];

  const nextContent = (from: number) => {
    for (let j = from; j < rawLines.length; j += 1) if (rawLines[j].trim()) return rawLines[j];
    return "";
  };
  const isTopLevelNumbered = (raw: string) => {
    const match = raw.match(NUMBERED);
    return Boolean(match) && !/^\s{2,}|^\t/.test(raw) && !looksLikeIngredient(cleanRecipeLine(match![2]));
  };
  const setLast = (value: string) => {
    steps[steps.length - 1] = value;
  };
  const dropEmptyLabel = () => {
    if (open?.label && !open.hasBody) steps.pop();
  };
  const startStep = (text: string, kind: OpenStep["kind"], label = false) => {
    steps.push(pendingLabel && kind !== "heading" ? joinStep(pendingLabel, text) : text);
    if (kind !== "heading") pendingLabel = "";
    open = { kind, hasBody: kind !== "heading", label };
    if (kind !== "plain") listMode = true;
  };
  const enterSteps = () => {
    section = "steps";
    softOther = false;
    open = null;
  };
  // A heading inside the steps: "### 1. Prep" (a step with its body below) or "Make the sauce" (a step, or a label for the list under it).
  const stepHeading = (heading: string) => {
    dropEmptyLabel();
    const title = numberedHeading(heading);
    if (title !== null) startStep(title, "heading");
    // "Here's how to make it:" introduces the steps; it isn't a step label.
    else if (isChatter(heading) || STEP_INTRO.test(heading)) open = null;
    else startStep(heading, "heading", true);
  };

  for (let i = 0; i < rawLines.length; i += 1) {
    const raw = rawLines[i];
    const line = raw.trim();
    if (!line) {
      previousBlank = true;
      continue;
    }
    if (/^(?:[-*_]\s*){3,}$/.test(line) || /^(?:=+|-{2,})$/.test(line)) {
      // A horizontal rule closes the current step.
      previousBlank = true;
      if (section === "steps") {
        dropEmptyLabel();
        open = null;
      }
      continue;
    }

    const heading = headingText(line, rawLines[i + 1]?.trim());
    if (heading !== null) {
      const numberedTitle = numberedHeading(heading);
      // "Step 1: Prep the pan" is a step, not an "Steps" section heading.
      const next = numberedTitle === null ? headingSection(heading) : null;
      if (next) {
        if (section === "steps") dropEmptyLabel();
        section = next;
        softOther = false;
        open = null;
        pendingLabel = "";
        if (next === "steps") listMode = false;
        previousBlank = true;
        continue;
      }
      const colonLabel = !/^(?:#|\*\*|__)/.test(line) && /:$/.test(cleanRecipeLine(line));
      const openStep = open as OpenStep | null;
      if (section === "steps" && colonLabel && openStep?.kind === "heading" && numberedTitle === null) {
        // "For a 1½-inch steak:" inside "### 3. Grill" is part of that step's text.
        setLast(openStep.hasBody ? `${steps[steps.length - 1]} ${cleanRecipeLine(line)}` : joinStep(steps[steps.length - 1], cleanRecipeLine(line)));
        openStep.hasBody = true;
      } else if (section === "steps" && isChatter(heading) && !STEP_INTRO.test(heading)) {
        // "If you want, I can:" — the assistant has moved on from the recipe.
        dropEmptyLabel();
        section = "other";
        softOther = false;
        open = null;
      } else if (section === "steps") {
        if (!META_LABEL.test(heading)) stepHeading(heading);
      } else if (numberedTitle !== null && (section !== "other" || softOther)) {
        // "### 1. Prep" right after the ingredients, with no "Instructions" heading.
        enterSteps();
        stepHeading(heading);
      } else if (section === "intro") {
        if (!META_LABEL.test(heading)) introHeadings.push(heading);
        else introLines.push(line);
      } else if (section === "ingredients" && !META_LABEL.test(heading)) {
        const after = nextContent(i + 1);
        const afterClean = cleanRecipeLine(after);
        const leadsSteps =
          isTopLevelNumbered(after) ||
          (!BULLET.test(after.trim()) && !NUMBERED.test(after.trim()) && headingText(after.trim(), undefined) === null && afterClean.length >= 60 && !looksLikeIngredient(afterClean) && !isChatter(afterClean));
        if (sawIngredientBullets && leadsSteps) {
          // "Make the sauce" followed by steps, not an ingredient group.
          enterSteps();
          stepHeading(heading);
        } else {
          // Sub-group such as "For the sauce" stays as a label line in the ingredient list.
          ingredients.push(`${heading}:`);
        }
      } else if (section === "other" && softOther && isTopLevelNumbered(nextContent(i + 1)) && !steps.length) {
        enterSteps();
        stepHeading(heading);
      }
      previousBlank = false;
      continue;
    }

    const bullet = line.match(BULLET);
    const numbered = line.match(NUMBERED);
    const cleaned = cleanRecipeLine(line);
    const indented = /^\s{2,}|^\t/.test(raw);

    if (section === "ingredients") {
      if (numbered && sawIngredientBullets && !looksLikeIngredient(cleanRecipeLine(numbered[2]))) {
        // A numbered list straight after the ingredient bullets is the method.
        enterSteps();
        i -= 1;
        continue;
      }
      if (bullet) {
        sawIngredientBullets = true;
        const item = cleanRecipeLine(bullet[1]);
        if (item) ingredients.push(item);
      } else if (numbered) {
        ingredients.push(cleanRecipeLine(numbered[2]));
      } else if (!sawIngredientBullets && !isChatter(cleaned)) {
        ingredients.push(cleaned);
      } else if (sawIngredientBullets && previousBlank && !looksLikeIngredient(cleaned)) {
        // Prose after a bulleted list ("You can also use thighs.") ends the list.
        section = "other";
        softOther = true;
      } else if (sawIngredientBullets && looksLikeIngredient(cleaned)) {
        ingredients.push(cleaned);
      }
    } else if (section === "other" && softOther && numbered && !steps.length && !looksLikeIngredient(cleanRecipeLine(numbered[2]))) {
      enterSteps();
      i -= 1;
      continue;
    } else if (section === "steps") {
      const current = open as OpenStep | null;
      if (numbered && !(indented && current) && !(current?.kind === "heading" && !current.label)) {
        if (current?.kind === "heading" && current.label && !current.hasBody) {
          // "Make the sauce" then "1. …": the heading labels the first step of this list.
          pendingLabel = steps.pop() ?? "";
        }
        startStep(cleanRecipeLine(numbered[2]), "numbered");
      } else if ((numbered || bullet) && current && (indented || current.kind === "heading" || (current.kind === "numbered" && (!previousBlank || /:$/.test(steps[steps.length - 1]))))) {
        // Nested bullets/numbers under a step fold into that step.
        const item = cleanRecipeLine((numbered ? numbered[2] : bullet![1]));
        setLast(current.hasBody ? appendBullet(steps[steps.length - 1], item) : joinStep(steps[steps.length - 1], item));
        current.hasBody = true;
        current.listTail = true;
      } else if (bullet) {
        startStep(cleanRecipeLine(bullet[1]), "bullet");
      } else if (STEP_ASIDE.test(cleaned)) {
        // Commentary inside the method; skip it but keep reading steps.
      } else if (isChatter(cleaned) && (previousBlank || !current)) {
        dropEmptyLabel();
        section = "other";
        softOther = false;
        open = null;
      } else if (current?.kind === "heading") {
        // Text after a folded sub-list starts a new sentence.
        const last = steps[steps.length - 1];
        setLast(current.listTail && !/[.!?:;]$/.test(last) ? `${last}. ${cleaned}` : joinStep(last, cleaned));
        current.hasBody = true;
        current.listTail = false;
      } else if (current && current.kind !== "plain" && (!previousBlank || indented)) {
        // Wrapped text under "1. **Sear the chicken**" belongs to that step.
        setLast(joinStep(steps[steps.length - 1], cleaned));
      } else if (listMode && previousBlank) {
        // A plain paragraph after a list of steps ends the steps.
        section = "other";
        softOther = true;
        open = null;
      } else {
        startStep(cleaned, "plain");
      }
    } else if (section === "intro") {
      introLines.push(line);
    }
    previousBlank = false;
  }
  if (section === "steps") dropEmptyLabel();

  // No headings at all: fall back to the shape of the lines.
  if (!ingredients.length && !steps.length) {
    for (const raw of rawLines) {
      const line = raw.trim();
      const numbered = line.match(NUMBERED);
      const bullet = line.match(BULLET);
      if (numbered) steps.push(cleanRecipeLine(numbered[2]));
      // Bullets after the numbered steps are usually serving notes or variations, not ingredients.
      else if (steps.length) continue;
      else if (bullet) ingredients.push(cleanRecipeLine(bullet[1]));
      else if (looksLikeIngredient(cleanRecipeLine(line)) && line.length <= 120) ingredients.push(cleanRecipeLine(line));
    }
  }

  const cleanedIntro = introLines.map(cleanRecipeLine).filter(Boolean);
  let name = [...introHeadings].reverse().find((heading) => !GENERIC_TITLE.test(heading) && heading.length <= 90) ?? "";
  if (!name) {
    name = cleanedIntro.find((line) => line.length >= 3 && line.length <= 80 && !/[.!?]$/.test(line) && !META_LABEL.test(line) && !isChatter(line) && !/\|/.test(line) && !looksLikeIngredient(line) && !BULLET.test(line) && !NUMBERED.test(line)) ?? "";
  }
  name = name.replace(/^(?:recipe|title)\s*:\s*/i, "").trim();

  const description = cleanedIntro.find((line) =>
    line.length >= 40 &&
    line !== name &&
    !isChatter(line) &&
    !META_LABEL.test(line) &&
    !/\b(?:prep|cook|total)\s*time\b|\bservings?\b|\bserves\b|\btakes\b/i.test(line),
  ) ?? "";

  const metaLines = cleanedAll.slice(0, 80);
  const prep = durationTextMinutes(labeledValue(metaLines, /\bprep(?:aration)?\s*(?:time)?\b/i));
  const cook = durationTextMinutes(labeledValue(metaLines, /\b(?:cook(?:ing)?|bake|baking)\s*(?:time)?\b/i));
  const total = durationTextMinutes(labeledValue(metaLines, /\b(?:total\s*(?:time)?|ready in|takes)\b/i));

  const finalIngredients = ingredients.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line && line.length <= 300);
  // Drop a trailing sub-group label with nothing under it.
  while (finalIngredients.length && /:$/.test(finalIngredients[finalIngredients.length - 1])) finalIngredients.pop();
  const finalSteps = steps.map((line) => line.replace(/\s+/g, " ").trim()).filter((line) => line && line.length <= 2000 && !isChatter(line));

  return {
    name,
    description,
    servings: servingsFrom(cleanedAll.slice(0, 120)),
    prep_minutes: prep,
    cook_minutes: cook,
    total_minutes: total,
    ingredients: finalIngredients,
    instructions: finalSteps,
    found: finalIngredients.length > 0 || finalSteps.length > 0,
  };
}
