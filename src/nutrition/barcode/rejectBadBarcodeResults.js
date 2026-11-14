// Drops barcode hits that are tracker landing pages or empty nutrition guesses.
// Flow: junk title? → missing / not-found sentinel? → trusted DB vs web macro rules.
// Used by: the client scanner and the server barcode lookup.
// Read order: constants → numbered export recipes → module.exports → PLUMBING.

// ===== NAMED CONSTANTS =====

// vocab: these regexes match page titles from barcode lookup sites, not real package names
const JUNK_NAME_PATTERN =
  /barcode tracker|food barcode\b|gs1 us|fooddata central|dietagram|barcodelookup|search by barcode|nutrition infor/i;
const PRODUCT_NUMBER_PATTERN = /^product \d+$/i;
// Manipulate here: diet soda / water can be real foods with every macro at zero
const ZERO_CALORIE_NAME_PATTERN =
  /\b(diet|zero|sugar.?free|unsweetened|water|sparkling|mineral|seltzer)\b/i;

const TRUSTED_SOURCE_NAMES = new Set(['usda', 'fatsecret', 'openfoodfacts']);
const MIN_PACKAGE_NAME_LENGTH = 3;
// Manipulate here: web guesses with no calories need at least this much protein to keep
const MIN_WEB_PROTEIN_GRAMS = 3;

const NOT_FOUND_MESSAGE =
  'This product is not in our food databases yet. Try searching by the name on the package.';
const DEFAULT_SEARCH_QUERIES = ['packaged snack', 'protein bar'];

// ===== HELPER FUNCTIONS =====

/**
 * Package title from either `name` or legacy `food_name`.
 * @param {object|undefined} food
 * @returns {string}
 */
function readDisplayNameFromFoodRow(food) {
  // vocab/symbol: ?. = stop and yield undefined if food is null/undefined
  return String(food?.name || food?.food_name || '').trim();
}

/**
 * Coerce a value to a finite number; anything else becomes 0.
 * @param {unknown} value
 * @returns {number}
 */
function finiteNumberOrZero(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  return 0;
}

/**
 * Calories / protein / carbs / fat from a food row (legacy nf_* keys still count).
 * vocab/symbol: ?? = use the right side only when the left is null or undefined (0 stays 0)
 * @param {object|undefined} food
 * @returns {{ calories: number, protein: number, carbs: number, fat: number }}
 */
function readMacrosFromFoodRow(food) {
  return {
    calories: finiteNumberOrZero(food?.calories ?? food?.nf_calories),
    protein: finiteNumberOrZero(food?.protein ?? food?.nf_protein),
    carbs: finiteNumberOrZero(food?.carbs ?? food?.nf_total_carbohydrate),
    fat: finiteNumberOrZero(food?.fat ?? food?.nf_total_fat),
  };
}

/**
 * True when any macro gram or calorie count is above zero.
 * @param {{ calories: number, protein: number, carbs: number, fat: number }} macros
 * @returns {boolean}
 */
function macrosHaveAnyPositiveValue(macros) {
  if (macros.calories > 0) return true;
  if (macros.protein > 0) return true;
  if (macros.carbs > 0) return true;
  if (macros.fat > 0) return true;
  return false;
}

/**
 * Trusted DB rows: any macro is enough; else allow known zero-cal drink names.
 * @param {string} displayName
 * @param {{ calories: number, protein: number, carbs: number, fat: number }} macros
 * @returns {boolean}
 */
function trustedDatabaseRowIsUsable(displayName, macros) {
  if (macrosHaveAnyPositiveValue(macros)) return true;
  return ZERO_CALORIE_NAME_PATTERN.test(displayName);
}

/**
 * Web guesses need calories or enough protein. Calories with no macros is still junk.
 * @param {{ calories: number, protein: number, carbs: number, fat: number }} macros
 * @returns {boolean}
 */
function webEstimateRowIsUsable(macros) {
  if (!macrosHaveAnyPositiveValue(macros)) return false;

  const hasNoCalories = macros.calories <= 0;
  const proteinBelowWebFloor = macros.protein < MIN_WEB_PROTEIN_GRAMS;
  if (hasNoCalories && proteinBelowWebFloor) return false;

  const macroGramsTotal = macros.protein + macros.carbs + macros.fat;
  const hasCaloriesButNoMacroGrams = macros.calories > 0 && macroGramsTotal <= 0;
  if (hasCaloriesButNoMacroGrams) return false;

  return true;
}

// ===== MAIN FUNCTION =====

/**
 * True when the product title is a database landing page, not real food.
 * @param {string} name
 * @returns {boolean}
 */
function isBarcodeJunkName(name) {
  const cleanedName = String(name || '').trim();

  // 1. Empty or too short to be a real package name.
  if (!cleanedName || cleanedName.length < MIN_PACKAGE_NAME_LENGTH) return true;

  // 2. Known tracker / lookup page phrases.
  if (JUNK_NAME_PATTERN.test(cleanedName)) return true;

  // 3. Generic "Product 12345" placeholders.
  if (PRODUCT_NUMBER_PATTERN.test(cleanedName)) return true;

  return false;
}

/**
 * Whether a barcode row is safe to show in the log (not junk, not an empty guess).
 * @param {object|undefined} food
 * @returns {boolean}
 */
function isUsableBarcodeFood(food) {
  // 1. Missing row, or an explicit not-found / variable-weight sentinel.
  if (!food || food.notFound || food.variableWeightBarcode) return false;

  const displayName = readDisplayNameFromFoodRow(food);

  // 2. Title looks like a tracker page — refuse it.
  if (isBarcodeJunkName(displayName)) return false;

  const macros = readMacrosFromFoodRow(food);
  const sourceName = String(food.source || '').toLowerCase();

  // 3. USDA / FatSecret / Open Food Facts — allow zero-cal drinks when the name matches.
  if (TRUSTED_SOURCE_NAMES.has(sourceName)) {
    return trustedDatabaseRowIsUsable(displayName, macros);
  }

  // 4. Serper / mixed / other web — need a real macro signal.
  return webEstimateRowIsUsable(macros);
}

/**
 * Payload when no database matched the scanned UPC (suggests manual search terms).
 * @param {string} barcode
 * @param {string[]} [suggestedSearchQueries]
 * @returns {object}
 */
function barcodeNotFoundPayload(barcode, suggestedSearchQueries = []) {
  // 1. Prefer caller-provided search hints; otherwise use the packaged defaults.
  const hasCallerQueries = suggestedSearchQueries.length > 0;
  const queries = hasCallerQueries ? suggestedSearchQueries : DEFAULT_SEARCH_QUERIES;

  // 2. Same door shape callers already read: notFound + message + queries + scannedBarcode.
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
  // Export key stays `rowMacros` — other files import that name.
  rowMacros: readMacrosFromFoodRow,
};

