// Turns the multi-source nutrition search reply into food cards the app can show.
// Flow: parse the typed text (Big Mac + restaurant) → consensus row and source rows → merge with the older search list.
// Used by food search. CommonJS so the food tests can require() it.

const {
  parseCasualMenuIntent,
  RESTAURANT_CHAINS,
} = require('../food-search/restaurantMenuSearch');
const { significantQueryTokens } = require('./rankFoodResults');
const {
  formatUserQueryAsFoodName,
  stripLegacyFoodTitleDecorations,
  isJunkFoodTitle,
  sanitizeFoodCardTitle,
} = require('./tidyFoodTitles');
const { resolveFoodServingLabelDetailed } = require('./guessServingLabel');
const { TRUSTED_DB_SOURCES } = require('./trustRestaurantResult');

// ===== NAMED CONSTANTS =====

// Chains users type without the full brand name (e.g. "jets four corner", "20pc mcnuggets").
const LOOSE_CHAIN_HINTS = [
  { re: /\b(mcnuggets?|mc\s*nuggets?)\b/i, label: "McDonald's", itemRe: /\b(\d+\s*pc\s*)?(mc)?nuggets?\b/i },
  { re: /\bjets\b/i, label: "Jet's Pizza", itemRe: /\bjets\b/i },
  { re: /\b(big\s*mac|quarter\s*pounder|mcflurry|happy\s*meal)\b/i, label: "McDonald's" },
  { re: /\b(whopper|chicken\s*fries)\b/i, label: 'Burger King' },
  { re: /\b(dave'?s?\s*single|frosty|baconator)\b/i, label: "Wendy's" },
  { re: /\bcrazy\s*bread\b/i, label: 'Little Caesars', itemRe: /\bcrazy\s*bread\b/i },
];

const SOURCE_NUTRITION_CONSENSUS = 'nutrition_consensus';
const SOURCE_TRUSTED_CATALOG = 'trusted_catalog';
const SOURCE_SERPER = 'serper';
const SOURCE_MIXED = 'mixed';
const FALLBACK_FOOD_NAME = 'Food';
const CONSENSUS_PRIORITY = 200;
const TRUSTED_CATALOG_PRIORITY = 150;
const TRUSTED_DB_PRIORITY = 100;
const DEFAULT_SOURCE_PRIORITY = 50;
const WEAK_WEB_PRIORITY = 20;
const MIN_SOURCES_AGREEING = 2;
const NEAR_ZERO_MACRO_GRAMS = 1;
const SAME_FOOD_CALORIE_RATIO = 0.08;
const CONSENSUS_DUP_CALORIE_RATIO = 0.2;
const LEGACY_DUP_CALORIE_RATIO = 0.15;
const CLOSE_MACRO_RATIO = 0.12;
const CLOSE_MACRO_KCAL = 25;
const DEFAULT_MERGE_LIMIT = 8;
const DEFAULT_CLOSE_LIMIT = 5;
const CONSENSUS_KEEP_PRIORITY = 3;
const TRUSTED_KEEP_PRIORITY = 2;
const DB_KEEP_PRIORITY = 1;

// ===== HELPER FUNCTIONS =====

function detectLooseRestaurantChain(typedText) {
  for (const hint of LOOSE_CHAIN_HINTS) {
    if (hint.re.test(typedText)) {
      return { label: hint.label, itemRe: hint.itemRe || hint.re };
    }
  }
  for (const chain of RESTAURANT_CHAINS) {
    if (chain.re.test(typedText)) return { label: chain.label, itemRe: chain.re };
  }
  return null;
}

function stripRestaurantFromQuery(typedText, chain) {
  let phrase = typedText;
  if (chain?.itemRe) phrase = phrase.replace(chain.itemRe, ' ');
  for (const restaurantChain of RESTAURANT_CHAINS) {
    phrase = phrase.replace(restaurantChain.re, ' ');
  }
  return phrase.replace(/\s+/g, ' ').trim();
}

function isHighConfidenceConsensus(consensus, { fallbackUsed = false } = {}) {
  if (fallbackUsed) return false;
  const calorieEntry = consensus?.calories;
  if (!calorieEntry || calorieEntry.value == null) return false;
  if ((calorieEntry.sources_agreeing || 0) < MIN_SOURCES_AGREEING) return false;
  // Allow 0-cal diet drinks — only reject negative / missing.
  if (Number(calorieEntry.value) < 0) return false;
  return true;
}

function mapConsensusNutrient(consensus, key) {
  const entry = consensus?.[key];
  if (!entry || entry.value == null) return null;
  return entry.value;
}

function fillSugarFromCarbsWhenDrink({ sugar, carbs, protein, fat }) {
  if (
    (sugar == null || sugar <= 0) &&
    Number(carbs) > 0 &&
    Number(protein || 0) < NEAR_ZERO_MACRO_GRAMS &&
    Number(fat || 0) < NEAR_ZERO_MACRO_GRAMS
  ) {
    return carbs;
  }
  return sugar;
}

function buildDisplayName(payload, displayQuery) {
  const raw = String(displayQuery || '').trim();
  const query = payload?.query || {};
  const fromUser = formatUserQueryAsFoodName(raw);
  if (fromUser && !isJunkFoodTitle(fromUser)) return fromUser;

  const fromParsed = query.restaurant
    ? formatUserQueryAsFoodName(`${query.restaurant} ${query.foodName || ''}`.trim())
    : formatUserQueryAsFoodName(query.foodName || '');
  if (fromParsed && !isJunkFoodTitle(fromParsed)) return fromParsed;

  return fromUser || fromParsed || FALLBACK_FOOD_NAME;
}

function resolveSourceFoodTitle(sourceRow, payload, displayQuery) {
  const cleaned = stripLegacyFoodTitleDecorations(sourceRow?.displayName);
  if (cleaned && !isJunkFoodTitle(cleaned)) return cleaned;
  return buildDisplayName(payload, displayQuery);
}

function buildConsensusSubtitle(payload) {
  const fromResults = (payload?.sourceResults || []).map((resultRow) => resultRow.source).filter(Boolean);
  const fromUsed = Array.isArray(payload?.sources_used) ? payload.sources_used : [];
  const names = [...new Set(fromResults.length ? fromResults : fromUsed)];
  if (names.length === 0) return 'via consensus';
  if (names.length === 1) return `via ${names[0]}`;
  return `via ${names.slice(0, 4).join(', ')}`;
}

function applyServingFields(row, displayQuery, payload, sourceRow = null) {
  const detailed = resolveFoodServingLabelDetailed({
    userQuery: displayQuery,
    foodName: row.food_name || row.name,
    restaurant: payload?.query?.restaurant || row.restaurant,
    scraperLabel: sourceRow?.servingLabel,
    displayName: sourceRow?.displayName,
    calories: row.nf_calories ?? row.calories,
  });
  const label = detailed.label;
  return {
    ...row,
    serving_label: label,
    servingLabel: label,
    serving_unit: label,
    servingUnit: label,
    portion_text: label,
    serving_qty: 1,
    serving_size: 1,
    nutrition_unverified: Boolean(row.nutrition_unverified) || Boolean(detailed.nutrition_unverified),
    multiServingFallback: Boolean(row.multiServingFallback) || Boolean(detailed.multiServingFallback),
  };
}

function isSameFoodCandidate(leftRow, rightRow) {
  if (!leftRow || !rightRow) return false;
  const nameLeft = String(leftRow.name || leftRow.food_name || '').toLowerCase();
  const nameRight = String(rightRow.name || rightRow.food_name || '').toLowerCase();
  if (!nameLeft || !nameRight) return false;
  if (nameLeft === nameRight) return true;

  const tokensLeft = significantQueryTokens(nameLeft);
  const tokensRight = significantQueryTokens(nameRight);
  if (tokensLeft.length && tokensRight.length) {
    const overlap = tokensLeft.filter((token) => tokensRight.includes(token)).length;
    const shorterCount = Math.min(tokensLeft.length, tokensRight.length);
    if (shorterCount >= 2 && overlap >= shorterCount - 1) return true;
  }

  const caloriesLeft = Number(leftRow.calories);
  const caloriesRight = Number(rightRow.calories);
  if (Number.isFinite(caloriesLeft) && Number.isFinite(caloriesRight) && caloriesLeft > 0) {
    const diff = Math.abs(caloriesLeft - caloriesRight) / caloriesLeft;
    if (diff <= SAME_FOOD_CALORIE_RATIO && (nameLeft.includes(nameRight) || nameRight.includes(nameLeft))) {
      return true;
    }
  }
  return false;
}

function sourcePriority(source) {
  const sourceText = String(source || '');
  const sourceLower = sourceText.toLowerCase();
  if (sourceLower === SOURCE_NUTRITION_CONSENSUS) return CONSENSUS_PRIORITY;
  if (sourceLower === SOURCE_TRUSTED_CATALOG) return TRUSTED_CATALOG_PRIORITY;
  if (TRUSTED_DB_SOURCES.has(sourceText) || TRUSTED_DB_SOURCES.has(sourceLower)) return TRUSTED_DB_PRIORITY;
  if (sourceLower === SOURCE_SERPER || sourceLower === SOURCE_MIXED) return WEAK_WEB_PRIORITY;
  return DEFAULT_SOURCE_PRIORITY;
}

function calorieDiffRatio(leftCalories, rightCalories) {
  return (
    Math.abs(Number(leftCalories) - Number(rightCalories)) /
    Math.max(Math.abs(Number(rightCalories)) || 1, 1)
  );
}

function appendDistinctSourceRows(rows, sourceRows, consensusRow) {
  for (const row of sourceRows) {
    if (isSameFoodCandidate(consensusRow, row)) continue;
    rows.push(row);
  }
}

function closeMacroKeepPriority(row) {
  const sourceLower = String(row.source || '').toLowerCase();
  if (sourceLower === SOURCE_NUTRITION_CONSENSUS) return CONSENSUS_KEEP_PRIORITY;
  if (sourceLower === SOURCE_TRUSTED_CATALOG) return TRUSTED_KEEP_PRIORITY;
  if (sourceLower === 'fatsecret' || sourceLower === 'usda' || sourceLower === 'usdafdc') {
    return DB_KEEP_PRIORITY;
  }
  return 0;
}

function isCloseToAnchorCalories(rowCalories, anchorCalories) {
  if (anchorCalories <= 0 && rowCalories <= 0) return true;
  const relative = Math.abs(rowCalories - anchorCalories) / Math.max(Math.abs(anchorCalories), 1);
  if (relative <= CLOSE_MACRO_RATIO) return true;
  if (Math.abs(rowCalories - anchorCalories) <= CLOSE_MACRO_KCAL) return true;
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * Split typed search text into the food name and a restaurant, when one is obvious.
 * @param {string} rawQuery
 * @returns {{ foodName: string, restaurant: string|null }}
 */
function parseNutritionSearchQuery(rawQuery) {
  const typedText = String(rawQuery || '').trim();
  if (!typedText) return { foodName: '', restaurant: null };

  const intent = parseCasualMenuIntent(typedText);
  if (intent.chain) {
    const item = String(intent.itemPhrase || typedText).trim();
    return {
      foodName: item || typedText,
      restaurant: intent.chain.label,
    };
  }

  const loose = detectLooseRestaurantChain(typedText);
  if (loose) {
    const item = stripRestaurantFromQuery(typedText, loose) || typedText;
    return {
      foodName: item,
      restaurant: loose.label,
    };
  }

  return { foodName: typedText, restaurant: null };
}

/**
 * One consensus card when enough sources agree on calories.
 * @param {object} payload
 * @param {string} displayQuery
 * @returns {object|null}
 */
function mapConsensusToFoodRow(payload, displayQuery) {
  const consensus = payload?.consensus;
  if (!isHighConfidenceConsensus(consensus, { fallbackUsed: payload?.fallbackUsed })) {
    return null;
  }

  const calories = mapConsensusNutrient(consensus, 'calories');
  if (calories == null) return null;

  const query = payload?.query || {};
  const baseName = buildDisplayName(payload, displayQuery);
  const displayName = baseName;
  const sourceSubtitle = buildConsensusSubtitle(payload);

  const needsVerify = Object.values(consensus || {}).some((entry) => entry?.warning === 'verify_manually');
  const sources = Array.isArray(payload?.sources_used) ? payload.sources_used : [];
  const carbs = mapConsensusNutrient(consensus, 'carbs_g');
  const protein = mapConsensusNutrient(consensus, 'protein_g');
  const fat = mapConsensusNutrient(consensus, 'fat_g');
  const sugar = fillSugarFromCarbsWhenDrink({
    sugar: mapConsensusNutrient(consensus, 'sugar_g'),
    carbs,
    protein,
    fat,
  });

  return applyServingFields(
    {
      id: `nutrition_consensus_${String(displayQuery || baseName).toLowerCase().replace(/\s+/g, '_')}`,
      name: displayName,
      food_name: displayName,
      source_subtitle: sourceSubtitle,
      brand: query.restaurant || null,
      brand_name: query.restaurant || null,
      restaurant: query.restaurant || null,
      calories,
      protein,
      carbs,
      fat,
      fiber: mapConsensusNutrient(consensus, 'fiber_g'),
      sodium: mapConsensusNutrient(consensus, 'sodium_mg'),
      sugar,
      servingSize: 1,
      servingGrams: 100,
      source: SOURCE_NUTRITION_CONSENSUS,
      nutrition_unverified: needsVerify || payload?.fallbackUsed,
      nf_calories: calories,
      nf_protein: protein,
      nf_total_carbohydrate: carbs,
      nf_total_fat: fat,
      nf_sugars: sugar,
      metadata: {
        consensus,
        sources_used: sources,
        cacheHit: payload?.cacheHit,
        fallbackUsed: payload?.fallbackUsed,
        source: SOURCE_NUTRITION_CONSENSUS,
      },
    },
    displayQuery,
    payload,
    payload?.sourceResults?.[0],
  );
}

/**
 * One card from a single scraper / database source.
 * @param {object} sourceRow
 * @param {object} payload
 * @param {string} displayQuery
 * @returns {object|null}
 */
function mapSourceResultToFoodRow(sourceRow, payload, displayQuery) {
  if (!sourceRow || sourceRow.calories == null) return null;

  const query = payload?.query || {};
  const baseName = buildDisplayName(payload, displayQuery);
  const itemLabel = resolveSourceFoodTitle(sourceRow, payload, displayQuery);
  const displayName = itemLabel || baseName;
  const sourceSubtitle = sourceRow.source ? `via ${sourceRow.source}` : null;

  const carbs = sourceRow.carbs_g;
  const protein = sourceRow.protein_g;
  const fat = sourceRow.fat_g;
  const sugar = fillSugarFromCarbsWhenDrink({
    sugar: sourceRow.sugar_g,
    carbs,
    protein,
    fat,
  });

  return applyServingFields(
    {
      id: `nutrition_source_${sourceRow.sourceKey}_${String(itemLabel).toLowerCase().replace(/\s+/g, '_')}`,
      name: displayName,
      food_name: displayName,
      source_subtitle: sourceSubtitle,
      brand: query.restaurant || null,
      brand_name: query.restaurant || null,
      restaurant: query.restaurant || null,
      calories: sourceRow.calories,
      protein,
      carbs,
      fat,
      fiber: sourceRow.fiber_g,
      sodium: sourceRow.sodium_mg,
      sugar,
      servingSize: 1,
      servingGrams: 100,
      source: sourceRow.sourceKey || 'nutrition_source',
      nutrition_unverified: false,
      nf_calories: sourceRow.calories,
      nf_protein: protein,
      nf_total_carbohydrate: carbs,
      nf_total_fat: fat,
      nf_sugars: sugar,
      metadata: {
        sourceResult: sourceRow,
        url: sourceRow.url,
        servingBasis: sourceRow.servingBasis,
        source: sourceRow.sourceKey,
      },
    },
    displayQuery,
    payload,
    sourceRow,
  );
}

/**
 * @param {object} payload
 * @param {string} displayQuery
 * @returns {object[]}
 */
function mapSourceResultsToFoodRows(payload, displayQuery) {
  const rows = [];
  const seen = new Set();

  for (const sourceRow of payload?.sourceResults || []) {
    const row = mapSourceResultToFoodRow(sourceRow, payload, displayQuery);
    if (!row) continue;
    const key = `${row.source}:${row.calories}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  return rows;
}

/**
 * Consensus card first when sources agree; otherwise trusted DB rows, then the rest.
 * @param {object} payload
 * @param {string} displayQuery
 * @returns {object[]}
 */
function mapNutritionSearchToFoodRows(payload, displayQuery) {
  const rows = [];
  const consensusRow = mapConsensusToFoodRow(payload, displayQuery);
  const sourceRows = mapSourceResultsToFoodRows(payload, displayQuery);

  // Consensus macros win when sources agree — that is the card the user should see.
  if (consensusRow) {
    rows.push(consensusRow);
    appendDistinctSourceRows(rows, sourceRows, consensusRow);
    return rows;
  }

  const trusted = sourceRows.filter((row) => sourcePriority(row.source) >= TRUSTED_DB_PRIORITY);
  const otherSources = sourceRows.filter((row) => sourcePriority(row.source) < TRUSTED_DB_PRIORITY);
  if (trusted.length > 0) {
    rows.push(...trusted, ...otherSources);
  } else {
    rows.push(...otherSources);
  }

  return rows.sort((leftRow, rightRow) => sourcePriority(rightRow.source) - sourcePriority(leftRow.source));
}

/**
 * @param {object} consensusRow
 * @param {object[]} rows
 * @param {number} [limit]
 * @returns {object[]}
 */
function mergeConsensusWithResults(consensusRow, rows, limit = DEFAULT_MERGE_LIMIT) {
  const list = Array.isArray(rows) ? rows : [];
  if (!consensusRow || consensusRow.nutrition_unverified) return list.slice(0, limit);

  // Consensus is the primary card; drop near-duplicate cousins.
  const filtered = list.filter((row) => {
    if (String(row.source || '').toLowerCase() === SOURCE_NUTRITION_CONSENSUS) return false;
    if (!isSameFoodCandidate(consensusRow, row)) return true;
    return calorieDiffRatio(row.calories, consensusRow.calories) > CONSENSUS_DUP_CALORIE_RATIO;
  });
  return [consensusRow, ...filtered].slice(0, limit);
}

/**
 * Nutrition rows first; the older Serper/USDA list only fills gaps.
 * @param {object[]} nutritionRows
 * @param {object[]} legacyRows
 * @param {number} [limit]
 * @returns {object[]}
 */
function mergeNutritionSearchWithLegacy(nutritionRows, legacyRows, limit = DEFAULT_MERGE_LIMIT) {
  const nutrition = Array.isArray(nutritionRows) ? nutritionRows : [];
  const legacy = Array.isArray(legacyRows) ? legacyRows : [];
  if (nutrition.length === 0) return legacy.slice(0, limit);

  const hasConsensus = nutrition.some(
    (row) => String(row.source || '').toLowerCase() === SOURCE_NUTRITION_CONSENSUS,
  );
  const hasTrustedDb = nutrition.some((row) => sourcePriority(row.source) >= TRUSTED_DB_PRIORITY);

  let legacyPool = legacy;
  if (hasConsensus || hasTrustedDb) {
    // When consensus or DB already hit, drop weak web scrapes from legacy.
    legacyPool = legacy.filter((row) => {
      const sourceLower = String(row.source || '').toLowerCase();
      if (sourceLower === SOURCE_SERPER || sourceLower === SOURCE_MIXED) return false;
      return true;
    });
  }

  const filtered = legacyPool.filter((row) => {
    for (const anchor of nutrition) {
      if (!isSameFoodCandidate(anchor, row)) continue;
      if (calorieDiffRatio(row.calories, anchor.calories) <= LEGACY_DUP_CALORIE_RATIO) return false;
    }
    return true;
  });

  return [...nutrition, ...filtered].slice(0, limit);
}

/**
 * Keep multiple results when calories/macros agree (±12% or ±25 kcal).
 * Consensus / trusted stay first; drop distant cousins.
 * @param {object[]} rows
 * @param {number} [limit]
 * @returns {object[]}
 */
function keepCloseMacroRows(rows, limit = DEFAULT_CLOSE_LIMIT) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return [];

  const anchor =
    list.find((row) => String(row.source || '').toLowerCase() === SOURCE_NUTRITION_CONSENSUS) ||
    list.find((row) => String(row.source || '').toLowerCase() === SOURCE_TRUSTED_CATALOG) ||
    list[0];
  const anchorCalories = Number(anchor.calories) || 0;

  const close = list.filter((row) => isCloseToAnchorCalories(Number(row.calories) || 0, anchorCalories));

  return close
    .sort((leftRow, rightRow) => {
      const priorityGap = closeMacroKeepPriority(rightRow) - closeMacroKeepPriority(leftRow);
      if (priorityGap !== 0) return priorityGap;
      return Math.abs(Number(leftRow.calories) - anchorCalories) - Math.abs(Number(rightRow.calories) - anchorCalories);
    })
    .slice(0, limit);
}

/**
 * Fill missing sugar for near-zero fat/protein items (sodas) from carbs.
 * @param {object} row
 * @returns {object}
 */
function enrichSearchRowMicros(row) {
  if (!row || typeof row !== 'object') return row;
  const carbs = Number(row.carbs ?? row.nf_total_carbohydrate) || 0;
  const protein = Number(row.protein ?? row.nf_protein) || 0;
  const fat = Number(row.fat ?? row.nf_total_fat) || 0;
  let sugar = Number(row.sugar ?? row.nf_sugars);
  if ((!Number.isFinite(sugar) || sugar <= 0) && carbs > 0 && protein < NEAR_ZERO_MACRO_GRAMS && fat < NEAR_ZERO_MACRO_GRAMS) {
    sugar = carbs;
  }
  if (!Number.isFinite(sugar) || sugar < 0) return row;
  return {
    ...row,
    sugar,
    nf_sugars: sugar,
  };
}

module.exports = {
  parseNutritionSearchQuery,
  mapConsensusToFoodRow,
  mapSourceResultToFoodRow,
  mapSourceResultsToFoodRows,
  mapNutritionSearchToFoodRows,
  mergeConsensusWithResults,
  mergeNutritionSearchWithLegacy,
  keepCloseMacroRows,
  enrichSearchRowMicros,
  isHighConfidenceConsensus,
  // Re-exported from tidyFoodTitles — keep for older import paths / Metro cache.
  sanitizeFoodCardTitle,
  stripLegacyFoodTitleDecorations,
};
