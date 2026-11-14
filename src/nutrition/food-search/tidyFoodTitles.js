// Cleans web-search titles so a food card never shows "[PDF]" or "Nutrition Information".
// Flow: strip junk suffixes → pick the part that matches the typed text → title-case for the card.
// Used by food search and the log writer. CommonJS so the food tests can require() it.
// Read order: constants → helpers → mains → PLUMBING dedupe / Serper title pickers.

const {
  significantQueryTokens,
  countTokenHits
} = require('../food-search/rankFoodResults');
const {
  resolveFoodServingLabelDetailed,
  servingConflictsWithFood
} = require('./guessServingLabel');

// ===== NAMED CONSTANTS =====

const JUNK_TITLE_RE = /\[(pdf|doc|xls|ppt|docx)\]|\.pdf\b|nutrition\s+infor|nutrition\s+facts\s*(guide|sheet|pdf)?\s*$/i;

/** Concatenated web/menu-page titles and tracker noise that must never top search. */
const MENU_PAGE_JUNK_RE = /\bmenu\s*items?\b|breadmenu|menuitems?|\bgs1\b|\bupc\s*tracker\b|\bbarcode\s*tracker\b|\bnutritionix\s*track|\bcalorie\s*content\b|\ballergen\s*(guide|sheet)\b|\bsearch\s+results?\b|\bproduct\s+list\b|\bhomepage\b|\b14\s*million\s+foods\b|\bfood\s+search\s+results?\b|\bmenu\s+with\s+prices\b|\bpdf\s+download\b|\btrack(er|ing)?\s+your\s+calories\b|\bclick\s+here\b|\bsee\s+full\s+(nutrition|label)\b|\bhow\s+many\s+calories\s+in\b|\bcalories?\s+and\s+nutrition\s+facts?\b|\bshop\s+now\b|\bbuy\s+online\b/i;

