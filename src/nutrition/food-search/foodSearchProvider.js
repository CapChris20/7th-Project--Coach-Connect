/**
 * food Search Provider
 *
 * Purpose: Data/service layer: food Search Provider. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: FOOD_SEARCH_OFFLINE_HINT
 *
 * @file-header
 */
/**
 * Food Search Provider
 * Single source of truth for all food search operations
 * Integrates with server endpoints for secure API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getResilientApiBases } from '../../shared/api/baseUrl';
import { getApiAuthHeaders } from '../../shared/api/getAuthHeaders';
import logger from '../../shared/api/logErrorToServer';
const {
  isMenuStyleQuery,
  itemMatchesQuery,
  isRetailFoodNoise,
} = require('../food-search/rankFoodSearchResults');
const { findConsumerBrandInQuery } = require('../food-details/formatFoodBrand');

const { normalizeOpenFoodFactsProduct } = require('../food-details/normalizeNutritionData');

/** Open Food Facts requires an identifiable User-Agent (otherwise HTML/blocks → JSON parse errors). */
const OPEN_FOOD_FACTS_USER_AGENT =
  'CoachConnect/1.0 (Mobile; https://github.com/coachconnect; contact: support@coachconnect.app)';

/** Shown when the phone cannot reach the API and OFF also fails. */
export const FOOD_SEARCH_OFFLINE_HINT =
  "Could not reach the food search server. Check your internet connection and try again.";

function getServerUrl() {
  return String(getResilientApiBases()[0] || '').replace(/\/$/, '');
}

function mapOffProductToRow(p, limitIndex) {
  const normalized = normalizeOpenFoodFactsProduct(p);
  if (normalized) return normalized;
  const n = p.nutriments || {};
  const kcal =
    n['energy-kcal_100g'] ??
    (n.energy_100g != null ? Math.round(Number(n.energy_100g) / 4.184) : 0);
  return {
    id: p.code || `off_${Date.now()}_${limitIndex}`,
    name: p.product_name,
    brand: p.brands || null,
    restaurant: null,
    calories: kcal,
    protein: n.proteins_100g ?? 0,
    carbs: n.carbohydrates_100g ?? 0,
    fat: n.fat_100g ?? 0,
    fiber: n.fiber_100g ?? null,
    sodium: n.sodium_100g ? n.sodium_100g * 1000 : null,
    sugar: n.sugars_100g ?? null,
    servingSize: 1,
    servingUnit: 'grams',
    servingGrams: 100,
    source: 'openfoodfacts',
  };
}

function productHasMinimumNutrition(p) {
  if (!p?.product_name) return false;
  const n = p.nutriments || {};
  return (
    n['energy-kcal_100g'] != null ||
    n.energy_100g != null ||
    n['energy-kcal_serving'] != null ||
    n.proteins_100g != null ||
    n.proteins_serving != null
  );
}

