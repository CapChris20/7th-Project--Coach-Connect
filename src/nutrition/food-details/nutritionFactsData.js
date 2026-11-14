// Build nutrition-facts view models from logged food entries (macros, micros, FDA-style rows, daily totals).
// Flow: flatten metadata → scale per-100g / label-serving → extract nutrients → merge API enrichment → build card rows.
// Used by: NutritionFactsScreen, daily nutrition cards, and log enrichment after search.
// Chrome accents use Design Law foodMacroGradients / accentGradients only — never green #22C55E.
// Read order: constants → MAIN recipes → PLUMBING scale/format helpers.

import { NUT_MACRO_RING_GRADIENTS, NUT_CALORIES_GRADIENT, NUT_SECTION_GRADIENT } from '../nutritionColors';
import { accentGradients } from '../../look-and-feel/colorPalette';
import { gradients as foodMacroGradients } from '../food-cards/foodCardColors';

// ===== NAMED CONSTANTS =====

// Manipulate here: single-food card bar accents — Design Law only (never green #22C55E)
const FACTS_CARD_MACRO_CHROME = {
  protein: {
    gradient: foodMacroGradients.protein,
    barColor: foodMacroGradients.protein[0]
  },
  carbs: {
    gradient: foodMacroGradients.carbs,
    barColor: foodMacroGradients.carbs[0]
  },
  fat: {
    gradient: foodMacroGradients.fat,
    barColor: foodMacroGradients.fat[0]
  }
};
const FACTS_CARD_BAR = {
  totalFat: foodMacroGradients.fat[0],
  saturatedFat: accentGradients[0][0],
  transFat: foodMacroGradients.fat[1],
  poly: accentGradients[3][0],
  mono: accentGradients[4][1],
  totalCarbs: foodMacroGradients.carbs[1],
  fiber: foodMacroGradients.protein[0],
  sugars: accentGradients[5][1]
};
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
  vitaminD: ['vitaminD', 'vitamin_d']
};
const META_NF_ALIASES = {
  fiber: ['fiber', 'nf_dietary_fiber', 'dietary_fiber'],
  sugar: ['sugar', 'nf_sugars', 'sugars'],
  sodium: ['sodium', 'nf_sodium'],
  potassium: ['potassium', 'nf_potassium'],
  cholesterol: ['cholesterol', 'nf_cholesterol']
};
const EXTENDED_KEYS = ['fiber', 'sugar', 'sodium', 'potassium', 'cholesterol', 'saturatedFat', 'transFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'calcium', 'iron', 'vitaminA', 'vitaminC', 'vitaminD'];
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
  vitaminD: 'vitaminD'
};

// ===== HELPER FUNCTIONS =====
// Small formatters live under PLUMBING; mains call them by name (function declarations hoist).

// ===== MAIN FUNCTION =====

// FDA % Daily Value (2,000 kcal diet). Export name frozen.
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
  vitaminD: 20
};

/**
 * Flatten nested metadata on a food log (inner metadata wins on collision).
 * @param {object} log
 * @returns {object}
 */
export function resolveMetadata(log) {
  const raw = log?.metadata;
  if (!raw || typeof raw !== 'object') return {};
  const inner = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null;
  if (inner) {
    return {
      ...inner,
      ...raw
    };
  }
  return raw;
}

/**
 * Human food title via readableFoodTitle, with a Food Item fallback.
 * @param {string} name
 * @returns {string}
 */
export function cleanFoodDisplayName(name) {
  const {
    readableFoodTitle
  } = require('../food-search/readableFoodTitle');
  return readableFoodTitle({
    name
  }).name || DEFAULT_FOOD_NAME;
}

/**
 * Macros from the log document; micros from fields or scaled metadata.
 * @param {object} log
 * @returns {object}
 */
