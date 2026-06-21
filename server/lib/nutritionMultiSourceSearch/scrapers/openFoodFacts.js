const { fetchJson, normalizeMacros, parseNumber } = require('../scrapeHelpers');
const { SCRAPE_TIMEOUT_MS, USER_AGENT } = require('../constants');
const { wrapScraperResult } = require('../resolveFoodDetail');

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
  });
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

module.exports = { scrapeOpenFoodFacts, mapOffProduct };
