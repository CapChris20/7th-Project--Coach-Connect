// Neobrutalist button with three variants: brand (gradient), ink (gradient), plain (outlined)
// Flow: displays pressable button with thick border, hard shadow, press animation (translate + shadow collapse)
// Where used: CTAs, form actions, navigation across all screens
//
// vocab: neobrutalist = thick outlines, hard shadows, gradient fills
// Manipulate here: press animation timing (150ms), shadow offset (4), border width (2.5)

import React, { useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, Platform, View } from 'react-native';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lightColors, darkColors, borderRadius, nb, gradients } from './colorPalette';

/**
 * Neobrutalist button with gradient or outlined variants.
 * Press animation: translate 3,3 and collapse shadow to 0.
 * 
 * @param {object} props
 * @param {string} props.variant - 'brand' | 'ink' | 'plain'
 * @param {string} props.children - button text (single line)
 * @param {Function} [props.onPress] - press handler
 * @param {boolean} [props.disabled] - disabled state (45% opacity, keeps outline visible)
 * @param {boolean} [props.sm] - small size variant
 * @param {object} [props.style] - additional container styles
 */
export default function NbButton({ variant = 'brand', children, onPress, disabled = false, sm = false, style }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  const translateAnim = useRef(new Animated.Value(0)).current;
  
  // Press in: translate 3,3 (shadow collapses)
  const handlePressIn = () => {
    Animated.timing(translateAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };
  
  // Press out: translate back to 0,0
  const handlePressOut = () => {
    Animated.timing(translateAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };
  
  const translateX = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });
  
  const translateY = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 3],
  });
  
  // Shadow offset shrinks on press
  const shadowTranslateX = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [nb.shadowOffset, 0],
  });
  
  const shadowTranslateY = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [nb.shadowOffset, 0],
  });
  
  // Text color by variant
  let textColor = '#0A0A0F'; // brand and plain → black text
  if (variant === 'ink') {
    textColor = '#FFFFFF'; // ink → white text
  } else if (variant === 'plain') {
    textColor = colors.nbInk;
  }
  
  // Height by size
  const height = sm ? 36 : nb.minTouchTarget;
  const fontSize = sm ? 14 : 15;
  
  // Gradient or solid background
  const gradient = variant === 'brand' ? gradients.brand : variant === 'ink' ? gradients.ink : null;
  
  // Plain variant is outlined, no gradient
  const plainBackground = variant === 'plain' ? colors.nbSurface : null;
  
  const buttonContent = (
    <View
      style={[
        styles.button,
        {
          height,
          borderColor: colors.nbBorder,
          backgroundColor: plainBackground,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor, fontSize },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </View>
  );
  
  const buttonInner = gradient ? (
    <LinearGradient
      colors={gradient.colors}
      start={gradient.start}
      end={gradient.end}
      style={[
        styles.button,
        {
          height,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: textColor, fontSize },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </LinearGradient>
  ) : (
    buttonContent
  );
  
  // Android hard shadow: render a duplicate offset view behind
  const renderAndroidButton = () => {
    return (
      <View style={style}>
        <Animated.View
          style={[
            styles.shadowView,
            {
              height,
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
          {buttonInner}
        </Animated.View>
      </View>
    );
  };
  
  // iOS uses shadowRadius 0
  const iosShadowStyle = {
    shadowColor: colors.nbShadow,
    shadowOffset: { width: nb.shadowOffset, height: nb.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
  };
  
  const renderIOSButton = () => {
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
        {buttonInner}
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
      {Platform.OS === 'android' ? renderAndroidButton() : renderIOSButton()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    // Pressable is just the hit area
  },
  button: {
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    paddingHorizontal: nb.chipPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  disabled: {
    opacity: 0.45,
  },
  shadowView: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
});
