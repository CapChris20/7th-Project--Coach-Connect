// Writes and reads today's food log rows (Breakfast, a Big Mac, Quick Add).
// Flow: flatten the card → scale per-100g numbers → write nutrition_logs → remember the food for next time.
// Used by the Nutrition tab and the AI coach log/delete tools.
// Read order: constants → small helpers → exported recipes → PLUMBING (Firestore helpers) at the bottom.

import { db } from '../../app-start/cloudConnection';
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, setDoc, serverTimestamp, limit as limitFn } from 'firebase/firestore';
import foodSearchApi from '../food-search/searchFoods';
export { FOOD_SEARCH_OFFLINE_HINT } from '../food-search/searchFoods';
import { reportCrashAutomaticallySync } from '../../crash-reports/reportCrashAutomatically';
import { stripUndefinedForFirestore } from '../../helpers/cleanDataBeforeSaving';
import { normalizeFoodForLog, isLiquidFood } from '../food-search/cleanSearchText';
import { normalizeFoodRecordForStorage } from '../food-search/readableFoodTitle';
import { isPer100gSource, resolveServingGrams } from '../food-details/servingSizeMath';

// ===== NAMED CONSTANTS =====

// vocab: nutrition_logs / nutrition_goals / users = Firestore collection ids (letters frozen)
const LOGS_COLLECTION = 'nutrition_logs';
const GOALS_COLLECTION = 'nutrition_goals';
const USERS_COLLECTION = 'users';

// Manipulate here: how many remembered foods stay on the phone
const MAX_CACHE_ITEMS = 50;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_SECOND = 1000;

// Manipulate here: clamp ceilings so one bad card cannot blow the daily totals
const MAX_CALORIES = 5000;
const MAX_PROTEIN_G = 500;
const MAX_CARBS_G = 500;
const MAX_FAT_G = 300;
const MAX_FIBER_G = 100;
const MAX_SUGAR_G = 200;
const MAX_SODIUM_MG = 10000;
const MAX_POTASSIUM_MG = 10000;
const MAX_SERVING_GRAMS = 2000;
const DEFAULT_CALORIE_TARGET = 2200;
const DEFAULT_PROTEIN_TARGET = 150;
const DEFAULT_CARBS_TARGET = 220;
const DEFAULT_FAT_TARGET = 70;
const METADATA_FLATTEN_DEPTH = 6;
const HISTORY_NAME_SLUG_MAX = 48;
const HISTORY_SOURCE_MAX = 12;
const RECENT_LOGS_FETCH_LIMIT = 80;
const DATES_WITH_LOGS_LIMIT = 400;
const TOP_LOGGED_FETCH_LIMIT = 100;
const FAVORITE_FOODS_CAP = 100;
const GRAMS_PER_OFF_SERVING = 100;
const DEFAULT_FOOD_NAME = 'Food Item';
const FALLBACK_APPLE = {
  id: 'fallback-1',
  name: 'Apple',
  calories: 52,
  protein: 0.3,
  carbs: 14,
  fat: 0.2,
  servingSize: 1,
  servingUnit: 'medium'
};

// ===== HELPER FUNCTIONS =====
// Tiny pure helpers the recipes call by name. Heavy Firestore work lives under PLUMBING.

function safeNumberOrZero(value) {
  const numericValue = Number(value);
  if (typeof numericValue === 'number' && !Number.isNaN(numericValue)) {
    return numericValue;
  }
  return 0;
}
function getDefaultGoals() {
  return {
    calories: DEFAULT_CALORIE_TARGET,
    proteinTarget: DEFAULT_PROTEIN_TARGET,
    carbsTarget: DEFAULT_CARBS_TARGET,
    fatTarget: DEFAULT_FAT_TARGET,
    macroSplit: {
      protein: 0.3,
      carbs: 0.4,
      fat: 0.3
    }
  };
}

/**
 * Serving count from the Confirm sheet, else from the card, else 1.
 * @param {object} log
 * @param {object} food
 * @returns {number}
 */
function howManyServings(log, food) {
  let rawServingCount;
  if (log.servingSize != null && log.servingSize !== '') {
    rawServingCount = Number(log.servingSize);
  } else if (food.servingSize != null && food.servingSize !== '') {
    rawServingCount = Number(food.servingSize);
  } else {
    rawServingCount = NaN;
  }
  if (typeof rawServingCount === 'number' && !Number.isNaN(rawServingCount) && rawServingCount > 0) {
    return rawServingCount;
  }
  return 1;
}

/**
 * USDA / Open Food Facts store numbers per 100g unless the card says logged_total.
 * @param {object} food
 * @returns {boolean}
 */
function numbersArePerHundredGrams(food) {
  const sourceIsPerHundred = food.source === 'openfoodfacts' || food.source === 'usda';
  const basisIsLoggedTotal = String(food.dataBasis || '').toLowerCase() === 'logged_total';
  return sourceIsPerHundred && !basisIsLoggedTotal;
}

/**
 * Drop cache rows that match this product id or readable name.
 * @param {object[]} cachedFoods
 * @param {string} productId
 * @param {string} productName
 * @returns {object[]}
 */
function cacheRowsWithoutThisProduct(cachedFoods, productId, productName) {
  const withoutDuplicate = [];
  const targetName = normalizeHistoryName(productName);
  for (const item of cachedFoods) {
    const sameId = item.id === productId;
    const sameName = normalizeHistoryName(item.name || item.food_name) === targetName;
    const isDuplicate = sameId || sameName;
    if (isDuplicate) continue;
    withoutDuplicate.push(item);
  }
  return withoutDuplicate;
}

/**
 * Find one food card in a cache list by id.
 * @param {object[]} cachedFoods
 * @param {string} foodId
 * @returns {object|null}
 */
