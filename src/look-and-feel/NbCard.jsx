// Neobrutalist card component with thick outline and hard shadow
// Flow: wraps content in a card surface with border and shadow → used across all screens
// Where used: everywhere content needs a card container
//
// vocab: neobrutalist = thick outlines (2.5px), hard shadows (no blur), offset 4/4

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Neobrutalist card with thick border and hard offset shadow.
 * @param {object} props
 * @param {React.ReactNode} props.children - card content
 * @param {object} [props.style] - additional styles
 * @param {boolean} [props.noShadow] - remove shadow (for nested or special cases)
 */
export default function NbCard({ children, style, noShadow = false }) {
  const { colors } = useTheme();

  // Hard shadow: on iOS we use shadowRadius 0, on Android we duplicate the view
  const offset = nb.shadowOffsetCard;

  const shadowStyle = Platform.select({
    ios: !noShadow
      ? {
          shadowColor: colors.nbShadow,
          shadowOffset: { width: offset, height: offset },
          shadowOpacity: 1,
          shadowRadius: 0,
        }
      : {},
    android: {},
  });

  // Android hard shadow: render a duplicate offset view behind
  if (Platform.OS === 'android' && !noShadow) {
    return (
      <View style={style}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.nbShadow,
              borderColor: colors.nbShadow,
            },
            StyleSheet.absoluteFill,
            { top: offset, left: offset },
          ]}
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
              padding: nb.cardPadding,
            },
          ]}
        >
          {children}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
          padding: nb.cardPadding,
        },
        shadowStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
});

export { NbCard };
