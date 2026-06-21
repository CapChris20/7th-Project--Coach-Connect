import React from 'react';
import { Text, StyleSheet } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Gradient text via MaskedView — RN has no CSS background-clip.
 */
export default function GradientText({ colors: gradientColors, style, children, start, end }) {
  const gradientStart = start ?? { x: 0, y: 0 };
  const gradientEnd = end ?? { x: 1, y: 1 };

  return (
    <MaskedView
      maskElement={
        <Text style={[style, styles.maskText]} numberOfLines={style?.numberOfLines}>
          {children}
        </Text>
      }
    >
      <LinearGradient colors={gradientColors} start={gradientStart} end={gradientEnd}>
        <Text style={[style, styles.hiddenText]} numberOfLines={style?.numberOfLines}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
}

const styles = StyleSheet.create({
  maskText: {
    backgroundColor: 'transparent',
  },
  hiddenText: {
    opacity: 0,
  },
});