function findCachedFoodById(cachedFoods, foodId) {
  for (const food of cachedFoods) {
    if (food.id === foodId) return food;
  }
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * Stable id for saved / recent foods (works for Quick Add items without barcode id).
 * @param {object} food
 * @returns {string}
 */
export function buildFoodHistoryId(food) {
  // 1. Prefer readable name; fall back to a timestamp id when the card has no name.
  let rawHistoryName = '';
  if (food && food.name) rawHistoryName = food.name;
  else if (food && food.food_name) rawHistoryName = food.food_name;
  const historyName = normalizeHistoryName(rawHistoryName);
  if (!historyName) return `hist_${Date.now()}`;

  // 2. Slug the name + short source so the same food reopens the same history row.
  const nameSlug = historyName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, HISTORY_NAME_SLUG_MAX);
  let foodSource = 'manual';
  if (food && food.source) foodSource = food.source;
  const sourceShort = String(foodSource).slice(0, HISTORY_SOURCE_MAX);
  return `hist_${sourceShort}_${nameSlug || 'food'}`;
}

/**
 * Per-serving template for re-logging (Quick Add, search, barcode, coach).
 * Food key letters stay name / food_name / brand / calories / …
 * @param {object} food
 * @returns {object|null}
 */
export function buildFoodHistoryEntry(food) {
  // 1. One canonical food card shape before we copy numbers into history.
  const normalizedFood = normalizeFoodRecordForStorage(normalizeFoodForLog(food));
  let rawFoodName = '';
  if (normalizedFood && normalizedFood.name) rawFoodName = normalizedFood.name;
  else if (normalizedFood && normalizedFood.food_name) rawFoodName = normalizedFood.food_name;
  const foodName = String(rawFoodName).trim();
  if (!foodName) return null;

  // 2. Serving count on the card decides whether we divide logged totals per serving.
  const servingCount = Number(normalizedFood.servingSize) || 1;
  const usesLabelServing = normalizedFood.dataBasis === 'label_serving' || isPer100gSource(normalizedFood.source);
  const historyEntry = {
    id: normalizedFood.id || buildFoodHistoryId(normalizedFood),
    name: foodName,
    food_name: foodName,
    brand: normalizedFood.brand || '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    potassium: 0,
    servingSize: 1,
    serving_size: 1,
    servingGrams: 100,
    serving_grams: 100,
    servingUnit: normalizedFood.servingUnit || normalizedFood.serving_unit || 'serving',
    serving_unit: normalizedFood.servingUnit || normalizedFood.serving_unit || 'serving',
    source: normalizedFood.source || 'manual',
    dataBasis: usesLabelServing ? normalizedFood.dataBasis : 'logged_totals',
    labelServingGrams: normalizedFood.labelServingGrams,
    fromRecentLog: normalizedFood.dataBasis === 'logged_totals',
    savedAt: Date.now()
  };

  // 3. Fill per-serving macros; label-serving cards keep package numbers as-is.
  fillLoggedTotalsHistory(historyEntry, normalizedFood, servingCount);
  if (historyEntry.dataBasis !== 'logged_totals') {
    fillLabelServingHistory(historyEntry, normalizedFood);
  }
  return historyEntry;
}

/**
 * Load calorie / macro targets for the Nutrition tab rings.
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getDailyGoals(userId) {
  if (!userId || !db) return getDefaultGoals();
  try {
    // 1. Read nutrition_goals/{userId}.
    const goalDocRef = doc(db, GOALS_COLLECTION, userId);
    const goalDoc = await getDoc(goalDocRef);
    if (!goalDoc.exists()) {
      return getDefaultGoals();
    }

    // 2. Accept either snake_case or camelCase field letters (both exist in older docs).
    const goalData = goalDoc.data();
    return {
      calories: goalData.calorie_target || goalData.calories,
      proteinTarget: goalData.protein_target || goalData.proteinTarget,
      carbsTarget: goalData.carbs_target || goalData.carbsTarget,
      fatTarget: goalData.fat_target || goalData.fatTarget,
      macroSplit: goalData.macro_split || goalData.macroSplit || {
        protein: 0.3,
        carbs: 0.4,
        fat: 0.3
      }
    };
  } catch (error) {
    if (__DEV__) console.warn('Failed to load goals, using default:', error.message);
    reportCrashAutomaticallySync(error, 'nutritionService - getDailyGoals');
    return getDefaultGoals();
  }
}

/**
 * Create or merge daily goal targets for one user.
 * @param {string} userId
 * @param {object} goals
 */
export async function upsertDailyGoals(userId, goals) {
  if (!userId || !db) return;
  try {
    // 1. Write snake_case field letters the rest of the app already reads.
    const goalDocRef = doc(db, GOALS_COLLECTION, userId);
    await setDoc(goalDocRef, {
      user_id: userId,
      calorie_target: goals.calories,
      protein_target: goals.proteinTarget,
      carbs_target: goals.carbsTarget,
      fat_target: goals.fatTarget,
      macro_split: goals.macroSplit,
      updated_at: serverTimestamp()
    }, {
      merge: true
    });
  } catch (error) {
    if (__DEV__) console.error('Failed to upsert goals:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - upsertDailyGoals');
    throw error;
  }
}

/**
 * Every food row logged on one calendar day (oldest first).
 * @param {string} userId
 * @param {Date|string} [date]
 * @returns {Promise<object[]>}
 */
export async function getFoodLogsForDate(userId, date = new Date()) {
  if (!userId || !db) return [];
  const dateKey = toDateKey(date);
  try {
    // 1. Query nutrition_logs for this user + YYYY-MM-DD.
    const logsRef = collection(db, LOGS_COLLECTION);
    const logsQuery = query(logsRef, where('user_id', '==', userId), where('date', '==', dateKey));

    // 2. Turn each doc into a typed log row, then sort oldest → newest.
    const querySnapshot = await getDocs(logsQuery);
    const logsForDay = [];
    querySnapshot.forEach(logDoc => {
      logsForDay.push(foodLogFromFirestoreDoc(logDoc));
    });
    return sortLogsOldestFirst(logsForDay);
  } catch (error) {
    if (__DEV__) console.error('Failed to load food logs:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - getFoodLogsForDate');
    return [];
  }
}

