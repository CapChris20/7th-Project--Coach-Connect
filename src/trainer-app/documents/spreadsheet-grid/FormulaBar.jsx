// The formula bar above the spreadsheet grid: cell reference pill + "fx" + editable input.
// Flow: parent owns the text and the selected cell → we render them → keystrokes call back up
// (onChangeText while typing, onCommit on Enter/Tab, onCancel on Escape).
// Fully controlled on purpose: the same value is also editable inside the cell itself, and one
// owner (the parent) is what keeps the two in sync.
import React, { memo } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colLabel } from './spreadsheetConstants';

/** Formula bar — controlled by parent so it stays in sync with the active cell editor. */
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
  return (
    <View style={[styles.formulaBar, { backgroundColor: theme.toolbarBg, borderBottomColor: theme.border }]}>
      {/* Left pill showing the current address, e.g. "C7". colLabel converts the 0-based column
          index to a letter, and focusR + 1 converts the 0-based row to the 1-based number users
          expect — spreadsheets start at row 1, arrays start at 0. */}
      <View style={[styles.refPill, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>
          {colLabel(focusC)}
          {focusR + 1}
        </Text>
      </View>
      {/* The "fx" marker turns green the moment the text starts with '=' — a live cue that what
          you're typing will be evaluated as a formula rather than stored as text. The input below
          uses the exact same condition, so both change together. */}
      <Text
        style={{
          color: String(value).startsWith('=') ? theme.formulaGreen : theme.textMuted,
          fontWeight: '800',
          fontSize: 13,
        }}
      >
        fx
      </Text>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        // Focusing the bar IS starting an edit, so the parent can move the cell into edit mode.
        onFocus={onBeginEdit}
        // Hardware-keyboard handling (iPad, Android with a keyboard). Each key maps to a
        // spreadsheet convention, and onCommit's arguments are the cursor MOVE after committing:
        //   Enter → (1, 0)  = save and drop one row
        //   Tab   → (0, 1)  = save and move one column right; Shift+Tab goes left with (0, -1)
        //   Escape→ discard the edit entirely
        // vocab: preventDefault?.() = stop the key's default behavior if the method exists (it's
        // absent on some React Native platforms, hence the ?. guard).
        onKeyPress={(e) => {
          const k = e.nativeEvent.key;
          if (k === 'Enter') {
            e.preventDefault?.();
            onCommit(1, 0);
          } else if (k === 'Tab') {
            e.preventDefault?.();
            onCommit(0, e.nativeEvent.shiftKey ? -1 : 1);
          } else if (k === 'Escape') onCancel();
        }}
        // Manipulate here: the placeholder doubles as the hint that '=' starts a formula.
        placeholder="Type a value or =formula"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.formulaInput,
          {
            // Same green-when-formula rule as the fx label above.
            color: String(value).startsWith('=') ? theme.formulaGreen : theme.text,
            borderColor: theme.border,
            backgroundColor: theme.inputBg,
          },
        ]}
        // Autocapitalize and autocorrect are both off because cell content is data, not prose —
        // autocorrect would happily "fix" =SUM(A1) into something broken.
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        // blurOnSubmit false keeps the keyboard up after Enter, so the user can keep typing down a
        // column without re-tapping. onKeyPress above already handles the cursor move.
        blurOnSubmit={false}
      />
      {/* Formula error (e.g. a circular reference) shown inline at the right. maxWidth stops a long
          message from squeezing the input; numberOfLines keeps the bar one row tall.
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
    // Manipulate here: `gap` spaces the pill / fx / input; minHeight 44 is the tap-target minimum
    // that keeps the bar comfortable to hit.
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    // vocab: StyleSheet.hairlineWidth = the thinnest visible line on this device (accounts for
    // screen density), so the divider looks equally crisp on every phone.
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  refPill: {
    // minWidth (not a fixed width) so the pill fits "A1" and "AZ100" without the input jumping
    // sideways as you move between cells.
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  formulaInput: {
    // flex: 1 = take all remaining width after the pill, fx label, and any error text.
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    // Monospace on iOS so formulas line up and 0/O are distinguishable. undefined on Android
    // because 'Menlo' doesn't exist there and naming a missing font can break rendering — the
    // platform default is used instead.
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined,
  },
});