export function extractNutrientsFromLog(log) {
  if (!log) return blankNutrientMap();

  // 1. Macros on the log document; micros may live on fields or scaled metadata.
  const fat = numberOrZero(log.fat);
  return {
    calories: numberOrZero(log.calories),
    protein: numberOrZero(log.protein),
    carbs: numberOrZero(log.carbs),
    fat,
    fiber: pickNutrientAmount(log, 'fiber', 'fiber'),
    sugar: pickNutrientAmount(log, 'sugar', 'sugar'),
    sodium: pickNutrientAmount(log, 'sodium', 'sodium'),
    potassium: pickNutrientAmount(log, 'potassium', 'potassium'),
    saturatedFat: pickNutrientAmount(log, 'saturated_fat', 'saturatedFat'),
    transFat: pickNutrientAmount(log, 'trans_fat', 'transFat'),
    polyunsaturatedFat: pickNutrientAmount(log, 'polyunsaturated_fat', 'polyunsaturatedFat') || scaledNutrientFromMetadata(log, 'polyunsaturatedFat') || 0,
    monounsaturatedFat: pickNutrientAmount(log, 'monounsaturated_fat', 'monounsaturatedFat') || scaledNutrientFromMetadata(log, 'monounsaturatedFat') || 0,
    cholesterol: pickNutrientAmount(log, 'cholesterol', 'cholesterol'),
    calcium: pickNutrientAmount(log, 'calcium', 'calcium'),
    iron: pickNutrientAmount(log, 'iron', 'iron'),
    vitaminA: pickNutrientAmount(log, 'vitamin_a', 'vitaminA'),
    vitaminC: pickNutrientAmount(log, 'vitamin_c', 'vitaminC'),
    vitaminD: pickNutrientAmount(log, 'vitamin_d', 'vitaminD'),
    caloriesFromFat: fat * CALORIES_PER_GRAM_FAT
  };
}

/**
 * Fill missing micros from an API enrichment map, scaled to the log's calories.
 * @param {object} base
 * @param {object} enrichedNutrients
 * @param {object} log
 * @returns {object}
 */
export function mergeEnrichedNutrients(base, enrichedNutrients, log) {
  void log;
  if (!enrichedNutrients) return base;
  const merged = {
    ...base
  };
  const baseCalories = numberOrZero(base.calories);
  const refCalories = numberOrZero(enrichedNutrients.calories);
  const scale = baseCalories > 0 && refCalories > 0 ? baseCalories / refCalories : 1;
  for (const key of EXTENDED_KEYS) {
    if (numberOrZero(merged[key]) <= 0 && numberOrZero(enrichedNutrients[key]) > 0) {
      merged[key] = roundToOneTenth(numberOrZero(enrichedNutrients[key]) * scale);
    }
  }
  merged.caloriesFromFat = merged.fat * CALORIES_PER_GRAM_FAT;
  return merged;
}

/**
 * How many extended nutrient keys have a positive amount.
 * @param {object} nutrients
 * @returns {number}
 */
export function countKnownMicros(nutrients) {
  let knownCount = 0;
  for (let index = 0; index < EXTENDED_KEYS.length; index += 1) {
    const nutrientKey = EXTENDED_KEYS[index];
    if (numberOrZero(nutrients?.[nutrientKey]) > 0) knownCount += 1;
  }
  return knownCount;
}

/**
 * Scale an API nutrient map to the log's calorie total.
 * @param {object} apiNutrients
 * @param {object} log
 * @returns {object|null}
 */
export function scaleApiNutrientsToLog(apiNutrients, log) {
  if (!apiNutrients || !log) return null;
  const out = blankNutrientMap();
  const logCalories = numberOrZero(log.calories);
  const refCalories = numberOrZero(apiNutrients.calories);
  const factor = logCalories > 0 && refCalories > 0 ? logCalories / refCalories : 1;
  const apiMapKeys = Object.keys(API_NUTRIENT_MAP);
  for (let index = 0; index < apiMapKeys.length; index += 1) {
    const outKey = apiMapKeys[index];
    const apiKey = API_NUTRIENT_MAP[outKey];
    const apiValue = numberOrZero(apiNutrients[apiKey]);
    if (apiValue <= 0) continue;
    if (outKey === 'calories') {
      out[outKey] = Math.round(apiValue * factor);
    } else {
      out[outKey] = roundToOneTenth(apiValue * factor);
    }
  }
  out.caloriesFromFat = out.fat * CALORIES_PER_GRAM_FAT;
  return out;
}

