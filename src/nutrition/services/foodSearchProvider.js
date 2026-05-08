/**
 * Food Search Provider
 * Single source of truth for all food search operations
 * Integrates with server endpoints for secure API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getApiBase, getApiBaseCandidates } from '../../shared/services/baseUrl';

const { normalizeOpenFoodFactsProduct } = require('../utils/nutritionNormalization');

/** Open Food Facts requires an identifiable User-Agent (otherwise HTML/blocks → JSON parse errors). */
const OPEN_FOOD_FACTS_USER_AGENT =
  'CoachConnect/1.0 (Mobile; https://github.com/coachconnect; contact: support@coachconnect.app)';

/** Shown when the phone cannot reach your Express API and OFF also fails (no keys on device for USDA/Serper). */
export const FOOD_SEARCH_OFFLINE_HINT =
  "Food search needs your Coach Connect server on Wi‑Fi (port 4000). Set EXPO_PUBLIC_API_BASE_URL to your computer's LAN IP — on a real phone, localhost never reaches your Mac. Then restaurant items work.";

function getServerUrl() {
  return String(getApiBase() || '').replace(/\/$/, '');
}

function isPhysicalDevice() {
  return Constants.isDevice === true;
}

function isLoopbackBase(base) {
  return /localhost|127\.0\.0\.1/i.test(String(base || ''));
}

/**
 * Bases to try for /api/food/search when the primary URL fails (wrong LAN IP, server moved, etc.).
 * On a physical phone, localhost/127.0.0.1 point at the phone — skip them (they always fail).
 */
function getFoodSearchServerBases() {
  const list = [];
  const push = (u) => {
    const s = String(u || '').trim().replace(/\/$/, '');
    if (!s || list.includes(s)) return;
    if (isPhysicalDevice() && isLoopbackBase(s)) return;
    list.push(s);
  };

  const uriCandidates = [
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
  ];
  for (const uri of uriCandidates) {
    if (typeof uri !== 'string') continue;
    const host = uri.split(':')[0]?.trim();
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      push(`http://${host}:4000`);
    }
  }

  push(getApiBase());
  getApiBaseCandidates().forEach(push);
  return list;
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

