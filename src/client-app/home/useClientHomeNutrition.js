/**
 * use Client Home Nutrition
 *
 * Purpose: React hook: use Client Home Nutrition. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: useClientHomeNutrition
 *
 * @file-header
 */
import { useCallback } from 'react';
import { getLocalDateKey } from '../../shared-utils/getLocalDay';
import { calculateMacroTotals, getFoodLogsForDate } from '../../nutrition/daily-log/logFoodToFirestore';

export function useClientHomeNutrition({ user, db, setCaloriesConsumed, setMacroTotals }) {
  const refetchNutritionData = useCallback(async () => {
    if (!user?.uid || !db) return;
    try {
      const todayKey = getLocalDateKey();
      const nutritionLogs = await getFoodLogsForDate(user.uid, todayKey);
      const totals = calculateMacroTotals(nutritionLogs);
      setCaloriesConsumed(totals.calories || 0);
      setMacroTotals({
        protein: totals.protein || 0,
        carbs: totals.carbs || 0,
        fats: totals.fat || 0, // Fix: nutrition service returns 'fat' not 'fats'
      });
    } catch (e) {
      console.error('Refetch nutrition:', e);
    }
  }, [user?.uid, db, setCaloriesConsumed, setMacroTotals]);

  return refetchNutritionData;
}
