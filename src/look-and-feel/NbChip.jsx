// Neobrutalist chip — HardShadow outline; selected = solid fill + onFill (Design Law, not gradient).
// Flow: variant + selected → surface colors → label OR custom children → optional HardShadow + Pressable.
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

// ===== NAMED CONSTANTS =====

const CHIP_LABEL_GAP = 6;
const DISABLED_OPACITY = 0.45;
const PRESSED_OPACITY = 0.92;
const VARIANT_DASHED = 'dashed';
const VARIANT_OUTLINE = 'outline';

// ===== HELPER FUNCTIONS =====

function readChipVariantFlags(variant) {
  const isDashedVariant = variant === VARIANT_DASHED;
  const isOutlineVariant = variant === VARIANT_OUTLINE;
  return { isDashedVariant, isOutlineVariant };
}

/**
 * Design Law: selected chip = fill + onFill (solid), never a purple/brand gradient.
 * Dashed + outline stay on surface even when selected (status / location tags).
 */
function pickChipSurfaceColors(selected, isDashedVariant, isOutlineVariant, colors) {
  const useSolidFill = selected && !isDashedVariant && !isOutlineVariant;
  if (useSolidFill) {
    return {
      useSolidFill: true,
      chipBackgroundColor: colors.nbFill,
      labelColor: colors.nbOnFill,
    };
  }
  return {
    useSolidFill: false,
    chipBackgroundColor: colors.nbSurface,
    labelColor: colors.nbInk,
  };
}

function childrenArePlainText(children) {
  return typeof children === 'string' || typeof children === 'number';
}

/**
 * Plain string/number → Text with optional strike. Custom nodes (day+date stacks) pass through.
 */
function buildChipLabelNode(children, labelColor, strike) {
  const plainText = childrenArePlainText(children);
  if (!plainText) {
    return children;
  }

  const strikeStyle = strike ? styles.strike : null;
  return (
    <Text
      style={[styles.text, { color: labelColor }, strikeStyle]}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

function pressedFeedbackStyle(pressed, onPress, disabled) {
  const userIsPressing = pressed && onPress && !disabled;
  if (!userIsPressing) {
    return null;
  }
  return styles.pressed;
}

/**
 * Inner bordered pill: label (or custom children) + optional checkmark when solid-selected.
 */
function ChipInnerBody({
  colors,
  isDashedVariant,
  chipBackgroundColor,
  labelColor,
  contentStyle,
  children,
  useSolidFill,
  strike,
}) {
  const labelNode = buildChipLabelNode(children, labelColor, strike);
  const showCheckmark = useSolidFill && childrenArePlainText(children);

  const borderStyleName = isDashedVariant ? 'dashed' : 'solid';
  const chipChromeStyle = {
    borderColor: colors.nbBorder,
    backgroundColor: chipBackgroundColor,
    borderStyle: borderStyleName,
    flexDirection: 'row',
    gap: CHIP_LABEL_GAP,
  };

  let checkmarkNode = null;
  if (showCheckmark) {
    checkmarkNode = (
      <Text style={[styles.check, { color: labelColor }]}>✓</Text>
    );
  }

  return (
    <View style={[styles.chip, chipChromeStyle, contentStyle]}>
      {labelNode}
      {checkmarkNode}
    </View>
  );
}

/**
 * Shared Pressable wiring for flat and lifted chips.
 * outerStyle goes on Pressable for flat chips; lifted chips put layout style on HardShadow instead.
 */
function ChipPressableShell({
  onPress,
  disabled,
  selected,
  pressableIsDisabled,
  pressableAccessibilityRole,
  outerStyle,
  chipBody,
}) {
  function pressableStyleBag({ pressed }) {
    const disabledStyle = disabled ? styles.disabled : null;
    const pressedStyle = pressedFeedbackStyle(pressed, onPress, disabled);
    return [outerStyle, disabledStyle, pressedStyle];
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={pressableIsDisabled}
      accessibilityRole={pressableAccessibilityRole}
      accessibilityState={{ selected, disabled }}
      style={pressableStyleBag}
    >
      {chipBody}
    </Pressable>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Filter / status / option chip with optional HardShadow lift.
 *
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

  // 1. Resolve variant flags + surface colors (selected fill vs surface).
  const { isDashedVariant, isOutlineVariant } = readChipVariantFlags(variant);
  const { useSolidFill, chipBackgroundColor, labelColor } = pickChipSurfaceColors(
    selected,
    isDashedVariant,
    isOutlineVariant,
    colors,
  );

  // 2. Build the inner pill once; flat vs lifted only change the outer wrapper.
  const chipBody = (
    <ChipInnerBody
      colors={colors}
      isDashedVariant={isDashedVariant}
      chipBackgroundColor={chipBackgroundColor}
      labelColor={labelColor}
      contentStyle={contentStyle}
      useSolidFill={useSolidFill}
      strike={strike}
    >
      {children}
    </ChipInnerBody>
  );

  // Selected (or pressable) chips lift with HardShadow; flat status tags stay flush.
  const shouldWrapWithHardShadow = useSolidFill || Boolean(onPress);
  const pressableAccessibilityRole = onPress ? 'button' : 'text';
  const pressableIsDisabled = disabled || !onPress;

  // 3. Flat chip: parent style on Pressable (no shadow lift).
  if (!shouldWrapWithHardShadow) {
    return (
      <ChipPressableShell
        onPress={onPress}
        disabled={disabled}
        selected={selected}
        pressableIsDisabled={pressableIsDisabled}
        pressableAccessibilityRole={pressableAccessibilityRole}
        outerStyle={style}
        chipBody={chipBody}
      />
    );
  }

  // 4. Lifted chip: HardShadow owns outer layout style; Pressable only handles press feedback inside.
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip} style={style}>
      <ChipPressableShell
        onPress={onPress}
        disabled={disabled}
        selected={selected}
        pressableIsDisabled={pressableIsDisabled}
        pressableAccessibilityRole={pressableAccessibilityRole}
        outerStyle={null}
        chipBody={chipBody}
      />
    </HardShadow>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
  check: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontWeight: '900',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  disabled: { opacity: DISABLED_OPACITY },
  pressed: { opacity: PRESSED_OPACITY },
});
