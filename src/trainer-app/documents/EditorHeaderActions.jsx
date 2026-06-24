/**
 * Editor Header Actions
 *
 * Purpose: Editor Header Actions — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: EditorTitleField, EditorHeaderActionBar, EditorActionButton, EditorIconButton, EDITOR_NAME_PLACEHOLDER, DEFAULT_SAVE_TITLE_DOCUMENT, DEFAULT_SAVE_TITLE_SPREADSHEET
 *
 * @file-header
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EditorGradientBorder, EditorGradientIcon } from './editorGradients';

/** Shown in UI only — never saved as the file title. */
export const EDITOR_NAME_PLACEHOLDER = 'Untitled document';
/** Firestore fallback when the user leaves the name blank. */
export const DEFAULT_SAVE_TITLE_DOCUMENT = 'Document';
export const DEFAULT_SAVE_TITLE_SPREADSHEET = 'Spreadsheet';

export function EditorTitleField({
  value,
  onChangeText,
  onFocus,
  onBlur,
  focused,
  theme,
  placeholder = EDITOR_NAME_PLACEHOLDER,
  inputRef,
}) {
  return (
    <EditorGradientBorder
      active={focused}
      bgColor={theme.inputBg}
      borderColor={theme.border}
      activeBorderColor={theme.accentBorder}
      radius={12}
      innerStyle={{ flexDirection: 'row', alignItems: 'center', minHeight: 50 }}
    >
      <TextInput
        ref={inputRef}
        testID="doc-title-input"
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        selectTextOnFocus={Boolean(String(value || '').trim())}
        returnKeyType="done"
        autoCorrect={false}
        autoCapitalize="sentences"
        clearButtonMode="while-editing"
        style={[titleStyles.input, { color: theme.text }]}
      />
      <Ionicons name="pencil" size={17} color={theme.textMuted} style={titleStyles.pencil} />
    </EditorGradientBorder>
  );
}

export function EditorHeaderActionBar({ theme, children }) {
  return (
    <View style={[styles.bar, { borderBottomColor: theme.border, backgroundColor: theme.headerBg }]}>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

export function EditorActionButton({
  label,
  icon,
  onPress,
  theme,
  variant = 'secondary',
  disabled,
}) {
  const isPrimary = variant === 'primary';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={[
        styles.btn,
        isPrimary
          ? { backgroundColor: `${theme.accent}18`, borderColor: theme.accent }
          : { backgroundColor: theme.inputBg, borderColor: theme.border },
        disabled ? { opacity: 0.45 } : null,
      ]}
    >
      <Ionicons
        name={icon}
        size={15}
        color={isPrimary ? theme.accent : theme.text}
      />
      <Text
        style={[
          styles.label,
          { color: isPrimary ? theme.accent : theme.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function EditorIconButton({ icon, onPress, theme, active, accessibilityLabel }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        styles.iconBtn,
        { backgroundColor: theme.inputBg, borderColor: theme.border },
      ]}
    >
      {active ? (
        <EditorGradientIcon name={icon} size={17} color={theme.accent} />
      ) : (
        <Ionicons name={icon} size={17} color={theme.textMuted} />
      )}
    </TouchableOpacity>
  );
}

const titleStyles = StyleSheet.create({
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pencil: { marginRight: 12 },
});

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
  },
  label: { fontSize: 13, fontWeight: '700' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
