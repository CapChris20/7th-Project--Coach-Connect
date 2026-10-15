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
import TopHeader from '../../for-both/loading-and-header/TopHeader';
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
import NutritionFactsScreen from '../food-details/NutritionFactsScreen';
import QuickAddNutrition from '../quick-add/QuickAddNutrition';
import FoodSearchScreen from '../food-search/FoodSearchScreen';
import BarcodeScannerScreen from '../barcode/BarcodeScannerScreen';
import NutritionSettingsScreen from '../targets/NutritionSettingsScreen';
import EditServingPopup from '../food-details/EditServingPopup';


// ===== NAMED CONSTANTS =====

const DEDUP_CLEAR_MS = 3000;
const DEFAULT_CALORIE_GOAL = 2000;
const FALLBACK_CALORIE_GOAL = 2200;
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
  const [recordError, setLogError] = useState(null);
  const [topFoodNames, setTopFoodNames] = useState([]);
  const [viewDate, setViewDate] = useState(getClientDateKey());
  const [datesWithLogs, setDatesWithLogs] = useState([]);
  const [showDailyFacts, setShowDailyFacts] = useState(false);
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

  const handleOnboardingComplete = async ({ calories, macros }) => {
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

  const macros = [
    {
      label: 'Protein',
      val: Math.round(totals.protein || 0),
      goal: goals?.proteinTarget || DEFAULT_PROTEIN_GOAL,
      color: '#FF6B9D',
      pct: goals?.proteinTarget ? Math.round(((totals.protein || 0) / goals.proteinTarget) * 100) : 0,
    },
    {
      label: 'Carbs',
      val: Math.round(totals.carbs || 0),
      goal: goals?.carbsTarget || DEFAULT_CARBS_GOAL,
      color: '#F97316',
      pct: goals?.carbsTarget ? Math.round(((totals.carbs || 0) / goals.carbsTarget) * 100) : 0,
    },
    {
      label: 'Fat',
      val: Math.round(totals.fat || 0),
      goal: goals?.fatTarget || DEFAULT_FAT_GOAL,
      color: '#06B6D4',
      pct: goals?.fatTarget ? Math.round(((totals.fat || 0) / goals.fatTarget) * 100) : 0,
    },
  ];

  const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
  const meals = MEAL_TYPES.map((type) => {
    const foods = mealSplit[type] || [];
    const cals = foods.reduce((s, f) => s + (f.calories || 0), 0);
    return { name: type.charAt(0).toUpperCase() + type.slice(1), cals, foods };
  });

  const weekData = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => ({
    day: d,
    cals: 0,
  }));

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
        serving_size: roundMacro(finalQty),
        calories: roundMacro((Number(editingLog.calories) || 0) * ratio),
        protein: roundMacro((Number(editingLog.protein) || 0) * ratio),
        carbs: roundMacro((Number(editingLog.carbs) || 0) * ratio),
        fat: roundMacro((Number(editingLog.fat) || 0) * ratio),
        fiber: roundMacro((Number(editingLog.fiber) || 0) * ratio),
        sugar: roundMacro((Number(editingLog.sugar) || 0) * ratio),
        sodium: roundMacro((Number(editingLog.sodium) || 0) * ratio),
      });
      const updated = await getFoodLogsForDate(uid, today);
      setLogs(updated);
      if (typeof onNutritionDataChanged === 'function') onNutritionDataChanged();
      setEditingLog(null);
    } catch (err) {
      console.error('Update food amount error:', err);
    }
  };

  const screenBg = isDark ? '#0A0A0F' : '#F2F2F7';
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
          <ActivityIndicator color="#FF6B9D" size="small" />
        </View>

        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (needsOnboarding) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <TopHeader
          title="Nutrition"
          skipTopSafeInset={true}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
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
    const addFoodBg = isDark ? '#0A0A0F' : '#FFFFFF';
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: addFoodBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <TopHeader
          title="Add Food"
          isDark={isDark}
          skipTopSafeInset
          onBack={() => setShowFoodSearch(false)}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
        <View style={flexScrollHost}>
          <FoodSearchScreen
            embedded
            reserveShellBottomNav
            mealType={activeMealType}
            onFoodSelected={handleFoodAdded}
            onClose={() => { setShowFoodSearch(false); setInitialSearchQuery(''); }}
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
          if (payload?.openFoodSearch) {
            setInitialSearchQuery('');
            setShowFoodSearch(true);
          } else if (payload?.searchQuery) {
            setInitialSearchQuery(payload.searchQuery);
            setShowFoodSearch(true);
          }
        }}
      />
    );
  }

  if (showQuickAdd) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <TopHeader
          title="Quick Add"
          isDark={isDark}
          skipTopSafeInset={true}
          onBack={() => setShowQuickAdd(false)}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
        <View style={flexScrollHost}>
        <QuickAddNutrition
          reserveShellBottomNav
          userId={uid}
          onLogFood={(entry) => {
            // QuickAddNutrition UI already collects macros in grams.
            handleFoodAdded(foodFromQuickAddEntry(entry), activeMealType);
          }}
        />
        </View>
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (showDailyFacts) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <TopHeader
          title="Daily Nutrition"
          isDark={isDark}
          skipTopSafeInset
          onBack={() => setShowDailyFacts(false)}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
        <NutritionFactsScreen
          logs={logs}
          goals={goals}
          foodCount={logs.length}
          reserveShellBottomNav
        />
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (showNutritionSettings) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
        <TopHeader
          title="Goals"
          skipTopSafeInset
          onBack={() => setShowNutritionSettings(false)}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
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
            onGoalsUpdated={handleGoalsUpdated}
            onResetOnboarding={handleResetOnboarding}
            onClose={() => setShowNutritionSettings(false)}
          />
        </View>
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
      <TopHeader
        title="Nutrition"
        isDark={isDark}
        skipTopSafeInset={true}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
      <View style={flexScrollHost}>
      <DailyFoodLogScreen
        reserveShellBottomNav
        consumed={consumed}
        goal={goal}
        burned={burned}
        macros={macros}
        meals={meals}
        weekData={weekData}
        onLog={handleLog}
        onScan={handleScan}
        onManualSave={handleFoodAdded}
        onRemoveLog={handleRemoveLog}
        onEditLog={handleEditLog}
        onSearch={() => { setInitialSearchQuery(''); setShowFoodSearch(true); }}
        onPillSearch={handlePillSearch}
        onOpenSettings={() => setShowNutritionSettings(true)}
        viewDate={viewDate}
        onSelectViewDate={setViewDate}
        datesWithLogs={datesWithLogs}
        onOpenDailyFacts={() => setShowDailyFacts(true)}
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

