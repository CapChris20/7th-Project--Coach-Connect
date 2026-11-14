// Week navigation strip — prev/next chevron squares and a centered date-range label.
// Flow: haptic on arrow tap → parent changes the selected week index.
// Used by WeeklyReportBody for client and trainer report screens. Settings stays on the page header.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const PRESS_HIT_SLOP_PIXELS = 10;
const ARROW_DISABLED_OPACITY = 0.4;
const ARROW_ENABLED_OPACITY = 1;
const DEFAULT_WEEK_TITLE = 'This week';
const CHEVRON_BACK_ICON_NAME = 'chevron-back';
const CHEVRON_FORWARD_ICON_NAME = 'chevron-forward';
const PREVIOUS_WEEK_A11Y_LABEL = 'Previous week';
const NEXT_WEEK_A11Y_LABEL = 'Next week';

// Manipulate here: square matches NbPageHeader back chips (44pt min touch)
const ARROW_SQUARE_SIZE = nb.minTouchTarget;

// Manipulate here: Ionicons glyph sizes inside the squares (back is slightly larger)
const BACK_CHEVRON_SIZE = 22;
const FORWARD_CHEVRON_SIZE = 18;

// ===== HELPER FUNCTIONS =====

function triggerSelectionHaptic() {
  // vocab: Haptics.selectionAsync = light “tick” on iOS/Android; catch ignores sim / permission misses
  Haptics.selectionAsync().catch(() => {});
}

function runArrowPressWithHaptic(onPress) {
  triggerSelectionHaptic();
  // vocab/symbol: ?. = call only when the parent actually passed a handler
  if (onPress) onPress();
}

function opacityWhenArrowEnabled(arrowIsEnabled) {
  if (arrowIsEnabled) return ARROW_ENABLED_OPACITY;
  return ARROW_DISABLED_OPACITY;
}

/**
 * Outlined HardShadow square for week arrows — same chrome as header back chips.
 */
function WeekNavArrowSquare({
  onPress,
  isDisabled,
  accessibilityLabel,
  children,
  colors,
}) {
  const arrowIsEnabled = !isDisabled;
  const squareOpacity = opacityWhenArrowEnabled(arrowIsEnabled);
  const squareBorderColor = colors.border;
  const squareBackgroundColor = colors.surfacePrimary;

  return (
    <HardShadow
      offset={nb.shadowOffsetSmall}
      radius={borderRadius.nbChip}
      style={{ opacity: squareOpacity }}
    >
      <Pressable
        onPress={() => runArrowPressWithHaptic(onPress)}
        disabled={isDisabled}
        hitSlop={PRESS_HIT_SLOP_PIXELS}
        accessibilityLabel={accessibilityLabel}
        style={[
          styles.arrowSquare,
          {
            borderColor: squareBorderColor,
            backgroundColor: squareBackgroundColor,
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
 * Prev / title+range / next strip. Parent owns which week index is selected.
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
  title = DEFAULT_WEEK_TITLE,
  canPrev,
  canNext,
  onPrev,
  onNext,
}) {
  // vocab: useTheme = report color tokens for title / muted range / icon ink
  const { colors } = useTheme();

  // 1. Name theme colors so JSX stays flat (no colors.* buried in attributes only).
  const titleColor = colors.textPrimary;
  const dateRangeColor = colors.textMuted;
  const chevronIconColor = colors.textPrimary;

  // 2. Arrow disabled flags — parent says whether another week exists in that direction.
  const previousArrowIsDisabled = !canPrev;
  const nextArrowIsDisabled = !canNext;

  // 3. Row: previous square, centered titles, next square.
  return (
    <View style={styles.row}>
      <WeekNavArrowSquare
        onPress={onPrev}
        isDisabled={previousArrowIsDisabled}
        accessibilityLabel={PREVIOUS_WEEK_A11Y_LABEL}
        colors={colors}
      >
        <Ionicons
          name={CHEVRON_BACK_ICON_NAME}
          size={BACK_CHEVRON_SIZE}
          color={chevronIconColor}
        />
      </WeekNavArrowSquare>

      <View style={styles.centerColumn} testID="week-label">
        <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.range, { color: dateRangeColor }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      <WeekNavArrowSquare
        onPress={onNext}
        isDisabled={nextArrowIsDisabled}
        accessibilityLabel={NEXT_WEEK_A11Y_LABEL}
        colors={colors}
      >
        <Ionicons
          name={CHEVRON_FORWARD_ICON_NAME}
          size={FORWARD_CHEVRON_SIZE}
          color={chevronIconColor}
        />
      </WeekNavArrowSquare>
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
  arrowSquare: {
    width: ARROW_SQUARE_SIZE,
    height: ARROW_SQUARE_SIZE,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerColumn: {
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
