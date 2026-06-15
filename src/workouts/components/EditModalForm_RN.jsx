/**
 * Edit Modal Form RN
 *
 * Purpose: UI screen or component: Edit Modal Form RN. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/workouts
 * Key exports: EditModalForm
 *
 * @file-header
 */
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

/**
 * UI-only “nice” edit modal for Workout Plan builder fields.
 * Uses the existing field editor (`WorkoutPlanBuilderFieldEditBody`) so functionality stays identical.
 */
export function EditModalForm({
  visible,
  fieldKey,
  title,
  cardBg = '#0D1117',
  textColor = '#FFFFFF',
  mutedColor = 'rgba(255,255,255,0.55)',
  borderColor = 'rgba(255,255,255,0.12)',
  doneGradient = ['#C084FC', '#FF4D8D'], // premium purple → deep pink
  /** When false, sheet chrome (handle, cancel fill) uses light-mode neutrals */
  isDark = true,
  children,
  onClose,
  onDone,
}) {
  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: cardBg, borderColor }]}>
          <View
            style={[
              styles.dragHandle,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.12)' },
            ]}
          />

          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: mutedColor }]}>Edit Field</Text>
              <Text style={[styles.title, { color: textColor }]} numberOfLines={1}>
                {title || fieldKey || 'Field'}
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
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.04)',
                },
              ]}
              activeOpacity={0.9}
            >
              <Text style={[styles.cancelText, { color: textColor }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onDone} style={styles.saveBtnWrap} activeOpacity={0.9}>
              <LinearGradient
                colors={doneGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtn}
              >
                <Text style={styles.saveText}>Done</Text>
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

