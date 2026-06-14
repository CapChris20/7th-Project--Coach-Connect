import { useCallback } from 'react';
import { getLocalDateKey } from '../../shared/utils/localDay';
import { calculateMacroTotals, getFoodLogsForDate } from '../../nutrition/services/nutritionService';

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
