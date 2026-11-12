// Design Law week strip — square chevrons + “This week” / date range (progress PNG).
// Flow: haptic on tap → prev/next week. Settings lives on the page header, not here.
// Used by: WeeklyReportBody for client and trainer.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const HIT_SLOP = 10;
const DISABLED_OPACITY = 0.4;
const ENABLED_OPACITY = 1;
const THIS_WEEK_LABEL = 'This week';
const ICON_BACK = 'chevron-back';
const ICON_FORWARD = 'chevron-forward';
// Manipulate here: square size matches header back chips (44)
const SQUARE = nb.minTouchTarget;

// ===== HELPER FUNCTIONS =====

function playSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

function pressWithHaptic(onPress) {
  playSelectionHaptic();
  onPress?.();
}

function arrowOpacity(isEnabled) {
  return isEnabled ? ENABLED_OPACITY : DISABLED_OPACITY;
}

/**
 * HardShadow outlined square for prev/next — same chrome as NbPageHeader back chip.
 */
function WeekSquare({ onPress, disabled, accessibilityLabel, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip} style={{ opacity: arrowOpacity(!disabled) }}>
      <Pressable
        onPress={() => pressWithHaptic(onPress)}
        disabled={disabled}
        hitSlop={HIT_SLOP}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.square,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfacePrimary,
          },
        ]}
      >
        {children}
      </Pressable>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   label: string,
 *   title?: string,
 *   canPrev: boolean,
 *   canNext: boolean,
 *   onPrev: Function,
 *   onNext: Function,
 * }} props
 */
export function WeekPicker({
  label,
  title = THIS_WEEK_LABEL,
  canPrev,
  canNext,
  onPrev,
  onNext,
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <WeekSquare
        onPress={onPrev}
        disabled={!canPrev}
        accessibilityLabel="Previous week"
        colors={colors}
      >
        <Ionicons name={ICON_BACK} size={22} color={colors.textPrimary} />
      </WeekSquare>

      <View style={styles.mid} testID="week-label">
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.range, { color: colors.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <WeekSquare
        onPress={onNext}
        disabled={!canNext}
        accessibilityLabel="Next week"
        colors={colors}
      >
        <Ionicons name={ICON_FORWARD} size={18} color={colors.textPrimary} />
      </WeekSquare>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  square: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  range: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
