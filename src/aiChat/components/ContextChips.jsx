/**
 * Context Chips
 *
 * Purpose: Context Chips — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: ContextChips
 *
 * @file-header
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AI_COACH_UI } from '../aiCoachUiTokens';

/** Matches dashboard hero pills (DashboardHeroCard / FilesNotesHeroCard). */
export default function ContextChips({ context, isDark = true, loading = false }) {
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)';
  const pillText = isDark ? '#FFFFFF' : '#0A0A0F';
  const textMuted = isDark ? AI_COACH_UI.textSecondary : 'rgba(17,24,39,0.55)';

  if (loading) {
    return (
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: pillBg }]}>
          <Text style={[styles.pillText, { color: textMuted }]}>Syncing your data…</Text>
        </View>
      </View>
    );
  }

  if (!context) return null;

  const chips = [];

  if (context.nutritionDaysLogged > 0) {
    chips.push({ icon: 'restaurant-outline', label: `${context.nutritionDaysLogged} food days`, tint: '#F97316' });
  }
  if (context.workoutsLogged > 0) {
    chips.push({ icon: 'barbell-outline', label: `${context.workoutsLogged} workouts`, tint: '#FF6B9D' });
  }
  if (context.avgSleep && context.avgSleep !== '—') {
    chips.push({ icon: 'moon-outline', label: `${context.avgSleep}h sleep`, tint: '#C084FC' });
  }
  if (context.stepsAvg > 0) {
    chips.push({
      icon: 'footsteps-outline',
      label: `${Math.round(context.stepsAvg).toLocaleString()} steps avg`,
      tint: '#34D399',
    });
  }
  if (context.hasWorkoutPlan) {
    chips.push({ icon: 'calendar-outline', label: 'Program loaded', tint: '#FF6B9D' });
  }
  if (context.avgCals > 0) {
    chips.push({ icon: 'flame-outline', label: `~${context.avgCals} kcal`, tint: '#F97316' });
  }
  if (!chips.length) {
    chips.push({
      icon: 'information-circle-outline',
      label: 'Log meals & dashboard metrics for sharper answers',
      tint: 'rgba(255,255,255,0.45)',
    });
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {chips.map((c) => (
        <View key={c.label} style={[styles.pill, { backgroundColor: pillBg }]}>
          <Ionicons name={c.icon} size={12} color={c.tint} style={styles.pillIcon} />
          <Text style={[styles.pillText, { color: pillText }]} numberOfLines={1}>
            {c.label}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 40,
  },
  row: {
    paddingLeft: 16,
    paddingRight: 32,
    paddingBottom: 8,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillIcon: {
    marginRight: 4,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
    maxWidth: 148,
  },
});
