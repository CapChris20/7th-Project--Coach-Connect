/**
 * Restaurant nutrition detection, search-query building, and LLM extraction.
 * Used by the server only (Serper + fetch + OpenAI). Client has its own helper that uses cache + this API.
 */

const RESTAURANT_KEYWORDS = [
  'mcdonald',
  'wendy',
  'burger king',
  'chipotle',
  'taco bell',
  'subway',
  'pizza',
  'jets',
  'kfc',
  'popeyes',
];

/**
 * Returns true if query contains known restaurant keywords (case insensitive).
 * @param {string} query
 * @returns {boolean}
 */
function detectRestaurantQuery(query) {
  if (typeof query !== 'string' || !query.trim()) return false;
  const lower = query.toLowerCase().trim();
  return RESTAURANT_KEYWORDS.some((kw) => lower.includes(kw));
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
