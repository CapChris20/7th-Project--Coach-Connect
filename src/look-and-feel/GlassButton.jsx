// Compat primary button — Design Law fill or brand gradient (no Liquid glass).
// Flow: press fades → gradient/fill shape → centered title.
// Used by leftover glass-screen callers; new UI should use NbButton.
// vocab: GlassButton name is legacy; defaults to brand pink→orange accent gradient

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, lightColors, borderRadius, nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';
const DISABLED_OPACITY = 0.45;
const PRESSED_OPACITY = 0.92;
const IDLE_OPACITY = 1;
const DEFAULT_RADIUS = borderRadius.nbButton || 10;

// ===== HELPER FUNCTIONS =====

function buttonOpacity(isDisabled, isPressed) {
  if (isDisabled) return DISABLED_OPACITY;
  if (isPressed) return PRESSED_OPACITY;
  return IDLE_OPACITY;
}

function gradientShape(radius) {
  const shape = {
    borderRadius: radius,
    borderWidth: nb.borderWidth,
    borderColor: lightColors.nbBorder,
  };
  if (Platform.OS === IOS_PLATFORM) shape.borderCurve = 'continuous';
  return shape;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ title: string, onPress?: Function, disabled?: boolean, style?: object, left?: import('react').ReactNode, right?: import('react').ReactNode, radius?: number, colors?: string[], overlayOpacity?: number }} props
 */
export default function GlassButton({
  title,
  onPress,
  disabled,
  style,
  left,
  right,
  radius = DEFAULT_RADIUS,
  colors = gradients.brand.colors,
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
    color: lightColors.nbInk,
    fontWeight: '900',
    letterSpacing: 0.2,
    fontSize: 16,
  },
});
