// Labeled text box: small uppercase label above an outlined input.
// Flow: draw the label → draw the outlined input → pass every other prop straight to TextInput.
// Used for notes, links and any single-line or multi-line text entry.

import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../lightDarkMode';
import {
  MINIMUM_TOUCH_SIZE,
  NB_BORDER_WIDTH,
  NB_RADIUS,
  NB_SPACING,
  getNbColors,
} from './nbTokens';

// ===== NAMED CONSTANTS =====

const LABEL_FONT_SIZE = 12;
const INPUT_FONT_SIZE = 15;
const MULTILINE_MIN_HEIGHT = 96;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {string} props.label
 * @param {boolean} [props.multiline]
 * @param {object} [props.style]
 * @returns {JSX.Element}
 */
export function NbField({ label, multiline = false, style, ...textInputProps }) {
  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. Multi-line boxes start taller and align text to the top.
  const sizeStyle = multiline ? { minHeight: MULTILINE_MIN_HEIGHT, textAlignVertical: 'top' } : null;
  const inputStyle = { borderColor: colors.border, backgroundColor: colors.surface, color: colors.ink };

  // 3. Label, then input.
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[styles.input, inputStyle, sizeStyle, style]}
        {...textInputProps}
      />
    </View>
  );
}

export default NbField;

const styles = StyleSheet.create({
  wrapper: { gap: NB_SPACING.small },
  label: { fontSize: LABEL_FONT_SIZE, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  input: {
    minHeight: MINIMUM_TOUCH_SIZE,
    borderWidth: NB_BORDER_WIDTH,
    borderRadius: NB_RADIUS.chip,
    paddingHorizontal: NB_SPACING.medium,
    paddingVertical: NB_SPACING.medium,
    fontSize: INPUT_FONT_SIZE,
  },
});
