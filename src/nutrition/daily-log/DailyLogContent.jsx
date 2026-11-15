// Nutrition tab shell: live logs, goals, and overlay screens (search / scan / settings / facts).
// Flow: listen nutrition_logs for viewDate → load goals → onboarding or DailyFoodLogScreen → child overlays.
// Used by the client nutrition tab. Firestore writes live in saveLoggedFood.js.

import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { auth, db } from '../../app-start/cloudConnection';
import { getClientDateKey } from '../../helpers/dateStrings';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, lightColors, darkColors } from '../../look-and-feel/colorPalette';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import {
  getDailyGoals,
  getFoodLogsForDate,
  getDatesWithFoodLogs,
  calculateMacroTotals,
  splitLogsByMeal,
  addFoodLog,
  updateFoodLog,
  deleteFoodLog,
  upsertDailyGoals,
  getTopLoggedFoodNames,
} from '../daily-log/saveLoggedFood';
import NutritionNewUserSetupScreen, {
  NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE,
} from '../targets/NutritionSetupScreen';
import DailyFoodLogScreen from './DailyFoodLogScreen';
import QuickAddNutrition from '../quick-add/QuickAddNutrition';
import FoodSearchScreen from '../food-search/FoodSearchScreen';
import BarcodeScannerScreen from '../barcode/BarcodeScannerScreen';
import NutritionSettingsScreen from '../targets/NutritionSettingsScreen';
import NutritionFactsScreen from '../food-details/NutritionFactsScreen';
import EditServingPopup from '../food-details/EditServingPopup';

// ===== NAMED CONSTANTS =====

const DEDUP_CLEAR_MS = 3000;
const DEFAULT_CALORIE_GOAL = 2000;
const FALLBACK_CALORIE_GOAL = 2200;
// Fallback macro goals when the user has no saved targets yet (same defaults as saveLoggedFood).
const DEFAULT_PROTEIN_GOAL = 150;
const DEFAULT_CARBS_GOAL = 220;
const DEFAULT_FAT_GOAL = 70;
// Settings overlay uses slightly different carb/fat fallbacks — keep those letters frozen.
const SETTINGS_FALLBACK_PROTEIN = 150;
const SETTINGS_FALLBACK_CARBS = 200;
const SETTINGS_FALLBACK_FAT = 65;
// Manipulate here: how many frequent-food names to preload for search suggestions.
const TOP_FOOD_NAMES_LIMIT = 3;
const DEFAULT_SERVING_GRAMS = 100;
const MACRO_ROUND_TENTHS = 10;
const OZ_TO_GRAMS = 28.3495;
const GRAMS_TO_OZ = 1 / OZ_TO_GRAMS;
const ML_TO_FL_OZ = 1 / 29.5735;
const MAX_EDIT_RATIO = 10;
const MIN_EDIT_RATIO = 0.01;
const MEAL_TYPE_NAMES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const flexScrollHost = { flex: 1, minHeight: 0 };

// ===== HELPER FUNCTIONS =====

function numberOrZero(value) {
  const parsed = Number(value);
  const parsedIsRealNumber = typeof parsed === 'number' && !Number.isNaN(parsed);
  if (parsedIsRealNumber) return parsed;
  return 0;
}

function roundTenths(value) {
  const scaled = numberOrZero(value) * MACRO_ROUND_TENTHS;
  return Math.round(scaled) / MACRO_ROUND_TENTHS;
}

// Blank text in an edit field means "not entered" (null), not zero.
// Used by the edit-amount save so untouched fields keep the old serving.
function parseOptionalNumber(text) {
  const textIsBlank = text == null || String(text).trim() === '';
  if (textIsBlank) return null;
  const parsed = Number(text);
  if (Number.isNaN(parsed)) return null;
  return parsed;
}

function mapLogDocToRow(logDoc) {
  const data = logDoc.data();
  return {
    id: logDoc.id,
    ...data,
    calories: Number(data.calories) || 0,
    protein: Number(data.protein) || 0,
    carbs: Number(data.carbs) || 0,
    fat: Number(data.fat) || 0,
  };
}

function stampToDate(stamp) {
  if (!stamp) return new Date(0);
  if (typeof stamp.toDate === 'function') return stamp.toDate();
  return new Date(stamp || 0);
}

