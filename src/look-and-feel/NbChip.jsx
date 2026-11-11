// Neobrutalist chip component — single-select or multi-select chips
// Flow: pressable chip with border, optional gradient fill when selected
// Where used: filters, date pickers, option lists, tags
//
// vocab: neobrutalist = thick border, hard shadow, gradient when active

import React, { useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, Platform, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Single chip with optional gradient when selected.
 * Press animation: translate 2,2 and collapse shadow.
 * 
 * @param {object} props
 * @param {string} props.children - chip text (single line)
 * @param {boolean} [props.selected] - selected state (applies brand gradient)
 * @param {Function} [props.onPress] - press handler
 * @param {boolean} [props.disabled] - disabled state
 * @param {object} [props.style] - additional container styles
 */
export default function NbChip({ children, selected = false, onPress, disabled = false, style }) {
  const { colors } = useTheme();
  
  const translateAnim = useRef(new Animated.Value(0)).current;
  
  const handlePressIn = () => {
    Animated.timing(translateAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };
  
  const handlePressOut = () => {
    Animated.timing(translateAnim, {
      toValue: 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };
  
  const translateX = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });
  
  const translateY = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 2],
  });
  
  const shadowTranslateX = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 0],
  });
  
  const shadowTranslateY = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 0],
  });
  
  // Text color: black on gradient, theme ink on plain
  const textColor = selected ? '#0A0A0F' : colors.nbInk;
  
  const chipContent = (
    <View
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: selected ? undefined : colors.nbSurfaceChip,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
  
  const chipInner = selected ? (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </LinearGradient>
  ) : (
    chipContent
  );
  
  // Android hard shadow
  const renderAndroidChip = () => {
    return (
      <View style={style}>
        <Animated.View
          style={[
            styles.shadowView,
            {
              backgroundColor: colors.nbShadow,
              borderColor: colors.nbShadow,
            },
            {
              transform: [
                { translateX: shadowTranslateX },
                { translateY: shadowTranslateY },
              ],
            },
          ]}
        />
        <Animated.View
          style={{
            transform: [
              { translateX },
              { translateY },
            ],
          }}
        >
          {chipInner}
        </Animated.View>
      </View>
    );
  };
  
  // iOS shadow
  const iosShadowStyle = {
    shadowColor: colors.nbShadow,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  };
  
  const renderIOSChip = () => {
    return (
      <Animated.View
        style={[
          iosShadowStyle,
          {
            transform: [
              { translateX },
              { translateY },
            ],
          },
          style,
        ]}
      >
        {chipInner}
      </Animated.View>
    );
  };
  
  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.container,
        disabled && styles.disabled,
      ]}
    >
      {Platform.OS === 'android' ? renderAndroidChip() : renderIOSChip()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // Pressable is just the hit area
  },
  chip: {
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    paddingHorizontal: nb.chipPadding,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.45,
  },
  shadowView: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    height: 36,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
});