/**
 * True when the log is missing sat fat / fiber+sugar / minerals / enough micros.
 * @param {object} log
 * @returns {boolean}
 */
export function logNeedsNutrientEnrichment(log) {
  if (!log?.id || numberOrZero(log.calories) <= 0) return false;
  const nutrients = extractNutrientsFromLog(log);
  if (numberOrZero(nutrients.fat) > MIN_FAT_FOR_SAT_ENRICH && numberOrZero(nutrients.saturatedFat) <= 0) {
    return true;
  }
  if (numberOrZero(nutrients.carbs) > MIN_CARBS_FOR_FIBER_ENRICH && numberOrZero(nutrients.fiber) <= 0 && numberOrZero(nutrients.sugar) <= 0) {
    return true;
  }
  if (numberOrZero(nutrients.sodium) <= 0 && numberOrZero(nutrients.cholesterol) <= 0 && numberOrZero(nutrients.potassium) <= 0) {
    return true;
  }
  return countKnownMicros(nutrients) < MIN_MICROS_BEFORE_ENRICH;
}

/**
 * Firestore patch of only the nutrient gaps the API can fill.
 * @param {object} log
 * @param {object} apiNutrients
 * @returns {object|null}
 */
export function buildLogEnrichmentPatch(log, apiNutrients) {
  if (!log || !apiNutrients) return null;
  // 1. Compare current log fields vs API merge — only write gaps.
  const current = extractNutrientsFromLog(log);
  const merged = mergeEnrichedNutrients(current, apiNutrients, log);
  const patch = {};
  writePatchWhenMissing(patch, current, merged, 'fiber', 'fiber');
  writePatchWhenMissing(patch, current, merged, 'sugar', 'sugar');
  writePatchWhenMissing(patch, current, merged, 'sodium', 'sodium');
  writePatchWhenMissing(patch, current, merged, 'potassium', 'potassium');
  writePatchWhenMissing(patch, current, merged, 'saturated_fat', 'saturatedFat');
  writePatchWhenMissing(patch, current, merged, 'trans_fat', 'transFat');
  writePatchWhenMissing(patch, current, merged, 'polyunsaturated_fat', 'polyunsaturatedFat');
  writePatchWhenMissing(patch, current, merged, 'monounsaturated_fat', 'monounsaturatedFat');
  writePatchWhenMissing(patch, current, merged, 'cholesterol', 'cholesterol');
  writePatchWhenMissing(patch, current, merged, 'calcium', 'calcium');
  writePatchWhenMissing(patch, current, merged, 'iron', 'iron');
  writePatchWhenMissing(patch, current, merged, 'vitamin_a', 'vitaminA');
  writePatchWhenMissing(patch, current, merged, 'vitamin_c', 'vitaminC');
  writePatchWhenMissing(patch, current, merged, 'vitamin_d', 'vitaminD');
  if (Object.keys(patch).length) {
    return patch;
  }
  return null;
}

/**
 * FDA-style label rows for one nutrient map.
 * @param {object} nutrients
 * @returns {object[]}
 */
