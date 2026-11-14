// Design Law quantity stepper — 44 ± buttons, big tabular number, optional unit.
// Flow: coerce value → press −/+ → bump by step → round float dust → clamp → onChange.
// Where used: onboarding years, food servings, session weight, any min/max quantity row.
//
// vocab: step = how much each tap adds/subtracts; tabular-nums keep digits from shifting width
// Manipulate here: BTN 44 + NUM 30/900 match DESIGN-SYSTEM.md Stepper row

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import HardShadow from './HardShadow';
import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: min touch 44; number size matches Design Law Stepper
const BUTTON_SIZE = 44;
const NUMBER_FONT_SIZE = 30;
const BUTTON_GLYPH_FONT_SIZE = 22;
const BUTTON_GLYPH_LINE_HEIGHT = 26;
const PRESSED_OPACITY = 0.88;
const VALUE_COLUMN_MIN_WIDTH = 56;
const UNIT_FONT_SIZE = 12;
const LABEL_FONT_SIZE = 12;
const LABEL_LETTER_SPACING = 1.1;
const ROW_GAP = 12;
const WRAP_GAP = 8;
const UNIT_TOP_MARGIN = 2;
const NUMBER_LETTER_SPACING = -0.5;
const FLOAT_DUST_SCALE = 1000;
const DECREASE_GLYPH = '−';
const INCREASE_GLYPH = '+';
const DECREASE_ACCESSIBILITY_LABEL = 'Decrease';
const INCREASE_ACCESSIBILITY_LABEL = 'Increase';

// ===== HELPER FUNCTIONS =====

/**
 * Keep a number inside optional min/max bounds.
 * Missing min or max means that side is open.
 */
function clampValueBetweenMinAndMax(value, min, max) {
  let next = value;
  if (typeof min === 'number') {
    next = Math.max(min, next);
  }
  if (typeof max === 'number') {
    next = Math.min(max, next);
  }
  return next;
}

/**
 * Decimal steps (0.5 lb) can leave float dust — round to thousandths before show/save.
 * Manipulate here: FLOAT_DUST_SCALE 1000 = three decimal places
 */
function roundAwayFloatDust(value) {
  return Math.round(value * FLOAT_DUST_SCALE) / FLOAT_DUST_SCALE;
}

/**
 * Parent value → finite number we can bump. Bad values fall back to min (or 0).
 */
function readSafeNumericValue(rawValue, fallbackMin) {
  const asNumber = Number(rawValue);
  if (Number.isFinite(asNumber)) {
    return asNumber;
  }
  return fallbackMin || 0;
}

/**
 * Pick the ± glyph from the accessibility label string.
 */
function glyphForStepperButton(accessibilityLabel) {
  if (accessibilityLabel === DECREASE_ACCESSIBILITY_LABEL) {
    return DECREASE_GLYPH;
  }
  return INCREASE_GLYPH;
}

/**
 * One hard-shadow ± button. Pressed opacity softens the face briefly.
 * vocab: HardShadow = Design Law offset slab behind the pressable
 */
function StepperRoundButton({
  accessibilityLabel,
  onPress,
  borderColor,
  backgroundColor,
  glyphColor,
}) {
  const glyph = glyphForStepperButton(accessibilityLabel);
  const faceChromeStyle = {
    borderColor,
    backgroundColor,
  };
  const glyphStyle = {
    color: glyphColor,
  };

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [
          styles.btn,
          faceChromeStyle,
          { opacity: pressed ? PRESSED_OPACITY : 1 },
        ]}
      >
        <Text style={[styles.btnGlyph, glyphStyle]}>{glyph}</Text>
      </Pressable>
    </HardShadow>
  );
}

/**
 * Big number + optional unit under it.
 */
function StepperValueColumn({ safeValue, unit, inkColor, mutedColor }) {
  const numberStyle = { color: inkColor };
  const unitStyle = { color: mutedColor };

  let unitLine = null;
  if (unit) {
    unitLine = <Text style={[styles.unit, unitStyle]}>{unit}</Text>;
  }

  return (
    <View style={styles.valueCol}>
      <Text style={[styles.num, numberStyle]}>{safeValue}</Text>
      {unitLine}
    </View>
  );
}

