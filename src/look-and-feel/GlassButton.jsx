// Legacy primary button — brand gradient fill with nb ink border (not liquid glass).
// Flow: Pressable fade → LinearGradient shell → optional dark overlay → left / title / right row.
// Used by leftover glass-screen callers; new UI should prefer NbButton.
// vocab: GlassButton is a legacy export name; default colors come from gradients.brand (pink→orange).

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { gradients, lightColors, borderRadius, nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: touch target min 44; opacities tune how “dead” disabled / pressed feel.
const PLATFORM_NAME_IOS = 'ios';
const OPACITY_WHEN_DISABLED = 0.45;
const OPACITY_WHEN_PRESSED = 0.92;
const OPACITY_WHEN_IDLE = 1;
const DEFAULT_CORNER_RADIUS = borderRadius.nbButton || 10;
const GRADIENT_DIAGONAL_START = { x: 0, y: 0 };
const GRADIENT_DIAGONAL_END = { x: 1, y: 1 };

const styles = StyleSheet.create({
  hitTarget: {
    minHeight: 44,
    minWidth: 44,
  },
  gradientPadding: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconSlot: {
    width: 36,
    alignItems: 'center',
  },
  titleText: {
    flex: 1,
    textAlign: 'center',
    color: lightColors.nbInk,
    fontWeight: '900',
    letterSpacing: 0.2,
    fontSize: 16,
  },
});

// ===== HELPER FUNCTIONS =====

/**
 * Left icon · centered title · right icon. Empty slots still take width so the title stays centered.
 */
function GlassButtonLabelRow({ left, title, right }) {
  return (
    <View style={styles.labelRow}>
      <View style={styles.iconSlot}>{left}</View>
      <Text style={styles.titleText} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.iconSlot}>{right}</View>
    </View>
  );
}

/**
 * Optional black veil on top of the gradient. pointerEvents none so presses hit the Pressable.
 */
function GlassButtonDarkOverlay({ overlayOpacity }) {
  const overlayBackgroundColor = `rgba(0,0,0,${overlayOpacity})`;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: overlayBackgroundColor }]}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Brand-gradient pressable button. Props and defaults match the legacy GlassButton API.
 * @param {{ title: string, onPress?: Function, disabled?: boolean, style?: object, left?: import('react').ReactNode, right?: import('react').ReactNode, radius?: number, colors?: string[], overlayOpacity?: number }} props
 */
export default function GlassButton({
  title,
  onPress,
  disabled,
  style,
  left,
  right,
  radius = DEFAULT_CORNER_RADIUS,
  colors = gradients.brand.colors,
  overlayOpacity = 0,
}) {
  // 1. Treat disabled as a hard yes/no so opacity math never guesses undefined.
  const buttonIsDisabled = Boolean(disabled);
  const shouldPaintDarkOverlay = overlayOpacity > 0;

  // 2. Corner + thick nb border; iOS gets continuous curves when the OS supports them.
  const gradientShellStyle = [styles.gradientPadding, buildGradientBorderShape(radius)];

  // 3. Pressable fades the whole control; gradient + label sit inside.
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.hitTarget,
        { opacity: opacityForPressState(buttonIsDisabled, pressed) },
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={GRADIENT_DIAGONAL_START}
        end={GRADIENT_DIAGONAL_END}
        style={gradientShellStyle}
      >
        {shouldPaintDarkOverlay ? (
          <GlassButtonDarkOverlay overlayOpacity={overlayOpacity} />
        ) : null}
        <GlassButtonLabelRow left={left} title={title} right={right} />
      </LinearGradient>
    </Pressable>
  );
}

// PLUMBING — skip unless debugging

function opacityForPressState(buttonIsDisabled, fingerIsDown) {
  if (buttonIsDisabled) return OPACITY_WHEN_DISABLED;
  if (fingerIsDown) return OPACITY_WHEN_PRESSED;
  return OPACITY_WHEN_IDLE;
}

function buildGradientBorderShape(cornerRadius) {
  const shape = {
    borderRadius: cornerRadius,
    borderWidth: nb.borderWidth,
    borderColor: lightColors.nbBorder,
  };
  if (Platform.OS === PLATFORM_NAME_IOS) {
    shape.borderCurve = 'continuous';
  }
  return shape;
}
