// Design Law text field — tall enough to tap, 3px border, 12 caps label, dashed + ! error row.
// Flow: optional uppercase label → HardShadow shell → TextInput → validation error row when failed.
// Used by: sheets/forms that need shared chrome (LoginScreen AuthField stays local on purpose).
//
// vocab: HardShadow = hard offset fill / iOS shadow wrapper (Design Law — never soft blur)
// vocab: dashedError = borderStyle dashed when validation failed (Android may square corners)
// Manipulate here: FIELD_MIN_HEIGHT 48 matches DESIGN-SYSTEM.md; raise multiline multipliers for comfort

import React from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import HardShadow from './HardShadow';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const FIELD_MIN_HEIGHT = 48;
const LABEL_FONT_SIZE = 12;
const ERROR_BANG_BOX_SIZE = 18;
// Manipulate here: taller shell when the field is a note / multi-line box
const MULTILINE_SHELL_HEIGHT_MULTIPLIER = 2.5;
const MULTILINE_INPUT_HEIGHT_MULTIPLIER = 2;
// Manipulate here: single-line input sits slightly shorter than the shell so padding breathes
const INPUT_HEIGHT_INSET = 6;
const BORDER_STYLE_WHEN_ERROR = 'dashed';
const BORDER_STYLE_WHEN_OK = 'solid';
const TEXT_ALIGN_TOP = 'top';
const TEXT_ALIGN_CENTER = 'center';

// ===== HELPER FUNCTIONS =====

function fieldHasValidationError(errorText) {
  return Boolean(errorText);
}

function shellMinHeightForMode(isMultiline) {
  if (isMultiline) {
    return FIELD_MIN_HEIGHT * MULTILINE_SHELL_HEIGHT_MULTIPLIER;
  }
  return FIELD_MIN_HEIGHT;
}

function inputMinHeightForMode(isMultiline) {
  if (isMultiline) {
    return FIELD_MIN_HEIGHT * MULTILINE_INPUT_HEIGHT_MULTIPLIER;
  }
  return FIELD_MIN_HEIGHT - INPUT_HEIGHT_INSET;
}

function borderStyleForValidation(validationFailed) {
  if (validationFailed) {
    return BORDER_STYLE_WHEN_ERROR;
  }
  return BORDER_STYLE_WHEN_OK;
}

// Screen readers need a name; prefer the explicit a11y label, else the visible label.
function accessibilityNameForInput(accessibilityLabel, visibleLabel) {
  if (accessibilityLabel) {
    return accessibilityLabel;
  }
  return visibleLabel;
}

function verticalAlignForMultiline(isMultiline) {
  if (isMultiline) {
    return TEXT_ALIGN_TOP;
  }
  return TEXT_ALIGN_CENTER;
}

function buildShellFrameStyle(themeColors, fieldBorderStyle, shellMinHeight) {
  return [
    styles.shell,
    {
      borderColor: themeColors.nbBorder,
      backgroundColor: themeColors.nbSurface,
      borderStyle: fieldBorderStyle,
      minHeight: shellMinHeight,
    },
  ];
}

function buildInputTextStyle(themeColors, inputMinHeight, callerInputStyle) {
  return [
    styles.input,
    {
      color: themeColors.nbInk,
      minHeight: inputMinHeight,
    },
    callerInputStyle,
  ];
}

// ===== SMALL UI PIECES =====

function FieldUppercaseLabel({ label, mutedColor }) {
  if (!label) {
    return null;
  }
  return (
    <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
  );
}

function ErrorBangBadge({ themeColors }) {
  return (
    <View
      style={[
        styles.errorDot,
        {
          borderColor: themeColors.nbBorder,
          backgroundColor: themeColors.nbFill,
        },
      ]}
    >
      <Text style={[styles.errorBang, { color: themeColors.nbOnFill }]}>!</Text>
    </View>
  );
}

function FieldValidationErrorRow({ errorText, themeColors }) {
  return (
    <View style={styles.errorRow}>
      <ErrorBangBadge themeColors={themeColors} />
      <Text style={[styles.errorCopy, { color: themeColors.nbInk }]}>
        {errorText}
      </Text>
    </View>
  );
}

function OptionalValidationErrorRow({ validationFailed, errorText, themeColors }) {
  if (!validationFailed) {
    return null;
  }
  return (
    <FieldValidationErrorRow errorText={errorText} themeColors={themeColors} />
  );
}

function FieldHardShadowShell({
  themeColors,
  fieldBorderStyle,
  shellMinHeight,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  editable,
  isMultiline,
  textAlignVertical,
  accessibilityName,
  inputMinHeight,
  callerInputStyle,
}) {
  const shellFrameStyle = buildShellFrameStyle(
    themeColors,
    fieldBorderStyle,
    shellMinHeight,
  );
  const inputTextStyle = buildInputTextStyle(
    themeColors,
    inputMinHeight,
    callerInputStyle,
  );

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput}>
      <View style={shellFrameStyle}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={themeColors.nbMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={isMultiline}
          textAlignVertical={textAlignVertical}
          accessibilityLabel={accessibilityName}
          style={inputTextStyle}
        />
      </View>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law text field with optional label and validation error row.
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
  // vocab: useTheme = ThemeProvider hook — colors follow light/dark Design Law tokens
  const { colors: themeColors } = useTheme();

  // 1. Decide whether we show the dashed border + error row.
  const validationFailed = fieldHasValidationError(errorText);

  // 2. Heights follow single-line vs multiline without nesting ternaries in JSX.
  const shellMinHeight = shellMinHeightForMode(multiline);
  const inputMinHeight = inputMinHeightForMode(multiline);
  const fieldBorderStyle = borderStyleForValidation(validationFailed);

  // 3. Accessibility name falls back to the visible label string.
  const accessibilityName = accessibilityNameForInput(accessibilityLabel, label);
  const textAlignVertical = verticalAlignForMultiline(multiline);

  // 4. Stack label → hard-shadow shell → optional error row.
  return (
    <View style={[styles.wrap, style]}>
      <FieldUppercaseLabel label={label} mutedColor={themeColors.nbMuted} />
      <FieldHardShadowShell
        themeColors={themeColors}
        fieldBorderStyle={fieldBorderStyle}
        shellMinHeight={shellMinHeight}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        isMultiline={multiline}
        textAlignVertical={textAlignVertical}
        accessibilityName={accessibilityName}
        inputMinHeight={inputMinHeight}
        callerInputStyle={inputStyle}
      />
      <OptionalValidationErrorRow
        validationFailed={validationFailed}
        errorText={errorText}
        themeColors={themeColors}
      />
    </View>
  );
}

// PLUMBING — skip unless debugging (static StyleSheet tokens)

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: LABEL_FONT_SIZE,
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
    width: ERROR_BANG_BOX_SIZE,
    height: ERROR_BANG_BOX_SIZE,
    borderRadius: ERROR_BANG_BOX_SIZE / 2,
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
