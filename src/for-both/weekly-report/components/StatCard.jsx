import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/WeeklyReportThemeContext';
import { TREND_NEGATIVE, TREND_POSITIVE } from '../theme/tokens';
import { ReportMetricIcon } from './ReportMetricIcon';

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

export function StatCard({ label, value, suffix, trend, icon, gradient, testID, showTrend = true }) {
  const { colors, mode } = useTheme();
  const hasValue = value !== '—' && value != null && value !== '';
  const positive = (trend ?? 0) >= 0;
  const trendColor = positive ? TREND_POSITIVE : TREND_NEGATIVE;
  const metricKey = ICON_TO_METRIC[icon] || 'energy';

  return (
    <Pressable testID={testID} style={styles.wrapper}>
      <View
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: mode === 'dark' ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.7)',
          },
        ]}
      >
        <BlurView intensity={30} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[`${gradient[0]}26`, `${gradient[1]}12`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ReportMetricIcon metricKey={metricKey} size={34} imageSize={18} />

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
            <Text style={[styles.trendArrow, { color: trendColor }]}>{positive ? '↑' : '↓'}</Text>
            <Text style={[styles.trendText, { color: trendColor }]}>{Math.abs(trend ?? 0)}%</Text>
            <Text style={[styles.trendLabel, { color: colors.textMuted }]}>vs last</Text>
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