function sortLogsByCreatedAt(rows) {
  return rows.slice().sort((left, right) => {
    const leftTime = stampToDate(left.created_at);
    const rightTime = stampToDate(right.created_at);
    return leftTime - rightTime;
  });
}

function safeEntryObject(entry) {
  if (entry) return entry;
  return {};
}

function foodFromQuickAddEntry(entry) {
  const safeEntry = safeEntryObject(entry);
  let foodName = 'Food Item';
  if (safeEntry.name) foodName = safeEntry.name;
  let servingUnit = 'g';
  if (safeEntry.servingUnit) servingUnit = String(safeEntry.servingUnit).trim() || 'g';
  return {
    name: foodName,
    calories: numberOrZero(safeEntry.calories),
    protein: roundTenths(safeEntry.protein),
    carbs: roundTenths(safeEntry.carbs),
    fat: roundTenths(safeEntry.fat),
    fiber: roundTenths(safeEntry.fiber),
    sugar: roundTenths(safeEntry.sugar),
    sodium: numberOrZero(safeEntry.sodium),
    servingGrams: Math.round(numberOrZero(safeEntry.servingSize)) || DEFAULT_SERVING_GRAMS,
    servingSize: numberOrZero(safeEntry.quantity) || 1,
    servingUnit,
    source: 'manual',
  };
}

/**
 * Macro lane cards for DailyFoodLogScreen — Design Law accentGradients only.
 * @param {object} totals from calculateMacroTotals
 * @param {object|null} goals
 * @returns {Array}
 */
function buildMacroLanes(totals, goals) {
  const proteinEaten = Math.round(totals.protein || 0);
  const carbsEaten = Math.round(totals.carbs || 0);
  const fatEaten = Math.round(totals.fat || 0);

  let proteinGoal = DEFAULT_PROTEIN_GOAL;
  let carbsGoal = DEFAULT_CARBS_GOAL;
  let fatGoal = DEFAULT_FAT_GOAL;
  let proteinPercent = 0;
  let carbsPercent = 0;
  let fatPercent = 0;
  if (goals) {
    if (goals.proteinTarget) {
      proteinGoal = goals.proteinTarget;
      proteinPercent = Math.round(((totals.protein || 0) / goals.proteinTarget) * 100);
    }
    if (goals.carbsTarget) {
      carbsGoal = goals.carbsTarget;
      carbsPercent = Math.round(((totals.carbs || 0) / goals.carbsTarget) * 100);
    }
    if (goals.fatTarget) {
      fatGoal = goals.fatTarget;
      fatPercent = Math.round(((totals.fat || 0) / goals.fatTarget) * 100);
    }
  }

  return [
    {
      label: 'Protein',
      val: proteinEaten,
      goal: proteinGoal,
      color: accentGradients[2],
      pct: proteinPercent,
    },
    {
      label: 'Carbs',
      val: carbsEaten,
      goal: carbsGoal,
      color: accentGradients[1],
      pct: carbsPercent,
    },
    {
      label: 'Fat',
      val: fatEaten,
      goal: fatGoal,
      color: accentGradients[4],
      pct: fatPercent,
    },
  ];
}

/**
 * Breakfast / lunch / dinner / snacks rows with calorie sums for the day list.
 * @param {object} mealSplit from splitLogsByMeal
 * @returns {Array}
 */
function buildMealSummaries(mealSplit) {
  const mealRows = [];
  for (let index = 0; index < MEAL_TYPE_NAMES.length; index += 1) {
    const mealType = MEAL_TYPE_NAMES[index];
    const foods = mealSplit[mealType] || [];
    let mealCalories = 0;
    for (let foodIndex = 0; foodIndex < foods.length; foodIndex += 1) {
      mealCalories += foods[foodIndex].calories || 0;
    }
    const displayName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
    mealRows.push({ name: displayName, cals: mealCalories, foods });
  }
  return mealRows;
}

function servingUnitIsMilliliters(logRow) {
  let unitText = '';
  if (logRow && logRow.metadata && logRow.metadata.servingUnit) {
    unitText = String(logRow.metadata.servingUnit).toLowerCase();
  }
  return unitText === 'ml';
}

function gramsOrMlToDisplayOz(gramsOrMl, unitIsMilliliters) {
  const conversion = unitIsMilliliters ? ML_TO_FL_OZ : GRAMS_TO_OZ;
  return (gramsOrMl * conversion).toFixed(1);
}

