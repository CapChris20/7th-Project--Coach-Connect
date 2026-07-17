/**
 * Build a full nutrition-facts view model from a logged food entry.
 */
import {
  NUT_MACRO_RING_GRADIENTS,
  NUT_CALORIES_GRADIENT,
  NUT_SECTION_GRADIENT,
} from '../nutritionTheme';

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const META_FIELD_ALIASES = {
  saturatedFat: ['saturatedFat', 'saturated_fat'],
  transFat: ['transFat', 'trans_fat'],
  polyunsaturatedFat: ['polyunsaturatedFat', 'polyunsaturated_fat'],
  monounsaturatedFat: ['monounsaturatedFat', 'monounsaturated_fat'],
  vitaminA: ['vitaminA', 'vitamin_a'],
  vitaminC: ['vitaminC', 'vitamin_c'],
  vitaminD: ['vitaminD', 'vitamin_d'],
};

function readMetaValue(meta, keys) {
  for (const k of keys) {
    const v = numOrNull(meta?.[k]);
    if (v != null) return v;
  }
  return null;
}

/** Flatten nested metadata (normalizeFood stores original search hit under metadata.metadata). */
export function resolveMetadata(log) {
  const raw = log?.metadata;
  if (!raw || typeof raw !== 'object') return {};
  const inner = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : null;
  return inner ? { ...inner, ...raw } : raw;
}

function dataSource(log) {
  const meta = resolveMetadata(log);
  return meta.source || log?.source || '';
}

function isLabelServingLog(log) {
  const meta = resolveMetadata(log);
  const basis = String(meta.dataBasis || log?.dataBasis || '').toLowerCase();
  return basis === 'label_serving' || basis === 'per_serving';
}

function isLoggedTotalsLog(log) {
  const meta = resolveMetadata(log);
  const basis = String(meta.dataBasis || log?.dataBasis || '').toLowerCase();
  return basis === 'logged_totals' || basis === 'logged_total' || Boolean(meta.fromRecentLog);
}

/** Per-portion multiplier for openfoodfacts / usda (metadata is per 100g/ml). */
function servingMultiplier(log) {
  if (isLoggedTotalsLog(log)) return 1;
  if (isLabelServingLog(log)) {
    const labelG = Number(resolveMetadata(log).labelServingGrams) || Number(log?.serving_grams) || 0;
    const grams = Number(log?.serving_grams) || labelG;
    if (labelG > 0 && grams > 0) return grams / labelG;
    return Number(log?.serving_size) > 0 ? Number(log.serving_size) : 1;
  }
  if (dataSource(log) === 'openfoodfacts' || dataSource(log) === 'usda') {
    const meta = resolveMetadata(log);
    const grams = Number(log?.serving_grams) || Number(meta.servingGrams) || Number(meta.servingAmount) || 0;
    if (Number.isFinite(grams) && grams > 0) return grams / 100;
    const q = Number(log?.serving_size);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }
  return 1;
}

const META_NF_ALIASES = {
  fiber: ['fiber', 'nf_dietary_fiber', 'dietary_fiber'],
  sugar: ['sugar', 'nf_sugars', 'sugars'],
  sodium: ['sodium', 'nf_sodium'],
  potassium: ['potassium', 'nf_potassium'],
  cholesterol: ['cholesterol', 'nf_cholesterol'],
};

function scaledFromMeta(log, key) {
  const meta = resolveMetadata(log);
  const aliases = [
    ...(META_FIELD_ALIASES[key] || []),
    ...(META_NF_ALIASES[key] || []),
    key,
  ];
  const raw = readMetaValue(meta, aliases);
  if (raw == null) return null;

  // Logged portion totals already include the full amount — never rescale meta.
  if (isLoggedTotalsLog(log)) return raw;

  if (isLabelServingLog(log)) {
    return raw * servingMultiplier(log);
  }

  const src = dataSource(log);
  if (src === 'openfoodfacts' || src === 'usda') {
    return raw * servingMultiplier(log);
  }

  const logCals = num(log.calories);
  const metaCals = num(meta.calories) || num(meta.nf_calories);
  if (logCals > 0 && metaCals > 0 && Math.abs(logCals - metaCals) > 1) {
    return raw * (logCals / metaCals);
  }
  return raw;
}