/**
 * Add one food to that day's meal. Export name stays addFoodLog.
 * Flow: 1. signed-in user  2. flatten the card  3. servings  4. scale per-100g  5. write  6. history
 * @param {string} userId
 * @param {object} log
 * @returns {Promise<object>}
 */
export async function addFoodLog(userId, log) {
  if (!userId || !db) throw new Error('User required');

  // 1. Turn the card into a flat, clamped food we can store.
  const rawFood = log.food || {};
  const food = normalizeFoodRecordForStorage(clampNutrition(flattenFoodForMetadata(rawFood)));

  // 2. How many servings the Confirm sheet asked for.
  const servingQuantity = howManyServings(log, food);

  // 3. USDA / Open Food Facts numbers are per 100g. Manual and FatSecret are already totals.
  const totals = totalsFromFood(food, servingQuantity);
  if (__DEV__) console.log('🍎 Adding food log:', {
    name: food.name,
    source: food.source,
    servingQuantity,
    servingGrams: totals.servingGrams,
    totalCalories: totals.calories
  });

  // 4. Field names stay food_name / calories / protein (letters frozen).
  const payload = buildFoodLogPayload(userId, log, food, servingQuantity, totals);
  const safePayload = stripUndefinedForFirestore(payload);
  try {
    // 5. Write one row on nutrition_logs, then quietly remember the food for search cache.
    console.log('💾 Saving to Firestore:', {
      food_name: payload.food_name,
      calories: payload.calories,
      serving_size: payload.serving_size,
      serving_grams: payload.serving_grams
    });
    const docRef = await addDoc(collection(db, LOGS_COLLECTION), safePayload);
    if (__DEV__) console.log('✅ Saved successfully with ID:', docRef.id);

    // 6. History save must not fail the log write.
    await saveHistoryQuietly(food);
    return {
      id: docRef.id,
      ...safePayload
    };
  } catch (error) {
    if (__DEV__) console.error('Failed to add food log:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - addFoodLog');
    throw error;
  }
}

/**
 * Patch fields on one existing nutrition_logs row.
 * @param {string} logId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
export async function updateFoodLog(logId, updates) {
  if (!db || !logId) throw new Error('Invalid parameters');
  try {
    // 1. Merge updates + stamp updated_at.
    const logDocRef = doc(db, LOGS_COLLECTION, logId);
    await updateDoc(logDocRef, {
      ...updates,
      updated_at: serverTimestamp()
    });

    // 2. Re-read so callers get the saved shape.
    const updatedDoc = await getDoc(logDocRef);
    if (updatedDoc.exists()) {
      return {
        id: updatedDoc.id,
        ...updatedDoc.data()
      };
    }
    return null;
  } catch (error) {
    if (__DEV__) console.error('Failed to update food log:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - updateFoodLog');
    throw error;
  }
}

/**
 * Delete one nutrition_logs row by id.
 * @param {string} logId
 */
export async function deleteFoodLog(logId) {
  if (!db || !logId) throw new Error('Invalid parameters');
  try {
    await deleteDoc(doc(db, LOGS_COLLECTION, logId));
  } catch (error) {
    if (__DEV__) console.error('Failed to delete food log:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - deleteFoodLog');
    throw error;
  }
}

/**
 * Delete nutrition log(s) for a date — used by Nutrition tab and AI Coach.
 * @param {string} userId
 * @param {{ date?: *, foodName?: string, logId?: string, deleteAll?: boolean }} [options]
 * @returns {Promise<{ deletedCount: number, deletedNames: string[] }>}
 */
export async function deleteFoodLogsForDate(userId, {
  date,
  foodName,
  logId,
  deleteAll = false
} = {}) {
  if (!userId || !db) throw new Error('User required');

  // 1. Coach or UI passed a single row id — delete just that doc.
  if (logId) {
    await deleteFoodLog(logId);
    return {
      deletedCount: 1,
      deletedNames: foodName ? [String(foodName)] : ['entry']
    };
  }

  // 2. Load every log for the day, then narrow by name / delete-all / newest-only rules.
  const logsForDay = await getFoodLogsForDate(userId, date || new Date());
  const rowsToDelete = pickDeleteTargets(logsForDay, {
    foodName,
    deleteAll
  });
  if (!rowsToDelete.length) {
    return {
      deletedCount: 0,
      deletedNames: []
    };
  }

  // 3. Remove each matched row from nutrition_logs.
  for (const logRow of rowsToDelete) {
    await deleteFoodLog(logRow.id);
  }
  const deletedNames = [];
  for (const logRow of rowsToDelete) {
    deletedNames.push(logRow.food_name || 'Food item');
  }
  return {
    deletedCount: rowsToDelete.length,
    deletedNames
  };
}

/**
 * Sum macros across a list of log rows (rounded for the daily rings).
 * @param {object[]} [logs]
 * @returns {object}
 */
export function calculateMacroTotals(logs = []) {
  const runningTotals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
    potassium: 0
  };
  const safeLogs = logs || [];
  for (const item of safeLogs) {
    runningTotals.calories += Number(item.calories) || 0;
    runningTotals.protein += Number(item.protein) || 0;
    runningTotals.carbs += Number(item.carbs) || 0;
    runningTotals.fat += Number(item.fat) || 0;
    runningTotals.fiber += Number(item.fiber) || 0;
    runningTotals.sugar += Number(item.sugar) || 0;
    runningTotals.sodium += Number(item.sodium) || 0;
    runningTotals.potassium += Number(item.potassium) || 0;
  }
  const formattedTotals = {
    calories: Math.round(runningTotals.calories),
    protein: Math.round(runningTotals.protein * 10) / 10,
    carbs: Math.round(runningTotals.carbs * 10) / 10,
    fat: Math.round(runningTotals.fat * 10) / 10,
    fiber: Math.round(runningTotals.fiber * 10) / 10,
    sugar: Math.round(runningTotals.sugar * 10) / 10,
    sodium: Math.round(runningTotals.sodium),
    potassium: Math.round(runningTotals.potassium)
  };
  if (__DEV__) {
    console.log('🧮 calculateMacroTotals: Processed', safeLogs.length, 'logs, totals:', formattedTotals);
  }
  return formattedTotals;
}

