// Nutrition shell: loads goals and logs, then routes to search / scan / settings overlays.
// Flow: listen to nutrition_logs → decide onboarding vs Today → open child screens for add/edit.
// Mounted from the client home tab (and trainer client nutrition views).

// DailyLogContent — owns nutrition day state and swaps between log / search / barcode / settings screens.
// Flow: listen to nutrition_logs for viewDate → load goals → render DailyFoodLogScreen or a child overlay.
// Used by the client nutrition tab. Persistence helpers live in saveLoggedFood.js.

import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { auth, db } from '../../app-start/cloudConnection';
import { getClientDateKey } from '../../helpers/dateStrings';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients } from '../../look-and-feel/colorPalette';
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
// Manipulate here: how many frequent-food names to preload for search suggestions.
const TOP_FOOD_NAMES_LIMIT = 3;
const DEFAULT_SERVING_GRAMS = 100;
const MACRO_ROUND_TENTHS = 10;
const flexScrollHost = { flex: 1, minHeight: 0 };

// ===== HELPER FUNCTIONS =====

function numberOrZero(value) {
  const parsed = Number(value);
  if (typeof parsed === 'number' && !Number.isNaN(parsed)) return parsed;
  return 0;
}

function roundTenths(value) {
  return Math.round(numberOrZero(value) * MACRO_ROUND_TENTHS) / MACRO_ROUND_TENTHS;
}

