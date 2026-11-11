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

const FALLBACK_TITLE = 'Field';
const EDIT_FIELD_LABEL = 'Edit Field';
const PLATFORM_IOS = 'ios';
const KEYBOARD_BEHAVIOR_PADDING = 'padding';

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
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === PLATFORM_IOS ? KEYBOARD_BEHAVIOR_PADDING : undefined}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
          <View style={[styles.dragHandle, { backgroundColor: colors.nbMuted }]} />

          <View style={[styles.header, { borderBottomColor: colors.nbBorder }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.nbMuted }]}>{EDIT_FIELD_LABEL}</Text>
              <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={1}>
                {title || fieldKey || FALLBACK_TITLE}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { borderColor: colors.nbBorder }]} activeOpacity={0.9}>
              <Ionicons name="close" size={22} color={colors.nbInk} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {children}
          </ScrollView>

          <View style={styles.actions}>
            <NbButton variant="plain" onPress={onClose} style={{ flex: 1 }}>
              Cancel
            </NbButton>
            <NbButton variant="brand" onPress={onDone} style={{ flex: 1 }}>
              Done
            </NbButton>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    maxHeight: '88%',
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
  label: { 
    fontSize: 12, 
    fontFamily: 'SpaceGrotesk_700Bold', 
    textTransform: 'uppercase', 
    letterSpacing: 1.2, 
    marginBottom: 4 
  },
  title: { fontSize: 20, fontFamily: 'SpaceGrotesk_700Bold' },
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm + 2, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
