/**
 * Macro Tracker Screen
 *
 * Purpose: UI screen or component: Macro Tracker Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: MacroTrackerScreen
 *
 * @file-header
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth } from '../../app/config';
import {
  getDailyGoals,
  getFoodLogsForDate,
  calculateMacroTotals,
} from '../daily-log/logFoodToFirestore';
import MacroBar from '../daily-log/MacroBar';
import Loader from '../../shared/components/shell/AppLoadingScreen';
import { autoLogErrorSync } from '../../utils/autoLogError';

const macroColors = {
  protein: '#F97316', // Use your orange
  carbs: '#06B6D4', // Use your cyan
  fat: '#FF6B9D', // Use your hot pink
};

export default function MacroTrackerScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [goals, setGoals] = useState(null);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const user = auth.currentUser;
  const styles = createStyles(spacing, colors, isDark);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [goalData, logs] = await Promise.all([
        getDailyGoals(user.uid),
        getFoodLogsForDate(user.uid, selectedDate),
      ]);
      setGoals(goalData);
      setTotals(calculateMacroTotals(logs));
    } catch (error) {
      console.error('Failed to load macro tracker', error);
      autoLogErrorSync(error, 'MacroTrackerScreen - loadData');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const changeDay = (direction) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + direction);
      return next;
    });
  };

  const formatDate = (date) =>
    date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  if (loading || !goals || !totals) {
    return (
      <View style={styles.loader}>
        <Loader />
      </View>
    );
  }

  const remainingCalories = Math.max(goals.calories - totals.calories, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={styles.header}>
        <Text style={styles.title} selectable={true}>Macro Tracker</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText} selectable={true}>Close</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.dateRow}>
        <TouchableOpacity onPress={() => changeDay(-1)}>
          <Text style={styles.dateButton} selectable={true}>◀</Text>
        </TouchableOpacity>
        <Text style={styles.dateText} selectable={true}>{formatDate(selectedDate)}</Text>
        <TouchableOpacity onPress={() => changeDay(1)}>
          <Text style={styles.dateButton} selectable={true}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle} selectable={true}>Calories</Text>
        <Text style={styles.summaryValue} selectable={true}>
          {Math.round(totals.calories || 0)} / {goals.calories} kcal
        </Text>
        <Text style={styles.summarySub} selectable={true}>Remaining: {Math.round(remainingCalories)} kcal</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} selectable={true}>Macro Progress</Text>
        <MacroBar
          label="Protein"
          current={totals.protein}
          target={goals.proteinTarget}
          color={macroColors.protein}
        />
        <MacroBar
          label="Carbs"
          current={totals.carbs}
          target={goals.carbsTarget}
          color={macroColors.carbs}
        />
        <MacroBar
          label="Fat"
          current={totals.fat}
          target={goals.fatTarget}
          color={macroColors.fat}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} selectable={true}>Micronutrients</Text>
        <View style={styles.micronutrientRow}>
          <View style={styles.micro}>
            <Text style={styles.microLabel} selectable={true}>Fiber</Text>
            <Text style={styles.microValue} selectable={true}>{Math.round(totals.fiber || 0)} g</Text>
          </View>
          <View style={styles.micro}>
            <Text style={styles.microLabel} selectable={true}>Sugar</Text>
            <Text style={styles.microValue} selectable={true}>{Math.round(totals.sugar || 0)} g</Text>
          </View>
          <View style={styles.micro}>
            <Text style={styles.microLabel} selectable={true}>Sodium</Text>
            <Text style={styles.microValue} selectable={true}>{Math.round(totals.sodium || 0)} mg</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    dateRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.lg,
    },
    dateText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    dateButton: {
      fontSize: 18,
      color: colors.text,
    },
    summaryCard: {
      backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF',
      borderRadius: 24,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border || 'rgba(255,255,255,0.1)',
    },
    summaryTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    summaryValue: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text,
    },
    summarySub: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    card: {
      backgroundColor: isDark ? 'rgba(30,27,46,0.7)' : '#FFFFFF',
      borderRadius: 24,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: colors.border || 'rgba(255,255,255,0.1)',
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
    },
    micronutrientRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    micro: {
      flex: 1,
      alignItems: 'center',
    },
    microLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    microValue: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
  });