export function buildNutritionLabelRows(nutrients) {
  const nutrientMap = nutrients || blankNutrientMap();
  return [{
    type: 'calories',
    key: 'calories',
    label: 'Calories',
    value: formatNutrientAmount(nutrientMap.calories, 'kcal'),
    raw: nutrientMap.calories,
    bold: true
  }, {
    type: 'divider'
  }, nutritionLabelRow(nutrientMap, 'fat', 'Total Fat', 'g', 'fat'), nutritionLabelRow(nutrientMap, 'saturatedFat', 'Saturated Fat', 'g', 'saturatedFat', 1, true), nutritionLabelRow(nutrientMap, 'transFat', 'Trans Fat', 'g', null, 1, true), nutritionLabelRow(nutrientMap, 'polyunsaturatedFat', 'Polyunsaturated Fat', 'g', null, 1), nutritionLabelRow(nutrientMap, 'monounsaturatedFat', 'Monounsaturated Fat', 'g', null, 1), {
    type: 'divider'
  }, nutritionLabelRow(nutrientMap, 'cholesterol', 'Cholesterol', 'mg', 'cholesterol', 0, true), nutritionLabelRow(nutrientMap, 'sodium', 'Sodium', 'mg', 'sodium', 0, true), {
    type: 'divider'
  }, nutritionLabelRow(nutrientMap, 'carbs', 'Total Carbohydrate', 'g', 'carbs'), nutritionLabelRow(nutrientMap, 'fiber', 'Dietary Fiber', 'g', 'fiber', 1), nutritionLabelRow(nutrientMap, 'sugar', 'Total Sugars', 'g', null, 1, true), {
    type: 'divider'
  }, nutritionLabelRow(nutrientMap, 'protein', 'Protein', 'g', 'protein'), {
    type: 'divider'
  }, nutritionLabelRow(nutrientMap, 'potassium', 'Potassium', 'mg', 'potassium'), nutritionLabelRow(nutrientMap, 'calcium', 'Calcium', 'mg', 'calcium'), nutritionLabelRow(nutrientMap, 'iron', 'Iron', 'mg', 'iron'), nutritionLabelRow(nutrientMap, 'vitaminA', 'Vitamin A', 'mcg', 'vitaminA'), nutritionLabelRow(nutrientMap, 'vitaminC', 'Vitamin C', 'mg', 'vitaminC'), nutritionLabelRow(nutrientMap, 'vitaminD', 'Vitamin D', 'mcg', 'vitaminD')];
}

/**
 * Serving line for a log: metadata label, ounces from grams, or “N serving(s)”.
 * @param {object} log
 * @returns {string}
 */
export function getServingLabel(log) {
  if (!log) return EMPTY_SERVING_LABEL;
  const meta = log.metadata || {};
  const servingLabel = meta.serving_label || meta.servingLabel;
  if (servingLabel) return String(servingLabel);
  const grams = numberOrZero(log.serving_grams);
  const isMilliliters = String(meta.servingUnit || '').toLowerCase() === SERVING_UNIT_ML;
  if (grams > 0) return ouncesLabelFromGramAmount(grams, isMilliliters);
  const quantity = numberOrZero(log.serving_size);
  if (quantity > 0) {
    const plural = quantity === 1 ? '' : 's';
    return `${quantity} serving${plural}`;
  }
  return EMPTY_SERVING_LABEL;
}

/**
 * Panel list for NutritionFactsScreen (one “label” panel today).
 * @param {object} log
 * @param {object} goals
 * @returns {object[]}
 */
export function buildNutritionFactsPanels(log, goals) {
  void goals;
  const nutrients = extractNutrientsFromLog(log);
  return [{
    id: 'label',
    rows: buildNutritionLabelRows(nutrients)
  }];
}

/**
 * Sum nutrients across a day's logs, optionally merging session enrichment.
 * @param {object[]} [logs]
 * @param {object} [enrichmentByLogId]
 * @returns {object}
 */
export function calculateDailyNutrientTotals(logs = [], enrichmentByLogId = {}) {
  // 1. Start from zeroed map; walk every log for the day.
  const totals = blankNutrientMap();
  for (const log of logs) {
    // 2. Portion nutrients, optionally merged with session API enrichment.
    let nutrients = extractNutrientsFromLog(log);
    const apiNutrients = enrichmentByLogId[log.id];
    if (apiNutrients) {
      nutrients = mergeEnrichedNutrients(nutrients, apiNutrients, log);
    }
    addNutrientsIntoRunningTotals(totals, nutrients);
  }
  // 3. Round the way HardShadow daily cards expect.
  return roundDailyNutrientTotals(totals);
}

/**
 * Daily totals card model (macros vs goals, fat/carb sections, mineral grid).
 * @param {object} nutrients
 * @param {object} [goals]
 * @returns {object}
 */
