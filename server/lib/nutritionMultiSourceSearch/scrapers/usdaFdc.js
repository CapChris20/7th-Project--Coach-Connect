const { fetchJson, normalizeMacros } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { isRestaurantMenuQuery, wrapScraperResult } = require('../resolveFoodDetail');

function mapUsdaFood(food) {
  if (!food) return null;
  const nutrients = food.foodNutrients || [];
  const get = (...ids) => {
    for (const id of ids) {
      const hit = nutrients.find((n) => n.nutrientId === id);
      if (hit?.value != null && Number.isFinite(Number(hit.value))) return Number(hit.value);
    }
    return null;
  };

  return normalizeMacros({
    calories: get(1008),
    protein_g: get(1003),
    carbs_g: get(1005),
    fat_g: get(1004),
    fiber_g: get(1079),
    sodium_mg: get(1090, 1093),
  });
}

async function scrapeUsdaFdc(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  if (isRestaurantMenuQuery(query, null)) return null;

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=5&api_key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson(url, timeoutMs, { Accept: 'application/json' });
  const foods = data?.foods || [];
  for (const food of foods) {
    const mapped = mapUsdaFood(food);
    if (mapped?.calories != null) {
      return wrapScraperResult(mapped, {
        url: food.fdcId
          ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}/nutrients`
          : null,
        displayName: food.description || food.lowercaseDescription || null,
        servingLabel: 'per 100g',
        servingBasis: 'per_100g',
      });
    }
  }
  return null;
}

module.exports = { scrapeUsdaFdc, mapUsdaFood };
