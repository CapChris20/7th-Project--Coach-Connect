const { fetchJson, normalizeMacros } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { isRestaurantMenuQuery, wrapScraperResult } = require('../resolveFoodDetail');
const { createCandidate, assertCandidate } = require('../../../../src/nutrition/food-match/candidate');
const {
  completenessFromMacros,
  per100FromMacros,
  servingFromMacros,
} = require('../../../../src/nutrition/food-match/adapters/macroHelpers');

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
    sugar_g: get(2000),
  });
}

function usdaNutrient(food, ...ids) {
  const nutrients = food?.foodNutrients || [];
  for (const id of ids) {
    const hit = nutrients.find((row) => row.nutrientId === id);
    if (hit?.value != null && Number.isFinite(Number(hit.value))) return Number(hit.value);
  }
  return null;
}

/**
 * Candidate adapter for a raw USDA FDC search hit.
 * Keeps description / brandOwner RAW.
 * @param {object} food
 * @param {{ fetchedAt?: string|null }} [opts]
 * @returns {object|null}
 */
function adaptUsdaFood(food, opts = {}) {
  if (!food || typeof food !== 'object') return null;

  // 1. Raw name/brand from FDC fields.
  const name = String(food.description || food.lowercaseDescription || '').trim();
  if (!name) return null;
  const brand = String(food.brandOwner || food.brandName || '').trim();
  const fdcId = food.fdcId != null ? String(food.fdcId) : null;
  const gtin = String(food.gtinUpc || '').replace(/\D/g, '') || null;

  // 2. FDC branded search nutrients are per 100 g/ml.
  const macros = {
    kcal: usdaNutrient(food, 1008),
    protein: usdaNutrient(food, 1003),
    carbs: usdaNutrient(food, 1005),
    fat: usdaNutrient(food, 1004),
  };
  const unitRaw = String(food.servingSizeUnit || 'g').toLowerCase();
  const basis = unitRaw === 'ml' || unitRaw === 'mlt' || unitRaw === 'milliliters' ? 'ml' : 'g';
  const per100 = per100FromMacros(macros, basis);

  const servings = [];
  const servingGrams = Number(food.servingSize);
  if (Number.isFinite(servingGrams) && servingGrams > 0) {
    const scale = servingGrams / 100;
    servings.push(servingFromMacros({
      label: String(food.householdServingFullText || `${Math.round(servingGrams)} ${basis}`),
      grams: servingGrams,
      kcal: macros.kcal == null ? null : macros.kcal * scale,
      protein: macros.protein == null ? null : macros.protein * scale,
      carbs: macros.carbs == null ? null : macros.carbs * scale,
      fat: macros.fat == null ? null : macros.fat * scale,
      origin: 'label',
    }));
  }

  const categoryPath = [];
  if (food.foodCategory) categoryPath.push(String(food.foodCategory));
  if (food.dataType) categoryPath.push(String(food.dataType));

  const candidate = createCandidate({
    id: fdcId ? `usdaFdc:${fdcId}` : `usdaFdc:${name}`,
    source: 'usdaFdc',
    name,
    brand,
    categoryPath,
    channel: brand ? 'packaged' : 'generic',
    gtin,
    per100,
    servings,
    quality: {
      completeness: completenessFromMacros(macros),
      sourceFlags: food.dataType ? [String(food.dataType)] : [],
    },
    provenance: {
      url: fdcId
        ? `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${fdcId}/nutrients`
        : null,
      fetchedAt: opts.fetchedAt || null,
    },
  });
  return assertCandidate(candidate);
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

module.exports = { scrapeUsdaFdc, mapUsdaFood, adaptUsdaFood };
