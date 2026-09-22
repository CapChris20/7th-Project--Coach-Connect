import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export function GradientBorder({
  colors,
  borderWidth = 1.5,
  radius = 20,
  style,
  innerStyle,
  innerBackground,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  children,
}) {
  return (
    <LinearGradient
      colors={colors}
      start={start}
      end={end}
      style={[{ borderRadius: radius, padding: borderWidth }, style]}
    >
      <View
        style={[
          styles.inner,
          { borderRadius: radius - borderWidth, backgroundColor: innerBackground },
          innerStyle,
        ]}
      >
        {children}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  inner: {
    overflow: 'hidden',
  },
});