/** Site / pipeline names that must never become the food card title. */
const SOURCE_NAME_JUNK = new Set(['calorieking', 'fatsecret', 'fastfoodnutrition', 'openfoodfacts', 'foodfacto', 'usda', 'usdafooddatacentral', 'serper', 'consensus', 'nutritionconsensus', 'myfitnesspal', 'nutritionix', 'cronometer', 'yazio', 'menustat', 'web', 'unknown', 'menuitem', 'foodsearchresultspage', 'nutritionfactslabelscannerapp']);
const SOURCE_SUBTITLE_LABELS = {
  nutrition_consensus: null,
  fatsecret: 'FatSecret',
  fatSecret: 'FatSecret',
  calorieking: 'CalorieKing',
  calorieKing: 'CalorieKing',
  fastfoodnutrition: 'FastFoodNutrition',
  fastFoodNutrition: 'FastFoodNutrition',
  foodfacto: 'FoodFacto',
  foodFacto: 'FoodFacto',
  openfoodfacts: 'Open Food Facts',
  openFoodFacts: 'Open Food Facts',
  usda: 'USDA',
  usdafdc: 'USDA',
  usdaFdc: 'USDA FoodData Central',
  serper: 'Web',
  mixed: 'Web'
};
const FALLBACK_MENU_ITEM_NAME = 'Menu item';
const MIN_TITLE_LENGTH = 4;
const MIN_CLEANED_TITLE_LENGTH = 3;
const SHORT_CALORIES_IN_TITLE_MAX = 30;
const SERPER_TITLE_MAX_LENGTH = 90;
const SERPER_TITLE_CUT_LENGTH = 87;
const FOUR_TOKEN_HIT_RATIO = 0.55;
const MIN_HITS_WHEN_FOUR_TOKENS = 3;
const MIN_HITS_WHEN_TWO_TOKENS = 2;
const LONG_TITLE_PART_MIN = 10;
const MACRO_NEAR_DUP_RATIO = 0.05;
const MIN_MACRO_CALORIES_FOR_PLAUSIBLE = 20;
const MIN_CALORIES_WITHOUT_MACROS = 80;
const KCAL_PER_PROTEIN_OR_CARB = 4;
const KCAL_PER_FAT = 9;
const SPECIAL_SHORT_TITLE_WORDS = new Set(['inn', 'bbq', 'ii']);
const FOOD_WORD_IN_TITLE_RE = /\b(pizza|burger|bread|chicken|salad)\b/i;
const REAL_FOOD_WORD_RE = /\b(burger|sandwich|pizza|bread|nugget|taco|bowl|salad|latte|coke|wing|fries)\b/i;
const TRACKER_SITE_NAME_RE = /\b(calorieking|myfitnesspal|open\s*food\s*facts|fooddata\s*central|nutrition\s*facts\s*label\s*scanner)\b/i;
const BARE_SOURCE_NAME_RE = /^(calorieking|fatsecret|fastfoodnutrition|openfoodfacts|foodfacto|myfitnesspal)$/i;
const BARE_TRACKER_WORD_RE = /^(menu\s*items?|tracker|gs1|upc|barcode)$/i;
const CHAIN_NAME_IN_TITLE_RE = /\b(little\s*caesars?|mcdonald'?s?|chipotle|wendy'?s?|domino'?s?)\b/gi;

// ===== HELPER FUNCTIONS =====

function titleCaseWords(text) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const casedWords = [];
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    if (SPECIAL_SHORT_TITLE_WORDS.has(lowerWord)) {
      casedWords.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
      continue;
    }
    casedWords.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return casedWords.join(' ');
}
function titleKeyWithoutPunctuation(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function normalizeTitleKey(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function minTokenHitsForSerperTitle(tokens) {
  if (tokens.length >= 4) {
    return Math.max(MIN_HITS_WHEN_FOUR_TOKENS, Math.ceil(tokens.length * FOUR_TOKEN_HIT_RATIO));
  }
  if (tokens.length >= 2) return MIN_HITS_WHEN_TWO_TOKENS;
  return 1;
}
function looksLikeCaloriesInHeadline(titleText) {
  if (!/^(calories|carbs|protein|fat)\s+in\b/i.test(titleText)) return false;
  return titleText.length < SHORT_CALORIES_IN_TITLE_MAX;
}
function looksLikeTrackerSiteWithoutFood(titleText) {
  if (!TRACKER_SITE_NAME_RE.test(titleText)) return false;
  return !REAL_FOOD_WORD_RE.test(titleText);
}
function looksLikeBareNutritionHeadline(titleText) {
  if (!/^nutrition\b/i.test(titleText)) return false;
  return !FOOD_WORD_IN_TITLE_RE.test(titleText);
}
function macroCalories(proteinGrams, carbGrams, fatGrams) {
  return KCAL_PER_PROTEIN_OR_CARB * (Number(proteinGrams) || 0) + KCAL_PER_PROTEIN_OR_CARB * (Number(carbGrams) || 0) + KCAL_PER_FAT * (Number(fatGrams) || 0);
}
function fallbackPlausibleNutritionRow(macros) {
  const calories = Number(macros?.calories) || 0;
  const protein = Number(macros?.protein) || 0;
  const carbs = Number(macros?.carbs) || 0;
  const fat = Number(macros?.fat) || 0;
  if (calories <= 0) return false;
  const fromMacros = macroCalories(protein, carbs, fat);
  if (fromMacros >= MIN_MACRO_CALORIES_FOR_PLAUSIBLE) return true;
  if (calories >= MIN_CALORIES_WITHOUT_MACROS) return false;
  return calories > 0 && (protein > 0 || carbs > 0 || fat > 0);
}
function inferSourceSubtitle(row) {
  if (row?.source_subtitle) return row.source_subtitle;
  const sourceText = String(row?.source || '');
  const label = SOURCE_SUBTITLE_LABELS[sourceText] || SOURCE_SUBTITLE_LABELS[sourceText.toLowerCase()];
  if (label) return `via ${label}`;
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * User-facing name from their search (e.g. cottage inn garlic cheese bread).
 * @param {string} query
 * @returns {string}
 */
function formatUserQueryAsFoodName(query) {
  const typedText = String(query || '').trim().replace(/\s+nutrition\s+facts.*$/i, '').replace(/\s+calories.*$/i, '').trim();
  if (!typedText) return FALLBACK_MENU_ITEM_NAME;
  return titleCaseWords(typedText);
}

/**
 * True when a Google/Serper title is tracker noise, a PDF, or a site name — not a food.
 * @param {string} title
 * @returns {boolean}
 */
function isJunkWebSearchTitle(title) {
  const titleText = String(title || '').trim();
  if (!titleText || titleText.length < MIN_TITLE_LENGTH) return true;
  if (JUNK_TITLE_RE.test(titleText)) return true;
  if (MENU_PAGE_JUNK_RE.test(titleText)) return true;
  if (/\b\w+menu\s*items?\b/i.test(titleText)) return true;
  if (looksLikeBareNutritionHeadline(titleText)) return true;
  if (looksLikeCaloriesInHeadline(titleText)) return true;
  if (/^(download|view|read)\b/i.test(titleText)) return true;
  if (SOURCE_NAME_JUNK.has(titleKeyWithoutPunctuation(titleText))) return true;
  if (looksLikeTrackerSiteWithoutFood(titleText)) return true;
  return false;
}

/**
 * @param {string} rawTitle - Serper / Google result title
 * @param {string} userQuery - what the user typed (not the Serper-expanded query)
 * @returns {string}
 */
function cleanSerperFoodTitle(rawTitle, userQuery) {
  // 1. Build the fallback name from the typed query.
  const queryName = formatUserQueryAsFoodName(userQuery);
  const tokens = significantQueryTokens(userQuery);
  const minHits = minTokenHitsForSerperTitle(tokens);

  // 2. Strip PDF / "Calories in" decorations, then pick the best hyphen piece.
  let titleText = pickBestTitlePart(stripSerperTitleDecorations(rawTitle), tokens, minHits);

  // 3. If still junk or too few query-token hits, use the typed query as the card name.
  const tokenHits = countTokenHits(titleText, tokens);
  if (isJunkWebSearchTitle(titleText) || tokenHits < minHits) {
    return queryName;
  }
  return shortenLongTitle(titleText);
}

/** Strip legacy card suffixes, site names, and dangling separators from any food title. */
function stripLegacyFoodTitleDecorations(name) {
  return String(name || '').replace(/\s*—\s*Consensus\s*\([^)]*\)\s*$/i, '').replace(/\s*[-–|]\s*(CalorieKing|FatSecret|MyFitnessPal|FastFoodNutrition|OpenFoodFacts|USDA|Nutritionix|Cronometer).*$/i, '').replace(/\s*—\s*[^—]+?\s*\(\s*\d+[^)]*cal[^)]*\)\s*$/i, '').replace(/\s*—\s*[^—]+$/i, '').replace(/\s*—\s*$/g, '').replace(/\s+[-–|]\s*$/g, '').replace(/\s+-\s*$/g, '').trim();
}
function isJunkFoodTitle(name) {
  const cleaned = stripLegacyFoodTitleDecorations(name);
  if (!cleaned || cleaned.length < MIN_CLEANED_TITLE_LENGTH) return true;
  if (isJunkWebSearchTitle(cleaned)) return true;
  if (SOURCE_NAME_JUNK.has(normalizeTitleKey(cleaned))) return true;
  if (BARE_SOURCE_NAME_RE.test(cleaned)) return true;
  if (BARE_TRACKER_WORD_RE.test(cleaned)) return true;
  return false;
}

