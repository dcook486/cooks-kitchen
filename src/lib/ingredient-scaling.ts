const unicodeFractions: Record<string, number> = {
  "¼": 1 / 4,
  "½": 1 / 2,
  "¾": 3 / 4,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 1 / 8,
  "⅜": 3 / 8,
  "⅝": 5 / 8,
  "⅞": 7 / 8,
};

function parseQuantity(value: string) {
  const trimmed = value.trim();
  if (unicodeFractions[trimmed] != null) return unicodeFractions[trimmed];

  const mixed = trimmed.match(/^(\d+)\s+(.+)$/);
  if (mixed) {
    const fraction = parseQuantity(mixed[2]);
    return fraction == null ? null : Number(mixed[1]) + fraction;
  }

  const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }

  const number = Number(trimmed);
  return Number.isFinite(number) ? number : null;
}

function formatQuantity(value: number) {
  const rounded = Math.round(value * 8) / 8;
  const whole = Math.floor(rounded);
  const remainder = Math.round((rounded - whole) * 8);
  const fractions: Record<number, string> = {
    1: "⅛",
    2: "¼",
    3: "⅜",
    4: "½",
    5: "⅝",
    6: "¾",
    7: "⅞",
  };

  if (!remainder) return String(whole);
  return whole ? `${whole} ${fractions[remainder]}` : fractions[remainder];
}

const quantityPattern = String.raw`((?:\d+\s+)?(?:\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])|\d+(?:\.\d+)?)`;

export function scaleIngredientLine(
  ingredient: string,
  originalServings: number | null | undefined,
  plannedServings: number | null | undefined,
) {
  if (!originalServings || !plannedServings || originalServings <= 0 || plannedServings <= 0) return ingredient;
  const ratio = plannedServings / originalServings;
  if (Math.abs(ratio - 1) < 0.001) return ingredient;

  const match = ingredient.match(new RegExp(`^(\\s*)${quantityPattern}(\\s*(?:-|–|to)\\s*${quantityPattern})?`, "i"));
  if (!match) return ingredient;

  const first = parseQuantity(match[2]);
  if (first == null) return ingredient;

  let replacement = formatQuantity(first * ratio);
  if (match[3] && match[4]) {
    const second = parseQuantity(match[4]);
    if (second != null) {
      const separator = match[3].slice(match[3].indexOf(match[4]) === -1 ? 0 : 0).replace(match[4], "");
      replacement += `${separator}${formatQuantity(second * ratio)}`;
    }
  }

  return `${match[1]}${replacement}${ingredient.slice(match[0].length)}`;
}

export function scaleIngredientLines(
  ingredients: string[],
  originalServings: number | null | undefined,
  plannedServings: number | null | undefined,
) {
  return ingredients.map((ingredient) => scaleIngredientLine(ingredient, originalServings, plannedServings));
}
