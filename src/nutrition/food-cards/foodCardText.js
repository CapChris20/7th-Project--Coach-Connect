// Turns one saved meal-food row into the shape FoodCard reads (name, macros, micros, source).
// Flow: macros → serving line → clean title/brand → calorie % split → micronutrient tiles → source label.
// Used by LoggedFoodRow and any screen that paints a Firestore log as a card. Keep require() for readableFoodTitle.
// Read order: constants → main foodCardText → PLUMBING helpers at the bottom.

const { readableFoodTitle } = require('../food-search/readableFoodTitle');

// ===== NAMED CONSTANTS =====

const DEFAULT_NUTRIENT_DECIMALS = 1;
const CALORIES_PER_GRAM_CARB = 4;
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_FAT = 9;
// Manipulate here: how close to a whole number before we drop the decimal (1e-6 ≈ “basically 12.0”)
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

// Friendly label for each known source key (plus USDA variants that may include an FDC id).
const FRIENDLY_SOURCE_LABEL = {
  [SOURCE_FATSECRET]: FATSECRET_LABEL,
  [SOURCE_FAT_SECRET]: FATSECRET_LABEL,
  [SOURCE_OPENFOODFACTS]: OPEN_FOOD_FACTS_LABEL,
  [SOURCE_OPEN_FOOD_FACTS]: OPEN_FOOD_FACTS_LABEL,
  [SOURCE_NUTRITION_CONSENSUS]: NUTRITION_CONSENSUS_LABEL,
  [SOURCE_CONSENSUS]: NUTRITION_CONSENSUS_LABEL,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging card text / source labels.

function emptyLogObject(log) {
  if (log) return log;
  return {};
}

function metadataBag(log) {
  const safeLog = emptyLogObject(log);
  if (safeLog.metadata && typeof safeLog.metadata === 'object') {
    return safeLog.metadata;
  }
  return {};
}

function readWeightInGrams(log) {
  const safeLog = emptyLogObject(log);
  if (safeLog.serving_grams == null) return null;
  return Number(safeLog.serving_grams);
}

// Round a nutrient for display; drop fake decimals when the value is basically whole.
function formatNutrientDisplay(nutrientValue, decimals = DEFAULT_NUTRIENT_DECIMALS) {
  const numericValue = Number(nutrientValue);
  if (!Number.isFinite(numericValue)) return '0';

  const powerOfTen = 10 ** decimals;
  const roundedValue = Math.round(numericValue * powerOfTen) / powerOfTen;
  const nearestWhole = Math.round(roundedValue);
  const isBasicallyWhole = Math.abs(roundedValue - nearestWhole) < NEARLY_WHOLE_THRESHOLD;

  if (isBasicallyWhole) return String(nearestWhole);
  return roundedValue.toFixed(decimals);
}

// vocab: 4 kcal/g carb & protein, 9 kcal/g fat — used for the % of calories row on the card.
function macroCaloriePercents(carbsGrams, proteinGrams, fatGrams, calories) {
  const carbCalories = Math.max(0, Number(carbsGrams) || 0) * CALORIES_PER_GRAM_CARB;
  const proteinCalories = Math.max(0, Number(proteinGrams) || 0) * CALORIES_PER_GRAM_PROTEIN;
  const fatCalories = Math.max(0, Number(fatGrams) || 0) * CALORIES_PER_GRAM_FAT;

  const caloriesFromMacros = carbCalories + proteinCalories + fatCalories;
  const calorieTotal = caloriesFromMacros || Math.max(1, Number(calories) || 0);

  return {
    carbs: Math.round((carbCalories / calorieTotal) * 100),
    protein: Math.round((proteinCalories / calorieTotal) * 100),
    fat: Math.round((fatCalories / calorieTotal) * 100),
  };
}

function fdcIdFromLog(log) {
  const safeLog = emptyLogObject(log);
  const metadata = metadataBag(safeLog);
  if (metadata.fdcId) return metadata.fdcId;
  if (safeLog.fdc_id) return safeLog.fdc_id;
  if (safeLog.fdcId) return safeLog.fdcId;
  return null;
}

function formatUsdaSourceLabel(log) {
  const fdcId = fdcIdFromLog(log);
  if (fdcId) return `${USDA_WITH_FDC_PREFIX}${fdcId}`;
  return USDA_FALLBACK_LABEL;
}

function sourceKeyFromLog(log) {
  const safeLog = emptyLogObject(log);
  const metadata = metadataBag(safeLog);
  if (safeLog.source) return safeLog.source;
  if (metadata.source) return metadata.source;
  return '';
}

// Human label for where this food came from (USDA, FatSecret, Open Food Facts, etc.).
function formatSourceLabel(log) {
  const sourceKey = sourceKeyFromLog(log);
  const isUsdaSource = sourceKey === SOURCE_USDA || sourceKey === SOURCE_USDA_FDC;
  if (isUsdaSource) return formatUsdaSourceLabel(log);

  const knownLabel = FRIENDLY_SOURCE_LABEL[sourceKey];
  if (knownLabel) return knownLabel;

  if (sourceKey) return String(sourceKey).replace(/_/g, ' ');
  return DEFAULT_SOURCE_LABEL;
}

// Skip micro tiles when the number is missing or zero.
function micronutrientIfPresent(value, unit) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;
  return { value: formatNutrientDisplay(numericValue), unit };
}

