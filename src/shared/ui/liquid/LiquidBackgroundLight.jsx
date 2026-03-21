import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

/**
 * Light-mode mesh background: soft paper base with subtle pastel corner blurs.
 * Designed to sit behind frosted-glass materials.
 */
export default function LiquidBackgroundLight({ children }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          <RadialGradient id="cyan" cx="0%" cy="0%" r="70%">
            <Stop offset="0%" stopColor="#4DD2FF" stopOpacity="0.28" />
            <Stop offset="60%" stopColor="#4DD2FF" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#4DD2FF" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="violet" cx="100%" cy="0%" r="75%">
            <Stop offset="0%" stopColor="#A78BFA" stopOpacity="0.26" />
            <Stop offset="62%" stopColor="#A78BFA" stopOpacity="0.10" />
            <Stop offset="100%" stopColor="#A78BFA" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="pink" cx="100%" cy="100%" r="80%">
            <Stop offset="0%" stopColor="#FF5BD6" stopOpacity="0.18" />
            <Stop offset="62%" stopColor="#FF5BD6" stopOpacity="0.08" />
            <Stop offset="100%" stopColor="#FF5BD6" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill="#F6F7FB" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cyan)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#violet)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#pink)" />
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F6F7FB',
  },
});






