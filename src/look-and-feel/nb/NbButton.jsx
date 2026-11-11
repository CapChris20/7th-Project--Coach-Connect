// Full-width action button: solid black (white in dark mode), thick outline, hard shadow that sinks when pressed.
// Flow: pick the fill and text color for the variant → draw the surface → move it down-right while pressed.
// Used by screens for their one main action (primary) and for secondary actions (plain, accent).

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../lightDarkMode';
import { NbSurface } from './NbSurface';
import {
  MINIMUM_TOUCH_SIZE,
  NB_RADIUS,
  NB_SHADOW_OFFSET,
  NB_SPACING,
  NB_TEXT_ON_ACCENT,
  getNbColors,
} from './nbTokens';

// ===== NAMED CONSTANTS =====

const BUTTON_MIN_HEIGHT = 48;
const BUTTON_FONT_SIZE = 15;

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} variant primary, plain or accent.
 * @param {object} colors
 * @returns {string} Fill color for the button, or empty for a gradient accent.
 */
function fillForVariant(variant, colors) {
  if (variant === 'primary') return colors.ink;
  if (variant === 'plain') return colors.surface;
  return undefined;
}

/**
 * @param {string} variant
 * @param {object} colors
 * @returns {string}
 */
function labelColorForVariant(variant, colors) {
  if (variant === 'primary') return colors.onInk;
  if (variant === 'accent') return NB_TEXT_ON_ACCENT;
  return colors.ink;
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {string} props.label
 * @param {Function} props.onPress
 * @param {string} [props.variant] primary (default), plain or accent.
 * @param {string[]} [props.accent] Gradient pair for the accent variant.
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.isDisabled]
 * @param {string} [props.labelColor] Overrides the label color, for example a danger red.
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export function NbButton({
  label,
  onPress,
  variant = 'primary',
  accent,
  isLoading = false,
  isDisabled = false,
  labelColor,
  style,
}) {
  // 1. Colors for the current theme and the variant.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const textColor = labelColor || labelColorForVariant(variant, colors);
  const blocked = isDisabled || isLoading;

  // 2. While pressed the button moves onto its shadow, like a real key.
  const pressedShift = { transform: [{ translateX: NB_SHADOW_OFFSET }, { translateY: NB_SHADOW_OFFSET }] };

  // 3. Draw the surface, then the label or a spinner.
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: blocked }}
    >
      {({ pressed }) => (
        <NbSurface
          accent={variant === 'accent' ? accent : undefined}
          fillColor={fillForVariant(variant, colors)}
          radius={NB_RADIUS.chip}
          hasShadow={!pressed}
          style={[style, pressed ? pressedShift : null, blocked ? styles.blocked : null]}
          innerStyle={styles.buttonInner}
        >
          {isLoading ? (
            <ActivityIndicator color={textColor} />
          ) : (
            <Text numberOfLines={1} style={[styles.label, { color: textColor }]}>
              {label}
            </Text>
          )}
        </NbSurface>
      )}
    </Pressable>
  );
}

export default NbButton;

const styles = StyleSheet.create({
  buttonInner: {
    minHeight: BUTTON_MIN_HEIGHT,
    minWidth: MINIMUM_TOUCH_SIZE,
    paddingHorizontal: NB_SPACING.large,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: BUTTON_FONT_SIZE, fontWeight: '800' },
  blocked: { opacity: 0.55 },
});
