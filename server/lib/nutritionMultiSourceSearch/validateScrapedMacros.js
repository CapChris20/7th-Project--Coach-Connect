/** Plausibility guards for scraped / aggregated nutrition macros. */
const { isMenuStyleQuery } = require('../../../src/nutrition/food-search/sortBestFoodMatches');
const { isPlausibleRestaurantNutritionRow } = require('../../../src/nutrition/food-search/isReliableRestaurantFood');

function toMacroShape(macros) {
  return {
    calories: Number(macros?.calories) || 0,
    protein: Number(macros?.protein_g ?? macros?.protein) || 0,
    carbs: Number(macros?.carbs_g ?? macros?.carbs) || 0,
    fat: Number(macros?.fat_g ?? macros?.fat) || 0,
  };
}

function validateScrapedMacros(macros, query = '') {
  if (!macros || macros.calories == null) return false;

  const shaped = toMacroShape(macros);
  if (!isPlausibleRestaurantNutritionRow(shaped)) return false;

  const q = String(query || '').toLowerCase();
  const cal = shaped.calories;

  if (/\b\d+\s*pc\b/.test(q) && cal < 250) return false;
  if (/\b(nugget|wings?|combo|meal|pizza|burrito|bowl|burger|footlong)\b/.test(q) && cal < 120) {
    return false;
  }
  if (isMenuStyleQuery(q) && cal < 80) return false;

  return true;
}

function isHighConfidenceConsensus(consensus, { fallbackUsed = false } = {}) {
  if (fallbackUsed) return false;
  const cal = consensus?.calories;
  if (!cal || cal.value == null) return false;
  if ((cal.sources_agreeing || 0) < 2) return false;
  return validateScrapedMacros(
    {
      calories: cal.value,
      protein_g: consensus.protein_g?.value,
      carbs_g: consensus.carbs_g?.value,
      fat_g: consensus.fat_g?.value,
    },
    '',
  );
}

module.exports = {
  validateScrapedMacros,
  isHighConfidenceConsensus,
  toMacroShape,
};
