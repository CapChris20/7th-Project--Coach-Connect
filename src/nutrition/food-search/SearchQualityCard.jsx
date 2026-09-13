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
 * Always fully expanded on open (no collapse / expand dance).
 */
export default function FoodSearchAccuracyHeroCard({ isDark = true }) {
  const bgGradient = isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT;
  const labelColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,15,0.55)';
  const headlineColor = isDark ? '#FFFFFF' : INK;
  const subheadColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.65)';
  const pillBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.06)';
  const pillText = isDark ? 'rgba(255,255,255,0.92)' : INK;

  return (
    <View
      style={styles.wrapper}
      accessibilityRole="summary"
      accessibilityLabel="Nutrition data accuracy notice"
    >
      <View style={styles.cardShadow}>
        <View style={styles.cardClip}>
          <LinearGradient
            colors={bgGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.inner}
          >
            <View style={styles.headerRow}>
              <View style={styles.headerTextCol}>
                <Text style={[styles.label, { color: labelColor }]}>Nutrition data</Text>
                <Text style={[styles.headline, { color: headlineColor }]}>
                  Verify before you log
                </Text>
              </View>
            </View>

            <Text style={[styles.subhead, { color: subheadColor }]}>
              Numbers come from trusted food databases and restaurant menus. Labels change often,
              so double-check serving sizes or edit entries after logging.
            </Text>

            <View style={styles.pillsRow}>
              {FEATURES.map(({ icon, label }) => (
                <View key={label} style={[styles.pill, { backgroundColor: pillBg }]}>
                  <Ionicons name={icon} size={13} color={CYAN} style={styles.pillIcon} />
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
    marginBottom: 14,
  },
  cardShadow: {
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.22,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 5 },
    }),
  },
  cardClip: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  inner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subhead: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  pillsRow: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  pillIcon: {
    marginRight: 5,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