/**
 * Bucket log rows into breakfast / lunch / dinner / snacks.
 * @param {object[]} [logs]
 * @returns {object}
 */
export function splitLogsByMeal(logs = []) {
  const meals = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: []
  };
  for (const logRow of logs) {
    const mealKey = logRow.meal_type || 'snacks';
    if (!meals[mealKey]) {
      meals[mealKey] = [];
    }
    meals[mealKey].push(logRow);
  }
  return meals;
}

/**
 * Remember a food on the phone after it was logged.
 * @param {object} food
 */
export async function saveFoodToHistory(food) {
  const historyEntry = buildFoodHistoryEntry(food);
  if (!historyEntry) return;
  await cacheFoodProduct(historyEntry);
}

/**
 * Upsert one food into the on-device search cache (newest first, capped).
 * @param {object} product
 */
export async function cacheFoodProduct(product) {
  try {
    if (!product) return;
    const productId = product.id || buildFoodHistoryId(product);
    const productName = String(product.name || product.food_name || '').trim();
    if (!productName) return;

    // 1. Drop older rows with the same id or same readable name.
    const cachedFoods = await foodSearchApi.getCachedFoods();
    const withoutDuplicate = cacheRowsWithoutThisProduct(cachedFoods, productId, productName);

    // 2. Put the new card first and trim to MAX_CACHE_ITEMS.
    withoutDuplicate.unshift({
      ...product,
      id: productId,
      name: productName || product.name,
      cachedAt: Date.now(),
      savedAt: Date.now()
    });
    if (withoutDuplicate.length > MAX_CACHE_ITEMS) {
      withoutDuplicate.splice(MAX_CACHE_ITEMS);
    }
    await foodSearchApi.saveCachedFoods(withoutDuplicate);
  } catch (error) {
    if (__DEV__) console.warn('Failed to cache food product', error.message);
  }
}

/**
 * Read the on-device food cache (or a fallback apple if the cache blows up).
 * @returns {Promise<object[]>}
 */
export async function getCachedFoods() {
  try {
    return await foodSearchApi.getCachedFoods();
  } catch (error) {
    if (__DEV__) console.error('Error getting cached foods:', error);
    return [FALLBACK_APPLE];
  }
}

/**
 * Last search hint string from the unified food search provider (or null).
 * @returns {string|null}
 */
export function getFoodSearchHint() {
  if (typeof foodSearchApi.getLastSearchHint === 'function') {
    const hint = foodSearchApi.getLastSearchHint();
    if (hint != null) return hint;
  }
  return null;
}

/**
 * Unified food search — delegates to searchFoods.js, falls back to local cache.
 * @param {string} query
 * @param {number} [maxResults]
 * @returns {Promise<object[]>}
 */
export async function searchFoods(query, maxResults = 20) {
  try {
    if (__DEV__) console.log('🍔 Starting unified food search for:', query);
    const results = await foodSearchApi.searchFoods(query, maxResults);
    if (__DEV__) console.log(`🍔 Unified search returned ${results.length} results`);
    return results;
  } catch (error) {
    if (__DEV__) console.error('🍔 Error in unified food search:', error.message);
    if (__DEV__) console.log('🍔 Falling back to local cache only');
    return searchCachedFoodsFallback(query, maxResults);
  }
}

/**
 * Barcode lookup via the unified food search provider.
 * @param {string} barcode
 * @returns {Promise<object|null>}
 */
export async function lookupBarcode(barcode) {
  try {
    if (__DEV__) console.log('🍔 Looking up barcode:', barcode);
    const result = await foodSearchApi.lookupBarcode(barcode);
    if (__DEV__) console.log(`🍔 Barcode lookup result:`, result ? 'Found' : 'Not found');
    return result;
  } catch (error) {
    if (__DEV__) console.error('🍔 Error looking up barcode:', error);
    return null;
  }
}

/**
 * Find one cached food by id (source arg kept for callers; cache is the only store here).
 * @param {string} foodId
 * @param {string} [source]
 * @returns {Promise<object|null>}
 */
export async function getFoodDetails(foodId, source = 'cache') {
  try {
    const cachedFoods = await foodSearchApi.getCachedFoods();
    return findCachedFoodById(cachedFoods, foodId);
  } catch (error) {
    if (__DEV__) console.error('Error getting food details:', error);
    return null;
  }
}

/**
 * First N cached foods as a simple "popular" list.
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
export async function getPopularFoods(limit = 10) {
  try {
    const cachedFoods = await foodSearchApi.getCachedFoods();
    return cachedFoods.slice(0, limit);
  } catch (error) {
    if (__DEV__) console.error('Error getting popular foods:', error);
    return [];
  }
}

/**
 * Recent foods for the search "Recent" strip — Firestore logs first, then phone cache.
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
export async function getRecentFoods(userId, limit = 15) {
  try {
    const seenNames = new Set();
    const recentList = [];

    // 1. Prefer foods the user actually logged (newest Firestore rows first).
    if (userId && db) {
      await fillRecentFromLogs(userId, seenNames, recentList, limit);
    }

    // 2. Top up from on-device cache when the log history is short.
    if (recentList.length < limit) {
      await fillRecentFromCache(seenNames, recentList, limit);
    }
    return recentList.slice(0, limit);
  } catch (error) {
    if (__DEV__) console.error('Error getting recent foods:', error);
    return recentFoodsCacheFallback(limit);
  }
}

/**
 * Distinct YYYY-MM-DD dates that still have food logs within daysBack.
 * @param {string} userId
 * @param {{ daysBack?: number }} [options]
 * @returns {Promise<string[]>}
 */
