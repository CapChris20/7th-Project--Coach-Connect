// Design Law switch — solid fill when on, surface when off (no brand gradient).
// Flow: press → flip value → knob slides. Used by onboarding Health, Settings, filters.
//
// vocab: switch = on/off toggle; Design Law size is 56×34 with a 22 knob (DESIGN-SYSTEM.md)
// Manipulate here: TRACK_W / TRACK_H / KNOB / travel so press targets stay ≥44

import React from 'react';
import { View, Pressable, StyleSheet, Animated } from 'react-native';

import { nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// Manipulate here: match DESIGN-SYSTEM Switch row (56 × 34, knob 22)
const TRACK_W = 56;
const TRACK_H = 34;
const KNOB = 22;
const KNOB_PAD = 3;
const KNOB_TRAVEL = TRACK_W - KNOB - KNOB_PAD * 2 - nb.borderWidth * 2;

/**
 * Design Law switch (fill track when on).
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
  }, [value, translateX]);

  const thumbTranslate = translateX.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_PAD, KNOB_TRAVEL],
  });

  const handlePress = () => {
    onValueChange(!value);
  };

  // Design Law: on = solid fill track + onFill thumb (never green / brand gradient)
  return (
    <Pressable
      onPress={handlePress}
      style={[{ minWidth: 44, minHeight: 44, justifyContent: 'center' }, style]}
      accessibilityRole="switch"
      accessibilityState={{ checked: !!value }}
    >
      <View
        style={[
          styles.track,
          {
            backgroundColor: value ? colors.nbFill : colors.nbSurface,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              backgroundColor: value ? colors.nbOnFill : colors.nbInk,
              borderColor: colors.nbBorder,
              transform: [{ translateX: thumbTranslate }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
  },
  thumb: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    borderWidth: nb.borderWidth,
  },
});
