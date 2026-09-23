// Accent primitives for the document/spreadsheet editor chrome (borders, pills, dots, labels).
// Flow: constants define the neutral white accent → the small components below wrap children in
// that accent so toolbars and inputs stay visually identical everywhere.
// Naming note: these are called "gradient" for historical reasons — the editor was redesigned to a
// flat neutral accent, so they're now solid colors. The names stayed to avoid touching every caller.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Neutral editor accent — no cyan/orange gradients. */
// Manipulate here: one accent expressed at four opacities. This is the whole editor accent system,
// so changing these four lines re-skins every toolbar, focused border, and status dot.
//   ACCENT        = full-strength text/icons
//   ACCENT_MUTED  = secondary icons and inactive labels
//   ACCENT_SOFT   = the fill behind an ACTIVE toolbar chip
//   ACCENT_BORDER = a focused input's outline
export const EDITOR_ACCENT = '#FFFFFF';
export const EDITOR_ACCENT_MUTED = 'rgba(255,255,255,0.55)';
export const EDITOR_ACCENT_SOFT = 'rgba(255,255,255,0.12)';
export const EDITOR_ACCENT_BORDER = 'rgba(255,255,255,0.32)';
/** @deprecated Use theme.accentBorder — kept for callers that still read [0]. */
// Both stops are the same color, so it renders flat. It stays an array purely so old call sites
// that do `gradient[0]` or feed a gradient component don't crash.
export const EDITOR_ACCENT_GRADIENT = [EDITOR_ACCENT, EDITOR_ACCENT];
// Gradient direction vectors in 0–1 space: (0,0)→(1,0) is left-to-right. Kept for the same
// backwards-compatibility reason as the array above.
export const EDITOR_ACCENT_START = { x: 0, y: 0 };
export const EDITOR_ACCENT_END = { x: 1, y: 0 };

// A two-layer bordered container: outer View draws the border, inner View holds the background and
// clips the children. Two layers are needed because a single View can't have its background clipped
// inside a border of a different radius without the corners showing through.
export function EditorGradientBorder({
  active,
  children,
  style,
  innerStyle,
  bgColor,
  borderColor,
  // Manipulate here: the focused-state look. activeBorderColor is the highlight, `padding` is how
  // much the inner radius shrinks when active, `radius` is the overall corner rounding.
  activeBorderColor = EDITOR_ACCENT_BORDER,
  padding = 1.5,
  radius = 12,
}) {
  return (
    <View
      style={[
        {
          // Focused controls get a thicker, brighter outline — that thickness change is what makes
          // focus obvious without needing a glow or shadow.
          borderWidth: active ? 1.5 : 1,
          borderColor: active ? activeBorderColor : borderColor,
          borderRadius: radius,
        },
        style,
      ]}
    >
      <View
        style={[
          // Only set a background when one was given, so this wrapper can also be used purely for
          // its border over an existing background.
          bgColor != null ? { backgroundColor: bgColor } : null,
          innerStyle,
          // The inner radius is reduced by the border thickness so the two curves stay concentric —
          // without this the inner corners look square inside the rounded border. Math.max(0, …)
          // guards against a negative radius when radius is very small.
          { borderRadius: Math.max(0, radius - (active ? padding : 0)), overflow: 'hidden' },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

// Rounded chip background, used behind active toolbar buttons and small status badges.
// overflow hidden so any child (icon, text) is clipped to the rounded shape.
export function EditorGradientPill({ style, children, radius = 8, backgroundColor = EDITOR_ACCENT_SOFT }) {
  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', backgroundColor }, style]}>
      {children}
    </View>
  );
}

// Thin horizontal rule / underline indicator.
// Manipulate here: height 3 with radius 2 gives a soft capsule bar rather than a hard line.
export function EditorGradientBar({ style, backgroundColor = EDITOR_ACCENT_BORDER }) {
  return <View style={[{ height: 3, borderRadius: 2, backgroundColor }, style]} />;
}

// Small status dot. borderRadius is size/2 so it stays a perfect circle at ANY size — that's why
// the radius is computed rather than hardcoded.
export function EditorGradientDot({ size = 6, style, color = EDITOR_ACCENT_MUTED }) {
  return <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

// Icon pre-tinted with the muted accent, so toolbars don't repeat the color on every icon.
// Manipulate here: 17 is the default toolbar icon size.
export function EditorGradientIcon({ name, size = 17, style, color = EDITOR_ACCENT_MUTED }) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}

// Accent-colored text. `textProps` is spread FIRST and `color` applied last, so the accent always
// wins over anything the caller passed — that's what keeps labels consistent.
export function EditorGradientLabel({ children, style, textProps, color = EDITOR_ACCENT }) {
  return (
    <Text {...textProps} style={[style, { color }]}>
      {children}
    </Text>
  );
}

/** Active toolbar chip — subtle fill, light icon/text on top. */
// The inactive path returns a bare View rather than a transparent pill: fewer layers for the many
// toolbar buttons that are idle at any moment, which keeps the toolbar cheap to re-render.
export function EditorActiveToolWrap({ active, theme, style, children }) {
  if (!active) {
    return <View style={style}>{children}</View>;
  }
  return (
    // Prefer the current theme's soft accent (so light mode gets a dark tint instead of a white
    // one), falling back to the dark-mode constant when no theme was passed.
    <EditorGradientPill style={style} radius={8} backgroundColor={theme?.accentSoft || EDITOR_ACCENT_SOFT}>
      <View style={activeToolStyles.inner}>{children}</View>
    </EditorGradientPill>
  );
}

const activeToolStyles = StyleSheet.create({
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    // Manipulate here: 36×36 minimum keeps toolbar buttons comfortably tappable even when the icon
    // inside is small. Don't drop below ~36 or the toolbar becomes fiddly on a phone.
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
});