/**
 * Universal food card title — works for every source (nutrition scrape, Serper, USDA, OFF, cache).
 * @param {string} name - raw row title
 * @param {string} fallback - user search query or parsed food name
 * @returns {string}
 */
function sanitizeFoodCardTitle(name, fallback = '') {
  const {
    readableFoodTitle
  } = require('./readableFoodTitle');
  return readableFoodTitle({
    name,
    userQuery: fallback
  }).name;
}

/**
 * Final presentation pass for any search result row — title + optional via-line.
 * Call this for every row from every provider before showing or caching.
 * @param {object} row
 * @param {string} [userQuery]
 * @returns {object}
 */
function applyFoodCardPresentation(row, userQuery = '') {
  if (!row || typeof row !== 'object') return row;
  const source = String(row.source || '').toLowerCase();
  const rawName = String(row.food_name || row.name || '').trim();
  const query = String(userQuery || '').trim();
  const isWebHit = source === 'serper' || source === 'mixed';

  // 1. Web hits get an extra Serper title scrub before the universal sanitizer runs.
  let title;
  if (isWebHit && query) {
    title = sanitizeFoodCardTitle(cleanSerperFoodTitle(rawName, query), query);
  } else {
    title = sanitizeFoodCardTitle(rawName, query);
  }

  // 2. readableFoodTitle owns brand + final casing.
  const {
    readableFoodTitle
  } = require('./readableFoodTitle');
  const normalized = readableFoodTitle({
    name: title,
    brand: row.brand || row.brand_name,
    source: row.source,
    userQuery: query
  });
  title = normalized.name;
  const brand = normalized.brand || row.brand || row.brand_name || '';

  // 3. Serving line must match food family (nuggets vs bread, etc.).
  const source_subtitle = inferSourceSubtitle(row);
  // vocab/symbol: ?? = keep 0 calories; do not fall through with ||
  const calories = row.nf_calories ?? row.calories;
  const servingResolved = resolveFoodServingLabelDetailed({
    userQuery: query,
    foodName: title,
    restaurant: row.restaurant || row.brand_name || row.brand,
    scraperLabel: row.serving_label || row.servingLabel,
    displayName: title,
    calories
  });
  const servingLabel = servingResolved.label;
  const servingConflicts = servingConflictsWithFood({
    userQuery: query,
    foodName: title,
    restaurant: row.restaurant || row.brand_name || row.brand,
    servingLabel: row.serving_label || row.servingLabel
  });

  // 4. Spread back onto the row with every legacy serving key letter filled in.
  const presentedRow = {
    ...row,
    name: title,
    food_name: title,
    brand,
    brand_name: brand,
    serving_label: servingLabel,
    servingLabel,
    serving_unit: servingLabel,
    servingUnit: servingLabel,
    portion_text: servingLabel,
    nutrition_unverified: Boolean(row.nutrition_unverified) || Boolean(servingResolved.nutrition_unverified) || servingConflicts,
    multiServingFallback: Boolean(row.multiServingFallback) || Boolean(servingResolved.multiServingFallback)
  };
  if (source_subtitle) {
    presentedRow.source_subtitle = source_subtitle;
  }
  return presentedRow;
}
function applyFoodCardPresentationToRows(rows, userQuery = '') {
  const safeRows = Array.isArray(rows) ? rows : [];
  const presentedRows = [];
  for (const row of safeRows) {
    presentedRows.push(applyFoodCardPresentation(row, userQuery));
  }
  return presentedRows;
}

