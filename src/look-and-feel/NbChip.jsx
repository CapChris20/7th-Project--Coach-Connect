// Neobrutalist chip — HardShadow outline; selected = solid fill + onFill (Design Law, not gradient).
// Flow: press → selected fill OR dashed/outline variant → label (string) or custom children (date stacks).
// Where used: filters, date pickers, time grids, option lists, status tags.
//
// vocab: neobrutalist = thick border, hard offset shadow; fill = nbFill/nbOnFill (never brand gradient on chips)
// Fix: do NOT wrap React-element children in <Text> — that blanks View-based date stacks
// Manipulate here: dashed = pending status; outline = location tags; selected = black/white fill

import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';

import HardShadow from './HardShadow';
import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

/**
 * @param {object} props
 * @param {React.ReactNode} props.children - string label OR custom node (e.g. day+date stack)
 * @param {boolean} [props.selected]
 * @param {Function} [props.onPress]
 * @param {boolean} [props.disabled]
 * @param {'default'|'dashed'|'outline'} [props.variant] - dashed = Pending; outline = In person / Video
 * @param {boolean} [props.strike] - Declined: strikethrough label
 * @param {object} [props.style] - outer HardShadow / width helpers (e.g. time grid 31%)
 * @param {object} [props.contentStyle] - inner chip padding / minHeight overrides
 */
export default function NbChip({
  children,
  selected = false,
  onPress,
  disabled = false,
  variant = 'default',
  strike = false,
  style,
  contentStyle,
}) {
  const { colors } = useTheme();
  const isDashed = variant === 'dashed';
  const isOutline = variant === 'outline';
  // Design Law: selected chip = fill + onFill (solid), never a purple/brand gradient
  const filled = selected && !isDashed && !isOutline;
  const bg = filled ? colors.nbFill : colors.nbSurface;
  const textColor = filled ? colors.nbOnFill : colors.nbInk;
  const isPlainLabel = typeof children === 'string' || typeof children === 'number';

  const label = isPlainLabel ? (
    <Text
      style={[
        styles.text,
        { color: textColor },
        strike && styles.strike,
      ]}
      numberOfLines={1}
    >
      {children}
    </Text>
  ) : (
    children
  );

  const chipBody = (
    <View
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: bg,
          borderStyle: isDashed ? 'dashed' : 'solid',
        },
        contentStyle,
      ]}
    >
      {label}
    </View>
  );

  // Selected (or pressable) chips lift with HardShadow; flat status tags stay flush
  const useShadow = filled || Boolean(onPress);

  const pressable = (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        style,
        disabled && styles.disabled,
        pressed && onPress && !disabled && styles.pressed,
      ]}
    >
      {chipBody}
    </Pressable>
  );

  if (!useShadow) return pressable;

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip} style={style}>
      <Pressable
        onPress={onPress}
        disabled={disabled || !onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityState={{ selected, disabled }}
        style={({ pressed }) => [
          disabled && styles.disabled,
          pressed && onPress && !disabled && styles.pressed,
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
  strike: {
    textDecorationLine: 'line-through',
  },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.92 },
});
