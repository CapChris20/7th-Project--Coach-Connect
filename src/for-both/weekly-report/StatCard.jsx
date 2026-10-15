// One metric tile on the weekly report (sleep, water, steps, food log, workout, energy, mood).
// Flow: map the icon to a metric → paint glass + gradient → value + optional vs-last-week trend.
// Used by the weekly report stats grid for both trainer and client.

import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../weekly-report/reportColorSettings';
import { TREND_NEGATIVE, TREND_POSITIVE } from '../weekly-report/reportColors';
import { StatIcon } from './StatIcon';

// ===== NAMED CONSTANTS =====

const EMPTY_VALUE_PLACEHOLDER = '—';
const DEFAULT_METRIC_KEY = 'energy';
const DARK_MODE = 'dark';
const DARK_CARD_FILL = 'rgba(20,20,30,0.55)';
const LIGHT_CARD_FILL = 'rgba(255,255,255,0.7)';
const GRADIENT_START_ALPHA = '26';
const GRADIENT_MID_ALPHA = '12';
const BLUR_INTENSITY = 30;
const STAT_ICON_SIZE = 34;
const STAT_IMAGE_SIZE = 18;
const TREND_UP = '↑';
const TREND_DOWN = '↓';
const TREND_VS_LABEL = 'vs last';

const ICON_TO_METRIC = {
  moon: 'sleep',
  water: 'water',
  footsteps: 'steps',
  restaurant: 'nutrition',
  barbell: 'workout',
  flash: 'energy',
  time: 'workout',
  'trending-up': 'mood',
};

// ===== HELPER FUNCTIONS =====

function hasStatValue(value) {
  return value !== EMPTY_VALUE_PLACEHOLDER && value != null && value !== '';
}

function isTrendPositive(trend) {
  // vocab/symbol: ?? = use 0 only when trend is null/undefined, so a real 0 still counts as positive.
  return (trend ?? 0) >= 0;
}

function cardFill(mode) {
  return mode === DARK_MODE ? DARK_CARD_FILL : LIGHT_CARD_FILL;
}

function gradientColors(gradient) {
  return [`${gradient[0]}${GRADIENT_START_ALPHA}`, `${gradient[1]}${GRADIENT_MID_ALPHA}`, 'transparent'];
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ label: string, value: string|number, suffix?: string, trend?: number, icon: string, gradient: string[], testID?: string, showTrend?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export function StatCard({ label, value, suffix, trend, icon, gradient, testID, showTrend = true }) {
  const { colors, mode } = useTheme();
  const hasValue = hasStatValue(value);
  const isPositive = isTrendPositive(trend);
  const trendColor = isPositive ? TREND_POSITIVE : TREND_NEGATIVE;
  const metricKey = ICON_TO_METRIC[icon] || DEFAULT_METRIC_KEY;

  return (
    <Pressable testID={testID} style={styles.wrapper}>
      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: cardFill(mode),
          },
        ]}
      >
        <BlurView intensity={BLUR_INTENSITY} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={gradientColors(gradient)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <StatIcon metricKey={metricKey} size={STAT_ICON_SIZE} imageSize={STAT_IMAGE_SIZE} />

        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>

        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1}>
            {value}
          </Text>
          {suffix ? (
            <Text style={[styles.suffix, { color: colors.textSecondary }]}>{suffix}</Text>
          ) : null}
        </View>

        {showTrend && hasValue ? (
          <View style={styles.trendRow}>
            <Text style={[styles.trendArrow, { color: trendColor }]}>{isPositive ? TREND_UP : TREND_DOWN}</Text>
            <Text style={[styles.trendText, { color: trendColor }]}>{Math.abs(trend ?? 0)}%</Text>
            <Text style={[styles.trendLabel, { color: colors.textMuted }]}>{TREND_VS_LABEL}</Text>
          </View>
        ) : (
          <View style={styles.trendRow} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '47.5%',
  },
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    minHeight: 130,
    overflow: 'hidden',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  value: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1,
  },
  suffix: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  trendArrow: {
    fontSize: 12,
    fontWeight: '800',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '700',
  },
  trendLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 2,
  },
});