function parseOffSearchJson(text) {
  const t = String(text || '').trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function mapOffProductsToRows(products, limit) {
  if (!Array.isArray(products) || products.length === 0) return [];

  const mapped = products
    .filter(productHasMinimumNutrition)
    .slice(0, limit)
    .map((p, i) => mapOffProductToRow(p, i));

  if (mapped.length > 0) return mapped;

  return products
    .filter((p) => p.product_name && p.nutriments && typeof p.nutriments === 'object')
    .slice(0, limit)
    .map((p, i) => mapOffProductToRow(p, i));
}

/** When OFF fallback would do more harm than good (restaurant / required brand). */
function shouldSkipOffFallback(query) {
  const q = String(query || '').trim();
  if (!q) return true;
  if (isMenuStyleQuery(q)) return true;
  if (findConsumerBrandInQuery(q)) return true;
  return false;
}

/** Keep rows that match the user's search tokens (no restaurant name whitelist). */
function preferQueryRelevantMatches(query, rows, limit) {
  const list = Array.isArray(rows) ? rows : [];
  if (list.length === 0) return [];
  const requiredBrand = findConsumerBrandInQuery(query);
  const matched = list.filter((r) => {
    const text = `${r.name || ''} ${r.brand || ''}`;
    if (isRetailFoodNoise(text)) return false;
    if (requiredBrand && !new RegExp(`\\b${requiredBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text)) {
      return false;
    }
    return itemMatchesQuery(text, query);
  });
  return matched.slice(0, limit);
}

/** Alternate wording when apostrophes/special chars trigger HTML blocks from CDN/WAF. */
function openFoodFactsQueryVariants(raw) {
  const q = String(raw || '').trim();
  if (!q) return [];
  const stripped = q
    .replace(/[''`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const out = [q];
  if (stripped && stripped.toLowerCase() !== q.toLowerCase()) out.push(stripped);
  return [...new Set(out)];
}

const OFF_SEARCH_HEADERS = {
  Accept: 'application/json',
  'User-Agent': OPEN_FOOD_FACTS_USER_AGENT,
};

/** OFF’s hosted Elasticsearch search (JSON). Legacy `/cgi/search.pl` often returns HTML to mobile clients. */
const OPEN_FOOD_FACTS_SEARCH_API = 'https://search.openfoodfacts.org';
const SAL_SEARCH_FIELDS = 'code,product_name,product_name_en,brands,nutriments';

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

async function searchOpenFoodFactsSearchALicious(query, limit = 20) {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const q = raw.replace(/[+\-&|!(){}\[\]^"~*?:\\]/g, ' ').replace(/\s+/g, ' ').trim() || raw;
  const pageSize = Math.min(Math.max(limit, 1), 24);
  const params = new URLSearchParams({
    q,
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

/** React Native fetch has no `timeout` option — abort stalled requests instead. */
const FOOD_SERVER_FETCH_TIMEOUT_MS = 10000;
const OFF_FETCH_TIMEOUT_MS = 12000;

async function fetchWithTimeout(url, init = {}, timeoutMs = FOOD_SERVER_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Same shape as server returns — used when server is unreachable
async function searchOpenFoodFactsDirect(query, limit = 20) {
  const pageSize = Math.min(Math.max(limit, 1), 24);
  const variants = openFoodFactsQueryVariants(query);
  if (variants.length === 0) return [];

  for (const searchTerms of variants) {
    try {
      const salRows = await searchOpenFoodFactsSearchALicious(searchTerms, limit);
      if (salRows.length > 0) return preferQueryRelevantMatches(query, salRows, limit);
    } catch (err) {
      if (__DEV__) logger.warn('🍔 OFF Search-a-licious failed', { message: err?.message });
    }
  }

  const hosts = ['https://world.openfoodfacts.org', 'https://us.openfoodfacts.org'];

  for (const searchTerms of variants) {
    const encoded = encodeURIComponent(searchTerms);

    // 1) POST (often returns JSON when GET is rewritten to HTML landing pages)
    for (const origin of hosts) {
      try {
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
          OFF_FETCH_TIMEOUT_MS
        );
        const text = await res.text();
        const data = parseOffSearchJson(text);
        if (data?.products?.length) {
          const rows = preferQueryRelevantMatches(query, mapOffProductsToRows(data.products, limit), limit);
          if (rows.length > 0) return rows;
        }
      } catch (err) {
        logger.warn('🍔 OFF POST failed', { origin, message: err?.message });
      }
    }

    // 2) GET fallback
    const urls = hosts.map(
      (origin) =>
        `${origin}/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${pageSize}`,
    );
    for (const offUrl of urls) {
      try {
        const res = await fetchWithTimeout(offUrl, { method: 'GET', headers: OFF_SEARCH_HEADERS }, OFF_FETCH_TIMEOUT_MS);
        const text = await res.text();
        const data = parseOffSearchJson(text);
        if (!data?.products?.length) {
          if (__DEV__ && text.trim().startsWith('<')) {
            logger.warn('🍔 OFF GET returned HTML — trying POST/variants next');
          }
          continue;
        }
        const rows = preferQueryRelevantMatches(query, mapOffProductsToRows(data.products, limit), limit);
        if (rows.length > 0) return rows;
      } catch (err) {
        logger.warn('🍔 OFF GET failed', { message: err?.message });
      }
    }
  }

  return [];
}

class FoodSearchProvider {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this._serverUrl = null;
    /** Set when server returns { hint } on empty search */
    this.lastSearchHint = null;
  }

  getLastSearchHint() {
    return this.lastSearchHint || null;
  }

  get serverUrl() {
    if (this._serverUrl == null) this._serverUrl = getServerUrl();
    return this._serverUrl;
  }

  /** Local cache + Open Food Facts when the Cloud Run search API is empty or unreachable. */
  async offlineFoodFallback(query, limit) {
    const q = String(query || '').trim();
    const [cachedFoods, off] = await Promise.all([
      this.getCachedFoods().catch(() => []),
      shouldSkipOffFallback(q) ? Promise.resolve([]) : searchOpenFoodFactsDirect(q, limit).catch(() => []),
    ]);
    const local = (Array.isArray(cachedFoods) ? cachedFoods : []).filter((f) =>
      (f?.name || '').toLowerCase().includes(q.toLowerCase()),
    );
    return [...local, ...off].slice(0, limit);
  }

  /**
   * When the API returns zero rows, only supplement with OFF for plain grocery queries.
   */
  async mergeOfflineWhenServerEmpty(query, limit, serverResults, { serverOk = true } = {}) {
    const q = String(query || '').trim();
    const base = Array.isArray(serverResults) ? serverResults : [];
    if (base.length > 0) return base;

    const requiredBrand = findConsumerBrandInQuery(q);
    const menuStyle = isMenuStyleQuery(q);

    if (serverOk && (requiredBrand || menuStyle)) {
      if (menuStyle && !this.lastSearchHint) {
        this.lastSearchHint =
          'No matching menu item found. Include the restaurant and item (e.g. "Chipotle chicken bowl").';
      }
      if (requiredBrand && !this.lastSearchHint) {
        this.lastSearchHint = `No ${requiredBrand} products matched. Try scanning the barcode or a shorter name.`;
      }
      return [];
    }

    const merged = await this.offlineFoodFallback(q, limit);
    if (merged.length === 0 && menuStyle) {
      this.lastSearchHint =
        'No results yet. Make sure the app can reach your Coach Connect API (Serper/USDA run on the server, not in the app).';
    }
    return merged;
  }

  /**
   * Search for foods using multiple providers
   * Server pipeline: branded/restaurant → FatSecret → Serper → USDA | grocery → USDA → FatSecret → OFF → Serper
   */
  async searchFoods(query, limit = 20) {
    const cacheKey = `search_v38_${query}_${limit}`;
    try {
      this.lastSearchHint = null;
      logger.debug('🍔 Searching foods for', query);
      const q = String(query || '').trim();
      if (!q) return [];
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('🍔 Returning cached search results');
        return Array.isArray(cached) ? cached : [];
      }

      const serverUrl = this.serverUrl;
      const hasServer = !!serverUrl && serverUrl !== 'null' && serverUrl !== 'undefined';

      // Serper/USDA/FatSecret run on the Express API — the phone only calls /api/food/search.
      if (!hasServer) {
        logger.warn('🍔 API base URL missing. Using cached + Open Food Facts only.');
        const merged = await this.offlineFoodFallback(q, limit);
        if (merged.length === 0) {
          this.lastSearchHint = 'Set EXPO_PUBLIC_API_BASE_URL to your Coach Connect API (Cloud Run URL).';
        }
        if (merged.length > 0) this.setCache(cacheKey, merged);
        return merged;
      }

      let authHeaders;
      try {
        authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
      } catch (_) {
        this.lastSearchHint = 'Sign in to search foods on the server.';
        return this.offlineFoodFallback(q, limit);
      }
      if (!authHeaders.Authorization) {
        this.lastSearchHint = 'Sign in to search foods on the server.';
        return this.offlineFoodFallback(q, limit);
      }

      // Try Metro LAN host + env URL — fixes "Network request failed" when EXPO_PUBLIC_API_BASE_URL is stale.
      let response;
      let fetchErr;
      const bases = getResilientApiBases();
      for (const base of bases) {
        const url = `${base}/api/food/search?query=${encodeURIComponent(q)}&limit=${limit}`;
        try {
          logger.debug('🔍 Searching food', { q, url });
          response = await fetchWithTimeout(
            url,
            {
              method: 'GET',
              headers: authHeaders,
            },
            FOOD_SERVER_FETCH_TIMEOUT_MS
          );
          if (__DEV__ && response?.ok) {
            logger.debug('🍔 Food search server', base);
          }
          break;
        } catch (e) {
          fetchErr = e;
          logger.warn('🍔 Food search unreachable', {
            base,
            message: e?.message || e,
            isTimeout: e?.name === 'AbortError',
          });
        }
      }
      if (!response) {
        throw fetchErr || new Error('Network request failed');
      }

      if (!response.ok) {
        const status = response.status;
        const fallbackStatus = status === 401 || status === 403 || status === 404 || status === 429 || status >= 500;
        if (fallbackStatus) {
          logger.warn(`🍔 Server search failed (${status}). Using cached + OFF fallback.`);
          if (shouldSkipOffFallback(q)) {
            this.lastSearchHint =
              'Food search server unavailable. Restaurant and brand searches need the server — try again shortly.';
            return [];
          }
          const merged = await this.offlineFoodFallback(q, limit);
          if (merged.length > 0) this.setCache(cacheKey, merged);
          return merged;
        }
        throw new Error(`Food search failed: ${status}`);
      }

      const data = await response.json();
      this.lastSearchHint = data.hint || null;
      const list = Array.isArray(data.results) ? data.results : [];
      const merged = await this.mergeOfflineWhenServerEmpty(q, limit, list, { serverOk: true });
      if (merged.length === 0 && list.length === 0) {
        this.lastSearchHint = this.lastSearchHint || FOOD_SEARCH_OFFLINE_HINT;
      }
      // Do not cache empty — avoids locking in a failed search for 5 minutes.
      if (merged.length > 0) this.setCache(cacheKey, merged);
      logger.debug(
        `✅ Food search success: server ${list.length} rows; after OFF/cache merge: ${merged.length}`,
      );
      return merged;
    } catch (error) {
      const isNetwork =
        error?.name === 'AbortError' ||
        (error?.message || '').toLowerCase().includes('network') ||
        (error?.name === 'TypeError' && (error?.message || '').includes('fetch'));
      if (isNetwork) {
        const qTrim = String(query || '').trim();
        logger.warn('🍔 Server unreachable; trying cache + Open Food Facts', {
          message: error?.message || String(error),
          menuStyle: isMenuStyleQuery(qTrim),
        });
        try {
          if (shouldSkipOffFallback(qTrim)) {
            if (!this.lastSearchHint) this.lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
            return [];
          }
          const merged = await this.offlineFoodFallback(qTrim, limit);
          if (merged.length > 0) {
            this.setCache(cacheKey, merged);
            logger.debug(`🍔 Fallback returned ${merged.length} results`);
            return merged;
          }
          if (!this.lastSearchHint) this.lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
          logger.warn('🍔 Food search: server unreachable and fallback returned no rows', {
            query: qTrim,
            serverMessage: error?.message,
          });
        } catch (fallbackErr) {
          logger.error('🍔 Food search fallback failed', fallbackErr);
          if (!this.lastSearchHint) this.lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
        }
      } else {
        logger.error('🍔 Error searching foods', error);
      }
      return [];
    }
  }

  /**
   * Lookup food by barcode
   * Provider order: OpenFoodFacts (primary) -> Nutritionix (fallback)
   */
  async lookupBarcode(barcode) {
    const normalized = String(barcode || '').replace(/\D/g, '');
    const lookupCode = normalized.length === 11 ? normalized.padStart(12, '0') : normalized;
    logger.debug('🍔 Looking up barcode', lookupCode);
    const cacheKey = `barcode_v8_${lookupCode}`;

    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.debug('🍔 Returning cached barcode result');
        return cached;
      }

      const authHeaders = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
      if (!authHeaders.Authorization) {
        throw new Error('Sign in to scan barcodes');
      }

      const response = await fetchWithTimeout(
        `${this.serverUrl}/api/food/barcode`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ barcode: lookupCode }),
        },
        FOOD_SERVER_FETCH_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`Barcode lookup failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Cache the result (null results are cached too to avoid repeated calls)
      this.setCache(cacheKey, result);
      
      logger.debug('🍔 Barcode lookup result', result ? 'Found' : 'Not found');
      return result;
    } catch (error) {
      const isNetwork =
        error?.name === 'AbortError' ||
        (error?.message || '').toLowerCase().includes('network') ||
        (error?.name === 'TypeError' && (error?.message || '').includes('fetch'));
      if (isNetwork) {
        try {
          const res = await fetchWithTimeout(
            `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(lookupCode)}.json`,
            { headers: OFF_SEARCH_HEADERS },
            OFF_FETCH_TIMEOUT_MS
          );
          const data = await res.json();
          if (data?.product) {
            const result = normalizeOpenFoodFactsProduct(data.product);
            if (result) {
              this.setCache(cacheKey, result);
              return result;
            }
          }
        } catch (e) {
          logger.warn('🍔 Barcode fallback failed', { message: e?.message || String(e) });
        }
      }
      return null;
    }
  }

  /**
   * Get data from cache
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    
    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set data in cache
   */
  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cached foods from AsyncStorage
   */
  async getCachedFoods() {
    try {
      const cached = await AsyncStorage.getItem('COACHCONNECT_FOOD_CACHE');
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      logger.error('Error getting cached foods', error);
      return [];
    }
  }

  /**
   * Save foods to AsyncStorage cache
   */
  async saveCachedFoods(foods) {
    try {
      await AsyncStorage.setItem('COACHCONNECT_FOOD_CACHE', JSON.stringify(foods));
    } catch (error) {
      logger.error('Error saving cached foods', error);
    }
  }

  /**
   * Extended nutrition label lookup for facts screen enrichment.
   */
  async fetchNutritionDetails(queryText) {
    const q = String(queryText || '').trim();
    if (!q) return null;
    try {
      const base = getServerUrl();
      if (!base) return null;
      const headers = await getApiAuthHeaders();
      const url = `${base}/api/food/nutrition-details?q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      logger.debug('fetchNutritionDetails failed', error?.message);
      return null;
    }
  }

  /**
   * Clear all caches
   */
  clearAllCaches() {
    this.cache.clear();
    AsyncStorage.removeItem('COACHCONNECT_FOOD_CACHE');
  }
}

export default new FoodSearchProvider();
