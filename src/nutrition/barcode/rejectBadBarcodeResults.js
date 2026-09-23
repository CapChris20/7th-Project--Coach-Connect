/**
 * Reject junk barcode hits (GS1 tracker pages, zero-macro Serper guesses, etc.)
 * Shared by client scanner + server /api/food/barcode.
 */

const JUNK_NAME_RE =
  /barcode tracker|food barcode\b|gs1 us|fooddata central|dietagram|barcodelookup|search by barcode|nutrition infor/i;

const TRUSTED_SOURCES = new Set(['usda', 'fatsecret', 'openfoodfacts']);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function foodName(food) {
  return String(food?.name || food?.food_name || '').trim();
}

function isBarcodeJunkName(name) {
  const n = String(name || '').trim();
  if (!n || n.length < 3) return true;
  if (JUNK_NAME_RE.test(n)) return true;
  if (/^product \d+$/i.test(n)) return true;
  return false;
}

function rowMacros(food) {
  return {
    calories: num(food?.calories ?? food?.nf_calories),
    protein: num(food?.protein ?? food?.nf_protein),
    carbs: num(food?.carbs ?? food?.nf_total_carbohydrate),
    fat: num(food?.fat ?? food?.nf_total_fat),
  };
}

/** @returns {boolean} true when safe to show on Confirm & log */
function isUsableBarcodeFood(food) {
  if (!food || food.notFound || food.variableWeightBarcode) return false;

  const name = foodName(food);
  if (isBarcodeJunkName(name)) return false;

  const { calories, protein, carbs, fat } = rowMacros(food);
  const hasMacros = calories > 0 || protein > 0 || carbs > 0 || fat > 0;
  const source = String(food.source || '').toLowerCase();

  if (TRUSTED_SOURCES.has(source)) {
    // Diet soda / zero-cal water still valid from USDA/OFF/FatSecret
    if (hasMacros) return true;
    return /\b(diet|zero|sugar.?free|unsweetened|water|sparkling|mineral|seltzer)\b/i.test(name);
  }

  // Web / Serper estimates — require real nutrition signal
  if (!hasMacros) return false;
  if (calories <= 0 && protein < 3) return false;
  if (calories > 0 && protein + carbs + fat <= 0) return false;

  return true;
}

function barcodeNotFoundPayload(barcode, suggestedSearchQueries = []) {
  return {
    notFound: true,
    message:
      'This product is not in our food databases yet. Try searching by the name on the package.',
    suggestedSearchQueries: suggestedSearchQueries.length
      ? suggestedSearchQueries
      : ['packaged snack', 'protein bar'],
    scannedBarcode: String(barcode || '').trim(),
  };
}

module.exports = {
  isBarcodeJunkName,
  isUsableBarcodeFood,
  barcodeNotFoundPayload,
  rowMacros,
};
