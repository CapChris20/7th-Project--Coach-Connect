const { normalizeMacros } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { searchFoodsFatSecret, fatSecretConfigured } = require('../../fatSecretClient');
const { rankFatSecretFoods, wrapScraperResult } = require('../resolveFoodDetail');

async function scrapeFatSecret(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  if (!fatSecretConfigured()) return null;
  const foods = await searchFoodsFatSecret(query, 8);
  const ranked = rankFatSecretFoods(foods, query, null);
  const hit = ranked?.[0];
  if (!hit) return null;

  const foodId = hit.fatsecretFoodId || hit.id?.replace(/^fs_/, '');
  const url = foodId
    ? `https://www.fatsecret.com/calories-nutrition/search?q=${encodeURIComponent(query)}`
    : null;

  return wrapScraperResult(
    normalizeMacros({
      calories: hit.calories ?? hit.nf_calories,
      protein_g: hit.protein ?? hit.nf_protein,
      carbs_g: hit.carbs ?? hit.nf_total_carbohydrate,
      fat_g: hit.fat ?? hit.nf_total_fat,
      fiber_g: hit.fiber,
      sodium_mg: hit.sodium,
      sugar_g: hit.sugar,
    }),
    {
      url,
      displayName: hit.food_name || hit.name,
      servingLabel: hit.serving_label || hit.serving_unit || '1 serving',
      servingBasis: 'per_serving',
    },
  );
}

module.exports = { scrapeFatSecret };
