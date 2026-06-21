/**
 * Restaurant / menu-style nutrition detection and search-query building.
 * Used by the server only (Serper + fetch + OpenAI). Client has its own helper that uses cache + this API.
 */

const { isMenuStyleQuery } = require('../../src/nutrition/food-search/sortBestFoodMatches');

/**
 * True when the query looks like a restaurant menu item (generic heuristics, no brand list).
 * @param {string} query
 * @returns {boolean}
 */
function detectRestaurantQuery(query) {
  return isMenuStyleQuery(query);
}

/**
 * Returns search string: "${query} nutrition calories protein carbs fat".
 * @param {string} query
 * @returns {string}
 */
function buildRestaurantSearchQuery(query) {
  if (typeof query !== 'string') return 'nutrition calories protein carbs fat';
  const q = query.trim();
  if (!q) return 'nutrition calories protein carbs fat';
  return `${q} nutrition calories protein carbs fat`;
}

module.exports = {
  detectRestaurantQuery,
  buildRestaurantSearchQuery,
};
