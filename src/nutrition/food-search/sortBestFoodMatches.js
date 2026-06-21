/**
 * food Search Query Match
 *
 * Purpose: Shared relevance scoring + soft filtering for client and server food search.
 * Philosophy: rank first, hard-filter only obvious junk — never empty a list that had plausible hits.
 *
 * @file-header
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
  // Grocery descriptors — users type them; product titles often omit them.
  'greek',
  'whole',
  'skim',
  'organic',
  'natural',
  'fresh',
  'frozen',
  'raw',
  'cooked',
  'unsweetened',
  'sweetened',
  'original',
  'classic',
]);

/** Menu / prepared-food language — not a brand list. */
const MENU_STYLE_PATTERN =
  /\b(pizza|burger|sandwich|wrap|bowl|salad|taco|burrito|wing|wings|nugget|nuggets|combo|meal|latte|mocha|frappuccino|sub\b|hoagie|calzone|pasta|entree|appetizer|deep\s*dish|corner|slice|cheeseburger|hamburger|quesadilla|nachos|fries|chicken\s+fingers)\b/i;

const GROCERY_INGREDIENT_PATTERN =
  /\b(chicken breast|boneless\s+skinless|skinless\s+boneless|ground beef|ground turkey|pork chop|salmon fillet|tilapia|shrimp|turkey breast|brown rice|white rice|olive oil|greek yogurt|almond milk|protein powder|raw\s+chicken)\b/i;

const PACKAGED_SUPPLEMENT_PATTERN =
  /\b(whey|protein powder|pre workout|preworkout|creatine|bcaa|isolate|mass gainer|casein|collagen|greens powder|electrolyte|energy drink mix)\b/i;

/** Category words — useful for ranking, not for requiring every token in the title. */
const PRODUCT_GENERIC_WORDS = new Set([
  'protein',
  'whey',
  'powder',
  'isolate',
  'blend',
  'supplement',
  'flavor',
  'flavour',
  'lifestyle',
  'nutrition',
  'snack',
  'bar',
  'drink',
  'mix',
  'cereal',
  'yogurt',
  'milk',
  'cheese',
  'bread',
  'cookie',
  'cookies',
  'cracker',
  'crackers',
  'chips',
  'soup',
  'sauce',
  'juice',
  'water',
  'soda',
  'coffee',
  'tea',
]);

function isGroceryIngredientQuery(query) {
  const q = normalizeQueryText(query);
  return !!q && GROCERY_INGREDIENT_PATTERN.test(q);
}

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

function quantityTokenAliases(token) {
  const t = String(token || '').toLowerCase();
  const m = t.match(/^(\d+)(pc|pcs|piece|pieces|pk|pack)$/i);
  if (!m) return [t];
  const n = m[1];
  return [t, n, `${n}pc`, `${n}pcs`, `${n} piece`, `${n} pieces`, `${n}-piece`, `${n}-pc`];
}

function tokenHitsInHay(hay, token) {
  const variants = new Set(quantityTokenAliases(token));
  const t = String(token || '').toLowerCase();
  if (t.endsWith('s') && t.length > 3) variants.add(t.slice(0, -1));
  if (t.length > 2 && !t.endsWith('s')) variants.add(`${t}s`);

  for (const variant of variants) {
    try {
      if (new RegExp(`\\b${escapeRe(variant)}\\b`, 'i').test(hay)) return true;
    } catch {
      if (hay.includes(variant)) return true;
    }
  }
  return false;
}

function significantQueryTokens(query) {
  return normalizeQueryText(query)
    .split(' ')
    .filter((w) => w.length > 2 && !QUERY_STOP_WORDS.has(w));
}

function isMenuStyleQuery(query) {
  const q = normalizeQueryText(query);
  if (!q || q.length < 3) return false;
  if (GROCERY_INGREDIENT_PATTERN.test(q)) return false;
  if (PACKAGED_SUPPLEMENT_PATTERN.test(q)) return false;

  try {
    const { findConsumerBrandInQuery } = require('../food-details/cleanFoodBrandName');
    if (findConsumerBrandInQuery(query)) return false;
  } catch (_) {
    /* optional in tests */
  }

  if (MENU_STYLE_PATTERN.test(q)) return true;
  if (/\b\d+\s*(piece|pc|pcs|slice|oz|fl\s*oz)\b/i.test(q) && MENU_STYLE_PATTERN.test(q)) {
    return true;
  }

  const tokens = significantQueryTokens(query);
  if (tokens.length === 1 && MENU_STYLE_PATTERN.test(q)) return true;
  return false;
}

function countTokenHits(text, tokens) {
  const hay = normalizeQueryText(text);
  let hits = 0;
  for (const t of tokens) {
    if (tokenHitsInHay(hay, t)) hits += 1;
  }
  return hits;
}

function getConsumerBrandInQuery(query) {
  try {
    const { findConsumerBrandInQuery } = require('../food-details/cleanFoodBrandName');
    return findConsumerBrandInQuery(query) || null;
  } catch (_) {
    return null;
  }
}

function brandTokensFromQuery(query) {
  const brand = getConsumerBrandInQuery(query);
  if (!brand) return [];
  return normalizeQueryText(brand).split(' ').filter((w) => w.length > 1);
}

