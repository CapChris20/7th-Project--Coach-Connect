import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const METRIC_ICONS = {
  energy: 'flash',
  stress: 'pulse',
  steps: 'footsteps',
  soreness: 'water',
  bodyFat: 'body',
  mood: 'happy',
};

export function MetricCard({
  label,
  value,
  unit,
  metricColor,
  metricName,
  size = 'sm',
  hint,
  trend,
}) {
  const isEmpty = value === null || value === undefined || value === '';
  const displayValue = isEmpty ? '—' : value;

  const iconName = METRIC_ICONS[metricName] || 'ellipse';

  return (
    <View
      style={[
        styles.card,
        { borderColor: isEmpty ? 'rgba(255,255,255,0.10)' : `${metricColor}55` },
        size === 'lg' && styles.cardLarge,
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${metricColor}22`,
              opacity: isEmpty ? 0.5 : 1,
            },
          ]}
        >
          <Ionicons name={iconName} size={size === 'lg' ? 24 : 22} color={metricColor} weight="bold" />
        </View>
        <Text style={styles.label}>{label}</Text>
      </View>

      {/* Value + Trend */}
      <View style={styles.valueSection}>
        <View style={styles.valueBlock}>
          <Text
            style={[
              styles.value,
              size === 'lg' ? styles.valueLarge : styles.valueSm,
              { color: isEmpty ? 'rgba(255,255,255,0.5)' : metricColor },
            ]}
          >
            {displayValue}
          </Text>

          {unit && !isEmpty ? (
            size === 'lg' ? (
              <Text style={styles.unitBelow}>{unit}</Text>
            ) : (
              <Text style={styles.unitInline}>{unit}</Text>
            )
          ) : null}
        </View>

        {trend && !isEmpty ? (
          <Text style={[styles.trend, { color: trend === 'up' ? '#10B981' : '#FF6B9D' }]}>
            {trend === 'up' ? '↑' : '↓'}
          </Text>
        ) : null}
      </View>

      {/* Hint */}
      {isEmpty && hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {/* Accent bar */}
      <View style={[styles.accentBar, { backgroundColor: metricColor, opacity: isEmpty ? 0.25 : 1 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    minHeight: 140,
    overflow: 'hidden',
    justifyContent: 'space-between',
  },
  cardLarge: {
    minHeight: 160,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    marginLeft: 12,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.4,
    textAlign: 'right',
  },
  valueSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  valueBlock: {
    justifyContent: 'flex-end',
  },
  value: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  valueSm: {
    fontSize: 38,
    lineHeight: 40,
  },
  valueLarge: {
    fontSize: 56,
    lineHeight: 58,
  },
  unitInline: {
    position: 'absolute',
    right: -28,
    bottom: 6,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  unitBelow: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
  },
  trend: {
    fontSize: 12,
    fontWeight: '800',
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 6,
  },
  accentBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
