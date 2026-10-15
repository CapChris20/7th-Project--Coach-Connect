// Maps a logged food entry (Firestore / meal list) to the premium FoodCard shape.
// Flow: read macros → format serving/brand → percent of calories from each macro → micronutrients + source label.
// Used by the food log cards. Keep require() so this file stays CommonJS-compatible with readableFoodTitle.

const { readableFoodTitle } = require('../food-search/readableFoodTitle');

// ===== NAMED CONSTANTS =====

const DEFAULT_NUTRIENT_DECIMALS = 1;
const CALORIES_PER_GRAM_CARB = 4;
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_FAT = 9;
const NEARLY_WHOLE_THRESHOLD = 1e-6;
const GRAMS_UNIT = 'g';
const MILLIGRAMS_UNIT = 'mg';
const DEFAULT_FOOD_NAME = 'Food';
const DEFAULT_SERVING_LABEL = '1 serving';
const DEFAULT_SOURCE_LABEL = 'CoachConnect';
const EMPTY_AMOUNT_PLACEHOLDER = '—';
const DEMO_YOGURT_CALORIES = 412;
const DEMO_YOGURT_SODIUM_MG = '480';
const SOURCE_USDA = 'usda';
const SOURCE_USDA_FDC = 'usdaFdc';
const SOURCE_FATSECRET = 'fatsecret';
const SOURCE_FAT_SECRET = 'fatSecret';
const SOURCE_OPENFOODFACTS = 'openfoodfacts';
const SOURCE_OPEN_FOOD_FACTS = 'openFoodFacts';
const SOURCE_NUTRITION_CONSENSUS = 'nutrition_consensus';
const SOURCE_CONSENSUS = 'consensus';
const USDA_WITH_FDC_PREFIX = 'USDA · FDC #';
const USDA_FALLBACK_LABEL = 'USDA FoodData Central';
const FATSECRET_LABEL = 'FatSecret';
const OPEN_FOOD_FACTS_LABEL = 'Open Food Facts';
const NUTRITION_CONSENSUS_LABEL = 'Nutrition consensus';

// ===== HELPER FUNCTIONS =====

function formatNutrient(nutrientValue, decimals = DEFAULT_NUTRIENT_DECIMALS) {
  const numericValue = Number(nutrientValue);
  if (!Number.isFinite(numericValue)) return '0';
  const rounded = Math.round(numericValue * 10 ** decimals) / 10 ** decimals;
  if (Math.abs(rounded - Math.round(rounded)) < NEARLY_WHOLE_THRESHOLD) return String(Math.round(rounded));
  return rounded.toFixed(decimals);
}

function macroCaloriePercents(carbs, protein, fat, calories) {
  const carbCalories = Math.max(0, Number(carbs) || 0) * CALORIES_PER_GRAM_CARB;
  const proteinCalories = Math.max(0, Number(protein) || 0) * CALORIES_PER_GRAM_PROTEIN;
  const fatCalories = Math.max(0, Number(fat) || 0) * CALORIES_PER_GRAM_FAT;
  const total = carbCalories + proteinCalories + fatCalories || Math.max(1, Number(calories) || 0);
  return {
    carbs: Math.round((carbCalories / total) * 100),
    protein: Math.round((proteinCalories / total) * 100),
    fat: Math.round((fatCalories / total) * 100),
  };
}

function formatSource(log) {
  const sourceKey = log?.source || log?.metadata?.source || '';
  const fdc = log?.metadata?.fdcId || log?.fdc_id || log?.fdcId;
  if (sourceKey === SOURCE_USDA || sourceKey === SOURCE_USDA_FDC) {
    return fdc ? `${USDA_WITH_FDC_PREFIX}${fdc}` : USDA_FALLBACK_LABEL;
  }
  if (sourceKey === SOURCE_FATSECRET || sourceKey === SOURCE_FAT_SECRET) return FATSECRET_LABEL;
  if (sourceKey === SOURCE_OPENFOODFACTS || sourceKey === SOURCE_OPEN_FOOD_FACTS) return OPEN_FOOD_FACTS_LABEL;
  if (sourceKey === SOURCE_NUTRITION_CONSENSUS || sourceKey === SOURCE_CONSENSUS) return NUTRITION_CONSENSUS_LABEL;
  if (sourceKey) return String(sourceKey).replace(/_/g, ' ');
  return DEFAULT_SOURCE_LABEL;
}