function distinctiveQueryTokens(query) {
  const brandParts = brandTokensFromQuery(query);
  return significantQueryTokens(query).filter(
    (t) => !brandParts.includes(t) && !PRODUCT_GENERIC_WORDS.has(t),
  );
}

function textIncludesBrand(itemText, brandLabel) {
  const hay = normalizeQueryText(itemText);
  const brandNorm = normalizeQueryText(brandLabel);
  if (!brandNorm) return false;
  if (new RegExp(`\\b${escapeRe(brandNorm)}\\b`, 'i').test(hay)) return true;
  const first = brandNorm.split(' ')[0];
  return first.length > 2 && new RegExp(`\\b${escapeRe(first)}\\b`, 'i').test(hay);
}

function rowSearchText(row) {
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || ''}`.trim();
}

/**
 * Higher = better match. Used for ranking; thresholds vary by query type.
 */
function scoreFoodSearchRelevance(itemText, query) {
  const tokens = significantQueryTokens(query);
  const hay = normalizeQueryText(itemText);
  const qNorm = normalizeQueryText(query);
  if (!tokens.length) return 1;

  let score = countTokenHits(itemText, tokens) * 12;

  const phrase = tokens.join(' ');
  if (phrase.length >= 4 && hay.includes(phrase)) score += 45;
  if (tokens.length >= 2 && hay.includes(tokens.slice(0, 2).join(' '))) score += 22;

  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand) {
    if (textIncludesBrand(itemText, requiredBrand)) score += 35;
    else score -= 120;
    const flavorTokens = distinctiveQueryTokens(query);
    score += countTokenHits(itemText, flavorTokens) * 8;
  }

  if (isMenuStyleQuery(query)) {
    if (isRetailFoodNoise(itemText)) score -= 200;
    if (/\bjets\b/.test(qNorm) && /\bpizza\b/.test(qNorm) && /\bcandy|gummi\b/.test(hay)) {
      score -= 200;
    }
  }

  if (tokens.length >= 2 && countTokenHits(itemText, tokens) === 0) score -= 40;

  return score;
}

/** Minimum token hits for a row to count as a match (varies by query type). */
function minTokenHitsForMatch(query) {
  const tokens = significantQueryTokens(query);
  if (tokens.length <= 1) return 1;

  if (isMenuStyleQuery(query)) return tokens.length;

  const brand = getConsumerBrandInQuery(query);
  if (brand) {
    const flavor = distinctiveQueryTokens(query);
    return flavor.length > 0 ? 1 : 0;
  }

  if (tokens.length === 2) return 2;
  return Math.max(1, Math.ceil(tokens.length * 0.5));
}

function itemMatchesQuery(itemText, query) {
  const tokens = significantQueryTokens(query);
  if (!tokens.length) return true;

  if (isRetailFoodNoise(itemText) && isMenuStyleQuery(query)) return false;

  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand) {
    if (!textIncludesBrand(itemText, requiredBrand)) return false;
    const flavorTokens = distinctiveQueryTokens(query);
    if (flavorTokens.length === 0) return true;
    if (countTokenHits(itemText, flavorTokens) >= 1) return true;
    return scoreFoodSearchRelevance(itemText, query) >= 28;
  }

  const hits = countTokenHits(itemText, tokens);
  return hits >= minTokenHitsForMatch(query);
}

/**
 * Rank + soft-filter search rows. Never returns empty when plausible candidates exist.
 */
function filterFoodSearchRows(query, rows, limit = 20) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const requiredBrand = getConsumerBrandInQuery(query);
  const menuStyle = isMenuStyleQuery(query);
  const minHits = minTokenHitsForMatch(query);

  const candidates = list.filter((row) => {
    const text = rowSearchText(row);
    if (isRetailFoodNoise(text)) return false;
    if (requiredBrand && !textIncludesBrand(text, requiredBrand)) return false;
    return true;
  });

  if (!candidates.length) return [];

  const scored = candidates
    .map((row) => ({
      row,
      score: scoreFoodSearchRelevance(rowSearchText(row), query),
      hits: countTokenHits(rowSearchText(row), significantQueryTokens(query)),
    }))
    .sort((a, b) => b.score - a.score || b.hits - a.hits);

  const strong = scored.filter((entry) => {
    if (menuStyle) return entry.hits >= minHits && itemMatchesQuery(rowSearchText(entry.row), query);
    if (requiredBrand) return itemMatchesQuery(rowSearchText(entry.row), query);
    return entry.hits >= minHits;
  });

  const pick = (entries) => entries.slice(0, limit).map((e) => e.row);

  if (strong.length > 0) return pick(strong);

  if (menuStyle) return [];

  // Packaged / grocery / brand: show best available rather than nothing.
  const loose = scored.filter((e) => e.hits >= 1 || e.score >= 20);
  if (loose.length > 0) return pick(loose);

  return pick(scored);
}

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
  isGroceryIngredientQuery,
  itemMatchesQuery,
  scoreFoodSearchRelevance,
  filterFoodSearchRows,
  countTokenHits,
  isRetailFoodNoise,
  MENU_STYLE_PATTERN,
};
