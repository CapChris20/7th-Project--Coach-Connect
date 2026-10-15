// searchFoods.js
//
// **Backend (data only)** — finds foods for the nutrition log: typed search, barcode lookup, and cache.
// Flow: check phone cache → famous menu shortcuts (Big Mac, etc.) → Coach Connect API → Open Food Facts fallback.
//
// Read order: named constants → **searchFoods / lookupBarcode** (Step 1–6 below) → PLUMBING helpers.
// Used by Food Search, barcode scan, and daily meal logging. No UI in this file.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getResilientApiBases } from '../../for-both/online-connection/whereToConnect';
import { getApiAuthHeaders } from '../../for-both/online-connection/attachLoginProof';
import logger from '../../for-both/online-connection/sendCrashReport';

const {
  isMenuStyleQuery,
  filterFoodSearchRows,
} = require('../food-search/rankFoodResults');
const { findConsumerBrandInQuery } = require('../food-details/tidyBrandName');
const {
  parseNutritionSearchQuery,
  mapNutritionSearchToFoodRows,
  mergeNutritionSearchWithLegacy,
  keepCloseMacroRows,
  enrichSearchRowMicros,
} = require('./combineFoodSources');
const { applyFoodCardPresentationToRows } = require('./tidyFoodTitles');
const { lookupTrustedFoods } = require('./knownRestaurantFoods');
const { normalizeOpenFoodFactsProduct } = require('../food-details/fixPackageAmounts');

// ===== NAMED CONSTANTS =====

const OPEN_FOOD_FACTS_USER_AGENT =
  'CoachConnect/1.0 (Mobile; https://github.com/coachconnect; contact: support@coachconnect.app)';

export const FOOD_SEARCH_OFFLINE_HINT =
  "Could not reach the food search server. Check your internet connection and try again.";

const OPEN_FOOD_FACTS_SEARCH_API = 'https://search.openfoodfacts.org';
const SAL_SEARCH_FIELDS = 'code,product_name,product_name_en,brands,nutriments';
const OFF_SEARCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': OPEN_FOOD_FACTS_USER_AGENT,
};

const FOOD_SERVER_FETCH_TIMEOUT_MS = 10000;
const NUTRITION_CONSENSUS_FETCH_TIMEOUT_MS = 28000;
const OFF_FETCH_TIMEOUT_MS = 12000;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const CACHE_MINUTES = 5;
const CACHE_TIMEOUT_MS = CACHE_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;
const MG_PER_GRAM = 1000;
const KJ_PER_KCAL = 4.184;
const OFF_PAGE_SIZE_MAX = 24;
const DEFAULT_SEARCH_LIMIT = 20;
const UPC_A_LENGTH = 12;
const UPC_E_PAD_FROM = 11;
const HTTP_NOT_FOUND = 404;
const HTTP_SERVICE_UNAVAILABLE = 503;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_TOO_MANY = 429;
const HTTP_SERVER_ERROR = 500;
const FILTERED_CARD_CAP = 8;
const CLOSE_MACRO_CAP = 5;
const TRUSTED_SEED_LIMIT = 2;
const TRUSTED_ONLY_CAP = 3;
const FOOD_CACHE_STORAGE_KEY = 'COACHCONNECT_FOOD_CACHE';
const SEARCH_CACHE_PREFIX = 'search_v51_';
const BARCODE_CACHE_PREFIX = 'barcode_v8_';

const MENU_EMPTY_HINT =
  'No matching menu item found. Include the restaurant and item (e.g. "Chipotle chicken bowl").';
const MENU_SERVER_HINT =
  'No results yet. Make sure the app can reach your Coach Connect API (Serper/USDA run on the server, not in the app).';
const SERVER_DOWN_HINT =
  'Food search server unavailable. Restaurant and brand searches need the server — try again shortly.';
const SIGN_IN_HINT = 'Sign in to search foods on the server.';
const MISSING_API_HINT = 'Set EXPO_PUBLIC_API_BASE_URL to your Coach Connect API (Cloud Run URL).';

// Module state — in-memory search cache and the last error hint shown on the search screen.
const foodSearchCache = new Map();
let lastSearchHint = null;
let cachedServerUrl = null;

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless food search, barcode, or server fallback is wrong in production.

// Shapes raw nutrition rows into the food cards the search screen shows.
function presentSearchResults(rows, query) {
  const enriched = (Array.isArray(rows) ? rows : []).map(enrichSearchRowMicros);
  return applyFoodCardPresentationToRows(enriched, query);
}

