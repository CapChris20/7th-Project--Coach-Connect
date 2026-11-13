// Compat card wrapper — Design Law solid surface (no glass blur / gradient stroke).
// Flow: Pressable when tappable → nb surface + ink border → children.
// Used by: any leftover GlassCard imports — API unchanged; prefer NbCard for new UI.
// vocab: GlassCard name is legacy; paint is neo-brutalist nb tokens only

import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from './lightDarkMode';
import { nb } from './colorPalette';

// ===== NAMED CONSTANTS =====

const PRESSED_OPACITY = 0.96;
const PLATFORM_IOS = 'ios';
const DEFAULT_RADIUS = 14;

// ===== HELPER FUNCTIONS =====

function iosContinuousCurveStyle() {
  return Platform.OS === PLATFORM_IOS ? { borderCurve: 'continuous' } : null;
}

function pressedCardStyle(isPressed, extraStyle) {
  return [styles.hit, { opacity: isPressed ? PRESSED_OPACITY : 1 }, extraStyle];
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
  radius = DEFAULT_RADIUS,
  blurIntensity, // ignored — kept for call-site compat
  strokeColors, // ignored — kept for call-site compat
}) {
  void blurIntensity;
  void strokeColors;
  const { colors } = useTheme();
  const Container = onPress ? Pressable : View;
  const containerStyle = onPress
    ? ({ pressed }) => pressedCardStyle(pressed, style)
    : [styles.hit, style];
  const continuousCurve = iosContinuousCurveStyle();

  return (
    <Container disabled={disabled} onPress={onPress} style={containerStyle}>
      <View
        style={[
          styles.surface,
          {
            borderRadius: radius,
            borderWidth: nb.borderWidth,
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            ...continuousCurve,
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  surface: {
    flex: 1,
    overflow: 'hidden',
  },
});
