// Writes and reads today's food log rows (Breakfast, a Big Mac, Quick Add).
// Flow: flatten the card → scale per-100g numbers → write nutrition_logs → remember the food for next time.
// Used by the Nutrition tab and the AI coach log/delete tools.

import { db } from '../../app-start/cloudConnection';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  setDoc,
  serverTimestamp,
  limit as limitFn,
} from 'firebase/firestore';
import foodSearchApi from '../food-search/searchFoods';
export { FOOD_SEARCH_OFFLINE_HINT } from '../food-search/searchFoods';
import { reportCrashAutomaticallySync } from '../../crash-reports/reportCrashAutomatically';
import { stripUndefinedForFirestore } from '../../helpers/cleanDataBeforeSaving';
import { normalizeFoodForLog, isLiquidFood } from '../food-search/cleanSearchText';
import { normalizeFoodRecordForStorage } from '../food-search/readableFoodTitle';
import { isPer100gSource, resolveServingGrams } from '../food-details/servingSizeMath';

// ===== NAMED CONSTANTS =====

const LOGS_COLLECTION = 'nutrition_logs';
const GOALS_COLLECTION = 'nutrition_goals';
const USERS_COLLECTION = 'users';
const MAX_CACHE_ITEMS = 50;
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_SECOND = 1000;
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
  servingUnit: 'medium',
};

// ===== HELPER FUNCTIONS =====

function flattenFoodForMetadata(food) {
  const normalized = normalizeFoodForLog(food) || {};
  let flat = { ...normalized };
  for (let depth = 0; depth < METADATA_FLATTEN_DEPTH; depth += 1) {
    const inner = flat.metadata;
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) break;
    const { metadata: _nested, ...outerRest } = flat;
    flat = { ...inner, ...outerRest };
  }
  const { metadata: _drop, ...withoutMeta } = flat;
  return stripUndefinedForFirestore(withoutMeta);
}

function normalizeHistoryName(name) {
  const { readableFoodTitle } = require('../food-search/readableFoodTitle');
  return readableFoodTitle({ name })
    .name.toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ');
}

