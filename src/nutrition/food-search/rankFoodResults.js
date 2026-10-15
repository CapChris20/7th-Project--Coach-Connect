// Scores and filters food-search rows so only the typed name (or a near-exact title) is kept.
// Flow: split the query into tokens → drop cousins (diet Coke, Philly steak) → rank what remains.
// Used by client search and the server. Empty is better than junk. CommonJS for the food tests.

const { inferFoodServingCategory } = require('./guessServingLabel');

// ===== NAMED CONSTANTS =====

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

const OPTIONAL_CATEGORY_TOKENS = new Set([
  'cereal',
  'snack',
  'snacks',
  'bar',
  'bars',
  'drink',
  'beverage',
  'food',
  'style',
  'flavor',
  'flavour',
  'nutrition',
  'supplement',
  'powder',
  'meal',
  'combo',
  'large',
  'small',
  'medium',
  'regular',
  'personal',
  'family',
  'grand',
  'venti',
  'tall',
]);

const MENU_STYLE_PATTERN =
  /\b(pizza|burger|sandwich|wrap|bowl|salad|taco|burrito|wing|wings|nugget|nuggets|combo|meal|latte|mocha|frappuccino|sub\b|hoagie|calzone|pasta|entree|appetizer|deep\s*dish|corner|slice|cheeseburger|hamburger|quesadilla|nachos|fries|chicken\s+fingers|crazy\s*bread|breadstick|garlic\s+bread|cheesy\s+bread|big\s*mac|whopper|baconator|frosty)\b/i;

const GROCERY_INGREDIENT_PATTERN =
  /\b(chicken breast|boneless\s+skinless|skinless\s+boneless|ground beef|ground turkey|pork chop|salmon fillet|tilapia|shrimp|turkey breast|brown rice|white rice|olive oil|greek yogurt|almond milk|protein powder|raw\s+chicken)\b/i;

const PACKAGED_SUPPLEMENT_PATTERN =
  /\b(whey|protein powder|pre workout|preworkout|creatine|bcaa|isolate|mass gainer|casein|collagen|greens powder|electrolyte|energy drink mix)\b/i;

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

const CHAIN_TOKEN_PATTERNS = [
  /\blittle\s*caesars?\b/i,
  /\bmcdonald'?s?\b/i,
  /\bchipotle\b/i,
  /\bwendy'?s?\b/i,
  /\bdomino'?s?\b/i,
  /\bburger\s*king\b/i,
  /\btaco\s*bell\b/i,
  /\bstarbucks\b/i,
  /\bpapa\s*john'?s?\b/i,
  /\bpizza\s*hut\b/i,
  /\bchick[\s-]?fil[\s-]?a\b/i,
  /\bjets?\b/i,
  /\bsubway\b/i,
  /\bpanda\s*express\b/i,
  /\bfive\s*guys\b/i,
  /\bin[\s-]?n[\s-]?out\b/i,
];

const EXTRA_MENU_MODIFIERS = [
  'philly',
  'steak',
  'wisconsin',
  'pepperoni',
  'sausage',
  'supreme',
  'meat',
  'meats',
  'hawaiian',
  'buffalo',
  'bbq',
  'barbecue',
  'veggie',
  'vegetable',
  'mushroom',
  'bacon',
  'spinach',
  'feta',
  'goat',
  'extravaganza',
  'pacific',
  'deluxe',
  'stuffed',
  'brooklyn',
];

const EXTRA_VARIANT_MODIFIERS = [
  'diet',
  'zero',
  'zéro',
  'light',
  'lite',
  'seltzer',
  'sparkling',
  'feisty',
  'mini',
  'fridge',
  'multipack',
  'sugarfree',
  'caffeine',
];