export function buildDailyNutritionFactsCardData(nutrients, goals = {}) {
  // 1. Resolve user goals with Design-Law-friendly defaults.
  const nutrientMap = nutrients || blankNutrientMap();
  const calorieGoal = goals.calories || DEFAULT_CALORIE_GOAL;
  const proteinGoal = goals.proteinTarget || DEFAULT_PROTEIN_GOAL;
  const carbsGoal = goals.carbsTarget || DEFAULT_CARBS_GOAL;
  const fatGoal = goals.fatTarget || DEFAULT_FAT_GOAL;

  // 2. Small row builders for fats/carbs lists and mineral grid cells.
  const listRow = (label, value, unit = 'g') => ({
    label,
    display: unit === 'mg' || unit === 'mcg' ? formatMilligramsDisplay(value, unit) : formatGramsDisplay(value),
    raw: numberOrZero(value)
  });
  const micro = (key, name, unit = 'mg') => ({
    key,
    name,
    value: numberOrZero(nutrientMap[key]) > 0 ? formatMilligramsDisplay(nutrientMap[key], unit) : EMPTY_SERVING_LABEL,
    raw: numberOrZero(nutrientMap[key])
  });

  // 3. Bundle calories, macro minis, fat/carb sections, and mineral grid.
  return {
    calories: Math.round(numberOrZero(nutrientMap.calories)),
    calorieGoal,
    caloriePct: percentOfGoal(nutrientMap.calories, calorieGoal),
    foodCount: 0,
    macros: [{
      label: 'Protein',
      value: nutrientMap.protein,
      display: formatGramsDisplay(nutrientMap.protein),
      goal: proteinGoal,
      goalLabel: `${wholeNumberOrOneDecimal(nutrientMap.protein)} / ${proteinGoal}g`,
      pct: percentOfGoal(nutrientMap.protein, proteinGoal),
      gradient: NUT_MACRO_RING_GRADIENTS.Protein
    }, {
      label: 'Carbs',
      value: nutrientMap.carbs,
      display: formatGramsDisplay(nutrientMap.carbs),
      goal: carbsGoal,
      goalLabel: `${wholeNumberOrOneDecimal(nutrientMap.carbs)} / ${carbsGoal}g`,
      pct: percentOfGoal(nutrientMap.carbs, carbsGoal),
      gradient: NUT_MACRO_RING_GRADIENTS.Carbs
    }, {
      label: 'Fat',
      value: nutrientMap.fat,
      display: formatGramsDisplay(nutrientMap.fat),
      goal: fatGoal,
      goalLabel: `${wholeNumberOrOneDecimal(nutrientMap.fat)} / ${fatGoal}g`,
      pct: percentOfGoal(nutrientMap.fat, fatGoal),
      gradient: NUT_MACRO_RING_GRADIENTS.Fat
    }],
    calorieGradient: NUT_CALORIES_GRADIENT,
    fats: {
      title: 'FATS',
      gradient: NUT_MACRO_RING_GRADIENTS.Fat,
      total: formatGramsDisplay(nutrientMap.fat),
      rows: [listRow('Saturated Fat', nutrientMap.saturatedFat), listRow('Trans Fat', nutrientMap.transFat), listRow('Polyunsaturated', nutrientMap.polyunsaturatedFat), listRow('Monounsaturated', nutrientMap.monounsaturatedFat)]
    },
    carbs: {
      title: 'CARBOHYDRATES',
      gradient: NUT_MACRO_RING_GRADIENTS.Carbs,
      total: formatGramsDisplay(nutrientMap.carbs),
      rows: [listRow('Dietary Fiber', nutrientMap.fiber), listRow('Sugars', nutrientMap.sugar)]
    },
    minerals: {
      title: 'VITAMINS & MINERALS',
      gradient: NUT_SECTION_GRADIENT,
      items: [micro('cholesterol', 'Cholesterol'), micro('sodium', 'Sodium'), micro('potassium', 'Potassium'), micro('calcium', 'Calcium'), micro('iron', 'Iron'), micro('vitaminA', 'Vitamin A', 'mcg'), micro('vitaminC', 'Vitamin C'), micro('vitaminD', 'Vitamin D', 'mcg')]
    }
  };
}

/**
 * Single-food facts card model with Design Law chrome (never green).
 * @param {object} nutrients
 * @returns {object}
 */
