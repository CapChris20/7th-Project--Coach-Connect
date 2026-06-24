import React, { memo } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { colLabel } from './types';

/** Formula bar — controlled by parent so it stays in sync with the active cell editor. */
function SpreadsheetFormulaBar({
  theme,
  focusR,
  focusC,
  value,
  editing,
  focusError,
  inputRef,
  onChangeText,
  onCommit,
  onCancel,
  onBeginEdit,
}) {
  return (
    <View style={[styles.formulaBar, { backgroundColor: theme.toolbarBg, borderBottomColor: theme.border }]}>
      <View style={[styles.refPill, { borderColor: theme.border, backgroundColor: theme.inputBg }]}>
        <Text style={{ color: theme.text, fontSize: 12, fontWeight: '800' }}>
          {colLabel(focusC)}
          {focusR + 1}
        </Text>
      </View>
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
        onFocus={onBeginEdit}
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
        placeholder="Type a value or =formula"
        placeholderTextColor={theme.textMuted}
        style={[
          styles.formulaInput,
          {
            color: String(value).startsWith('=') ? theme.formulaGreen : theme.text,
            borderColor: theme.border,
            backgroundColor: theme.inputBg,
          },
        ]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="done"
        blurOnSubmit={false}
      />
      {focusError ? (
        <Text style={{ color: theme.warning, fontSize: 11, maxWidth: 80 }} numberOfLines={1}>
          {focusError}
        </Text>
      ) : null}
    </View>
  );
}

export default memo(SpreadsheetFormulaBar);

const styles = StyleSheet.create({
  formulaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : undefined,
  },
});