function formatDateKey(date = new Date()) {
  if (typeof date === 'string' && YYYY_MM_DD.test(date)) return date;
  const parsed = typeof date === 'string' ? new Date(date) : date;
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date passed to food log: ${String(date)}`);
  }
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
}

function toDateKey(date) {
  if (typeof date === 'string' && YYYY_MM_DD.test(date)) return date;
  return formatDateKey(date);
}

function getDefaultGoals() {
  return {
    calories: DEFAULT_CALORIE_TARGET,
    proteinTarget: DEFAULT_PROTEIN_TARGET,
    carbsTarget: DEFAULT_CARBS_TARGET,
    fatTarget: DEFAULT_FAT_TARGET,
    macroSplit: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  };
}

function createdAtMillis(stamp) {
  if (!stamp) return 0;
  if (stamp.toDate && typeof stamp.toDate === 'function') return stamp.toDate().getTime();
  if (stamp.seconds) return stamp.seconds * MS_PER_SECOND;
  if (stamp instanceof Date) return stamp.getTime();
  const parsed = new Date(stamp);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function createdAtMillisLoose(stamp) {
  return stamp?.toMillis?.() || stamp?.seconds * MS_PER_SECOND || 0;
}

function sortLogsOldestFirst(logs) {
  return logs.sort((leftLog, rightLog) => {
    try {
      return createdAtMillis(leftLog.created_at) - createdAtMillis(rightLog.created_at);
    } catch (_) {
      return 0;
    }
  });
}

function logRowFromSnapshot(logDoc) {
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
    serving_size: Number(data.serving_size) || 1,
  };
}

function clampNutrition(food) {
  return {
    ...food,
    calories: Math.min(Math.max(Math.round(food.calories || 0), 0), MAX_CALORIES),
    protein: Math.min(Math.max(parseFloat(((food.protein || 0)).toFixed(1)), 0), MAX_PROTEIN_G),
    carbs: Math.min(Math.max(parseFloat(((food.carbs || 0)).toFixed(1)), 0), MAX_CARBS_G),
    fat: Math.min(Math.max(parseFloat(((food.fat || 0)).toFixed(1)), 0), MAX_FAT_G),
    fiber: Math.min(Math.max(parseFloat(((food.fiber || 0)).toFixed(1)), 0), MAX_FIBER_G),
    sugar: Math.min(Math.max(parseFloat(((food.sugar || 0)).toFixed(1)), 0), MAX_SUGAR_G),
    sodium: Math.min(Math.max(Math.round(food.sodium || 0), 0), MAX_SODIUM_MG),
    potassium: Math.min(Math.max(Math.round(food.potassium || 0), 0), MAX_POTASSIUM_MG),
    serving_grams: Math.min(Math.max(Math.round(food.serving_grams || food.servingGrams || 100), 1), MAX_SERVING_GRAMS),
  };
}

function finiteOrZero(value) {
  const numericValue = Number(value);
  return (typeof numericValue === 'number' && !Number.isNaN(numericValue)) ? numericValue : 0;
}

function howManyServings(log, food) {
  let rawQty;
  if (log.servingSize != null && log.servingSize !== '') {
    rawQty = Number(log.servingSize);
  } else if (food.servingSize != null && food.servingSize !== '') {
    rawQty = Number(food.servingSize);
  } else {
    rawQty = NaN;
  }
  if (typeof rawQty === 'number' && !Number.isNaN(rawQty) && rawQty > 0) return rawQty;
  return 1;
}

function numbersArePerHundredGrams(food) {
  return (
    (food.source === 'openfoodfacts' || food.source === 'usda') &&
    String(food.dataBasis || '').toLowerCase() !== 'logged_total'
  );
}

function totalsFromFood(food, servingQuantity) {
  if (numbersArePerHundredGrams(food)) {
    return {
      servingGrams: servingQuantity * GRAMS_PER_OFF_SERVING,
      calories: finiteOrZero(food.calories) * servingQuantity,
      protein: finiteOrZero(food.protein) * servingQuantity,
      carbs: finiteOrZero(food.carbs) * servingQuantity,
      fat: finiteOrZero(food.fat) * servingQuantity,
      fiber: finiteOrZero(food.fiber) * servingQuantity,
      sugar: finiteOrZero(food.sugar) * servingQuantity,
      sodium: finiteOrZero(food.sodium) * servingQuantity,
      potassium: finiteOrZero(food.potassium) * servingQuantity,
    };
  }
  const servingGramsRaw = finiteOrZero(food.servingGrams);
  return {
    servingGrams: servingGramsRaw > 0 ? servingGramsRaw : servingQuantity,
    calories: finiteOrZero(food.calories),
    protein: finiteOrZero(food.protein),
    carbs: finiteOrZero(food.carbs),
    fat: finiteOrZero(food.fat),
    fiber: finiteOrZero(food.fiber),
    sugar: finiteOrZero(food.sugar),
    sodium: finiteOrZero(food.sodium),
    potassium: finiteOrZero(food.potassium),
  };
}

function buildFoodLogPayload(userId, log, food, servingQuantity, totals) {
  return {
    user_id: userId,
    date: toDateKey(log.date || new Date()),
    meal_type: log.mealType,
    food_name: food.name || log.foodName || DEFAULT_FOOD_NAME,
    brand: food.brand || '',
    serving_size: Math.round(finiteOrZero(servingQuantity) * 100) / 100,
    serving_grams: Math.round(finiteOrZero(totals.servingGrams)),
    calories: Math.round(finiteOrZero(totals.calories)),
    protein: Math.round(finiteOrZero(totals.protein) * 10) / 10,
    carbs: Math.round(finiteOrZero(totals.carbs) * 10) / 10,
    fat: Math.round(finiteOrZero(totals.fat) * 10) / 10,
    fiber: Math.round(finiteOrZero(totals.fiber) * 10) / 10,
    sugar: Math.round(finiteOrZero(totals.sugar) * 10) / 10,
    sodium: Math.round(finiteOrZero(totals.sodium) * 10) / 10,
    potassium: Math.round(finiteOrZero(totals.potassium)),
    originalUnit: food.originalUnit || food.loggedUnit || food.preferredUnit || null,
    originalAmount: food.originalAmount ?? food.loggedAmount ?? null,
    loggedUnit: food.loggedUnit || food.preferredUnit || food.originalUnit || null,
    loggedAmount: food.loggedAmount ?? food.originalAmount ?? null,
    preferredUnit: food.preferredUnit || food.loggedUnit || food.originalUnit || null,
    metadata: food,
    created_at: serverTimestamp(),
  };
}

function foodNameMatches(logName, query) {
  const logLower = String(logName || '').toLowerCase().trim();
  const queryRaw = String(query || '').toLowerCase().trim();
  if (!logLower || !queryRaw) return false;

  const queryClean = queryRaw
    .replace(/^(the|my|both|one|two|three|\d+)\s+/i, '')
    .replace(/\s+(today|yesterday|from.*)$/i, '')
    .trim();

  if (logLower.includes(queryClean) || queryClean.includes(logLower)) return true;

  const tokens = queryClean.split(/[\s,]+/).filter((word) => word.length >= 4);
  if (tokens.some((token) => logLower.includes(token))) return true;

  if (/pizza|domino/.test(queryClean) && /pizza|domino/.test(logLower)) return true;
  if (/chicken/.test(queryClean) && /chicken/.test(logLower)) return true;
  if (/rice/.test(queryClean) && /rice/.test(logLower)) return true;

  return false;
}

function newestLogOnly(logs) {
  return [...logs]
    .sort((leftLog, rightLog) => createdAtMillisLoose(rightLog.created_at) - createdAtMillisLoose(leftLog.created_at))
    .slice(0, 1);
}

function pickDeleteTargets(logs, { foodName, deleteAll }) {
  if (deleteAll) return logs;
  if (foodName) return logs.filter((logRow) => foodNameMatches(logRow.food_name, foodName));
  if (logs.length) return newestLogOnly(logs);
  return logs;
}

function perServingHistoryValue(value, qty, shouldRound) {
  const numericValue = Number(value) || 0;
  if (!numericValue) return 0;
  const scaled = qty > 1 ? numericValue / qty : numericValue;
  return shouldRound ? Math.round(scaled * 10) / 10 : scaled;
}

function fillLoggedTotalsHistory(entry, normalized, qty) {
  const grams = Math.max(1, Math.round((Number(normalized.servingGrams) || 100) / (qty > 1 ? qty : 1)));
  entry.calories = Math.round(perServingHistoryValue(normalized.calories, qty, false));
  entry.protein = perServingHistoryValue(normalized.protein, qty, true);
  entry.carbs = perServingHistoryValue(normalized.carbs, qty, true);
  entry.fat = perServingHistoryValue(normalized.fat, qty, true);
  entry.fiber = perServingHistoryValue(normalized.fiber, qty, true);
  entry.sugar = perServingHistoryValue(normalized.sugar, qty, true);
  entry.sodium = Math.round(perServingHistoryValue(normalized.sodium, qty, false));
  entry.potassium = Math.round(perServingHistoryValue(normalized.potassium, qty, false));
  entry.servingGrams = grams;
  entry.serving_grams = grams;
}

function fillLabelServingHistory(entry, normalized) {
  entry.fromRecentLog = false;
  entry.calories = Math.round(Number(normalized.calories) || 0);
  entry.protein = Number(normalized.protein) || 0;
  entry.carbs = Number(normalized.carbs) || 0;
  entry.fat = Number(normalized.fat) || 0;
  entry.servingSize = normalized.servingSize ?? 1;
  entry.serving_size = entry.servingSize;
  entry.servingGrams = resolveServingGrams(normalized);
  entry.serving_grams = entry.servingGrams;
}

function favoriteFoodId(food) {
  return String(food?.foodId || food?.id || food?.food_id || food?.name || food?.food_name || '')
    .trim()
    .toLowerCase();
}

function buildFavoriteFoodEntry(food) {
  const foodName = String(food?.food_name || food?.name || 'Food').trim();
  const foodId = favoriteFoodId(food) || foodName.toLowerCase();
  return {
    foodId,
    foodName,
    calories: Math.round(Number(food?.calories) || 0),
    macros: {
      protein: Math.round(Number(food?.protein) || 0),
      carbs: Math.round(Number(food?.carbs) || 0),
      fat: Math.round(Number(food?.fat) || 0),
    },
    addedDate: new Date().toISOString(),
    brand: food?.brand_name || food?.brand || '',
  };
}

function logToHistoryEntry(log) {
  const meta = log.metadata && typeof log.metadata === 'object' ? log.metadata : {};
  const name = String(meta.name || meta.food_name || log.food_name || 'Food').trim();
  if (!name) return null;

  if (meta.name || meta.food_name) {
    return normalizeFoodForLog({
      ...meta,
      id: meta.id || buildFoodHistoryId(meta),
      name,
      food_name: name,
      fromRecentLog: Boolean(meta.dataBasis === 'logged_totals' || meta.fromRecentLog),
    });
  }

  const servingUnit = isLiquidFood(meta) ? 'ml' : 'grams';
  const qty = Number(log.serving_size) || 1;
  const perServing = (value) => {
    const numericValue = Number(value) || 0;
    return qty > 1 ? Math.round((numericValue / qty) * 10) / 10 : numericValue;
  };

  return normalizeFoodForLog({
    id: buildFoodHistoryId({ name, source: 'log' }),
    name,
    food_name: name,
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
    serving_grams: Math.max(1, Math.round((Number(log.serving_grams) || 100) / qty)),
    servingGrams: Math.max(1, Math.round((Number(log.serving_grams) || 100) / qty)),
    source: 'log',
    dataBasis: 'logged_totals',
    fromRecentLog: true,
  });
}

async function saveHistoryQuietly(food) {
  try {
    await saveFoodToHistory(food);
  } catch (historyErr) {
    if (__DEV__) console.warn('Food history save failed:', historyErr?.message);
  }
}

async function searchCachedFoodsFallback(query, maxResults) {
  try {
    const cachedFoods = await foodSearchApi.getCachedFoods();
    const foodsArray = Array.isArray(cachedFoods) ? cachedFoods : [];
    return foodsArray.filter((food) =>
      food && food.name && food.name.toLowerCase().includes(query.toLowerCase()),
    ).slice(0, maxResults);
  } catch (cacheError) {
    if (__DEV__) console.error('🍔 Cache fallback failed:', cacheError);
    return [];
  }
}

async function loadRecentLogsFromFirestore(userId, fetchLimit = RECENT_LOGS_FETCH_LIMIT) {
  const logsRef = collection(db, LOGS_COLLECTION);
  try {
    const recentQuery = query(
      logsRef,
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limitFn(fetchLimit),
    );
    const querySnapshot = await getDocs(recentQuery);
    const logs = [];
    querySnapshot.forEach((logDoc) => {
      logs.push({ id: logDoc.id, ...logDoc.data() });
    });
    return logs;
  } catch (indexErr) {
    if (__DEV__) console.warn('Recent foods orderBy fallback:', indexErr?.message);
    const fallbackQuery = query(logsRef, where('user_id', '==', userId), limitFn(fetchLimit));
    const querySnapshot = await getDocs(fallbackQuery);
    const logs = [];
    querySnapshot.forEach((logDoc) => {
      logs.push({ id: logDoc.id, ...logDoc.data() });
    });
    logs.sort((leftLog, rightLog) => {
      const leftTime = leftLog.created_at?.toDate?.()?.getTime() ?? (leftLog.created_at?.seconds || 0) * MS_PER_SECOND;
      const rightTime = rightLog.created_at?.toDate?.()?.getTime() ?? (rightLog.created_at?.seconds || 0) * MS_PER_SECOND;
      return rightTime - leftTime;
    });
    return logs;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Stable id for saved / recent foods (works for Quick Add items without barcode id).
 * @param {object} food
 * @returns {string}
 */
export function buildFoodHistoryId(food) {
  const name = normalizeHistoryName(food?.name || food?.food_name);
  if (!name) return `hist_${Date.now()}`;
  const slug = name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, HISTORY_NAME_SLUG_MAX);
  const src = String(food?.source || 'manual').slice(0, HISTORY_SOURCE_MAX);
  return `hist_${src}_${slug || 'food'}`;
}

/**
 * Per-serving template for re-logging (Quick Add, search, barcode, coach).
 * @param {object} food
 * @returns {object|null}
 */
export function buildFoodHistoryEntry(food) {
  const normalized = normalizeFoodRecordForStorage(normalizeFoodForLog(food));
  const name = String(normalized?.name || normalized?.food_name || '').trim();
  if (!name) return null;

  const qty = Number(normalized.servingSize) || 1;
  const entry = {
    id: normalized.id || buildFoodHistoryId(normalized),
    name,
    food_name: name,
    brand: normalized.brand || '',
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
    servingUnit: normalized.servingUnit || normalized.serving_unit || 'serving',
    serving_unit: normalized.servingUnit || normalized.serving_unit || 'serving',
    source: normalized.source || 'manual',
    dataBasis: normalized.dataBasis === 'label_serving' || isPer100gSource(normalized.source)
      ? normalized.dataBasis
      : 'logged_totals',
    labelServingGrams: normalized.labelServingGrams,
    fromRecentLog: normalized.dataBasis === 'logged_totals',
    savedAt: Date.now(),
  };

  fillLoggedTotalsHistory(entry, normalized, qty);
  if (entry.dataBasis !== 'logged_totals') {
    fillLabelServingHistory(entry, normalized);
  }

  return entry;
}

/**
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getDailyGoals(userId) {
  if (!userId || !db) return getDefaultGoals();

  try {
    const goalDocRef = doc(db, GOALS_COLLECTION, userId);
    const goalDoc = await getDoc(goalDocRef);

    if (!goalDoc.exists()) {
      return getDefaultGoals();
    }

    const data = goalDoc.data();
    return {
      calories: data.calorie_target || data.calories,
      proteinTarget: data.protein_target || data.proteinTarget,
      carbsTarget: data.carbs_target || data.carbsTarget,
      fatTarget: data.fat_target || data.fatTarget,
      macroSplit: data.macro_split || data.macroSplit || { protein: 0.3, carbs: 0.4, fat: 0.3 },
    };
  } catch (error) {
    if (__DEV__) console.warn('Failed to load goals, using default:', error.message);
    reportCrashAutomaticallySync(error, 'nutritionService - getDailyGoals');
    return getDefaultGoals();
  }
}

/**
 * @param {string} userId
 * @param {object} goals
 */
export async function upsertDailyGoals(userId, goals) {
  if (!userId || !db) return;

  try {
    const goalDocRef = doc(db, GOALS_COLLECTION, userId);
    await setDoc(goalDocRef, {
      user_id: userId,
      calorie_target: goals.calories,
      protein_target: goals.proteinTarget,
      carbs_target: goals.carbsTarget,
      fat_target: goals.fatTarget,
      macro_split: goals.macroSplit,
      updated_at: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    if (__DEV__) console.error('Failed to upsert goals:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - upsertDailyGoals');
    throw error;
  }
}

/**
 * @param {string} userId
 * @param {Date|string} [date]
 * @returns {Promise<object[]>}
 */
export async function getFoodLogsForDate(userId, date = new Date()) {
  if (!userId || !db) return [];
  const dateKey = toDateKey(date);

  try {
    const logsRef = collection(db, LOGS_COLLECTION);
    const logsQuery = query(
      logsRef,
      where('user_id', '==', userId),
      where('date', '==', dateKey),
    );

    const querySnapshot = await getDocs(logsQuery);
    const logs = [];
    querySnapshot.forEach((logDoc) => {
      logs.push(logRowFromSnapshot(logDoc));
    });

    return sortLogsOldestFirst(logs);
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
    totalCalories: totals.calories,
  });

  // 4. Field names stay food_name / calories / protein.
  const payload = buildFoodLogPayload(userId, log, food, servingQuantity, totals);
  const safePayload = stripUndefinedForFirestore(payload);

  try {
    console.log('💾 Saving to Firestore:', {
      food_name: payload.food_name,
      calories: payload.calories,
      serving_size: payload.serving_size,
      serving_grams: payload.serving_grams,
    });
    const docRef = await addDoc(collection(db, LOGS_COLLECTION), safePayload);
    if (__DEV__) console.log('✅ Saved successfully with ID:', docRef.id);
    await saveHistoryQuietly(food);
    return { id: docRef.id, ...safePayload };
  } catch (error) {
    if (__DEV__) console.error('Failed to add food log:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - addFoodLog');
    throw error;
  }
}

/**
 * @param {string} logId
 * @param {object} updates
 * @returns {Promise<object|null>}
 */
export async function updateFoodLog(logId, updates) {
  if (!db || !logId) throw new Error('Invalid parameters');

  try {
    const logDocRef = doc(db, LOGS_COLLECTION, logId);
    await updateDoc(logDocRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });

    const updatedDoc = await getDoc(logDocRef);
    if (updatedDoc.exists()) {
      return { id: updatedDoc.id, ...updatedDoc.data() };
    }
    return null;
  } catch (error) {
    if (__DEV__) console.error('Failed to update food log:', error);
    reportCrashAutomaticallySync(error, 'nutritionService - updateFoodLog');
    throw error;
  }
}

/**
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
export async function deleteFoodLogsForDate(
  userId,
  { date, foodName, logId, deleteAll = false } = {},
) {
  if (!userId || !db) throw new Error('User required');

  if (logId) {
    await deleteFoodLog(logId);
    return { deletedCount: 1, deletedNames: foodName ? [String(foodName)] : ['entry'] };
  }

  const logs = await getFoodLogsForDate(userId, date || new Date());
  const targets = pickDeleteTargets(logs, { foodName, deleteAll });

  if (!targets.length) {
    return { deletedCount: 0, deletedNames: [] };
  }

  for (const logRow of targets) {
    await deleteFoodLog(logRow.id);
  }

  return {
    deletedCount: targets.length,
    deletedNames: targets.map((logRow) => logRow.food_name || 'Food item'),
  };
}

/**
 * @param {object[]} [logs]
 * @returns {object}
 */
export function calculateMacroTotals(logs = []) {
  const totals = {
    calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0,
  };
  for (const item of logs || []) {
    totals.calories += Number(item.calories) || 0;
    totals.protein += Number(item.protein) || 0;
    totals.carbs += Number(item.carbs) || 0;
    totals.fat += Number(item.fat) || 0;
    totals.fiber += Number(item.fiber) || 0;
    totals.sugar += Number(item.sugar) || 0;
    totals.sodium += Number(item.sodium) || 0;
    totals.potassium += Number(item.potassium) || 0;
  }

  const formattedTotals = {
    calories: Math.round(totals.calories),
    protein: Math.round(totals.protein * 10) / 10,
    carbs: Math.round(totals.carbs * 10) / 10,
    fat: Math.round(totals.fat * 10) / 10,
    fiber: Math.round(totals.fiber * 10) / 10,
    sugar: Math.round(totals.sugar * 10) / 10,
    sodium: Math.round(totals.sodium),
    potassium: Math.round(totals.potassium),
  };

  if (__DEV__) console.log('🧮 calculateMacroTotals: Processed', logs.length, 'logs, totals:', formattedTotals);
  return formattedTotals;
}

/**
 * @param {object[]} [logs]
 * @returns {object}
 */
export function splitLogsByMeal(logs = []) {
  const meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  logs.forEach((logRow) => {
    const meal = logRow.meal_type || 'snacks';
    if (!meals[meal]) meals[meal] = [];
    meals[meal].push(logRow);
  });
  return meals;
}

/**
 * @param {object} food
 */
export async function saveFoodToHistory(food) {
  const entry = buildFoodHistoryEntry(food);
  if (!entry) return;
  await cacheFoodProduct(entry);
}

/**
 * @param {object} product
 */
export async function cacheFoodProduct(product) {
  try {
    if (!product) return;
    const id = product.id || buildFoodHistoryId(product);
    const name = String(product.name || product.food_name || '').trim();
    if (!name) return;

    const cachedFoods = await foodSearchApi.getCachedFoods();
    const filtered = cachedFoods.filter(
      (item) => item.id !== id && normalizeHistoryName(item.name || item.food_name) !== normalizeHistoryName(name),
    );
    filtered.unshift({ ...product, id, name: name || product.name, cachedAt: Date.now(), savedAt: Date.now() });

    if (filtered.length > MAX_CACHE_ITEMS) {
      filtered.splice(MAX_CACHE_ITEMS);
    }

    await foodSearchApi.saveCachedFoods(filtered);
  } catch (error) {
    if (__DEV__) console.warn('Failed to cache food product', error.message);
  }
}

/**
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
 * @returns {string|null}
 */
export function getFoodSearchHint() {
  return foodSearchApi.getLastSearchHint?.() ?? null;
}

/**
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
 * @param {string} foodId
 * @param {string} [source]
 * @returns {Promise<object|null>}
 */
export async function getFoodDetails(foodId, source = 'cache') {
  try {
    const cachedFoods = await foodSearchApi.getCachedFoods();
    return cachedFoods.find((food) => food.id === foodId) || null;
  } catch (error) {
    if (__DEV__) console.error('Error getting food details:', error);
    return null;
  }
}

/**
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

function pushUniqueRecent(item, seen, recent) {
  if (!item) return;
  const name = normalizeHistoryName(item.name || item.food_name);
  if (!name || seen.has(name)) return;
  seen.add(name);
  recent.push(normalizeFoodForLog(item));
}

async function fillRecentFromLogs(userId, seen, recent, limit) {
  const logs = await loadRecentLogsFromFirestore(userId, RECENT_LOGS_FETCH_LIMIT);
  for (const logRow of logs) {
    pushUniqueRecent(logToHistoryEntry(logRow), seen, recent);
    if (recent.length >= limit) return;
  }
}

async function fillRecentFromCache(seen, recent, limit) {
  const cached = await getCachedFoods();
  for (const item of cached) {
    pushUniqueRecent({
      ...item,
      fromRecentLog: Boolean(item.dataBasis === 'logged_totals' || item.fromRecentLog),
    }, seen, recent);
    if (recent.length >= limit) return;
  }
}

async function recentFoodsCacheFallback(limit) {
  try {
    const cached = await getCachedFoods();
    return cached.slice(0, limit).map((item) => normalizeFoodForLog(item));
  } catch (_) {
    return [];
  }
}

/**
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
export async function getRecentFoods(userId, limit = 15) {
  try {
    const seen = new Set();
    const recent = [];
    if (userId && db) {
      await fillRecentFromLogs(userId, seen, recent, limit);
    }
    if (recent.length < limit) {
      await fillRecentFromCache(seen, recent, limit);
    }
    return recent.slice(0, limit);
  } catch (error) {
    if (__DEV__) console.error('Error getting recent foods:', error);
    return recentFoodsCacheFallback(limit);
  }
}

/**
 * @param {string} userId
 * @param {{ daysBack?: number }} [options]
 * @returns {Promise<string[]>}
 */
export async function getDatesWithFoodLogs(userId, { daysBack = 28 } = {}) {
  try {
    if (!userId || !db) return [];
    const logsRef = collection(db, LOGS_COLLECTION);
    const datesQuery = query(logsRef, where('user_id', '==', userId), limitFn(DATES_WITH_LOGS_LIMIT));
    const snap = await getDocs(datesQuery);
    const dates = new Set();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    snap.forEach((logDoc) => {
      const date = String(logDoc.data()?.date || '');
      if (!date) return;
      const parsed = new Date(`${date}T12:00:00`);
      if (parsed >= cutoff) dates.add(date);
    });
    return [...dates];
  } catch (_e) {
    return [];
  }
}

/**
 * @param {string} userId
 * @param {number} [maxItems]
 * @returns {Promise<string[]>}
 */
export async function getTopLoggedFoodNames(userId, maxItems = 3) {
  try {
    if (!userId || !db) return [];
    const logsRef = collection(db, LOGS_COLLECTION);
    const namesQuery = query(logsRef, where('user_id', '==', userId), limitFn(TOP_LOGGED_FETCH_LIMIT));
    const snap = await getDocs(namesQuery);
    const freq = {};
    snap.forEach((logDoc) => {
      const name = String(logDoc.data().food_name || '').trim();
      if (!name || name === 'Food') return;
      const key = name.toLowerCase();
      if (!freq[key]) freq[key] = { name, count: 0 };
      freq[key].count += 1;
    });
    return Object.values(freq)
      .sort((left, right) => right.count - left.count)
      .slice(0, maxItems)
      .map((entry) => entry.name);
  } catch (_e) {
    return [];
  }
}

/**
 * users/{userId}.favoriteFoods[] — newest first after sort
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
export async function getFavoriteFoods(userId) {
  if (!userId || !db) return [];
  const snap = await getDoc(doc(db, USERS_COLLECTION, userId));
  const list = Array.isArray(snap.data()?.favoriteFoods) ? snap.data().favoriteFoods : [];
  return [...list].sort((left, right) => String(right.addedDate || '').localeCompare(String(left.addedDate || '')));
}

/**
 * @param {string} userId
 * @param {object} food
 * @returns {Promise<boolean>}
 */
export async function isFavoriteFood(userId, food) {
  const id = favoriteFoodId(food);
  if (!id) return false;
  const list = await getFavoriteFoods(userId);
  return list.some((entry) => String(entry.foodId).toLowerCase() === id);
}

/**
 * @param {string} userId
 * @param {object} food
 * @returns {Promise<{ favorited: boolean, favorites: object[] }>}
 */
export async function toggleFavoriteFood(userId, food) {
  if (!userId || !db) throw new Error('Not signed in');
  const entry = buildFavoriteFoodEntry(food);
  const refUser = doc(db, USERS_COLLECTION, userId);
  const snap = await getDoc(refUser);
  const list = Array.isArray(snap.data()?.favoriteFoods) ? [...snap.data().favoriteFoods] : [];
  const idx = list.findIndex((favorite) => String(favorite.foodId).toLowerCase() === entry.foodId);
  let favorited;
  if (idx >= 0) {
    list.splice(idx, 1);
    favorited = false;
  } else {
    list.unshift(entry);
    favorited = true;
  }
  await setDoc(refUser, { favoriteFoods: list.slice(0, FAVORITE_FOODS_CAP), updatedAt: serverTimestamp() }, { merge: true });
  return { favorited, favorites: list };
}

/**
 * No tokens to clear with the unified food search provider.
 */
export async function clearFatSecretTokens() {
  try {
    if (__DEV__) console.log('No tokens to clear (using unified food search provider)');
  } catch (error) {
    if (__DEV__) console.error('Error clearing tokens:', error);
  }
}
