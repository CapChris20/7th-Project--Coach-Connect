// Finds foods for the nutrition log: typed search, barcode lookup, and cache.
// Flow: typed text → phone cache → trusted menu seeds → server or offline → food cards.
// Used by Food Search, barcode scan, and daily meal logging. No UI in this file.
// Read order: constants → main recipes (searchFoods / lookupBarcode) → PLUMBING at the bottom.

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
  presentFoodSearchRows,
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
const CLOSE_MACRO_CAP = 5;
const TRUSTED_SEED_LIMIT = 2;
const FOOD_CACHE_STORAGE_KEY = 'COACHCONNECT_FOOD_CACHE';
// Manipulate here: bump when filter/ranker / never-blank / trusted catalog changes so stale caches die
const SEARCH_CACHE_PREFIX = 'search_v56_';
const BARCODE_CACHE_PREFIX = 'barcode_v9_';
// Manipulate here: random span for raceId Metro log tags
const RACE_ID_RANDOM_SPAN = 10000;

const MENU_EMPTY_HINT =
  'No matching menu item found. Include the restaurant and item (e.g. "Chipotle chicken bowl").';
const MENU_SERVER_HINT =
  'No results yet. Make sure the app can reach your Coach Connect API (Serper/USDA run on the server, not in the app).';
const SERVER_DOWN_HINT =
  'Food search server unavailable. Restaurant and brand searches need the server — try again shortly.';
const SIGN_IN_HINT = 'Sign in to search foods on the server.';
const MISSING_API_HINT = 'Set EXPO_PUBLIC_API_BASE_URL to your Coach Connect API (Cloud Run URL).';

const foodSearchCache = new Map();
let lastSearchHint = null;
let cachedServerUrl = null;

// ===== HELPER FUNCTIONS =====
// Small helpers the main recipes call. Heavy Open Food Facts / multi-host work is under PLUMBING.

function presentSearchResults(rows, query) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const enrichedRows = [];
  for (let index = 0; index < safeRows.length; index += 1) {
    enrichedRows.push(enrichSearchRowMicros(safeRows[index]));
  }
  return applyFoodCardPresentationToRows(enrichedRows, query);
}

function getServerUrl() {
  const firstBase = getResilientApiBases()[0] || '';
  return String(firstBase).replace(/\/$/, '');
}

function getServerUrlCached() {
  if (cachedServerUrl == null) {
    cachedServerUrl = getServerUrl();
  }
  return cachedServerUrl;
}

function hasUsableServerUrl() {
  const serverUrl = getServerUrlCached();
  if (!serverUrl) return false;
  if (serverUrl === 'null') return false;
  if (serverUrl === 'undefined') return false;
  return true;
}

function getFromCache(key) {
  const entry = foodSearchCache.get(key);
  if (!entry) return null;
  const ageMs = Date.now() - entry.timestamp;
  if (ageMs > CACHE_TIMEOUT_MS) {
    foodSearchCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  if (!Array.isArray(data) || data.length === 0) return;
  foodSearchCache.set(key, { data, timestamp: Date.now() });
}

function clearExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of foodSearchCache.entries()) {
    const ageMs = now - entry.timestamp;
    if (ageMs > CACHE_TIMEOUT_MS) {
      foodSearchCache.delete(key);
    }
  }
}

async function getCachedFoods() {
  try {
    const cached = await AsyncStorage.getItem(FOOD_CACHE_STORAGE_KEY);
    if (!cached) return [];
    return JSON.parse(cached);
  } catch (error) {
    logger.error('Error getting cached foods', error);
    return [];
  }
}

async function saveCachedFoods(foods) {
  try {
    await AsyncStorage.setItem(FOOD_CACHE_STORAGE_KEY, JSON.stringify(foods));
  } catch (error) {
    logger.error('Error saving cached foods', error);
  }
}

function clearAllCaches() {
  foodSearchCache.clear();
  AsyncStorage.removeItem(FOOD_CACHE_STORAGE_KEY);
}

function getLastSearchHint() {
  if (lastSearchHint) return lastSearchHint;
  return null;
}

function buildFoodSearchRaceId(startedAt) {
  const randomPart = Math.floor(Math.random() * RACE_ID_RANDOM_SPAN);
  return `fs_${startedAt.toString(36)}_${randomPart}`;
}

function normalizeBarcode(barcode) {
  const digits = String(barcode || '').replace(/\D/g, '');
  if (digits.length === UPC_E_PAD_FROM) {
    return digits.padStart(UPC_A_LENGTH, '0');
  }
  return digits;
}

