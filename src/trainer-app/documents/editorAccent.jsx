// Neutral white accent chrome for the trainer document / spreadsheet editor.
// Flow: accent tokens → border / pill / bar / dot / icon / label wrappers → same look on every toolbar.
// Used by: EditorTopButtons, spreadsheet chrome, editorColors.
// Names still say "gradient" because callers already import those names — the paint is flat white.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: raise opacities = louder white accent on dark editor chrome; lower = quieter.
const EDITOR_ACCENT = lightColors.white;
const EDITOR_ACCENT_MUTED = 'rgba(255,255,255,0.55)';
const EDITOR_ACCENT_SOFT = 'rgba(255,255,255,0.12)';
const EDITOR_ACCENT_BORDER = 'rgba(255,255,255,0.32)';
// vocab: callers still pass GRADIENT / START / END into LinearGradient-style props even though both stops are the same white.
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
const ACTIVE_TOOL_MIN_SIZE = 36;

// ===== HELPER FUNCTIONS =====

/**
 * Inner corner must shrink when an active border eats into the outer radius.
 * Otherwise the fill pokes past the rounded ring.
 * @param {boolean} isActive
 * @param {number} outerRadius
 * @param {number} borderPadding
 * @returns {number}
 */
function cornerRadiusAfterBorderInset(isActive, outerRadius, borderPadding) {
  let insetPixels = 0;
  if (isActive) {
    insetPixels = borderPadding;
  }
  const shrunkRadius = outerRadius - insetPixels;
  if (shrunkRadius < 0) {
    return 0;
  }
  return shrunkRadius;
}

/**
 * Pick border width + paint for idle vs focused ring.
 * @param {boolean} isActive
 * @param {string} idleBorderColor
 * @param {string} activeBorderColor
 * @returns {{ borderWidth: number, borderPaint: string }}
 */
function borderPaintForFocusState(isActive, idleBorderColor, activeBorderColor) {
  if (isActive) {
    return { borderWidth: ACTIVE_BORDER_WIDTH, borderPaint: activeBorderColor };
  }
  return { borderWidth: IDLE_BORDER_WIDTH, borderPaint: idleBorderColor };
}

/**
 * Soft fill behind an active toolbar tool — theme accentSoft when present, else default soft white.
 * @param {object|undefined} theme
 * @returns {string}
 */
function softFillForActiveTool(theme) {
  const themeSoftFill = theme && theme.accentSoft;
  if (themeSoftFill) {
    return themeSoftFill;
  }
  return EDITOR_ACCENT_SOFT;
}

// ===== MAIN FUNCTION =====

/**
 * Two stacked Views: outer ring is the border; inner clips fill so corners stay crisp when focused.
 * Flow: 1. decide active ring  2. shrink inner radius  3. render outer → inner → children
 * @param {object} props
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
  // 1. Idle vs focused ring paint / thickness.
  const isActive = Boolean(active);
  const { borderWidth, borderPaint } = borderPaintForFocusState(
    isActive,
    borderColor,
    activeBorderColor,
  );

  // 2. Inner radius shrinks only while the active border is inset.
  const innerCornerRadius = cornerRadiusAfterBorderInset(isActive, radius, padding);

  // 3. Outer frame + optional fill; overflow hidden keeps children inside the ring.
  const outerFrameStyle = {
    borderWidth,
    borderColor: borderPaint,
    borderRadius: radius,
  };
  const hasBackgroundFill = bgColor != null;
  const innerFillStyle = [
    hasBackgroundFill ? { backgroundColor: bgColor } : null,
    innerStyle,
    { borderRadius: innerCornerRadius, overflow: 'hidden' },
  ];

  return (
    <View style={[outerFrameStyle, style]}>
      <View style={innerFillStyle}>{children}</View>
    </View>
  );
}

/**
 * Soft rounded pill behind a chip or active tool.
 * @param {object} props
 */
export function EditorGradientPill({
  style,
  children,
  radius = DEFAULT_PILL_RADIUS,
  backgroundColor = EDITOR_ACCENT_SOFT,
}) {
  const pillShellStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    backgroundColor,
  };
  return <View style={[pillShellStyle, style]}>{children}</View>;
}

/**
 * Thin accent hairline (toolbar separators, underlines).
 * @param {object} props
 */
export function EditorGradientBar({ style, backgroundColor = EDITOR_ACCENT_BORDER }) {
  const barShellStyle = {
    height: DEFAULT_BAR_HEIGHT,
    borderRadius: DEFAULT_BAR_RADIUS,
    backgroundColor,
  };
  return <View style={[barShellStyle, style]} />;
}

/**
 * Small round status / selection dot.
 * @param {object} props
 */
export function EditorGradientDot({ size = DEFAULT_DOT_SIZE, style, color = EDITOR_ACCENT_MUTED }) {
  const halfSize = size / 2;
  const dotShellStyle = {
    width: size,
    height: size,
    borderRadius: halfSize,
    backgroundColor: color,
  };
  return <View style={[dotShellStyle, style]} />;
}

/**
 * Ionicons glyph painted with the editor accent (or override color).
 * @param {object} props
 */
export function EditorGradientIcon({
  name,
  size = DEFAULT_ICON_SIZE,
  style,
  color = EDITOR_ACCENT_MUTED,
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

/**
 * Label text that always wins color over anything in textProps / style.
 * Color is applied last on purpose so the accent cannot be overridden by accident.
 * @param {object} props
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
 * Active tools wrap in a soft pill.
 * Flow: 1. idle → plain View  2. active → soft pill + centered inner
 * @param {object} props
 */
export function EditorActiveToolWrap({ active, theme, style, children }) {
  // 1. Idle: no extra chrome — just pass style through.
  if (!active) {
    return <View style={style}>{children}</View>;
  }

  // 2. Active: soft fill pill; inner layout keeps the icon/label centered and touchable.
  const softFill = softFillForActiveTool(theme);

  return (
    <EditorGradientPill style={style} radius={DEFAULT_PILL_RADIUS} backgroundColor={softFill}>
      <View style={activeToolInnerLayout}>{children}</View>
    </EditorGradientPill>
  );
}

export {
  EDITOR_ACCENT,
  EDITOR_ACCENT_MUTED,
  EDITOR_ACCENT_SOFT,
  EDITOR_ACCENT_BORDER,
  EDITOR_ACCENT_GRADIENT,
  EDITOR_ACCENT_START,
  EDITOR_ACCENT_END,
};

// ===== PLUMBING — skip unless debugging =====

// Manipulate here: minWidth/minHeight = touch target for an active tool chip inside the soft pill.
const activeToolInnerLayout = StyleSheet.create({
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: ACTIVE_TOOL_MIN_SIZE,
    minHeight: ACTIVE_TOOL_MIN_SIZE,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
}).inner;
