// Build nutrition-facts view models from logged food entries (macros, micros, FDA-style rows, daily totals).
// Flow: flatten metadata → scale per-100g / label-serving → extract nutrients → merge API enrichment → build card rows.
// Used by: NutritionFactsScreen, daily nutrition cards, and log enrichment after search.

import {
  NUT_MACRO_RING_GRADIENTS,
  NUT_CALORIES_GRADIENT,
  NUT_SECTION_GRADIENT,
} from '../nutritionColors';

// ===== NAMED CONSTANTS =====

const GRAMS_PER_100 = 100;
const CALORIES_PER_GRAM_FAT = 9;
const TENTHS = 10;
const CALORIE_SCALE_TOLERANCE = 1;
const EMPTY_SERVING_LABEL = '—';
const DEFAULT_FOOD_NAME = 'Food Item';
const DATA_BASIS_LABEL_SERVING = 'label_serving';
const SOURCE_OPENFOODFACTS = 'openfoodfacts';
const SOURCE_USDA = 'usda';
const SERVING_UNIT_ML = 'ml';
const GRAMS_PER_OUNCE = 28.3495;
const ML_PER_FLUID_OUNCE = 29.5735;
const G_TO_OZ = 1 / GRAMS_PER_OUNCE;
const ML_TO_FL_OZ = 1 / ML_PER_FLUID_OUNCE;
const MIN_FAT_FOR_SAT_ENRICH = 2;
const MIN_CARBS_FOR_FIBER_ENRICH = 5;
const MIN_MICROS_BEFORE_ENRICH = 6;
const ROUND_MG_THRESHOLD = 100;
const MAX_PCT_CAP = 100;
const DEFAULT_CALORIE_GOAL = 2200;
const DEFAULT_PROTEIN_GOAL = 150;
const DEFAULT_CARBS_GOAL = 250;
const DEFAULT_FAT_GOAL = 70;
const TRANS_FAT_BAR_MAX = 2;
const POLY_FAT_BAR_MAX = 20;
const MONO_FAT_BAR_MAX = 30;
const SUGAR_BAR_MAX = 50;
const DV_SODIUM_MG = 2300;
const DV_POTASSIUM_MG = 4700;
const DV_CALCIUM_MG = 1300;

const META_FIELD_ALIASES = {
  saturatedFat: ['saturatedFat', 'saturated_fat'],
  transFat: ['transFat', 'trans_fat'],
  polyunsaturatedFat: ['polyunsaturatedFat', 'polyunsaturated_fat'],
  monounsaturatedFat: ['monounsaturatedFat', 'monounsaturated_fat'],
  vitaminA: ['vitaminA', 'vitamin_a'],
  vitaminC: ['vitaminC', 'vitamin_c'],
  vitaminD: ['vitaminD', 'vitamin_d'],
};

const META_NF_ALIASES = {
  fiber: ['fiber', 'nf_dietary_fiber', 'dietary_fiber'],
  sugar: ['sugar', 'nf_sugars', 'sugars'],
  sodium: ['sodium', 'nf_sodium'],
  potassium: ['potassium', 'nf_potassium'],
  cholesterol: ['cholesterol', 'nf_cholesterol'],
};

const EXTENDED_KEYS = [
  'fiber', 'sugar', 'sodium', 'potassium', 'cholesterol',
  'saturatedFat', 'transFat', 'polyunsaturatedFat', 'monounsaturatedFat',
  'calcium', 'iron', 'vitaminA', 'vitaminC', 'vitaminD',
];

const API_NUTRIENT_MAP = {
  calories: 'calories',
  protein: 'protein',
  carbs: 'carbs',
  fat: 'fat',
  fiber: 'fiber',
  sugar: 'sugar',
  sodium: 'sodium',
  potassium: 'potassium',
  cholesterol: 'cholesterol',
  saturatedFat: 'saturatedFat',
  transFat: 'transFat',
  polyunsaturatedFat: 'polyunsaturatedFat',
  monounsaturatedFat: 'monounsaturatedFat',
  calcium: 'calcium',
  iron: 'iron',
  vitaminA: 'vitaminA',
  vitaminC: 'vitaminC',
  vitaminD: 'vitaminD',
};

/** FDA % Daily Value (2,000 kcal diet). Export name frozen. */
export const DAILY_VALUES = {
  fat: 78,
  saturatedFat: 20,
  cholesterol: 300,
  sodium: DV_SODIUM_MG,
  carbs: 275,
  fiber: 28,
  protein: 50,
  potassium: DV_POTASSIUM_MG,
  calcium: DV_CALCIUM_MG,
  iron: 18,
  vitaminA: 900,
  vitaminC: 90,
  vitaminD: 20,
};

