// Neobrutalist list row — standard list item with title, subtitle, right accessory
// Flow: pressable row for lists, settings, navigation items
// Where used: settings screens, menu lists, navigation lists
//
// vocab: list row = standard iOS-style list item with consistent layout

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Standard list row with title, subtitle, and right accessory.
 * 
 * @param {object} props
 * @param {string} props.title - main title
 * @param {string} [props.subtitle] - optional subtitle
 * @param {React.ReactNode} [props.right] - right accessory (icon, text, badge)
 * @param {Function} [props.onPress] - press handler
 * @param {object} [props.style] - additional container styles
 */
export default function NbListRow({ title, subtitle, right, onPress, style }) {
  const { colors } = useTheme();
  
  return (
    <Pressable onPress={onPress} style={style}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: colors.nbInk },
            ]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[
                styles.subtitle,
                { color: colors.nbMuted },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
        {right && <View style={styles.rightContainer}>{right}</View>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: nb.minTouchTarget,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: spacing.sm,
  },
});