const MENU_SIZES = ['small', 'medium', 'large', 'grande', 'venti', 'tall', 'regular'];
const MIN_MENU_QUERY_LENGTH = 3;
const ABSURD_SODA_FAT_G = 5;
const ABSURD_SODA_PROTEIN_G = 5;
const ABSURD_SODA_CALORIES = 450;
const ABSURD_SHAKE_CALORIES = 1200;
const LARGE_BOTTLE_OZ = 16;
const DEFAULT_FILTER_LIMIT = 8;
const CONSENSUS_SOURCE_BOOST = 300;
const TRUSTED_SOURCE_BOOST = 200;
const DB_SOURCE_BOOST = 80;
const TOKEN_HIT_SCORE = 12;
const PHRASE_BONUS = 45;
const TWO_TOKEN_PHRASE_BONUS = 22;
const ITEM_PHRASE_BONUS = 80;
const CHEESE_PIZZA_PHRASE_BONUS = 70;
const BRAND_MATCH_BONUS = 35;
const BRAND_MISS_PENALTY = 120;
const FLAVOR_HIT_SCORE = 8;
const RETAIL_NOISE_PENALTY = 200;
const FULL_ITEM_HIT_BONUS = 55;
const NO_ITEM_HIT_PENALTY = 110;
const PARTIAL_ITEM_HIT_SCORE = 12;
const UNREQUESTED_MODIFIER_PENALTY = 220;
const EXTRA_LARGE_PENALTY = 40;
const ASKED_LARGE_BONUS = 25;
const FOOD_FAMILY_PENALTY = 280;
const VARIANT_MISMATCH_PENALTY = 240;
const FLUID_OZ_MATCH_BONUS = 60;
const FLUID_OZ_MISS_PENALTY = 80;
const PIECE_COUNT_MATCH_BONUS = 50;
const PIECE_COUNT_MISS_PENALTY = 90;
const NO_TOKEN_HIT_PENALTY = 40;

// ===== HELPER FUNCTIONS =====

function normalizeQueryText(text) {
  return String(text || '')
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
  const tokenText = String(token || '').toLowerCase();
  const packMatch = tokenText.match(/^(\d+)(pc|pcs|piece|pieces|pk|pack)$/i);
  if (!packMatch) return [tokenText];
  const count = packMatch[1];
  return [tokenText, count, `${count}pc`, `${count}pcs`, `${count} piece`, `${count} pieces`, `${count}-piece`, `${count}-pc`];
}

function tokenHitsInHay(hay, token) {
  const variants = new Set(quantityTokenAliases(token));
  const tokenText = String(token || '').toLowerCase();
  if (tokenText.endsWith('s') && tokenText.length > 3) variants.add(tokenText.slice(0, -1));
  if (tokenText.length > 2 && !tokenText.endsWith('s')) variants.add(`${tokenText}s`);

  for (const variant of variants) {
    if (hayHasWord(hay, variant)) return true;
  }
  return false;
}

function hayHasWord(hay, variant) {
  try {
    return new RegExp(`\\b${escapeRe(variant)}\\b`, 'i').test(hay);
  } catch {
    return hay.includes(variant);
  }
}

function significantQueryTokens(query) {
  return normalizeQueryText(query)
    .split(' ')
    .filter((word) => {
      if (!word || QUERY_STOP_WORDS.has(word)) return false;
      if (/^\d/.test(word)) return true;
      return word.length > 2;
    });
}

function requiredQueryTokens(query) {
  const tokens = significantQueryTokens(query);
  const required = tokens.filter((token) => !OPTIONAL_CATEGORY_TOKENS.has(token));
  return required.length ? required : tokens;
}

function getConsumerBrandInQuery(query) {
  try {
    const { findConsumerBrandInQuery } = require('../food-details/tidyBrandName');
    return findConsumerBrandInQuery(query) || null;
  } catch (_) {
    return null;
  }
}

function brandTokensFromQuery(query) {
  const brand = getConsumerBrandInQuery(query);
  if (!brand) return [];
  return normalizeQueryText(brand).split(' ').filter((word) => word.length > 1);
}

function menuItemTokensFromQuery(query) {
  const brandParts = new Set(brandTokensFromQuery(query));
  let queryNorm = normalizeQueryText(query);
  for (const chainRe of CHAIN_TOKEN_PATTERNS) {
    queryNorm = queryNorm.replace(chainRe, ' ');
  }
  queryNorm = queryNorm.replace(/\s+/g, ' ').trim();
  return significantQueryTokens(queryNorm).filter((token) => !brandParts.has(token));
}