function amountLabelForEditingLog(editingLog) {
  if (servingUnitIsMilliliters(editingLog)) return 'Amount (fl oz)';
  return 'Amount (oz)';
}

function quantityPlaceholderForEditingLog(editingLog) {
  if (!editingLog) return '';
  const quantity = Number(editingLog.serving_size) || 1;
  return String(Math.round(quantity * 100) / 100);
}

function amountPlaceholderForEditingLog(editingLog) {
  if (!editingLog) return '';
  const gramsOrMl = Number(editingLog.serving_grams) || 0;
  return gramsOrMlToDisplayOz(gramsOrMl, servingUnitIsMilliliters(editingLog));
}

/**
 * After onboarding saves goals, reload goals + today's logs together.
 * Kept out of the handler so the recipe stays a numbered list (no Promise.all inline).
 */
async function loadGoalsAndLogsForToday(userId, dateKey) {
  const goalsData = await getDailyGoals(userId);
  const logsData = await getFoodLogsForDate(userId, dateKey);
  return { goalsData, logsData };
}

function pickFavoriteFoodList(userData) {
  // Prefer nutrition* keys; fall back to older favoriteFoods field names.
  const loved = userData.nutritionFavoriteFoods || userData.favoriteFoods || [];
  if (!Array.isArray(loved)) return [];
  return loved.filter(Boolean);
}

function pickLeastFavoriteFoodList(userData) {
  const skipped =
    userData.nutritionLeastFavoriteFoods || userData.leastFavoriteFoods || [];
  if (!Array.isArray(skipped)) return [];
  return skipped.filter(Boolean);
}

function NutritionShellBottomNav({
  hideBottomNav,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
}) {
  if (hideBottomNav) return null;
  return (
    <ShellBottomNavAnchor>
      <BottomMenuBar
        onHomePress={onHomePress}
        onPlusPress={onPlusPress}
        onVoicePress={onVoicePress}
        onNutritionPress={onNutritionPress}
        onWorkoutPress={onWorkoutPress}
        onMessagesPress={onMessagesPress}
        activeTabKey="nutrition"
      />
    </ShellBottomNavAnchor>
  );
}

function resolveSettingsCurrentGoals(goals) {
  let settingsCalories = DEFAULT_CALORIE_GOAL;
  let settingsProtein = SETTINGS_FALLBACK_PROTEIN;
  let settingsCarbs = SETTINGS_FALLBACK_CARBS;
  let settingsFat = SETTINGS_FALLBACK_FAT;
  if (goals) {
    if (goals.calories != null) settingsCalories = goals.calories;
    if (goals.proteinTarget != null) settingsProtein = goals.proteinTarget;
    if (goals.carbsTarget != null) settingsCarbs = goals.carbsTarget;
    if (goals.fatTarget != null) settingsFat = goals.fatTarget;
  }
  return {
    calories: settingsCalories,
    proteinTarget: settingsProtein,
    carbsTarget: settingsCarbs,
    fatTarget: settingsFat,
  };
}