/**
 * Optional uppercase label above the ± row.
 */
function StepperFieldLabel({ label, mutedColor }) {
  if (!label) {
    return null;
  }
  const labelStyle = { color: mutedColor };
  return <Text style={[styles.label, labelStyle]}>{label}</Text>;
}

/**
 * Bump once in a direction, clean float dust, clamp, tell the parent.
 * vocab/symbol: ?. = call onChange only when it exists
 */
function changeValueByOneStep({
  safeValue,
  directionSign,
  step,
  min,
  max,
  onChange,
}) {
  const rawNext = safeValue + directionSign * step;
  const cleanedNext = roundAwayFloatDust(rawNext);
  const clampedNext = clampValueBetweenMinAndMax(cleanedNext, min, max);
  onChange?.(clampedNext);
}

/**
 * Chip fill shared by both ± buttons (Design Law surface chip, soft as fallback).
 */
function pickChipBackgroundColor(colors) {
  return colors.nbSurfaceChip || colors.nbSoft;
}

// ===== MAIN FUNCTION =====

/**
 * Quantity stepper with Design Law ± buttons and tabular number.
 *
 * @param {{
 *   value: number,
 *   onChange: (next: number) => void,
 *   step?: number,
 *   min?: number,
 *   max?: number,
 *   unit?: string,
 *   label?: string,
 *   style?: object,
 * }} props
 */
export default function NbStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  unit,
  label,
  style,
}) {
  const { colors } = useTheme();

  // 1. Coerce parent value to a finite number we can bump.
  const safeValue = readSafeNumericValue(value, min);

  // 2. Chip colors shared by both ± buttons.
  const chipBackground = pickChipBackgroundColor(colors);
  const borderColor = colors.nbBorder;
  const inkColor = colors.nbInk;
  const mutedColor = colors.nbMuted;

  // 3. One tap: move by one step in the chosen direction, clamp, then tell the parent.
  const pressDecrease = () => {
    changeValueByOneStep({
      safeValue,
      directionSign: -1,
      step,
      min,
      max,
      onChange,
    });
  };
  const pressIncrease = () => {
    changeValueByOneStep({
      safeValue,
      directionSign: 1,
      step,
      min,
      max,
      onChange,
    });
  };

  // 4. Paint optional label, − , number (+ unit), +.
  return (
    <View style={[styles.wrap, style]}>
      <StepperFieldLabel label={label} mutedColor={mutedColor} />
      <View style={styles.row}>
        <StepperRoundButton
          accessibilityLabel={DECREASE_ACCESSIBILITY_LABEL}
          onPress={pressDecrease}
          borderColor={borderColor}
          backgroundColor={chipBackground}
          glyphColor={inkColor}
        />
        <StepperValueColumn
          safeValue={safeValue}
          unit={unit}
          inkColor={inkColor}
          mutedColor={mutedColor}
        />
        <StepperRoundButton
          accessibilityLabel={INCREASE_ACCESSIBILITY_LABEL}
          onPress={pressIncrease}
          borderColor={borderColor}
          backgroundColor={chipBackground}
          glyphColor={inkColor}
        />
      </View>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  wrap: {
    gap: WRAP_GAP,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
    fontWeight: '800',
    letterSpacing: LABEL_LETTER_SPACING,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
  },
  btn: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGlyph: {
    fontSize: BUTTON_GLYPH_FONT_SIZE,
    fontWeight: '900',
    lineHeight: BUTTON_GLYPH_LINE_HEIGHT,
  },
  valueCol: {
    minWidth: VALUE_COLUMN_MIN_WIDTH,
    alignItems: 'center',
  },
  num: {
    fontSize: NUMBER_FONT_SIZE,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: NUMBER_LETTER_SPACING,
  },
  unit: {
    fontSize: UNIT_FONT_SIZE,
    fontWeight: '700',
    marginTop: UNIT_TOP_MARGIN,
  },
});
