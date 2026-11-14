// Legacy card shell — solid nb surface + ink border (no blur, no glass stroke).
// Flow: keep legacy glass props (ignored) → theme colors → Pressable or View → rounded surface → children.
// Used by leftover GlassCard imports; prefer NbCard for new screens.
// vocab: blurIntensity and strokeColors stay on the API but paint nothing (call-site compat).

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: pressed fade; default corner radius when the caller omits radius.
const OPACITY_WHEN_PRESSED = 0.96;
const OPACITY_WHEN_IDLE = 1;
const PLATFORM_NAME_IOS = 'ios';
const DEFAULT_CORNER_RADIUS = 14;

const styles = StyleSheet.create({
  hitTarget: {
    minHeight: 44,
    minWidth: 44,
  },
  surfaceFace: {
    flex: 1,
    overflow: 'hidden',
  },
});

// ===== HELPER FUNCTIONS =====

/**
 * Inner face: nb surface fill, thick ink border, optional continuous corners on iOS.
 */
function GlassCardSurfaceFace({ radius, borderColor, surfaceColor, contentStyle, children }) {
  const iosCurveExtras =
    Platform.OS === PLATFORM_NAME_IOS ? { borderCurve: 'continuous' } : null;

  const surfacePaint = {
    borderRadius: radius,
    borderWidth: nb.borderWidth,
    borderColor,
    backgroundColor: surfaceColor,
    ...iosCurveExtras,
  };

  return <View style={[styles.surfaceFace, surfacePaint, contentStyle]}>{children}</View>;
}

// ===== MAIN FUNCTION =====

/**
 * Solid nb surface, thick ink border — no BlurView, no glass stroke gradient.
 * @param {{ children: *, style?: object, contentStyle?: object, onPress?: Function, disabled?: boolean, radius?: number, blurIntensity?: number, strokeColors?: string[] }} props
 */
export default function GlassCard({
  children,
  style,
  contentStyle,
  onPress,
  disabled,
  radius = DEFAULT_CORNER_RADIUS,
  blurIntensity,
  strokeColors,
}) {
  // 1. Legacy glass props are no-ops but must stay destructured so call sites do not warn.
  void blurIntensity;
  void strokeColors;

  // vocab: useTheme = light/dark palette from the app theme provider
  const { colors } = useTheme();

  // 2. Tappable cards use Pressable; static cards stay a plain View.
  const cardIsTappable = Boolean(onPress);
  const OuterWrapper = cardIsTappable ? Pressable : View;

  const outerStyle = cardIsTappable
    ? ({ pressed }) => hitTargetStyleWhenPressed(pressed, style)
    : [styles.hitTarget, style];

  // 3. Theme tokens drive border + fill; contentStyle can override padding inside the face.
  return (
    <OuterWrapper disabled={disabled} onPress={onPress} style={outerStyle}>
      <GlassCardSurfaceFace
        radius={radius}
        borderColor={colors.nbBorder}
        surfaceColor={colors.nbSurface}
        contentStyle={contentStyle}
      >
        {children}
      </GlassCardSurfaceFace>
    </OuterWrapper>
  );
}

// PLUMBING — skip unless debugging

function hitTargetStyleWhenPressed(fingerIsDown, extraStyle) {
  const pressOpacity = fingerIsDown ? OPACITY_WHEN_PRESSED : OPACITY_WHEN_IDLE;
  return [styles.hitTarget, { opacity: pressOpacity }, extraStyle];
}
