// Turns the multi-source nutrition search reply into food cards the app can show.
// Flow: parse query → consensus + source rows → presentFoodSearchRows (filter, pin, never-blank).
// Used by food search and the branded live suite. CommonJS so the food tests can require() it.
// Read order: constants → helpers → main recipes → PLUMBING at the bottom.

const {
  parseCasualMenuIntent,
  RESTAURANT_CHAINS
} = require('../food-search/restaurantMenuSearch');
const {
  significantQueryTokens,
  filterFoodSearchRows
} = require('./rankFoodResults');
const {
  formatUserQueryAsFoodName,
  stripLegacyFoodTitleDecorations,
  isJunkFoodTitle,
  sanitizeFoodCardTitle
} = require('./tidyFoodTitles');
const {
  resolveFoodServingLabelDetailed
} = require('./guessServingLabel');
const {
  TRUSTED_DB_SOURCES
} = require('./trustRestaurantResult');

// ===== NAMED CONSTANTS =====

// Chains users type without the full brand name (e.g. "jets four corner", "20pc mcnuggets").
const LOOSE_CHAIN_HINTS = [
// McNuggets only — bare "nuggets" is grocery (Perdue, etc.), not McDonald's.
{
  re: /\b(mcnuggets?|mc\s*nuggets?)\b/i,
  label: "McDonald's",
  itemRe: /\b(\d+\s*pc\s*)?mc\s*nuggets?\b/i
},
// Require jets / jet's — bare "jet" is a candy brand in OFF/FatSecret.
{
  re: /\bjets\b|\bjet'?s\b/i,
  label: "Jet's Pizza",
  itemRe: /\bjets\b|\bjet'?s\b/i
}, {
  re: /\b(big\s*mac|quarter\s*pounder|mcflurry|happy\s*meal)\b/i,
  label: "McDonald's"
}, {
  re: /\b(whopper|chicken\s*fries)\b/i,
  label: 'Burger King'
}, {
  re: /\b(dave'?s?\s*single|frosty|baconator)\b/i,
  label: "Wendy's"
}, {
  re: /\bcrazy\s*bread\b/i,
  label: 'Little Caesars',
  itemRe: /\bcrazy\s*bread\b/i
}];
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
const FILTERED_CARD_CAP = 8;
const TRUSTED_SEED_LIMIT = 2;
const TRUSTED_ONLY_CAP = 3;
const CONSENSUS_KEEP_PRIORITY = 3;
const TRUSTED_KEEP_PRIORITY = 2;
const DB_KEEP_PRIORITY = 1;
const MIN_USABLE_CALORIES = 0;

// ===== HELPER FUNCTIONS =====

/**
 * True when this row is the multi-source consensus card.
 * @param {object} row
 * @returns {boolean}
 */
function isConsensusFoodRow(row) {
  return String((row == null ? void 0 : row.source) || '').toLowerCase() === SOURCE_NUTRITION_CONSENSUS;
}

/**
 * Keep consensus cards first so the UI never buries the agreed macros under a cousin.
 * @param {object[]} rows
 * @returns {object[]}
 */
function pinConsensusFirst(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const consensusRows = list.filter(isConsensusFoodRow);
  if (!consensusRows.length) return list;
  const rest = list.filter(row => !isConsensusFoodRow(row));
  return [...consensusRows, ...rest];
}

/**
 * Put consensus back on top when the name filter dropped it.
 * Ranker can still drop consensus on older callers — it is the product truth.
 * @param {object[]} filtered
 * @param {object[]} consensusFromMerge
 * @returns {object[]}
 */
function ensureConsensusPinned(filtered, consensusFromMerge) {
  if (consensusFromMerge.length === 0) return filtered;
  if (!filtered.some(isConsensusFoodRow)) {
    return [...consensusFromMerge, ...filtered];
  }
  return pinConsensusFirst(filtered);
}

/**
 * Trusted catalog only when consensus did not produce a card.
 * Never force raw trusted that failed the name filter — that re-inserted McNuggets for Perdue.
 * @param {string} typedText
 * @param {object[]} filtered
 * @param {object[]} trustedList
 * @param {number} closeCap
 * @returns {object[]}
 */
function seedTrustedWhenNoConsensus(typedText, filtered, trustedList, closeCap) {
  if (filtered.some(isConsensusFoodRow)) return filtered;
  if (trustedList.length === 0) return filtered;
  const trustedCap = filtered.length === 0 ? TRUSTED_ONLY_CAP : TRUSTED_SEED_LIMIT;
  const trustedClose = filterFoodSearchRows(typedText, trustedList, trustedCap);
  if (trustedClose.length === 0) return filtered;
  const seedPool = filtered.length === 0 ? trustedClose : [...filtered, ...trustedClose];
  return pinConsensusFirst(keepCloseMacroRows(seedPool, closeCap));
}

/**
 * Consensus won — only append trusted cousins that agree on macros (never re-anchor).
 * @param {string} typedText
 * @param {object[]} filtered
 * @param {object[]} trustedList
 * @param {number} closeCap
 * @returns {object[]}
 */
function appendTrustedCousinsWhenConsensus(typedText, filtered, trustedList, closeCap) {
  if (!filtered.some(isConsensusFoodRow)) return filtered;
  if (trustedList.length === 0) return filtered;
  const consensus = filtered.find(isConsensusFoodRow);
  const anchorCalories = Number(consensus == null ? void 0 : consensus.calories) || 0;
  const trustedClose = filterFoodSearchRows(typedText, trustedList, TRUSTED_SEED_LIMIT);
  const trustedCousins = trustedClose.filter(row => isCloseToAnchorCalories(Number(row.calories) || 0, anchorCalories));
  const seenKeys = new Set(filtered.map(row => `${String(row.source || '')}:${Number(row.calories) || 0}:${row.name || ''}`));
  const nextRows = [...filtered];
  for (const row of trustedCousins) {
    if (nextRows.length >= closeCap) break;
    const rowKey = `${String(row.source || '')}:${Number(row.calories) || 0}:${row.name || ''}`;
    if (seenKeys.has(rowKey)) continue;
    seenKeys.add(rowKey);
    nextRows.push(row);
  }
  return pinConsensusFirst(nextRows);
}

/**
 * Ranker wiped every server row — keep the best raw merge so the UI is not empty (A).
 * Works for grocery too: one FatSecret Apple Jacks hit beats a blank screen.
 * @param {object[]} filtered
 * @param {object[]} mergedList
 * @param {number} closeCap
 * @returns {object[]|null} recovered list, or null when filter still has cards
 */
function recoverFromBlankFilter(filtered, mergedList, closeCap) {
  if (filtered.length > 0) return null;
  if (mergedList.length === 0) return null;
  const recovered = keepCloseMacroRows(mergedList, closeCap);
  if (recovered.length > 0) {
    return pinBestDatabaseFirst(pinConsensusFirst(recovered));
  }
  return pinBestDatabaseFirst(pickBestRawFoodRows(mergedList, closeCap));
}

/**
 * Drop weak Serper/mixed scrapes from legacy when consensus or trusted DB already hit.
 * @param {object[]} legacy
 * @param {boolean} hasConsensus
 * @param {boolean} hasTrustedDb
 * @returns {object[]}
 */
function legacyPoolForMerge(legacy, hasConsensus, hasTrustedDb) {
  if (!hasConsensus && !hasTrustedDb) return legacy;
  return legacy.filter(row => {
    const sourceLower = String(row.source || '').toLowerCase();
    if (sourceLower === SOURCE_SERPER) return false;
    if (sourceLower === SOURCE_MIXED) return false;
    return true;
  });
}

/**
 * Keep a legacy row only when it is not a near-duplicate of a nutrition anchor.
 * @param {object} row
 * @param {object[]} nutrition
 * @returns {boolean}
 */
function legacyRowIsDistinct(row, nutrition) {
  for (const anchor of nutrition) {
    if (!isSameFoodCandidate(anchor, row)) continue;
    if (calorieDiffRatio(row.calories, anchor.calories) <= LEGACY_DUP_CALORIE_RATIO) {
      return false;
    }
  }
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * Split typed search text into the food name and a restaurant, when one is obvious.
 * @param {string} rawQuery
 * @returns {{ foodName: string, restaurant: string|null }}
 */
function parseNutritionSearchQuery(rawQuery) {
  const typedText = String(rawQuery || '').trim();
  if (!typedText) return {
    foodName: '',
    restaurant: null
  };

  // 1. Formal menu parser (casual phrasing) wins when it names a chain.
  const intent = parseCasualMenuIntent(typedText);
  if (intent.chain) {
    const itemPhrase = String(intent.itemPhrase || typedText).trim();
    return {
      foodName: itemPhrase || typedText,
      restaurant: intent.chain.label
    };
  }

  // 2. Loose chain hints (McNuggets, Jets, Whopper…) when formal parser misses.
  const looseChain = detectLooseRestaurantChain(typedText);
  if (looseChain) {
    const itemPhrase = stripRestaurantFromQuery(typedText, looseChain) || typedText;
    return {
      foodName: itemPhrase,
      restaurant: looseChain.label
    };
  }

  // 3. Plain grocery / brand query — no restaurant attached.
  return {
    foodName: typedText,
    restaurant: null
  };
}

/**
 * One consensus card when enough sources agree on calories.
 * @param {object} payload
 * @param {string} displayQuery
 * @returns {object|null}
 */
function mapConsensusToFoodRow(payload, displayQuery) {
  var _optObj;
  const consensus = payload == null ? void 0 : payload.consensus;
  if (!isHighConfidenceConsensus(consensus, {
    fallbackUsed: payload == null ? void 0 : payload.fallbackUsed
  })) {
    return null;
  }
  const calories = mapConsensusNutrient(consensus, 'calories');
  if (calories == null) return null;
  const query = (payload == null ? void 0 : payload.query) || {};
  const baseName = buildDisplayName(payload, displayQuery);
  const displayName = baseName;
  const sourceSubtitle = buildConsensusSubtitle(payload);
  const needsVerify = Object.values(consensus || {}).some(entry => (entry == null ? void 0 : entry.warning) === 'verify_manually');
  const sources = Array.isArray(payload == null ? void 0 : payload.sources_used) ? payload.sources_used : [];
  const carbs = mapConsensusNutrient(consensus, 'carbs_g');
  const protein = mapConsensusNutrient(consensus, 'protein_g');
  const fat = mapConsensusNutrient(consensus, 'fat_g');
  const sugar = fillSugarFromCarbsWhenDrink({
    sugar: mapConsensusNutrient(consensus, 'sugar_g'),
    carbs,
    protein,
    fat
  });
  return applyServingFields({
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
    nutrition_unverified: needsVerify || (payload == null ? void 0 : payload.fallbackUsed),
    nf_calories: calories,
    nf_protein: protein,
    nf_total_carbohydrate: carbs,
    nf_total_fat: fat,
    nf_sugars: sugar,
    metadata: {
      consensus,
      sources_used: sources,
      cacheHit: payload == null ? void 0 : payload.cacheHit,
      fallbackUsed: payload == null ? void 0 : payload.fallbackUsed,
      source: SOURCE_NUTRITION_CONSENSUS
    }
  }, displayQuery, payload, (_optObj = payload == null ? void 0 : payload.sourceResults) == null ? void 0 : _optObj[0]);
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
  const query = (payload == null ? void 0 : payload.query) || {};
  const baseName = buildDisplayName(payload, displayQuery);
  const itemLabel = resolveSourceFoodTitle(sourceRow, payload, displayQuery);
  const displayName = itemLabel || baseName;
  let sourceSubtitle;
  if (sourceRow.source) {
    sourceSubtitle = `via ${sourceRow.source}`;
  } else {
    sourceSubtitle = null;
  }
  const carbs = sourceRow.carbs_g;
  const protein = sourceRow.protein_g;
  const fat = sourceRow.fat_g;
  const sugar = fillSugarFromCarbsWhenDrink({
    sugar: sourceRow.sugar_g,
    carbs,
    protein,
    fat
  });
  return applyServingFields({
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
      source: sourceRow.sourceKey
    }
  }, displayQuery, payload, sourceRow);
}

/**
 * @param {object} payload
 * @param {string} displayQuery
 * @returns {object[]}
 */
function mapSourceResultsToFoodRows(payload, displayQuery) {
  const rows = [];
  const seenKeys = new Set();
  for (const sourceRow of (payload == null ? void 0 : payload.sourceResults) || []) {
    const row = mapSourceResultToFoodRow(sourceRow, payload, displayQuery);
    if (!row) continue;
    const key = `${row.source}:${row.calories}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
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

  // 1. Consensus macros win when sources agree — that is the card the user should see.
  if (consensusRow) {
    rows.push(consensusRow);
    appendDistinctSourceRows(rows, sourceRows, consensusRow);
    return rows;
  }

  // 2. No consensus — trusted DB rows first, then everyone else by source priority.
  const trusted = sourceRows.filter(row => sourcePriority(row.source) >= TRUSTED_DB_PRIORITY);
  const otherSources = sourceRows.filter(row => sourcePriority(row.source) < TRUSTED_DB_PRIORITY);
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
  const filtered = list.filter(row => {
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
  const hasConsensus = nutrition.some(row => String(row.source || '').toLowerCase() === SOURCE_NUTRITION_CONSENSUS);
  const hasTrustedDb = nutrition.some(row => sourcePriority(row.source) >= TRUSTED_DB_PRIORITY);
  const legacyPool = legacyPoolForMerge(legacy, hasConsensus, hasTrustedDb);
  const filtered = legacyPool.filter(row => legacyRowIsDistinct(row, nutrition));
  return [...nutrition, ...filtered].slice(0, limit);
}

/**
 * Pick the calorie anchor for close-macro filtering.
 * Multi-source nutrition_consensus always wins when present — that is the card
 * the product shows. Trusted catalog / legacy only anchor when consensus is absent.
 * @param {object[]} list
 * @returns {object}
 */
function pickCloseMacroAnchor(list) {
  const consensus = list.find(row => String(row.source || '').toLowerCase() === SOURCE_NUTRITION_CONSENSUS);
  if (consensus) return consensus;
  const trusted = list.find(row => String(row.source || '').toLowerCase() === SOURCE_TRUSTED_CATALOG);
  return trusted || list[0];
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
  const anchor = pickCloseMacroAnchor(list);
  const anchorCalories = Number(anchor.calories) || 0;
  const close = list.filter(row => isCloseToAnchorCalories(Number(row.calories) || 0, anchorCalories));
  return close.sort((leftRow, rightRow) => {
    const priorityGap = closeMacroKeepPriority(rightRow) - closeMacroKeepPriority(leftRow);
    if (priorityGap !== 0) return priorityGap;
    return Math.abs(Number(leftRow.calories) - anchorCalories) - Math.abs(Number(rightRow.calories) - anchorCalories);
  }).slice(0, limit);
}

/**
 * Best calorie-bearing rows from a raw merge when the name filter wiped everything (A).
 * Prefer consensus → trusted catalog → FatSecret/USDA/OFF → everything else.
 * This is the "any food" safety net — Apple Jacks from FatSecret still shows if titles disagree.
 * vocab: "raw" = pre-filter server/catalog rows that still have usable macros
 * @param {object[]} rows
 * @param {number} [limit]
 * @returns {object[]}
 */
function pickBestRawFoodRows(rows, limit = DEFAULT_CLOSE_LIMIT) {
  const list = (Array.isArray(rows) ? rows : []).filter(row => {
    const calories = Number((row == null ? void 0 : row.calories) ?? (row == null ? void 0 : row.nf_calories));
    return Number.isFinite(calories) && calories >= MIN_USABLE_CALORIES;
  });
  if (!list.length) return [];
  return [...list].sort((leftRow, rightRow) => {
    const priorityGap = sourcePriority(rightRow.source) - sourcePriority(leftRow.source);
    if (priorityGap !== 0) return priorityGap;
    return (Number(rightRow.calories) || 0) - (Number(leftRow.calories) || 0);
  }).slice(0, Math.max(1, limit));
}

/**
 * When multi-source consensus fails, still promote the best FatSecret/USDA/OFF hit first.
 * That is how random grocery (Apple Jacks, banana, chicken breast) feels as reliable as a Big Mac.
 * @param {object[]} rows
 * @returns {object[]}
 */
function pinBestDatabaseFirst(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return list;
  if (list.some(isConsensusFoodRow)) return pinConsensusFirst(list);
  let bestIndex = -1;
  let bestPriority = -1;
  for (let index = 0; index < list.length; index += 1) {
    const priority = sourcePriority(list[index].source);
    if (priority >= TRUSTED_DB_PRIORITY && priority > bestPriority) {
      bestPriority = priority;
      bestIndex = index;
    }
  }
  if (bestIndex <= 0) return list;
  const best = list[bestIndex];
  return [best, ...list.slice(0, bestIndex), ...list.slice(bestIndex + 1)];
}

/**
 * Name-filter + close-macro cluster with consensus pinned first.
 * Trusted catalog fills gaps when consensus never landed.
 * Never returns empty when the merge had calorie-bearing rows (A).
 * Soft name filter keeps consensus / trusted through title quirks (C).
 * @param {string} typedText
 * @param {object[]} merged
 * @param {object[]} [trusted]
 * @param {number} [limit]
 * @returns {object[]}
 */
function presentFoodSearchRows(typedText, merged, trusted = [], limit = DEFAULT_MERGE_LIMIT) {
  // 1. Name-filter the merged list; never show more than FILTERED_CARD_CAP cards.
  const closeCap = Math.min(limit, DEFAULT_CLOSE_LIMIT);
  const mergedList = Array.isArray(merged) ? merged : [];
  const trustedList = Array.isArray(trusted) ? trusted : [];
  const consensusFromMerge = mergedList.filter(isConsensusFoodRow);
  let filtered = filterFoodSearchRows(typedText, mergedList, Math.min(limit, FILTERED_CARD_CAP));

  // Put consensus back if the ranker dropped it, then pin it first.
  filtered = ensureConsensusPinned(filtered, consensusFromMerge);

  // 2. Keep only rows whose macros sit near the anchor calories.
  filtered = pinConsensusFirst(keepCloseMacroRows(filtered, closeCap));

  // 3. Seed trusted catalog when consensus is missing; append cousins when consensus won.
  if (!filtered.some(isConsensusFoodRow)) {
    filtered = seedTrustedWhenNoConsensus(typedText, filtered, trustedList, closeCap);
  } else {
    filtered = appendTrustedCousinsWhenConsensus(typedText, filtered, trustedList, closeCap);
  }

  // 4. Recover from a blank filter — best raw rows beat an empty list.
  const recovered = recoverFromBlankFilter(filtered, mergedList, closeCap);
  if (recovered) return recovered;
  return pinBestDatabaseFirst(pinConsensusFirst(filtered));
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
  const sugarMissing = !Number.isFinite(sugar) || sugar <= 0;
  const looksLikeDrink = carbs > 0 && protein < NEAR_ZERO_MACRO_GRAMS && fat < NEAR_ZERO_MACRO_GRAMS;
  if (sugarMissing && looksLikeDrink) {
    sugar = carbs;
  }
  if (!Number.isFinite(sugar) || sugar < 0) return row;
  return {
    ...row,
    sugar,
    nf_sugars: sugar
  };
}

// ===== PLUMBING — skip unless debugging =====

function detectLooseRestaurantChain(typedText) {
  for (const hint of LOOSE_CHAIN_HINTS) {
    if (hint.re.test(typedText)) {
      return {
        label: hint.label,
        itemRe: hint.itemRe || hint.re
      };
    }
  }
  for (const chain of RESTAURANT_CHAINS) {
    if (chain.re.test(typedText)) return {
      label: chain.label,
      itemRe: chain.re
    };
  }
  return null;
}
function stripRestaurantFromQuery(typedText, chain) {
  let phrase = typedText;
  if (chain == null ? void 0 : chain.itemRe) phrase = phrase.replace(chain.itemRe, ' ');
  for (const restaurantChain of RESTAURANT_CHAINS) {
    phrase = phrase.replace(restaurantChain.re, ' ');
  }
  return phrase.replace(/\s+/g, ' ').trim();
}
function isHighConfidenceConsensus(consensus, {
  fallbackUsed = false
} = {}) {
  if (fallbackUsed) return false;
  const calorieEntry = consensus == null ? void 0 : consensus.calories;
  if (!calorieEntry || calorieEntry.value == null) return false;
  if ((calorieEntry.sources_agreeing || 0) < MIN_SOURCES_AGREEING) return false;
  // Allow 0-cal diet drinks — only reject negative / missing.
  if (Number(calorieEntry.value) < 0) return false;
  return true;
}
function mapConsensusNutrient(consensus, key) {
  const entry = consensus == null ? void 0 : consensus[key];
  if (!entry || entry.value == null) return null;
  return entry.value;
}
function fillSugarFromCarbsWhenDrink({
  sugar,
  carbs,
  protein,
  fat
}) {
  const sugarMissing = sugar == null || sugar <= 0;
  const looksLikeDrink = Number(carbs) > 0 && Number(protein || 0) < NEAR_ZERO_MACRO_GRAMS && Number(fat || 0) < NEAR_ZERO_MACRO_GRAMS;
  if (sugarMissing && looksLikeDrink) return carbs;
  return sugar;
}
function buildDisplayName(payload, displayQuery) {
  const raw = String(displayQuery || '').trim();
  const query = (payload == null ? void 0 : payload.query) || {};
  const fromUser = formatUserQueryAsFoodName(raw);
  if (fromUser && !isJunkFoodTitle(fromUser)) return fromUser;
  let fromParsed = formatUserQueryAsFoodName(query.foodName || '');
  if (query.restaurant) {
    fromParsed = formatUserQueryAsFoodName(`${query.restaurant} ${query.foodName || ''}`.trim());
  }
  if (fromParsed && !isJunkFoodTitle(fromParsed)) return fromParsed;
  return fromUser || fromParsed || FALLBACK_FOOD_NAME;
}
function resolveSourceFoodTitle(sourceRow, payload, displayQuery) {
  const cleaned = stripLegacyFoodTitleDecorations(sourceRow == null ? void 0 : sourceRow.displayName);
  if (cleaned && !isJunkFoodTitle(cleaned)) return cleaned;
  return buildDisplayName(payload, displayQuery);
}
function buildConsensusSubtitle(payload) {
  const fromResults = ((payload == null ? void 0 : payload.sourceResults) || []).map(resultRow => resultRow.source).filter(Boolean);
  const fromUsed = Array.isArray(payload == null ? void 0 : payload.sources_used) ? payload.sources_used : [];
  const names = [...new Set(fromResults.length ? fromResults : fromUsed)];
  if (names.length === 0) return 'via consensus';
  if (names.length === 1) return `via ${names[0]}`;
  return `via ${names.slice(0, 4).join(', ')}`;
}
function applyServingFields(row, displayQuery, payload, sourceRow = null) {
  var _optObj2;
  const detailed = resolveFoodServingLabelDetailed({
    userQuery: displayQuery,
    foodName: row.food_name || row.name,
    restaurant: ((_optObj2 = payload == null ? void 0 : payload.query) == null ? void 0 : _optObj2.restaurant) || row.restaurant,
    scraperLabel: sourceRow == null ? void 0 : sourceRow.servingLabel,
    displayName: sourceRow == null ? void 0 : sourceRow.displayName,
    calories: row.nf_calories ?? row.calories
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
    multiServingFallback: Boolean(row.multiServingFallback) || Boolean(detailed.multiServingFallback)
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
    const overlap = tokensLeft.filter(token => tokensRight.includes(token)).length;
    const shorterCount = Math.min(tokensLeft.length, tokensRight.length);
    if (shorterCount >= 2 && overlap >= shorterCount - 1) return true;
  }
  const caloriesLeft = Number(leftRow.calories);
  const caloriesRight = Number(rightRow.calories);
  if (Number.isFinite(caloriesLeft) && Number.isFinite(caloriesRight) && caloriesLeft > 0) {
    const diff = Math.abs(caloriesLeft - caloriesRight) / caloriesLeft;
    const namesOverlap = nameLeft.includes(nameRight) || nameRight.includes(nameLeft);
    if (diff <= SAME_FOOD_CALORIE_RATIO && namesOverlap) return true;
  }
  return false;
}
function sourcePriority(source) {
  const sourceText = String(source || '');
  const sourceLower = sourceText.toLowerCase();
  if (sourceLower === SOURCE_NUTRITION_CONSENSUS) return CONSENSUS_PRIORITY;
  if (sourceLower === SOURCE_TRUSTED_CATALOG) return TRUSTED_CATALOG_PRIORITY;
  if (TRUSTED_DB_SOURCES.has(sourceText) || TRUSTED_DB_SOURCES.has(sourceLower)) {
    return TRUSTED_DB_PRIORITY;
  }
  if (sourceLower === SOURCE_SERPER || sourceLower === SOURCE_MIXED) return WEAK_WEB_PRIORITY;
  return DEFAULT_SOURCE_PRIORITY;
}
function calorieDiffRatio(leftCalories, rightCalories) {
  return Math.abs(Number(leftCalories) - Number(rightCalories)) / Math.max(Math.abs(Number(rightCalories)) || 1, 1);
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
module.exports = {
  parseNutritionSearchQuery,
  mapConsensusToFoodRow,
  mapSourceResultToFoodRow,
  mapSourceResultsToFoodRows,
  mapNutritionSearchToFoodRows,
  mergeConsensusWithResults,
  mergeNutritionSearchWithLegacy,
  keepCloseMacroRows,
  pickBestRawFoodRows,
  pinBestDatabaseFirst,
  presentFoodSearchRows,
  enrichSearchRowMicros,
  isHighConfidenceConsensus,
  isConsensusFoodRow,
  pinConsensusFirst,
  isCloseToAnchorCalories,
  // Re-exported from tidyFoodTitles — keep for older import paths / Metro cache.
  sanitizeFoodCardTitle,
  stripLegacyFoodTitleDecorations
};
