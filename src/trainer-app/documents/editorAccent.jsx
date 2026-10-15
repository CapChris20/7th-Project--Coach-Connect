// Neutral white accent for the document editor: borders, pills, dots, and labels.
// Flow: one accent color at four opacities → small wrappers so every toolbar looks the same.
// Used by the spreadsheet chrome. The names still say "gradient" because callers already use them.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const EDITOR_ACCENT = '#FFFFFF';
const EDITOR_ACCENT_MUTED = 'rgba(255,255,255,0.55)';
const EDITOR_ACCENT_SOFT = 'rgba(255,255,255,0.12)';
const EDITOR_ACCENT_BORDER = 'rgba(255,255,255,0.32)';
const EDITOR_ACCENT_GRADIENT = [EDITOR_ACCENT, EDITOR_ACCENT];
const EDITOR_ACCENT_START = { x: 0, y: 0 };
const EDITOR_ACCENT_END = { x: 1, y: 0 };

const DEFAULT_BORDER_RADIUS = 12;
const ACTIVE_BORDER_PADDING = 1.5;
const IDLE_BORDER_WIDTH = 1;
const ACTIVE_BORDER_WIDTH = 1.5;
const DEFAULT_PILL_RADIUS = 8;
const DEFAULT_BAR_HEIGHT = 3;
const DEFAULT_BAR_RADIUS = 2;
const DEFAULT_DOT_SIZE = 6;
const DEFAULT_ICON_SIZE = 17;

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isActive
 * @param {number} radius
 * @param {number} padding
 * @returns {number}
 */
function innerCornerRadius(isActive, radius, padding) {
  const inset = isActive ? padding : 0;
  return Math.max(0, radius - inset);
}

// ===== MAIN FUNCTION =====

/**
 * Two layers so the inner fill clips to a smaller radius than the border.
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorGradientBorder({
  active,
  children,
  style,
  innerStyle,
  bgColor,
  borderColor,
  activeBorderColor = EDITOR_ACCENT_BORDER,
  padding = ACTIVE_BORDER_PADDING,
  radius = DEFAULT_BORDER_RADIUS,
}) {
  const isActive = Boolean(active);
  return (
    <View
      style={[
        {
          borderWidth: isActive ? ACTIVE_BORDER_WIDTH : IDLE_BORDER_WIDTH,
          borderColor: isActive ? activeBorderColor : borderColor,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <View
        style={[
          bgColor != null ? { backgroundColor: bgColor } : null,
          innerStyle,
          { borderRadius: innerCornerRadius(isActive, radius, padding), overflow: 'hidden' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

/**
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorGradientPill({
  style,
  children,
  radius = DEFAULT_PILL_RADIUS,
  backgroundColor = EDITOR_ACCENT_SOFT,
}) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor }, style]}>
      {children}
    </View>
  );
}

/**
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorGradientBar({ style, backgroundColor = EDITOR_ACCENT_BORDER }) {
  return <View style={[{ height: DEFAULT_BAR_HEIGHT, borderRadius: DEFAULT_BAR_RADIUS, backgroundColor }, style]} />;
}

/**
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorGradientDot({ size = DEFAULT_DOT_SIZE, style, color = EDITOR_ACCENT_MUTED }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

/**
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorGradientIcon({ name, size = DEFAULT_ICON_SIZE, style, color = EDITOR_ACCENT_MUTED }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/**
 * Color is applied last so the accent always wins over anything in textProps.
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorGradientLabel({ children, style, textProps, color = EDITOR_ACCENT }) {
  return (
    <Text {...textProps} style={[style, { color }]}>
      {children}
    </Text>
  );
}

/**
 * Idle toolbar buttons stay a bare View so the toolbar does not stack extra layers.
 * @param {object} props
 * @returns {import('react').ReactElement}
 */
export function EditorActiveToolWrap({ active, theme, style, children }) {
  if (!active) {
    return <View style={style}>{children}</View>;
  }
  return (
    <EditorGradientPill style={style} radius={DEFAULT_PILL_RADIUS} backgroundColor={theme?.accentSoft || EDITOR_ACCENT_SOFT}>
      <View style={activeToolStyles.inner}>{children}</View>
    </EditorGradientPill>
  );
}

const activeToolStyles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});

export {
  EDITOR_ACCENT,
  EDITOR_ACCENT_MUTED,
  EDITOR_ACCENT_SOFT,
  EDITOR_ACCENT_BORDER,
  EDITOR_ACCENT_GRADIENT,
  EDITOR_ACCENT_START,
  EDITOR_ACCENT_END,
};
