// Gradient button used on the weekly report: filled primary, or outline with a gradient ring.
// Flow: light haptic → if outline, draw the ring + inner fill; otherwise fill the whole button with the gradient.
// Used by: weekly report actions. `colors` is the gradient pair the parent already chose.

import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const VARIANT_PRIMARY = 'primary';
const VARIANT_OUTLINE = 'outline';
const DARK_MODE = 'dark';
const OUTLINE_INNER_DARK = '#0a0a0f';
const OUTLINE_INNER_LIGHT = '#f4f4f6';
const PRIMARY_ICON_COLOR = '#fff';
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };
const PRESSED_OUTLINE_OPACITY = 0.85;
const PRESSED_PRIMARY_OPACITY = 0.9;

// ===== HELPER FUNCTIONS =====

/**
 * Haptic first so the tap feels instant even if onPress is slow.
 * A missing haptic engine (web / simulator) is ignored on purpose.
 * @param {Function} [onPress]
 */
function pressWithLightHaptic(onPress) {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  onPress?.();
}

/**
 * @param {string} mode
 * @returns {string}
 */
function outlineInnerBackground(mode) {
  return mode === DARK_MODE ? OUTLINE_INNER_DARK : OUTLINE_INNER_LIGHT;
}

/**
 * @param {boolean} isPressed
 * @param {number} pressedOpacity
 * @param {*} extraStyle
 * @returns {Array}
 */
function pressedOpacityStyle(isPressed, pressedOpacity, extraStyle) {
  return [extraStyle, { opacity: isPressed ? pressedOpacity : 1 }];
}

// ===== MAIN FUNCTION =====

/**
 * Weekly-report gradient button. Outline keeps a solid inner so the label stays readable.
 * @param {{ label: string, icon?: string, colors: string[], onPress?: Function, variant?: string, testID?: string, style?: object }} props
 */
export function ColorButton({
  label,
  icon,
  colors,
  onPress,
  variant = VARIANT_PRIMARY,
  testID,
  style,
}) {
  const { colors: themeColors, mode } = useTheme();

  const handlePress = () => {
    pressWithLightHaptic(onPress);
  };

  if (variant === VARIANT_OUTLINE) {
    return (
      <Pressable
        testID={testID}
        onPress={handlePress}
        style={({ pressed }) => pressedOpacityStyle(pressed, PRESSED_OUTLINE_OPACITY, style)}
      >
        <LinearGradient colors={colors} start={GRADIENT_START} end={GRADIENT_END} style={styles.outlineBorder}>
          <View
            style={[
              styles.outlineInner,
              { backgroundColor: outlineInnerBackground(mode) },
            ]}
          >
            {icon ? <Ionicons name={icon} size={16} color={themeColors.textPrimary} /> : null}
            <Text style={[styles.outlineText, { color: themeColors.textPrimary }]}>{label}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => pressedOpacityStyle(pressed, PRESSED_PRIMARY_OPACITY, style)}
    >
      <LinearGradient colors={colors} start={GRADIENT_START} end={GRADIENT_END} style={styles.primary}>
        {icon ? <Ionicons name={icon} size={18} color={PRIMARY_ICON_COLOR} /> : null}
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#ff1493',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  outlineBorder: {
    height: 56,
    borderRadius: 18,
    padding: 1.5,
  },
  outlineInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16.5,
  },
  outlineText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