export function cleanFoodDisplayName(name) {
  const { makeReadableFoodTitle } = require('../food-search/makeReadableFoodTitle');
  return makeReadableFoodTitle({ name }).name || 'Food Item';
}

/**
 * @param {object} log — Firestore nutrition_logs document
 * @returns {object} flat nutrient map (all values for this logged portion)
 */
export function extractNutrientsFromLog(log) {
  if (!log) {
    return emptyNutrients();
  }

  const fat = num(log.fat);
  const pick = (logKey, metaKey) => {
    const direct = numOrNull(log[logKey]);
    // Prefer log values including explicit zeros for logged_totals (already portion totals).
    if (direct != null && (direct > 0 || isLoggedTotalsLog(log))) return direct;
    const fromMeta = scaledFromMeta(log, metaKey || logKey);
    return fromMeta != null ? fromMeta : 0;
  };

  return {
    calories: num(log.calories),
    protein: num(log.protein),
    carbs: num(log.carbs),
    fat,
    fiber: pick('fiber', 'fiber'),
    sugar: pick('sugar', 'sugar'),
    sodium: pick('sodium', 'sodium'),
    potassium: pick('potassium', 'potassium'),
    saturatedFat: pick('saturated_fat', 'saturatedFat'),
    transFat: pick('trans_fat', 'transFat'),
    polyunsaturatedFat: pick('polyunsaturated_fat', 'polyunsaturatedFat') || scaledFromMeta(log, 'polyunsaturatedFat') || 0,
    monounsaturatedFat: pick('monounsaturated_fat', 'monounsaturatedFat') || scaledFromMeta(log, 'monounsaturatedFat') || 0,
    cholesterol: pick('cholesterol', 'cholesterol'),
    calcium: pick('calcium', 'calcium'),
    iron: pick('iron', 'iron'),
    vitaminA: pick('vitamin_a', 'vitaminA'),
    vitaminC: pick('vitamin_c', 'vitaminC'),
    vitaminD: pick('vitamin_d', 'vitaminD'),
    caloriesFromFat: fat * 9,
  };
}

function emptyNutrients() {
  return {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0,
    potassium: 0, saturatedFat: 0, transFat: 0, polyunsaturatedFat: 0, monounsaturatedFat: 0,
    cholesterol: 0, calcium: 0, iron: 0, vitaminA: 0, vitaminC: 0, vitaminD: 0, caloriesFromFat: 0,
  };
}

const EXTENDED_KEYS = [
  'fiber', 'sugar', 'sodium', 'potassium', 'cholesterol',
  'saturatedFat', 'transFat', 'polyunsaturatedFat', 'monounsaturatedFat',
  'calcium', 'iron', 'vitaminA', 'vitaminC', 'vitaminD',
];

/** Fill missing micros from API lookup, scaled to logged portion. */
export function mergeEnrichedNutrients(base, enrichedNutrients, log) {
  if (!enrichedNutrients) return base;
  const merged = { ...base };
  const baseCals = num(base.calories);
  const refCals = num(enrichedNutrients.calories);
  const scale = baseCals > 0 && refCals > 0 ? baseCals / refCals : 1;

  for (const key of EXTENDED_KEYS) {
    if (num(merged[key]) <= 0 && num(enrichedNutrients[key]) > 0) {
      merged[key] = Math.round(num(enrichedNutrients[key]) * scale * 10) / 10;
    }
  }
  merged.caloriesFromFat = merged.fat * 9;
  return merged;
}

export function countKnownMicros(n) {
  return EXTENDED_KEYS.filter((k) => num(n?.[k]) > 0).length;
}

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

