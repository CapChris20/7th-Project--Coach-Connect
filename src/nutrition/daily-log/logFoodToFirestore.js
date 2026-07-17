/**
 * nutrition Service
 *
 * Purpose: Data/service layer: nutrition Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: getDailyGoals, upsertDailyGoals, getFoodLogsForDate, addFoodLog, updateFoodLog, deleteFoodLog, deleteFoodLogsForDate, calculateMacroTotals
 *
 * @file-header
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../../app-start/config';
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
import searchFoodsService from '../food-search/searchFoodsService';
export { FOOD_SEARCH_OFFLINE_HINT } from '../food-search/searchFoodsService';
import { autoLogErrorSync } from '../../utils/autoLogError';
import { stripUndefinedForFirestore } from '../../shared-utils/firestoreSanitize';
import { normalizeFoodForLog, isLiquidFood } from '../food-search/normalizeFoodQuery';
import { normalizeFoodRecordForStorage } from '../food-search/makeReadableFoodTitle';
import { isPer100gSource, resolveServingGrams } from '../food-details/calculateServingSize';

const LOGS_COLLECTION = 'nutrition_logs';
const GOALS_COLLECTION = 'nutrition_goals';
const FOOD_CACHE_KEY = 'COACHCONNECT_FOOD_CACHE';
const MAX_CACHE_ITEMS = 50;

/** Peel nested metadata.metadata… layers and drop undefined before Firestore writes. */
function flattenFoodForMetadata(food) {
  const normalized = normalizeFoodForLog(food) || {};
  let flat = { ...normalized };
  for (let depth = 0; depth < 6; depth += 1) {
    const inner = flat.metadata;
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) break;
    const { metadata: _nested, ...outerRest } = flat;
    flat = { ...inner, ...outerRest };
  }
  const { metadata: _drop, ...withoutMeta } = flat;
  return stripUndefinedForFirestore(withoutMeta);
}

function normalizeHistoryName(name) {
  const { makeReadableFoodTitle } = require('../food-search/makeReadableFoodTitle');
  return makeReadableFoodTitle({ name })
    .name.toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ');
}

/** Stable id for saved / recent foods (works for Quick Add items without barcode id). */
export function buildFoodHistoryId(food) {
  const name = normalizeHistoryName(food?.name || food?.food_name);
  if (!name) return `hist_${Date.now()}`;
  const slug = name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  const src = String(food?.source || 'manual').slice(0, 12);
  return `hist_${src}_${slug || 'food'}`;
}