// The Coach Connect API address the phone should call (no trailing slash).
function getServerUrl() {
  return String(getResilientApiBases()[0] || '').replace(/\/$/, '');
}

// Same API address, remembered after the first lookup so we do not recompute it every search.
function getServerUrlCached() {
  if (cachedServerUrl == null) cachedServerUrl = getServerUrl();
  return cachedServerUrl;
}

// True when an API address is actually set. False means we can only search offline.
function hasUsableServerUrl() {
  const serverUrl = getServerUrlCached();
  return !!serverUrl && serverUrl !== 'null' && serverUrl !== 'undefined';
}

// Turns one Open Food Facts product into a food row (name, calories, protein, and the rest).
function mapOffProductToRow(product, limitIndex) {
  const normalized = normalizeOpenFoodFactsProduct(product);
  if (normalized) return normalized;
  const nutriments = product.nutriments || {};
  const kcalFromKj =
    nutriments.energy_100g != null ? Math.round(Number(nutriments.energy_100g) / KJ_PER_KCAL) : 0;
  const kcal = nutriments['energy-kcal_100g'] ?? kcalFromKj;
  return {
    id: product.code || `off_${Date.now()}_${limitIndex}`,
    name: product.product_name,
    brand: product.brands || null,
    restaurant: null,
    calories: kcal,
    protein: nutriments.proteins_100g ?? 0,
    carbs: nutriments.carbohydrates_100g ?? 0,
    fat: nutriments.fat_100g ?? 0,
    fiber: nutriments.fiber_100g ?? null,
    sodium: nutriments.sodium_100g ? nutriments.sodium_100g * MG_PER_GRAM : null,
    sugar: nutriments.sugars_100g ?? null,
    servingSize: 1,
    servingUnit: 'grams',
    servingGrams: 100,
    source: 'openfoodfacts',
  };
}

// True when an Open Food Facts product has a name and at least some calorie or macro numbers.
function productHasMinimumNutrition(product) {
  if (!product?.product_name) return false;
  const nutriments = product.nutriments || {};
  return (
    nutriments['energy-kcal_100g'] != null ||
    nutriments.energy_100g != null ||
    nutriments['energy-kcal_serving'] != null ||
    nutriments.proteins_100g != null ||
    nutriments.proteins_serving != null
  );
}

// Reads a response body as JSON. Returns nothing if the body is HTML or broken JSON.
function parseOffSearchJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

// Turns a list of Open Food Facts products into food rows, dropping ones with no nutrition.
function mapOffProductsToRows(products, limit) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const mapped = products
    .filter(productHasMinimumNutrition)
    .slice(0, limit)
    .map((product, index) => mapOffProductToRow(product, index));

  if (mapped.length > 0) return mapped;

  return products
    .filter((product) => product.product_name && product.nutriments && typeof product.nutriments === 'object')
    .slice(0, limit)
    .map((product, index) => mapOffProductToRow(product, index));
}

// Skips Open Food Facts for restaurant-menu searches (those need our server, not a grocery database).
function shouldSkipOffFallback(query) {
  const typedText = String(query || '').trim();
  if (!typedText) return true;
  return isMenuStyleQuery(typedText);
}

// Keeps only the Open Food Facts hits that actually match what the person typed.
function preferQueryRelevantMatches(query, rows, limit) {
  return filterFoodSearchRows(query, rows, limit);
}

