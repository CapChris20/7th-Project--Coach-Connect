const { fetchJson, normalizeMacros, parseNumber } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS, USER_AGENT } = require('../constants');
const { wrapScraperResult } = require('../resolveFoodDetail');
const { createCandidate, assertCandidate } = require('../../../../src/nutrition/food-match/candidate');
const {
  finiteOrNull,
  completenessFromMacros,
  per100FromMacros,
  servingFromMacros,
} = require('../../../../src/nutrition/food-match/adapters/macroHelpers');

function mapOffProduct(product) {
  if (!product) return null;
  const n = product.nutriments || {};
  const calories =
    parseNumber(n['energy-kcal_serving']) ??
    parseNumber(n['energy-kcal']) ??
    (parseNumber(n.energy) != null ? parseNumber(n.energy) / 4.184 : null);

  const sodiumRaw = parseNumber(n['sodium_serving'] ?? n.sodium);
  const sodium_mg =
    parseNumber(n['sodium_mg']) ??
    (sodiumRaw != null && sodiumRaw < 50 ? sodiumRaw * 1000 : sodiumRaw);

  return normalizeMacros({
    calories,
    protein_g: parseNumber(n.proteins_serving ?? n.proteins),
    carbs_g: parseNumber(n.carbohydrates_serving ?? n.carbohydrates),
    fat_g: parseNumber(n.fat_serving ?? n.fat),
    fiber_g: parseNumber(n.fiber_serving ?? n.fiber),
    sodium_mg,
    sugar_g: parseNumber(n.sugars_serving ?? n.sugars),
  });
}

/**
 * Candidate adapter for a raw Open Food Facts product.
 * Keeps product_name / brands RAW — no title tidy.
 * @param {object} product
 * @param {{ fetchedAt?: string|null }} [opts]
 * @returns {object|null}
 */
function adaptOpenFoodFactsProduct(product, opts = {}) {
  if (!product || typeof product !== 'object') return null;

  // 1. Raw name + brand from the source fields only.
  const name = String(product.product_name || product.product_name_en || product.food_name || '').trim();
  if (!name) return null;
  const brand = String(product.brands || product.brand || '').trim();
  const code = String(product.code || product._id || '').replace(/\D/g, '') || null;
  const nutrients = product.nutriments || {};

  // 2. Prefer explicit per-100g when OFF published it; else serving macros.
  const per100 = per100FromMacros({
    kcal: nutrients['energy-kcal_100g'],
    protein: nutrients.proteins_100g,
    carbs: nutrients.carbohydrates_100g,
    fat: nutrients.fat_100g,
  }, 'g');

  const servings = [];
  if (nHasServing(product) || product.serving_size) {
    servings.push(servingFromMacros({
      label: product.serving_size || '1 serving',
      kcal: nutrients['energy-kcal_serving'] ?? nutrients['energy-kcal'],
      protein: nutrients.proteins_serving ?? nutrients.proteins,
      carbs: nutrients.carbohydrates_serving ?? nutrients.carbohydrates,
      fat: nutrients.fat_serving ?? nutrients.fat,
      origin: 'label',
    }));
  }

  // 3. Quality flags come from OFF's own tags — no invented scores.
  const states = Array.isArray(product.states_tags) ? product.states_tags.map(String) : [];
  const qualityErrors = Array.isArray(product.data_quality_errors_tags)
    ? product.data_quality_errors_tags.map(String)
    : [];
  const sourceFlags = [...states, ...qualityErrors];
  const macrosForCompleteness = per100 || {
    kcal: finiteOrNull(nutrients['energy-kcal_serving'] ?? nutrients['energy-kcal']),
    protein: finiteOrNull(nutrients.proteins_serving ?? nutrients.proteins),
    carbs: finiteOrNull(nutrients.carbohydrates_serving ?? nutrients.carbohydrates),
    fat: finiteOrNull(nutrients.fat_serving ?? nutrients.fat),
  };

  const candidate = createCandidate({
    id: code ? `openFoodFacts:${code}` : `openFoodFacts:${name}`,
    source: 'openFoodFacts',
    name,
    brand,
    categoryPath: Array.isArray(product.categories_tags) ? product.categories_tags.map(String) : [],
    channel: brand ? 'packaged' : 'unknown',
    gtin: code,
    per100,
    servings,
    quality: {
      completeness: completenessFromMacros(macrosForCompleteness),
      sourceFlags,
    },
    provenance: {
      url: code ? `https://world.openfoodfacts.org/product/${code}` : null,
      fetchedAt: opts.fetchedAt || null,
    },
  });
  return assertCandidate(candidate);
}

async function scrapeOpenFoodFacts(query, timeoutMs = SCRAPE_TIMEOUT_MS) {
  const q = encodeURIComponent(query);
  const headers = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

  let data = await fetchJson(
    `https://search.openfoodfacts.org/search?search_terms=${q}&page_size=5&json=1`,
    timeoutMs,
    headers,
  );

  if (!data?.products?.length) {
    data = await fetchJson(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=5`,
      timeoutMs,
      headers,
    );
  }

  const products = data?.products || [];
  for (const product of products) {
    const mapped = mapOffProduct(product);
    if (mapped?.calories != null) {
      const code = product.code || product._id;
      return wrapScraperResult(mapped, {
        url: code ? `https://world.openfoodfacts.org/product/${code}` : null,
        displayName: product.product_name || product.food_name || null,
        servingLabel: product.serving_size || 'per serving',
        servingBasis: nHasServing(product) ? 'per_serving' : 'per_100g',
      });
    }
  }
  return null;
}

function nHasServing(product) {
  const n = product?.nutriments || {};
  return (
    n['energy-kcal_serving'] != null ||
    n.proteins_serving != null ||
    n.carbohydrates_serving != null
  );
}

module.exports = { scrapeOpenFoodFacts, mapOffProduct, adaptOpenFoodFactsProduct };
