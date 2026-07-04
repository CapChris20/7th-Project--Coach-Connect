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
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable } from 'react-native';
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
  const [expanded, setExpanded] = useState(false);
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
            <Pressable
              onPress={() => setExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Collapse accuracy info' : 'Expand accuracy info'}
            >
              <View style={styles.headerRow}>
                <View style={styles.headerTextCol}>
                  <Text style={[styles.label, { color: labelColor }]}>Nutrition data</Text>
                  <Text style={[styles.headline, { color: headlineColor }]}>
                    Verify before you log
                  </Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={CYAN} />
              </View>
            </Pressable>

            {expanded ? (
              <Text style={[styles.subhead, { color: subheadColor }]}>
                Numbers come from trusted food databases and restaurant menus. Labels change often,
                so double-check serving sizes or edit entries after logging.
              </Text>
            ) : null}

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
    marginTop: 8,
    marginBottom: 12,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  headline: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  subhead: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  pill: {
    flexGrow: 1,
    flexBasis: '22%',
    minWidth: 74,
    minHeight: 34,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pillIcon: {
    marginTop: 0,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