function LoadingNutritionShell({ screenBg, inkColor, bottomNav }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={inkColor} size="small" />
      </View>
      {bottomNav}
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Main Daily Food Log screen component.
 * Manages daily meal logs, macro goals, and child modals for food search and setup.
 */
export const DailyLogContent = ({
  onBack,
  onProfilePress,
  onSettingsPress,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onNutritionDataChanged,
  hideBottomNav = false,
  /** Parent tab bar overlays content (e.g. ClientMainScreen absolute BottomMenuBar). */
  onOnboardingActiveChange,
  /** Notify parent when nutrition settings modal is open (hide tab bar). */
  onSettingsOverlayChange,
  /** Design Law Weekly Momentum (missing-screens 11/12). */
  onOpenWeeklyMomentum,
} = {}) => {
  // ----- state (order frozen — do not reorder hooks) -----
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [goals, setGoals] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [initialSearchQuery, setInitialSearchQuery] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [activeMealType, setActiveMealType] = useState('breakfast');
  const [editingLog, setEditingLog] = useState(null);
  const [editAmountValue, setEditAmountValue] = useState('');
  const [editQuantityValue, setEditQuantityValue] = useState('');
  const [showNutritionSettings, setShowNutritionSettings] = useState(false);
  // vocab: showDailyFacts = full-day NutritionFactsScreen overlay (not per-food confirm)
  const [showDailyFacts, setShowDailyFacts] = useState(false);
  const [recordError, setLogError] = useState(null);
  const [topFoodNames, setTopFoodNames] = useState([]);
  // PNG 21 hub pills — from users/{uid} onboarding prefs
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [leastFavoriteFoods, setLeastFavoriteFoods] = useState([]);
  const [viewDate, setViewDate] = useState(getClientDateKey());
  const [datesWithLogs, setDatesWithLogs] = useState([]);
  const pendingLogs = useRef(new Set());
  const { isDark } = useTheme();

  // Tell parent when nutrition onboarding is covering the tab bar.
  useEffect(() => {
    if (typeof onOnboardingActiveChange !== 'function') return undefined;
    onOnboardingActiveChange(needsOnboarding);
    return () => onOnboardingActiveChange(false);
  }, [needsOnboarding, onOnboardingActiveChange]);

  // Tell parent when settings overlay should hide the tab bar.
  useEffect(() => {
    if (typeof onSettingsOverlayChange !== 'function') return undefined;
    onSettingsOverlayChange(showNutritionSettings);
    return () => onSettingsOverlayChange(false);
  }, [showNutritionSettings, onSettingsOverlayChange]);

  const today = getClientDateKey();
  let uid = null;
  if (auth.currentUser) {
    uid = auth.currentUser.uid;
  }

  // Live nutrition_logs for the day the user is viewing.
  useEffect(() => {
    if (!uid || !db) return undefined;

    const logsRef = collection(db, 'nutrition_logs');
    const logsQuery = query(
      logsRef,
      where('user_id', '==', uid),
      where('date', '==', viewDate),
    );

    // vocab: onSnapshot = live Firestore listener; returns unsubscribe
    const unsubscribe = onSnapshot(
      logsQuery,
      (querySnapshot) => {
        const logRows = [];
        querySnapshot.forEach((logDoc) => {
          logRows.push(mapLogDocToRow(logDoc));
        });
        setLogs(sortLogsByCreatedAt(logRows));
        setLoading(false);
      },
      (err) => {
        console.error('Nutrition logs listener:', err);
      },
    );

    return () => {
      try {
        unsubscribe();
      } catch (_) {
        /* ignore */
      }
    };
  }, [uid, viewDate, db]);

  // Calendar dots — which dates already have food logged.
  useEffect(() => {
    if (!uid) return;
    getDatesWithFoodLogs(uid).then(setDatesWithLogs).catch(() => setDatesWithLogs([]));
  }, [uid, logs.length]);

  // First load: do they have nutrition_goals? If not → onboarding.
  useEffect(() => {
    if (!uid) return;
    const loadGoalsOrOnboarding = async () => {
      setLoading(true);
      try {
        let goalDocExists = false;
        if (db) {
          const goalSnap = await getDoc(doc(db, 'nutrition_goals', uid));
          goalDocExists = goalSnap.exists();
        }

        if (!goalDocExists) {
          setNeedsOnboarding(true);
        } else {
          const goalsData = await getDailyGoals(uid);
          setGoals(goalsData);
        }
      } catch (err) {
        console.error('DailyLogContent load error:', err);
      } finally {
        setLoading(false);
      }
    };
    loadGoalsOrOnboarding();
  }, [uid]);

  // Keep goals in sync when nutrition_goals doc changes (skip during onboarding).
  useEffect(() => {
    if (!uid || !db || needsOnboarding) return undefined;
    const goalRef = doc(db, 'nutrition_goals', uid);
    return onSnapshot(
      goalRef,
      async () => {
        try {
          const goalsData = await getDailyGoals(uid);
          setGoals(goalsData);
        } catch (err) {
          if (__DEV__) console.warn('Nutrition goals listener:', (err && err.message));
        }
      },
      (err) => {
        if (__DEV__) console.warn('nutrition_goals listener error:', (err && err.message));
      },
    );
  }, [uid, needsOnboarding]);

  // Frequent food names for search suggestions.
  useEffect(() => {
    if (!uid) return;
    getTopLoggedFoodNames(uid, TOP_FOOD_NAMES_LIMIT).then(setTopFoodNames).catch(() => {});
  }, [uid]);

  // Love / skip foods for Nutrition settings hub (PNG 21).
  useEffect(() => {
    if (!uid || !db) return undefined;
    const userRef = doc(db, 'users', uid);
    return onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) {
          setFavoriteFoods([]);
          setLeastFavoriteFoods([]);
          return;
        }
        const userData = snap.data() || {};
        setFavoriteFoods(pickFavoriteFoodList(userData));
        setLeastFavoriteFoods(pickLeastFavoriteFoodList(userData));
      },
      (err) => {
        if (__DEV__) console.warn('Nutrition food prefs listener:', (err && err.message));
      },
    );
  }, [uid]);

  /**
   * After nutrition onboarding wizard finishes: save goals, prefs, reload day.
   * Flow: 1. leave onboarding  2. upsert goals  3. prefs  4. reload goals+logs
   */
  const handleOnboardingComplete = async ({ calories, macros, favorites, leastFavorites }) => {
    // 1. Leave the onboarding screen immediately.
    setNeedsOnboarding(false);
    if (!uid) return;

    // 2. Persist calorie + macro targets.
    setLoading(true);
    try {
      await upsertDailyGoals(uid, {
        calories,
        proteinTarget: macros.protein,
        carbsTarget: macros.carbs,
        fatTarget: macros.fat,
        macroSplit: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
      });

      // 3. Mirror love/skip lists into local state when the wizard sent them.
      if (Array.isArray(favorites)) setFavoriteFoods(favorites.filter(Boolean));
      if (Array.isArray(leastFavorites)) setLeastFavoriteFoods(leastFavorites.filter(Boolean));

      // 4. Reload goals + today's logs so the day screen has real data.
      const { goalsData, logsData } = await loadGoalsAndLogsForToday(uid, today);
      setGoals(goalsData);
      setLogs(logsData);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateMacroTotals(logs);
  const mealSplit = splitLogsByMeal(logs);

  const caloriesConsumed = totals.calories || 0;
  let calorieGoal = FALLBACK_CALORIE_GOAL;
  if (goals && goals.calories) {
    calorieGoal = goals.calories;
  }
  const caloriesBurned = 0;

  const macros = buildMacroLanes(totals, goals);
  const meals = buildMealSummaries(mealSplit);

  /** Open food search for a meal row. */
  const handleLog = (mealType) => {
    // 1. Remember which meal the food belongs to.
    setActiveMealType(mealType.toLowerCase());
    // 2. Clear any leftover pill-search text.
    setInitialSearchQuery('');
    // 3. Show the search overlay.
    setShowFoodSearch(true);
  };

  /** Hub pill → search snacks for that food name. */
  const handlePillSearch = (term) => {
    // 1. Pills always land in snacks.
    setActiveMealType('snacks');
    // 2. Prefill the search box.
    setInitialSearchQuery(term);
    // 3. Open search.
    setShowFoodSearch(true);
  };

  /** Open barcode scanner for a meal. */
  const handleScan = (mealType) => {
    // 1. Bind the upcoming scan to this meal.
    setActiveMealType(mealType.toLowerCase());
    // 2. Show the scanner.
    setShowBarcodeScanner(true);
  };

  /** Open quick-add sheet for a meal (defaults to snacks). */
  const handleOpenQuickAdd = (mealType) => {
    // 1. Normalize meal name; fall back to snacks if missing.
    const mealName =
      typeof mealType === 'string' ? mealType.toLowerCase() : 'snacks';
    setActiveMealType(mealName);
    // 2. Show quick-add.
    setShowQuickAdd(true);
  };

  /** Settings screen saved new calorie/macro targets. */
  const handleGoalsUpdated = async (newGoals) => {
    // 1. Need a signed-in user.
    if (!uid) return;
    try {
      // 2. Write goals, then re-read so the day screen matches Firestore.
      await upsertDailyGoals(uid, newGoals);
      const goalsData = await getDailyGoals(uid);
      setGoals(goalsData);
    } catch (err) {
      console.error('Failed to save goals:', err);
    }
  };

  /** Wipe nutrition_goals so the onboarding wizard runs again. */
  const handleResetOnboarding = async () => {
    // 1. Need user + Firestore.
    if (!uid || !db) return;
    try {
      // 2. Delete goals doc and flip back into onboarding.
      await deleteDoc(doc(db, 'nutrition_goals', uid));
      setGoals(null);
      setNeedsOnboarding(true);
    } catch (err) {
      console.error('Failed to reset goals:', err);
    }
  };

  /**
   * Write one food row, refresh today's list, close overlays.
   * Flow: 1. dedupe  2. addFoodLog  3. refresh  4. clear pending after delay
   */
  const handleFoodAdded = async (food, mealType) => {
    if (!uid) return;

    let foodName = 'item';
    if (food && food.food_name) foodName = food.food_name;
    else if (food && food.name) foodName = food.name;
    const mealForKey = (mealType || activeMealType || '').toLowerCase();
    const dedupKey = `${foodName}:${mealForKey}:${today}`;

    // 1. Skip double-tap while the same food+meal is already saving.
    if (pendingLogs.current.has(dedupKey)) {
      console.log('Duplicate log prevented:', dedupKey);
      return;
    }
    pendingLogs.current.add(dedupKey);

    try {
      // 2. Write nutrition_logs row, then refresh the day list.
      await addFoodLog(uid, {
        food,
        mealType: mealType || activeMealType,
        date: today,
      });
      const updatedLogs = await getFoodLogsForDate(uid, today);
      setLogs(updatedLogs);
      setLogError(null);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
    } catch (err) {
      console.error('Add food error:', err);
      setLogError('Failed to log food. Check your connection and try again.');
    } finally {
      // 3. Clear dedupe after a short window; close every add overlay.
      // Manipulate here: DEDUP_CLEAR_MS — raise if slow networks still double-log
      setTimeout(() => pendingLogs.current.delete(dedupKey), DEDUP_CLEAR_MS);
      setShowFoodSearch(false);
      setShowBarcodeScanner(false);
      setShowQuickAdd(false);
    }
  };

  /** Delete one nutrition_logs row and refresh today. */
  const handleRemoveLog = async (logId) => {
    // 1. Need user + row id.
    if (!uid || !logId) return;
    try {
      // 2. Delete, then re-read today's logs.
      await deleteFoodLog(logId);
      const updated = await getFoodLogsForDate(uid, today);
      setLogs(updated);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
    } catch (err) {
      console.error('Remove food log error:', err);
    }
  };

  /** Open edit-serving popup with oz + quantity prefilled from the log row. */
  const handleEditLog = (log) => {
    // 1. Remember which row we are editing.
    setEditingLog(log);

    // 2. Prefill amount in oz (or fl oz when the unit was ml).
    const gramsOrMl = Number(log.serving_grams) || 0;
    const unitIsMilliliters = servingUnitIsMilliliters(log);
    const displayOz = gramsOrMlToDisplayOz(gramsOrMl, unitIsMilliliters);
    setEditAmountValue(displayOz);

    // 3. Prefill quantity (servings).
    const quantity = Number(log.serving_size) || 1;
    setEditQuantityValue(String(Math.round(quantity * 100) / 100));
  };

  /** When quantity changes, keep the oz amount in sync with grams-per-serving. */
  const handleQuantityChange = (val) => {
    // 1. Always update the text field.
    setEditQuantityValue(val);
    if (!editingLog) return;

    // 2. Ignore empty / invalid / non-positive quantity while typing.
    const newQuantity = parseFloat(val);
    if (isNaN(newQuantity) || newQuantity <= 0) return;

    // 3. Scale grams from old qty → new qty, then show oz.
    const oldQuantity = Number(editingLog.serving_size) || 1;
    const oldGrams = Number(editingLog.serving_grams) || 100;
    const gramsPerServing = oldGrams / oldQuantity;
    const newGrams = newQuantity * gramsPerServing;
    setEditAmountValue((newGrams * GRAMS_TO_OZ).toFixed(1));
  };

  /**
   * Save edited serving: oz → grams, scale macros by ratio, refresh day.
   * Flow: 1. parse oz  2. resolve qty  3. clamp ratio  4. updateFoodLog  5. refresh
   */
  const handleSaveEditAmount = async () => {
    // 1. Need a row + a positive oz amount.
    if (!editingLog || !editingLog.id) return;
    const currentGrams = Number(editingLog.serving_grams) || 1;
    const ozEntered = parseOptionalNumber(editAmountValue);
    if (ozEntered == null || Number.isNaN(ozEntered) || ozEntered <= 0) return;

    // 2. Resolve quantity — typed value if valid, else keep the old serving size.
    const typedQuantity = parseOptionalNumber(editQuantityValue);
    const typedQuantityIsValid =
      typedQuantity != null && !Number.isNaN(typedQuantity) && typedQuantity > 0;
    let finalQuantity = Number(editingLog.serving_size) || 1;
    if (typedQuantityIsValid) {
      finalQuantity = typedQuantity;
    }

    // 3. Convert oz → grams and clamp the scale ratio so macros cannot explode.
    const newAmountGrams = Math.round(ozEntered * OZ_TO_GRAMS);
    const rawRatio = newAmountGrams / currentGrams;
    const ratio = Math.min(MAX_EDIT_RATIO, Math.max(MIN_EDIT_RATIO, rawRatio));

    try {
      // 4. Patch the log row macros by the same ratio.
      await updateFoodLog(editingLog.id, {
        serving_grams: newAmountGrams,
        serving_size: roundTenths(finalQuantity),
        calories: roundTenths((Number(editingLog.calories) || 0) * ratio),
        protein: roundTenths((Number(editingLog.protein) || 0) * ratio),
        carbs: roundTenths((Number(editingLog.carbs) || 0) * ratio),
        fat: roundTenths((Number(editingLog.fat) || 0) * ratio),
        fiber: roundTenths((Number(editingLog.fiber) || 0) * ratio),
        sugar: roundTenths((Number(editingLog.sugar) || 0) * ratio),
        sodium: roundTenths((Number(editingLog.sodium) || 0) * ratio),
      });

      // 5. Refresh today's list and close the popup.
      const updated = await getFoodLogsForDate(uid, today);
      setLogs(updated);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
      setEditingLog(null);
    } catch (err) {
      console.error('Update food amount error:', err);
    }
  };

  /** Scanner closed — maybe open quick-add or search with a query. */
  const handleBarcodeClose = (payload) => {
    // 1. Always hide the scanner first.
    setShowBarcodeScanner(false);

    // 2. Route to the overlay the scanner asked for (if any).
    if (!payload) return;
    if (payload.openQuickAdd) {
      setShowQuickAdd(true);
      return;
    }
    if (payload.openFoodSearch) {
      setInitialSearchQuery('');
      setShowFoodSearch(true);
      return;
    }
    if (payload.searchQuery != null) {
      setInitialSearchQuery(payload.searchQuery || '');
      setShowFoodSearch(true);
    }
  };

  const handleCloseFoodSearch = () => {
    setShowFoodSearch(false);
    setInitialSearchQuery('');
  };

  const handleOpenBarcodeFromSearch = () => {
    setShowFoodSearch(false);
    setShowBarcodeScanner(true);
  };

  const handleOpenQuickAddFromSearch = () => {
    setShowFoodSearch(false);
    setShowQuickAdd(true);
  };

  const handleQuickAddLogFood = (entry) => {
    // QuickAddNutrition UI already collects macros in grams.
    const foodCard = foodFromQuickAddEntry(entry);
    let mealForLog = activeMealType;
    if (entry && entry.mealType) mealForLog = entry.mealType;
    handleFoodAdded(foodCard, mealForLog);
  };

  const handleOpenSearchFromDay = () => {
    setInitialSearchQuery('');
    setShowFoodSearch(true);
  };

  // ----- theme + bottom nav (named before any early return) -----
  const colors = isDark ? darkColors : lightColors;
  const screenBg = colors.nbBackground;
  const bottomNavEl = (
    <NutritionShellBottomNav
      hideBottomNav={hideBottomNav}
      onHomePress={onHomePress}
      onPlusPress={onPlusPress}
      onVoicePress={onVoicePress}
      onNutritionPress={onNutritionPress}
      onWorkoutPress={onWorkoutPress}
      onMessagesPress={onMessagesPress}
    />
  );

  // Parent owns the tab bar during onboarding only when it listens for active-change.
  const parentOwnsOnboardingTabBar =
    hideBottomNav && typeof onOnboardingActiveChange !== 'function';
  let onboardingBottomInset = 0;
  if (parentOwnsOnboardingTabBar) {
    onboardingBottomInset = NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE;
  }

  const settingsCurrentGoals = resolveSettingsCurrentGoals(goals);

  const editPopupIsVisible = !!editingLog;
  let editPopupFoodName = '';
  if (editingLog && editingLog.food_name != null) {
    editPopupFoodName = editingLog.food_name;
  }
  const editPopupAmountLabel = amountLabelForEditingLog(editingLog);
  const editPopupQuantityPlaceholder = quantityPlaceholderForEditingLog(editingLog);
  const editPopupAmountPlaceholder = amountPlaceholderForEditingLog(editingLog);

  // ----- early overlays (one job each) -----

  if (loading) {
    return (
      <LoadingNutritionShell
        screenBg={screenBg}
        inkColor={colors.nbInk}
        bottomNav={bottomNavEl}
      />
    );
  }

  if (needsOnboarding) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={{ flex: 1, minHeight: 0 }}>
          <NutritionNewUserSetupScreen
            onComplete={handleOnboardingComplete}
            reservedBottomInset={onboardingBottomInset}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (showFoodSearch) {
    const addFoodBg = colors.nbBackground;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: addFoodBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={flexScrollHost}>
          <FoodSearchScreen
            embedded
            reserveShellBottomNav
            mealType={activeMealType}
            onFoodSelected={handleFoodAdded}
            onClose={handleCloseFoodSearch}
            onOpenBarcode={handleOpenBarcodeFromSearch}
            onOpenQuickAdd={handleOpenQuickAddFromSearch}
            userId={uid}
            initialQuery={initialSearchQuery}
          />
        </View>
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (showBarcodeScanner) {
    return (
      <BarcodeScannerScreen
        mealType={activeMealType}
        onScanSuccess={handleFoodAdded}
        onClose={handleBarcodeClose}
      />
    );
  }

  if (showQuickAdd) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={flexScrollHost}>
          <QuickAddNutrition
            reserveShellBottomNav
            mealType={activeMealType}
            onBack={() => setShowQuickAdd(false)}
            userId={uid}
            onLogFood={handleQuickAddLogFood}
          />
        </View>
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (showNutritionSettings) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={flexScrollHost}>
          <NutritionSettingsScreen
            embedded
            reserveShellBottomNav
            currentGoals={settingsCurrentGoals}
            favoriteFoods={favoriteFoods}
            leastFavoriteFoods={leastFavoriteFoods}
            onGoalsUpdated={handleGoalsUpdated}
            onResetOnboarding={handleResetOnboarding}
            onClose={() => setShowNutritionSettings(false)}
          />
        </View>
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  // Daily totals report — NbPageHeader lives inside NutritionFactsScreen
  if (showDailyFacts) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={flexScrollHost}>
          <NutritionFactsScreen
            logs={logs}
            goals={goals || {}}
            foodCount={logs.length}
            reserveShellBottomNav
            onBack={() => setShowDailyFacts(false)}
          />
        </View>
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  // Design Law daily log paints its own date/Nutrition/settings header — no TopHeader chrome.
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
      <View style={flexScrollHost}>
        <DailyFoodLogScreen
          reserveShellBottomNav
          consumed={caloriesConsumed}
          goal={calorieGoal}
          burned={caloriesBurned}
          macros={macros}
          meals={meals}
          onLog={handleLog}
          onScan={handleScan}
          onManualSave={handleFoodAdded}
          onRemoveLog={handleRemoveLog}
          onEditLog={handleEditLog}
          onSearch={handleOpenSearchFromDay}
          onPillSearch={handlePillSearch}
          onOpenSettings={() => setShowNutritionSettings(true)}
          onOpenDailyFacts={() => setShowDailyFacts(true)}
          onOpenWeeklyMomentum={onOpenWeeklyMomentum}
          viewDate={viewDate}
          onSelectViewDate={setViewDate}
          datesWithLogs={datesWithLogs}
          topFoodNames={topFoodNames}
          onQuickAdd={handleOpenQuickAdd}
        />
      </View>
      <EditServingPopup
        visible={editPopupIsVisible}
        foodName={editPopupFoodName}
        amountLabel={editPopupAmountLabel}
        quantityValue={editQuantityValue}
        amountValue={editAmountValue}
        onQuantityChange={handleQuantityChange}
        onAmountChange={setEditAmountValue}
        quantityPlaceholder={editPopupQuantityPlaceholder}
        amountPlaceholder={editPopupAmountPlaceholder}
        onCancel={() => setEditingLog(null)}
        onSave={handleSaveEditAmount}
        isDark={isDark}
      />
      {bottomNavEl}
    </SafeAreaView>
  );
};

export default DailyLogContent;
