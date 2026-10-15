// Frosted glass card: blur, faint fill, and a brighter-on-top gradient stroke.
// Flow: wrap in Pressable when tappable → draw the stroke → blur behind the surface → render children on top.
// Used by: login and other dark panels. Children stay outside BlurView so icons stay sharp.

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import BlurredBackground from './BlurredBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { Liquid } from './glassSettings';

// ===== NAMED CONSTANTS =====

const DEFAULT_BLUR_INTENSITY = 30;
const PRESSED_OPACITY = 0.96;
const STROKE_GRADIENT_START = { x: 0.5, y: 0 };
const STROKE_GRADIENT_END = { x: 0.5, y: 1 };
const PLATFORM_IOS = 'ios';
const BLUR_TINT_DARK = 'dark';

// ===== HELPER FUNCTIONS =====

/**
 * iOS squircle. Android ignores borderCurve, so we only set it on iOS.
 * vocab: borderCurve 'continuous' = iOS continuous-corner squircle, not a plain rounded rect.
 * @returns {{ borderCurve: string }|null}
 */
function iosContinuousCurveStyle() {
  return Platform.OS === PLATFORM_IOS ? { borderCurve: 'continuous' } : null;
}

/**
 * @param {boolean} isPressed
 * @param {*} extraStyle
 * @returns {Array}
 */
function pressedCardStyle(isPressed, extraStyle) {
  return [styles.hit, { opacity: isPressed ? PRESSED_OPACITY : 1 }, extraStyle];
}

// ===== MAIN FUNCTION =====

/**
 * Custom "glass material": background blur, semi-transparent surface, linear border
 * brighter at top, fading to bottom, squircle geometry (continuous curve on iOS).
 * @param {{ children: *, style?: object, contentStyle?: object, onPress?: Function, disabled?: boolean, radius?: number, blurIntensity?: number, strokeColors?: string[] }} props
 */
export default function GlassCard({
  children,
  style,
  contentStyle,
  onPress,
  disabled,
  radius = Liquid.radius.card,
  blurIntensity = DEFAULT_BLUR_INTENSITY,
  strokeColors = [Liquid.colors.glassStrokeTop, Liquid.colors.glassStrokeBottom],
}) {
  const Container = onPress ? Pressable : View;
  const containerStyle = onPress
    ? ({ pressed }) => pressedCardStyle(pressed, style)
    : [styles.hit, style];
  const continuousCurve = iosContinuousCurveStyle();

  return (
    <Container
      disabled={disabled}
      onPress={onPress}
      style={containerStyle}
    >
      {/* Gradient stroke sits under the inner card; pointerEvents none so taps hit the Pressable. */}
      <LinearGradient
        pointerEvents="none"
        colors={strokeColors}
        start={STROKE_GRADIENT_START}
        end={STROKE_GRADIENT_END}
        style={[
          styles.stroke,
          {
            borderRadius: radius,
            ...continuousCurve,
          },
        ]}
      />

      {/* Inner glass — blur behind surface so children (icons/images) are not inside BlurView */}
      <BlurredBackground
        intensity={blurIntensity}
        tint={BLUR_TINT_DARK}
        style={[
          styles.blur,
          {
            borderRadius: radius,
            ...continuousCurve,
          },
        ]}
      >
        <View
          style={[
            styles.surface,
            {
              borderRadius: radius,
              ...continuousCurve,
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </BlurredBackground>
    </Container>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  stroke: {
    ...StyleSheet.absoluteFillObject,
    padding: 1,
  },
  blur: {
    overflow: 'hidden',
  },
  surface: {
    flex: 1,
    backgroundColor: Liquid.colors.glassSurface,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.02)',
  },
});