// Makes a couple of spellings of the search text so a quote or extra space does not kill the lookup.
function openFoodFactsQueryVariants(raw) {
  const typedText = String(raw || '').trim();
  if (!typedText) return [];
  const stripped = typedText
    .replace(/[''`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const out = [typedText];
  if (stripped && stripped.toLowerCase() !== typedText.toLowerCase()) out.push(stripped);
  return [...new Set(out)];
}

// Converts one Search-a-licious hit into the same shape as a normal Open Food Facts product.
function salHitToOffStyleProduct(hit) {
  if (!hit || typeof hit !== 'object') return null;
  let brandStr = null;
  if (Array.isArray(hit.brands)) {
    brandStr = hit.brands.filter(Boolean).join(', ') || null;
  } else if (typeof hit.brands === 'string' && hit.brands.trim()) {
    brandStr = hit.brands.trim();
  }
  const name =
    (typeof hit.product_name === 'string' && hit.product_name.trim()) ||
    (typeof hit.product_name_en === 'string' && hit.product_name_en.trim()) ||
    (typeof hit.product_name_fr === 'string' && hit.product_name_fr.trim()) ||
    null;
  if (!name) return null;
  const code = hit.code != null ? String(hit.code) : undefined;
  return {
    code,
    product_name: name,
    brands: brandStr,
    nutriments: hit.nutriments && typeof hit.nutriments === 'object' ? hit.nutriments : {},
  };
}

// vocab: AbortController = cancel a fetch that sat too long. React Native fetch has no timeout option.
async function fetchWithTimeout(url, init = {}, timeoutMs = FOOD_SERVER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Asks Open Food Facts newer search API for packaged foods matching the typed text.
async function searchOpenFoodFactsSearchALicious(query, limit = DEFAULT_SEARCH_LIMIT) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const cleaned = raw.replace(/[+\-&|!(){}\[\]^"~*?:\\]/g, ' ').replace(/\s+/g, ' ').trim() || raw;
  const pageSize = Math.min(Math.max(limit, 1), OFF_PAGE_SIZE_MAX);
  const params = new URLSearchParams({
    q: cleaned,
    page_size: String(pageSize),
    page: '1',
    langs: 'en',
    fields: SAL_SEARCH_FIELDS,
  });
  const url = `${OPEN_FOOD_FACTS_SEARCH_API}/search?${params.toString()}`;
  const res = await fetchWithTimeout(url, { method: 'GET', headers: OFF_SEARCH_HEADERS }, OFF_FETCH_TIMEOUT_MS);
  const text = await res.text();
  if (!res.ok) {
    if (__DEV__) logger.warn('🍔 OFF Search-a-licious HTTP', { status: res.status });
    return [];
  }
  const data = parseOffSearchJson(text);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.errors) && data.errors.length && !Array.isArray(data.hits)) return [];
  const hits = data.hits;
  if (!Array.isArray(hits) || hits.length === 0) return [];
  const products = hits.map(salHitToOffStyleProduct).filter(Boolean);
  return mapOffProductsToRows(products, limit);
}

// Tries one spelling on Search-a-licious and keeps only relevant hits. Empty list on failure.
async function tryOneSalVariant(searchTerms, query, limit) {
  try {
    const salRows = await searchOpenFoodFactsSearchALicious(searchTerms, limit);
    if (salRows.length === 0) return [];
    return preferQueryRelevantMatches(query, salRows, limit);
  } catch (err) {
    if (__DEV__) logger.warn('🍔 OFF Search-a-licious failed', { message: err?.message });
    return [];
  }
}

// Tries each spelling on Search-a-licious until one spelling returns foods.
async function trySalSearchForVariants(query, variants, limit) {
  for (const searchTerms of variants) {
    const rows = await tryOneSalVariant(searchTerms, query, limit);
    if (rows.length > 0) return rows;
  }
  return [];
}

// Asks the older Open Food Facts search with a form POST and returns matching foods.
async function tryOffPostSearch(origin, searchTerms, pageSize, query, limit) {
  const body = new URLSearchParams({
    action: 'process',
    search_terms: searchTerms,
    search_simple: '1',
    json: '1',
    page_size: String(pageSize),
  }).toString();
  const res = await fetchWithTimeout(
    `${origin}/cgi/search.pl`,
    {
      method: 'POST',
      headers: {
        ...OFF_SEARCH_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    },
    OFF_FETCH_TIMEOUT_MS,
  );
  const text = await res.text();
  const data = parseOffSearchJson(text);
  if (!data?.products?.length) return [];
  return preferQueryRelevantMatches(query, mapOffProductsToRows(data.products, limit), limit);
}

// Asks the older Open Food Facts search with a URL GET. Empty if the site returns a web page instead of data.
async function tryOffGetSearch(offUrl, query, limit) {
  const res = await fetchWithTimeout(offUrl, { method: 'GET', headers: OFF_SEARCH_HEADERS }, OFF_FETCH_TIMEOUT_MS);
  const text = await res.text();
  const data = parseOffSearchJson(text);
  if (!data?.products?.length) {
    if (__DEV__ && text.trim().startsWith('<')) {
      logger.warn('🍔 OFF GET returned HTML — trying POST/variants next');
    }
    return [];
  }
  return preferQueryRelevantMatches(query, mapOffProductsToRows(data.products, limit), limit);
}

// One POST attempt. Returns an empty list instead of crashing if that host fails.
async function tryOneOffPost(origin, searchTerms, pageSize, query, limit) {
  try {
    return await tryOffPostSearch(origin, searchTerms, pageSize, query, limit);
  } catch (err) {
    logger.warn('🍔 OFF POST failed', { origin, message: err?.message });
    return [];
  }
}

// One GET attempt. Returns an empty list instead of crashing if that host fails.
async function tryOneOffGet(offUrl, query, limit) {
  try {
    return await tryOffGetSearch(offUrl, query, limit);
  } catch (err) {
    logger.warn('🍔 OFF GET failed', { message: err?.message });
    return [];
  }
}

// Tries the POST search on each Open Food Facts host until one returns foods.
async function tryOffPostsForVariant(hosts, searchTerms, pageSize, query, limit) {
  for (const origin of hosts) {
    const rows = await tryOneOffPost(origin, searchTerms, pageSize, query, limit);
    if (rows.length > 0) return rows;
  }
  return [];
}

// Tries the GET search on each Open Food Facts host until one returns foods.
async function tryOffGetsForVariant(hosts, searchTerms, pageSize, query, limit) {
  const encoded = encodeURIComponent(searchTerms);
  for (const origin of hosts) {
    const offUrl = `${origin}/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${pageSize}`;
    const rows = await tryOneOffGet(offUrl, query, limit);
    if (rows.length > 0) return rows;
  }
  return [];
}

// Offline packaged-food search: newer API first, then the older site, across a few spellings.
async function searchOpenFoodFactsDirect(query, limit = DEFAULT_SEARCH_LIMIT) {
  const pageSize = Math.min(Math.max(limit, 1), OFF_PAGE_SIZE_MAX);
  const variants = openFoodFactsQueryVariants(query);
  if (variants.length === 0) return [];

  const salRows = await trySalSearchForVariants(query, variants, limit);
  if (salRows.length > 0) return salRows;

  const hosts = ['https://world.openfoodfacts.org', 'https://us.openfoodfacts.org'];
  for (const searchTerms of variants) {
    const postRows = await tryOffPostsForVariant(hosts, searchTerms, pageSize, query, limit);
    if (postRows.length > 0) return postRows;
    const getRows = await tryOffGetsForVariant(hosts, searchTerms, pageSize, query, limit);
    if (getRows.length > 0) return getRows;
  }

  return [];
}

// Returns a recent search from memory. Throws it away if it is older than a few minutes.
function getFromCache(key) {
  const entry = foodSearchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TIMEOUT_MS) {
    foodSearchCache.delete(key);
    return null;
  }
  return entry.data;
}

// Remembers a search result in memory with the time it was saved.
function setCache(key, data) {
  foodSearchCache.set(key, { data, timestamp: Date.now() });
}

// Deletes memory-cached searches that are older than a few minutes.
function clearExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of foodSearchCache.entries()) {
    if (now - entry.timestamp > CACHE_TIMEOUT_MS) {
      foodSearchCache.delete(key);
    }
  }
}

// Reads the longer-lived food list saved on the phone (survives closing the app).
async function getCachedFoods() {
  try {
    const cached = await AsyncStorage.getItem(FOOD_CACHE_STORAGE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch (error) {
    logger.error('Error getting cached foods', error);
    return [];
  }
}

// Writes that longer-lived food list back onto the phone.
async function saveCachedFoods(foods) {
  try {
    await AsyncStorage.setItem(FOOD_CACHE_STORAGE_KEY, JSON.stringify(foods));
  } catch (error) {
    logger.error('Error saving cached foods', error);
  }
}

// Wipes both the short memory cache and the saved food list on the phone.
function clearAllCaches() {
  foodSearchCache.clear();
  AsyncStorage.removeItem(FOOD_CACHE_STORAGE_KEY);
}

// The last plain-English hint the search screen should show (sign in, server down, and so on).
function getLastSearchHint() {
  return lastSearchHint || null;
}

// Foods already saved on the phone whose name contains what the person typed.
function cachedFoodsMatchingQuery(cachedFoods, typedText) {
  const needle = typedText.toLowerCase();
  const list = Array.isArray(cachedFoods) ? cachedFoods : [];
  return list.filter((food) => (food?.name || '').toLowerCase().includes(needle));
}

// Loads phone-saved foods and an Open Food Facts search at the same time.
async function loadCachedAndOffRows(typedText, limit) {
  const [cachedFoods, off] = await Promise.all([
    getCachedFoods().catch(() => []),
    shouldSkipOffFallback(typedText) ? Promise.resolve([]) : searchOpenFoodFactsDirect(typedText, limit).catch(() => []),
  ]);
  return { cachedFoods, off };
}

// Foods we can show with no Coach Connect server: saved foods plus Open Food Facts.
async function offlineFoodFallback(query, limit) {
  const typedText = String(query || '').trim();
  const { cachedFoods, off } = await loadCachedAndOffRows(typedText, limit);
  const local = cachedFoodsMatchingQuery(cachedFoods, typedText);
  return [...local, ...off].slice(0, limit);
}

// Picks the message to show when a search comes back with zero foods.
function setEmptySearchHint(typedText, requiredBrand) {
  const menuStyle = isMenuStyleQuery(typedText);
  if (menuStyle && !lastSearchHint) {
    lastSearchHint = MENU_EMPTY_HINT;
    return;
  }
  if (requiredBrand && !lastSearchHint) {
    lastSearchHint = `No ${requiredBrand} products matched. Try scanning the barcode or a shorter name.`;
    return;
  }
  if (menuStyle) {
    lastSearchHint = MENU_SERVER_HINT;
  }
}

// If the server returned nothing, fill the list from the phone cache and Open Food Facts.
async function mergeOfflineWhenServerEmpty(query, limit, serverResults) {
  const typedText = String(query || '').trim();
  const base = Array.isArray(serverResults) ? serverResults : [];
  if (base.length > 0) return base;

  const requiredBrand = findConsumerBrandInQuery(typedText);
  const merged = await offlineFoodFallback(typedText, limit);
  if (merged.length === 0) setEmptySearchHint(typedText, requiredBrand);
  return merged;
}

// Reads the status of the nutrition-consensus call: empty, try another server, or keep going.
function interpretConsensusResponse(res, typedText, base) {
  if (res.status === HTTP_NOT_FOUND || res.status === HTTP_SERVICE_UNAVAILABLE) {
    if (__DEV__) logger.debug('🍔 Nutrition consensus empty', { status: res.status, q: typedText });
    return { done: true, result: null };
  }
  if (!res.ok) {
    if (__DEV__) logger.warn('🍔 Nutrition consensus HTTP', { status: res.status, base });
    return { done: false, result: null };
  }
  return { done: null, result: null };
}

// Turns a successful consensus response into food rows. Null if there are no rows.
async function consensusRowsFromResponse(res, typedText) {
  const data = await res.json();
  const rows = mapNutritionSearchToFoodRows(data, typedText);
  if (rows.length === 0) return null;
  logger.debug('🍔 Nutrition consensus hit', {
    rows: rows.length,
    sources: data.sourceResults?.length || 0,
    consensus: Boolean(data.consensus?.calories),
  });
  return { rows, payload: data };
}

// Asks one API address for the consensus nutrition list. Moves on if that address fails.
async function tryOneConsensusBase(base, typedText, foodName, restaurant, authHeaders) {
  try {
    const res = await fetchWithTimeout(
      `${base}/api/nutrition/search`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ foodName, restaurant }),
      },
      NUTRITION_CONSENSUS_FETCH_TIMEOUT_MS,
    );
    const early = interpretConsensusResponse(res, typedText, base);
    if (early.done === true) return { stop: true, result: null };
    if (early.done === false) return { stop: false, result: null };
    return { stop: true, result: await consensusRowsFromResponse(res, typedText) };
  } catch (err) {
    logger.warn('🍔 Nutrition consensus failed', {
      base,
      message: err?.message || String(err),
      isTimeout: err?.name === 'AbortError',
    });
    return { stop: false, result: null };
  }
}

// Asks our servers for the agreed-on calories and macros for this food name.
async function searchNutritionConsensus(query, authHeaders) {
  const typedText = String(query || '').trim();
  if (!typedText) return null;

  const { foodName, restaurant } = parseNutritionSearchQuery(typedText);
  const bases = getResilientApiBases();

  for (const base of bases) {
    const attempt = await tryOneConsensusBase(base, typedText, foodName, restaurant, authHeaders);
    if (attempt.stop) return attempt.result;
  }

  return null;
}

// True for server replies where we should fall back offline (not signed in, missing, or the server crashed).
function isFallbackHttpStatus(status) {
  return (
    status === HTTP_UNAUTHORIZED ||
    status === HTTP_FORBIDDEN ||
    status === HTTP_NOT_FOUND ||
    status === HTTP_TOO_MANY ||
    status >= HTTP_SERVER_ERROR
  );
}

// Asks one API address for the older food-search list.
async function tryOneLegacyBase(base, typedText, limit, authHeaders) {
  const url = `${base}/api/food/search?query=${encodeURIComponent(typedText)}&limit=${limit}`;
  try {
    logger.debug('🔍 Searching food', { q: typedText, url });
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: authHeaders },
      FOOD_SERVER_FETCH_TIMEOUT_MS,
    );
    if (__DEV__ && response?.ok) logger.debug('🍔 Food search server', base);
    return { response, fetchErr: null };
  } catch (caught) {
    logger.warn('🍔 Food search unreachable', {
      base,
      message: caught?.message || caught,
      isTimeout: caught?.name === 'AbortError',
    });
    return { response: null, fetchErr: caught };
  }
}

// Tries each API address until one answers the older food search.
async function fetchLegacySearchResponse(typedText, limit, authHeaders) {
  let response;
  let fetchErr;
  const bases = getResilientApiBases();
  for (const base of bases) {
    const attempt = await tryOneLegacyBase(base, typedText, limit, authHeaders);
    if (attempt.response) {
      response = attempt.response;
      break;
    }
    fetchErr = attempt.fetchErr;
  }
  return { response, fetchErr };
}

// When the older search fails those statuses, show phone cache plus Open Food Facts instead.
async function fallbackLegacyWhenHttpFailed(typedText, limit, status) {
  logger.warn(`🍔 Server search failed (${status}). Using cached + OFF fallback.`);
  if (shouldSkipOffFallback(typedText)) {
    lastSearchHint = SERVER_DOWN_HINT;
    return [];
  }
  return presentSearchResults(await offlineFoodFallback(typedText, limit), typedText);
}

// The older server search (restaurant and web results). Falls back offline if the server cannot answer.
async function searchFoodsLegacy(query, limit, authHeaders) {
  const typedText = String(query || '').trim();
  const { response, fetchErr } = await fetchLegacySearchResponse(typedText, limit, authHeaders);
  if (!response) {
    throw fetchErr || new Error('Network request failed');
  }

  if (!response.ok) {
    if (isFallbackHttpStatus(response.status)) {
      return fallbackLegacyWhenHttpFailed(typedText, limit, response.status);
    }
    throw new Error(`Food search failed: ${response.status}`);
  }

  const data = await response.json();
  lastSearchHint = data.hint || null;
  const list = Array.isArray(data.results) ? data.results : [];
  return mergeOfflineWhenServerEmpty(typedText, limit, list);
}

// Runs the consensus search and the older search at the same time and returns both lists.
async function askServerForBothLists(typedText, limit, authHeaders) {
  const [consensusResult, legacyResults] = await Promise.all([
    searchNutritionConsensus(typedText, authHeaders).catch(() => null),
    searchFoodsLegacy(typedText, limit, authHeaders),
  ]);
  return { consensusResult, legacyResults };
}

// Mixes famous menu items (like a Big Mac) into the server lists so they are not dropped.
function mergeTrustedIntoSearch(nutritionRows, legacyResults, trusted, limit) {
  let merged = mergeNutritionSearchWithLegacy(nutritionRows, legacyResults, limit);
  if (trusted.length === 0) return merged;
  return mergeNutritionSearchWithLegacy(
    nutritionRows.length ? nutritionRows : trusted,
    nutritionRows.length ? [...trusted, ...legacyResults] : legacyResults,
    limit,
  );
}

// Drops foods that do not match the words typed, and drops rows whose macros are wildly off.
function filterAndKeepClose(typedText, merged, trusted, limit) {
  let filtered = filterFoodSearchRows(typedText, merged, Math.min(limit, FILTERED_CARD_CAP));
  filtered = keepCloseMacroRows(filtered, Math.min(limit, CLOSE_MACRO_CAP));
  if (trusted.length === 0) return filtered;
  if (filtered.length === 0) {
    return keepCloseMacroRows(filterFoodSearchRows(typedText, trusted, TRUSTED_ONLY_CAP), TRUSTED_ONLY_CAP);
  }
  const trustedClose = filterFoodSearchRows(typedText, trusted, TRUSTED_SEED_LIMIT);
  if (trustedClose.length > 0) {
    return keepCloseMacroRows([...trustedClose, ...filtered], Math.min(limit, CLOSE_MACRO_CAP));
  }
  return filtered;
}

// If filtering left zero foods, try the phone cache and Open Food Facts before giving up.
async function refillFromOfflineIfEmpty(typedText, filtered, limit) {
  if (filtered.length > 0) return filtered;
  const offline = await offlineFoodFallback(typedText, limit);
  if (offline.length === 0) return filtered;
  const merged = mergeNutritionSearchWithLegacy(filtered, offline, limit);
  return keepCloseMacroRows(
    filterFoodSearchRows(typedText, merged.length ? merged : offline, Math.min(limit, CLOSE_MACRO_CAP)),
    Math.min(limit, CLOSE_MACRO_CAP),
  );
}

// True when the failure is "could not reach the server" (timeout or no connection), not a bad food name.
function isNetworkSearchError(error) {
  if (error?.name === 'AbortError') return true;
  if ((error?.message || '').toLowerCase().includes('network')) return true;
  if (error?.name === 'TypeError' && (error?.message || '').includes('fetch')) return true;
  return false;
}

// Builds the card list for an offline search and remembers it if anything came back.
async function presentOfflineSearch(typedText, limit, trusted, cacheKey, hintIfEmpty) {
  let merged = await offlineFoodFallback(typedText, limit);
  if (trusted.length) merged = [...trusted, ...merged].slice(0, limit);
  if (merged.length === 0 && hintIfEmpty) lastSearchHint = hintIfEmpty;
  const presented = presentSearchResults(filterFoodSearchRows(typedText, merged, limit), typedText);
  if (presented.length > 0) setCache(cacheKey, presented);
  return presented;
}

// Search path when nobody is logged in: tell them to sign in, and still show offline foods.
async function searchFoodsWhenSignedOut(typedText, limit, trusted) {
  lastSearchHint = SIGN_IN_HINT;
  const offline = await offlineFoodFallback(typedText, limit);
  const withTrusted = trusted.length ? [...trusted, ...offline] : offline;
  return presentSearchResults(filterFoodSearchRows(typedText, withTrusted, limit), typedText);
}

// Server was unreachable. Try cache plus Open Food Facts, or show the offline hint.
async function recoverFromNetworkFailure(typedText, limit, cacheKey, error) {
  logger.warn('🍔 Server unreachable; trying cache + Open Food Facts', {
    message: error?.message || String(error),
    menuStyle: isMenuStyleQuery(typedText),
  });
  try {
    const merged = await offlineFoodFallback(typedText, limit);
    if (merged.length > 0) {
      const filtered = filterFoodSearchRows(typedText, merged, limit);
      const presented = presentSearchResults(filtered.length ? filtered : merged, typedText);
      setCache(cacheKey, presented);
      logger.debug(`🍔 Fallback returned ${presented.length} results`);
      return presented;
    }
    if (!lastSearchHint) lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
    logger.warn('🍔 Food search: server unreachable and fallback returned no rows', {
      query: typedText,
      serverMessage: error?.message,
    });
  } catch (fallbackErr) {
    logger.error('🍔 Food search fallback failed', fallbackErr);
    if (!lastSearchHint) lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
  }
  return [];
}

// Keeps only the digits of a barcode and pads an 11-digit code to 12.
function normalizeBarcode(barcode) {
  const digits = String(barcode || '').replace(/\D/g, '');
  if (digits.length === UPC_E_PAD_FROM) return digits.padStart(UPC_A_LENGTH, '0');
  return digits;
}

// Looks up one barcode on Open Food Facts when our server cannot.
async function lookupBarcodeFromOpenFoodFacts(lookupCode, cacheKey) {
  const res = await fetchWithTimeout(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(lookupCode)}.json`,
    { headers: OFF_SEARCH_HEADERS },
    OFF_FETCH_TIMEOUT_MS,
  );
  const data = await res.json();
  if (!data?.product) return null;
  const result = normalizeOpenFoodFactsProduct(data.product);
  if (!result) return null;
  setCache(cacheKey, result);
  return result;
}

// Barcode fallback wrapper. Returns nothing instead of crashing if Open Food Facts fails.
async function recoverBarcodeFromOff(lookupCode, cacheKey) {
  try {
    return await lookupBarcodeFromOpenFoodFacts(lookupCode, cacheKey);
  } catch (fallbackError) {
    logger.warn('🍔 Barcode fallback failed', { message: fallbackError?.message || String(fallbackError) });
    return null;
  }
}

async function loginHeadersForSearch() {
  try {
    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers.Authorization) {
      return null;
    }
    return headers;
  } catch (_) {
    return null;
  }
}

