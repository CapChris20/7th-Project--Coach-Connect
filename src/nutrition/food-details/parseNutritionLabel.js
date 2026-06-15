/**
 * nutrition Facts Model
 *
 * Purpose: nutrition Facts Model — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: cleanFoodDisplayName, extractNutrientsFromLog, mergeEnrichedNutrients, countKnownMicros, buildNutritionLabelRows, getServingLabel, buildNutritionFactsSections, buildNutritionFactsCardData
 *
 * @file-header
 */
/**
 * Build a full nutrition-facts view model from a logged food entry.
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Per-serving multiplier for openfoodfacts / usda (metadata is per 100g/ml). */
function servingMultiplier(log) {
  const meta = log?.metadata || {};
  if (meta.source === 'openfoodfacts' || meta.source === 'usda') {
    const q = Number(log?.serving_size);
    return Number.isFinite(q) && q > 0 ? q : 1;
  }
  return 1;
}

function scaledFromMeta(log, key) {
  const meta = log?.metadata || {};
  const raw = numOrNull(meta[key]);
  if (raw == null) return null;
  return raw * servingMultiplier(log);
}

export function cleanFoodDisplayName(name) {
  return String(name || 'Food Item')
    .replace(/:\s*calories.*$/i, '')
    .replace(/\s*[•·]\s*\d+\s+slice.*$/i, '')
    .replace(/\s*[-–]\s*nutrition.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
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
    if (direct != null && direct > 0) return direct;
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
    value: fmtValue(n[key] ?? n[label], unit),
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

function formatGrams(value) {
  const n = num(value);
  return `${n % 1 === 0 ? Math.round(n) : n.toFixed(1)}g`;
}

function formatMgMg(value, unit = 'mg') {
  const n = num(value);
  if (n <= 0) return `0${unit}`;
  return `${n % 1 === 0 ? Math.round(n) : n.toFixed(1)}${unit}`;
}

function pctOfDv(value, dv) {
  if (!dv || dv <= 0) return 0;
  return Math.min(Math.round((num(value) / dv) * 100), 100);
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