function errorName(error) {
  if (!error) return '';
  if (!error.name) return '';
  return error.name;
}

function errorMessageText(error) {
  if (!error) return '';
  if (error.message) return String(error.message);
  return String(error);
}

function isNetworkSearchError(error) {
  const name = errorName(error);
  if (name === 'AbortError') return true;
  const message = errorMessageText(error).toLowerCase();
  if (message.includes('network')) return true;
  if (name === 'TypeError' && message.includes('fetch')) return true;
  return false;
}

async function loginHeadersForSearch() {
  try {
    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers.Authorization) return null;
    return headers;
  } catch (error) {
    return null;
  }
}

// Forward declarations filled in PLUMBING — mains call these by name.
let presentOfflineSearch;
let searchFoodsWhenSignedOut;
let searchFoodsWhenSignedIn;
let recoverFromNetworkFailure;
let recoverBarcodeFromOff;
let fetchWithTimeout;

// ===== MAIN FUNCTION =====

/**
 * Find foods for the nutrition log from typed text.
 * Flow: 1. empty  2. memory cache  3. trusted seeds  4. offline / signed-out / signed-in
 *       5. network fail → recover  6. other errors → []
 * @param {string} query
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
async function searchFoods(query, limit = DEFAULT_SEARCH_LIMIT) {
  const cacheKey = `${SEARCH_CACHE_PREFIX}${query}_${limit}`;
  const startedAt = Date.now();
  const raceId = buildFoodSearchRaceId(startedAt);
  const typedText = String(query || '').trim();

  try {
    lastSearchHint = null;
    logger.debug('🍔 Searching foods', {
      raceId,
      query: typedText,
      limit,
      apiBase: getServerUrlCached() || null,
    });

    // 1. Nothing typed → nothing to search.
    if (!typedText) {
      return [];
    }

    // 2. Same query already in memory → show those cards.
    const cachedFoods = getFromCache(cacheKey);
    if (cachedFoods) {
      logger.debug('🍔 Returning cached search results', {
        raceId,
        count: cachedFoods.length,
        ms: Date.now() - startedAt,
      });
      return presentSearchResults(cachedFoods, typedText);
    }

    // 3. Famous menu shortcuts seed the merge later.
    const trustedMenuFoods = lookupTrustedFoods(typedText, TRUSTED_SEED_LIMIT);

    // 4a. No API URL → phone cache + Open Food Facts only.
    if (!hasUsableServerUrl()) {
      logger.warn('🍔 API base URL missing. Using cached + Open Food Facts only.', { raceId });
      return presentOfflineSearch(
        typedText,
        limit,
        trustedMenuFoods,
        cacheKey,
        MISSING_API_HINT,
      );
    }

    // 4b. Not signed in → offline path with a sign-in hint.
    const loginHeaders = await loginHeadersForSearch();
    if (!loginHeaders) {
      return searchFoodsWhenSignedOut(typedText, limit, trustedMenuFoods);
    }

    // 4c. Signed in → ask the server, filter, present cards.
    return searchFoodsWhenSignedIn(
      typedText,
      limit,
      trustedMenuFoods,
      cacheKey,
      loginHeaders,
      raceId,
      startedAt,
    );
  } catch (error) {
    // 5. Network died → try offline recover.
    if (isNetworkSearchError(error)) {
      logger.warn('🍔 Food search network failure', {
        raceId,
        ms: Date.now() - startedAt,
        message: errorMessageText(error),
      });
      return recoverFromNetworkFailure(typedText, limit, cacheKey, error);
    }
    // 6. Anything else → empty list.
    logger.error('🍔 Error searching foods', { raceId, error });
    return [];
  }
}

/**
 * Look up one barcode. Open Food Facts is the fallback when our server cannot answer.
 * @param {string} barcode
 * @returns {Promise<object|null>}
 */
async function lookupBarcode(barcode) {
  const lookupCode = normalizeBarcode(barcode);
  const cacheKey = `${BARCODE_CACHE_PREFIX}${lookupCode}`;
  logger.debug('🍔 Looking up barcode', lookupCode);

  try {
    // 1. Memory cache hit → return it.
    const cached = getFromCache(cacheKey);
    if (cached) {
      logger.debug('🍔 Returning cached barcode result');
      return cached;
    }

    // 2. Need a signed-in user for the Coach Connect barcode API.
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!authHeaders.Authorization) {
      throw new Error('Sign in to scan barcodes');
    }

    // 3. Ask our server.
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

    // 4. Remember and return the server result.
    const result = await response.json();
    setCache(cacheKey, result);
    logger.debug('🍔 Barcode lookup result', result ? 'Found' : 'Not found');
    return result;
  } catch (error) {
    // 5. Network fail → Open Food Facts. Other errors → null.
    if (isNetworkSearchError(error)) {
      return recoverBarcodeFromOff(lookupCode, cacheKey);
    }
    return null;
  }
}