function distinctiveQueryTokens(query) {
  const brandParts = brandTokensFromQuery(query);
  return significantQueryTokens(query).filter(
    (token) => !brandParts.includes(token) && !PRODUCT_GENERIC_WORDS.has(token),
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
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || ''} ${row?.serving_label || row?.servingLabel || row?.serving || ''}`.trim();
}

function rowNameBrandText(row) {
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || row?.restaurant || ''}`.trim();
}

function foodFamilyCompatGroup(category) {
  if (category === 'burger' || category === 'sandwich') return 'sandwich';
  return category || 'generic';
}

function hasUnrequestedFoodFamilyMismatch(nameBrandText, query) {
  const queryCategory = inferFoodServingCategory(query, '', '');
  if (queryCategory === 'generic') return false;
  const rowCategory = inferFoodServingCategory('', nameBrandText, '');
  if (rowCategory === 'generic') return false;
  return foodFamilyCompatGroup(queryCategory) !== foodFamilyCompatGroup(rowCategory);
}

function extraModifiersInText(text) {
  const hay = normalizeQueryText(text);
  const found = [];
  for (const modifier of EXTRA_MENU_MODIFIERS) {
    if (new RegExp(`\\b${escapeRe(modifier)}\\b`, 'i').test(hay)) found.push(modifier);
  }
  if (/\b\d+\s*cheese\b/i.test(hay) || /\bsix\s*cheese\b/i.test(hay)) found.push('multi_cheese');
  return found;
}

function hasUnrequestedMenuModifiers(itemText, query) {
  const queryMods = new Set(extraModifiersInText(query));
  const rowMods = extraModifiersInText(itemText);
  if (!rowMods.length) return false;
  return rowMods.some((modifier) => !queryMods.has(modifier));
}

function firstFluidOz(text) {
  const hay = normalizeQueryText(text);
  const match = hay.match(/\b(\d+)\s*(fl\s*)?oz\b/);
  return match ? Number(match[1]) : null;
}

function firstPieceCount(text, extraDashPiece) {
  const hay = normalizeQueryText(text);
  const spaced = hay.match(/\b(\d+)\s*(pc|pcs|piece|pieces)\b/);
  if (spaced) return Number(spaced[1]);
  const glued = hay.match(/\b(\d+)(pc|pcs)\b/);
  if (glued) return Number(glued[1]);
  if (extraDashPiece) {
    const dashed = hay.match(/\b(\d+)\s*-\s*piece\b/);
    if (dashed) return Number(dashed[1]);
  }
  return null;
}

function queryFluidOz(query) {
  return firstFluidOz(query);
}

function rowFluidOz(itemText) {
  return firstFluidOz(itemText);
}

function queryPieceCount(query) {
  return firstPieceCount(query, false);
}

function rowPieceCount(itemText) {
  return firstPieceCount(itemText, true);
}

function firstMenuSize(text) {
  const hay = normalizeQueryText(text);
  if (/\bextra\s*large\b|\bxl\b/.test(hay)) return 'extra large';
  for (const size of MENU_SIZES) {
    if (new RegExp(`\\b${size}\\b`).test(hay)) return size;
  }
  return null;
}

function queryMenuSize(query) {
  return firstMenuSize(query);
}

function rowMenuSize(itemText) {
  return firstMenuSize(itemText);
}

function isBeverageStyleQuery(query) {
  const queryNorm = normalizeQueryText(query);
  return /\b(coke|cola|pepsi|sprite|fanta|dr\s*pepper|soda|drink|beverage|gatorade|powerade|juice|tea|coffee|latte|mocha|shake|smoothie)\b/i.test(
    queryNorm,
  );
}

function variantModifierMissingFromQuery(itemText, query) {
  const queryNorm = normalizeQueryText(query);
  const hay = normalizeQueryText(itemText);
  for (const modifier of EXTRA_VARIANT_MODIFIERS) {
    const hasInRow = new RegExp(`\\b${escapeRe(modifier)}\\b`, 'i').test(hay);
    const hasInQuery = new RegExp(`\\b${escapeRe(modifier)}\\b`, 'i').test(queryNorm);
    if (hasInRow && !hasInQuery) return true;
  }
  return false;
}

