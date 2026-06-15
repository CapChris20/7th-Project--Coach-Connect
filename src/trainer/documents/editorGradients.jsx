import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Neutral editor accent — no cyan/orange gradients. */
export const EDITOR_ACCENT = '#FFFFFF';
export const EDITOR_ACCENT_MUTED = 'rgba(255,255,255,0.55)';
export const EDITOR_ACCENT_SOFT = 'rgba(255,255,255,0.12)';
export const EDITOR_ACCENT_BORDER = 'rgba(255,255,255,0.32)';
/** @deprecated Use theme.accentBorder — kept for callers that still read [0]. */
export const EDITOR_ACCENT_GRADIENT = [EDITOR_ACCENT, EDITOR_ACCENT];
export const EDITOR_ACCENT_START = { x: 0, y: 0 };
export const EDITOR_ACCENT_END = { x: 1, y: 0 };

export function EditorGradientBorder({
  active,
  children,
  style,
  innerStyle,
  bgColor,
  borderColor,
  activeBorderColor = EDITOR_ACCENT_BORDER,
  padding = 1.5,
  radius = 12,
}) {
  return (
    <View
      style={[
        {
          borderWidth: active ? 1.5 : 1,
          borderColor: active ? activeBorderColor : borderColor,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <View
        style={[
          bgColor != null ? { backgroundColor: bgColor } : null,
          innerStyle,
          { borderRadius: Math.max(0, radius - (active ? padding : 0)), overflow: 'hidden' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function EditorGradientPill({ style, children, radius = 8, backgroundColor = EDITOR_ACCENT_SOFT }) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor }, style]}>
      {children}
    </View>
  );
}

export function EditorGradientBar({ style, backgroundColor = EDITOR_ACCENT_BORDER }) {
  return <View style={[{ height: 3, borderRadius: 2, backgroundColor }, style]} />;
}

export function EditorGradientDot({ size = 6, style, color = EDITOR_ACCENT_MUTED }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

export function EditorGradientIcon({ name, size = 17, style, color = EDITOR_ACCENT_MUTED }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

export function EditorGradientLabel({ children, style, textProps, color = EDITOR_ACCENT }) {
  return (
    <Text {...textProps} style={[style, { color }]}>
      {children}
    </Text>
  );
}

/** Active toolbar chip — subtle fill, light icon/text on top. */
export function EditorActiveToolWrap({ active, theme, style, children }) {
  if (!active) {
    return <View style={style}>{children}</View>;
  }
  return (
    <EditorGradientPill style={style} radius={8} backgroundColor={theme?.accentSoft || EDITOR_ACCENT_SOFT}>
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