/** Scale API nutrition-details (per reference serving) to match a logged portion. */
export function scaleApiNutrientsToLog(apiNutrients, log) {
  if (!apiNutrients || !log) return null;
  const out = emptyNutrients();
  const logCals = num(log.calories);
  const refCals = num(apiNutrients.calories);
  const factor = logCals > 0 && refCals > 0 ? logCals / refCals : 1;

  for (const [outKey, apiKey] of Object.entries(API_NUTRIENT_MAP)) {
    const v = num(apiNutrients[apiKey]);
    if (v > 0) {
      out[outKey] = outKey === 'calories' ? Math.round(v * factor) : Math.round(v * factor * 10) / 10;
    }
  }
  out.caloriesFromFat = out.fat * 9;
  return out;
}

/** True when API lookup could still fill meaningful gaps. */
export function logNeedsNutrientEnrichment(log) {
  if (!log?.id || num(log.calories) <= 0) return false;
  const n = extractNutrientsFromLog(log);
  if (num(n.fat) > 2 && num(n.saturatedFat) <= 0) return true;
  if (num(n.carbs) > 5 && num(n.fiber) <= 0 && num(n.sugar) <= 0) return true;
  if (num(n.sodium) <= 0 && num(n.cholesterol) <= 0 && num(n.potassium) <= 0) return true;
  return countKnownMicros(n) < 6;
}

/** Map API / search hit nutrients → Firestore log field updates (only missing values). */
export function buildLogEnrichmentPatch(log, apiNutrients) {
  if (!log || !apiNutrients) return null;
  const current = extractNutrientsFromLog(log);
  const merged = mergeEnrichedNutrients(current, apiNutrients, log);
  const patch = {};
  const setIfMissing = (logKey, mergedKey) => {
    const cur = num(current[mergedKey]);
    const next = num(merged[mergedKey]);
    if (cur <= 0 && next > 0) patch[logKey] = next;
  };
  setIfMissing('fiber', 'fiber');
  setIfMissing('sugar', 'sugar');
  setIfMissing('sodium', 'sodium');
  setIfMissing('potassium', 'potassium');
  setIfMissing('saturated_fat', 'saturatedFat');
  setIfMissing('trans_fat', 'transFat');
  setIfMissing('polyunsaturated_fat', 'polyunsaturatedFat');
  setIfMissing('monounsaturated_fat', 'monounsaturatedFat');
  setIfMissing('cholesterol', 'cholesterol');
  setIfMissing('calcium', 'calcium');
  setIfMissing('iron', 'iron');
  setIfMissing('vitamin_a', 'vitaminA');
  setIfMissing('vitamin_c', 'vitaminC');
  setIfMissing('vitamin_d', 'vitaminD');
  return Object.keys(patch).length ? patch : null;
}



/** FDA % Daily Value (2,000 kcal diet). */
export const DAILY_VALUES = {
  fat: 78,
  saturatedFat: 20,
  cholesterol: 300,
  sodium: 2300,
  carbs: 275,
  fiber: 28,
  protein: 50,
  potassium: 4700,
  calcium: 1300,
  iron: 18,
  vitaminA: 900,
  vitaminC: 90,
  vitaminD: 20,
};

function pctDv(value, dvKey) {
  const dv = DAILY_VALUES[dvKey];
  if (!dv || dv <= 0) return null;
  const pct = Math.round((num(value) / dv) * 100);
  return pct > 0 ? pct : null;
}

function fmtValue(value, unit) {
  const n = num(value);
  if (unit === 'kcal') return `${Math.round(n)}`;
  if (unit === 'mg' || unit === 'mcg') return `${n % 1 === 0 ? Math.round(n) : n.toFixed(1)}${unit}`;
  return `${n % 1 === 0 ? Math.round(n) : n.toFixed(1)}g`;
}

/**
 * FDA-style label rows for one logged portion (no daily-goal progress bars).
 */
