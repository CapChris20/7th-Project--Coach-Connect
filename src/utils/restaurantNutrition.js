/**
 * restaurant Nutrition
 *
 * Purpose: restaurant Nutrition — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/utils
 * Key exports: (see file)
 *
 * @file-header
 */
/**
 * Restaurant nutrition: detect restaurant queries, build search query, and run
 * full pipeline (Firestore cache + server extraction). Returns structured macros only.
 */

import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../app/config';
import { getApiBase } from '../shared/api/baseUrl';
import { getApiAuthHeaders } from '../shared/api/getAuthHeaders';
import { isMenuStyleQuery } from '../nutrition/food-search/rankFoodSearchResults';

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

function getServerUrl() {
  return String(getApiBase() || '').replace(/\/$/, '');
}

const COLLECTION = 'restaurantNutrition';

/**
 * Returns cached document data in the required shape, or null.
 */
function toReturnShape(docData) {
  if (!docData) return null;
  return {
    name: docData.name,
    calories: docData.calories,
    protein: docData.protein,
    carbs: docData.carbs,
    fat: docData.fat,
    serving_description: docData.serving_description ?? '',
    source_url: docData.source_url ?? '',
  };
}

/**
 * Full pipeline: check Firestore cache by normalizedName, else call server to extract
 * (web search + fetch first URL + OpenAI), then cache and return. Returns structured
 * { name, calories, protein, carbs, fat, serving_description, source_url } or null.
 * @param {string} query - e.g. "10 McNuggets", "Wendy's Dave's Single"
 * @returns {Promise<{ name: string, calories: number, protein: number, carbs: number, fat: number, serving_description: string, source_url: string } | null>}
 */
async function searchRestaurantNutrition(query) {
  const normalized = typeof query === 'string' ? query.toLowerCase().trim() : '';
  if (!normalized) return null;

  try {
    if (db) {
      const q = query(
        collection(db, COLLECTION),
        where('normalizedName', '==', normalized)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const doc = snap.docs[0];
        const data = doc.data();
        return toReturnShape(data);
      }
    }
  } catch (cacheErr) {
    console.warn('Restaurant nutrition cache read failed:', cacheErr?.message);
  }

  try {
    const base = getServerUrl();
    const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
    if (!headers.Authorization) return null;

    const res = await fetch(`${base}/api/nutrition/restaurant`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: normalized }),
    });
    if (!res.ok) return null;
    const result = await res.json();
    if (!result || typeof result !== 'object') return null;

    const out = toReturnShape(result);
    if (!out) return null;

    try {
      if (db) {
        await addDoc(collection(db, COLLECTION), {
          normalizedName: normalized,
          name: out.name,
          calories: out.calories,
          protein: out.protein,
          carbs: out.carbs,
          fat: out.fat,
          serving_description: out.serving_description,
          source_url: out.source_url,
          createdAt: serverTimestamp(),
        });
      }
    } catch (writeErr) {
      console.warn('Restaurant nutrition cache write failed:', writeErr?.message);
    }

    return out;
  } catch (err) {
    console.warn('Restaurant nutrition search failed:', err?.message);
    return null;
  }
}

export {
  detectRestaurantQuery,
  buildRestaurantSearchQuery,
  searchRestaurantNutrition,
};