export async function getDatesWithFoodLogs(userId, {
  daysBack = 28
} = {}) {
  try {
    if (!userId || !db) return [];

    // 1. Pull a capped batch of this user's logs (no orderBy — avoids missing-index crashes).
    const logsRef = collection(db, LOGS_COLLECTION);
    const datesQuery = query(logsRef, where('user_id', '==', userId), limitFn(DATES_WITH_LOGS_LIMIT));
    const querySnapshot = await getDocs(datesQuery);

    // 2. Keep dates on or after the cutoff day.
    const datesWithLogs = new Set();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    querySnapshot.forEach(logDoc => {
      const logData = logDoc.data() || {};
      const dateKey = String(logData.date || '');
      if (!dateKey) return;
      const parsedDate = new Date(`${dateKey}T12:00:00`);
      if (parsedDate >= cutoffDate) {
        datesWithLogs.add(dateKey);
      }
    });
    return [...datesWithLogs];
  } catch (ignoredError) {
    return [];
  }
}

/**
 * Most frequently logged food names for this user (for empty-state suggestions).
 * @param {string} userId
 * @param {number} [maxItems]
 * @returns {Promise<string[]>}
 */
export async function getTopLoggedFoodNames(userId, maxItems = 3) {
  try {
    if (!userId || !db) return [];

    // 1. Count food_name frequency across a capped log sample.
    const logsRef = collection(db, LOGS_COLLECTION);
    const namesQuery = query(logsRef, where('user_id', '==', userId), limitFn(TOP_LOGGED_FETCH_LIMIT));
    const querySnapshot = await getDocs(namesQuery);
    const nameFrequencyByKey = {};
    querySnapshot.forEach(logDoc => {
      const foodName = String(logDoc.data().food_name || '').trim();
      if (!foodName || foodName === 'Food') return;
      const nameKey = foodName.toLowerCase();
      if (!nameFrequencyByKey[nameKey]) {
        nameFrequencyByKey[nameKey] = {
          name: foodName,
          count: 0
        };
      }
      nameFrequencyByKey[nameKey].count += 1;
    });

    // 2. Highest count first, then take maxItems display names.
    const rankedNames = Object.values(nameFrequencyByKey);
    rankedNames.sort((leftEntry, rightEntry) => rightEntry.count - leftEntry.count);
    const topNames = [];
    for (let index = 0; index < rankedNames.length && index < maxItems; index += 1) {
      topNames.push(rankedNames[index].name);
    }
    return topNames;
  } catch (ignoredError) {
    return [];
  }
}

/**
 * users/{userId}.favoriteFoods[] — newest first after sort.
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function getFavoriteFoods(userId) {
  if (!userId || !db) return [];
  const userDocSnap = await getDoc(doc(db, USERS_COLLECTION, userId));
  const userDocData = userDocSnap.data() || {};
  const favoriteList = Array.isArray(userDocData.favoriteFoods) ? userDocData.favoriteFoods : [];
  const sortedFavorites = [...favoriteList];
  sortedFavorites.sort((leftFavorite, rightFavorite) => String(rightFavorite.addedDate || '').localeCompare(String(leftFavorite.addedDate || '')));
  return sortedFavorites;
}

/**
 * Whether this food id is already on the user's favorites list.
 * @param {string} userId
 * @param {object} food
 * @returns {Promise<boolean>}
 */
export async function isFavoriteFood(userId, food) {
  const favoriteId = favoriteFoodId(food);
  if (!favoriteId) return false;
  const favoriteList = await getFavoriteFoods(userId);
  for (const entry of favoriteList) {
    if (String(entry.foodId).toLowerCase() === favoriteId) return true;
  }
  return false;
}

/**
 * Add or remove a favorite on users/{userId}.favoriteFoods (capped).
 * @param {string} userId
 * @param {object} food
 * @returns {Promise<{ favorited: boolean, favorites: object[] }>}
 */
export async function toggleFavoriteFood(userId, food) {
  if (!userId || !db) throw new Error('Not signed in');

  // 1. Build the favorite row shape the profile screen already reads.
  const favoriteEntry = buildFavoriteFoodEntry(food);
  const userDocRef = doc(db, USERS_COLLECTION, userId);
  const userDocSnap = await getDoc(userDocRef);
  const userDocData = userDocSnap.data() || {};
  const favoriteList = Array.isArray(userDocData.favoriteFoods) ? [...userDocData.favoriteFoods] : [];

  // 2. Toggle: remove if present, otherwise unshift newest.
  const favoriteIndex = favoriteList.findIndex(favorite => String(favorite.foodId).toLowerCase() === favoriteEntry.foodId);
  let favorited;
  if (favoriteIndex >= 0) {
    favoriteList.splice(favoriteIndex, 1);
    favorited = false;
  } else {
    favoriteList.unshift(favoriteEntry);
    favorited = true;
  }

  // 3. Persist capped list + updatedAt.
  await setDoc(userDocRef, {
    favoriteFoods: favoriteList.slice(0, FAVORITE_FOODS_CAP),
    updatedAt: serverTimestamp()
  }, {
    merge: true
  });
  return {
    favorited,
    favorites: favoriteList
  };
}

/**
 * No tokens to clear with the unified food search provider (kept for older call sites).
 */
export async function clearFatSecretTokens() {
  try {
    if (__DEV__) console.log('No tokens to clear (using unified food search provider)');
  } catch (error) {
    if (__DEV__) console.error('Error clearing tokens:', error);
  }
}

// PLUMBING — skip unless debugging
// Heavy Firestore / history helpers. Mains above call these by name.