export function buildNutritionLabelRows(nutrients) {
  const n = nutrients || emptyNutrients();

  const main = (key, label, unit, dvKey = null, indent = 0, warn = false) => ({
    key,
    label,
    value: fmtValue(n[key], unit),
    raw: num(n[key]),
    unit,
    pct: dvKey ? pctDv(n[key], dvKey) : null,
    indent,
    warn,
    bold: indent === 0,
  });

  return [
    { type: 'calories', key: 'calories', label: 'Calories', value: fmtValue(n.calories, 'kcal'), raw: n.calories, bold: true },
    { type: 'divider' },
    main('fat', 'Total Fat', 'g', 'fat'),
    main('saturatedFat', 'Saturated Fat', 'g', 'saturatedFat', 1, true),
    main('transFat', 'Trans Fat', 'g', null, 1, true),
    main('polyunsaturatedFat', 'Polyunsaturated Fat', 'g', null, 1),
    main('monounsaturatedFat', 'Monounsaturated Fat', 'g', null, 1),
    { type: 'divider' },
    main('cholesterol', 'Cholesterol', 'mg', 'cholesterol', 0, true),
    main('sodium', 'Sodium', 'mg', 'sodium', 0, true),
    { type: 'divider' },
    main('carbs', 'Total Carbohydrate', 'g', 'carbs'),
    main('fiber', 'Dietary Fiber', 'g', 'fiber', 1),
    main('sugar', 'Total Sugars', 'g', null, 1, true),
    { type: 'divider' },
    main('protein', 'Protein', 'g', 'protein'),
    { type: 'divider' },
    main('potassium', 'Potassium', 'mg', 'potassium'),
    main('calcium', 'Calcium', 'mg', 'calcium'),
    main('iron', 'Iron', 'mg', 'iron'),
    main('vitaminA', 'Vitamin A', 'mcg', 'vitaminA'),
    main('vitaminC', 'Vitamin C', 'mg', 'vitaminC'),
    main('vitaminD', 'Vitamin D', 'mcg', 'vitaminD'),
  ];
}

export function getServingLabel(log) {
  if (!log) return '—';
  const meta = log.metadata || {};
  const servingLabel = meta.serving_label || meta.servingLabel;
  if (servingLabel) return String(servingLabel);

  const grams = num(log.serving_grams);
  const isMl = String(meta.servingUnit || '').toLowerCase() === 'ml';
  const G_TO_OZ = 1 / 28.3495;
  const ML_TO_FL_OZ = 1 / 29.5735;
  if (grams > 0) {
    const oz = grams * (isMl ? ML_TO_FL_OZ : G_TO_OZ);
    return `${oz.toFixed(1)} oz`;
  }
  const qty = num(log.serving_size);
  if (qty > 0) return `${qty} serving${qty === 1 ? '' : 's'}`;
  return '—';
}

export function buildNutritionFactsSections(log, goals) {
  void goals;
  const n = extractNutrientsFromLog(log);
  return [{ id: 'label', rows: buildNutritionLabelRows(n) }];
}

function pctOfDv(value, dv) {
  if (!dv || dv <= 0) return 0;
  return Math.min(100, Math.round((num(value) / dv) * 100));
}

function formatGrams(g) {
  const n = num(g);
  return n % 1 === 0 ? `${Math.round(n)}g` : `${n.toFixed(1)}g`;
}