// ===== MAIN FUNCTION =====

async function searchFoods(query, limit = DEFAULT_SEARCH_LIMIT) {
  const cacheKey = `${SEARCH_CACHE_PREFIX}${query}_${limit}`;
  try {
    lastSearchHint = null;
    logger.debug('🍔 Searching foods for', query);
    const typedText = String(query || '').trim();
    if (!typedText) {
      return [];
    }

    const cachedFoods = getFromCache(cacheKey);
    if (cachedFoods) {
      logger.debug('🍔 Returning cached search results');
      return presentSearchResults(cachedFoods, typedText);
    }

    const trustedMenuFoods = lookupTrustedFoods(typedText, TRUSTED_SEED_LIMIT);

    if (!hasUsableServerUrl()) {
      logger.warn('🍔 API base URL missing. Using cached + Open Food Facts only.');
      return presentOfflineSearch(typedText, limit, trustedMenuFoods, cacheKey, MISSING_API_HINT);
    }

    const loginHeaders = await loginHeadersForSearch();
    if (!loginHeaders) {
      return searchFoodsWhenSignedOut(typedText, limit, trustedMenuFoods);
    }

    const { consensusResult, legacyResults } = await askServerForBothLists(typedText, limit, loginHeaders);
    const nutritionRows = consensusResult?.rows || [];
    const mergedFoods = mergeTrustedIntoSearch(nutritionRows, legacyResults, trustedMenuFoods, limit);
    let foodsToShow = filterAndKeepClose(typedText, mergedFoods, trustedMenuFoods, limit);
    foodsToShow = await refillFromOfflineIfEmpty(typedText, foodsToShow, limit);

    const presented = presentSearchResults(foodsToShow, typedText);
    if (presented.length === 0) {
      lastSearchHint = lastSearchHint || FOOD_SEARCH_OFFLINE_HINT;
    }
    if (presented.length > 0) setCache(cacheKey, presented);
    logger.debug(
      `✅ Food search success: trusted=${trustedMenuFoods.length} nutrition_rows=${nutritionRows.length} legacy=${legacyResults.length} merged=${presented.length}`,
    );
    return presented;
  } catch (error) {
    if (isNetworkSearchError(error)) {
      return recoverFromNetworkFailure(String(query || '').trim(), limit, cacheKey, error);
    }
    logger.error('🍔 Error searching foods', error);
    return [];
  }
}

