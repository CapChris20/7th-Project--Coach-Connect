// Scores and filters food-search rows so only the typed name (or a near-exact title) is kept.
// Flow: tokens → drop cousins → soft-keep consensus/trusted → rank what remains.
// Used by client search and the server. CommonJS for the food tests.
// Read order: constants → mains (filter / score / query-type) → PLUMBING (token / mismatch helpers).

const { inferFoodServingCategory } = require('./guessServingLabel');

// ===== NAMED CONSTANTS =====

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

const MENU_SIZES = ['small', 'medium', 'large', 'grande', 'venti', 'tall'];

// ===== HELPER FUNCTIONS =====

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

// Form-factor / size words — nice to have in the query, but must not wipe a real menu hit
// when the catalog title says "Footlong Turkey Breast" and the user typed "... sandwich".
// Manipulate here: add words that describe HOW the food is ordered, not WHAT it is.
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
  'grande',
  'venti',
  'tall',
  'sandwich',
  'sandwiches',
  'wrap',
  'wraps',
  'sub',
  'subs',
  'hoagie',
  'hoagies',
  'serving',
  'order',
  'piece',
  'pieces',
  'pc',
  'pcs',
]);

const MENU_STYLE_PATTERN =
  /\b(pizza|burger|sandwich|wrap|bowl|salad|taco|burrito|wing|wings|nugget|nuggets|nugg|nuggs|nug|nugs|mcnugget|mcnuggets|tendie|tendies|tender|tenders|combo|meal|latte|mocha|frappuccino|sub\b|hoagie|calzone|pasta|entree|appetizer|deep\s*dish|corner|slice|cheeseburger|hamburger|quesadilla|nachos|fries|chicken\s+fingers|crazy\s*bread|breadstick|garlic\s+bread|cheesy\s+bread|big\s*mac|whopper|baconator|frosty)\b/i;

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
  /\b(mcdonald'?s?|mcds?)\b/i,
  /\bchipotle\b/i,
  /\bwendy'?s?\b/i,
  /\bdomino'?s?\b/i,
  /\bburger\s*king\b/i,
  /\btaco\s*bell\b/i,
  /\bstarbucks\b/i,
  /\bpapa\s*john'?s?\b/i,
  /\bpizza\s*hut\b/i,
  /\bchick[\s-]?fil[\s-]?a\b/i,
  /\bjets\b|\bjet'?s\b/i,
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

const FOOD_TOKEN_SYNONYMS = {
  nugg: ['nugget', 'nuggets', 'nuggs', 'nug', 'nugs'],
  nuggs: ['nugget', 'nuggets', 'nugg', 'nug', 'nugs'],
  nug: ['nugget', 'nuggets', 'nugg', 'nuggs', 'nugs'],
  nugs: ['nugget', 'nuggets', 'nugg', 'nuggs', 'nug'],
  // Do NOT synonym generic nuggets ↔ McNuggets — that made Perdue searches rank McDonald's.
  nugget: ['nuggets', 'nugg', 'nuggs', 'nug', 'nugs'],
  nuggets: ['nugget', 'nugg', 'nuggs', 'nug', 'nugs'],
  mcnugget: ['mcnuggets', 'mc nuggets'],
  mcnuggets: ['mcnugget', 'mc nuggets'],
  tendie: ['tender', 'tenders', 'tendies'],
  tendies: ['tender', 'tenders', 'tendie'],
  tender: ['tenders', 'tendie', 'tendies'],
  tenders: ['tender', 'tendie', 'tendies'],
  chkn: ['chicken'],
  chx: ['chicken'],
  chix: ['chicken'],
  burg: ['burger', 'burgers'],
  burgs: ['burger', 'burgers'],
  mcd: ['mcdonald', 'mcdonalds'],
  mcds: ['mcdonald', 'mcdonalds'],
  mcdonald: ['mcd', 'mcds', 'mcdonalds'],
  mcdonalds: ['mcd', 'mcds', 'mcdonald'],
  bread: ['breadstick', 'breadsticks', 'breads'],
  breadstick: ['bread', 'breadsticks'],
  breadsticks: ['bread', 'breadstick'],
  perdue: ['purdue'],
  purdue: ['perdue'],
};

function escapeRegexSpecialChars(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quantityTokenAliases(token) {
  const tokenText = String(token || '').toLowerCase();
  const packMatch = tokenText.match(/^(\d+)(pc|pcs|piece|pieces|pk|pack)$/i);
  if (!packMatch) return [tokenText];
  const count = packMatch[1];
  return [
    tokenText,
    count,
    `${count}pc`,
    `${count}pcs`,
    `${count} piece`,
    `${count} pieces`,
    `${count}-piece`,
    `${count}-pc`,
  ];
}

function tokenAppearsInHaystack(searchHaystack, token) {
  const variants = new Set(quantityTokenAliases(token));
  const tokenText = String(token || '').toLowerCase();
  if (tokenText.endsWith('s') && tokenText.length > 3) {
    variants.add(tokenText.slice(0, -1));
  }
  if (tokenText.length > 2 && !tokenText.endsWith('s')) {
    variants.add(`${tokenText}s`);
  }

  const synonymList = FOOD_TOKEN_SYNONYMS[tokenText];
  if (synonymList) {
    for (let index = 0; index < synonymList.length; index += 1) {
      variants.add(synonymList[index]);
    }
  }

  for (const variant of variants) {
    if (haystackHasWholeWord(searchHaystack, variant)) return true;
  }
  return false;
}

function haystackHasWholeWord(searchHaystack, variant) {
  try {
    return new RegExp(`\\b${escapeRegexSpecialChars(variant)}\\b`, 'i').test(
      searchHaystack,
    );
  } catch (_error) {
    return searchHaystack.includes(variant);
  }
}

function getConsumerBrandInQuery(query) {
  try {
    const { findConsumerBrandInQuery } = require('../food-details/tidyBrandName');
    return findConsumerBrandInQuery(query) || null;
  } catch (_error) {
    return null;
  }
}

function brandTokensFromQuery(query) {
  const brand = getConsumerBrandInQuery(query);
  if (!brand) return [];
  const brandWords = normalizeQueryText(brand).split(' ');
  const tokens = [];
  for (let index = 0; index < brandWords.length; index += 1) {
    if (brandWords[index].length > 1) tokens.push(brandWords[index]);
  }
  return tokens;
}

function distinctiveQueryTokens(query) {
  const brandParts = brandTokensFromQuery(query);
  const tokens = significantQueryTokens(query);
  const distinctive = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (brandParts.includes(token)) continue;
    if (PRODUCT_GENERIC_WORDS.has(token)) continue;
    distinctive.push(token);
  }
  return distinctive;
}

function textIncludesBrand(itemText, brandLabel) {
  const searchHaystack = normalizeQueryText(itemText);
  const brandNormalized = normalizeQueryText(brandLabel);
  if (!brandNormalized) return false;
  if (
    new RegExp(`\\b${escapeRegexSpecialChars(brandNormalized)}\\b`, 'i').test(
      searchHaystack,
    )
  ) {
    return true;
  }
  const firstBrandWord = brandNormalized.split(' ')[0];
  if (
    firstBrandWord.length > 2 &&
    new RegExp(`\\b${escapeRegexSpecialChars(firstBrandWord)}\\b`, 'i').test(
      searchHaystack,
    )
  ) {
    return true;
  }
  // Purdue ↔ Perdue and similar spelling cousins via FOOD_TOKEN_SYNONYMS.
  return tokenAppearsInHaystack(searchHaystack, firstBrandWord);
}

function rowSearchText(row) {
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || ''} ${row?.serving_label || row?.servingLabel || row?.serving || ''}`.trim();
}

function foodFamilyCompatGroup(category) {
  if (category === 'burger' || category === 'sandwich') return 'sandwich';
  return category || 'generic';
}

function extraModifiersInText(text) {
  const searchHaystack = normalizeQueryText(text);
  const found = [];
  for (let index = 0; index < EXTRA_MENU_MODIFIERS.length; index += 1) {
    const modifier = EXTRA_MENU_MODIFIERS[index];
    if (
      new RegExp(`\\b${escapeRegexSpecialChars(modifier)}\\b`, 'i').test(searchHaystack)
    ) {
      found.push(modifier);
    }
  }
  if (/\b\d+\s*cheese\b/i.test(searchHaystack) || /\bsix\s*cheese\b/i.test(searchHaystack)) {
    found.push('multi_cheese');
  }
  return found;
}

function firstFluidOz(text) {
  const searchHaystack = normalizeQueryText(text);
  const match = searchHaystack.match(/\b(\d+)\s*(fl\s*)?oz\b/);
  if (!match) return null;
  return Number(match[1]);
}

function firstPieceCount(text, allowDashPiece) {
  const searchHaystack = normalizeQueryText(text);
  const spaced = searchHaystack.match(/\b(\d+)\s*(pc|pcs|piece|pieces)\b/);
  if (spaced) return Number(spaced[1]);

  const itemPiece = searchHaystack.match(
    /\b(\d+)\s*(nugget|nuggets|nugg|nuggs|nug|nugs|tender|tenders|tendie|tendies|wing|wings)\b/,
  );
  if (itemPiece) return Number(itemPiece[1]);

  const glued = searchHaystack.match(/\b(\d+)(pc|pcs)\b/);
  if (glued) return Number(glued[1]);

  if (allowDashPiece) {
    const dashed = searchHaystack.match(/\b(\d+)\s*-\s*piece\b/);
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
  const searchHaystack = normalizeQueryText(text);
  if (/\bextra\s*large\b|\bxl\b/.test(searchHaystack)) return 'extra large';
  for (let index = 0; index < MENU_SIZES.length; index += 1) {
    const size = MENU_SIZES[index];
    if (new RegExp(`\\b${size}\\b`).test(searchHaystack)) return size;
  }
  return null;
}

function queryMenuSize(query) {
  return firstMenuSize(query);
}

function rowMenuSize(itemText) {
  return firstMenuSize(itemText);
}

function variantModifierMissingFromQuery(itemText, query) {
  const queryNormalized = normalizeQueryText(query);
  const searchHaystack = normalizeQueryText(itemText);
  for (let index = 0; index < EXTRA_VARIANT_MODIFIERS.length; index += 1) {
    const modifier = EXTRA_VARIANT_MODIFIERS[index];
    const hasInRow = new RegExp(
      `\\b${escapeRegexSpecialChars(modifier)}\\b`,
      'i',
    ).test(searchHaystack);
    const hasInQuery = new RegExp(
      `\\b${escapeRegexSpecialChars(modifier)}\\b`,
      'i',
    ).test(queryNormalized);
    if (hasInRow && !hasInQuery) return true;
  }
  return false;
}

function isAbsurdBeverageNutrition(row, query) {
  if (!isBeverageStyleQuery(query)) return false;
  const queryNormalized = normalizeQueryText(query);
  const calories = Number(row?.calories) || 0;
  const fat = Number(row?.fat) || 0;
  const protein = Number(row?.protein) || 0;
  const isShakeOrSmoothie = /\b(shake|smoothie|protein)\b/i.test(queryNormalized);

  // Lattes / mochas: only reject extreme calorie outliers (same bar as shakes).
  if (isMilkBasedBeverageQuery(query)) {
    return calories >= ABSURD_SHAKE_CALORIES;
  }
  if (!isShakeOrSmoothie) {
    if (fat >= ABSURD_SODA_FAT_G) return true;
    if (protein >= ABSURD_SODA_PROTEIN_G) return true;
    if (calories >= ABSURD_SODA_CALORIES) return true;
    return false;
  }
  if (calories >= ABSURD_SHAKE_CALORIES) return true;
  return false;
}

function isConsensusSourceRow(row) {
  return String(row?.source || '').toLowerCase() === 'nutrition_consensus';
}

function isTrustedCatalogRow(row) {
  return String(row?.source || '').toLowerCase() === 'trusted_catalog';
}

// FatSecret / USDA / Open Food Facts — soft-match so a title quirk does not wipe a real hit.
function isTrustedDatabaseSourceRow(row) {
  const sourceLower = String(row?.source || '')
    .toLowerCase()
    .replace(/\s+/g, '');
  if (sourceLower === 'fatsecret') return true;
  if (sourceLower === 'usda') return true;
  if (sourceLower === 'usdafdc') return true;
  if (sourceLower === 'usdafooddatacentral') return true;
  if (sourceLower === 'openfoodfacts') return true;
  if (sourceLower === 'open_food_facts') return true;
  if (sourceLower === 'off') return true;
  if (sourceLower === 'calorieking') return true;
  if (sourceLower === 'foodfacto') return true;
  return false;
}

/**
 * Soft name matching is for *all foods*, not just chain catalog hits.
 * Menu scrapes stay strict (lots of junk cousins). Grocery / DB hits get one-token slack.
 */
function shouldSoftMatchRow(row, query, hasConsensus) {
  if (isTrustedCatalogRow(row) || hasConsensus) return true;
  if (isTrustedDatabaseSourceRow(row)) return true;
  // Non-restaurant queries (cereal, fruit, chicken breast, protein powder) — soft for everyone.
  if (!isMenuStyleQuery(query)) return true;
  return false;
}

function itemTokenHitScore(itemText, itemTokens) {
  if (itemTokens.length < 1) return 0;
  const itemHits = countTokenHits(itemText, itemTokens);
  if (itemHits >= itemTokens.length) return FULL_ITEM_HIT_BONUS;
  if (itemHits === 0) return -NO_ITEM_HIT_PENALTY;
  return itemHits * PARTIAL_ITEM_HIT_SCORE;
}

function cheesePizzaPhraseBonus(searchHaystack, itemTokens) {
  if (!itemTokens.includes('cheese') || !itemTokens.includes('pizza')) return 0;
  const hasCheesePizza = /\bcheese\s+pizza\b/.test(searchHaystack);
  const hasOtherTopping = /\b(steak|philly|pepperoni|sausage)\b/.test(searchHaystack);
  if (hasCheesePizza && !hasOtherTopping) return CHEESE_PIZZA_PHRASE_BONUS;
  return 0;
}

function itemPhraseScore(searchHaystack, itemTokens) {
  if (itemTokens.length < 2) return 0;
  let score = 0;
  const itemPhrase = itemTokens.join(' ');
  if (searchHaystack.includes(itemPhrase)) score += ITEM_PHRASE_BONUS;
  score += cheesePizzaPhraseBonus(searchHaystack, itemTokens);
  return score;
}

function askedLargeSizeScore(searchHaystack, queryNormalized) {
  if (!/\blarge\b/.test(queryNormalized) || /\bextra\s*large\b/.test(queryNormalized)) {
    return 0;
  }
  if (/\bextra\s*large\b/.test(searchHaystack)) return -EXTRA_LARGE_PENALTY;
  if (/\blarge\b/.test(searchHaystack)) return ASKED_LARGE_BONUS;
  return 0;
}

function menuStyleScoreAdjustments(
  itemText,
  query,
  searchHaystack,
  queryNormalized,
  itemTokens,
) {
  let score = 0;
  if (isRetailFoodNoise(itemText)) score -= RETAIL_NOISE_PENALTY;
  if (
    /\bjets\b/.test(queryNormalized) &&
    /\bpizza\b/.test(queryNormalized) &&
    /\bcandy|gummi\b/.test(searchHaystack)
  ) {
    score -= RETAIL_NOISE_PENALTY;
  }
  score += itemTokenHitScore(itemText, itemTokens);
  if (hasUnrequestedMenuModifiers(itemText, query)) {
    score -= UNREQUESTED_MODIFIER_PENALTY;
  }
  score += askedLargeSizeScore(searchHaystack, queryNormalized);
  return score;
}

function fluidOzScore(itemText, query) {
  const queryOzAmount = queryFluidOz(query);
  if (queryOzAmount == null) return 0;
  const rowOzAmount = rowFluidOz(itemText);
  if (rowOzAmount === queryOzAmount) return FLUID_OZ_MATCH_BONUS;
  if (rowOzAmount != null) return -FLUID_OZ_MISS_PENALTY;
  return 0;
}

function pieceCountScore(itemText, query) {
  const queryPieces = queryPieceCount(query);
  if (queryPieces == null) return 0;
  const rowPieces = rowPieceCount(itemText);
  if (rowPieces === queryPieces) return PIECE_COUNT_MATCH_BONUS;
  if (rowPieces != null) return -PIECE_COUNT_MISS_PENALTY;
  return 0;
}

function sizeAndCountScoreAdjustments(itemText, query) {
  return fluidOzScore(itemText, query) + pieceCountScore(itemText, query);
}

function sourceBoostForRow(row) {
  const sourceLower = String(row.source || '').toLowerCase();
  if (sourceLower === 'nutrition_consensus') return CONSENSUS_SOURCE_BOOST;
  if (sourceLower === 'trusted_catalog') return TRUSTED_SOURCE_BOOST;
  if (
    sourceLower === 'fatsecret' ||
    sourceLower === 'usda' ||
    sourceLower === 'usdafdc'
  ) {
    return DB_SOURCE_BOOST;
  }
  return 0;
}

function scoreFoodSearchRow(row, query, requiredTokens) {
  const text = rowSearchText(row);
  const nameBrand = rowNameBrandText(row);
  const scoreText = nameBrand || text;
  return {
    row,
    score: scoreFoodSearchRelevance(scoreText, query) + sourceBoostForRow(row),
    hits: countTokenHits(text, requiredTokens),
  };
}

function listHasConsensusRow(list) {
  for (let index = 0; index < list.length; index += 1) {
    if (isConsensusSourceRow(list[index])) return true;
  }
  return false;
}

function isZeroCalJetsBreadGhost(query, row) {
  const queryNormalized = normalizeQueryText(query);
  const mentionsJets = /\bjets\b|\bjet'?s\b/.test(queryNormalized);
  const mentionsBread = /\bbread\b/.test(queryNormalized);
  if (!mentionsJets || !mentionsBread) return false;
  const calories = Number(row.calories) || 0;
  return calories <= 0;
}

/**
 * When the user typed Jet's / Jets pizza bread, drop candy and zero-cal junk cousins.
 * @param {string} itemText
 * @param {string} query
 * @returns {boolean}
 */
function isJetsPizzaJunkCousin(itemText, query) {
  const queryNormalized = normalizeQueryText(query);
  if (!/\bjets\b|\bjet'?s\b/.test(queryNormalized)) return false;
  const searchHaystack = normalizeQueryText(itemText);
  if (/\b(chocolatina|chicolatina|gum|vidrio|cruji|candy|caramel|wafer)\b/.test(searchHaystack)) {
    return true;
  }
  // "Jets Bread" at 0 kcal is not pizza bread — handled by isZeroCalJetsBreadGhost.
  return false;
}

function rowSurvivesCloseNameFilter(row, query, requiredBrand, hasConsensus) {
  const text = rowSearchText(row);
  const nameBrand = rowNameBrandText(row);

  // 1. Agreed multi-source card — never delete for a title quirk.
  if (isConsensusSourceRow(row)) {
    if (isAbsurdBeverageNutrition(row, query)) return false;
    return true;
  }

  // 2. Drop retail noise / Jets junk / zero-cal Jets bread ghosts.
  if (isRetailFoodNoise(text) && isMenuStyleQuery(query)) return false;
  if (isJetsPizzaJunkCousin(text, query)) return false;
  if (isZeroCalJetsBreadGhost(query, row)) return false;

  // 3. Brand and absurd beverage gates.
  if (requiredBrand && !textIncludesBrand(text, requiredBrand)) return false;
  if (isAbsurdBeverageNutrition(row, query)) return false;

  // 4. Close name wins; soft match for catalog / DB rows when allowed.
  if (isCloseNameMatch(text, query, nameBrand)) return true;
  if (shouldSoftMatchRow(row, query, hasConsensus)) {
    return isSoftNameMatch(text, query, nameBrand);
  }
  return false;
}

function sortScoredRowsBestFirst(scoredRows) {
  scoredRows.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return right.hits - left.hits;
  });
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
  isMilkBasedBeverageQuery,
  isCloseNameMatch,
  isSoftNameMatch,
  requiredQueryTokens,
};

// ===== MAIN FUNCTION =====

/**
 * Close-name filter for food search — works for ANY food, not just chain menus.
 * Flow: 1. empty → []  2. keep candidates  3. score + sort  4. slice to cap
 * @param {string} query
 * @param {object[]} rows
 * @param {number} [limit]
 * @returns {object[]}
 */
function filterFoodSearchRows(query, rows, limit = DEFAULT_FILTER_LIMIT) {
  // 1. Nothing to filter.
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const requiredBrand = getConsumerBrandInQuery(query);
  const requiredTokens = requiredQueryTokens(query);
  const resultCap = Math.min(Math.max(limit, 1), DEFAULT_FILTER_LIMIT);
  const hasConsensus = listHasConsensusRow(list);

  // 2. Keep only rows that survive the close-name / soft-match rules.
  const candidates = [];
  for (let index = 0; index < list.length; index += 1) {
    const row = list[index];
    if (rowSurvivesCloseNameFilter(row, query, requiredBrand, hasConsensus)) {
      candidates.push(row);
    }
  }
  if (!candidates.length) return [];

  // 3. Score every survivor.
  const scoredRows = [];
  for (let index = 0; index < candidates.length; index += 1) {
    scoredRows.push(scoreFoodSearchRow(candidates[index], query, requiredTokens));
  }
  sortScoredRowsBestFirst(scoredRows);

  // 4. Return the top `resultCap` rows (not the score wrappers).
  const topRows = [];
  const topCount = Math.min(resultCap, scoredRows.length);
  for (let index = 0; index < topCount; index += 1) {
    topRows.push(scoredRows[index].row);
  }
  return topRows;
}

/**
 * Higher = better match. Used for ranking; thresholds vary by query type.
 * Flow: 1. token hits  2. phrase / item bonuses  3. brand  4. menu + mismatch penalties
 * @param {string} itemText
 * @param {string} query
 * @returns {number}
 */
function scoreFoodSearchRelevance(itemText, query) {
  const tokens = significantQueryTokens(query);
  const searchHaystack = normalizeQueryText(itemText);
  const queryNormalized = normalizeQueryText(query);
  if (!tokens.length) return 1;

  // 1. Base score from how many typed tokens appear in the title/brand.
  let score = countTokenHits(itemText, tokens) * TOKEN_HIT_SCORE;

  // 2. Phrase bonuses (full phrase, first two tokens, menu item phrase).
  const fullPhrase = tokens.join(' ');
  if (fullPhrase.length >= 4 && searchHaystack.includes(fullPhrase)) {
    score += PHRASE_BONUS;
  }
  if (tokens.length >= 2) {
    const firstTwoTokens = tokens.slice(0, 2).join(' ');
    if (searchHaystack.includes(firstTwoTokens)) score += TWO_TOKEN_PHRASE_BONUS;
  }

  const itemTokens = menuItemTokensFromQuery(query);
  score += itemPhraseScore(searchHaystack, itemTokens);

  // 3. Consumer brand required in the query → reward hit / punish miss.
  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand) {
    if (textIncludesBrand(itemText, requiredBrand)) score += BRAND_MATCH_BONUS;
    else score -= BRAND_MISS_PENALTY;
    score +=
      countTokenHits(itemText, distinctiveQueryTokens(query)) * FLAVOR_HIT_SCORE;
  }

  // 4. Menu-style extras + family / variant / size penalties.
  if (isMenuStyleQuery(query)) {
    score += menuStyleScoreAdjustments(
      itemText,
      query,
      searchHaystack,
      queryNormalized,
      itemTokens,
    );
  }

  if (hasUnrequestedFoodFamilyMismatch(itemText, query)) {
    score -= FOOD_FAMILY_PENALTY;
  }
  if (hasUnrequestedVariantMismatch(itemText, query)) {
    score -= VARIANT_MISMATCH_PENALTY;
  }
  score += sizeAndCountScoreAdjustments(itemText, query);

  if (tokens.length >= 2 && countTokenHits(itemText, tokens) === 0) {
    score -= NO_TOKEN_HIT_PENALTY;
  }

  return score;
}

/**
 * True when the typed text looks like a restaurant menu ask (not grocery / supplement).
 * @param {string} query
 * @returns {boolean}
 */
function isMenuStyleQuery(query) {
  const queryNormalized = normalizeQueryText(query);
  if (!queryNormalized || queryNormalized.length < MIN_MENU_QUERY_LENGTH) return false;
  if (GROCERY_INGREDIENT_PATTERN.test(queryNormalized)) return false;
  if (PACKAGED_SUPPLEMENT_PATTERN.test(queryNormalized)) return false;

  try {
    const { findConsumerBrandInQuery } = require('../food-details/tidyBrandName');
    if (findConsumerBrandInQuery(query)) return false;
  } catch (_error) {
    /* optional in tests */
  }

  if (MENU_STYLE_PATTERN.test(queryNormalized)) return true;

  const hasPieceOrOz =
    /\b\d+\s*(piece|pc|pcs|slice|oz|fl\s*oz)\b/i.test(queryNormalized);
  if (hasPieceOrOz && MENU_STYLE_PATTERN.test(queryNormalized)) return true;

  const tokens = significantQueryTokens(query);
  if (tokens.length === 1 && MENU_STYLE_PATTERN.test(queryNormalized)) return true;
  return false;
}

/**
 * True when the typed text is a grocery ingredient (chicken breast, brown rice, …).
 * @param {string} query
 * @returns {boolean}
 */
function isGroceryIngredientQuery(query) {
  const queryNormalized = normalizeQueryText(query);
  if (!queryNormalized) return false;
  return GROCERY_INGREDIENT_PATTERN.test(queryNormalized);
}

/**
 * Lowercase + strip punctuation for token matching (Jet's → jets).
 * @param {string} text
 * @returns {string}
 */
function normalizeQueryText(text) {
  // Strip apostrophes (Jet's → jets) — do not turn them into spaces (jet s).
  return String(text || '')
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Meaningful tokens from the typed query (stop words removed).
 * @param {string} query
 * @returns {string[]}
 */
function significantQueryTokens(query) {
  const words = normalizeQueryText(query).split(' ');
  const tokens = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) continue;
    if (QUERY_STOP_WORDS.has(word)) continue;
    if (/^\d/.test(word)) {
      tokens.push(word);
      continue;
    }
    if (word.length > 2) tokens.push(word);
  }
  return tokens;
}

/**
 * Required tokens = significant tokens minus optional form-factor words (sandwich, large, …).
 * Falls back to all significant tokens when every token was optional.
 * @param {string} query
 * @returns {string[]}
 */
function requiredQueryTokens(query) {
  const tokens = significantQueryTokens(query);
  const required = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (!OPTIONAL_CATEGORY_TOKENS.has(tokens[index])) required.push(tokens[index]);
  }
  if (required.length) return required;
  return tokens;
}

/**
 * How many of `tokens` appear (with synonyms / plurals) in `text`.
 * @param {string} text
 * @param {string[]} tokens
 * @returns {number}
 */
function countTokenHits(text, tokens) {
  const searchHaystack = normalizeQueryText(text);
  let hits = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokenAppearsInHaystack(searchHaystack, tokens[index])) hits += 1;
  }
  return hits;
}

/**
 * True when retail noise + menu query would keep junk sauce/dough/candy cousins.
 * @param {string} itemText
 * @param {string} query
 * @returns {boolean}
 */
function itemMatchesQuery(itemText, query) {
  if (isRetailFoodNoise(itemText) && isMenuStyleQuery(query)) return false;
  const requiredBrand = getConsumerBrandInQuery(query);
  if (requiredBrand && !textIncludesBrand(itemText, requiredBrand)) return false;
  return isCloseNameMatch(itemText, query);
}

/**
 * Menu item tokens with chain / brand words stripped.
 * @param {string} query
 * @returns {string[]}
 */
function menuItemTokensFromQuery(query) {
  const brandParts = new Set(brandTokensFromQuery(query));
  let queryNormalized = normalizeQueryText(query);
  for (let index = 0; index < CHAIN_TOKEN_PATTERNS.length; index += 1) {
    queryNormalized = queryNormalized.replace(CHAIN_TOKEN_PATTERNS[index], ' ');
  }
  queryNormalized = queryNormalized.replace(/\s+/g, ' ').trim();

  const tokens = significantQueryTokens(queryNormalized);
  const itemTokens = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (!brandParts.has(tokens[index])) itemTokens.push(tokens[index]);
  }
  return itemTokens;
}

function rowNameBrandText(row) {
  return `${row?.name || row?.food_name || ''} ${row?.brand || row?.brand_name || row?.restaurant || ''}`.trim();
}

function isBeverageStyleQuery(query) {
  const queryNormalized = normalizeQueryText(query);
  return /\b(coke|cola|pepsi|sprite|fanta|dr\s*pepper|soda|drink|beverage|gatorade|powerade|juice|tea|coffee|latte|mocha|shake|smoothie)\b/i.test(
    queryNormalized,
  );
}

// Milk drinks legitimately have fat/protein — soda absurdity rules must not kill lattes.
// vocab: milk-based = espresso + dairy (or similar) drinks, not cola/juice
function isMilkBasedBeverageQuery(query) {
  const queryNormalized = normalizeQueryText(query);
  return /\b(latte|cappuccino|macchiato|flat\s*white|mocha|frappuccino|frappe|chai|cortado|breve|steamer|hot\s*chocolate|milkshake|cold\s*foam|espresso\s*con\s*panna)\b/i.test(
    queryNormalized,
  );
}

function isCloseNameMatch(itemText, query, nameBrandText = '') {
  const requiredTokens = requiredQueryTokens(query);
  if (!requiredTokens.length) return true;
  if (countTokenHits(itemText, requiredTokens) < requiredTokens.length) return false;
  if (hasUnrequestedMenuModifiers(itemText, query)) return false;
  if (hasUnrequestedVariantMismatch(itemText, query)) return false;
  if (hasUnrequestedFoodFamilyMismatch(nameBrandText || itemText, query)) return false;
  return true;
}

/**
 * Soft name match — allow one missing token so "Footlong Turkey Breast" still matches
 * "Subway turkey breast sandwich" after optional tokens are stripped.
 */
function isSoftNameMatch(itemText, query, nameBrandText = '') {
  const requiredTokens = requiredQueryTokens(query);
  if (!requiredTokens.length) return true;
  // Manipulate here: requiredTokens.length - 1 = tolerate one missing required token
  const minHits = Math.max(1, requiredTokens.length - 1);
  if (countTokenHits(itemText, requiredTokens) < minHits) return false;
  if (hasUnrequestedMenuModifiers(itemText, query)) return false;
  if (hasUnrequestedVariantMismatch(itemText, query)) return false;
  if (hasUnrequestedFoodFamilyMismatch(nameBrandText || itemText, query)) return false;
  return true;
}

function hasUnrequestedMenuModifiers(itemText, query) {
  const queryModifiers = new Set(extraModifiersInText(query));
  const rowModifiers = extraModifiersInText(itemText);
  if (!rowModifiers.length) return false;
  for (let index = 0; index < rowModifiers.length; index += 1) {
    if (!queryModifiers.has(rowModifiers[index])) return true;
  }
  return false;
}

function hasUnrequestedBeverageMismatch(itemText, query) {
  if (!isBeverageStyleQuery(query)) return false;
  return hasUnrequestedVariantMismatch(itemText, query);
}

function hasUnrequestedVariantMismatch(itemText, query) {
  const queryNormalized = normalizeQueryText(query);
  const searchHaystack = normalizeQueryText(itemText);

  if (variantModifierMissingFromQuery(itemText, query)) return true;
  if (/\bdiet\b/i.test(searchHaystack) && !/\bdiet\b/i.test(queryNormalized)) return true;
  if (
    /\bsugar[\s-]*free\b/i.test(searchHaystack) &&
    !/\bsugar[\s-]*free\b/i.test(queryNormalized)
  ) {
    return true;
  }
  if (
    /\b(family|value)\s*pack\b/i.test(searchHaystack) &&
    !/\bpack\b/i.test(queryNormalized)
  ) {
    return true;
  }
  if (/\b(\d+)\s*pack\b/i.test(searchHaystack) && !/\bpack\b/i.test(queryNormalized)) {
    return true;
  }

  const queryOzAmount = queryFluidOz(query);
  if (queryOzAmount != null) {
    const rowOzAmount = rowFluidOz(itemText);
    if (rowOzAmount != null && rowOzAmount !== queryOzAmount) return true;
    const largeBottleQuery = queryOzAmount >= LARGE_BOTTLE_OZ;
    const rowLooksLikeMiniCan =
      /\b(mini|can|cans)\b/i.test(searchHaystack) &&
      !/\bbottle\b/i.test(searchHaystack) &&
      !/\bcan\b/i.test(queryNormalized);
    if (largeBottleQuery && rowLooksLikeMiniCan) return true;
  }

  const queryPieces = queryPieceCount(query);
  if (queryPieces != null) {
    const rowPieces = rowPieceCount(itemText);
    if (rowPieces != null && rowPieces !== queryPieces) return true;
  }

  const querySize = queryMenuSize(query);
  if (querySize) {
    const rowSize = rowMenuSize(itemText);
    if (rowSize && rowSize !== querySize) return true;
  }

  return false;
}

function hasUnrequestedFoodFamilyMismatch(nameBrandText, query) {
  const queryCategory = inferFoodServingCategory(query, '', '');
  if (queryCategory === 'generic') return false;
  const rowCategory = inferFoodServingCategory('', nameBrandText, '');
  if (rowCategory === 'generic') return false;
  return foodFamilyCompatGroup(queryCategory) !== foodFamilyCompatGroup(rowCategory);
}

function isRetailFoodNoise(text) {
  const textLower = String(text || '').toLowerCase();
  if (
    /\bpizza\s+sauce\b|\bpizza\s*,\s*sauce\b|\bpizza\s+dough\b|\bpizza\s+crackers\b|\bpizza\s+paste\b/i.test(
      textLower,
    )
  ) {
    return true;
  }
  if (/\b(bourekas|empanadas|pastelillos|bruschette)\b/i.test(textLower)) return true;
  // Colombian "Jet" candy / gum — not Jet's Pizza Detroit bread.
  if (
    /\b(chocolatina|chicolatina|jet\s*gum|jet\s*vidrio|cruji\s*jet|gummi|gummy)\b/i.test(
      textLower,
    )
  ) {
    return true;
  }
  return false;
}