/**
 * Save a user-confirmed barcode food into the server verified catalog.
 * @param {string} barcode
 * @param {object} food
 * @returns {Promise<boolean>}
 */
async function saveVerifiedBarcode(barcode, food) {
  const cleanBarcode = String(barcode || '').replace(/\D/g, '');

  // 1. Need both a barcode and a food card.
  if (!cleanBarcode || !food) return false;

  try {
    // 2. Need a signed-in user.
    const authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!authHeaders.Authorization) return false;

    // 3. POST the verified food.
    const response = await fetchWithTimeout(
      `${getServerUrlCached()}/api/food/barcode/verify`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ barcode: cleanBarcode, food }),
      },
      FOOD_SERVER_FETCH_TIMEOUT_MS,
    );
    return response.ok;
  } catch (error) {
    logger.warn('🍔 saveVerifiedBarcode failed', { message: errorMessageText(error) });
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

  // 1. Empty query → nothing to fetch.
  if (!typedText) return null;

  try {
    // 2. Need an API base.
    const apiBase = getServerUrl();
    if (!apiBase) return null;

    // 3. GET nutrition-details for that name.
    // Manipulate here: query param letter stays `q` — server contract
    const headers = await getApiAuthHeaders();
    const url = `${apiBase}/api/food/nutrition-details?q=${encodeURIComponent(typedText)}`;
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    logger.debug('fetchNutritionDetails failed', errorMessageText(error));
    return null;
  }
}

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

// ===== PLUMBING — skip unless debugging food search / OFF / server fallback =====