function hasUnrequestedVariantMismatch(itemText, query) {
  const queryNorm = normalizeQueryText(query);
  const hay = normalizeQueryText(itemText);

  if (variantModifierMissingFromQuery(itemText, query)) return true;
  if (/\bdiet\b/i.test(hay) && !/\bdiet\b/i.test(queryNorm)) return true;
  if (/\bsugar[\s-]*free\b/i.test(hay) && !/\bsugar[\s-]*free\b/i.test(queryNorm)) return true;
  if (/\b(family|value)\s*pack\b/i.test(hay) && !/\bpack\b/i.test(queryNorm)) return true;
  if (/\b(\d+)\s*pack\b/i.test(hay) && !/\bpack\b/i.test(queryNorm)) return true;

  const wantOz = queryFluidOz(query);
  if (wantOz != null) {
    const gotOz = rowFluidOz(itemText);
    if (gotOz != null && gotOz !== wantOz) return true;
    if (wantOz >= LARGE_BOTTLE_OZ && /\b(mini|can|cans)\b/i.test(hay) && !/\bbottle\b/i.test(hay) && !/\bcan\b/i.test(queryNorm)) {
      return true;
    }
  }

  const wantPc = queryPieceCount(query);
  if (wantPc != null) {
    const gotPc = rowPieceCount(itemText);
    if (gotPc != null && gotPc !== wantPc) return true;
  }

  const wantSize = queryMenuSize(query);
  if (wantSize) {
    const gotSize = rowMenuSize(itemText);
    if (gotSize && gotSize !== wantSize) return true;
  }

  return false;
}

function hasUnrequestedBeverageMismatch(itemText, query) {
  if (!isBeverageStyleQuery(query)) return false;
  return hasUnrequestedVariantMismatch(itemText, query);
}

function isAbsurdBeverageNutrition(row, query) {
  if (!isBeverageStyleQuery(query)) return false;
  const queryNorm = normalizeQueryText(query);
  const isShakeOrSmoothie = /\b(shake|smoothie|protein)\b/i.test(queryNorm);
  const calories = Number(row?.calories) || 0;
  const fat = Number(row?.fat) || 0;
  const protein = Number(row?.protein) || 0;
  if (!isShakeOrSmoothie) {
    if (fat >= ABSURD_SODA_FAT_G) return true;
    if (protein >= ABSURD_SODA_PROTEIN_G) return true;
    if (calories >= ABSURD_SODA_CALORIES) return true;
    return false;
  }
  if (calories >= ABSURD_SHAKE_CALORIES) return true;
  return false;
}

function isCloseNameMatch(itemText, query, nameBrandText = '') {
  const need = requiredQueryTokens(query);
  if (!need.length) return true;
  if (countTokenHits(itemText, need) < need.length) return false;
  if (hasUnrequestedMenuModifiers(itemText, query)) return false;
  if (hasUnrequestedVariantMismatch(itemText, query)) return false;
  if (hasUnrequestedFoodFamilyMismatch(nameBrandText || itemText, query)) return false;
  return true;
}

function countTokenHits(text, tokens) {
  const hay = normalizeQueryText(text);
  let hits = 0;
  for (const token of tokens) {
    if (tokenHitsInHay(hay, token)) hits += 1;
  }
  return hits;
}

function itemTokenHitScore(itemText, itemTokens) {
  if (itemTokens.length < 1) return 0;
  const itemHits = countTokenHits(itemText, itemTokens);
  if (itemHits >= itemTokens.length) return FULL_ITEM_HIT_BONUS;
  if (itemHits === 0) return -NO_ITEM_HIT_PENALTY;
  return itemHits * PARTIAL_ITEM_HIT_SCORE;
}

function cheesePizzaPhraseBonus(hay, itemTokens) {
  if (!itemTokens.includes('cheese') || !itemTokens.includes('pizza')) return 0;
  if (/\bcheese\s+pizza\b/.test(hay) && !/\b(steak|philly|pepperoni|sausage)\b/.test(hay)) {
    return CHEESE_PIZZA_PHRASE_BONUS;
  }
  return 0;
}

function itemPhraseScore(hay, itemTokens) {
  if (itemTokens.length < 2) return 0;
  let score = 0;
  const itemPhrase = itemTokens.join(' ');
  if (hay.includes(itemPhrase)) score += ITEM_PHRASE_BONUS;
  score += cheesePizzaPhraseBonus(hay, itemTokens);
  return score;
}

