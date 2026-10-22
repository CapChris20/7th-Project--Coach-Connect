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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const EDIT_POPUP_CARD_BG = '#0D1117';
const EDIT_POPUP_TEXT_COLOR = '#FFFFFF';
const EDIT_POPUP_MUTED_COLOR = 'rgba(255,255,255,0.55)';
const DEFAULT_BORDER_COLOR = 'rgba(255,255,255,0.12)';
const DEFAULT_DONE_GRADIENT = ['#C084FC', '#FF4D8D'];
const FALLBACK_TITLE = 'Field';
const EDIT_FIELD_LABEL = 'Edit Field';
const CANCEL_LABEL = 'Cancel';
const DONE_LABEL = 'Done';
const PLATFORM_IOS = 'ios';
const KEYBOARD_BEHAVIOR_PADDING = 'padding';
const DRAG_HANDLE_DARK = 'rgba(255,255,255,0.22)';
const DRAG_HANDLE_LIGHT = 'rgba(15,23,42,0.12)';
const CANCEL_BG_DARK = 'rgba(255,255,255,0.03)';
const CANCEL_BG_LIGHT = 'rgba(15,23,42,0.04)';
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

// ===== HELPER FUNCTIONS =====

/**
 * Sheet chrome (handle, cancel fill) is slightly stronger in dark mode so it still reads on glass.
 * @param {boolean} isDark
 * @returns {{ dragHandle: string, cancelBackground: string }}
 */
function sheetChromeColors(isDark) {
  return {
    dragHandle: isDark ? DRAG_HANDLE_DARK : DRAG_HANDLE_LIGHT,
    cancelBackground: isDark ? CANCEL_BG_DARK : CANCEL_BG_LIGHT,
  };
}

// ===== MAIN FUNCTION =====

/**
 * UI-only “nice” edit modal for Workout Plan builder fields.
 * Uses the existing field editor (`WorkoutPlanBuilderFieldEditBody`) so functionality stays identical.
 * @param {object} props
 */
export function EditModalForm({
  visible,
  fieldKey,
  title,
  cardBg = EDIT_POPUP_CARD_BG,
  textColor = EDIT_POPUP_TEXT_COLOR,
  mutedColor = EDIT_POPUP_MUTED_COLOR,
  borderColor = DEFAULT_BORDER_COLOR,
  doneGradient = DEFAULT_DONE_GRADIENT,
  /** When false, sheet chrome (handle, cancel fill) uses light-mode neutrals */
  isDark = true,
  children,
  onClose,
  onDone,
}) {
  if (!visible) return null;
  const chrome = sheetChromeColors(isDark);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === PLATFORM_IOS ? KEYBOARD_BEHAVIOR_PADDING : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: cardBg, borderColor }]}>
          <View style={[styles.dragHandle, { backgroundColor: chrome.dragHandle }]} />

          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: mutedColor }]}>{EDIT_FIELD_LABEL}</Text>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                {title || fieldKey || FALLBACK_TITLE}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor }]} activeOpacity={0.9}>
              <Ionicons name="close" size={22} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.cancelBtn,
                {
                  borderColor,
                  backgroundColor: chrome.cancelBackground,
                },
              ]}
              activeOpacity={0.9}
            >
              <Text style={[styles.cancelText, { color: textColor }]}>{CANCEL_LABEL}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onDone} style={styles.saveBtnWrap} activeOpacity={0.9}>
              <LinearGradient
                colors={doneGradient}
                start={GRADIENT_START}
                end={GRADIENT_END}
                style={styles.saveBtn}
              >
                <Text style={styles.saveText}>{DONE_LABEL}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  dragHandle: {
    width: 48,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: '900' },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingBottom: 18 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '800' },
  saveBtnWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  saveBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
});
