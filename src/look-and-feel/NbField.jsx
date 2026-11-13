// Design Law text field — 48+ tall, 3px border, 12 caps label, dashed + ! error row.
// Flow: label → HardShadow shell → TextInput → optional error line under the field.
// Used by sheets/forms that need shared chrome (not LoginScreen AuthField — that stays local).
//
// vocab: dashedError = borderStyle dashed when validation failed (Android may square the corners)
// Manipulate here: FIELD_MIN_HEIGHT 48 matches DESIGN-SYSTEM.md; raise for multiline comfort

import React from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import HardShadow from './HardShadow';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const FIELD_MIN_HEIGHT = 48;
const LABEL_SIZE = 12;
const ERROR_BANG_SIZE = 18;

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   label?: string,
 *   value?: string,
 *   onChangeText?: (text: string) => void,
 *   placeholder?: string,
 *   errorText?: string,
 *   multiline?: boolean,
 *   secureTextEntry?: boolean,
 *   keyboardType?: string,
 *   autoCapitalize?: string,
 *   editable?: boolean,
 *   style?: object,
 *   inputStyle?: object,
 *   accessibilityLabel?: string,
 * }} props
 */
export default function NbField({
  label,
  value,
  onChangeText,
  placeholder,
  errorText,
  multiline = false,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  editable = true,
  style,
  inputStyle,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  const hasError = Boolean(errorText);

  return (
    <View style={[styles.wrap, style]}>
      {label ? (
        <Text style={[styles.label, { color: colors.nbMuted }]}>{label}</Text>
      ) : null}
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput}>
        <View
          style={[
            styles.shell,
            {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface,
              // vocab: dashed = error state from Design Law (solid when ok)
              borderStyle: hasError ? 'dashed' : 'solid',
              minHeight: multiline ? FIELD_MIN_HEIGHT * 2.5 : FIELD_MIN_HEIGHT,
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.nbMuted}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            editable={editable}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            accessibilityLabel={accessibilityLabel || label}
            style={[
              styles.input,
              {
                color: colors.nbInk,
                minHeight: multiline ? FIELD_MIN_HEIGHT * 2 : FIELD_MIN_HEIGHT - 6,
              },
              inputStyle,
            ]}
          />
        </View>
      </HardShadow>
      {hasError ? (
        <View style={styles.errorRow}>
          <View
            style={[
              styles.errorDot,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbFill },
            ]}
          >
            <Text style={[styles.errorBang, { color: colors.nbOnFill }]}>!</Text>
          </View>
          <Text style={[styles.errorCopy, { color: colors.nbInk }]}>{errorText}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: LABEL_SIZE,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  shell: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: 10,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  errorDot: {
    width: ERROR_BANG_SIZE,
    height: ERROR_BANG_SIZE,
    borderRadius: ERROR_BANG_SIZE / 2,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  errorBang: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
  errorCopy: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