// Blank text in an edit field means "not entered" (null), not zero.
// Used by the edit-amount save so untouched fields keep the old serving.
function parseOptionalNumber(text) {
  if (text == null || String(text).trim() === '') return null;
  const parsed = Number(text);
  return Number.isNaN(parsed) ? null : parsed;
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

function sortLogsByCreatedAt(rows) {
  return rows.slice().sort((left, right) => {
    const leftTime = left.created_at?.toDate?.() || new Date(left.created_at || 0);
    const rightTime = right.created_at?.toDate?.() || new Date(right.created_at || 0);
    return leftTime - rightTime;
  });
}

function foodFromQuickAddEntry(entry) {
  return {
    name: entry?.name || 'Food Item',
    calories: numberOrZero(entry?.calories),
    protein: roundTenths(entry?.protein),
    carbs: roundTenths(entry?.carbs),
    fat: roundTenths(entry?.fat),
    fiber: roundTenths(entry?.fiber),
    sugar: roundTenths(entry?.sugar),
    sodium: numberOrZero(entry?.sodium),
    servingGrams: Math.round(numberOrZero(entry?.servingSize)) || DEFAULT_SERVING_GRAMS,
    servingSize: numberOrZero(entry?.quantity) || 1,
    servingUnit: (entry?.servingUnit || 'g').trim() || 'g',
    source: 'manual',
  };
}

// ===== MAIN FUNCTION =====

/**
 * Nutrition day container: live logs, goals, and overlay screens.
 * @param {object} [props]
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
} = {}) => {
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
  // PNG 21 hub pills — from users/{uid} onboarding prefs (nutritionFavoriteFoods / nutritionLeastFavoriteFoods)
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [leastFavoriteFoods, setLeastFavoriteFoods] = useState([]);
  const [viewDate, setViewDate] = useState(getClientDateKey());
  const [datesWithLogs, setDatesWithLogs] = useState([]);
  const pendingLogs = useRef(new Set());
  const { isDark } = useTheme();

  useEffect(() => {
    if (typeof onOnboardingActiveChange !== 'function') return undefined;
    onOnboardingActiveChange(needsOnboarding);
    return () => onOnboardingActiveChange(false);
  }, [needsOnboarding, onOnboardingActiveChange]);

  useEffect(() => {
    if (typeof onSettingsOverlayChange !== 'function') return undefined;
    onSettingsOverlayChange(showNutritionSettings);
    return () => onSettingsOverlayChange(false);
  }, [showNutritionSettings, onSettingsOverlayChange]);

  const today = getClientDateKey();
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid || !db) return undefined;

    const logsRef = collection(db, 'nutrition_logs');
    const logsQuery = query(logsRef, where('user_id', '==', uid), where('date', '==', viewDate));

    const unsub = onSnapshot(
      logsQuery,
      (querySnapshot) => {
        const next = [];
        querySnapshot.forEach((logDoc) => {
          next.push(mapLogDocToRow(logDoc));
        });
        setLogs(sortLogsByCreatedAt(next));
        setLoading(false);
      },
      (err) => {
        console.error('Nutrition logs listener:', err);
      }
    );

    return () => {
      try {
        unsub();
      } catch (_) {
        /* ignore */
      }
    };
  }, [uid, viewDate, db]);

  useEffect(() => {
    if (!uid) return;
    getDatesWithFoodLogs(uid).then(setDatesWithLogs).catch(() => setDatesWithLogs([]));
  }, [uid, logs.length]);

  useEffect(() => {
    if (!uid) return;
    const loadData = async () => {
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
    loadData();
  }, [uid]);

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
          if (__DEV__) console.warn('Nutrition goals listener:', err?.message);
        }
      },
      (err) => {
        if (__DEV__) console.warn('nutrition_goals listener error:', err?.message);
      }
    );
  }, [uid, needsOnboarding]);

  useEffect(() => {
    if (!uid) return;
    getTopLoggedFoodNames(uid, TOP_FOOD_NAMES_LIMIT).then(setTopFoodNames).catch(() => {});
  }, [uid]);

  // Load love/skip foods for Nutrition settings hub (PNG 21)
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
        const data = snap.data() || {};
        const loved = data.nutritionFavoriteFoods || data.favoriteFoods || [];
        const skipped = data.nutritionLeastFavoriteFoods || data.leastFavoriteFoods || [];
        setFavoriteFoods(Array.isArray(loved) ? loved.filter(Boolean) : []);
        setLeastFavoriteFoods(Array.isArray(skipped) ? skipped.filter(Boolean) : []);
      },
      (err) => {
        if (__DEV__) console.warn('Nutrition food prefs listener:', err?.message);
      },
    );
  }, [uid]);

  const handleOnboardingComplete = async ({ calories, macros, favorites, leastFavorites }) => {
    setNeedsOnboarding(false);
    if (!uid) return;
    setLoading(true);
    try {
      await upsertDailyGoals(uid, {
        calories,
        proteinTarget: macros.protein,
        carbsTarget: macros.carbs,
        fatTarget: macros.fat,
        macroSplit: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
      });

      if (Array.isArray(favorites)) setFavoriteFoods(favorites.filter(Boolean));
      if (Array.isArray(leastFavorites)) setLeastFavoriteFoods(leastFavorites.filter(Boolean));

      const [goalsData, logsData] = await Promise.all([
        getDailyGoals(uid),
        getFoodLogsForDate(uid, today),
      ]);
      setGoals(goalsData);
      setLogs(logsData);
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateMacroTotals(logs);
  const mealSplit = splitLogsByMeal(logs);

  const consumed = totals.calories || 0;
  const goal = goals?.calories || FALLBACK_CALORIE_GOAL;
  const burned = 0;

  // Macro lane accents = Design Law accentGradients only (never solid purple/pink hex chrome)
  const macros = [
    {
      label: 'Protein',
      val: Math.round(totals.protein || 0),
      goal: goals?.proteinTarget || DEFAULT_PROTEIN_GOAL,
      color: accentGradients[2],
      pct: goals?.proteinTarget ? Math.round(((totals.protein || 0) / goals.proteinTarget) * 100) : 0,
    },
    {
      label: 'Carbs',
      val: Math.round(totals.carbs || 0),
      goal: goals?.carbsTarget || DEFAULT_CARBS_GOAL,
      color: accentGradients[1],
      pct: goals?.carbsTarget ? Math.round(((totals.carbs || 0) / goals.carbsTarget) * 100) : 0,
    },
    {
      label: 'Fat',
      val: Math.round(totals.fat || 0),
      goal: goals?.fatTarget || DEFAULT_FAT_GOAL,
      color: accentGradients[4],
      pct: goals?.fatTarget ? Math.round(((totals.fat || 0) / goals.fatTarget) * 100) : 0,
    },
  ];

  const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const meals = MEAL_TYPES.map((type) => {
    const foods = mealSplit[type] || [];
    const cals = foods.reduce((s, f) => s + (f.calories || 0), 0);
    return { name: type.charAt(0).toUpperCase() + type.slice(1), cals, foods };
  });

  const handleLog = (mealType) => {
    setActiveMealType(mealType.toLowerCase());
    setInitialSearchQuery('');
    setShowFoodSearch(true);
  };

  const handlePillSearch = (term) => {
    setActiveMealType('snacks');
    setInitialSearchQuery(term);
    setShowFoodSearch(true);
  };

  const handleScan = (mealType) => {
    setActiveMealType(mealType.toLowerCase());
    setShowBarcodeScanner(true);
  };

  const handleOpenQuickAdd = (mealType) => {
    setActiveMealType(typeof mealType === 'string' ? mealType.toLowerCase() : 'snacks');
    setShowQuickAdd(true);
  };

  const handleGoalsUpdated = async (newGoals) => {
    if (!uid) return;
    try {
      await upsertDailyGoals(uid, newGoals);
      const goalsData = await getDailyGoals(uid);
      setGoals(goalsData);
    } catch (err) {
      console.error('Failed to save goals:', err);
    }
  };

  const handleResetOnboarding = async () => {
    if (!uid || !db) return;
    try {
      await deleteDoc(doc(db, 'nutrition_goals', uid));
      setGoals(null);
      setNeedsOnboarding(true);
    } catch (err) {
      console.error('Failed to reset goals:', err);
    }
  };

  const handleFoodAdded = async (food, mealType) => {
    if (!uid) return;

    // Build a dedup key from food name + meal type + date
    const name = food?.food_name || food?.name || 'item';
    const keyMeal = (mealType || activeMealType || '').toLowerCase();
    const dedupKey = `${name}:${keyMeal}:${today}`;

    if (pendingLogs.current.has(dedupKey)) {
      console.log('Duplicate log prevented:', dedupKey);
      return;
    }

    pendingLogs.current.add(dedupKey);

    try {
      await addFoodLog(uid, { food, mealType: mealType || activeMealType, date: today });
      const updated = await getFoodLogsForDate(uid, today);
      setLogs(updated);
      setLogError(null);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
    } catch (err) {
      console.error('Add food error:', err);
      setLogError('Failed to log food. Check your connection and try again.');
    } finally {
      // Remove from pending after short delay to avoid long-term lockout
      setTimeout(() => pendingLogs.current.delete(dedupKey), DEDUP_CLEAR_MS);
      setShowFoodSearch(false);
      setShowBarcodeScanner(false);
      setShowQuickAdd(false);
    }
  };

  const handleRemoveLog = async (logId) => {
    if (!uid || !logId) return;
    try {
      await deleteFoodLog(logId);
      const updated = await getFoodLogsForDate(uid, today);
      setLogs(updated);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
    } catch (err) {
      console.error('Remove food log error:', err);
    }
  };

  const OZ_TO_G = 28.3495;
  const G_TO_OZ = 1 / OZ_TO_G;
  const ML_TO_FL_OZ = 1 / 29.5735;

  const handleEditLog = (log) => {
    setEditingLog(log);
    const gramsOrMl = Number(log.serving_grams) || 0;
    const isMl = (log.metadata?.servingUnit || '').toLowerCase() === 'ml';
    const displayOz = (gramsOrMl * (isMl ? ML_TO_FL_OZ : G_TO_OZ)).toFixed(1);
    setEditAmountValue(displayOz);
    const qty = Number(log.serving_size) || 1;
    setEditQuantityValue(String(Math.round(qty * 100) / 100));
  };

  const handleQuantityChange = (val) => {
    setEditQuantityValue(val);
    if (!editingLog) return;
    const newQty = parseFloat(val);
    if (isNaN(newQty) || newQty <= 0) return;
    const oldQty = Number(editingLog.serving_size) || 1;
    const oldGrams = Number(editingLog.serving_grams) || 100;
    const gramsPerServing = oldGrams / oldQty;
    const newGrams = newQty * gramsPerServing;
    setEditAmountValue((newGrams * G_TO_OZ).toFixed(1));
  };

  const handleSaveEditAmount = async () => {
    if (!editingLog?.id) return;
    const currentGrams = Number(editingLog.serving_grams) || 1;
    const ozEntered = parseOptionalNumber(editAmountValue);
    if (ozEntered == null || Number.isNaN(ozEntered) || ozEntered <= 0) return;
    const newAmount = Math.round(ozEntered * OZ_TO_G);
    const newQty = parseOptionalNumber(editQuantityValue);
    const finalQty = (newQty != null && !Number.isNaN(newQty) && newQty > 0)
      ? newQty
      : (Number(editingLog.serving_size) || 1);
    const ratio = Math.min(10, Math.max(0.01, newAmount / currentGrams));
    try {
      await updateFoodLog(editingLog.id, {
        serving_grams: newAmount,
        serving_size: roundTenths(finalQty),
        calories: roundTenths((Number(editingLog.calories) || 0) * ratio),
        protein: roundTenths((Number(editingLog.protein) || 0) * ratio),
        carbs: roundTenths((Number(editingLog.carbs) || 0) * ratio),
        fat: roundTenths((Number(editingLog.fat) || 0) * ratio),
        fiber: roundTenths((Number(editingLog.fiber) || 0) * ratio),
        sugar: roundTenths((Number(editingLog.sugar) || 0) * ratio),
        sodium: roundTenths((Number(editingLog.sodium) || 0) * ratio),
      });
      const updated = await getFoodLogsForDate(uid, today);
      setLogs(updated);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
      setEditingLog(null);
    } catch (err) {
      console.error('Update food amount error:', err);
    }
  };

  const { lightColors, darkColors } = require('../../look-and-feel/colorPalette');
  const colors = isDark ? darkColors : lightColors;
  const screenBg = colors.nbBackground;
  const bottomNavEl = hideBottomNav ? null : (
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

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator color={colors.nbInk} size="small" />
        </View>

        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (needsOnboarding) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <View style={{ flex: 1, minHeight: 0 }}>
          <NutritionNewUserSetupScreen
            onComplete={handleOnboardingComplete}
            reservedBottomInset={
              hideBottomNav && typeof onOnboardingActiveChange !== 'function'
                ? NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE
                : 0
            }
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
            onClose={() => { setShowFoodSearch(false); setInitialSearchQuery(''); }}
            onOpenBarcode={() => { setShowFoodSearch(false); setShowBarcodeScanner(true); }}
            onOpenQuickAdd={() => { setShowFoodSearch(false); setShowQuickAdd(true); }}
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
        onClose={(payload) => {
          setShowBarcodeScanner(false);
          if (payload?.openQuickAdd) {
            setShowQuickAdd(true);
          } else if (payload?.openFoodSearch) {
            setInitialSearchQuery('');
            setShowFoodSearch(true);
          } else if (payload?.searchQuery != null) {
            setInitialSearchQuery(payload.searchQuery || '');
            setShowFoodSearch(true);
          }
        }}
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
          onLogFood={(entry) => {
            // QuickAddNutrition UI already collects macros in grams.
            handleFoodAdded(foodFromQuickAddEntry(entry), entry?.mealType || activeMealType);
          }}
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
            currentGoals={{
              calories: goals?.calories ?? DEFAULT_CALORIE_GOAL,
              proteinTarget: goals?.proteinTarget ?? 150,
              carbsTarget: goals?.carbsTarget ?? 200,
              fatTarget: goals?.fatTarget ?? 65,
            }}
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
        consumed={consumed}
        goal={goal}
        burned={burned}
        macros={macros}
        meals={meals}
        onLog={handleLog}
        onScan={handleScan}
        onManualSave={handleFoodAdded}
        onRemoveLog={handleRemoveLog}
        onEditLog={handleEditLog}
        onSearch={() => { setInitialSearchQuery(''); setShowFoodSearch(true); }}
        onPillSearch={handlePillSearch}
        onOpenSettings={() => setShowNutritionSettings(true)}
        onOpenDailyFacts={() => setShowDailyFacts(true)}
        viewDate={viewDate}
        onSelectViewDate={setViewDate}
        datesWithLogs={datesWithLogs}
        topFoodNames={topFoodNames}
        onQuickAdd={handleOpenQuickAdd}
      />
      </View>
      <EditServingPopup
        visible={!!editingLog}
        foodName={editingLog?.food_name ?? ''}
        amountLabel={
          (editingLog?.metadata?.servingUnit || '').toLowerCase() === 'ml'
            ? 'Amount (fl oz)'
            : 'Amount (oz)'
        }
        quantityValue={editQuantityValue}
        amountValue={editAmountValue}
        onQuantityChange={handleQuantityChange}
        onAmountChange={setEditAmountValue}
        quantityPlaceholder={
          editingLog
            ? String(Math.round((Number(editingLog.serving_size) || 1) * 100) / 100)
            : ''
        }
        amountPlaceholder={
          editingLog
            ? (
                (Number(editingLog.serving_grams) || 0)
                * ((editingLog.metadata?.servingUnit || '').toLowerCase() === 'ml' ? ML_TO_FL_OZ : G_TO_OZ)
              ).toFixed(1)
            : ''
        }
        onCancel={() => setEditingLog(null)}
        onSave={handleSaveEditAmount}
        isDark={isDark}
      />
      {bottomNavEl}
    </SafeAreaView>
  );
};

export default DailyLogContent;

