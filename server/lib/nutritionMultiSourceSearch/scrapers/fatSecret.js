const { normalizeMacros } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS } = require('../constants');
const { searchFoodsFatSecret, fatSecretConfigured } = require('../../fatSecretClient');
const { rankFatSecretFoods, wrapScraperResult } = require('../resolveFoodDetail');
const { createCandidate, assertCandidate } = require('../../../../src/nutrition/food-match/candidate');
const {
  completenessFromMacros,
  servingFromMacros,
} = require('../../../../src/nutrition/food-match/adapters/macroHelpers');

/**
 * Candidate adapter for a raw FatSecret search hit.
 * Keeps food_name / brand_name RAW.
 * @param {object} hit
 * @param {{ fetchedAt?: string|null, query?: string }} [opts]
 * @returns {object|null}
 */
function adaptFatSecretFood(hit, opts = {}) {
  if (!hit || typeof hit !== 'object') return null;

  // 1. Raw name/brand from FatSecret fields.
  const name = String(hit.food_name || hit.name || '').trim();
  if (!name) return null;
  const brand = String(hit.brand_name || hit.brand || '').trim();
  const foodId = hit.fatsecretFoodId || String(hit.id || '').replace(/^fs_/, '') || null;

  const macros = {
    kcal: hit.calories ?? hit.nf_calories ?? null,
    protein: hit.protein ?? hit.nf_protein ?? null,
    carbs: hit.carbs ?? hit.nf_total_carbohydrate ?? null,
    fat: hit.fat ?? hit.nf_total_fat ?? null,
  };

  // FatSecret search rows are per listed serving, not per 100 g.
  const servings = [
    servingFromMacros({
      label: hit.serving_label || hit.serving_unit || '1 serving',
      grams: hit.servingGrams ?? hit.serving_grams ?? null,
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      origin: 'label',
    }),
  ];

  const channel = brand ? 'packaged' : 'unknown';
  const query = opts.query ? encodeURIComponent(opts.query) : '';

  const candidate = createCandidate({
    id: foodId ? `fatSecret:${foodId}` : `fatSecret:${name}`,
    source: 'fatSecret',
    name,
    brand,
    categoryPath: hit.food_type ? [String(hit.food_type)] : [],
    channel,
    gtin: hit.gtin || hit.barcode || null,
    per100: null,
    servings,
    quality: {
      completeness: completenessFromMacros(macros),
      sourceFlags: [],
    },
    provenance: {
      url: query
        ? `https://www.fatsecret.com/calories-nutrition/search?q=${query}`
        : null,
      fetchedAt: opts.fetchedAt || null,
    },
  });
  return assertCandidate(candidate);
}

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

module.exports = { scrapeFatSecret, adaptFatSecretFood };
