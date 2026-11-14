// One metric tile on the weekly report — big number + caps label, HardShadow, no wash.
// Flow: decide if value exists → number + optional suffix + /max → all-caps label.
// Used by WeeklyReportBody stats grids (client + trainer).

import React from 'react';
import { Text, StyleSheet, View } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

// Manipulate here: placeholder shown when the week has no value for this metric
const EMPTY_VALUE_PLACEHOLDER = '—';

// ===== MAIN FUNCTION =====

/**
 * Hard-shadow metric card for one weekly average.
 * Flow: 1. theme  2. value present?  3. uppercase label  4. card chrome
 * @param {{
 *   label: string,
 *   value: string|number,
 *   suffix?: string,
 *   max?: string|number,
 *   testID?: string,
 * }} props
 */
export function StatCard({ label, value, suffix, max, testID }) {
  // vocab: useTheme = report palette (textPrimary / textMuted / border / surface)
  const { colors } = useTheme();

  // 1. Treat em-dash, null, and empty string as “no stat yet” for this week.
  const showRealValue = statHasDisplayableValue(value);

  // 2. Label is always uppercased to match Design Law stat tiles.
  const labelText = String(label || '').toUpperCase();

  // 3. Name surface + label colors so JSX stays flat.
  const cardSurfaceStyle = [
    styles.card,
    {
      borderColor: colors.border,
      backgroundColor: colors.surfacePrimary,
    },
  ];
  const labelStyle = [styles.label, { color: colors.textMuted }];

  // 4. HardShadow wrapper + outlined card body.
  // vocab: HardShadow = Design Law hard offset shadow (not soft blur)
  return (
    <HardShadow
      offset={nb.shadowOffsetSmall}
      radius={borderRadius.nbCard}
      style={styles.wrapper}
    >
      <View testID={testID} style={cardSurfaceStyle}>
        <StatValueRow
          value={value}
          suffix={suffix}
          max={max}
          colors={colors}
          showRealValue={showRealValue}
        />
        <Text style={labelStyle} numberOfLines={2}>
          {labelText}
        </Text>
      </View>
    </HardShadow>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * Big number row: value, optional unit suffix, optional “ / max”.
 */
function StatValueRow({ value, suffix, max, colors, showRealValue }) {
  let mainNumber = EMPTY_VALUE_PLACEHOLDER;
  if (showRealValue) {
    mainNumber = value;
  }

  const showSuffix = Boolean(suffix) && showRealValue;
  const showMax = max != null && showRealValue;

  // Name optional pieces before JSX — no nested ternaries in the tree.
  let suffixNode = null;
  if (showSuffix) {
    suffixNode = (
      <Text style={[styles.suffix, { color: colors.textMuted }]}>{suffix}</Text>
    );
  }

  let maxNode = null;
  if (showMax) {
    maxNode = (
      <Text style={[styles.max, { color: colors.textMuted }]}>{` / ${max}`}</Text>
    );
  }

  const valueStyle = [styles.value, { color: colors.textPrimary }];

  return (
    <View style={styles.valueRow}>
      <Text style={valueStyle} numberOfLines={1}>
        {mainNumber}
      </Text>
      {suffixNode}
      {maxNode}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * False for the empty placeholder, null/undefined, or blank string.
 * Zero (0) and other real numbers still count as displayable.
 */
function statHasDisplayableValue(value) {
  if (value === EMPTY_VALUE_PLACEHOLDER) {
    return false;
  }
  if (value == null) {
    return false;
  }
  if (value === '') {
    return false;
  }
  return true;
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
