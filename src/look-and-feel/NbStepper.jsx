// Design Law quantity stepper — 44 ± buttons, big tabular number, optional unit.
// Flow: press −/+ → clamp to min/max → onChange(next). Used by onboarding years, food servings, session weight.
//
// vocab: step = how much each tap adds/subtracts; tabular-nums keep digits from shifting width
// Manipulate here: BTN 44 + NUM 30/900 match DESIGN-SYSTEM.md Stepper row

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import HardShadow from './HardShadow';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const BTN = 44;
const NUM_SIZE = 30;

// ===== HELPERS =====

function clampValue(value, min, max) {
  let next = value;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
}

function roundNice(value) {
  // Avoid 1.0000002 float noise on decimal steps (e.g. 0.5 lb).
  return Math.round(value * 1000) / 1000;
}

// ===== MAIN FUNCTION =====

/**
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
  const numeric = Number(value);
  const safeValue = Number.isFinite(numeric) ? numeric : min || 0;

  const bump = (direction) => {
    const next = clampValue(roundNice(safeValue + direction * step), min, max);
    onChange?.(next);
  };

  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={[styles.label, { color: colors.nbMuted }]}>{label}</Text> : null}
      <View style={styles.row}>
        <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Decrease"
            onPress={() => bump(-1)}
            style={({ pressed }) => [
              styles.btn,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurfaceChip || colors.nbSoft,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[styles.btnGlyph, { color: colors.nbInk }]}>−</Text>
          </Pressable>
        </HardShadow>

        <View style={styles.valueCol}>
          <Text style={[styles.num, { color: colors.nbInk }]}>{safeValue}</Text>
          {unit ? <Text style={[styles.unit, { color: colors.nbMuted }]}>{unit}</Text> : null}
        </View>

        <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Increase"
            onPress={() => bump(1)}
            style={({ pressed }) => [
              styles.btn,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurfaceChip || colors.nbSoft,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[styles.btnGlyph, { color: colors.nbInk }]}>+</Text>
          </Pressable>
        </HardShadow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btn: {
    width: BTN,
    height: BTN,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGlyph: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  valueCol: {
    minWidth: 56,
    alignItems: 'center',
  },
  num: {
    fontSize: NUM_SIZE,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  unit: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
});
