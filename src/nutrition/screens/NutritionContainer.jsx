/**
 * Nutrition Container
 *
 * Purpose: UI screen or component: Nutrition Container. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: NutritionContainer
 *
 * @file-header
 */
import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { auth, db } from '../../app/config';
import { getClientDateKey } from '../../shared/utils/dateKeys';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { useTheme } from '../../shared/ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { SafeAreaView } from 'react-native-safe-area-context';
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
} from '../daily-log/logFoodToFirestore';
import NutritionOnboardingScreen from './NutritionOnboardingScreen';
import NutritionScreen from './NutritionScreen';
import NutritionFactsScreen from './NutritionFactsScreen';
import QuickAddNutrition from './QuickAddNutrition';
import FoodSearchScreen from './FoodSearchScreen';
import BarcodeScannerScreen from './BarcodeScannerScreen';
import NutritionSettingsScreen from './NutritionSettingsScreen';
import EditServingModal from '../components/EditServingModal';

import { useRef } from 'react';

export const NutritionContainer = ({
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
  /** Parent tab bar overlays content (e.g. ClientMainScreen absolute BottomNavBar). */
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
  const [logError, setLogError] = useState(null);
  const [topFoodNames, setTopFoodNames] = useState([]);
  const [viewDate, setViewDate] = useState(getClientDateKey());
  const [datesWithLogs, setDatesWithLogs] = useState([]);
  const [showDailyFacts, setShowDailyFacts] = useState(false);
  const [factsLog, setFactsLog] = useState(null);
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
    const q = query(logsRef, where('user_id', '==', uid), where('date', '==', viewDate));

    const unsub = onSnapshot(
      q,
      (querySnapshot) => {
        const next = [];
        querySnapshot.forEach((logDoc) => {
          const data = logDoc.data();
          next.push({
            id: logDoc.id,
            ...data,
            calories: Number(data.calories) || 0,
            protein: Number(data.protein) || 0,
            carbs: Number(data.carbs) || 0,
            fat: Number(data.fat) || 0,
          });
        });
        next.sort((a, b) => {
          const aTime = a.created_at?.toDate?.() || new Date(a.created_at || 0);
          const bTime = b.created_at?.toDate?.() || new Date(b.created_at || 0);
          return aTime - bTime;
        });
        setLogs(next);
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
        console.error('NutritionContainer load error:', err);
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
    getTopLoggedFoodNames(uid, 3).then(setTopFoodNames).catch(() => {});
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
  const goal = goals?.calories || 2200;
  const burned = 0;

  const macros = [
    {
      label: 'Protein',
      val: Math.round(totals.protein || 0),
      goal: goals?.proteinTarget || 150,
      color: '#FF6B9D',
      pct: goals?.proteinTarget ? Math.round(((totals.protein || 0) / goals.proteinTarget) * 100) : 0,
    },
    {
      label: 'Carbs',
      val: Math.round(totals.carbs || 0),
      goal: goals?.carbsTarget || 250,
      color: '#F97316',
      pct: goals?.carbsTarget ? Math.round(((totals.carbs || 0) / goals.carbsTarget) * 100) : 0,
    },
    {
      label: 'Fat',
      val: Math.round(totals.fat || 0),
      goal: goals?.fatTarget || 70,
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
      setTimeout(() => pendingLogs.current.delete(dedupKey), 3000);
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
    const num = (v) => (v === '' || v == null) ? null : Number(String(v).replace(',', '.'));
    const currentGrams = Number(editingLog.serving_grams) || 1;
    const ozEntered = num(editAmountValue);
    if (ozEntered == null || Number.isNaN(ozEntered) || ozEntered <= 0) return;
    const newAmount = Math.round(ozEntered * OZ_TO_G);
    const newQty = num(editQuantityValue);
    const finalQty = (newQty != null && !Number.isNaN(newQty) && newQty > 0)
      ? newQty
      : (Number(editingLog.serving_size) || 1);
    const ratio = Math.min(10, Math.max(0.01, newAmount / currentGrams));
    const numRound = (n) => Math.round(Number(n) * 100) / 100;
    try {
      await updateFoodLog(editingLog.id, {
        serving_grams: newAmount,
        serving_size: numRound(finalQty),
        calories: numRound((Number(editingLog.calories) || 0) * ratio),
        protein: numRound((Number(editingLog.protein) || 0) * ratio),
        carbs: numRound((Number(editingLog.carbs) || 0) * ratio),
        fat: numRound((Number(editingLog.fat) || 0) * ratio),
        fiber: numRound((Number(editingLog.fiber) || 0) * ratio),
        sugar: numRound((Number(editingLog.sugar) || 0) * ratio),
        sodium: numRound((Number(editingLog.sodium) || 0) * ratio),
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
    <BottomNavBar
      onHomePress={onHomePress}
      onPlusPress={onPlusPress}
      onVoicePress={onVoicePress}
      onNutritionPress={onNutritionPress}
      onWorkoutPress={onWorkoutPress}
      onMessagesPress={onMessagesPress}
      activeTabKey="nutrition"
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
        <CoachConnectHeader
          title="Nutrition"
          skipTopSafeInset={true}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
        <View style={{ flex: 1, minHeight: 0 }}>
          <NutritionOnboardingScreen
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
      <SafeAreaView style={{ flex: 1, backgroundColor: addFoodBg }}>
        <CoachConnectHeader
          title="Add Food"
          isDark={isDark}
          skipTopSafeInset
          onBack={() => setShowFoodSearch(false)}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
        <View style={{ flex: 1, minHeight: 0 }}>
          <FoodSearchScreen
            embedded
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
        onClose={() => setShowBarcodeScanner(false)}
      />
    );
  }

  if (showQuickAdd) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
        <CoachConnectHeader
          title="Quick Add"
          isDark={isDark}
          skipTopSafeInset={true}
          onBack={() => setShowQuickAdd(false)}
        />
        <QuickAddNutrition
          onLogFood={(entry) => {
            const num = (v) => {
              const n = Number(v);
              return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
            };

            // QuickAddNutrition UI already collects macros in grams.
            const food = {
              name: entry?.name || 'Food Item',
              calories: num(entry?.calories),
              protein: Math.round(num(entry?.protein) * 10) / 10,
              carbs: Math.round(num(entry?.carbs) * 10) / 10,
              fat: Math.round(num(entry?.fat) * 10) / 10,
              fiber: Math.round(num(entry?.fiber) * 10) / 10,
              sugar: Math.round(num(entry?.sugar) * 10) / 10,
              sodium: num(entry?.sodium), // mg
              servingGrams: Math.round(num(entry?.servingSize)) || 100,
              servingSize: num(entry?.quantity) || 1,
              servingUnit: (entry?.servingUnit || 'g').trim() || 'g',
              source: 'manual',
            };

            handleFoodAdded(food, activeMealType);
          }}
        />
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (showDailyFacts || factsLog) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
        <CoachConnectHeader
          title={factsLog ? 'Nutrition Facts' : 'Daily Nutrition'}
          isDark={isDark}
          skipTopSafeInset
          onBack={() => {
            setShowDailyFacts(false);
            setFactsLog(null);
          }}
        />
        <NutritionFactsScreen
          log={factsLog}
          logs={factsLog ? undefined : logs}
          goals={goals}
          foodCount={logs.length}
          reserveShellBottomNav={hideBottomNav}
        />
        {bottomNavEl}
      </SafeAreaView>
    );
  }

  if (showNutritionSettings) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
        <CoachConnectHeader
          title="Goals"
          skipTopSafeInset
          onBack={() => setShowNutritionSettings(false)}
        />
        <View style={{ flex: 1, minHeight: 0 }}>
          <NutritionSettingsScreen
            embedded
            currentGoals={{
              calories: goals?.calories ?? 2000,
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
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
      <CoachConnectHeader
        title="Nutrition"
        isDark={isDark}
        skipTopSafeInset={true}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
      <NutritionScreen
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
        onOpenFoodFacts={(log) => setFactsLog(log)}
        topFoodNames={topFoodNames}
        onQuickAdd={handleOpenQuickAdd}
      />
      <EditServingModal
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

export default NutritionContainer;

