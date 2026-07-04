/**
 * Blur Backdrop Plate
 *
 * Purpose: Blur Backdrop Plate — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: BlurBackdropPlate
 *
 * @file-header
 */
import React from 'react';
import {
  StyleSheet,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';

const PADDING_KEYS = [
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingHorizontal',
  'paddingVertical',
];

/** Pull padding off the outer shell so blur/backdrop fill edge-to-edge (padding only insets content). */
function splitShellPadding(flatStyle) {
  const shellStyle = { ...(flatStyle || {}) };
  const contentInset = {};
  for (const key of PADDING_KEYS) {
    if (shellStyle[key] != null) {
      contentInset[key] = shellStyle[key];
      delete shellStyle[key];
    }
  }
  return { shellStyle, contentInset };
}

/**
 * Use blur as a backdrop only. Do not nest {@link Image}, vector icons, MaskedView, or TextInput
 * inside {@link BlurView} — on iOS/Android (including Expo Go) they often fail to composite (blank,
 * flicker, or vanish until layout changes). Children render in a normal layer above the blur.
 *
 * Padding on `style` is moved to the inner content wrapper so the blur layer reaches the physical
 * top/bottom edges (CoachConnectHeader status-bar zone, BottomNavBar home-indicator zone).
 */
export default function BlurBackdropPlate({ intensity, tint, style, contentWrapperStyle, children }) {
  const flat = StyleSheet.flatten(style) || {};
  const { shellStyle, contentInset } = splitShellPadding(flat);
  const { backgroundColor, ...restShell } = shellStyle;

  return (
    <View style={[restShell, { position: 'relative', overflow: 'hidden' }]}>
      <BlurView intensity={intensity} tint={tint} pointerEvents="none" style={StyleSheet.absoluteFillObject} />
      {backgroundColor ? (
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor }]}
          pointerEvents="none"
        />
      ) : null}
      <View
        style={[{ position: 'relative', zIndex: 1 }, contentInset, contentWrapperStyle]}
        collapsable={false}
      >
        {children}
      </View>
    </View>
  );
}
