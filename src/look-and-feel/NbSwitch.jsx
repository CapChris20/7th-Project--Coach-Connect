// Neobrutalist switch toggle with brand gradient when on
// Flow: renders iOS-style switch with thick border and gradient fill
// Where used: settings, toggles, boolean controls
//
// vocab: switch = iOS-style toggle control for on/off states

import React from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { nb, gradients } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Neobrutalist switch with brand gradient when on.
 * 
 * @param {object} props
 * @param {boolean} props.value - on/off state
 * @param {Function} props.onValueChange - (boolean) => void
 * @param {object} [props.style] - additional container styles
 */
export default function NbSwitch({ value, onValueChange, style }) {
  const { colors } = useTheme();
  
  const translateX = React.useRef(new Animated.Value(value ? 1 : 0)).current;
  
  React.useEffect(() => {
    Animated.timing(translateX, {
      toValue: value ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value]);
  
  const thumbTranslate = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 24],
  });
  
  const handlePress = () => {
    onValueChange(!value);
  };
  
  const trackInner = value ? (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[
        styles.track,
        {
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: '#0A0A0F',
            borderColor: '#0A0A0F',
            transform: [{ translateX: thumbTranslate }],
          },
        ]}
      />
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.thumb,
          {
            backgroundColor: colors.nbInk,
            borderColor: colors.nbBorder,
            transform: [{ translateX: thumbTranslate }],
          },
        ]}
      />
    </View>
  );
  
  return (
    <Pressable onPress={handlePress} style={style}>
      {trackInner}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: 50,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
  },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
  },
});
