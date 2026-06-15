/**
 * food Search Query Match
 *
 * Purpose: Data/service layer: food Search Query Match. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: normalizeQueryText, significantQueryTokens, isMenuStyleQuery, itemMatchesQuery, countTokenHits, isRetailFoodNoise, MENU_STYLE_PATTERN
 *
 * @file-header
 */
/**
 * Generic food-search relevance (no hardcoded restaurant chain lists).
 * Multi-word queries require every significant token as a whole word in the result
 * (e.g. "jets pizza" does not match "GUMMI JETS" candy).
 */

const QUERY_STOP_WORDS = new Set([
  'with',
  'and',
  'from',
  'the',
  'for',
  'nutrition',
  'facts',
  'calories',
  'protein',
  'carbs',
  'carb',
  'fat',
  'menu',
  'item',
  'order',
  'serving',
  'size',
  // Size words — users type them; menu titles often omit them (e.g. "large cheese pizza").
  'large',
  'small',
  'medium',
  'regular',
  'personal',
  'family',
  'mini',
  'grand',
  'venti',
  'tall',
]);

/** Menu / prepared-food language — not a brand list. */
const MENU_STYLE_PATTERN =
  /\b(pizza|burger|sandwich|wrap|bowl|salad|taco|burrito|wing|wings|nugget|nuggets|combo|meal|latte|mocha|frappuccino|sub\b|hoagie|calzone|pasta|entree|appetizer|deep\s*dish|corner|slice|cheeseburger|hamburger|quesadilla|nachos|fries|chicken\s+fingers)\b/i;

const GROCERY_INGREDIENT_PATTERN =
  /\b(chicken breast|ground beef|brown rice|white rice|olive oil|greek yogurt|almond milk|protein powder|raw\s+chicken|boneless\s+skinless)\b/i;

function normalizeQueryText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[''`]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRe(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Significant words from the user's search (used for matching, not a brand directory). */
function significantQueryTokens(query) {
  return normalizeQueryText(query)
    .split(' ')
    .filter((w) => w.length > 2 && !QUERY_STOP_WORDS.has(w));
}

/**
 * True when the query looks like a restaurant menu item / prepared food, not plain groceries.
 */
function isMenuStyleQuery(query) {
  const q = normalizeQueryText(query);
  if (!q || q.length < 3) return false;
  if (GROCERY_INGREDIENT_PATTERN.test(q)) return false;

  const tokens = significantQueryTokens(query);
  if (tokens.length >= 2) return true;
  if (tokens.length === 1 && MENU_STYLE_PATTERN.test(q)) return true;
  if (/\b\d+\s*(piece|pc|pcs|slice|oz|fl\s*oz)\b/i.test(q) && MENU_STYLE_PATTERN.test(q)) {
    return true;
  }
  return false;
}

function countTokenHits(text, tokens) {
  const hay = normalizeQueryText(text);
  let hits = 0;
  for (const t of tokens) {
    try {
      if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(hay)) hits += 1;
    } catch {
      if (hay.includes(t)) hits += 1;
    }
  }
  return hits;
}

/**
 * Whether a food row is plausibly what the user searched for.
 * @param {string} itemText - combined name + brand
 * @param {string} query - user search string
 */
function itemMatchesQuery(itemText, query) {
  const tokens = significantQueryTokens(query);
  if (tokens.length === 0) return true;
  const hits = countTokenHits(itemText, tokens);
  if (tokens.length >= 2) return hits >= tokens.length;
  return hits >= 1;
}

/** Grocery-aisle products that share a menu word (pizza sauce, etc.). */
function isRetailFoodNoise(text) {
  const t = String(text || '').toLowerCase();
  return (
    /\bpizza\s+sauce\b|\bpizza\s*,\s*sauce\b|\bpizza\s+dough\b|\bpizza\s+crackers\b|\bpizza\s+paste\b/i.test(
      t,
    ) || /\b(bourekas|empanadas|pastelillos|bruschette)\b/i.test(t)
  );
}

module.exports = {
  normalizeQueryText,
  significantQueryTokens,
  isMenuStyleQuery,
  itemMatchesQuery,
  countTokenHits,
  isRetailFoodNoise,
  MENU_STYLE_PATTERN,
};
