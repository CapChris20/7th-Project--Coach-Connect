/**
 * Food Search Accuracy Hero Card
 *
 * Purpose: UI screen or component: Food Search Accuracy Hero Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: FoodSearchAccuracyHeroCard
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const BG_GRADIENT_DARK = ['#1a0a2e', '#0f0a1a'];
const BG_GRADIENT_LIGHT = ['#F8FAFF', '#FFFFFF'];
const TOP_BORDER_GRADIENT = ['#BE185D', '#C2410C'];
const CYAN = '#64D2FF';
const INK = '#0A0A0F';

const FEATURES = [
  { icon: 'flame-outline', label: 'Calories' },
  { icon: 'barbell-outline', label: 'Protein' },
  { icon: 'pie-chart-outline', label: 'Macros' },
  { icon: 'restaurant-outline', label: 'Menus' },
];

/**
 * Hero disclaimer for food search — matches DashboardHeroCard / marketplace heroes.
 */
export default function FoodSearchAccuracyHeroCard({ isDark = true }) {
  const bgGradient = isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT;
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.55)';
  const headlineColor = isDark ? '#FFFFFF' : INK;
  const subheadColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.6)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)';
  const pillText = isDark ? '#FFFFFF' : INK;

  return (
    <View
      style={styles.wrapper}
      accessibilityRole="summary"
      accessibilityLabel="Nutrition data accuracy notice"
    >
      <View style={styles.cardShadow}>
        <View style={styles.cardClip}>
          <LinearGradient
            colors={TOP_BORDER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topBorder}
          />
          <LinearGradient
            colors={bgGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.inner}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.label, { color: labelColor }]}>Nutrition data</Text>
              <Ionicons name="shield-checkmark-outline" size={22} color={CYAN} />
            </View>

            <Text style={[styles.headline, { color: headlineColor }]}>
              We aim for accuracy — please verify
            </Text>

            <Text style={[styles.subhead, { color: subheadColor }]}>
              Coach Connect pulls calories, protein, carbs, and fat from trusted databases and
              restaurant sources. Menus and labels change often, so numbers can be off. If
              something looks wrong, double-check the serving size or edit the entry after you
              log it.
            </Text>

            <View style={styles.pillsRow}>
              {FEATURES.map(({ icon, label }) => (
                <View key={label} style={[styles.pill, { backgroundColor: pillBg }]}>
                  <Ionicons name={icon} size={12} color={CYAN} style={styles.pillIcon} />
                  <Text style={[styles.pillText, { color: pillText }]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 12,
    marginBottom: 4,
  },
  cardShadow: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#BE185D',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.28,
        shadowRadius: 14,
      },
      android: { elevation: 8 },
    }),
  },
  cardClip: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  topBorder: {
    height: 3,
    width: '100%',
  },
  inner: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 8,
  },
  headline: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 24,
  },
  subhead: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  pill: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 72,
    height: 36,
    borderRadius: 10,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillIcon: {
    marginTop: 0,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
  },
});
