// Neobrutalist option row — icon, title, subtitle, optional checkbox
// Flow: pressable row with thick border, optional gradient when selected
// Where used: onboarding, settings, lists with selectable options
//
// vocab: option row = tappable list item with icon, text, and selection state

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { borderRadius, nb, gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * Option row with icon, title, subtitle, and optional checkbox.
 * When selected, applies soft gradient background.
 * 
 * @param {object} props
 * @param {React.ReactNode} [props.icon] - icon component
 * @param {string} props.title - main title
 * @param {string} [props.subtitle] - optional subtitle
 * @param {boolean} [props.selected] - selected state (applies soft gradient)
 * @param {boolean} [props.showCheckbox] - show checkbox indicator
 * @param {Function} [props.onPress] - press handler
 * @param {object} [props.style] - additional container styles
 */
export default function NbOptionRow({ icon, title, subtitle, selected = false, showCheckbox = false, onPress, style }) {
  const { colors } = useTheme();
  
  const rowContent = (
    <>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
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
      {showCheckbox && (
        <View
          style={[
            styles.checkbox,
            {
              borderColor: colors.nbBorder,
              backgroundColor: selected ? undefined : 'transparent',
            },
          ]}
        >
          {selected && (
            <LinearGradient
              colors={gradients.ink.colors}
              start={gradients.ink.start}
              end={gradients.ink.end}
              style={styles.checkboxFill}
            >
              <Text style={styles.checkmark}>✓</Text>
            </LinearGradient>
          )}
        </View>
      )}
    </>
  );
  
  const rowInner = selected && !showCheckbox ? (
    <LinearGradient
      colors={gradients.soft.colors}
      start={gradients.soft.start}
      end={gradients.soft.end}
      style={[
        styles.row,
        {
          borderColor: colors.nbBorder,
        },
      ]}
    >
      {rowContent}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      {rowContent}
    </View>
  );
  
  return (
    <Pressable onPress={onPress} style={style}>
      {rowInner}
    </Pressable>
  );
}

/**
 * Grid layout for option rows (2 columns).
 * 
 * @param {object} props
 * @param {Array<{id: string, icon: React.ReactNode, title: string}>} props.items - option data
 * @param {string} props.selected - selected item id
 * @param {Function} props.onSelect - (id) => void
 * @param {object} [props.style] - additional container styles
 */
export function NbOptionGrid({ items, selected, onSelect, style }) {
  return (
    <View style={[styles.grid, style]}>
      {items.map((item) => (
        <View key={item.id} style={styles.gridItem}>
          <NbOptionRow
            icon={item.icon}
            title={item.title}
            selected={selected === item.id}
            onPress={() => onSelect(item.id)}
          />
        </View>
      ))}
    </View>
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
  iconContainer: {
    marginRight: spacing.sm + 4,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  checkboxFill: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  gridItem: {
    width: '50%',
    padding: 4,
  },
});