/**
 * Lookup food by barcode. Open Food Facts is the fallback when the server is unreachable.
 * @param {string} barcode
 * @returns {Promise<object|null>}
 */
async function lookupBarcode(barcode) {
  const lookupCode = normalizeBarcode(barcode);
  logger.debug('🍔 Looking up barcode', lookupCode);
  const cacheKey = `${BARCODE_CACHE_PREFIX}${lookupCode}`;

  try {
    const cached = getFromCache(cacheKey);
    if (cached) {
      logger.debug('🍔 Returning cached barcode result');
      return cached;
    }

    const authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!authHeaders.Authorization) {
      throw new Error('Sign in to scan barcodes');
    }

    const response = await fetchWithTimeout(
      `${getServerUrlCached()}/api/food/barcode`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ barcode: lookupCode }),
      },
      FOOD_SERVER_FETCH_TIMEOUT_MS,
    );

    if (!response.ok) {
      throw new Error(`Barcode lookup failed: ${response.status}`);
    }

    const result = await response.json();
    setCache(cacheKey, result);
    logger.debug('🍔 Barcode lookup result', result ? 'Found' : 'Not found');
    return result;
  } catch (error) {
    if (isNetworkSearchError(error)) {
      return recoverBarcodeFromOff(lookupCode, cacheKey);
    }
    return null;
  }
}