// Pick first non-null / non-undefined among candidates (0 still wins).
function firstDefinedValue(candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (candidate != null) return candidate;
  }
  return null;
}

// Pull optional fiber, sodium, etc. from the log root or metadata bag.
function buildMicronutrients(log) {
  const safeLog = emptyLogObject(log);
  const metadata = metadataBag(safeLog);
  const fiberValue = firstDefinedValue([safeLog.fiber, metadata.fiber]);
  const saturatedFatValue = firstDefinedValue([
    safeLog.saturated_fat,
    safeLog.saturatedFat,
    metadata.saturated_fat,
  ]);
  const cholesterolValue = firstDefinedValue([safeLog.cholesterol, metadata.cholesterol]);
  const sugarValue = firstDefinedValue([safeLog.sugar, metadata.sugar]);
  const sodiumValue = firstDefinedValue([safeLog.sodium, metadata.sodium]);
  const potassiumValue = firstDefinedValue([safeLog.potassium, metadata.potassium]);

  return {
    fiber: micronutrientIfPresent(fiberValue, GRAMS_UNIT),
    saturatedFat: micronutrientIfPresent(saturatedFatValue, GRAMS_UNIT),
    cholesterol: micronutrientIfPresent(cholesterolValue, MILLIGRAMS_UNIT),
    sugar: micronutrientIfPresent(sugarValue, GRAMS_UNIT),
    sodium: micronutrientIfPresent(sodiumValue, MILLIGRAMS_UNIT),
    potassium: micronutrientIfPresent(potassiumValue, MILLIGRAMS_UNIT),
  };
}

function buildSubtitleLine(brandName, servingLine, weightInGrams) {
  let weightLabel = null;
  if (weightInGrams != null && weightInGrams > 0) {
    weightLabel = `${Math.round(weightInGrams)}g`;
  }
  const subtitleParts = [brandName, servingLine, weightLabel].filter(Boolean);
  return subtitleParts.join(' · ');
}

function originalAmountFromLog(log) {
  const safeLog = emptyLogObject(log);
  const metadata = metadataBag(safeLog);
  return firstDefinedValue([
    safeLog.originalAmount,
    safeLog.loggedAmount,
    metadata.originalAmount,
  ]);
}

function originalUnitFromLog(log) {
  const safeLog = emptyLogObject(log);
  const metadata = metadataBag(safeLog);
  if (safeLog.originalUnit) return safeLog.originalUnit;
  if (safeLog.loggedUnit) return safeLog.loggedUnit;
  if (metadata.originalUnit) return metadata.originalUnit;
  return '';
}

