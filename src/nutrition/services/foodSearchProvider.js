/**
 * Food Search Provider
 * Single source of truth for all food search operations
 * Integrates with server endpoints for secure API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBase } from '../../shared/services/baseUrl';

const { normalizeOpenFoodFactsProduct } = require('../utils/nutritionNormalization');

function getServerUrl() {
  return String(getApiBase() || '').replace(/\/$/, '');
}

// Same shape as server returns — used when server is unreachable (e.g. device without EXPO_PUBLIC_API_BASE_URL)
function searchOpenFoodFactsDirect(query, limit = 20) {
  const offUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=${Math.min(limit, 24)}`;
  return fetch(offUrl, { method: 'GET' })
    .then((res) => res.json())
    .then((data) => {
      if (!data?.products?.length) return [];
      return data.products
        .filter((p) => p.product_name && (p.nutriments?.['energy-kcal_100g'] != null || p.nutriments?.energy_100g != null))
        .slice(0, limit)
        .map((p) => {
          const normalized = normalizeOpenFoodFactsProduct(p);
          if (normalized) return normalized;
          const kcal = p.nutriments?.['energy-kcal_100g'] ?? (p.nutriments?.energy_100g ? Math.round(p.nutriments.energy_100g / 4.184) : 0);
          return {
            id: p.code || `off_${Date.now()}_${Math.random()}`,
            name: p.product_name,
            brand: p.brands || null,
            restaurant: null,
            calories: kcal,
            protein: p.nutriments?.proteins_100g ?? 0,
            carbs: p.nutriments?.carbohydrates_100g ?? 0,
            fat: p.nutriments?.fat_100g ?? 0,
            fiber: p.nutriments?.fiber_100g ?? null,
            sodium: p.nutriments?.sodium_100g ? p.nutriments.sodium_100g * 1000 : null,
            sugar: p.nutriments?.sugars_100g ?? null,
            servingSize: 1,
            servingUnit: 'grams',
            servingGrams: 100,
            source: 'openfoodfacts',
          };
        });
    })
    .catch((err) => {
      console.warn('🍔 Open Food Facts direct fallback failed:', err?.message || err);
      return [];
    });
}

class FoodSearchProvider {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this._serverUrl = null;
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
      console.log('🍔 Searching foods for:', query);
      
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('🍔 Returning cached search results');
        return Array.isArray(cached) ? cached : [];
      }

      const url = `${this.serverUrl}/api/food/search?query=${encodeURIComponent(query)}&limit=${limit}`;
      const appSecret = process.env.EXPO_PUBLIC_APP_SECRET;
      console.log('🔑 APP_SECRET being sent:', appSecret ? 'SET' : 'UNDEFINED');
      
      // Call server endpoint
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-app-secret': appSecret || '',
        },
      });

      if (!response.ok) {
        throw new Error(`Food search failed: ${response.status}`);
      }

      const data = await response.json();
      const list = Array.isArray(data.results) ? data.results : [];
      this.setCache(cacheKey, list);
      console.log(`🍔 Found ${list.length} foods from server`);
      return list;
    } catch (error) {
      const isNetwork = (error?.message || '').toLowerCase().includes('network') || (error?.name === 'TypeError' && (error?.message || '').includes('fetch'));
      console.error('🍔 Error searching foods:', error?.message || error);
      if (isNetwork) {
        console.warn('🍔 Server unreachable. Using Open Food Facts directly so search still works.');
        try {
          const fallbackResults = await searchOpenFoodFactsDirect(query, limit);
          if (fallbackResults.length > 0) {
            this.setCache(cacheKey, fallbackResults);
            console.log(`🍔 Open Food Facts fallback returned ${fallbackResults.length} results`);
            return fallbackResults;
          }
        } catch (fallbackErr) {
          console.warn('🍔 Fallback search failed:', fallbackErr?.message || fallbackErr);
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
    console.log('🍔 Looking up barcode:', barcode);
    const cacheKey = `barcode_${barcode}`;

    try {
      // Check cache first
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('🍔 Returning cached barcode result');
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
      
      console.log(`🍔 Barcode lookup result:`, result ? 'Found' : 'Not found');
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
          console.warn('🍔 Barcode fallback failed:', e?.message || e);
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
      console.error('Error getting cached foods:', error);
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
      console.error('Error saving cached foods:', error);
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