export function buildNutritionFactsCardData(nutrients) {
  const nutrientMap = nutrients || blankNutrientMap();
  const macroBar = (label, value, max, color, unit = 'g') => ({
    label,
    value: numberOrZero(value),
    display: unit === 'mg' || unit === 'mcg' ? formatMilligramsDisplay(value, unit) : formatGramsDisplay(value),
    fillPct: max > 0 ? Math.min(numberOrZero(value) / max * MAX_PCT_CAP, MAX_PCT_CAP) : 0,
    color
  });
  const micro = (key, name, unit = 'mg') => ({
    key,
    name,
    value: formatMilligramsDisplay(nutrientMap[key], unit),
    raw: numberOrZero(nutrientMap[key])
  });
  return {
    calories: Math.round(numberOrZero(nutrientMap.calories)),
    macros: [{
      label: 'Protein',
      value: nutrientMap.protein,
      display: formatGramsDisplay(nutrientMap.protein),
      pct: percentOfDailyValue(nutrientMap.protein, DAILY_VALUES.protein),
      gradient: FACTS_CARD_MACRO_CHROME.protein.gradient,
      barColor: FACTS_CARD_MACRO_CHROME.protein.barColor
    }, {
      label: 'Carbs',
      value: nutrientMap.carbs,
      display: formatGramsDisplay(nutrientMap.carbs),
      pct: percentOfDailyValue(nutrientMap.carbs, DAILY_VALUES.carbs),
      gradient: FACTS_CARD_MACRO_CHROME.carbs.gradient,
      barColor: FACTS_CARD_MACRO_CHROME.carbs.barColor
    }, {
      label: 'Fat',
      value: nutrientMap.fat,
      display: formatGramsDisplay(nutrientMap.fat),
      pct: percentOfDailyValue(nutrientMap.fat, DAILY_VALUES.fat),
      gradient: FACTS_CARD_MACRO_CHROME.fat.gradient,
      barColor: FACTS_CARD_MACRO_CHROME.fat.barColor
    }],
    fats: [macroBar('Total Fat', nutrientMap.fat, DAILY_VALUES.fat, FACTS_CARD_BAR.totalFat), macroBar('Saturated Fat', nutrientMap.saturatedFat, DAILY_VALUES.saturatedFat, FACTS_CARD_BAR.saturatedFat), macroBar('Trans Fat', nutrientMap.transFat, TRANS_FAT_BAR_MAX, FACTS_CARD_BAR.transFat), macroBar('Polyunsaturated', nutrientMap.polyunsaturatedFat, POLY_FAT_BAR_MAX, FACTS_CARD_BAR.poly), macroBar('Monounsaturated', nutrientMap.monounsaturatedFat, MONO_FAT_BAR_MAX, FACTS_CARD_BAR.mono)],
    carbs: [macroBar('Total Carbs', nutrientMap.carbs, DAILY_VALUES.carbs, FACTS_CARD_BAR.totalCarbs),
    // Fiber was #22C55E green — now protein blue (Design Law: never green)
    macroBar('Dietary Fiber', nutrientMap.fiber, DAILY_VALUES.fiber, FACTS_CARD_BAR.fiber), macroBar('Sugars', nutrientMap.sugar, SUGAR_BAR_MAX, FACTS_CARD_BAR.sugars)],
    minerals: [micro('cholesterol', 'Cholesterol'), micro('sodium', 'Sodium'), micro('potassium', 'Potassium'), micro('calcium', 'Calcium'), micro('iron', 'Iron'), micro('vitaminA', 'Vitamin A', 'mcg'), micro('vitaminC', 'Vitamin C'), micro('vitaminD', 'Vitamin D', 'mcg')]
  };
}

/**
 * Format a nutrient amount with its unit for display.
 * @param {number} value
 * @param {string} unit
 * @returns {string}
 */
export function formatAmount(value, unit) {
  return formatNutrientAmount(value, unit);
}

// PLUMBING — skip unless debugging log scaling, FDA rows, or enrichment patches.

