/**
 * Maps a logged food entry (Firestore / meal list) to premium FoodCard shape.
 */
const { makeReadableFoodTitle } = require('../../food-search/makeReadableFoodTitle');

function formatNutrient(n, decimals = 1) {
  const x = Number(n);
  if (!Number.isFinite(x)) return '0';
  const oneDec = Math.round(x * 10 ** decimals) / 10 ** decimals;
  if (Math.abs(oneDec - Math.round(oneDec)) < 1e-6) return String(Math.round(oneDec));
  return oneDec.toFixed(decimals);
}

function macroCaloriePercents(carbs, protein, fat, calories) {
  const cCal = Math.max(0, Number(carbs) || 0) * 4;
  const pCal = Math.max(0, Number(protein) || 0) * 4;
  const fCal = Math.max(0, Number(fat) || 0) * 9;
  const total = cCal + pCal + fCal || Math.max(1, Number(calories) || 0);
  return {
    carbs: Math.round((cCal / total) * 100),
    protein: Math.round((pCal / total) * 100),
    fat: Math.round((fCal / total) * 100),
  };
}

function formatSource(log) {
  const src = log?.source || log?.metadata?.source || '';
  const fdc = log?.metadata?.fdcId || log?.fdc_id || log?.fdcId;
  if (src === 'usda' || src === 'usdaFdc') {
    return fdc ? `USDA · FDC #${fdc}` : 'USDA FoodData Central';
  }
  if (src === 'fatsecret' || src === 'fatSecret') return 'FatSecret';
  if (src === 'openfoodfacts' || src === 'openFoodFacts') return 'Open Food Facts';
  if (src === 'nutrition_consensus' || src === 'consensus') return 'Nutrition consensus';
  if (src) return String(src).replace(/_/g, ' ');
  return 'CoachConnect';
}

function buildMicronutrients(log) {
  const m = log?.metadata || {};
  const pick = (value, unit) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return null;
    return { value: formatNutrient(n), unit };
  };

  return {
    fiber: pick(log.fiber ?? m.fiber, 'g'),
    saturatedFat: pick(log.saturated_fat ?? log.saturatedFat ?? m.saturated_fat, 'g'),
    cholesterol: pick(log.cholesterol ?? m.cholesterol, 'mg'),
    sugar: pick(log.sugar ?? m.sugar, 'g'),
    sodium: pick(log.sodium ?? m.sodium, 'mg'),
    potassium: pick(log.potassium ?? m.potassium, 'mg'),
  };
}

function buildSubtitle(brand, serving, weightG) {
  const parts = [brand, serving, weightG != null && weightG > 0 ? `${Math.round(weightG)}g` : null].filter(
    Boolean,
  );
  return parts.join(' · ');
}

/**
 * @param {object} log — meal food row from NutritionScreen
 * @param {string} [amountDisplay] — preformatted serving string
 */
export function formatLoggedFoodDisplay(log, amountDisplay) {
  const carbs = Number(log?.carbs) || 0;
  const protein = Number(log?.protein) || 0;
  const fat = Number(log?.fat) || 0;
  const calories = Math.round(Number(log?.calories) || 0);
  const weightG = log?.serving_grams != null ? Number(log.serving_grams) : null;
  const origAmt = log?.originalAmount ?? log?.loggedAmount ?? log?.metadata?.originalAmount;
  const origUnit = log?.originalUnit || log?.loggedUnit || log?.metadata?.originalUnit || '';
  const serving =
    (origAmt != null && origUnit
      ? `${origAmt} ${origUnit}${weightG ? ` (≈${Math.round(weightG)}g)` : ''}`
      : null) ||
    log?.serving_description ||
    log?.servingDescription ||
    (amountDisplay && amountDisplay !== '—' ? amountDisplay : '') ||
    '1 serving';
  const brandRaw = (log?.brand_name || log?.brand || '').trim();
  const { name, brand } = makeReadableFoodTitle({
    name: log?.food_name || log?.name || 'Food',
    brand: brandRaw,
    source: log?.source || log?.metadata?.source,
  });
  const verified =
    log?.verified === true ||
    log?.source === 'usda' ||
    log?.source === 'usdaFdc' ||
    Boolean(log?.metadata?.fdcId || log?.fdc_id);

  return {
    name,
    verified,
    brand,
    serving,
    weightG: Number.isFinite(weightG) ? weightG : null,
    subtitle: buildSubtitle(brand, serving, weightG),
    calories,
    carbs,
    protein,
    fat,
    macroPercents: macroCaloriePercents(carbs, protein, fat, calories),
    micronutrients: buildMicronutrients(log),
    source: formatSource(log),
  };
}

/** Demo food matching design mockups. */
export const DEMO_YOGURT_BOWL = {
  name: 'Yogurt Bowl',
  verified: true,
  brand: 'Chobani',
  serving: '1 bowl',
  weightG: 320,
  subtitle: 'Chobani · 1 bowl · 320g',
  calories: 412,
  carbs: 42,
  protein: 32,
  fat: 16,
  macroPercents: { carbs: 38, protein: 30, fat: 32 },
  micronutrients: {
    fiber: { value: '6', unit: 'g' },
    saturatedFat: { value: '3.2', unit: 'g' },
    cholesterol: { value: '75', unit: 'mg' },
    sugar: { value: '8', unit: 'g' },
    sodium: { value: '480', unit: 'mg' },
    potassium: { value: '620', unit: 'mg' },
  },
  source: 'USDA · FDC #170894',
};