// vocab: AbortController = cancel a fetch that sat too long.
fetchWithTimeout = async function fetchWithTimeout(url, init = {}, timeoutMs = FOOD_SERVER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

function mapOffProductToRow(product, limitIndex) {
  const normalized = normalizeOpenFoodFactsProduct(product);
  if (normalized) return normalized;

  const nutriments = product.nutriments || {};
  let kcalFromKj = 0;
  if (nutriments.energy_100g != null) {
    kcalFromKj = Math.round(Number(nutriments.energy_100g) / KJ_PER_KCAL);
  }
  let calories = kcalFromKj;
  if (nutriments['energy-kcal_100g'] != null) {
    calories = nutriments['energy-kcal_100g'];
  }

  let sodiumMg = null;
  if (nutriments.sodium_100g) {
    sodiumMg = nutriments.sodium_100g * MG_PER_GRAM;
  }

  return {
    id: product.code || `off_${Date.now()}_${limitIndex}`,
    name: product.product_name,
    brand: product.brands || null,
    restaurant: null,
    calories,
    protein: nutriments.proteins_100g ?? 0,
    carbs: nutriments.carbohydrates_100g ?? 0,
    fat: nutriments.fat_100g ?? 0,
    fiber: nutriments.fiber_100g ?? null,
    sodium: sodiumMg,
    sugar: nutriments.sugars_100g ?? null,
    servingSize: 1,
    servingUnit: 'grams',
    servingGrams: 100,
    source: 'openfoodfacts',
  };
}

function productHasMinimumNutrition(product) {
  if (!product) return false;
  if (!product.product_name) return false;
  const nutriments = product.nutriments || {};
  if (nutriments['energy-kcal_100g'] != null) return true;
  if (nutriments.energy_100g != null) return true;
  if (nutriments['energy-kcal_serving'] != null) return true;
  if (nutriments.proteins_100g != null) return true;
  if (nutriments.proteins_serving != null) return true;
  return false;
}

function parseOffSearchJson(text) {
  const trimmed = String(text || '').trim();
  const startsLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
  if (!startsLikeJson) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

function mapOffProductsToRows(products, limit) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const withNutrition = [];
  for (let index = 0; index < products.length; index += 1) {
    if (productHasMinimumNutrition(products[index])) {
      withNutrition.push(products[index]);
    }
  }

  const limitedWithNutrition = withNutrition.slice(0, limit);
  const mapped = [];
  for (let index = 0; index < limitedWithNutrition.length; index += 1) {
    mapped.push(mapOffProductToRow(limitedWithNutrition[index], index));
  }
  if (mapped.length > 0) return mapped;

  const withNameAndNutriments = [];
  for (let index = 0; index < products.length; index += 1) {
    const product = products[index];
    if (!product.product_name) continue;
    if (!product.nutriments || typeof product.nutriments !== 'object') continue;
    withNameAndNutriments.push(product);
  }
  const limitedFallback = withNameAndNutriments.slice(0, limit);
  const fallbackMapped = [];
  for (let index = 0; index < limitedFallback.length; index += 1) {
    fallbackMapped.push(mapOffProductToRow(limitedFallback[index], index));
  }
  return fallbackMapped;
}

function shouldSkipOffFallback(query) {
  const typedText = String(query || '').trim();
  if (!typedText) return true;
  return isMenuStyleQuery(typedText);
}

function preferQueryRelevantMatches(query, rows, limit) {
  return filterFoodSearchRows(query, rows, limit);
}

function openFoodFactsQueryVariants(raw) {
  const typedText = String(raw || '').trim();
  if (!typedText) return [];

  const stripped = typedText
    .replace(/[''`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const variants = [typedText];
  if (stripped && stripped.toLowerCase() !== typedText.toLowerCase()) {
    variants.push(stripped);
  }

  const unique = [];
  const seen = new Set();
  for (let index = 0; index < variants.length; index += 1) {
    const variant = variants[index];
    if (seen.has(variant)) continue;
    seen.add(variant);
    unique.push(variant);
  }
  return unique;
}

function brandTextFromSalHit(hit) {
  // Search-a-licious may send brands as a string or as a list of strings.
  if (typeof hit.brands === 'string' && hit.brands.trim()) {
    return hit.brands.trim();
  }
  if (!Array.isArray(hit.brands)) {
    return null;
  }
  const brandParts = [];
  for (let index = 0; index < hit.brands.length; index += 1) {
    const brandPart = hit.brands[index];
    if (!brandPart) continue;
    brandParts.push(brandPart);
  }
  if (brandParts.length === 0) return null;
  return brandParts.join(', ');
}

function firstNonEmptyTrimmedString(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    return trimmed;
  }
  return null;
}

function productNameFromSalHit(hit) {
  // Prefer English product_name, then product_name_en, then French fallback.
  return firstNonEmptyTrimmedString(
    hit.product_name,
    hit.product_name_en,
    hit.product_name_fr,
  );
}

function salHitToOffStyleProduct(hit) {
  // Turn one Search-a-licious hit into the same shape world.openfoodfacts.org products use,
  // so mapOffProductsToRows can treat both sources the same.
  if (!hit || typeof hit !== 'object') return null;

  const productName = productNameFromSalHit(hit);
  if (!productName) return null;

  let barcodeCode;
  if (hit.code != null) barcodeCode = String(hit.code);

  let nutriments = {};
  if (hit.nutriments && typeof hit.nutriments === 'object') {
    nutriments = hit.nutriments;
  }

  return {
    code: barcodeCode,
    product_name: productName,
    brands: brandTextFromSalHit(hit),
    nutriments,
  };
}

async function searchOpenFoodFactsSearchALicious(query, limit = DEFAULT_SEARCH_LIMIT) {
  const raw = String(query || '').trim();
  if (!raw) return [];

  const cleaned =
    raw.replace(/[+\-&|!(){}\[\]^"~*?:\\]/g, ' ').replace(/\s+/g, ' ').trim() || raw;
  const pageSize = Math.min(Math.max(limit, 1), OFF_PAGE_SIZE_MAX);
  const params = new URLSearchParams({
    q: cleaned,
    page_size: String(pageSize),
    page: '1',
    langs: 'en',
    fields: SAL_SEARCH_FIELDS,
  });
  const url = `${OPEN_FOOD_FACTS_SEARCH_API}/search?${params.toString()}`;
  const response = await fetchWithTimeout(url, { method: 'GET', headers: OFF_SEARCH_HEADERS }, OFF_FETCH_TIMEOUT_MS);
  const text = await response.text();
  if (!response.ok) {
    if (__DEV__) logger.warn('🍔 OFF Search-a-licious HTTP', { status: response.status });
    return [];
  }

  const data = parseOffSearchJson(text);
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data.errors) && data.errors.length && !Array.isArray(data.hits)) return [];
  if (!Array.isArray(data.hits) || data.hits.length === 0) return [];

  const products = [];
  for (let index = 0; index < data.hits.length; index += 1) {
    const product = salHitToOffStyleProduct(data.hits[index]);
    if (product) products.push(product);
  }
  return mapOffProductsToRows(products, limit);
}

async function tryOneSalVariant(searchTerms, query, limit) {
  try {
    const salRows = await searchOpenFoodFactsSearchALicious(searchTerms, limit);
    if (salRows.length === 0) return [];
    return preferQueryRelevantMatches(query, salRows, limit);
  } catch (error) {
    if (__DEV__) logger.warn('🍔 OFF Search-a-licious failed', { message: errorMessageText(error) });
    return [];
  }
}

async function trySalSearchForVariants(query, variants, limit) {
  for (let index = 0; index < variants.length; index += 1) {
    const rows = await tryOneSalVariant(variants[index], query, limit);
    if (rows.length > 0) return rows;
  }
  return [];
}

async function tryOffPostSearch(origin, searchTerms, pageSize, query, limit) {
  const body = new URLSearchParams({
    action: 'process',
    search_terms: searchTerms,
    search_simple: '1',
    json: '1',
    page_size: String(pageSize),
  }).toString();
  const response = await fetchWithTimeout(
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
  const text = await response.text();
  const data = parseOffSearchJson(text);
  const products = data && Array.isArray(data.products) ? data.products : [];
  if (products.length === 0) return [];
  const rows = mapOffProductsToRows(products, limit);
  return preferQueryRelevantMatches(query, rows, limit);
}

async function tryOffGetSearch(offUrl, query, limit) {
  const response = await fetchWithTimeout(offUrl, { method: 'GET', headers: OFF_SEARCH_HEADERS }, OFF_FETCH_TIMEOUT_MS);
  const text = await response.text();
  const data = parseOffSearchJson(text);
  const products = data && Array.isArray(data.products) ? data.products : [];
  if (products.length === 0) {
    const looksLikeHtml = text.trim().startsWith('<');
    if (__DEV__ && looksLikeHtml) {
      logger.warn('🍔 OFF GET returned HTML — trying POST/variants next');
    }
    return [];
  }
  const rows = mapOffProductsToRows(products, limit);
  return preferQueryRelevantMatches(query, rows, limit);
}

async function tryOneOffPost(origin, searchTerms, pageSize, query, limit) {
  try {
    return await tryOffPostSearch(origin, searchTerms, pageSize, query, limit);
  } catch (error) {
    logger.warn('🍔 OFF POST failed', { origin, message: errorMessageText(error) });
    return [];
  }
}

async function tryOneOffGet(offUrl, query, limit) {
  try {
    return await tryOffGetSearch(offUrl, query, limit);
  } catch (error) {
    logger.warn('🍔 OFF GET failed', { message: errorMessageText(error) });
    return [];
  }
}

async function tryOffPostsForVariant(hosts, searchTerms, pageSize, query, limit) {
  for (let index = 0; index < hosts.length; index += 1) {
    const rows = await tryOneOffPost(hosts[index], searchTerms, pageSize, query, limit);
    if (rows.length > 0) return rows;
  }
  return [];
}

async function tryOffGetsForVariant(hosts, searchTerms, pageSize, query, limit) {
  const encoded = encodeURIComponent(searchTerms);
  for (let index = 0; index < hosts.length; index += 1) {
    const offUrl = `${hosts[index]}/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${pageSize}`;
    const rows = await tryOneOffGet(offUrl, query, limit);
    if (rows.length > 0) return rows;
  }
  return [];
}

async function searchOpenFoodFactsDirect(query, limit = DEFAULT_SEARCH_LIMIT) {
  const pageSize = Math.min(Math.max(limit, 1), OFF_PAGE_SIZE_MAX);
  const variants = openFoodFactsQueryVariants(query);
  if (variants.length === 0) return [];

  const salRows = await trySalSearchForVariants(query, variants, limit);
  if (salRows.length > 0) return salRows;

  const hosts = ['https://world.openfoodfacts.org', 'https://us.openfoodfacts.org'];
  for (let index = 0; index < variants.length; index += 1) {
    const searchTerms = variants[index];
    const postRows = await tryOffPostsForVariant(hosts, searchTerms, pageSize, query, limit);
    if (postRows.length > 0) return postRows;
    const getRows = await tryOffGetsForVariant(hosts, searchTerms, pageSize, query, limit);
    if (getRows.length > 0) return getRows;
  }
  return [];
}

function cachedFoodsMatchingQuery(cachedFoods, typedText) {
  const needle = typedText.toLowerCase();
  const list = Array.isArray(cachedFoods) ? cachedFoods : [];
  const matches = [];
  for (let index = 0; index < list.length; index += 1) {
    const food = list[index];
    let foodName = '';
    if (food && food.name) foodName = String(food.name).toLowerCase();
    if (foodName.includes(needle)) matches.push(food);
  }
  return matches;
}

async function loadCachedAndOffRows(typedText, limit) {
  // vocab: Promise.all = start phone-cache + Open Food Facts together; wait until both finish
  const cachedPromise = getCachedFoods().catch(() => []);
  let openFoodFactsPromise = Promise.resolve([]);
  if (!shouldSkipOffFallback(typedText)) {
    openFoodFactsPromise = searchOpenFoodFactsDirect(typedText, limit).catch(() => []);
  }
  const cachedAndOpenFoodFacts = await Promise.all([cachedPromise, openFoodFactsPromise]);
  return {
    cachedFoods: cachedAndOpenFoodFacts[0],
    openFoodFactsRows: cachedAndOpenFoodFacts[1],
  };
}

async function offlineFoodFallback(query, limit) {
  const typedText = String(query || '').trim();
  const { cachedFoods, openFoodFactsRows } = await loadCachedAndOffRows(typedText, limit);
  const localMatches = cachedFoodsMatchingQuery(cachedFoods, typedText);
  const merged = [...localMatches, ...openFoodFactsRows];
  return merged.slice(0, limit);
}

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

async function mergeOfflineWhenServerEmpty(query, limit, serverResults) {
  const typedText = String(query || '').trim();
  const base = Array.isArray(serverResults) ? serverResults : [];
  if (base.length > 0) return base;

  const requiredBrand = findConsumerBrandInQuery(typedText);
  const merged = await offlineFoodFallback(typedText, limit);
  if (merged.length === 0) setEmptySearchHint(typedText, requiredBrand);
  return merged;
}

function interpretConsensusResponse(response, typedText, base) {
  if (response.status === HTTP_NOT_FOUND || response.status === HTTP_SERVICE_UNAVAILABLE) {
    if (__DEV__) logger.debug('🍔 Nutrition consensus empty', { status: response.status, q: typedText });
    return { done: true, result: null };
  }
  if (!response.ok) {
    if (__DEV__) logger.warn('🍔 Nutrition consensus HTTP', { status: response.status, base });
    return { done: false, result: null };
  }
  return { done: null, result: null };
}

async function consensusRowsFromResponse(response, typedText) {
  const data = await response.json();
  const rows = mapNutritionSearchToFoodRows(data, typedText);
  if (rows.length === 0) return null;
  let sourceResultCount = 0;
  if (data.sourceResults && data.sourceResults.length) {
    sourceResultCount = data.sourceResults.length;
  }
  let consensusHasCalories = false;
  if (data.consensus && data.consensus.calories) {
    consensusHasCalories = true;
  }
  logger.debug('🍔 Nutrition consensus hit', {
    rows: rows.length,
    sources: sourceResultCount,
    consensus: consensusHasCalories,
  });
  return { rows, payload: data };
}

async function tryOneConsensusBase(base, typedText, foodName, restaurant, authHeaders) {
  try {
    const response = await fetchWithTimeout(
      `${base}/api/nutrition/search`,
      {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ foodName, restaurant }),
      },
      NUTRITION_CONSENSUS_FETCH_TIMEOUT_MS,
    );
    const earlyExit = interpretConsensusResponse(response, typedText, base);
    if (earlyExit.done === true) return { stop: true, result: null };
    if (earlyExit.done === false) return { stop: false, result: null };
    const result = await consensusRowsFromResponse(response, typedText);
    return { stop: true, result };
  } catch (error) {
    const message = errorMessageText(error);
    const isTimeout = errorName(error) === 'AbortError';
    logger.warn('🍔 Nutrition consensus failed', {
      base,
      message,
      isTimeout,
    });
    return { stop: false, result: null };
  }
}

async function searchNutritionConsensus(query, authHeaders) {
  const typedText = String(query || '').trim();
  if (!typedText) return null;

  const { foodName, restaurant } = parseNutritionSearchQuery(typedText);
  const bases = getResilientApiBases();
  for (let index = 0; index < bases.length; index += 1) {
    const attempt = await tryOneConsensusBase(bases[index], typedText, foodName, restaurant, authHeaders);
    if (attempt.stop) return attempt.result;
  }
  return null;
}

function isFallbackHttpStatus(status) {
  if (status === HTTP_UNAUTHORIZED) return true;
  if (status === HTTP_FORBIDDEN) return true;
  if (status === HTTP_NOT_FOUND) return true;
  if (status === HTTP_TOO_MANY) return true;
  if (status >= HTTP_SERVER_ERROR) return true;
  return false;
}

async function tryOneLegacyBase(base, typedText, limit, authHeaders) {
  const url = `${base}/api/food/search?query=${encodeURIComponent(typedText)}&limit=${limit}`;
  try {
    logger.debug('🔍 Searching food', { q: typedText, url });
    const response = await fetchWithTimeout(
      url,
      { method: 'GET', headers: authHeaders },
      FOOD_SERVER_FETCH_TIMEOUT_MS,
    );
    if (__DEV__ && response && response.ok) logger.debug('🍔 Food search server', base);
    return { response, fetchErr: null };
  } catch (caught) {
    logger.warn('🍔 Food search unreachable', {
      base,
      message: errorMessageText(caught),
      isTimeout: errorName(caught) === 'AbortError',
    });
    return { response: null, fetchErr: caught };
  }
}

async function fetchLegacySearchResponse(typedText, limit, authHeaders) {
  let response;
  let fetchErr;
  const bases = getResilientApiBases();
  for (let index = 0; index < bases.length; index += 1) {
    const attempt = await tryOneLegacyBase(bases[index], typedText, limit, authHeaders);
    if (attempt.response) {
      response = attempt.response;
      break;
    }
    fetchErr = attempt.fetchErr;
  }
  return { response, fetchErr };
}

async function fallbackLegacyWhenHttpFailed(typedText, limit, status) {
  logger.warn(`🍔 Server search failed (${status}). Using cached + OFF fallback.`);
  if (shouldSkipOffFallback(typedText)) {
    lastSearchHint = SERVER_DOWN_HINT;
    return [];
  }
  const offline = await offlineFoodFallback(typedText, limit);
  return presentSearchResults(offline, typedText);
}

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

async function askServerForBothLists(typedText, limit, authHeaders) {
  // vocab: Promise.all = start both server calls together; wait until both finish.
  // Lives in PLUMBING so the main recipe stays a short numbered list.
  const bothLists = await Promise.all([
    searchNutritionConsensus(typedText, authHeaders).catch(() => null),
    searchFoodsLegacy(typedText, limit, authHeaders),
  ]);
  return { consensusResult: bothLists[0], legacyResults: bothLists[1] };
}

function mergeTrustedIntoSearch(nutritionRows, legacyResults, trusted, limit) {
  if (trusted.length === 0) {
    return mergeNutritionSearchWithLegacy(nutritionRows, legacyResults, limit);
  }
  if (nutritionRows.length) {
    return mergeNutritionSearchWithLegacy(nutritionRows, [...legacyResults, ...trusted], limit);
  }
  return mergeNutritionSearchWithLegacy(trusted, legacyResults, limit);
}

function filterAndKeepClose(typedText, merged, trusted, limit) {
  return presentFoodSearchRows(typedText, merged, trusted, limit);
}

async function refillFromOfflineIfEmpty(typedText, filtered, limit) {
  if (filtered.length > 0) return filtered;
  const offline = await offlineFoodFallback(typedText, limit);
  if (offline.length === 0) return filtered;
  const merged = mergeNutritionSearchWithLegacy(filtered, offline, limit);
  const closeCap = Math.min(limit, CLOSE_MACRO_CAP);
  const rankedSource = merged.length ? merged : offline;
  const nameFiltered = filterFoodSearchRows(typedText, rankedSource, closeCap);
  const refiltered = keepCloseMacroRows(nameFiltered, closeCap);
  if (refiltered.length > 0) return refiltered;
  return offline.slice(0, closeCap);
}

presentOfflineSearch = async function presentOfflineSearch(typedText, limit, trusted, cacheKey, hintIfEmpty) {
  let merged = await offlineFoodFallback(typedText, limit);
  if (trusted.length) {
    merged = [...trusted, ...merged].slice(0, limit);
  }
  if (merged.length === 0 && hintIfEmpty) {
    lastSearchHint = hintIfEmpty;
  }
  const nameFiltered = filterFoodSearchRows(typedText, merged, limit);
  const presented = presentSearchResults(nameFiltered, typedText);
  if (presented.length > 0) setCache(cacheKey, presented);
  return presented;
};

searchFoodsWhenSignedOut = async function searchFoodsWhenSignedOut(typedText, limit, trusted) {
  lastSearchHint = SIGN_IN_HINT;
  const offline = await offlineFoodFallback(typedText, limit);
  let combined = offline;
  if (trusted.length) {
    combined = [...trusted, ...offline];
  }
  const nameFiltered = filterFoodSearchRows(typedText, combined, limit);
  return presentSearchResults(nameFiltered, typedText);
};

recoverFromNetworkFailure = async function recoverFromNetworkFailure(typedText, limit, cacheKey, error) {
  logger.warn('🍔 Server unreachable; trying cache + Open Food Facts', {
    message: errorMessageText(error),
    menuStyle: isMenuStyleQuery(typedText),
  });
  try {
    const merged = await offlineFoodFallback(typedText, limit);
    if (merged.length > 0) {
      const filtered = filterFoodSearchRows(typedText, merged, limit);
      const rowsToPresent = filtered.length ? filtered : merged;
      const presented = presentSearchResults(rowsToPresent, typedText);
      setCache(cacheKey, presented);
      logger.debug(`🍔 Fallback returned ${presented.length} results`);
      return presented;
    }
    if (!lastSearchHint) lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
    let serverMessage = '';
    if (error && error.message) serverMessage = error.message;
    logger.warn('🍔 Food search: server unreachable and fallback returned no rows', {
      query: typedText,
      serverMessage,
    });
  } catch (fallbackErr) {
    logger.error('🍔 Food search fallback failed', fallbackErr);
    if (!lastSearchHint) lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
  }
  return [];
};

async function lookupBarcodeFromOpenFoodFacts(lookupCode, cacheKey) {
  const response = await fetchWithTimeout(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(lookupCode)}.json`,
    { headers: OFF_SEARCH_HEADERS },
    OFF_FETCH_TIMEOUT_MS,
  );
  const data = await response.json();
  if (!data || !data.product) return null;
  const result = normalizeOpenFoodFactsProduct(data.product);
  if (!result) return null;
  setCache(cacheKey, result);
  return result;
}

recoverBarcodeFromOff = async function recoverBarcodeFromOff(lookupCode, cacheKey) {
  try {
    return await lookupBarcodeFromOpenFoodFacts(lookupCode, cacheKey);
  } catch (fallbackError) {
    logger.warn('🍔 Barcode fallback failed', { message: errorMessageText(fallbackError) });
    return null;
  }
};

searchFoodsWhenSignedIn = async function searchFoodsWhenSignedIn(
  typedText,
  limit,
  trustedMenuFoods,
  cacheKey,
  loginHeaders,
  raceId,
  startedAt,
) {
  // 1. Ask the server for consensus macros + the older search list.
  const { consensusResult, legacyResults } = await askServerForBothLists(
    typedText,
    limit,
    loginHeaders,
  );

  // 2. Mix trusted menu seeds into those lists.
  let nutritionRows = [];
  if (consensusResult && Array.isArray(consensusResult.rows)) {
    nutritionRows = consensusResult.rows;
  }
  const mergedFoods = mergeTrustedIntoSearch(
    nutritionRows,
    legacyResults,
    trustedMenuFoods,
    limit,
  );
  const rawMergedCount = Array.isArray(mergedFoods) ? mergedFoods.length : 0;

  // 3. Drop cousins / keep close macros; refill from offline if blank.
  let foodsToShow = filterAndKeepClose(typedText, mergedFoods, trustedMenuFoods, limit);
  const postFilterCount = foodsToShow.length;
  foodsToShow = await refillFromOfflineIfEmpty(typedText, foodsToShow, limit);

  // 4. Shape cards for the search screen; cache when we have any.
  const presented = presentSearchResults(foodsToShow, typedText);
  if (presented.length === 0) {
    lastSearchHint = lastSearchHint || FOOD_SEARCH_OFFLINE_HINT;
    setEmptySearchHint(typedText, findConsumerBrandInQuery(typedText));
  }
  if (presented.length > 0) setCache(cacheKey, presented);

  logger.debug('✅ Food search success', {
    raceId,
    query: typedText,
    trusted: trustedMenuFoods.length,
    nutritionRows: nutritionRows.length,
    legacy: legacyResults.length,
    rawMerged: rawMergedCount,
    postFilter: postFilterCount,
    presented: presented.length,
    hint: lastSearchHint,
    ms: Date.now() - startedAt,
  });
  return presented;
};