function flattenFoodForMetadata(food) {
  const normalized = normalizeFoodForLog(food) || {};
  let flatFood = {
    ...normalized
  };
  for (let depth = 0; depth < METADATA_FLATTEN_DEPTH; depth += 1) {
    const innerMetadata = flatFood.metadata;
    if (!innerMetadata || typeof innerMetadata !== 'object' || Array.isArray(innerMetadata)) {
      break;
    }
    const {
      metadata: _nestedMetadata,
      ...outerRest
    } = flatFood;
    flatFood = {
      ...innerMetadata,
      ...outerRest
    };
  }
  const {
    metadata: _dropMetadata,
    ...withoutMeta
  } = flatFood;
  return stripUndefinedForFirestore(withoutMeta);
}
function normalizeHistoryName(name) {
  const {
    readableFoodTitle
  } = require('../food-search/readableFoodTitle');
  return readableFoodTitle({
    name
  }).name.toLowerCase().replace(/[''`]/g, "'").replace(/\s+/g, ' ');
}
function formatDateKey(date = new Date()) {
  if (typeof date === 'string' && YYYY_MM_DD.test(date)) return date;
  const parsedDate = typeof date === 'string' ? new Date(date) : date;
  if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid date passed to food log: ${String(date)}`);
  }
  return [parsedDate.getFullYear(), String(parsedDate.getMonth() + 1).padStart(2, '0'), String(parsedDate.getDate()).padStart(2, '0')].join('-');
}
function toDateKey(date) {
  if (typeof date === 'string' && YYYY_MM_DD.test(date)) return date;
  return formatDateKey(date);
}
function createdAtMillis(stamp) {
  if (!stamp) return 0;
  if (stamp.toDate && typeof stamp.toDate === 'function') return stamp.toDate().getTime();
  if (stamp.seconds) return stamp.seconds * MS_PER_SECOND;
  if (stamp instanceof Date) return stamp.getTime();
  const parsedDate = new Date(stamp);
  return Number.isNaN(parsedDate.getTime()) ? 0 : parsedDate.getTime();
}
function createdAtMillisLoose(stamp) {
  if (!stamp) return 0;
  if (typeof stamp.toMillis === 'function') return stamp.toMillis();
  if (stamp.seconds) return stamp.seconds * MS_PER_SECOND;
  return 0;
}
function sortLogsOldestFirst(logs) {
  return logs.sort((leftLog, rightLog) => {
    try {
      return createdAtMillis(leftLog.created_at) - createdAtMillis(rightLog.created_at);
    } catch (ignoredError) {
      return 0;
    }
  });
}
function foodLogFromFirestoreDoc(logDoc) {
  const data = logDoc.data();
  return {
    id: logDoc.id,
    ...data,
    calories: Number(data.calories) || 0,
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fat: Number(data.fat) || 0,
    fiber: Number(data.fiber) || 0,
    sugar: Number(data.sugar) || 0,
    sodium: Number(data.sodium) || 0,
    potassium: Number(data.potassium) || 0,
    serving_size: Number(data.serving_size) || 1
  };
}
function clampNutrition(food) {
  return {
    ...food,
    calories: Math.min(Math.max(Math.round(food.calories || 0), 0), MAX_CALORIES),
    protein: Math.min(Math.max(parseFloat((food.protein || 0).toFixed(1)), 0), MAX_PROTEIN_G),
    carbs: Math.min(Math.max(parseFloat((food.carbs || 0).toFixed(1)), 0), MAX_CARBS_G),
    fat: Math.min(Math.max(parseFloat((food.fat || 0).toFixed(1)), 0), MAX_FAT_G),
    fiber: Math.min(Math.max(parseFloat((food.fiber || 0).toFixed(1)), 0), MAX_FIBER_G),
    sugar: Math.min(Math.max(parseFloat((food.sugar || 0).toFixed(1)), 0), MAX_SUGAR_G),
    sodium: Math.min(Math.max(Math.round(food.sodium || 0), 0), MAX_SODIUM_MG),
    potassium: Math.min(Math.max(Math.round(food.potassium || 0), 0), MAX_POTASSIUM_MG),
    serving_grams: Math.min(Math.max(Math.round(food.serving_grams || food.servingGrams || 100), 1), MAX_SERVING_GRAMS)
  };
}
function totalsFromFood(food, servingQuantity) {
  if (numbersArePerHundredGrams(food)) {
    return {
      servingGrams: servingQuantity * GRAMS_PER_OFF_SERVING,
      calories: safeNumberOrZero(food.calories) * servingQuantity,
      protein: safeNumberOrZero(food.protein) * servingQuantity,
      carbs: safeNumberOrZero(food.carbs) * servingQuantity,
      fat: safeNumberOrZero(food.fat) * servingQuantity,
      fiber: safeNumberOrZero(food.fiber) * servingQuantity,
      sugar: safeNumberOrZero(food.sugar) * servingQuantity,
      sodium: safeNumberOrZero(food.sodium) * servingQuantity,
      potassium: safeNumberOrZero(food.potassium) * servingQuantity
    };
  }
  const servingGramsRaw = safeNumberOrZero(food.servingGrams);
  return {
    servingGrams: servingGramsRaw > 0 ? servingGramsRaw : servingQuantity,
    calories: safeNumberOrZero(food.calories),
    protein: safeNumberOrZero(food.protein),
    carbs: safeNumberOrZero(food.carbs),
    fat: safeNumberOrZero(food.fat),
    fiber: safeNumberOrZero(food.fiber),
    sugar: safeNumberOrZero(food.sugar),
    sodium: safeNumberOrZero(food.sodium),
    potassium: safeNumberOrZero(food.potassium)
  };
}
function buildFoodLogPayload(userId, log, food, servingQuantity, totals) {
  return {
    user_id: userId,
    date: toDateKey(log.date || new Date()),
    meal_type: log.mealType,
    food_name: food.name || log.foodName || DEFAULT_FOOD_NAME,
    brand: food.brand || '',
    serving_size: Math.round(safeNumberOrZero(servingQuantity) * 100) / 100,
    serving_grams: Math.round(safeNumberOrZero(totals.servingGrams)),
    calories: Math.round(safeNumberOrZero(totals.calories)),
    protein: Math.round(safeNumberOrZero(totals.protein) * 10) / 10,
    carbs: Math.round(safeNumberOrZero(totals.carbs) * 10) / 10,
    fat: Math.round(safeNumberOrZero(totals.fat) * 10) / 10,
    fiber: Math.round(safeNumberOrZero(totals.fiber) * 10) / 10,
    sugar: Math.round(safeNumberOrZero(totals.sugar) * 10) / 10,
    sodium: Math.round(safeNumberOrZero(totals.sodium) * 10) / 10,
    potassium: Math.round(safeNumberOrZero(totals.potassium)),
    originalUnit: food.originalUnit || food.loggedUnit || food.preferredUnit || null,
    originalAmount: food.originalAmount ?? food.loggedAmount ?? null,
    loggedUnit: food.loggedUnit || food.preferredUnit || food.originalUnit || null,
    loggedAmount: food.loggedAmount ?? food.originalAmount ?? null,
    preferredUnit: food.preferredUnit || food.loggedUnit || food.originalUnit || null,
    metadata: food,
    created_at: serverTimestamp()
  };
}
function foodNameMatches(logName, query) {
  const logLower = String(logName || '').toLowerCase().trim();
  const queryRaw = String(query || '').toLowerCase().trim();
  if (!logLower || !queryRaw) return false;
  const queryClean = queryRaw.replace(/^(the|my|both|one|two|three|\d+)\s+/i, '').replace(/\s+(today|yesterday|from.*)$/i, '').trim();
  if (logLower.includes(queryClean) || queryClean.includes(logLower)) return true;
  const tokens = queryClean.split(/[\s,]+/).filter(word => word.length >= 4);
  for (const token of tokens) {
    if (logLower.includes(token)) return true;
  }
  if (/pizza|domino/.test(queryClean) && /pizza|domino/.test(logLower)) return true;
  if (/chicken/.test(queryClean) && /chicken/.test(logLower)) return true;
  if (/rice/.test(queryClean) && /rice/.test(logLower)) return true;
  return false;
}
function newestLogOnly(logs) {
  const sortedNewestFirst = [...logs];
  sortedNewestFirst.sort((leftLog, rightLog) => createdAtMillisLoose(rightLog.created_at) - createdAtMillisLoose(leftLog.created_at));
  return sortedNewestFirst.slice(0, 1);
}
function logsMatchingFoodName(logs, foodName) {
  const matchedRows = [];
  for (const logRow of logs) {
    if (!foodNameMatches(logRow.food_name, foodName)) continue;
    matchedRows.push(logRow);
  }
  return matchedRows;
}
function pickDeleteTargets(logs, {
  foodName,
  deleteAll
}) {
  if (deleteAll) return logs;
  if (foodName) return logsMatchingFoodName(logs, foodName);
  if (logs.length) return newestLogOnly(logs);
  return logs;
}
function perServingHistoryValue(value, servingCount, shouldRound) {
  const numericValue = Number(value) || 0;
  if (!numericValue) return 0;
  const scaled = servingCount > 1 ? numericValue / servingCount : numericValue;
  if (shouldRound) {
    return Math.round(scaled * 10) / 10;
  }
  return scaled;
}
function fillLoggedTotalsHistory(historyEntry, normalizedFood, servingCount) {
  const grams = Math.max(1, Math.round((Number(normalizedFood.servingGrams) || 100) / (servingCount > 1 ? servingCount : 1)));
  historyEntry.calories = Math.round(perServingHistoryValue(normalizedFood.calories, servingCount, false));
  historyEntry.protein = perServingHistoryValue(normalizedFood.protein, servingCount, true);
  historyEntry.carbs = perServingHistoryValue(normalizedFood.carbs, servingCount, true);
  historyEntry.fat = perServingHistoryValue(normalizedFood.fat, servingCount, true);
  historyEntry.fiber = perServingHistoryValue(normalizedFood.fiber, servingCount, true);
  historyEntry.sugar = perServingHistoryValue(normalizedFood.sugar, servingCount, true);
  historyEntry.sodium = Math.round(perServingHistoryValue(normalizedFood.sodium, servingCount, false));
  historyEntry.potassium = Math.round(perServingHistoryValue(normalizedFood.potassium, servingCount, false));
  historyEntry.servingGrams = grams;
  historyEntry.serving_grams = grams;
}
function fillLabelServingHistory(historyEntry, normalizedFood) {
  historyEntry.fromRecentLog = false;
  historyEntry.calories = Math.round(Number(normalizedFood.calories) || 0);
  historyEntry.protein = Number(normalizedFood.protein) || 0;
  historyEntry.carbs = Number(normalizedFood.carbs) || 0;
  historyEntry.fat = Number(normalizedFood.fat) || 0;
  historyEntry.servingSize = normalizedFood.servingSize ?? 1;
  historyEntry.serving_size = historyEntry.servingSize;
  historyEntry.servingGrams = resolveServingGrams(normalizedFood);
  historyEntry.serving_grams = historyEntry.servingGrams;
}
function safeFoodObject(food) {
  if (food) return food;
  return {};
}

