// Rejects barcode hits that are tracker pages or empty nutrition guesses.
// Flow: drop junk names → trust USDA, FatSecret, and Open Food Facts → require macros from the web.
// Used by the client scanner and the server barcode lookup.

// ===== NAMED CONSTANTS =====

const JUNK_NAME_PATTERN =
  /barcode tracker|food barcode\b|gs1 us|fooddata central|dietagram|barcodelookup|search by barcode|nutrition infor/i;
const PRODUCT_NUMBER_PATTERN = /^product \d+$/i;
const ZERO_CALORIE_NAME_PATTERN =
  /\b(diet|zero|sugar.?free|unsweetened|water|sparkling|mineral|seltzer)\b/i;

const TRUSTED_SOURCES = new Set(['usda', 'fatsecret', 'openfoodfacts']);
const MIN_NAME_LENGTH = 3;
const MIN_WEB_PROTEIN = 3;

const NOT_FOUND_MESSAGE =
  'This product is not in our food databases yet. Try searching by the name on the package.';
const DEFAULT_SEARCH_QUERIES = ['packaged snack', 'protein bar'];

// ===== HELPER FUNCTIONS =====

/**
 * @param {unknown} value
 * @returns {number}
 */
function finiteNumber(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  return 0;
}

/**
 * @param {object|undefined} food
 * @returns {string}
 */
function foodName(food) {
  return String(food?.name || food?.food_name || '').trim();
}

/**
 * @param {object|undefined} food
 * @returns {{ calories: number, protein: number, carbs: number, fat: number }}
 */
function rowMacros(food) {
  return {
    calories: finiteNumber(food?.calories ?? food?.nf_calories),
    protein: finiteNumber(food?.protein ?? food?.nf_protein),
    carbs: finiteNumber(food?.carbs ?? food?.nf_total_carbohydrate),
    fat: finiteNumber(food?.fat ?? food?.nf_total_fat),
  };
}

/**
 * @param {{ calories: number, protein: number, carbs: number, fat: number }} macros
 * @returns {boolean}
 */
function hasAnyMacro(macros) {
  return macros.calories > 0 || macros.protein > 0 || macros.carbs > 0 || macros.fat > 0;
}

/**
 * Diet soda and water are real foods even when every macro is zero.
 * @param {string} name
 * @param {object} macros
 * @returns {boolean}
 */
function isTrustedSourceUsable(name, macros) {
  if (hasAnyMacro(macros)) return true;
  return ZERO_CALORIE_NAME_PATTERN.test(name);
}

/**
 * Web guesses need calories or enough protein. A calorie count with no macros is still junk.
 * @param {object} macros
 * @returns {boolean}
 */
function isWebEstimateUsable(macros) {
  if (!hasAnyMacro(macros)) return false;
  if (macros.calories <= 0 && macros.protein < MIN_WEB_PROTEIN) return false;
  if (macros.calories > 0 && macros.protein + macros.carbs + macros.fat <= 0) return false;
  return true;
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} name
 * @returns {boolean}
 */
function isBarcodeJunkName(name) {
  const cleanedName = String(name || '').trim();
  if (!cleanedName || cleanedName.length < MIN_NAME_LENGTH) return true;
  if (JUNK_NAME_PATTERN.test(cleanedName)) return true;
  if (PRODUCT_NUMBER_PATTERN.test(cleanedName)) return true;
  return false;
}

/**
 * @param {object|undefined} food
 * @returns {boolean}
 */
function isUsableBarcodeFood(food) {
  if (!food || food.notFound || food.variableWeightBarcode) return false;

  const name = foodName(food);
  if (isBarcodeJunkName(name)) return false;

  const macros = rowMacros(food);
  const sourceName = String(food.source || '').toLowerCase();
  if (TRUSTED_SOURCES.has(sourceName)) return isTrustedSourceUsable(name, macros);
  return isWebEstimateUsable(macros);
}

/**
 * @param {string} barcode
 * @param {string[]} [suggestedSearchQueries]
 * @returns {object}
 */
function barcodeNotFoundPayload(barcode, suggestedSearchQueries = []) {
  const queries = suggestedSearchQueries.length ? suggestedSearchQueries : DEFAULT_SEARCH_QUERIES;
  return {
    notFound: true,
    message: NOT_FOUND_MESSAGE,
    suggestedSearchQueries: queries,
    scannedBarcode: String(barcode || '').trim(),
  };
}

module.exports = {
  isBarcodeJunkName,
  isUsableBarcodeFood,
  barcodeNotFoundPayload,
  rowMacros,
};