/** Per-serving template for re-logging (Quick Add, search, barcode, coach). */
export function buildFoodHistoryEntry(food) {
  const normalized = normalizeFoodRecordForStorage(normalizeFoodForLog(food));
  const name = String(normalized?.name || normalized?.food_name || '').trim();
  if (!name) return null;

  const incomingBasis = String(normalized.dataBasis || '').toLowerCase();
  const isLoggedTotals =
    incomingBasis === 'logged_totals'
    || incomingBasis === 'logged_total'
    || Boolean(normalized.fromRecentLog);

  const qty = Number(normalized.servingSize) || 1;
  const perServing = (v, round = true) => {
    const x = Number(v) || 0;
    if (!x) return 0;
    const scaled = qty > 1 ? x / qty : x;
    return round ? Math.round(scaled * 10) / 10 : scaled;
  };

  const entry = {
    id: normalized.id || buildFoodHistoryId(normalized),
    name,
    food_name: name,
    brand: normalized.brand || '',
    calories: Math.round(perServing(normalized.calories, false)),
    protein: perServing(normalized.protein),
    carbs: perServing(normalized.carbs),
    fat: perServing(normalized.fat),
    fiber: perServing(normalized.fiber),
    sugar: perServing(normalized.sugar),
    sodium: Math.round(perServing(normalized.sodium, false)),
    potassium: Math.round(perServing(normalized.potassium, false)),
    servingSize: 1,
    serving_size: 1,
    servingGrams: Math.max(1, Math.round((Number(normalized.servingGrams) || 100) / (qty > 1 ? qty : 1))),
    serving_grams: Math.max(1, Math.round((Number(normalized.servingGrams) || 100) / (qty > 1 ? qty : 1))),
    servingUnit: normalized.servingUnit || normalized.serving_unit || 'serving',
    serving_unit: normalized.servingUnit || normalized.serving_unit || 'serving',
    source: normalized.source || 'manual',
    dataBasis: isLoggedTotals
      ? 'logged_totals'
      : (normalized.dataBasis === 'label_serving' || isPer100gSource(normalized.source)
        ? normalized.dataBasis
        : 'logged_totals'),
    labelServingGrams: normalized.labelServingGrams,
    fromRecentLog: isLoggedTotals,
    savedAt: Date.now(),
  };

  // Confirmed portion totals → one-serving template so re-log does not double-scale USDA/OFF.
  if (isLoggedTotals) {
    const servingsLogged = Math.max(0.01, Number(normalized.servingSize) || 1);
    const labelG = Math.max(
      1,
      Math.round(Number(normalized.labelServingGrams) || Number(normalized.servingGrams) / servingsLogged || 100),
    );
    entry.dataBasis = 'logged_totals';
    entry.fromRecentLog = true;
    entry.calories = Math.round((Number(normalized.calories) || 0) / servingsLogged);
    entry.protein = Math.round(((Number(normalized.protein) || 0) / servingsLogged) * 10) / 10;
    entry.carbs = Math.round(((Number(normalized.carbs) || 0) / servingsLogged) * 10) / 10;
    entry.fat = Math.round(((Number(normalized.fat) || 0) / servingsLogged) * 10) / 10;
    entry.servingSize = 1;
    entry.serving_size = 1;
    entry.servingGrams = labelG;
    entry.serving_grams = labelG;
    entry.labelServingGrams = labelG;
  } else if (entry.dataBasis !== 'logged_totals') {
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

  return entry;
}

function formatDateKey(date = new Date()) {
  if (typeof date === 'string' && YYYY_MM_DD.test(date)) return date;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date passed to food log: ${String(date)}`);
  }
  const dateKey = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
  return dateKey;
}

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
    // Auto-log the error
    autoLogErrorSync(error, 'nutritionService - getDailyGoals');
    return getDefaultGoals();
  }
}

export async function upsertDailyGoals(userId, goals) {
  if (!userId || !db) return;

  try {
    const goalDocRef = doc(db, GOALS_COLLECTION, userId);
    const payload = {
      user_id: userId,
      calorie_target: goals.calories,
      protein_target: goals.proteinTarget,
      carbs_target: goals.carbsTarget,
      fat_target: goals.fatTarget,
      macro_split: goals.macroSplit,
      updated_at: serverTimestamp(),
    };

    await setDoc(goalDocRef, payload, { merge: true });
  } catch (error) {
    if (__DEV__) console.error('Failed to upsert goals:', error);
    // Auto-log the error
    autoLogErrorSync(error, 'nutritionService - upsertDailyGoals');
    throw error;
  }
}

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;
function toDateKey(date) {
  if (typeof date === 'string' && YYYY_MM_DD.test(date)) return date;
  return formatDateKey(date);
}

export async function getFoodLogsForDate(userId, date = new Date()) {
  if (!userId || !db) return [];
  const dateKey = toDateKey(date);

  try {
    // Query without orderBy to avoid requiring a composite index
    // We'll sort manually after fetching
    const logsRef = collection(db, LOGS_COLLECTION);
    const q = query(
      logsRef,
      where('user_id', '==', userId),
      where('date', '==', dateKey)
    );

    const querySnapshot = await getDocs(q);
    const logs = [];
    querySnapshot.forEach((logDoc) => {
      const data = logDoc.data();
      // Ensure numeric values are properly converted
      const log = {
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
      logs.push(log);
    });

    // Sort manually by created_at timestamp (no index needed)
    return logs.sort((a, b) => {
      try {
        // Handle Firestore Timestamp objects
        let aTime = new Date(0);
        if (a.created_at) {
          if (a.created_at.toDate && typeof a.created_at.toDate === 'function') {
            aTime = a.created_at.toDate();
          } else if (a.created_at.seconds) {
            aTime = new Date(a.created_at.seconds * 1000);
          } else if (a.created_at instanceof Date) {
            aTime = a.created_at;
          } else {
            aTime = new Date(a.created_at);
          }
        }
        
        let bTime = new Date(0);
        if (b.created_at) {
          if (b.created_at.toDate && typeof b.created_at.toDate === 'function') {
            bTime = b.created_at.toDate();
          } else if (b.created_at.seconds) {
            bTime = new Date(b.created_at.seconds * 1000);
          } else if (b.created_at instanceof Date) {
            bTime = b.created_at;
          } else {
            bTime = new Date(b.created_at);
          }
        }
        
        return aTime.getTime() - bTime.getTime();
      } catch (sortError) {
        // If sorting fails, return in original order
        return 0;
      }
    });
  } catch (error) {
    if (__DEV__) console.error('Failed to load food logs:', error);
    // Auto-log the error
    autoLogErrorSync(error, 'nutritionService - getFoodLogsForDate');
    return [];
  }
}

const clampNutrition = (food) => {
  const grams = Math.min(Math.max(Math.round(food.serving_grams || food.servingGrams || 100), 1), 10000);
  return {
    ...food,
    calories: Math.min(Math.max(Math.round(food.calories || 0), 0), 10000),
    protein: Math.min(Math.max(parseFloat(((food.protein || 0)).toFixed(1)), 0), 500),
    carbs: Math.min(Math.max(parseFloat(((food.carbs || 0)).toFixed(1)), 0), 500),
    fat: Math.min(Math.max(parseFloat(((food.fat || 0)).toFixed(1)), 0), 300),
    fiber: Math.min(Math.max(parseFloat(((food.fiber || 0)).toFixed(1)), 0), 100),
    sugar: Math.min(Math.max(parseFloat(((food.sugar || 0)).toFixed(1)), 0), 200),
    sodium: Math.min(Math.max(Math.round(food.sodium || 0), 0), 10000),
    potassium: Math.min(Math.max(Math.round(food.potassium || 0), 0), 10000),
    serving_grams: grams,
    servingGrams: grams,
  };
};

export async function addFoodLog(userId, log) {
  if (!userId || !db) throw new Error('User required');

  // Calculate servingGrams based on source
  let servingGrams = 1;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let totalFiber = 0;
  let totalSugar = 0;
  let totalSodium = 0;
  let totalPotassium = 0;

  const rawFood = log.food || {};
  const food = normalizeFoodRecordForStorage(clampNutrition(flattenFoodForMetadata(rawFood)));
  let rawQty;
  if (log.servingSize != null && log.servingSize !== '') {
    rawQty = Number(log.servingSize);
  } else if (food.servingSize != null && food.servingSize !== '') {
    rawQty = Number(food.servingSize);
  } else {
    rawQty = NaN;
  }
  const servingQuantity = (typeof rawQty === 'number' && !Number.isNaN(rawQty) && rawQty > 0) ? rawQty : 1;

  const num = (v) => {
    const n = Number(v);
    return (typeof n === 'number' && !Number.isNaN(n)) ? n : 0;
  };

  const basis = String(food.dataBasis || '').toLowerCase();
  const isLoggedTotal = basis === 'logged_total' || basis === 'logged_totals';
  const isLabelServing = basis === 'label_serving' || basis === 'per_serving';

  if (
    (food.source === 'openfoodfacts' || food.source === 'usda')
    && !isLoggedTotal
    && !isLabelServing
  ) {
    // These sources provide per 100g data (servingQuantity is servings of 100g)
    servingGrams = servingQuantity * 100;
    totalCalories = num(food.calories) * servingQuantity;
    totalProtein = num(food.protein) * servingQuantity;
    totalCarbs = num(food.carbs) * servingQuantity;
    totalFat = num(food.fat) * servingQuantity;
    totalFiber = num(food.fiber) * servingQuantity;
    totalSugar = num(food.sugar) * servingQuantity;
    totalSodium = num(food.sodium) * servingQuantity;
    totalPotassium = num(food.potassium) * servingQuantity;
  } else {
    // Manual / confirm sheet / FatSecret / Serper label: values are already totals for this portion
    const sg = num(food.servingGrams);
    servingGrams = sg > 0 ? sg : servingQuantity;
    totalCalories = num(food.calories);
    totalProtein = num(food.protein);
    totalCarbs = num(food.carbs);
    totalFat = num(food.fat);
    totalFiber = num(food.fiber);
    totalSugar = num(food.sugar);
    totalSodium = num(food.sodium);
    totalPotassium = num(food.potassium);
  }

  if (__DEV__) console.log('🍎 Adding food log:', {
    name: food.name,
    source: food.source,
    servingQuantity,
    servingGrams,
    totalCalories,
  });

  const payload = {
    user_id: userId,
    date: toDateKey(log.date || new Date()),
    meal_type: log.mealType,
    food_name: food.name || log.foodName || 'Food Item',
    brand: food.brand || '',
    serving_size: Math.round(num(servingQuantity) * 100) / 100,
    serving_grams: Math.round(num(servingGrams)),
    calories: Math.round(num(totalCalories)),
    protein: Math.round(num(totalProtein) * 10) / 10,
    carbs: Math.round(num(totalCarbs) * 10) / 10,
    fat: Math.round(num(totalFat) * 10) / 10,
    fiber: Math.round(num(totalFiber) * 10) / 10,
    sugar: Math.round(num(totalSugar) * 10) / 10,
    sodium: Math.round(num(totalSodium) * 10) / 10,
    potassium: Math.round(num(totalPotassium)),
    originalUnit: food.originalUnit || food.loggedUnit || food.preferredUnit || null,
    originalAmount: food.originalAmount ?? food.loggedAmount ?? null,
    loggedUnit: food.loggedUnit || food.preferredUnit || food.originalUnit || null,
    loggedAmount: food.loggedAmount ?? food.originalAmount ?? null,
    preferredUnit: food.preferredUnit || food.loggedUnit || food.originalUnit || null,
    metadata: food,
    created_at: serverTimestamp(),
  };
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
    try {
      await saveFoodToHistory(food);
    } catch (historyErr) {
      if (__DEV__) console.warn('Food history save failed:', historyErr?.message);
    }
    return { id: docRef.id, ...safePayload };
  } catch (error) {
    if (__DEV__) console.error('Failed to add food log:', error);
    // Auto-log the error
    autoLogErrorSync(error, 'nutritionService - addFoodLog');
    throw error;
  }
}

export async function updateFoodLog(logId, updates) {
  if (!db || !logId) throw new Error('Invalid parameters');

  try {
    const logDocRef = doc(db, LOGS_COLLECTION, logId);
    await updateDoc(logDocRef, {
      ...updates,
      updated_at: serverTimestamp(),
    });

    // Fetch updated document
    const updatedDoc = await getDoc(logDocRef);
    if (updatedDoc.exists()) {
      return { id: updatedDoc.id, ...updatedDoc.data() };
    }
    return null;
  } catch (error) {
    if (__DEV__) console.error('Failed to update food log:', error);
    // Auto-log the error
    autoLogErrorSync(error, 'nutritionService - updateFoodLog');
    throw error;
  }
}

export async function deleteFoodLog(logId) {
  if (!db || !logId) throw new Error('Invalid parameters');

  try {
    const logDocRef = doc(db, LOGS_COLLECTION, logId);
    await deleteDoc(logDocRef);
  } catch (error) {
    if (__DEV__) console.error('Failed to delete food log:', error);
    // Auto-log the error
    autoLogErrorSync(error, 'nutritionService - deleteFoodLog');
    throw error;
  }
}

function foodNameMatches(logName, query) {
  const a = String(logName || '').toLowerCase().trim();
  const bRaw = String(query || '').toLowerCase().trim();
  if (!a || !bRaw) return false;

  let b = bRaw
    .replace(/^(the|my|both|one|two|three|\d+)\s+/i, '')
    .replace(/\s+(today|yesterday|from.*)$/i, '')
    .trim();

  if (a.includes(b) || b.includes(a)) return true;

  const tokens = b.split(/[\s,]+/).filter((w) => w.length >= 4);
  if (tokens.some((t) => a.includes(t))) return true;

  if (/pizza|domino/.test(b) && /pizza|domino/.test(a)) return true;
  if (/chicken/.test(b) && /chicken/.test(a)) return true;
  if (/rice/.test(b) && /rice/.test(a)) return true;

  return false;
}

/** Delete nutrition log(s) for a date — used by Nutrition tab and AI Coach. */
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
  let targets = logs;

  if (deleteAll) {
    targets = logs;
  } else if (foodName) {
    targets = logs.filter((l) => foodNameMatches(l.food_name, foodName));
  } else if (logs.length) {
    targets = [...logs]
      .sort((a, b) => {
        const ta = a.created_at?.toMillis?.() || a.created_at?.seconds * 1000 || 0;
        const tb = b.created_at?.toMillis?.() || b.created_at?.seconds * 1000 || 0;
        return tb - ta;
      })
      .slice(0, 1);
  }

  if (!targets.length) {
    return { deletedCount: 0, deletedNames: [] };
  }

  for (const log of targets) {
    await deleteFoodLog(log.id);
  }

  return {
    deletedCount: targets.length,
    deletedNames: targets.map((l) => l.food_name || 'Food item'),
  };
}

export function calculateMacroTotals(logs = []) {
  const totals = (logs || []).reduce(
    (acc, item) => {
      // Ensure all values are numbers and handle missing data
      const calories = Number(item.calories) || 0;
      const protein = Number(item.protein) || 0;
      const carbs = Number(item.carbs) || 0;
      const fat = Number(item.fat) || 0;
      const fiber = Number(item.fiber) || 0;
      const sugar = Number(item.sugar) || 0;
      const sodium = Number(item.sodium) || 0;
      const potassium = Number(item.potassium) || 0;
      
      // Add to totals
      acc.calories += calories;
      acc.protein += protein;
      acc.carbs += carbs;
      acc.fat += fat;
      acc.fiber += fiber;
      acc.sugar += sugar;
      acc.sodium += sodium;
      acc.potassium += potassium;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 }
  );
  
  // Ensure proper units: calories (kcal), macros (g), sodium/potassium (mg)
  const formattedTotals = {
    calories: Math.round(totals.calories), // kcal, rounded to nearest integer
    protein: Math.round(totals.protein * 10) / 10, // g, rounded to 1 decimal
    carbs: Math.round(totals.carbs * 10) / 10, // g, rounded to 1 decimal
    fat: Math.round(totals.fat * 10) / 10, // g, rounded to 1 decimal
    fiber: Math.round(totals.fiber * 10) / 10, // g, rounded to 1 decimal
    sugar: Math.round(totals.sugar * 10) / 10, // g, rounded to 1 decimal
    sodium: Math.round(totals.sodium), // mg, rounded to nearest integer
    potassium: Math.round(totals.potassium), // mg, rounded to nearest integer
  };
  
  if (__DEV__) console.log('🧮 calculateMacroTotals: Processed', logs.length, 'logs, totals:', formattedTotals);
  return formattedTotals;
}

export function splitLogsByMeal(logs = []) {
  const meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };
  logs.forEach((log) => {
    const meal = log.meal_type || 'snacks';
    if (!meals[meal]) meals[meal] = [];
    meals[meal].push(log);
  });
  return meals;
}

export async function saveFoodToHistory(food) {
  const entry = buildFoodHistoryEntry(food);
  if (!entry) return;
  await cacheFoodProduct(entry);
}

export async function cacheFoodProduct(product) {
  try {
    if (!product) return;
    const id = product.id || buildFoodHistoryId(product);
    const name = String(product.name || product.food_name || '').trim();
    if (!name) return;

    const cachedFoods = await searchFoodsService.getCachedFoods();
    const filtered = cachedFoods.filter(
      (item) => item.id !== id && normalizeHistoryName(item.name || item.food_name) !== normalizeHistoryName(name),
    );
    filtered.unshift({ ...product, id, name: name || product.name, cachedAt: Date.now(), savedAt: Date.now() });

    if (filtered.length > MAX_CACHE_ITEMS) {
      filtered.splice(MAX_CACHE_ITEMS);
    }

    await searchFoodsService.saveCachedFoods(filtered);
  } catch (error) {
    if (__DEV__) console.warn('Failed to cache food product', error.message);
  }
}

export async function getCachedFoods() {
  try {
    return await searchFoodsService.getCachedFoods();
  } catch (error) {
    if (__DEV__) console.error('Error getting cached foods:', error);
    // Return sample foods even if cache fails
    return [
      {
        id: 'fallback-1',
        name: 'Apple',
        calories: 52,
        protein: 0.3,
        carbs: 14,
        fat: 0.2,
        servingSize: 1,
        servingUnit: 'medium',
      }
    ];
  }
}

function getDefaultGoals() {
  return {
    calories: 2200,
    proteinTarget: 150,
    carbsTarget: 220,
    fatTarget: 70,
    macroSplit: { protein: 0.3, carbs: 0.4, fat: 0.3 },
  };
}

// Food search functions using unified provider
export function getFoodSearchHint() {
  return searchFoodsService.getLastSearchHint?.() ?? null;
}

export async function searchFoods(query, maxResults = 20) {
  try {
    if (__DEV__) console.log('🍔 Starting unified food search for:', query);
    const results = await searchFoodsService.searchFoods(query, maxResults);
    if (__DEV__) console.log(`🍔 Unified search returned ${results.length} results`);
    return results;
  } catch (error) {
    if (__DEV__) console.error('🍔 Error in unified food search:', error.message);
    // Fallback to cached foods only
    if (__DEV__) console.log('🍔 Falling back to local cache only');
    try {
      const cachedFoods = await searchFoodsService.getCachedFoods();
      // Ensure cachedFoods is an array before filtering
      const foodsArray = Array.isArray(cachedFoods) ? cachedFoods : [];
      return foodsArray.filter(food => 
        food && food.name && food.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, maxResults);
    } catch (cacheError) {
      if (__DEV__) console.error('🍔 Cache fallback failed:', cacheError);
      // Return empty array if everything fails
      return [];
    }
  }
}

export async function lookupBarcode(barcode) {
  try {
    if (__DEV__) console.log('🍔 Looking up barcode:', barcode);
    const result = await searchFoodsService.lookupBarcode(barcode);
    if (__DEV__) console.log(`🍔 Barcode lookup result:`, result ? 'Found' : 'Not found');
    return result;
  } catch (error) {
    if (__DEV__) console.error('🍔 Error looking up barcode:', error);
    return null;
  }
}

export async function getFoodDetails(foodId, source = 'cache') {
  try {
    // For now, just return cached food details
    // This can be enhanced later to call server endpoints
    const cachedFoods = await searchFoodsService.getCachedFoods();
    return cachedFoods.find(food => food.id === foodId) || null;
  } catch (error) {
    if (__DEV__) console.error('Error getting food details:', error);
    return null;
  }
}

export async function getPopularFoods(limit = 10) {
  try {
    // Return cached foods sorted by recent usage
    const cachedFoods = await searchFoodsService.getCachedFoods();
    return cachedFoods.slice(0, limit);
  } catch (error) {
    if (__DEV__) console.error('Error getting popular foods:', error);
    return [];
  }
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
      fromRecentLog: Boolean(meta.dataBasis === 'logged_totals' || meta.dataBasis === 'logged_total' || meta.fromRecentLog),
    });
  }

  const servingUnit = isLiquidFood(meta) ? 'ml' : 'grams';
  const qty = Number(log.serving_size) || 1;
  const perServing = (v) => {
    const x = Number(v) || 0;
    return qty > 1 ? Math.round((x / qty) * 10) / 10 : x;
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

async function loadRecentLogsFromFirestore(userId, fetchLimit = 80) {
  const logsRef = collection(db, LOGS_COLLECTION);
  try {
    const q = query(
      logsRef,
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limitFn(fetchLimit),
    );
    const querySnapshot = await getDocs(q);
    const logs = [];
    querySnapshot.forEach((logDoc) => {
      logs.push({ id: logDoc.id, ...logDoc.data() });
    });
    return logs;
  } catch (indexErr) {
    if (__DEV__) console.warn('Recent foods orderBy fallback:', indexErr?.message);
    const q = query(logsRef, where('user_id', '==', userId), limitFn(fetchLimit));
    const querySnapshot = await getDocs(q);
    const logs = [];
    querySnapshot.forEach((logDoc) => {
      logs.push({ id: logDoc.id, ...logDoc.data() });
    });
    logs.sort((a, b) => {
      const aT = a.created_at?.toDate?.()?.getTime() ?? (a.created_at?.seconds || 0) * 1000;
      const bT = b.created_at?.toDate?.()?.getTime() ?? (b.created_at?.seconds || 0) * 1000;
      return bT - aT;
    });
    return logs;
  }
}

export async function getRecentFoods(userId, limit = 15) {
  try {
    const seen = new Set();
    const recent = [];

    const pushUnique = (item) => {
      if (!item) return;
      const name = normalizeHistoryName(item.name || item.food_name);
      if (!name || seen.has(name)) return;
      seen.add(name);
      recent.push(normalizeFoodForLog(item));
    };

    if (userId && db) {
      const logs = await loadRecentLogsFromFirestore(userId, 80);
      for (const log of logs) {
        pushUnique(logToHistoryEntry(log));
        if (recent.length >= limit) break;
      }
    }

    if (recent.length < limit) {
      const cached = await getCachedFoods();
      for (const item of cached) {
        pushUnique({
          ...item,
          fromRecentLog: Boolean(item.dataBasis === 'logged_totals' || item.dataBasis === 'logged_total' || item.fromRecentLog),
        });
        if (recent.length >= limit) break;
      }
    }

    return recent.slice(0, limit);
  } catch (error) {
    if (__DEV__) console.error('Error getting recent foods:', error);
    try {
      const cached = await getCachedFoods();
      return cached.slice(0, limit).map((item) => normalizeFoodForLog(item));
    } catch (_) {
      return [];
    }
  }
}

export async function getDatesWithFoodLogs(userId, { daysBack = 28 } = {}) {
  try {
    if (!userId || !db) return [];
    const logsRef = collection(db, LOGS_COLLECTION);
    const q = query(logsRef, where('user_id', '==', userId), limitFn(400));
    const snap = await getDocs(q);
    const dates = new Set();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysBack);
    snap.forEach((d) => {
      const date = String(d.data()?.date || '');
      if (!date) return;
      const parsed = new Date(`${date}T12:00:00`);
      if (parsed >= cutoff) dates.add(date);
    });
    return [...dates];
  } catch (_e) {
    return [];
  }
}

export async function getTopLoggedFoodNames(userId, maxItems = 3) {
  try {
    if (!userId || !db) return [];
    const logsRef = collection(db, LOGS_COLLECTION);
    const q = query(logsRef, where('user_id', '==', userId), limitFn(100));
    const snap = await getDocs(q);
    const freq = {};
    snap.forEach((d) => {
      const name = String(d.data().food_name || '').trim();
      if (!name || name === 'Food') return;
      const key = name.toLowerCase();
      if (!freq[key]) freq[key] = { name, n: 0 };
      freq[key].n += 1;
    });
    return Object.values(freq)
      .sort((a, b) => b.n - a.n)
      .slice(0, maxItems)
      .map((f) => f.name);
  } catch (_e) {
    return [];
  }
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
      protein: Math.round((Number(food?.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(food?.carbs) || 0) * 10) / 10,
      fat: Math.round((Number(food?.fat) || 0) * 10) / 10,
    },
    servingGrams: Number(food?.servingGrams || food?.serving_grams) || null,
    servingSize: Number(food?.servingSize || food?.serving_size) || 1,
    servingUnit: food?.servingUnit || food?.serving_unit || 'serving',
    dataBasis: food?.dataBasis || null,
    source: food?.source || 'manual',
    brand: food?.brand_name || food?.brand || '',
    addedDate: new Date().toISOString(),
  };
}

/** users/{userId}.favoriteFoods[] — newest first after sort */
export async function getFavoriteFoods(userId) {
  if (!userId || !db) return [];
  const snap = await getDoc(doc(db, 'users', userId));
  const list = Array.isArray(snap.data()?.favoriteFoods) ? snap.data().favoriteFoods : [];
  return [...list].sort((a, b) => String(b.addedDate || '').localeCompare(String(a.addedDate || '')));
}

export async function isFavoriteFood(userId, food) {
  const id = favoriteFoodId(food);
  if (!id) return false;
  const list = await getFavoriteFoods(userId);
  return list.some((f) => String(f.foodId).toLowerCase() === id);
}

export async function toggleFavoriteFood(userId, food) {
  if (!userId || !db) throw new Error('Not signed in');
  const entry = buildFavoriteFoodEntry(food);
  const refUser = doc(db, 'users', userId);
  const snap = await getDoc(refUser);
  const list = Array.isArray(snap.data()?.favoriteFoods) ? [...snap.data().favoriteFoods] : [];
  const idx = list.findIndex((f) => String(f.foodId).toLowerCase() === entry.foodId);
  let favorited;
  if (idx >= 0) {
    list.splice(idx, 1);
    favorited = false;
  } else {
    list.unshift(entry);
    favorited = true;
  }
  await setDoc(refUser, { favoriteFoods: list.slice(0, 100), updatedAt: serverTimestamp() }, { merge: true });
  return { favorited, favorites: list };
}

// Clean up old functions
export async function clearFatSecretTokens() {
  try {
    // No tokens to clear with new provider
    if (__DEV__) console.log('No tokens to clear (using unified food search provider)');
  } catch (error) {
    if (__DEV__) console.error('Error clearing tokens:', error);
  }
}