function favoriteFoodId(food) {
  const safeFood = safeFoodObject(food);
  const rawId = safeFood.foodId || safeFood.id || safeFood.food_id || safeFood.name || safeFood.food_name || '';
  return String(rawId).trim().toLowerCase();
}
function buildFavoriteFoodEntry(food) {
  const safeFood = safeFoodObject(food);
  const rawName = safeFood.food_name || safeFood.name || 'Food';
  const foodName = String(rawName).trim();
  const foodId = favoriteFoodId(safeFood) || foodName.toLowerCase();
  const brand = safeFood.brand_name || safeFood.brand || '';
  return {
    foodId,
    foodName,
    calories: Math.round(Number(safeFood.calories) || 0),
    macros: {
      protein: Math.round(Number(safeFood.protein) || 0),
      carbs: Math.round(Number(safeFood.carbs) || 0),
      fat: Math.round(Number(safeFood.fat) || 0)
    },
    addedDate: new Date().toISOString(),
    brand
  };
}
function logToHistoryEntry(log) {
  const foodMetadata = log.metadata && typeof log.metadata === 'object' ? log.metadata : {};
  const foodName = String(foodMetadata.name || foodMetadata.food_name || log.food_name || 'Food').trim();
  if (!foodName) return null;
  if (foodMetadata.name || foodMetadata.food_name) {
    return normalizeFoodForLog({
      ...foodMetadata,
      id: foodMetadata.id || buildFoodHistoryId(foodMetadata),
      name: foodName,
      food_name: foodName,
      fromRecentLog: Boolean(foodMetadata.dataBasis === 'logged_totals' || foodMetadata.fromRecentLog)
    });
  }
  let servingUnit;
  if (isLiquidFood(foodMetadata)) {
    servingUnit = 'ml';
  } else {
    servingUnit = 'grams';
  }
  const servingCount = Number(log.serving_size) || 1;
  function perServing(value) {
    const numericValue = Number(value) || 0;
    return servingCount > 1 ? Math.round(numericValue / servingCount * 10) / 10 : numericValue;
  }
  return normalizeFoodForLog({
    id: buildFoodHistoryId({
      name: foodName,
      source: 'log'
    }),
    name: foodName,
    food_name: foodName,
    brand: log.brand || '',
    calories: Math.round(perServing(log.calories)),
    protein: perServing(log.protein),
    carbs: perServing(log.carbs),
    fat: perServing(log.fat),
    fiber: perServing(log.fiber),
    sugar: perServing(log.sugar),
    sodium: Math.round(perServing(log.sodium)),
    serving_size: 1,
    servingSize: 1,
    serving_unit: servingUnit,
    servingUnit,
    serving_grams: Math.max(1, Math.round((Number(log.serving_grams) || 100) / servingCount)),
    servingGrams: Math.max(1, Math.round((Number(log.serving_grams) || 100) / servingCount)),
    source: 'log',
    dataBasis: 'logged_totals',
    fromRecentLog: true
  });
}
async function saveHistoryQuietly(food) {
  try {
    await saveFoodToHistory(food);
  } catch (historyErr) {
    if (__DEV__) console.warn('Food history save failed:', (historyErr && historyErr.message));
  }
}
function foodsMatchingQueryInCache(foodsArray, query, maxResults) {
  const matchingFoods = [];
  const queryLower = query.toLowerCase();
  for (const food of foodsArray) {
    if (!food || !food.name) continue;
    const nameMatchesQuery = food.name.toLowerCase().includes(queryLower);
    if (!nameMatchesQuery) continue;
    matchingFoods.push(food);
    if (matchingFoods.length >= maxResults) break;
  }
  return matchingFoods;
}
async function searchCachedFoodsFallback(query, maxResults) {
  try {
    const cachedFoods = await foodSearchApi.getCachedFoods();
    const foodsArray = Array.isArray(cachedFoods) ? cachedFoods : [];
    return foodsMatchingQueryInCache(foodsArray, query, maxResults);
  } catch (cacheError) {
    if (__DEV__) console.error('🍔 Cache fallback failed:', cacheError);
    return [];
  }
}
async function loadRecentLogsFromFirestore(userId, fetchLimit = RECENT_LOGS_FETCH_LIMIT) {
  const logsRef = collection(db, LOGS_COLLECTION);
  try {
    const recentQuery = query(logsRef, where('user_id', '==', userId), orderBy('created_at', 'desc'), limitFn(fetchLimit));
    const querySnapshot = await getDocs(recentQuery);
    const logs = [];
    querySnapshot.forEach(logDoc => {
      logs.push({
        id: logDoc.id,
        ...logDoc.data()
      });
    });
    return logs;
  } catch (indexErr) {
    if (__DEV__) console.warn('Recent foods orderBy fallback:', (indexErr && indexErr.message));
    const fallbackQuery = query(logsRef, where('user_id', '==', userId), limitFn(fetchLimit));
    const querySnapshot = await getDocs(fallbackQuery);
    const logs = [];
    querySnapshot.forEach(logDoc => {
      logs.push({
        id: logDoc.id,
        ...logDoc.data()
      });
    });
    logs.sort((leftLog, rightLog) => {
      const leftTime = createdAtMillisLoose(leftLog.created_at) || createdAtMillis(leftLog.created_at);
      const rightTime = createdAtMillisLoose(rightLog.created_at) || createdAtMillis(rightLog.created_at);
      return rightTime - leftTime;
    });
    return logs;
  }
}
function pushUniqueRecent(item, seenNames, recentList) {
  if (!item) return;
  const historyName = normalizeHistoryName(item.name || item.food_name);
  if (!historyName || seenNames.has(historyName)) return;
  seenNames.add(historyName);
  recentList.push(normalizeFoodForLog(item));
}
async function fillRecentFromLogs(userId, seenNames, recentList, limit) {
  const logs = await loadRecentLogsFromFirestore(userId, RECENT_LOGS_FETCH_LIMIT);
  for (const logRow of logs) {
    pushUniqueRecent(logToHistoryEntry(logRow), seenNames, recentList);
    if (recentList.length >= limit) return;
  }
}
async function fillRecentFromCache(seenNames, recentList, limit) {
  const cached = await getCachedFoods();
  for (const item of cached) {
    pushUniqueRecent({
      ...item,
      fromRecentLog: Boolean(item.dataBasis === 'logged_totals' || item.fromRecentLog)
    }, seenNames, recentList);
    if (recentList.length >= limit) return;
  }
}
async function recentFoodsCacheFallback(limit) {
  try {
    const cached = await getCachedFoods();
    const normalizedList = [];
    for (const item of cached.slice(0, limit)) {
      normalizedList.push(normalizeFoodForLog(item));
    }
    return normalizedList;
  } catch (ignoredError) {
    return [];
  }
}