/** Card title — base name plus portion when several web hits share the same dish name. */
function displayNameForSerperRow(rawTitle, userQuery, macros) {
  let baseName;
  if (isJunkWebSearchTitle(rawTitle)) {
    baseName = formatUserQueryAsFoodName(userQuery);
  } else {
    baseName = cleanSerperFoodTitle(rawTitle, userQuery);
  }
  const servingLabel = String(macros?.servingLabel || '').trim();
  if (!servingLabel) return baseName;
  const labelLower = servingLabel.toLowerCase();
  if (baseName.toLowerCase().includes(labelLower)) return baseName;
  return `${baseName} · ${servingLabel}`;
}

/** Drop Serper rows that only found calories with no protein/carbs/fat (common in PDF snippets). */
function isPlausibleNutritionRow(macros) {
  try {
    const {
      isPlausibleRestaurantNutritionRow
    } = require('./trustRestaurantResult');
    return isPlausibleRestaurantNutritionRow(macros);
  } catch {
    return fallbackPlausibleNutritionRow(macros);
  }
}

/** Drop exact duplicates and near-identical rows (same name ± brand, macros within ~5%). */
function dedupeFoodRows(rows) {
  const uniqueRows = [];
  const seenKeys = new Set();

  // 1. Walk in order so the first (usually best-ranked) row wins.
  for (const row of rows || []) {
    const rowKey = nutritionRowKey(row);
    if (seenKeys.has(rowKey)) continue;
    if (isNearDuplicateRow(uniqueRows, rowMacroTuple(row))) continue;
    seenKeys.add(rowKey);
    uniqueRows.push(row);
  }
  return uniqueRows;
}

// ===== PLUMBING — skip unless debugging =====

