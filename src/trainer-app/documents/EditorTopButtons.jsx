// Title field and header action buttons for the trainer document / spreadsheet editor.
// Flow: name the file (inline or boxed) → optional action bar of save / share / icon chips.
// Used by: DocumentEditor, spreadsheet editor, and any screen that shares the editor chrome.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { nb, borderRadius } from '../../look-and-feel/colorPalette';
import { EditorGradientBorder, EditorGradientIcon } from './editorAccent';

// ===== NAMED CONSTANTS =====

const VARIANT_PRIMARY = 'primary';
const VARIANT_SECONDARY = 'secondary';
// Manipulate here: raise toward 1 = disabled buttons look more alive; lower = more washed out.
const DISABLED_OPACITY = 0.45;
const TITLE_BOX_MIN_HEIGHT = 50;
const TITLE_BOX_RADIUS = 12;
const PENCIL_ICON_SIZE = 17;
const ACTION_ICON_SIZE = 15;
const HEADER_ICON_SIZE = 17;
const ICON_BUTTON_HIT_SLOP = 8;
const ACTION_PRESS_OPACITY = 0.82;

/** Shown in UI only — never saved as the file title. */
export const EDITOR_NAME_PLACEHOLDER = 'Untitled document';
/** Firestore fallback when the user leaves the name blank. */
export const DEFAULT_SAVE_TITLE_DOCUMENT = 'Document';
export const DEFAULT_SAVE_TITLE_SPREADSHEET = 'Spreadsheet';

// ===== HELPER FUNCTIONS =====

/**
 * Opacity while a toolbar control is pressed.
 * @param {boolean} isPressed
 * @returns {number}
 */
function toolbarPressedOpacity(isPressed) {
  if (isPressed) {
    return 0.88;
  }
  return 1;
}

/**
 * True when the title field has any non-whitespace text.
 * Empty titles keep selectTextOnFocus off so a tap does not “select nothing.”
 * @param {string} titleValue
 * @returns {boolean}
 */
function titleHasText(titleValue) {
  const trimmedTitle = String(titleValue || '').trim();
  return Boolean(trimmedTitle);
}

/**
 * Shared TextInput wiring so inline and boxed title fields behave the same.
 * vocab: selectTextOnFocus = highlight all text when focus lands on a non-empty title.
 * @param {object} args
 * @returns {object}
 */
function sharedTitleInputProps({
  inputRef,
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  theme,
}) {
  const shouldSelectAllOnFocus = titleHasText(value);
  return {
    ref: inputRef,
    testID: 'doc-title-input',
    value,
    onChangeText,
    onFocus,
    onBlur,
    placeholder,
    placeholderTextColor: theme.textMuted,
    selectTextOnFocus: shouldSelectAllOnFocus,
    returnKeyType: 'done',
    autoCorrect: false,
    autoCapitalize: 'sentences',
  };
}

/**
 * Primary = nb fill; secondary = ghost surface with nb outline.
 * @param {object} theme
 * @param {boolean} isPrimaryVariant
 * @returns {{ backgroundColor: string, borderColor: string, contentColor: string }}
 */
function colorsForActionButton(theme, isPrimaryVariant) {
  if (isPrimaryVariant) {
    return {
      backgroundColor: theme.accent,
      borderColor: theme.border,
      contentColor: theme.textOnAccent,
    };
  }
  return {
    backgroundColor: theme.headerBg,
    borderColor: theme.border,
    contentColor: theme.text,
  };
}

/**
 * Ghost surface + outline for round icon-only header chips.
 * @param {object} theme
 * @returns {{ backgroundColor: string, borderColor: string }}
 */
function colorsForIconButton(theme) {
  return {
    backgroundColor: theme.headerBg,
    borderColor: theme.border,
  };
}

/**
 * Underline color for the inline title — selection border when focused, invisible when idle.
 * @param {boolean} focused
 * @param {object} theme
 * @returns {string}
 */
function underlineColorForInlineTitle(focused, theme) {
  if (focused) return theme.selectionBorder;
  return 'transparent';
}

/**
 * Glyph for an icon button — accent gradient icon when active, muted Ionicons when idle.
 * @param {object} args
 */
function HeaderIconGlyph({ icon, active, theme }) {
  if (active) {
    return <EditorGradientIcon name={icon} size={HEADER_ICON_SIZE} color={theme.accent} />;
  }
  return <Ionicons name={icon} size={HEADER_ICON_SIZE} color={theme.textMuted} />;
}

// ===== MAIN FUNCTION =====