// ===== HELPER FUNCTIONS =====

/**
 * Coerce to a finite number, or 0 when the value is junk.
 * @param {*} rawValue
 * @returns {number}
 */
function numericOrZero(rawValue) {
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/**
 * Coerce to a finite number, or null when empty / junk.
 * @param {*} rawValue
 * @returns {number|null}
 */
function numericOrNull(rawValue) {
  if (rawValue == null || rawValue === '') return null;
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * First non-null alias from metadata.
 * @param {object} meta
 * @param {string[]} keys
 * @returns {number|null}
 */
function readMetaValue(meta, keys) {
  for (const aliasKey of keys) {
    const found = numericOrNull(meta?.[aliasKey]);
    if (found != null) return found;
  }
  return null;
}

/**
 * Data source string on the log (metadata wins over top-level).
 * @param {object} log
 * @returns {string}
 */
function dataSource(log) {
  const meta = resolveMetadata(log);
  return meta.source || log?.source || '';
}

/**
 * True when nutrients are stored for the package label serving, not per 100 g.
 * @param {object} log
 * @returns {boolean}
 */
function isLabelServingLog(log) {
  const meta = resolveMetadata(log);
  return String(meta.dataBasis || log?.dataBasis || '').toLowerCase() === DATA_BASIS_LABEL_SERVING;
}

/**
 * Per-portion multiplier for openfoodfacts / usda (metadata is per 100g/ml).
 * @param {object} log
 * @returns {number}
 */
function servingMultiplier(log) {
  if (isLabelServingLog(log)) {
    return labelServingMultiplier(log);
  }
  if (dataSource(log) === SOURCE_OPENFOODFACTS || dataSource(log) === SOURCE_USDA) {
    return perHundredGramsMultiplier(log);
  }
  return 1;
}

/**
 * Scale factor when the log already stores label-serving totals.
 * @param {object} log
 * @returns {number}
 */
function labelServingMultiplier(log) {
  const labelGrams =
    Number(resolveMetadata(log).labelServingGrams) || Number(log?.serving_grams) || 0;
  const grams = Number(log?.serving_grams) || labelGrams;
  if (labelGrams > 0 && grams > 0) return grams / labelGrams;
  return Number(log?.serving_size) > 0 ? Number(log.serving_size) : 1;
}

/**
 * Scale factor for per-100g sources.
 * @param {object} log
 * @returns {number}
 */
function perHundredGramsMultiplier(log) {
  const meta = resolveMetadata(log);
  const grams =
    Number(log?.serving_grams) ||
    Number(meta.servingGrams) ||
    Number(meta.servingAmount) ||
    0;
  if (Number.isFinite(grams) && grams > 0) return grams / GRAMS_PER_100;
  const quantity = Number(log?.serving_size);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

/**
 * Read a micro from metadata and scale it to the logged portion.
 * @param {object} log
 * @param {string} key
 * @returns {number|null}
 */
function scaledFromMeta(log, key) {
  const meta = resolveMetadata(log);
  const aliases = [
    ...(META_FIELD_ALIASES[key] || []),
    ...(META_NF_ALIASES[key] || []),
    key,
  ];
  const raw = readMetaValue(meta, aliases);
  if (raw == null) return null;

  if (isLabelServingLog(log)) {
    return raw * servingMultiplier(log);
  }

  const source = dataSource(log);
  if (source === SOURCE_OPENFOODFACTS || source === SOURCE_USDA) {
    return raw * servingMultiplier(log);
  }

  const logCalories = numericOrZero(log.calories);
  const metaCalories = numericOrZero(meta.calories) || numericOrZero(meta.nf_calories);
  if (
    logCalories > 0 &&
    metaCalories > 0 &&
    Math.abs(logCalories - metaCalories) > CALORIE_SCALE_TOLERANCE
  ) {
    return raw * (logCalories / metaCalories);
  }
  return raw;
}

/**
 * Empty nutrient map — every key starts at 0.
 * @returns {object}
 */
function emptyNutrients() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    potassium: 0,
    saturatedFat: 0,
    transFat: 0,
    polyunsaturatedFat: 0,
    monounsaturatedFat: 0,
    cholesterol: 0,
    calcium: 0,
    iron: 0,
    vitaminA: 0,
    vitaminC: 0,
    vitaminD: 0,
    caloriesFromFat: 0,
  };
}

/**
 * Prefer a direct log field; otherwise scale from metadata.
 * @param {object} log
 * @param {string} logKey
 * @param {string} [metaKey]
 * @returns {number}
 */
function pickNutrient(log, logKey, metaKey) {
  const direct = numericOrNull(log[logKey]);
  if (direct != null && direct > 0) return direct;
  const fromMeta = scaledFromMeta(log, metaKey || logKey);
  return fromMeta != null ? fromMeta : 0;
}

/**
 * Round to one decimal place.
 * @param {number} value
 * @returns {number}
 */
function roundToTenths(value) {
  return Math.round(value * TENTHS) / TENTHS;
}

/**
 * FDA % Daily Value for one nutrient, or null when zero / unknown.
 * @param {*} value
 * @param {string} dvKey
 * @returns {number|null}
 */
function pctDv(value, dvKey) {
  const dailyValue = DAILY_VALUES[dvKey];
  if (!dailyValue || dailyValue <= 0) return null;
  const pct = Math.round((numericOrZero(value) / dailyValue) * MAX_PCT_CAP);
  return pct > 0 ? pct : null;
}

/**
 * Format a nutrient for the label row (kcal / mg / mcg / g).
 * @param {*} value
 * @param {string} unit
 * @returns {string}
 */
function formatNutrientValue(value, unit) {
  const numericValue = numericOrZero(value);
  if (unit === 'kcal') return `${Math.round(numericValue)}`;
  if (unit === 'mg' || unit === 'mcg') {
    const display =
      numericValue % 1 === 0 ? Math.round(numericValue) : numericValue.toFixed(1);
    return `${display}${unit}`;
  }
  const gramsDisplay =
    numericValue % 1 === 0 ? Math.round(numericValue) : numericValue.toFixed(1);
  return `${gramsDisplay}g`;
}

/**
 * One FDA-style main row builder.
 * @param {object} nutrients
 * @param {string} key
 * @param {string} label
 * @param {string} unit
 * @param {string|null} [dvKey]
 * @param {number} [indent]
 * @param {boolean} [warn]
 * @returns {object}
 */
function mainLabelRow(nutrients, key, label, unit, dvKey = null, indent = 0, warn = false) {
  return {
    key,
    label,
    value: formatNutrientValue(nutrients[key], unit),
    raw: numericOrZero(nutrients[key]),
    unit,
    pct: dvKey ? pctDv(nutrients[key], dvKey) : null,
    indent,
    warn,
    bold: indent === 0,
  };
}

/**
 * Cap a value against a DV at 100%.
 * @param {*} value
 * @param {number} dailyValue
 * @returns {number}
 */
function pctOfDv(value, dailyValue) {
  if (!dailyValue || dailyValue <= 0) return 0;
  return Math.min(MAX_PCT_CAP, Math.round((numericOrZero(value) / dailyValue) * MAX_PCT_CAP));
}

/**
 * Format grams for card display.
 * @param {*} grams
 * @returns {string}
 */
function formatGrams(grams) {
  const numericValue = numericOrZero(grams);
  return numericValue % 1 === 0
    ? `${Math.round(numericValue)}g`
    : `${numericValue.toFixed(1)}g`;
}

/**
 * Format mg / mcg for card display. Large mg values round to whole numbers.
 * @param {*} amount
 * @param {string} [unit]
 * @returns {string}
 */
function formatMgDisplay(amount, unit = 'mg') {
  const numericValue = numericOrZero(amount);
  const rounded =
    numericValue >= ROUND_MG_THRESHOLD
      ? Math.round(numericValue)
      : Math.round(numericValue * TENTHS) / TENTHS;
  return `${rounded}${unit}`;
}

/**
 * Cap a value against a user goal at 100%.
 * @param {*} value
 * @param {number} goal
 * @returns {number}
 */
function pctOfGoal(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(MAX_PCT_CAP, Math.round((numericOrZero(value) / goal) * MAX_PCT_CAP));
}

/**
 * Display string for a gram amount that may be whole or fractional.
 * @param {number} value
 * @returns {string}
 */
function wholeOrOneDecimal(value) {
  return numericOrZero(value) % 1 === 0
    ? String(Math.round(value))
    : value.toFixed(1);
}

/**
 * Write missing fields from merged nutrients into a Firestore patch object.
 * @param {object} patch
 * @param {object} current
 * @param {object} merged
 * @param {string} logKey
 * @param {string} mergedKey
 */
function setPatchIfMissing(patch, current, merged, logKey, mergedKey) {
  const currentValue = numericOrZero(current[mergedKey]);
  const nextValue = numericOrZero(merged[mergedKey]);
  if (currentValue <= 0 && nextValue > 0) {
    patch[logKey] = nextValue;
  }
}

/**
 * Round daily totals the way the facts card expects.
 * @param {object} totals
 * @returns {object}
 */
function roundDailyTotals(totals) {
  totals.caloriesFromFat = totals.fat * CALORIES_PER_GRAM_FAT;
  totals.calories = Math.round(totals.calories);
  totals.protein = roundToTenths(totals.protein);
  totals.carbs = roundToTenths(totals.carbs);
  totals.fat = roundToTenths(totals.fat);
  totals.fiber = roundToTenths(totals.fiber);
  totals.sugar = roundToTenths(totals.sugar);
  totals.sodium = Math.round(totals.sodium);
  totals.potassium = Math.round(totals.potassium);
  totals.saturatedFat = roundToTenths(totals.saturatedFat);
  totals.transFat = roundToTenths(totals.transFat);
  totals.polyunsaturatedFat = roundToTenths(totals.polyunsaturatedFat);
  totals.monounsaturatedFat = roundToTenths(totals.monounsaturatedFat);
  totals.cholesterol = Math.round(totals.cholesterol);
  totals.calcium = Math.round(totals.calcium);
  totals.iron = roundToTenths(totals.iron);
  totals.vitaminA = Math.round(totals.vitaminA);
  totals.vitaminC = roundToTenths(totals.vitaminC);
  totals.vitaminD = roundToTenths(totals.vitaminD);
  return totals;
}

/**
 * Add one log's nutrients into running daily totals.
 * @param {object} totals
 * @param {object} nutrients
 */
function addNutrientsIntoTotals(totals, nutrients) {
  totals.calories += numericOrZero(nutrients.calories);
  totals.protein += numericOrZero(nutrients.protein);
  totals.carbs += numericOrZero(nutrients.carbs);
  totals.fat += numericOrZero(nutrients.fat);
  totals.fiber += numericOrZero(nutrients.fiber);
  totals.sugar += numericOrZero(nutrients.sugar);
  totals.sodium += numericOrZero(nutrients.sodium);
  totals.potassium += numericOrZero(nutrients.potassium);
  totals.saturatedFat += numericOrZero(nutrients.saturatedFat);
  totals.transFat += numericOrZero(nutrients.transFat);
  totals.polyunsaturatedFat += numericOrZero(nutrients.polyunsaturatedFat);
  totals.monounsaturatedFat += numericOrZero(nutrients.monounsaturatedFat);
  totals.cholesterol += numericOrZero(nutrients.cholesterol);
  totals.calcium += numericOrZero(nutrients.calcium);
  totals.iron += numericOrZero(nutrients.iron);
  totals.vitaminA += numericOrZero(nutrients.vitaminA);
  totals.vitaminC += numericOrZero(nutrients.vitaminC);
  totals.vitaminD += numericOrZero(nutrients.vitaminD);
}

/**
 * Ounce (or fl oz) label from serving grams.
 * @param {number} grams
 * @param {boolean} isMilliliters
 * @returns {string}
 */
function ouncesLabelFromGrams(grams, isMilliliters) {
  const ounces = grams * (isMilliliters ? ML_TO_FL_OZ : G_TO_OZ);
  return `${ounces.toFixed(1)} oz`;
}

// ===== MAIN FUNCTION =====

/**
 * Flatten nested metadata (normalizeFood stores original search hit under metadata.metadata).
 * @param {object} log
 * @returns {object}
 */
export function resolveMetadata(log) {
  const raw = log?.metadata;
  if (!raw || typeof raw !== 'object') return {};
  const inner = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null;
  return inner ? { ...inner, ...raw } : raw;
}

/**
 * Clean a food name for display via readableFoodTitle.
 * @param {string} name
 * @returns {string}
 */
export function cleanFoodDisplayName(name) {
  const { readableFoodTitle } = require('../food-search/readableFoodTitle');
  return readableFoodTitle({ name }).name || DEFAULT_FOOD_NAME;
}

/**
 * Flat nutrient map for one logged portion (all values already scaled).
 * @param {object} log — Firestore nutrition_logs document
 * @returns {object}
 */
export function extractNutrientsFromLog(log) {
  if (!log) return emptyNutrients();

  const fat = numericOrZero(log.fat);

  return {
    calories: numericOrZero(log.calories),
    protein: numericOrZero(log.protein),
    carbs: numericOrZero(log.carbs),
    fat,
    fiber: pickNutrient(log, 'fiber', 'fiber'),
    sugar: pickNutrient(log, 'sugar', 'sugar'),
    sodium: pickNutrient(log, 'sodium', 'sodium'),
    potassium: pickNutrient(log, 'potassium', 'potassium'),
    saturatedFat: pickNutrient(log, 'saturated_fat', 'saturatedFat'),
    transFat: pickNutrient(log, 'trans_fat', 'transFat'),
    polyunsaturatedFat:
      pickNutrient(log, 'polyunsaturated_fat', 'polyunsaturatedFat') ||
      scaledFromMeta(log, 'polyunsaturatedFat') ||
      0,
    monounsaturatedFat:
      pickNutrient(log, 'monounsaturated_fat', 'monounsaturatedFat') ||
      scaledFromMeta(log, 'monounsaturatedFat') ||
      0,
    cholesterol: pickNutrient(log, 'cholesterol', 'cholesterol'),
    calcium: pickNutrient(log, 'calcium', 'calcium'),
    iron: pickNutrient(log, 'iron', 'iron'),
    vitaminA: pickNutrient(log, 'vitamin_a', 'vitaminA'),
    vitaminC: pickNutrient(log, 'vitamin_c', 'vitaminC'),
    vitaminD: pickNutrient(log, 'vitamin_d', 'vitaminD'),
    caloriesFromFat: fat * CALORIES_PER_GRAM_FAT,
  };
}

/**
 * Fill missing micros from API lookup, scaled to the logged portion.
 * @param {object} base
 * @param {object} enrichedNutrients
 * @param {object} log
 * @returns {object}
 */
export function mergeEnrichedNutrients(base, enrichedNutrients, log) {
  void log;
  if (!enrichedNutrients) return base;
  const merged = { ...base };
  const baseCalories = numericOrZero(base.calories);
  const refCalories = numericOrZero(enrichedNutrients.calories);
  const scale =
    baseCalories > 0 && refCalories > 0 ? baseCalories / refCalories : 1;

  for (const key of EXTENDED_KEYS) {
    if (numericOrZero(merged[key]) <= 0 && numericOrZero(enrichedNutrients[key]) > 0) {
      merged[key] = roundToTenths(numericOrZero(enrichedNutrients[key]) * scale);
    }
  }
  merged.caloriesFromFat = merged.fat * CALORIES_PER_GRAM_FAT;
  return merged;
}

/**
 * How many extended micros have a positive value.
 * @param {object} nutrients
 * @returns {number}
 */
export function countKnownMicros(nutrients) {
  return EXTENDED_KEYS.filter((key) => numericOrZero(nutrients?.[key]) > 0).length;
}

/**
 * Scale API nutrition-details (per reference serving) to match a logged portion.
 * @param {object} apiNutrients
 * @param {object} log
 * @returns {object|null}
 */
export function scaleApiNutrientsToLog(apiNutrients, log) {
  if (!apiNutrients || !log) return null;
  const out = emptyNutrients();
  const logCalories = numericOrZero(log.calories);
  const refCalories = numericOrZero(apiNutrients.calories);
  const factor =
    logCalories > 0 && refCalories > 0 ? logCalories / refCalories : 1;

  for (const [outKey, apiKey] of Object.entries(API_NUTRIENT_MAP)) {
    const apiValue = numericOrZero(apiNutrients[apiKey]);
    if (apiValue <= 0) continue;
    if (outKey === 'calories') {
      out[outKey] = Math.round(apiValue * factor);
    } else {
      out[outKey] = roundToTenths(apiValue * factor);
    }
  }
  out.caloriesFromFat = out.fat * CALORIES_PER_GRAM_FAT;
  return out;
}

/**
 * True when an API lookup could still fill meaningful gaps.
 * @param {object} log
 * @returns {boolean}
 */
export function logNeedsNutrientEnrichment(log) {
  if (!log?.id || numericOrZero(log.calories) <= 0) return false;
  const nutrients = extractNutrientsFromLog(log);
  if (numericOrZero(nutrients.fat) > MIN_FAT_FOR_SAT_ENRICH && numericOrZero(nutrients.saturatedFat) <= 0) {
    return true;
  }
  if (
    numericOrZero(nutrients.carbs) > MIN_CARBS_FOR_FIBER_ENRICH &&
    numericOrZero(nutrients.fiber) <= 0 &&
    numericOrZero(nutrients.sugar) <= 0
  ) {
    return true;
  }
  if (
    numericOrZero(nutrients.sodium) <= 0 &&
    numericOrZero(nutrients.cholesterol) <= 0 &&
    numericOrZero(nutrients.potassium) <= 0
  ) {
    return true;
  }
  return countKnownMicros(nutrients) < MIN_MICROS_BEFORE_ENRICH;
}

/**
 * Map API / search hit nutrients → Firestore log field updates (only missing values).
 * @param {object} log
 * @param {object} apiNutrients
 * @returns {object|null}
 */
export function buildLogEnrichmentPatch(log, apiNutrients) {
  if (!log || !apiNutrients) return null;
  const current = extractNutrientsFromLog(log);
  const merged = mergeEnrichedNutrients(current, apiNutrients, log);
  const patch = {};
  setPatchIfMissing(patch, current, merged, 'fiber', 'fiber');
  setPatchIfMissing(patch, current, merged, 'sugar', 'sugar');
  setPatchIfMissing(patch, current, merged, 'sodium', 'sodium');
  setPatchIfMissing(patch, current, merged, 'potassium', 'potassium');
  setPatchIfMissing(patch, current, merged, 'saturated_fat', 'saturatedFat');
  setPatchIfMissing(patch, current, merged, 'trans_fat', 'transFat');
  setPatchIfMissing(patch, current, merged, 'polyunsaturated_fat', 'polyunsaturatedFat');
  setPatchIfMissing(patch, current, merged, 'monounsaturated_fat', 'monounsaturatedFat');
  setPatchIfMissing(patch, current, merged, 'cholesterol', 'cholesterol');
  setPatchIfMissing(patch, current, merged, 'calcium', 'calcium');
  setPatchIfMissing(patch, current, merged, 'iron', 'iron');
  setPatchIfMissing(patch, current, merged, 'vitamin_a', 'vitaminA');
  setPatchIfMissing(patch, current, merged, 'vitamin_c', 'vitaminC');
  setPatchIfMissing(patch, current, merged, 'vitamin_d', 'vitaminD');
  return Object.keys(patch).length ? patch : null;
}

/**
 * FDA-style label rows for one logged portion (no daily-goal progress bars).
 * @param {object} nutrients
 * @returns {Array}
 */
export function buildNutritionLabelRows(nutrients) {
  const nutrientMap = nutrients || emptyNutrients();

  return [
    {
      type: 'calories',
      key: 'calories',
      label: 'Calories',
      value: formatNutrientValue(nutrientMap.calories, 'kcal'),
      raw: nutrientMap.calories,
      bold: true,
    },
    { type: 'divider' },
    mainLabelRow(nutrientMap, 'fat', 'Total Fat', 'g', 'fat'),
    mainLabelRow(nutrientMap, 'saturatedFat', 'Saturated Fat', 'g', 'saturatedFat', 1, true),
    mainLabelRow(nutrientMap, 'transFat', 'Trans Fat', 'g', null, 1, true),
    mainLabelRow(nutrientMap, 'polyunsaturatedFat', 'Polyunsaturated Fat', 'g', null, 1),
    mainLabelRow(nutrientMap, 'monounsaturatedFat', 'Monounsaturated Fat', 'g', null, 1),
    { type: 'divider' },
    mainLabelRow(nutrientMap, 'cholesterol', 'Cholesterol', 'mg', 'cholesterol', 0, true),
    mainLabelRow(nutrientMap, 'sodium', 'Sodium', 'mg', 'sodium', 0, true),
    { type: 'divider' },
    mainLabelRow(nutrientMap, 'carbs', 'Total Carbohydrate', 'g', 'carbs'),
    mainLabelRow(nutrientMap, 'fiber', 'Dietary Fiber', 'g', 'fiber', 1),
    mainLabelRow(nutrientMap, 'sugar', 'Total Sugars', 'g', null, 1, true),
    { type: 'divider' },
    mainLabelRow(nutrientMap, 'protein', 'Protein', 'g', 'protein'),
    { type: 'divider' },
    mainLabelRow(nutrientMap, 'potassium', 'Potassium', 'mg', 'potassium'),
    mainLabelRow(nutrientMap, 'calcium', 'Calcium', 'mg', 'calcium'),
    mainLabelRow(nutrientMap, 'iron', 'Iron', 'mg', 'iron'),
    mainLabelRow(nutrientMap, 'vitaminA', 'Vitamin A', 'mcg', 'vitaminA'),
    mainLabelRow(nutrientMap, 'vitaminC', 'Vitamin C', 'mg', 'vitaminC'),
    mainLabelRow(nutrientMap, 'vitaminD', 'Vitamin D', 'mcg', 'vitaminD'),
  ];
}

/**
 * Human serving label for one log (oz, servings, or dash).
 * @param {object} log
 * @returns {string}
 */
export function getServingLabel(log) {
  if (!log) return EMPTY_SERVING_LABEL;
  const meta = log.metadata || {};
  const servingLabel = meta.serving_label || meta.servingLabel;
  if (servingLabel) return String(servingLabel);

  const grams = numericOrZero(log.serving_grams);
  const isMilliliters = String(meta.servingUnit || '').toLowerCase() === SERVING_UNIT_ML;
  if (grams > 0) return ouncesLabelFromGrams(grams, isMilliliters);

  const quantity = numericOrZero(log.serving_size);
  if (quantity > 0) {
    const plural = quantity === 1 ? '' : 's';
    return `${quantity} serving${plural}`;
  }
  return EMPTY_SERVING_LABEL;
}

/**
 * Panels for the per-log nutrition facts UI. Goals are unused today but kept for callers.
 * @param {object} log
 * @param {object} goals
 * @returns {Array}
 */
export function buildNutritionFactsPanels(log, goals) {
  void goals;
  const nutrients = extractNutrientsFromLog(log);
  return [{ id: 'label', rows: buildNutritionLabelRows(nutrients) }];
}

/**
 * Sum all nutrients across every log for today. Optional enrichment map: logId → API nutrients.
 * @param {Array} [logs]
 * @param {object} [enrichmentByLogId]
 * @returns {object}
 */
export function calculateDailyNutrientTotals(logs = [], enrichmentByLogId = {}) {
  const totals = emptyNutrients();
  for (const log of logs) {
    let nutrients = extractNutrientsFromLog(log);
    const apiNutrients = enrichmentByLogId[log.id];
    if (apiNutrients) {
      nutrients = mergeEnrichedNutrients(nutrients, apiNutrients, log);
    }
    addNutrientsIntoTotals(totals, nutrients);
  }
  return roundDailyTotals(totals);
}

/**
 * Daily nutrition facts card data — uses the user's calorie/macro goals.
 * @param {object} nutrients
 * @param {object} [goals]
 * @returns {object}
 */
export function buildDailyNutritionFactsCardData(nutrients, goals = {}) {
  const nutrientMap = nutrients || emptyNutrients();
  const calorieGoal = goals.calories || DEFAULT_CALORIE_GOAL;
  const proteinGoal = goals.proteinTarget || DEFAULT_PROTEIN_GOAL;
  const carbsGoal = goals.carbsTarget || DEFAULT_CARBS_GOAL;
  const fatGoal = goals.fatTarget || DEFAULT_FAT_GOAL;

  const listRow = (label, value, unit = 'g') => ({
    label,
    display:
      unit === 'mg' || unit === 'mcg'
        ? formatMgDisplay(value, unit)
        : formatGrams(value),
    raw: numericOrZero(value),
  });

  const micro = (key, name, unit = 'mg') => ({
    key,
    name,
    value: numericOrZero(nutrientMap[key]) > 0 ? formatMgDisplay(nutrientMap[key], unit) : EMPTY_SERVING_LABEL,
    raw: numericOrZero(nutrientMap[key]),
  });

  return {
    calories: Math.round(numericOrZero(nutrientMap.calories)),
    calorieGoal,
    caloriePct: pctOfGoal(nutrientMap.calories, calorieGoal),
    foodCount: 0,
    macros: [
      {
        label: 'Protein',
        value: nutrientMap.protein,
        display: formatGrams(nutrientMap.protein),
        goal: proteinGoal,
        goalLabel: `${wholeOrOneDecimal(nutrientMap.protein)} / ${proteinGoal}g`,
        pct: pctOfGoal(nutrientMap.protein, proteinGoal),
        gradient: NUT_MACRO_RING_GRADIENTS.Protein,
      },
      {
        label: 'Carbs',
        value: nutrientMap.carbs,
        display: formatGrams(nutrientMap.carbs),
        goal: carbsGoal,
        goalLabel: `${wholeOrOneDecimal(nutrientMap.carbs)} / ${carbsGoal}g`,
        pct: pctOfGoal(nutrientMap.carbs, carbsGoal),
        gradient: NUT_MACRO_RING_GRADIENTS.Carbs,
      },
      {
        label: 'Fat',
        value: nutrientMap.fat,
        display: formatGrams(nutrientMap.fat),
        goal: fatGoal,
        goalLabel: `${wholeOrOneDecimal(nutrientMap.fat)} / ${fatGoal}g`,
        pct: pctOfGoal(nutrientMap.fat, fatGoal),
        gradient: NUT_MACRO_RING_GRADIENTS.Fat,
      },
    ],
    calorieGradient: NUT_CALORIES_GRADIENT,
    fats: {
      title: 'FATS',
      gradient: NUT_MACRO_RING_GRADIENTS.Fat,
      total: formatGrams(nutrientMap.fat),
      rows: [
        listRow('Saturated Fat', nutrientMap.saturatedFat),
        listRow('Trans Fat', nutrientMap.transFat),
        listRow('Polyunsaturated', nutrientMap.polyunsaturatedFat),
        listRow('Monounsaturated', nutrientMap.monounsaturatedFat),
      ],
    },
    carbs: {
      title: 'CARBOHYDRATES',
      gradient: NUT_MACRO_RING_GRADIENTS.Carbs,
      total: formatGrams(nutrientMap.carbs),
      rows: [
        listRow('Dietary Fiber', nutrientMap.fiber),
        listRow('Sugars', nutrientMap.sugar),
      ],
    },
    minerals: {
      title: 'VITAMINS & MINERALS',
      gradient: NUT_SECTION_GRADIENT,
      items: [
        micro('cholesterol', 'Cholesterol'),
        micro('sodium', 'Sodium'),
        micro('potassium', 'Potassium'),
        micro('calcium', 'Calcium'),
        micro('iron', 'Iron'),
        micro('vitaminA', 'Vitamin A', 'mcg'),
        micro('vitaminC', 'Vitamin C'),
        micro('vitaminD', 'Vitamin D', 'mcg'),
      ],
    },
  };
}

/**
 * Single-food nutrition facts card data (DV-based bars, not user goals).
 * @param {object} nutrients
 * @returns {object}
 */
export function buildNutritionFactsCardData(nutrients) {
  const nutrientMap = nutrients || emptyNutrients();

  const macroBar = (label, value, max, color, unit = 'g') => ({
    label,
    value: numericOrZero(value),
    display:
      unit === 'mg' || unit === 'mcg'
        ? formatMgDisplay(value, unit)
        : formatGrams(value),
    fillPct: max > 0 ? Math.min((numericOrZero(value) / max) * MAX_PCT_CAP, MAX_PCT_CAP) : 0,
    color,
  });

  const micro = (key, name, unit = 'mg') => ({
    key,
    name,
    value: formatMgDisplay(nutrientMap[key], unit),
    raw: numericOrZero(nutrientMap[key]),
  });

  return {
    calories: Math.round(numericOrZero(nutrientMap.calories)),
    macros: [
      {
        label: 'Protein',
        value: nutrientMap.protein,
        display: formatGrams(nutrientMap.protein),
        pct: pctOfDv(nutrientMap.protein, DAILY_VALUES.protein),
        gradient: ['#6D28D9', '#FDE68A'],
        barColor: '#FF6B9D',
      },
      {
        label: 'Carbs',
        value: nutrientMap.carbs,
        display: formatGrams(nutrientMap.carbs),
        pct: pctOfDv(nutrientMap.carbs, DAILY_VALUES.carbs),
        gradient: ['#FBBF24', '#FB7185'],
        barColor: '#F97316',
      },
      {
        label: 'Fat',
        value: nutrientMap.fat,
        display: formatGrams(nutrientMap.fat),
        pct: pctOfDv(nutrientMap.fat, DAILY_VALUES.fat),
        gradient: ['#6D28D9', '#DB2777'],
        barColor: '#64D2FF',
      },
    ],
    fats: [
      macroBar('Total Fat', nutrientMap.fat, DAILY_VALUES.fat, '#64D2FF'),
      macroBar('Saturated Fat', nutrientMap.saturatedFat, DAILY_VALUES.saturatedFat, '#FF6B9D'),
      macroBar('Trans Fat', nutrientMap.transFat, TRANS_FAT_BAR_MAX, '#EF4444'),
      macroBar('Polyunsaturated', nutrientMap.polyunsaturatedFat, POLY_FAT_BAR_MAX, '#C084FC'),
      macroBar('Monounsaturated', nutrientMap.monounsaturatedFat, MONO_FAT_BAR_MAX, '#A78BFA'),
    ],
    carbs: [
      macroBar('Total Carbs', nutrientMap.carbs, DAILY_VALUES.carbs, '#F97316'),
      macroBar('Dietary Fiber', nutrientMap.fiber, DAILY_VALUES.fiber, '#22C55E'),
      macroBar('Sugars', nutrientMap.sugar, SUGAR_BAR_MAX, '#FB7185'),
    ],
    minerals: [
      micro('cholesterol', 'Cholesterol'),
      micro('sodium', 'Sodium'),
      micro('potassium', 'Potassium'),
      micro('calcium', 'Calcium'),
      micro('iron', 'Iron'),
      micro('vitaminA', 'Vitamin A', 'mcg'),
      micro('vitaminC', 'Vitamin C'),
      micro('vitaminD', 'Vitamin D', 'mcg'),
    ],
  };
}

/**
 * Public formatter used by other nutrition screens.
 * @param {*} value
 * @param {string} unit
 * @returns {string}
 */
export function formatAmount(value, unit) {
  return formatNutrientValue(value, unit);
}
