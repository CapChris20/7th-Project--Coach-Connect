// Neobrutalist chip — HardShadow outline, fill or brand gradient when selected.
// Flow: press → optional selected gradient → label (string) or custom children (date stacks).
// Where used: filters, date pickers, time grids, option lists, tags.
//
// vocab: neobrutalist = thick border, hard offset shadow, gradient only when active
// Fix: do NOT wrap React-element children in <Text> — that blanks View-based date stacks

import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import HardShadow from './HardShadow';
import { borderRadius, nb, gradients } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - string label OR custom node (e.g. day+date stack)
 * @param {boolean} [props.selected]
 * @param {Function} [props.onPress]
 * @param {boolean} [props.disabled]
 * @param {object} [props.style] - outer HardShadow / width helpers (e.g. time grid 31%)
 * @param {object} [props.contentStyle] - inner chip padding / minHeight overrides
 */
export default function NbChip({
  children,
  selected = false,
  onPress,
  disabled = false,
  style,
  contentStyle,
}) {
  const { colors } = useTheme();
  // Design Law: text on brand gradient is nbInk, not white
  const textColor = selected ? colors.nbInk : colors.nbInk;
  const isPlainLabel = typeof children === 'string' || typeof children === 'number';

  const label = isPlainLabel ? (
    <Text style={[styles.text, { color: textColor }]} numberOfLines={1}>
      {children}
    </Text>
  ) : (
    children
  );

  const chipBody = selected ? (
    <LinearGradient
      colors={gradients.brand.colors}
      start={gradients.brand.start}
      end={gradients.brand.end}
      style={[
        styles.chip,
        { borderColor: colors.nbBorder },
        contentStyle,
      ]}
    >
      {label}
    </LinearGradient>
  ) : (
    <View
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
        },
        contentStyle,
      ]}
    >
      {label}
    </View>
  );

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip} style={style}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ selected, disabled }}
        style={({ pressed }) => [
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        {chipBody}
      </Pressable>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 12,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.92 },
});