/**
 * One-line title in the header (underline when focused).
 * Flow: 1. shared input props  2. underline from focus  3. render TextInput
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
  // 1. Same wiring as the boxed title so both fields feel identical.
  const titleFieldProps = sharedTitleInputProps({
    inputRef,
    value,
    onChangeText,
    onFocus,
    onBlur,
    placeholder,
    theme,
  });

  // 2. Focus draws the underline; idle stays invisible.
  const underlineColor = underlineColorForInlineTitle(focused, theme);

  // 3. Single-line title in the header bar.
  return (
    <TextInput
      {...titleFieldProps}
      numberOfLines={1}
      style={[
        titleFieldStyles.inlineInput,
        { color: theme.text, borderBottomColor: underlineColor },
      ]}
    />
  );
}

/**
 * Boxed title with pencil icon and accent ring when focused.
 * Flow: 1. shared input props  2. wrap in EditorGradientBorder  3. pencil affordance
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
  // 1. Shared TextInput props (select-all, placeholder color, etc.).
  const titleFieldProps = sharedTitleInputProps({
    inputRef,
    value,
    onChangeText,
    onFocus,
    onBlur,
    placeholder,
    theme,
  });

  // 2–3. Accent ring when focused; pencil hints “this is editable.”
  const boxedInnerLayout = {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TITLE_BOX_MIN_HEIGHT,
  };

  return (
    <EditorGradientBorder
      active={focused}
      bgColor={theme.inputBg}
      borderColor={theme.border}
      activeBorderColor={theme.accentBorder}
      radius={TITLE_BOX_RADIUS}
      innerStyle={boxedInnerLayout}
    >
      <TextInput
        {...titleFieldProps}
        clearButtonMode="while-editing"
        style={[titleFieldStyles.input, { color: theme.text }]}
      />
      <Ionicons
        name="pencil"
        size={PENCIL_ICON_SIZE}
        color={theme.textMuted}
        style={titleFieldStyles.pencil}
      />
    </EditorGradientBorder>
  );
}

/**
 * Full-width strip that hosts Save / Share / icon buttons.
 * @param {object} props
 */
export function EditorHeaderActionBar({ theme, children }) {
  const barChromeStyle = {
    borderBottomColor: theme.border,
    backgroundColor: theme.headerBg,
  };
  return (
    <View style={[actionBarStyles.bar, barChromeStyle]}>
      <View style={actionBarStyles.row}>{children}</View>
    </View>
  );
}

/**
 * Labeled editor action (Save, Share, …). variant="primary" uses accent fill.
 * Flow: 1. pick variant colors  2. apply disabled opacity  3. render icon + label
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
  // 1. Primary = filled accent; secondary = ghost outline.
  const isPrimaryVariant = variant === VARIANT_PRIMARY;
  const buttonColors = colorsForActionButton(theme, isPrimaryVariant);

  // 2. Dim the whole chip when disabled (press still blocked by TouchableOpacity).
  const disabledStyle = disabled ? { opacity: DISABLED_OPACITY } : null;
  const chipChromeStyle = {
    backgroundColor: buttonColors.backgroundColor,
    borderColor: buttonColors.borderColor,
  };

  // 3. Icon + label share the content color so primary chips stay readable on accent fill.
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={ACTION_PRESS_OPACITY}
      style={[actionBarStyles.btn, chipChromeStyle, disabledStyle]}
    >
      <Ionicons name={icon} size={ACTION_ICON_SIZE} color={buttonColors.contentColor} />
      <Text style={[actionBarStyles.label, { color: buttonColors.contentColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Round icon-only header control; active swaps in the accent icon.
 * Flow: 1. ghost chrome  2. active vs idle glyph  3. render
 * @param {object} props
 */
export function EditorIconButton({ icon, onPress, theme, active, accessibilityLabel }) {
  // 1. Same ghost surface as secondary action chips.
  const buttonColors = colorsForIconButton(theme);
  const chipChromeStyle = {
    backgroundColor: buttonColors.backgroundColor,
    borderColor: buttonColors.borderColor,
  };

  // 2–3. Active tools use EditorGradientIcon; idle stay muted Ionicons.
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={ICON_BUTTON_HIT_SLOP}
      style={[actionBarStyles.iconBtn, chipChromeStyle]}
    >
      <HeaderIconGlyph icon={icon} active={active} theme={theme} />
    </TouchableOpacity>
  );
}

// ===== PLUMBING — skip unless debugging =====

const titleFieldStyles = StyleSheet.create({
  inlineInput: {
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 6,
    paddingHorizontal: 0,
    borderBottomWidth: nb.borderWidthDivider,
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

const actionBarStyles = StyleSheet.create({
  bar: {
    borderBottomWidth: nb.borderWidth,
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
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    minHeight: nb.minTouchTarget,
  },
  label: { fontSize: 13, fontWeight: '800' },
  iconBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