function numberOrZero(rawValue) {
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : 0;
}
function numberOrNull(rawValue) {
  if (rawValue == null || rawValue === '') return null;
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
}
function readFirstNumericMetaAlias(meta, keys) {
  for (const aliasKey of keys) {
    const found = numberOrNull(meta?.[aliasKey]);
    if (found != null) return found;
  }
  return null;
}
function foodDataSource(log) {
  const meta = resolveMetadata(log);
  return meta.source || log?.source || '';
}
function logUsesLabelServingBasis(log) {
  const meta = resolveMetadata(log);
  return String(meta.dataBasis || log?.dataBasis || '').toLowerCase() === DATA_BASIS_LABEL_SERVING;
}
function servingScaleMultiplier(log) {
  if (logUsesLabelServingBasis(log)) {
    return labelServingScaleMultiplier(log);
  }
  if (foodDataSource(log) === SOURCE_OPENFOODFACTS || foodDataSource(log) === SOURCE_USDA) {
    return perHundredGramsScaleMultiplier(log);
  }
  return 1;
}
function labelServingScaleMultiplier(log) {
  const labelGrams = Number(resolveMetadata(log).labelServingGrams) || Number(log?.serving_grams) || 0;
  const grams = Number(log?.serving_grams) || labelGrams;
  if (labelGrams > 0 && grams > 0) return grams / labelGrams;
  return Number(log?.serving_size) > 0 ? Number(log.serving_size) : 1;
}
function perHundredGramsScaleMultiplier(log) {
  const meta = resolveMetadata(log);
  const grams = Number(log?.serving_grams) || Number(meta.servingGrams) || Number(meta.servingAmount) || 0;
  if (Number.isFinite(grams) && grams > 0) return grams / GRAMS_PER_100;
  const quantity = Number(log?.serving_size);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}
