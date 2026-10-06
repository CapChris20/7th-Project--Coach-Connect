// A gradient button with optional icons on either side of the label.
// Flow: press fades the button → the gradient fills the shape → the title stays centered.
// Used by glass screens that need a primary action.

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Liquid } from './glassSettings';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';
const DISABLED_OPACITY = 0.45;
const PRESSED_OPACITY = 0.92;
const IDLE_OPACITY = 1;

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDisabled
 * @param {boolean} isPressed
 * @returns {number}
 */
function buttonOpacity(isDisabled, isPressed) {
  if (isDisabled) return DISABLED_OPACITY;
  if (isPressed) return PRESSED_OPACITY;
  return IDLE_OPACITY;
}

/**
 * iOS can round with a continuous curve. Android ignores that key.
 * @param {number} radius
 * @returns {object}
 */
function gradientShape(radius) {
  if (Platform.OS !== IOS_PLATFORM) return { borderRadius: radius };
  return { borderRadius: radius, borderCurve: 'continuous' };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ title: string, onPress?: Function, disabled?: boolean, style?: object, left?: import('react').ReactNode, right?: import('react').ReactNode, radius?: number, colors?: string[], overlayOpacity?: number }} props
 * @returns {import('react').ReactElement}
 */
export default function GlassButton({
  title,
  onPress,
  disabled,
  style,
  left,
  right,
  radius = Liquid.radius.inner,
  colors = Liquid.gradients.primary,
  overlayOpacity = 0,
}) {
  const isDisabled = Boolean(disabled);
  const hasOverlay = overlayOpacity > 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.hit,
        { opacity: buttonOpacity(isDisabled, pressed) },
        style,
      ]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.grad, gradientShape(radius)]}
      >
        {hasOverlay ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]}
          />
        ) : null}
        <View style={styles.row}>
          <View style={styles.iconSlot}>{left}</View>
          <Text style={styles.text} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.iconSlot}>{right}</View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  grad: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconSlot: {
    width: 36,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.2,
    fontSize: 16,
  },
});
