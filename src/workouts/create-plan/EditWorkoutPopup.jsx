// Bottom-sheet edit modal for one workout-plan builder field (title, chrome, Done/Cancel).
// Flow: if hidden, render nothing → slide up over a dim backdrop → scroll the field body → Done or Cancel.
// Used by: CreateWorkoutPlanScreen. The field editor itself is passed in as children.

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors, spacing, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const FALLBACK_FIELD_TITLE = 'Field';
const EDIT_SHEET_KICKER = 'Edit Field';
const PLATFORM_IOS = 'ios';
const KEYBOARD_AVOID_PADDING = 'padding';
// Manipulate here: dim over the plan builder while the sheet is open
const BACKDROP_DIM = 'rgba(0,0,0,0.5)';
// Manipulate here: sheet height cap so the plan still peeks above
const SHEET_MAX_HEIGHT_PERCENT = '88%';
const CLOSE_ICON_SIZE = 22;
const CLOSE_BUTTON_HIT = 44;

// ===== HELPER FUNCTIONS =====

/**
 * Pick the headline shown in the sheet header.
 * Prefer an explicit title; fall back to the field key; last resort "Field".
 */
function titleLineForSheet({ title, fieldKey }) {
  if (title) {
    return title;
  }
  if (fieldKey) {
    return fieldKey;
  }
  return FALLBACK_FIELD_TITLE;
}

/**
 * Map the device color scheme to Design Law light/dark token bags.
 * vocab: useColorScheme = React Native hook that returns 'light' | 'dark' | null
 */
function themeColorsFromDeviceScheme(colorScheme) {
  const isDarkMode = colorScheme === 'dark';
  if (isDarkMode) {
    return darkColors;
  }
  return lightColors;
}

/**
 * iOS needs padding so the keyboard does not cover inputs; Android handles that itself.
 */
function keyboardAvoidBehaviorForPlatform() {
  if (Platform.OS === PLATFORM_IOS) {
    return KEYBOARD_AVOID_PADDING;
  }
  return undefined;
}

// ===== IN-FILE UI PIECES =====

function EditWorkoutSheetHeader({ colors, titleLine, onClose }) {
  const dragHandleStyle = [styles.dragHandle, { backgroundColor: colors.nbMuted }];
  const headerStyle = [styles.header, { borderBottomColor: colors.nbBorder }];
  const kickerStyle = [styles.label, { color: colors.nbMuted }];
  const titleStyle = [styles.title, { color: colors.nbInk }];
  const closeButtonStyle = [styles.closeBtn, { borderColor: colors.nbBorder }];

  return (
    <>
      <View style={dragHandleStyle} />

      <View style={headerStyle}>
        <View style={styles.headerTextColumn}>
          <Text style={kickerStyle}>{EDIT_SHEET_KICKER}</Text>
          <Text style={titleStyle} numberOfLines={1}>
            {titleLine}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={closeButtonStyle}
          activeOpacity={0.9}
        >
          <Ionicons name="close" size={CLOSE_ICON_SIZE} color={colors.nbInk} />
        </TouchableOpacity>
      </View>
    </>
  );
}

function EditWorkoutSheetFooter({ onClose, onDone }) {
  return (
    <View style={styles.actions}>
      <NbButton variant="plain" onPress={onClose} style={styles.actionButton}>
        Cancel
      </NbButton>
      <NbButton variant="brand" onPress={onDone} style={styles.actionButton}>
        Done
      </NbButton>
    </View>
  );
}

// ===== MAIN COMPONENT =====

/**
 * Slide-up edit sheet for one plan-builder field.
 * Flow: 1. theme tokens  2. title line  3. hide when not visible  4. sheet + children + footer
 *
 * Legacy props (cardBg, textColor, …) stay on the signature so older callers do not break —
 * chrome uses theme tokens only. Do not delete those unused names.
 */
export function EditModalForm({
  visible,
  fieldKey,
  title,
  cardBg: deprecatedCardBg,
  textColor: deprecatedTextColor,
  mutedColor: deprecatedMutedColor,
  borderColor: deprecatedBorderColor,
  doneGradient: deprecatedDoneGradient,
  isDark: deprecatedIsDark,
  children,
  onClose,
  onDone,
}) {
  // vocab: useColorScheme = device light/dark; we never trust deprecatedIsDark for chrome
  const colorScheme = useColorScheme();

  // Legacy chrome props stay on the signature for old callers — theme tokens win.
  void deprecatedCardBg;
  void deprecatedTextColor;
  void deprecatedMutedColor;
  void deprecatedBorderColor;
  void deprecatedDoneGradient;
  void deprecatedIsDark;

  // 1. Theme tokens from the device scheme (not the legacy isDark prop)
  const colors = themeColorsFromDeviceScheme(colorScheme);

  // 2. Header title: explicit title → field key → "Field"
  const titleLine = titleLineForSheet({ title, fieldKey });

  // 3. Hidden → render nothing (Modal must not stay mounted when closed)
  if (!visible) {
    return null;
  }

  // 4. Sheet chrome: dim backdrop, avoid keyboard, scroll children, Cancel/Done
  const keyboardAvoidBehavior = keyboardAvoidBehaviorForPlatform();
  const sheetBackgroundColor = colors.nbSurface;
  const sheetBorderColor = colors.nbBorder;
  const sheetStyle = [
    styles.sheet,
    { backgroundColor: sheetBackgroundColor, borderColor: sheetBorderColor },
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={keyboardAvoidBehavior} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={sheetStyle}>
          <EditWorkoutSheetHeader colors={colors} titleLine={titleLine} onClose={onClose} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>

          <EditWorkoutSheetFooter onClose={onClose} onDone={onDone} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: BACKDROP_DIM },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    maxHeight: SHEET_MAX_HEIGHT_PERCENT,
    overflow: 'hidden',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm + 4,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: nb.borderWidth,
  },
  headerTextColumn: { flex: 1 },
  label: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  title: { fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
  closeBtn: {
    width: CLOSE_BUTTON_HIT,
    height: CLOSE_BUTTON_HIT,
    borderRadius: CLOSE_BUTTON_HIT / 2,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  actionButton: { flex: 1 },
});
