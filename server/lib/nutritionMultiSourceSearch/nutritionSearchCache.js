/** 24-hour in-memory cache for nutrition search results. */
const { CACHE_TTL_MS } = require('./constants');

const cache = new Map();
const MAX_ENTRIES = 500;

function buildCacheKey(foodName, restaurant) {
  const food = String(foodName || '').trim().toLowerCase();
  const place = String(restaurant || '').trim().toLowerCase();
  return `v3::${food}::${place}`;
}

function pruneCache() {
  if (cache.size <= MAX_ENTRIES) return;
  const overflow = cache.size - MAX_ENTRIES;
  const keys = cache.keys();
  for (let i = 0; i < overflow; i += 1) {
    const { value: key } = keys.next();
    if (key) cache.delete(key);
  }
}

function getCachedNutritionSearch(foodName, restaurant) {
  const key = buildCacheKey(foodName, restaurant);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return { ...entry.payload, cacheHit: true };
}

function setCachedNutritionSearch(foodName, restaurant, payload) {
  const key = buildCacheKey(foodName, restaurant);
  cache.set(key, { timestamp: Date.now(), payload: { ...payload, cacheHit: false } });
  pruneCache();
}

function clearNutritionSearchCache() {
  cache.clear();
}

module.exports = {
  buildCacheKey,
  getCachedNutritionSearch,
  setCachedNutritionSearch,
  clearNutritionSearchCache,
};
