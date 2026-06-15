/**
 * editor Gradients
 *
 * Purpose: editor Gradients — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: EditorGradientBorder, EditorGradientPill, EditorGradientBar, EditorGradientDot, EditorGradientIcon, EditorGradientLabel, EditorActiveToolWrap, EDITOR_ACCENT_GRADIENT
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Ionicons } from '@expo/vector-icons';

/** Pink → purple — matches nav icons and dashboard card gradients. */
export const EDITOR_ACCENT_GRADIENT = ['#FF6B9D', '#C084FC'];
export const EDITOR_ACCENT_START = { x: 0, y: 0 };
export const EDITOR_ACCENT_END = { x: 1, y: 0 };

export function EditorGradientBorder({
  active,
  children,
  style,
  innerStyle,
  bgColor,
  borderColor,
  padding = 1.5,
  radius = 12,
}) {
  const inner = (
    <View
      style={[
        bgColor != null ? { backgroundColor: bgColor } : null,
        innerStyle,
        { borderRadius: active ? Math.max(0, radius - padding) : radius, overflow: 'hidden' },
      ]}
    >
      {children}
    </View>
  );
  if (!active) {
    return (
      <View style={[{ borderWidth: 1, borderColor, borderRadius: radius }, style]}>
        {inner}
      </View>
    );
  }
  return (
    <LinearGradient
      colors={EDITOR_ACCENT_GRADIENT}
      start={EDITOR_ACCENT_START}
      end={EDITOR_ACCENT_END}
      style={[{ padding, borderRadius: radius }, style]}
    >
      {inner}
    </LinearGradient>
  );
}

export function EditorGradientPill({ style, children, radius = 8 }) {
  return (
    <LinearGradient
      colors={EDITOR_ACCENT_GRADIENT}
      start={EDITOR_ACCENT_START}
      end={EDITOR_ACCENT_END}
      style={[{ borderRadius: radius, overflow: 'hidden' }, style]}
    >
      {children}
    </LinearGradient>
  );
}

export function EditorGradientBar({ style }) {
  return (
    <LinearGradient
      colors={EDITOR_ACCENT_GRADIENT}
      start={EDITOR_ACCENT_START}
      end={EDITOR_ACCENT_END}
      style={[{ height: 3, borderRadius: 2 }, style]}
    />
  );
}

export function EditorGradientDot({ size = 6, style }) {
  return (
    <LinearGradient
      colors={EDITOR_ACCENT_GRADIENT}
      start={EDITOR_ACCENT_START}
      end={EDITOR_ACCENT_END}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

export function EditorGradientIcon({ name, size = 17, style }) {
  return (
    <MaskedView
      style={[{ width: size, height: size }, style]}
      maskElement={<Ionicons name={name} size={size} color="#000" />}
    >
      <LinearGradient
        colors={EDITOR_ACCENT_GRADIENT}
        start={EDITOR_ACCENT_START}
        end={EDITOR_ACCENT_END}
        style={{ width: size, height: size }}
      />
    </MaskedView>
  );
}

export function EditorGradientLabel({ children, style, textProps }) {
  return (
    <MaskedView
      style={{ alignSelf: 'center' }}
      maskElement={
        <Text {...textProps} style={[style, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient colors={EDITOR_ACCENT_GRADIENT} start={EDITOR_ACCENT_START} end={EDITOR_ACCENT_END}>
        <Text {...textProps} style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

/** Active toolbar chip — gradient fill, light icon/text on top. */
export function EditorActiveToolWrap({ active, theme, style, children }) {
  if (!active) {
    return <View style={style}>{children}</View>;
  }
  return (
    <EditorGradientPill style={style} radius={8}>
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