// Prefer the amount the user logged; fall back to API serving text.
function buildServingLine(log, amountDisplay, weightInGrams) {
  const safeLog = emptyLogObject(log);
  const originalAmount = originalAmountFromLog(safeLog);
  const originalUnit = originalUnitFromLog(safeLog);

  const hasLoggedAmount = originalAmount != null && originalUnit;
  if (hasLoggedAmount) {
    let approxGrams = '';
    if (weightInGrams) {
      approxGrams = ` (≈${Math.round(weightInGrams)}g)`;
    }
    return `${originalAmount} ${originalUnit}${approxGrams}`;
  }

  if (safeLog.serving_description) return safeLog.serving_description;
  if (safeLog.servingDescription) return safeLog.servingDescription;
  if (amountDisplay && amountDisplay !== EMPTY_AMOUNT_PLACEHOLDER) return amountDisplay;
  return DEFAULT_SERVING_LABEL;
}

function foodLooksVerified(log) {
  const safeLog = emptyLogObject(log);
  if (safeLog.verified === true) return true;
  if (safeLog.source === SOURCE_USDA || safeLog.source === SOURCE_USDA_FDC) return true;
  const fdcId = fdcIdFromLog(safeLog);
  return Boolean(fdcId);
}

function foodNameFromLog(log) {
  const safeLog = emptyLogObject(log);
  if (safeLog.food_name) return safeLog.food_name;
  if (safeLog.name) return safeLog.name;
  return DEFAULT_FOOD_NAME;
}

function brandRawFromLog(log) {
  const safeLog = emptyLogObject(log);
  if (safeLog.brand_name) return String(safeLog.brand_name).trim();
  if (safeLog.brand) return String(safeLog.brand).trim();
  return '';
}

// ===== MAIN FUNCTION =====

/**
 * Build the FoodCard view-model from one logged food row.
 * Flow: 1. macros  2. serving/weight  3. title/brand  4. return frozen card keys
 * @param {object} log - Firestore / meal-list food row
 * @param {string} [amountDisplay] - fallback serving text from the parent
 * @returns {object} FoodCard fields (keys frozen — do not rename)
 */
export function foodCardText(log, amountDisplay) {
  const safeLog = emptyLogObject(log);

  // 1. Core macros and calories for the compact row.
  const carbsGrams = Number(safeLog.carbs) || 0;
  const proteinGrams = Number(safeLog.protein) || 0;
  const fatGrams = Number(safeLog.fat) || 0;
  const caloriesRounded = Math.round(Number(safeLog.calories) || 0);

  // 2. Serving line and optional gram weight for subtitle + nutrition panel.
  const weightInGrams = readWeightInGrams(safeLog);
  const servingLine = buildServingLine(safeLog, amountDisplay, weightInGrams);

  // 3. Clean title/brand (strips noisy API prefixes when readableFoodTitle can).
  // vocab: readableFoodTitle = strips “via Google search” / retailer noise from name+brand
  const brandRaw = brandRawFromLog(safeLog);
  const cleanedTitle = readableFoodTitle({
    name: foodNameFromLog(safeLog),
    brand: brandRaw,
    source: sourceKeyFromLog(safeLog),
  });
  const foodName = cleanedTitle.name;
  const brandName = cleanedTitle.brand;
  const foodIsVerified = foodLooksVerified(safeLog);

  let weightGValue = null;
  if (Number.isFinite(weightInGrams)) {
    weightGValue = weightInGrams;
  }

  // 4. Bundle everything FoodCard reads (keys frozen — do not rename export fields).
  return {
    name: foodName,
    verified: foodIsVerified,
    brand: brandName,
    serving: servingLine,
    weightG: weightGValue,
    subtitle: buildSubtitleLine(brandName, servingLine, weightInGrams),
    calories: caloriesRounded,
    carbs: carbsGrams,
    protein: proteinGrams,
    fat: fatGrams,
    macroPercents: macroCaloriePercents(carbsGrams, proteinGrams, fatGrams, caloriesRounded),
    micronutrients: buildMicronutrients(safeLog),
    source: formatSourceLabel(safeLog),
  };
}

// Manipulate here: static demo row for design previews and empty states — keys match foodCardText().
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