function askedLargeSizeScore(hay, queryNorm) {
  if (!/\blarge\b/.test(queryNorm) || /\bextra\s*large\b/.test(queryNorm)) return 0;
  if (/\bextra\s*large\b/.test(hay)) return -EXTRA_LARGE_PENALTY;
  if (/\blarge\b/.test(hay)) return ASKED_LARGE_BONUS;
  return 0;
}

function menuStyleScoreAdjustments(itemText, query, hay, queryNorm, itemTokens) {
  let score = 0;
  if (isRetailFoodNoise(itemText)) score -= RETAIL_NOISE_PENALTY;
  if (/\bjets\b/.test(queryNorm) && /\bpizza\b/.test(queryNorm) && /\bcandy|gummi\b/.test(hay)) {
    score -= RETAIL_NOISE_PENALTY;
  }
  score += itemTokenHitScore(itemText, itemTokens);
  if (hasUnrequestedMenuModifiers(itemText, query)) score -= UNREQUESTED_MODIFIER_PENALTY;
  score += askedLargeSizeScore(hay, queryNorm);
  return score;
}

function fluidOzScore(itemText, query) {
  const wantOz = queryFluidOz(query);
  if (wantOz == null) return 0;
  const gotOz = rowFluidOz(itemText);
  if (gotOz === wantOz) return FLUID_OZ_MATCH_BONUS;
  if (gotOz != null) return -FLUID_OZ_MISS_PENALTY;
  return 0;
}

function pieceCountScore(itemText, query) {
  const wantPc = queryPieceCount(query);
  if (wantPc == null) return 0;
  const gotPc = rowPieceCount(itemText);
  if (gotPc === wantPc) return PIECE_COUNT_MATCH_BONUS;
  if (gotPc != null) return -PIECE_COUNT_MISS_PENALTY;
  return 0;
}

function sizeAndCountScoreAdjustments(itemText, query) {
  return fluidOzScore(itemText, query) + pieceCountScore(itemText, query);
}

function sourceBoostForRow(row) {
  const sourceLower = String(row.source || '').toLowerCase();
  if (sourceLower === 'nutrition_consensus') return CONSENSUS_SOURCE_BOOST;
  if (sourceLower === 'trusted_catalog') return TRUSTED_SOURCE_BOOST;
  if (sourceLower === 'fatsecret' || sourceLower === 'usda' || sourceLower === 'usdafdc') return DB_SOURCE_BOOST;
  return 0;
}

function scoreFoodSearchRow(row, query, need) {
  const text = rowSearchText(row);
  const nameBrand = rowNameBrandText(row);
  const scoreText = nameBrand || text;
  return {
    row,
    score: scoreFoodSearchRelevance(scoreText, query) + sourceBoostForRow(row),
    hits: countTokenHits(text, need),
  };
}

// ===== MAIN FUNCTION =====

function isGroceryIngredientQuery(query) {
  const queryNorm = normalizeQueryText(query);
  return !!queryNorm && GROCERY_INGREDIENT_PATTERN.test(queryNorm);
}

function isMenuStyleQuery(query) {
  const queryNorm = normalizeQueryText(query);
  if (!queryNorm || queryNorm.length < MIN_MENU_QUERY_LENGTH) return false;
  if (GROCERY_INGREDIENT_PATTERN.test(queryNorm)) return false;
  if (PACKAGED_SUPPLEMENT_PATTERN.test(queryNorm)) return false;

  try {
    const { findConsumerBrandInQuery } = require('../food-details/tidyBrandName');
    if (findConsumerBrandInQuery(query)) return false;
  } catch (_) {
    /* optional in tests */
  }

  if (MENU_STYLE_PATTERN.test(queryNorm)) return true;
  if (/\b\d+\s*(piece|pc|pcs|slice|oz|fl\s*oz)\b/i.test(queryNorm) && MENU_STYLE_PATTERN.test(queryNorm)) {
    return true;
  }

  const tokens = significantQueryTokens(query);
  if (tokens.length === 1 && MENU_STYLE_PATTERN.test(queryNorm)) return true;
  return false;
}