function micronutrientIfPresent(value, unit) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return { value: formatNutrient(numericValue), unit };
}

function buildMicronutrients(log) {
  const metadata = log?.metadata || {};
  return {
    fiber: micronutrientIfPresent(log.fiber ?? metadata.fiber, GRAMS_UNIT),
    saturatedFat: micronutrientIfPresent(log.saturated_fat ?? log.saturatedFat ?? metadata.saturated_fat, GRAMS_UNIT),
    cholesterol: micronutrientIfPresent(log.cholesterol ?? metadata.cholesterol, MILLIGRAMS_UNIT),
    sugar: micronutrientIfPresent(log.sugar ?? metadata.sugar, GRAMS_UNIT),
    sodium: micronutrientIfPresent(log.sodium ?? metadata.sodium, MILLIGRAMS_UNIT),
    potassium: micronutrientIfPresent(log.potassium ?? metadata.potassium, MILLIGRAMS_UNIT),
  };
}

function buildSubtitle(brand, serving, weightG) {
  const parts = [brand, serving, weightG != null && weightG > 0 ? `${Math.round(weightG)}g` : null].filter(
    Boolean,
  );
  return parts.join(' · ');
}

function servingLabel(log, amountDisplay, weightG) {
  const originalAmount = log?.originalAmount ?? log?.loggedAmount ?? log?.metadata?.originalAmount;
  const originalUnit = log?.originalUnit || log?.loggedUnit || log?.metadata?.originalUnit || '';
  return (
    (originalAmount != null && originalUnit
      ? `${originalAmount} ${originalUnit}${weightG ? ` (≈${Math.round(weightG)}g)` : ''}`
      : null) ||
    log?.serving_description ||
    log?.servingDescription ||
    (amountDisplay && amountDisplay !== EMPTY_AMOUNT_PLACEHOLDER ? amountDisplay : '') ||
    DEFAULT_SERVING_LABEL
  );
}

function isVerifiedFood(log) {
  return (
    log?.verified === true ||
    log?.source === SOURCE_USDA ||
    log?.source === SOURCE_USDA_FDC ||
    Boolean(log?.metadata?.fdcId || log?.fdc_id)
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} log — meal food row from DailyFoodLogScreen
 * @param {string} [amountDisplay] — preformatted serving string
 * @returns {object}
 */
export function foodCardText(log, amountDisplay) {
  const carbs = Number(log?.carbs) || 0;
  const protein = Number(log?.protein) || 0;
  const fat = Number(log?.fat) || 0;
  const calories = Math.round(Number(log?.calories) || 0);
  const weightG = log?.serving_grams != null ? Number(log.serving_grams) : null;
  const serving = servingLabel(log, amountDisplay, weightG);
  const brandRaw = (log?.brand_name || log?.brand || '').trim();
  const { name, brand } = readableFoodTitle({
    name: log?.food_name || log?.name || DEFAULT_FOOD_NAME,
    brand: brandRaw,
    source: log?.source || log?.metadata?.source,
  });
  const verified = isVerifiedFood(log);

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
  calories: DEMO_YOGURT_CALORIES,
  carbs: 42,
  protein: 32,
  fat: 16,
  macroPercents: { carbs: 38, protein: 30, fat: 32 },
  micronutrients: {
    fiber: { value: '6', unit: 'g' },
    saturatedFat: { value: '3.2', unit: 'g' },
    cholesterol: { value: '75', unit: 'mg' },
    sugar: { value: '8', unit: 'g' },
    sodium: { value: DEMO_YOGURT_SODIUM_MG, unit: 'mg' },
    potassium: { value: '620', unit: 'mg' },
  },
  source: 'USDA · FDC #170894',
};
