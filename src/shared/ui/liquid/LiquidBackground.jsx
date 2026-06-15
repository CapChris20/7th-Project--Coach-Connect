/**
 * Liquid Background
 *
 * Purpose: Liquid Background — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: LiquidBackground
 *
 * @file-header
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Liquid } from './liquidTokens';

/**
 * Deep obsidian base with 3 mesh-like radial blurs in the corners.
 * Lightweight (single SVG) + works on iOS/Android/Web.
 */
export default function LiquidBackground({ children }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <RadialGradient id="indigo" cx="0%" cy="0%" r="70%">
            <Stop offset="0%" stopColor="#2E5BFF" stopOpacity="0.42" />
            <Stop offset="55%" stopColor="#2E5BFF" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#2E5BFF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="violet" cx="100%" cy="0%" r="75%">
            <Stop offset="0%" stopColor="#6D28D9" stopOpacity="0.40" />
            <Stop offset="60%" stopColor="#6D28D9" stopOpacity="0.12" />
            <Stop offset="100%" stopColor="#6D28D9" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="slate" cx="100%" cy="100%" r="80%">
            <Stop offset="0%" stopColor="#64748B" stopOpacity="0.28" />
            <Stop offset="60%" stopColor="#64748B" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#64748B" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill={Liquid.colors.obsidian} />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#indigo)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#violet)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#slate)" />
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Liquid.colors.obsidian,
  },
});








