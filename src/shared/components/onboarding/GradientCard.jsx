import React from 'react';
import { TouchableOpacity, View, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const SIZE_MAP = {
  small: 80,
  medium: 120,
  large: 160,
};

export default function GradientCard({
  colors,
  selected = false,
  onPress,
  disabled = false,
  multiSelect = false,
  size = 'medium',
  children,
  style,
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (disabled) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled || !onPress) return;
    onPress();
  };

  // Darken gradient colors by 10% when selected
  const getSelectedColors = () => {
    if (!selected) return colors;
    return colors.map(color => {
      // Extract RGB values and darken by 10%
      const hex = color.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      
      const darken = (value) => Math.max(0, Math.floor(value * 0.9));
      
      return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
    });
  };

  const cardColors = getSelectedColors();
  const cardHeight = SIZE_MAP[size] || SIZE_MAP.medium;

  const content = (
    <Animated.View style={[animatedStyle, { height: cardHeight }]}>
      <LinearGradient
        colors={cardColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.gradient, style, disabled && styles.disabled]}
      >
        {children}
        {selected && multiSelect && (
          <View style={styles.checkmarkContainer}>
            <View style={styles.checkmark}>
              <View style={styles.checkmarkLine1} />
              <View style={styles.checkmarkLine2} />
            </View>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );

  if (!onPress || disabled) {
    return content;
  }

  return (
    <AnimatedTouchableOpacity
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
      disabled={disabled}
    >
      {content}
    </AnimatedTouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gradient: {
    borderRadius: 16,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    width: 12,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkLine1: {
    position: 'absolute',
    width: 2,
    height: 6,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '45deg' }],
    bottom: 2,
    left: 4,
  },
  checkmarkLine2: {
    position: 'absolute',
    width: 2,
    height: 10,
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-45deg' }],
    bottom: 0,
    right: 4,
  },
});

