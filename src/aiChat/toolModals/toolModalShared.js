import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AI_COACH_UI } from '../aiCoachUiTokens';

export const TOOL_MODAL_COLORS = {
  textPrimary: AI_COACH_UI.textPrimary,
  textSecondary: AI_COACH_UI.textSecondary,
  pink: AI_COACH_UI.pink,
  orange: AI_COACH_UI.orange,
  inputBg: AI_COACH_UI.surface,
};

export function DetailRow({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={sharedStyles.section}>
      {label ? <Text style={sharedStyles.label}>{label}</Text> : null}
      <Text style={sharedStyles.value}>{String(value)}</Text>
    </View>
  );
}

export function ToolModalBody({ title, children, reasoning }) {
  return (
    <View>
      <Text style={sharedStyles.title}>{title}</Text>
      {reasoning ? <Text style={sharedStyles.reasoning}>{reasoning}</Text> : null}
      {children}
    </View>
  );
}

const BTN_H = 48;

export function ConfirmCancelRow({ onConfirm, onCancel, loading, confirmLabel = 'Confirm' }) {
  return (
    <View style={sharedStyles.buttons}>
      <Pressable
        style={({ pressed }) => [
          sharedStyles.cancelButton,
          pressed && !loading ? { opacity: 0.85 } : null,
        ]}
        onPress={onCancel}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        accessibilityState={{ disabled: loading }}
      >
        <Text style={sharedStyles.cancelText}>Cancel</Text>
      </Pressable>
      <Pressable
        onPress={onConfirm}
        disabled={loading}
        style={({ pressed }) => [
          sharedStyles.confirmPressable,
          pressed && !loading ? { opacity: 0.92 } : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel="Confirm"
        accessibilityHint="Applies this coach action in the app"
        accessibilityState={{ disabled: loading }}
      >
        <LinearGradient
          colors={AI_COACH_UI.gradient.ctaWarm}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={sharedStyles.confirmGradient}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={sharedStyles.confirmText}>{confirmLabel}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: TOOL_MODAL_COLORS.textPrimary,
    marginBottom: 8,
  },
  reasoning: {
    fontSize: 13,
    color: TOOL_MODAL_COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  section: { marginBottom: 10 },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: TOOL_MODAL_COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    fontSize: 14,
    color: TOOL_MODAL_COLORS.textPrimary,
    fontWeight: '600',
    lineHeight: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    height: BTN_H,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cancelText: {
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmPressable: {
    flex: 1,
    height: BTN_H,
  },
  confirmGradient: {
    width: '100%',
    height: BTN_H,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  confirmText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
