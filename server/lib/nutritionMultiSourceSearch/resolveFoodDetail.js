/**
 * Search-result ranking and brand slug helpers for nutrition detail resolution.
 */
const { isMenuStyleQuery } = require('../../../src/nutrition/food-search/sortBestFoodMatches');
const {
  isJunkFoodTitle,
  stripLegacyFoodTitleDecorations,
} = require('../../../src/nutrition/food-search/cleanFoodCardLabels');

const RESTAURANT_BRAND_SLUGS = {
  "mcdonald's": 'mcdonalds',
  mcdonalds: 'mcdonalds',
  "wendy's": 'wendys',
  wendys: 'wendys',
  'burger king': 'burger-king',
  'taco bell': 'taco-bell',
  chipotle: 'chipotle',
  subway: 'subway',
  kfc: 'kfc',
  'chick-fil-a': 'chick-fil-a',
  chickfila: 'chick-fil-a',
  panera: 'panera',
  'panera bread': 'panera',
  starbucks: 'starbucks',
  dominos: 'dominos',
  "domino's": 'dominos',
  'five guys': 'five-guys',
  'in-n-out': 'in-n-out',
  'krispy kreme': 'krispy-kreme',
  "jet's pizza": 'jets-pizza',
  jets: 'jets-pizza',
};

const FOODFACTO_BRAND_SLUGS = {
  ...RESTAURANT_BRAND_SLUGS,
  "mcdonald's": 'mcdonalds',
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'from',
  'for',
  'piece',
  'pieces',
  'pc',
  'oz',
  'ounce',
  'ounces',
  'cup',
  'cups',
  'serving',
  'size',
  'order',
  'without',
  'sauce',
]);

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\w\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function queryTokens(query, restaurant) {
  const combined = normalizeText(`${restaurant || ''} ${query || ''}`);
  return combined
    .split(/\s+/)
    .map((t) => t.replace(/(pc|piece|pieces)$/, (m) => m))
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function restaurantToBrandSlug(restaurant, map = RESTAURANT_BRAND_SLUGS) {
  const key = normalizeText(restaurant);
  if (!key) return null;
  if (map[key]) return map[key];
  for (const [label, slug] of Object.entries(map)) {
    if (key.includes(label) || label.includes(key)) return slug;
  }
  return key.replace(/\s+/g, '-').replace(/'/g, '');
}

function isRestaurantMenuQuery(query, restaurant) {
  const q = normalizeText(`${restaurant || ''} ${query || ''}`);
  return isMenuStyleQuery(q);
}

function extractSizeToken(query) {
  const q = normalizeText(query);
  const m = q.match(/\b(\d+)\s*(?:pc|piece|pieces)\b/);
  if (m) return `${m[1]}-piece`;
  const inch = q.match(/\b(\d+)\s*(?:inch|in)\b/);
  if (inch) return `${inch[1]}-inch`;
  return null;
}

/**
 * Score a search candidate (link label + href) against query tokens.
 */
function scoreSearchCandidate(label, href, tokens, restaurantSlug) {
  const text = normalizeText(`${label} ${href}`).replace(/-/g, ' ');
  if (!text) return 0;

  let score = 0;
  for (const token of tokens) {
    const t = token.replace(/-/g, ' ');
    if (text.includes(t)) score += 2;
    if (t.length >= 4 && text.includes(t.slice(0, Math.max(4, t.length - 1)))) score += 1;
  }

  if (restaurantSlug) {
    const slugSpaced = restaurantSlug.replace(/-/g, ' ');
    if (text.includes(restaurantSlug) || text.includes(slugSpaced)) score += 6;
  }

  const size = extractSizeToken(tokens.join(' '));
  if (size && text.includes(size.replace('-', ' '))) score += 8;
  if (/\/search|\/category|\/brand\/?$/i.test(href || '')) score -= 10;
  if (/\/foods\/f\/|fastfoodnutrition\.org\/[^/]+\/[^/]+\//i.test(href || '')) score += 3;

  return score;
}

function rankSearchCandidates(candidates, query, restaurant) {
  const tokens = queryTokens(query, restaurant);
  const restaurantSlug = restaurantToBrandSlug(restaurant);
  const scored = candidates
    .map((c) => ({
      ...c,
      score: scoreSearchCandidate(c.label || c.text || '', c.href || c.url || '', tokens, restaurantSlug),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored;
}

function pickBestCandidate(candidates, query, restaurant) {
  const ranked = rankSearchCandidates(candidates, query, restaurant);
  return ranked[0] || null;
}

function rankFatSecretFoods(foods, query, restaurant) {
  const tokens = queryTokens(query, restaurant);
  const restaurantSlug = restaurantToBrandSlug(restaurant);
  const scored = (foods || []).map((food) => {
    const label = `${food.brand_name || food.brand || ''} ${food.food_name || food.name || ''}`;
    const score = scoreSearchCandidate(label, '', tokens, restaurantSlug);
    return { food, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.food);
}

function wrapScraperResult(macros, meta = {}) {
  if (!macros) return null;
  let displayName = meta.displayName || macros.displayName || null;
  displayName = stripLegacyFoodTitleDecorations(displayName);
  if (isJunkFoodTitle(displayName)) displayName = null;
  return {
    calories: macros.calories,
    protein_g: macros.protein_g,
    carbs_g: macros.carbs_g,
    fat_g: macros.fat_g,
    fiber_g: macros.fiber_g,
    sodium_mg: macros.sodium_mg,
    url: meta.url || macros.url || null,
    servingLabel: meta.servingLabel || macros.servingLabel || null,
    displayName,
    servingBasis: meta.servingBasis || macros.servingBasis || 'per_serving',
  };
}

module.exports = {
  RESTAURANT_BRAND_SLUGS,
  FOODFACTO_BRAND_SLUGS,
  normalizeText,
  queryTokens,
  restaurantToBrandSlug,
  isRestaurantMenuQuery,
  extractSizeToken,
  scoreSearchCandidate,
  rankSearchCandidates,
  pickBestCandidate,
  rankFatSecretFoods,
  wrapScraperResult,
};