// Same shape as server returns — used when server is unreachable
async function searchOpenFoodFactsDirect(query, limit = 20) {
  const pageSize = Math.min(Math.max(limit, 1), 24);
  const variants = openFoodFactsQueryVariants(query);
  if (variants.length === 0) return [];

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
        const res = await fetch(`${origin}/cgi/search.pl`, {
          method: 'POST',
          headers: {
            ...OFF_SEARCH_HEADERS,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });
        const text = await res.text();
        const data = parseOffSearchJson(text);
        if (data?.products?.length) {
          const rows = mapOffProductsToRows(data.products, limit);
          if (rows.length > 0) return rows;
        }
      } catch (err) {
        if (__DEV__) console.warn('🍔 OFF POST failed:', origin, err?.message);
      }
    }

    // 2) GET fallback
    const urls = hosts.map(
      (origin) =>
        `${origin}/cgi/search.pl?search_terms=${encoded}&search_simple=1&action=process&json=1&page_size=${pageSize}`,
    );
    for (const offUrl of urls) {
      try {
        const res = await fetch(offUrl, { method: 'GET', headers: OFF_SEARCH_HEADERS });
        const text = await res.text();
        const data = parseOffSearchJson(text);
        if (!data?.products?.length) {
          if (__DEV__ && text.trim().startsWith('<')) {
            console.warn('🍔 OFF GET returned HTML — trying POST/variants next');
          }
          continue;
        }
        const rows = mapOffProductsToRows(data.products, limit);
        if (rows.length > 0) return rows;
      } catch (err) {
        if (__DEV__) console.warn('🍔 OFF GET failed:', err?.message);
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

  /**
   * Search for foods using multiple providers
   * Provider order: Nutritionix (primary) -> USDA (fallback)
   */
  async searchFoods(query, limit = 20) {
    const cacheKey = `search_${query}_${limit}`;
    try {
      this.lastSearchHint = null;
      if (__DEV__) console.log('🍔 Searching foods for:', query);
      const q = String(query || '').trim();
      if (!q) return [];
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        if (__DEV__) console.log('🍔 Returning cached search results');
        return Array.isArray(cached) ? cached : [];
      }

      const appSecret = process.env.EXPO_PUBLIC_APP_SECRET;
      const serverUrl = this.serverUrl;
      const hasServer = !!serverUrl && serverUrl !== 'null' && serverUrl !== 'undefined';
      const hasSecret = !!appSecret;
      if (__DEV__) console.log('🔑 APP_SECRET being sent:', hasSecret ? 'SET' : 'UNDEFINED');

      // If server URL or secret is missing, fall back immediately.
      if (!hasServer || !hasSecret) {
        if (__DEV__) console.warn('🍔 Server URL/secret missing. Using cached + Open Food Facts fallback.');
        const [cachedFoods, off] = await Promise.all([
          this.getCachedFoods().catch(() => []),
          searchOpenFoodFactsDirect(q, limit).catch(() => []),
        ]);
        const local = (Array.isArray(cachedFoods) ? cachedFoods : []).filter((f) =>
          (f?.name || '').toLowerCase().includes(q.toLowerCase()),
        );
        const merged = [...local, ...off].slice(0, limit);
        this.setCache(cacheKey, merged);
        return merged;
      }

      // Try Metro LAN host + env URL — fixes "Network request failed" when EXPO_PUBLIC_API_BASE_URL is stale.
      let response;
      let fetchErr;
      const bases = getFoodSearchServerBases();
      for (const base of bases) {
        const url = `${base}/api/food/search?query=${encodeURIComponent(q)}&limit=${limit}`;
        try {
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-app-secret': appSecret || '',
            },
          });
          if (__DEV__ && response?.ok) {
            if (__DEV__) console.log('🍔 Food search server:', base);
          }
          break;
        } catch (e) {
          fetchErr = e;
          if (__DEV__) {
            if (__DEV__) console.warn('🍔 Food search unreachable at', base, e?.message || e);
          }
        }
      }
      if (!response) {
        throw fetchErr || new Error('Network request failed');
      }

      if (!response.ok) {
        // Treat auth/config/server issues as "fallback-worthy" so search still works.
        const status = response.status;
        const fallbackStatus = status === 401 || status === 403 || status === 404 || status === 429 || status >= 500;
        if (fallbackStatus) {
          if (__DEV__) console.warn(`🍔 Server search failed (${status}). Using cached + Open Food Facts fallback.`);
          const [cachedFoods, off] = await Promise.all([
            this.getCachedFoods().catch(() => []),
            searchOpenFoodFactsDirect(q, limit).catch(() => []),
          ]);
          const local = (Array.isArray(cachedFoods) ? cachedFoods : []).filter((f) =>
            (f?.name || '').toLowerCase().includes(q.toLowerCase()),
          );
          const merged = [...local, ...off].slice(0, limit);
          this.setCache(cacheKey, merged);
          return merged;
        }
        throw new Error(`Food search failed: ${status}`);
      }

      const data = await response.json();
      this.lastSearchHint = data.hint || null;
      const list = Array.isArray(data.results) ? data.results : [];
      this.setCache(cacheKey, list);
      if (__DEV__) console.log(`🍔 Found ${list.length} foods from server`);
      return list;
    } catch (error) {
      const isNetwork = (error?.message || '').toLowerCase().includes('network') || (error?.name === 'TypeError' && (error?.message || '').includes('fetch'));
      if (__DEV__) console.error('🍔 Error searching foods:', error?.message || error);
      if (isNetwork) {
        if (__DEV__) console.warn('🍔 Server unreachable. Using Open Food Facts directly so search still works.');
        try {
          const [cachedFoods, off] = await Promise.all([
            this.getCachedFoods().catch(() => []),
            searchOpenFoodFactsDirect(String(query || '').trim(), limit).catch(() => []),
          ]);
          const q = String(query || '').trim();
          const local = (Array.isArray(cachedFoods) ? cachedFoods : []).filter((f) =>
            (f?.name || '').toLowerCase().includes(q.toLowerCase()),
          );
          const merged = [...local, ...off].slice(0, limit);
          if (merged.length > 0) {
            this.setCache(cacheKey, merged);
            if (__DEV__) console.log(`🍔 Fallback returned ${merged.length} results`);
            return merged;
          }
          this.lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
        } catch (fallbackErr) {
          if (__DEV__) console.warn('🍔 Fallback search failed:', fallbackErr?.message || fallbackErr);
          this.lastSearchHint = FOOD_SEARCH_OFFLINE_HINT;
        }
      }
      return [];
    }
  }

  /**
   * Lookup food by barcode
   * Provider order: OpenFoodFacts (primary) -> Nutritionix (fallback)
   */
  async lookupBarcode(barcode) {
    if (__DEV__) console.log('🍔 Looking up barcode:', barcode);
    const cacheKey = `barcode_${barcode}`;

    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        if (__DEV__) console.log('🍔 Returning cached barcode result');
        return cached;
      }

      // Call server endpoint
      const response = await fetch(`${this.serverUrl}/api/food/barcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-secret': process.env.EXPO_PUBLIC_APP_SECRET,
        },
        body: JSON.stringify({ barcode }),
      });

      if (!response.ok) {
        throw new Error(`Barcode lookup failed: ${response.status}`);
      }

      const result = await response.json();
      
      // Cache the result (null results are cached too to avoid repeated calls)
      this.setCache(cacheKey, result);
      
      if (__DEV__) console.log(`🍔 Barcode lookup result:`, result ? 'Found' : 'Not found');
      return result;
    } catch (error) {
      const isNetwork = (error?.message || '').toLowerCase().includes('network') || (error?.name === 'TypeError' && (error?.message || '').includes('fetch'));
      if (isNetwork) {
        try {
          const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`);
          const data = await res.json();
          if (data?.product) {
            const result = normalizeOpenFoodFactsProduct(data.product);
            if (result) {
              this.setCache(cacheKey, result);
              return result;
            }
          }
        } catch (e) {
          if (__DEV__) console.warn('🍔 Barcode fallback failed:', e?.message || e);
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
      if (__DEV__) console.error('Error getting cached foods:', error);
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
      if (__DEV__) console.error('Error saving cached foods:', error);
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