function scaledNutrientFromMetadata(log, key) {
  const meta = resolveMetadata(log);
  const aliases = [...(META_FIELD_ALIASES[key] || []), ...(META_NF_ALIASES[key] || []), key];
  const raw = readFirstNumericMetaAlias(meta, aliases);
  if (raw == null) return null;
  if (logUsesLabelServingBasis(log)) {
    return raw * servingScaleMultiplier(log);
  }
  const source = foodDataSource(log);
  if (source === SOURCE_OPENFOODFACTS || source === SOURCE_USDA) {
    return raw * servingScaleMultiplier(log);
  }
  const logCalories = numberOrZero(log.calories);
  const metaCalories = numberOrZero(meta.calories) || numberOrZero(meta.nf_calories);
  if (logCalories > 0 && metaCalories > 0 && Math.abs(logCalories - metaCalories) > CALORIE_SCALE_TOLERANCE) {
    return raw * (logCalories / metaCalories);
  }
  return raw;
}
function blankNutrientMap() {
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
    caloriesFromFat: 0
  };
}
function pickNutrientAmount(log, logKey, metaKey) {
  const direct = numberOrNull(log[logKey]);
  if (direct != null && direct > 0) return direct;
  const fromMeta = scaledNutrientFromMetadata(log, metaKey || logKey);
  return fromMeta != null ? fromMeta : 0;
}
function roundToOneTenth(value) {
  return Math.round(value * TENTHS) / TENTHS;
}
function percentDailyValue(value, dvKey) {
  const dailyValue = DAILY_VALUES[dvKey];
  if (!dailyValue || dailyValue <= 0) return null;
  const pct = Math.round(numberOrZero(value) / dailyValue * MAX_PCT_CAP);
  return pct > 0 ? pct : null;
}
function formatNutrientAmount(value, unit) {
  const numericValue = numberOrZero(value);
  if (unit === 'kcal') return `${Math.round(numericValue)}`;
  if (unit === 'mg' || unit === 'mcg') {
    const display = numericValue % 1 === 0 ? Math.round(numericValue) : numericValue.toFixed(1);
    return `${display}${unit}`;
  }
  const gramsDisplay = numericValue % 1 === 0 ? Math.round(numericValue) : numericValue.toFixed(1);
  return `${gramsDisplay}g`;
}
function nutritionLabelRow(nutrients, key, label, unit, dvKey = null, indent = 0, warn = false) {
  return {
    key,
    label,
    value: formatNutrientAmount(nutrients[key], unit),
    raw: numberOrZero(nutrients[key]),
    unit,
    pct: dvKey ? percentDailyValue(nutrients[key], dvKey) : null,
    indent,
    warn,
    bold: indent === 0
  };
}
function percentOfDailyValue(value, dailyValue) {
  if (!dailyValue || dailyValue <= 0) return 0;
  return Math.min(MAX_PCT_CAP, Math.round(numberOrZero(value) / dailyValue * MAX_PCT_CAP));
}
function formatGramsDisplay(grams) {
  const numericValue = numberOrZero(grams);
  return numericValue % 1 === 0 ? `${Math.round(numericValue)}g` : `${numericValue.toFixed(1)}g`;
}
function formatMilligramsDisplay(amount, unit = 'mg') {
  const numericValue = numberOrZero(amount);
  let rounded;
  if (numericValue >= ROUND_MG_THRESHOLD) {
    rounded = Math.round(numericValue);
  } else {
    rounded = Math.round(numericValue * TENTHS) / TENTHS;
  }
  return `${rounded}${unit}`;
}
function percentOfGoal(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(MAX_PCT_CAP, Math.round(numberOrZero(value) / goal * MAX_PCT_CAP));
}
function wholeNumberOrOneDecimal(value) {
  return numberOrZero(value) % 1 === 0 ? String(Math.round(value)) : value.toFixed(1);
}
function writePatchWhenMissing(patch, current, merged, logKey, mergedKey) {
  const currentValue = numberOrZero(current[mergedKey]);
  const nextValue = numberOrZero(merged[mergedKey]);
  if (currentValue <= 0 && nextValue > 0) {
    patch[logKey] = nextValue;
  }
}
function roundDailyNutrientTotals(totals) {
  totals.caloriesFromFat = totals.fat * CALORIES_PER_GRAM_FAT;
  totals.calories = Math.round(totals.calories);
  totals.protein = roundToOneTenth(totals.protein);
  totals.carbs = roundToOneTenth(totals.carbs);
  totals.fat = roundToOneTenth(totals.fat);
  totals.fiber = roundToOneTenth(totals.fiber);
  totals.sugar = roundToOneTenth(totals.sugar);
  totals.sodium = Math.round(totals.sodium);
  totals.potassium = Math.round(totals.potassium);
  totals.saturatedFat = roundToOneTenth(totals.saturatedFat);
  totals.transFat = roundToOneTenth(totals.transFat);
  totals.polyunsaturatedFat = roundToOneTenth(totals.polyunsaturatedFat);
  totals.monounsaturatedFat = roundToOneTenth(totals.monounsaturatedFat);
  totals.cholesterol = Math.round(totals.cholesterol);
  totals.calcium = Math.round(totals.calcium);
  totals.iron = roundToOneTenth(totals.iron);
  totals.vitaminA = Math.round(totals.vitaminA);
  totals.vitaminC = roundToOneTenth(totals.vitaminC);
  totals.vitaminD = roundToOneTenth(totals.vitaminD);
  return totals;
}
function addNutrientsIntoRunningTotals(totals, nutrients) {
  totals.calories += numberOrZero(nutrients.calories);
  totals.protein += numberOrZero(nutrients.protein);
  totals.carbs += numberOrZero(nutrients.carbs);
  totals.fat += numberOrZero(nutrients.fat);
  totals.fiber += numberOrZero(nutrients.fiber);
  totals.sugar += numberOrZero(nutrients.sugar);
  totals.sodium += numberOrZero(nutrients.sodium);
  totals.potassium += numberOrZero(nutrients.potassium);
  totals.saturatedFat += numberOrZero(nutrients.saturatedFat);
  totals.transFat += numberOrZero(nutrients.transFat);
  totals.polyunsaturatedFat += numberOrZero(nutrients.polyunsaturatedFat);
  totals.monounsaturatedFat += numberOrZero(nutrients.monounsaturatedFat);
  totals.cholesterol += numberOrZero(nutrients.cholesterol);
  totals.calcium += numberOrZero(nutrients.calcium);
  totals.iron += numberOrZero(nutrients.iron);
  totals.vitaminA += numberOrZero(nutrients.vitaminA);
  totals.vitaminC += numberOrZero(nutrients.vitaminC);
  totals.vitaminD += numberOrZero(nutrients.vitaminD);
}
function ouncesLabelFromGramAmount(grams, isMilliliters) {
  const ounces = grams * (isMilliliters ? ML_TO_FL_OZ : G_TO_OZ);
  return `${ounces.toFixed(1)} oz`;
}