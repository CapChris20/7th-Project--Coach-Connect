// Title field and header action buttons for the trainer document / spreadsheet editor.
// Flow: name the file (inline or boxed) → action bar of save / share / icon buttons using the editor theme.
// Used by: the document editor and spreadsheet editor screens.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EditorGradientBorder, EditorGradientIcon } from './editorAccent';

// ===== NAMED CONSTANTS =====

const VARIANT_PRIMARY = 'primary';
const VARIANT_SECONDARY = 'secondary';
const DISABLED_OPACITY = 0.45;
const PRIMARY_ACCENT_FILL_SUFFIX = '18';

/** Shown in UI only — never saved as the file title. */
export const EDITOR_NAME_PLACEHOLDER = 'Untitled document';
/** Firestore fallback when the user leaves the name blank. */
export const DEFAULT_SAVE_TITLE_DOCUMENT = 'Document';
export const DEFAULT_SAVE_TITLE_SPREADSHEET = 'Spreadsheet';

// ===== HELPER FUNCTIONS =====

function hasTitleText(value) {
  return Boolean(String(value || '').trim());
}

function titleInputSharedProps({
  inputRef,
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  theme,
}) {
  return {
    ref: inputRef,
    testID: 'doc-title-input',
    value,
    onChangeText,
    onFocus,
    onBlur,
    placeholder,
    placeholderTextColor: theme.textMuted,
    selectTextOnFocus: hasTitleText(value),
    returnKeyType: 'done',
    autoCorrect: false,
    autoCapitalize: 'sentences',
  };
}

function actionButtonColors(theme, isPrimary) {
  if (isPrimary) {
    return {
      backgroundColor: `${theme.accent}${PRIMARY_ACCENT_FILL_SUFFIX}`,
      borderColor: theme.accent,
      contentColor: theme.accent,
    };
  }
  return {
    backgroundColor: theme.inputBg,
    borderColor: theme.border,
    contentColor: theme.text,
  };
}

function iconButtonColors(theme) {
  return {
    backgroundColor: theme.inputBg,
    borderColor: theme.border,
  };
}

// ===== MAIN FUNCTION =====

/**
 * One-line title in the header (no boxed border).
 * @param {object} props
 */
export function EditorInlineTitle({
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
    <TextInput
      {...titleInputSharedProps({ inputRef, value, onChangeText, onFocus, onBlur, placeholder, theme })}
      numberOfLines={1}
      style={[
        titleStyles.inlineInput,
        {
          color: theme.text,
          borderBottomColor: focused ? theme.selectionBorder : 'transparent',
        },
      ]}
    />
  );
}

/**
 * Boxed title field with a pencil icon. Gradient ring when focused.
 * @param {object} props
 */
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
        {...titleInputSharedProps({ inputRef, value, onChangeText, onFocus, onBlur, placeholder, theme })}
        clearButtonMode="while-editing"
        style={[titleStyles.input, { color: theme.text }]}
      />
      <Ionicons name="pencil" size={17} color={theme.textMuted} style={titleStyles.pencil} />
    </EditorGradientBorder>
  );
}

/**
 * Full-width header strip that hosts the action buttons.
 * @param {{ theme: object, children: * }} props
 */
export function EditorHeaderActionBar({ theme, children }) {
  return (
    <View style={[styles.bar, { borderBottomColor: theme.border, backgroundColor: theme.headerBg }]}>
      <View style={styles.row}>{children}</View>
    </View>
  );
}

/**
 * Labeled editor action (Save, Share, …). `variant="primary"` uses the accent color.
 * @param {object} props
 */
export function EditorActionButton({
  label,
  icon,
  onPress,
  theme,
  variant = VARIANT_SECONDARY,
  disabled,
}) {
  const isPrimary = variant === VARIANT_PRIMARY;
  const colors = actionButtonColors(theme, isPrimary);
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.82}
      style={[
        styles.btn,
        { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor },
        disabled ? { opacity: DISABLED_OPACITY } : null,
      ]}
    >
      <Ionicons name={icon} size={15} color={colors.contentColor} />
      <Text style={[styles.label, { color: colors.contentColor }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Round icon-only header button. `active` swaps in the gradient icon.
 * @param {object} props
 */
export function EditorIconButton({ icon, onPress, theme, active, accessibilityLabel }) {
  const colors = iconButtonColors(theme);
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[
        styles.iconBtn,
        { backgroundColor: colors.backgroundColor, borderColor: colors.borderColor },
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
  inlineInput: {
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: 2,
  },
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