/**
 * Higher = better match. Used for ranking; thresholds vary by query type.
 * @param {string} itemText
 * @param {string} query
 * @returns {number}
 */
function scoreFoodSearchRelevance(itemText, query) {
  const tokens = significantQueryTokens(query);
  const hay = normalizeQueryText(itemText);
  const queryNorm = normalizeQueryText(query);
  if (!tokens.length) return 1;

  let score = countTokenHits(itemText, tokens) * TOKEN_HIT_SCORE;

  const phrase = tokens.join(' ');
  if (phrase.length >= 4 && hay.includes(phrase)) score += PHRASE_BONUS;
  if (tokens.length >= 2 && hay.includes(tokens.slice(0, 2).join(' '))) score += TWO_TOKEN_PHRASE_BONUS;

  const itemTokens = menuItemTokensFromQuery(query);
  score += itemPhraseScore(hay, itemTokens);

  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand) {
    if (textIncludesBrand(itemText, requiredBrand)) score += BRAND_MATCH_BONUS;
    else score -= BRAND_MISS_PENALTY;
    score += countTokenHits(itemText, distinctiveQueryTokens(query)) * FLAVOR_HIT_SCORE;
  }

  if (isMenuStyleQuery(query)) {
    score += menuStyleScoreAdjustments(itemText, query, hay, queryNorm, itemTokens);
  }

  if (hasUnrequestedFoodFamilyMismatch(itemText, query)) score -= FOOD_FAMILY_PENALTY;
  if (hasUnrequestedVariantMismatch(itemText, query)) score -= VARIANT_MISMATCH_PENALTY;
  score += sizeAndCountScoreAdjustments(itemText, query);
  if (tokens.length >= 2 && countTokenHits(itemText, tokens) === 0) score -= NO_TOKEN_HIT_PENALTY;

  return score;
}

function minTokenHitsForMatch(query) {
  const need = requiredQueryTokens(query);
  return Math.max(1, need.length);
}

function itemMatchesQuery(itemText, query) {
  if (isRetailFoodNoise(itemText) && isMenuStyleQuery(query)) return false;
  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand && !textIncludesBrand(itemText, requiredBrand)) return false;
  return isCloseNameMatch(itemText, query);
}

/**
 * Strict close-name filter for ALL query types. Better empty than unrelated cousins.
 * @param {string} query
 * @param {object[]} rows
 * @param {number} [limit]
 * @returns {object[]}
 */
function filterFoodSearchRows(query, rows, limit = DEFAULT_FILTER_LIMIT) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const requiredBrand = getConsumerBrandInQuery(query);
  const need = requiredQueryTokens(query);
  const cap = Math.min(Math.max(limit, 1), DEFAULT_FILTER_LIMIT);

  const candidates = list.filter((row) => {
    const text = rowSearchText(row);
    const nameBrand = rowNameBrandText(row);
    if (isRetailFoodNoise(text)) return false;
    if (requiredBrand && !textIncludesBrand(text, requiredBrand)) return false;
    if (!isCloseNameMatch(text, query, nameBrand)) return false;
    if (isAbsurdBeverageNutrition(row, query)) return false;
    return true;
  });

  if (!candidates.length) return [];

  const scored = candidates
    .map((row) => scoreFoodSearchRow(row, query, need))
    .sort((left, right) => right.score - left.score || right.hits - left.hits);

  return scored.slice(0, cap).map((entry) => entry.row);
}

function isRetailFoodNoise(text) {
  const textLower = String(text || '').toLowerCase();
  return (
    /\bpizza\s+sauce\b|\bpizza\s*,\s*sauce\b|\bpizza\s+dough\b|\bpizza\s+crackers\b|\bpizza\s+paste\b/i.test(
      textLower,
    ) || /\b(bourekas|empanadas|pastelillos|bruschette)\b/i.test(textLower)
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
  menuItemTokensFromQuery,
  hasUnrequestedMenuModifiers,
  hasUnrequestedBeverageMismatch,
  hasUnrequestedVariantMismatch,
  hasUnrequestedFoodFamilyMismatch,
  rowNameBrandText,
  isBeverageStyleQuery,
  isCloseNameMatch,
  requiredQueryTokens,
};
