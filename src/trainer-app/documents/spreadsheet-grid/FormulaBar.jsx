// The formula bar above the spreadsheet grid: cell address pill + "fx" + editable input.
// Flow: parent owns the text and selected cell → we render them → keystrokes call back up.
// Used by: SpreadsheetEditor. Fully controlled so the bar and the in-cell editor stay in sync.

import React, { memo } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colLabel } from './spreadsheetConstants';

// ===== NAMED CONSTANTS =====

const FORMULA_PREFIX = '=';
const KEY_ENTER = 'Enter';
const KEY_TAB = 'Tab';
const KEY_ESCAPE = 'Escape';
// Spreadsheet rows are 1-based on screen; the grid stores them 0-based.
const DISPLAY_ROW_OFFSET = 1;
// onCommit(rowDelta, colDelta) moves the cursor after saving.
const COMMIT_ROW_DOWN = 1;
const COMMIT_COL_NONE = 0;
const COMMIT_ROW_NONE = 0;
const COMMIT_COL_RIGHT = 1;
const COMMIT_COL_LEFT = -1;
const PLATFORM_IOS = 'ios';
const MONOSPACE_FONT_IOS = 'Menlo';

// ===== HELPER FUNCTIONS =====

/**
 * A leading "=" means this cell is a formula, not plain text.
 * @param {*} cellValue
 * @returns {boolean}
 */
function isFormulaValue(cellValue) {
  return String(cellValue).startsWith(FORMULA_PREFIX);
}

/**
 * Address users expect, e.g. "C7". colLabel turns the 0-based column into a letter.
 * @param {number} focusC
 * @param {number} focusR
 * @returns {string}
 */
function cellAddressLabel(focusC, focusR) {
  return `${colLabel(focusC)}${focusR + DISPLAY_ROW_OFFSET}`;
}

/**
 * Hardware-keyboard handling (iPad, Android with a keyboard).
 * vocab: preventDefault?.() = stop the key's default behavior if the method exists
 * (some React Native platforms omit it, hence the ?. guard).
 * @param {object} keyEvent
 * @param {Function} onCommit
 * @param {Function} onCancel
 */
function handleFormulaBarKeyPress(keyEvent, onCommit, onCancel) {
  const keyName = keyEvent.nativeEvent.key;
  if (keyName === KEY_ENTER) {
    keyEvent.preventDefault?.();
    onCommit(COMMIT_ROW_DOWN, COMMIT_COL_NONE);
    return;
  }
  if (keyName === KEY_TAB) {
    keyEvent.preventDefault?.();
    const columnDelta = keyEvent.nativeEvent.shiftKey ? COMMIT_COL_LEFT : COMMIT_COL_RIGHT;
    onCommit(COMMIT_ROW_NONE, columnDelta);
    return;
  }
  if (keyName === KEY_ESCAPE) {
    onCancel();
  }
}

// ===== MAIN FUNCTION =====

/**
 * Formula bar — controlled by the parent so it stays in sync with the active cell editor.
 * Enter saves and drops one row; Tab saves and moves one column; Escape discards.
 * @param {object} props
 */
function FormulaBar({
  theme,
  focusR,
  focusC,
  value,
  editing,
  focusError,
  // Lets the parent programmatically focus/blur this input (e.g. when the user taps "fx").
  inputRef,
  onChangeText,
  onCommit,
  onCancel,
  onBeginEdit,
}) {
  const isFormula = isFormulaValue(value);
  const formulaColor = isFormula ? theme.formulaGreen : theme.text;
  const fxColor = isFormula ? theme.formulaGreen : theme.textMuted;

  return (
    <View style={[styles.formulaBar, { backgroundColor: theme.toolbarBg, borderBottomColor: theme.border }]}>
      {/* Left pill showing the current address, e.g. "C7". */}
      <View style={[styles.refPill, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>
          {cellAddressLabel(focusC, focusR)}
        </Text>
      </View>
      {/* The "fx" marker turns green the moment the text starts with '='. */}
      <Text style={{ color: fxColor, fontWeight: '800', fontSize: 13 }}>
        fx
      </Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onFocus={onBeginEdit}
        onKeyPress={(keyEvent) => handleFormulaBarKeyPress(keyEvent, onCommit, onCancel)}
        // Manipulate here: the placeholder doubles as the hint that '=' starts a formula.
        placeholder="Type a value or =formula"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.formulaInput,
          {
            color: formulaColor,
            borderColor: theme.border,
            backgroundColor: theme.inputBg,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        // blurOnSubmit false keeps the keyboard up after Enter so the user can keep typing down a column.
        blurOnSubmit={false}
      />
      {/* Formula error (e.g. a circular reference) shown inline at the right.
          Manipulate here: maxWidth 80 is the error text's budget. */}
      {focusError ? (
        <Text style={{ color: theme.warning, fontSize: 11, maxWidth: 80 }} numberOfLines={1}>
          {focusError}
        </Text>
      ) : null}
    </View>
  );
}

// vocab: memo = skip re-rendering when props are unchanged. Worth it here because the parent
// re-renders on every grid scroll and cell selection, while this bar only depends on a few props.
export default memo(FormulaBar);

const styles = StyleSheet.create({
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    // Manipulate here: `gap` spaces the pill / fx / input; minHeight 44 is the tap-target minimum.
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    // vocab: StyleSheet.hairlineWidth = the thinnest visible line on this device.
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  refPill: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  formulaInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    // Monospace on iOS so formulas line up. undefined on Android because 'Menlo' is missing there.
    fontFamily: Platform.OS === PLATFORM_IOS ? MONOSPACE_FONT_IOS : undefined,
  },
});
