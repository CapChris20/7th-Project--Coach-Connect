import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Liquid } from './liquidTokens';

export default function LiquidGradientButton({
  title,
  onPress,
  disabled,
  style,
  left,
  right,
  radius = Liquid.radius.inner,
  colors = Liquid.gradients.primary,
  overlayOpacity = 0,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.hit,
        { opacity: disabled ? 0.45 : pressed ? 0.92 : 1 },
        style,
      ]}
      accessibilityRole="button"
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.grad,
          { borderRadius: radius, ...(Platform.OS === 'ios' ? { borderCurve: 'continuous' } : null) },
        ]}
      >
        {overlayOpacity > 0 && <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: `rgba(0,0,0,${overlayOpacity})` }]} />}
        <View style={styles.row}>
          <View style={styles.iconSlot}>{left}</View>
          <Text style={styles.text} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.iconSlot}>{right}</View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    minWidth: 44,
  },
  grad: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconSlot: {
    width: 36,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.2,
    fontSize: 16,
  },
});