/**
 * Save a user-confirmed barcode food to the server verified catalog.
 * @param {string} barcode
 * @param {object} food
 * @returns {Promise<boolean>}
 */
async function saveVerifiedBarcode(barcode, food) {
  const clean = String(barcode || '').replace(/\D/g, '');
  if (!clean || !food) return false;
  try {
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!authHeaders.Authorization) return false;
    const response = await fetchWithTimeout(
      `${getServerUrlCached()}/api/food/barcode/verify`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ barcode: clean, food }),
      },
      FOOD_SERVER_FETCH_TIMEOUT_MS,
    );
    return response.ok;
  } catch (error) {
    logger.warn('🍔 saveVerifiedBarcode failed', { message: error?.message || String(error) });
    return false;
  }
}

/**
 * Extended nutrition label lookup for the facts screen.
 * @param {string} queryText
 * @returns {Promise<object|null>}
 */
async function fetchNutritionDetails(queryText) {
  const typedText = String(queryText || '').trim();
  if (!typedText) return null;
  try {
    const base = getServerUrl();
    if (!base) return null;
    const headers = await getApiAuthHeaders();
    const url = `${base}/api/food/nutrition-details?q=${encodeURIComponent(typedText)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    logger.debug('fetchNutritionDetails failed', error?.message);
    return null;
  }
}

// Default export object — other files import this bundle; do not rename these keys.
const foodSearchApi = {
  searchFoods,
  lookupBarcode,
  getLastSearchHint,
  getCachedFoods,
  saveVerifiedBarcode,
  fetchNutritionDetails,
  saveCachedFoods,
  clearAllCaches,
  getFromCache,
  setCache,
  clearExpiredCache,
};

export default foodSearchApi;