function stripSerperTitleDecorations(rawTitle) {
  return String(rawTitle || '').replace(/^\[(PDF|DOC|XLS|PPT|DOCX)\]\s*/i, '').replace(/^PDF\s+Nutrition\s+Facts\s+/i, '').replace(/^Calories in\s+/i, '').replace(/^Carbs in\s+/i, '').replace(/^Nutrition (?:Information|Facts|Guide)(?:\s+for)?\s*[-–:]\s*/i, '').replace(/\s*[-–|]\s*CalorieKing.*$/i, '').replace(/\s*[-–|]\s*MyFitnessPal.*$/i, '').replace(/\s*\.pdf\s*$/i, '').trim();
}
function pickBestTitlePart(titleText, tokens, minHits) {
  const parts = titleText.split(/\s*[-–|]\s*/).map(part => part.trim()).filter(Boolean);
  if (parts.length <= 1) return titleText;
  const scoredParts = [];
  for (const part of parts) {
    if (isJunkWebSearchTitle(part)) continue;
    scoredParts.push({
      part,
      hits: countTokenHits(part, tokens)
    });
  }
  scoredParts.sort((left, right) => right.hits - left.hits);
  const best = scoredParts[0];
  if (!best) return titleText;
  if (best.hits >= minHits) return best.part;
  if (best.part.length > LONG_TITLE_PART_MIN) return best.part;
  return titleText;
}
function shortenLongTitle(titleText) {
  if (titleText.length > SERPER_TITLE_MAX_LENGTH) {
    return `${titleText.slice(0, SERPER_TITLE_CUT_LENGTH)}…`;
  }
  return titleText;
}
function nutritionRowKey(row) {
  const {
    readableFoodTitle
  } = require('./readableFoodTitle');
  const {
    name
  } = readableFoodTitle({
    name: row.food_name || row.name,
    brand: row.brand || row.brand_name,
    source: row.source
  });
  const nameKey = normalizeTitleKey(name);
  const calories = Math.round(Number(row.nf_calories ?? row.calories) || 0);
  const protein = Math.round(Number(row.nf_protein ?? row.protein) || 0);
  const carbs = Math.round(Number(row.nf_total_carbohydrate ?? row.carbs) || 0);
  const fat = Math.round(Number(row.nf_total_fat ?? row.fat) || 0);
  const label = String(row.serving_label || row.serving_unit || '').toLowerCase();
  return `${nameKey}|${calories}|${protein}|${carbs}|${fat}|${label}`;
}
function rowMacroTuple(row) {
  const rawName = String(row.food_name || row.name || '').replace(CHAIN_NAME_IN_TITLE_RE, '');
  return {
    calories: Number(row.nf_calories ?? row.calories) || 0,
    protein: Number(row.nf_protein ?? row.protein) || 0,
    carbs: Number(row.nf_total_carbohydrate ?? row.carbs) || 0,
    fat: Number(row.nf_total_fat ?? row.fat) || 0,
    nameKey: normalizeTitleKey(rawName)
  };
}
function macrosWithinPct(leftMacros, rightMacros, percentTolerance = MACRO_NEAR_DUP_RATIO) {
  const macroKeys = ['calories', 'protein', 'carbs', 'fat'];
  for (const key of macroKeys) {
    const leftValue = leftMacros[key];
    const rightValue = rightMacros[key];
    if (leftValue === 0 && rightValue === 0) continue;
    const base = Math.max(Math.abs(leftValue), Math.abs(rightValue), 1);
    if (Math.abs(leftValue - rightValue) / base > percentTolerance) return false;
  }
  return true;
}
function namesLookAlike(leftKey, rightKey) {
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (leftKey.includes(rightKey)) return true;
  if (rightKey.includes(leftKey)) return true;
  return false;
}
function isNearDuplicateRow(previousRows, macros) {
  for (const previousRow of previousRows) {
    const previousMacros = rowMacroTuple(previousRow);
    if (!namesLookAlike(macros.nameKey, previousMacros.nameKey)) continue;
    if (macrosWithinPct(macros, previousMacros, MACRO_NEAR_DUP_RATIO)) {
      return true;
    }
  }
  return false;
}
module.exports = {
  formatUserQueryAsFoodName,
  isJunkWebSearchTitle,
  isJunkFoodTitle,
  cleanSerperFoodTitle,
  displayNameForSerperRow,
  isPlausibleNutritionRow,
  dedupeFoodRows,
  stripLegacyFoodTitleDecorations,
  sanitizeFoodCardTitle,
  inferSourceSubtitle,
  applyFoodCardPresentation,
  applyFoodCardPresentationToRows
};