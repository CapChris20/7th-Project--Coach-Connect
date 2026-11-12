// Design Law metric tile — big number + caps label, HardShadow, no gradient wash.
// Flow: value (+ optional /max or unit) → all-caps label. Trends omitted (PNG has none).
// Used by: WeeklyReportBody stats grid (client + trainer).

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const EMPTY_VALUE_PLACEHOLDER = '—';

// ===== HELPER FUNCTIONS =====

function hasStatValue(value) {
  return value !== EMPTY_VALUE_PLACEHOLDER && value != null && value !== '';
}

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   label: string,
 *   value: string|number,
 *   suffix?: string,
 *   max?: string|number,
 *   testID?: string,
 * }} props
 */
export function StatCard({ label, value, suffix, max, testID }) {
  const { colors } = useTheme();
  const showValue = hasStatValue(value);

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbCard} style={styles.wrapper}>
      <View
        testID={testID}
        style={[
          styles.card,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfacePrimary,
          },
        ]}
      >
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: colors.textPrimary }]} numberOfLines={1}>
            {showValue ? value : EMPTY_VALUE_PLACEHOLDER}
          </Text>
          {suffix && showValue ? (
            <Text style={[styles.suffix, { color: colors.textMuted }]}>{suffix}</Text>
          ) : null}
          {max != null && showValue ? (
            <Text style={[styles.max, { color: colors.textMuted }]}>{` / ${max}`}</Text>
          ) : null}
        </View>
        <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
          {String(label || '').toUpperCase()}
        </Text>
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '47.5%',
  },
  card: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 72,
    justifyContent: 'center',
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: 2,
  },
  value: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  max: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
});