function formatMgMg(mg, unit = 'mg') {
  const n = num(mg);
  const rounded = n >= 100 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${rounded}${unit}`;
}

/** Card sections matching Nutrition / home dashboard patterns. */
/** Sum all nutrients across every log for today. Optional enrichment map: logId → API nutrients. */
export function calculateDailyNutrientTotals(logs = [], enrichmentByLogId = {}) {
  const totals = emptyNutrients();
  for (const log of logs) {
    let n = extractNutrientsFromLog(log);
    const api = enrichmentByLogId[log.id];
    if (api) {
      n = mergeEnrichedNutrients(n, api, log);
    }
    totals.calories += num(n.calories);
    totals.protein += num(n.protein);
    totals.carbs += num(n.carbs);
    totals.fat += num(n.fat);
    totals.fiber += num(n.fiber);
    totals.sugar += num(n.sugar);
    totals.sodium += num(n.sodium);
    totals.potassium += num(n.potassium);
    totals.saturatedFat += num(n.saturatedFat);
    totals.transFat += num(n.transFat);
    totals.polyunsaturatedFat += num(n.polyunsaturatedFat);
    totals.monounsaturatedFat += num(n.monounsaturatedFat);
    totals.cholesterol += num(n.cholesterol);
    totals.calcium += num(n.calcium);
    totals.iron += num(n.iron);
    totals.vitaminA += num(n.vitaminA);
    totals.vitaminC += num(n.vitaminC);
    totals.vitaminD += num(n.vitaminD);
  }
  totals.caloriesFromFat = totals.fat * 9;
  totals.calories = Math.round(totals.calories);
  totals.protein = Math.round(totals.protein * 10) / 10;
  totals.carbs = Math.round(totals.carbs * 10) / 10;
  totals.fat = Math.round(totals.fat * 10) / 10;
  totals.fiber = Math.round(totals.fiber * 10) / 10;
  totals.sugar = Math.round(totals.sugar * 10) / 10;
  totals.sodium = Math.round(totals.sodium);
  totals.potassium = Math.round(totals.potassium);
  totals.saturatedFat = Math.round(totals.saturatedFat * 10) / 10;
  totals.transFat = Math.round(totals.transFat * 10) / 10;
  totals.polyunsaturatedFat = Math.round(totals.polyunsaturatedFat * 10) / 10;
  totals.monounsaturatedFat = Math.round(totals.monounsaturatedFat * 10) / 10;
  totals.cholesterol = Math.round(totals.cholesterol);
  totals.calcium = Math.round(totals.calcium);
  totals.iron = Math.round(totals.iron * 10) / 10;
  totals.vitaminA = Math.round(totals.vitaminA);
  totals.vitaminC = Math.round(totals.vitaminC * 10) / 10;
  totals.vitaminD = Math.round(totals.vitaminD * 10) / 10;
  return totals;
}

function pctOfGoal(value, goal) {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((num(value) / goal) * 100));
}

/** Daily nutrition facts card data — uses user's calorie/macro goals. */
export function buildDailyNutritionFactsCardData(nutrients, goals = {}) {
  const n = nutrients || emptyNutrients();
  const calorieGoal = goals.calories || 2200;
  const proteinGoal = goals.proteinTarget || 150;
  const carbsGoal = goals.carbsTarget || 250;
  const fatGoal = goals.fatTarget || 70;

  const listRow = (label, value, unit = 'g') => ({
    label,
    display: unit === 'mg' || unit === 'mcg' ? formatMgMg(value, unit) : formatGrams(value),
    raw: num(value),
  });

  const micro = (key, name, unit = 'mg') => ({
    key,
    name,
    value: num(n[key]) > 0 ? formatMgMg(n[key], unit) : '—',
    raw: num(n[key]),
  });

  return {
    calories: Math.round(num(n.calories)),
    calorieGoal,
    caloriePct: pctOfGoal(n.calories, calorieGoal),
    foodCount: 0,
    macros: [
      {
        label: 'Protein',
        value: n.protein,
        display: formatGrams(n.protein),
        goal: proteinGoal,
        goalLabel: `${num(n.protein) % 1 === 0 ? Math.round(n.protein) : n.protein.toFixed(1)} / ${proteinGoal}g`,
        pct: pctOfGoal(n.protein, proteinGoal),
        gradient: NUT_MACRO_RING_GRADIENTS.Protein,
      },
      {
        label: 'Carbs',
        value: n.carbs,
        display: formatGrams(n.carbs),
        goal: carbsGoal,
        goalLabel: `${num(n.carbs) % 1 === 0 ? Math.round(n.carbs) : n.carbs.toFixed(1)} / ${carbsGoal}g`,
        pct: pctOfGoal(n.carbs, carbsGoal),
        gradient: NUT_MACRO_RING_GRADIENTS.Carbs,
      },
      {
        label: 'Fat',
        value: n.fat,
        display: formatGrams(n.fat),
        goal: fatGoal,
        goalLabel: `${num(n.fat) % 1 === 0 ? Math.round(n.fat) : n.fat.toFixed(1)} / ${fatGoal}g`,
        pct: pctOfGoal(n.fat, fatGoal),
        gradient: NUT_MACRO_RING_GRADIENTS.Fat,
      },
    ],
    calorieGradient: NUT_CALORIES_GRADIENT,
    fats: {
      title: 'FATS',
      gradient: NUT_MACRO_RING_GRADIENTS.Fat,
      total: formatGrams(n.fat),
      rows: [
        listRow('Saturated Fat', n.saturatedFat),
        listRow('Trans Fat', n.transFat),
        listRow('Polyunsaturated', n.polyunsaturatedFat),
        listRow('Monounsaturated', n.monounsaturatedFat),
      ],
    },
    carbs: {
      title: 'CARBOHYDRATES',
      gradient: NUT_MACRO_RING_GRADIENTS.Carbs,
      total: formatGrams(n.carbs),
      rows: [
        listRow('Dietary Fiber', n.fiber),
        listRow('Sugars', n.sugar),
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

export function buildNutritionFactsCardData(nutrients) {
  const n = nutrients || emptyNutrients();

  const macroBar = (label, value, max, color, unit = 'g') => ({
    label,
    value: num(value),
    display: unit === 'mg' || unit === 'mcg' ? formatMgMg(value, unit) : formatGrams(value),
    fillPct: max > 0 ? Math.min((num(value) / max) * 100, 100) : 0,
    color,
  });

  const micro = (key, name, unit = 'mg') => ({
    key,
    name,
    value: formatMgMg(n[key], unit),
    raw: num(n[key]),
  });

  return {
    calories: Math.round(num(n.calories)),
    macros: [
      {
        label: 'Protein',
        value: n.protein,
        display: formatGrams(n.protein),
        pct: pctOfDv(n.protein, DAILY_VALUES.protein),
        gradient: ['#6D28D9', '#FDE68A'],
        barColor: '#FF6B9D',
      },
      {
        label: 'Carbs',
        value: n.carbs,
        display: formatGrams(n.carbs),
        pct: pctOfDv(n.carbs, DAILY_VALUES.carbs),
        gradient: ['#FBBF24', '#FB7185'],
        barColor: '#F97316',
      },
      {
        label: 'Fat',
        value: n.fat,
        display: formatGrams(n.fat),
        pct: pctOfDv(n.fat, DAILY_VALUES.fat),
        gradient: ['#6D28D9', '#DB2777'],
        barColor: '#64D2FF',
      },
    ],
    fats: [
      macroBar('Total Fat', n.fat, DAILY_VALUES.fat, '#64D2FF'),
      macroBar('Saturated Fat', n.saturatedFat, DAILY_VALUES.saturatedFat, '#FF6B9D'),
      macroBar('Trans Fat', n.transFat, 2, '#EF4444'),
      macroBar('Polyunsaturated', n.polyunsaturatedFat, 20, '#C084FC'),
      macroBar('Monounsaturated', n.monounsaturatedFat, 30, '#A78BFA'),
    ],
    carbs: [
      macroBar('Total Carbs', n.carbs, DAILY_VALUES.carbs, '#F97316'),
      macroBar('Dietary Fiber', n.fiber, DAILY_VALUES.fiber, '#22C55E'),
      macroBar('Sugars', n.sugar, 50, '#FB7185'),
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

export function formatAmount(value, unit) {
  return fmtValue(value, unit);
}
