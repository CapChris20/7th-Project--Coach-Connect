// Neobrutalist button: fill (black/white), ink alias, plain/ghost (surface).
// Flow: pressable → hard shadow → solid fill or ghost → label. Handoff: no big gradient buttons.
// Where used: CTAs, form actions, navigation across all screens
//
// vocab: fill = nbFill primary block; ghost = surface with border
// Manipulate here: press animation timing (150ms), shadow offset (4), border width (3)

import React, { useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, Platform, View } from 'react-native';

import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Handoff button: fill / ink (=fill) / plain (ghost).
 * Press animation: translate 3,3 and collapse shadow to 0.
 *
 * @param {object} props
 * @param {string} props.variant - 'brand' | 'ink' | 'plain' | 'fill' | 'ghost'
 * @param {string} props.children - button text (single line)
 * @param {Function} [props.onPress]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.sm]
 * @param {object} [props.style]
 */
export default function NbButton({ variant = 'brand', children, onPress, disabled = false, sm = false, style }) {
  const { colors } = useTheme();

  const translateAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.timing(translateAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

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

  const shadowTranslateX = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [nb.shadowOffset, 0],
  });

  const shadowTranslateY = translateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [nb.shadowOffset, 0],
  });

  const isGhost = variant === 'plain' || variant === 'ghost';
  const fillBg = isGhost ? colors.nbSurface : colors.nbFill;
  const textColor = isGhost ? colors.nbInk : colors.nbOnFill;

  const height = sm ? nb.minTouchTarget : nb.buttonMinHeight;
  const fontSize = sm ? 13 : 16;

  const buttonInner = (
    <View
      style={[
        styles.button,
        {
          height,
          borderColor: colors.nbBorder,
          backgroundColor: fillBg,
        },
      ]}
    >
      <Text style={[styles.text, { color: textColor, fontSize }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
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
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    paddingHorizontal: nb.chipPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '900',
    letterSpacing: -0.2,
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

export { NbButton };
