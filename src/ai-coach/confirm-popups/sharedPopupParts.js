// Shared pieces for AI-coach confirm popups: a labeled value, a title body, and Confirm/Cancel.
// Flow: DetailRow hides empty values → ToolModalBody stacks title + optional reasoning → ConfirmCancelRow.
// Used by: every confirm-popup in this folder (log water, book session, delete, …).

import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AI_COACH_UI } from '../coachColors';

// ===== NAMED CONSTANTS =====

export const TOOL_MODAL_COLORS = {
  textPrimary: AI_COACH_UI.textPrimary,
  textSecondary: AI_COACH_UI.textSecondary,
  pink: AI_COACH_UI.pink,
  orange: AI_COACH_UI.orange,
  inputBg: AI_COACH_UI.surface,
};

const DEFAULT_CONFIRM_LABEL = 'Confirm';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_ACCESSIBILITY_HINT = 'Applies this coach action in the app';
// Manipulate here: lower pressed opacity = subtler tap feedback on the ghost Cancel button.
const PRESSED_CANCEL_OPACITY = 0.85;
const PRESSED_CONFIRM_OPACITY = 0.92;
const SPINNER_COLOR = '#fff';
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 0 };

// ===== HELPER FUNCTIONS =====

/**
 * Pressable feedback while the confirm action is not running.
 * @param {boolean} isPressed
 * @param {boolean} isLoading
 * @param {number} pressedOpacity
 * @returns {object|null}
 */
function buildPressedFeedbackStyle(isPressed, isLoading, pressedOpacity) {
  const shouldDim = isPressed && !isLoading;
  if (!shouldDim) return null;
  return { opacity: pressedOpacity };
}

function DetailLabel({ label }) {
  if (!label) return null;
  return <Text style={sharedStyles.label}>{label}</Text>;
}

function ReasoningLine({ reasoning }) {
  if (!reasoning) return null;
  return <Text style={sharedStyles.reasoning}>{reasoning}</Text>;
}

function ConfirmButtonFace({ isLoading, confirmLabel }) {
  if (isLoading) {
    return <ActivityIndicator color={SPINNER_COLOR} />;
  }
  return <Text style={sharedStyles.confirmText}>{confirmLabel}</Text>;
}

/**
 * Cancel ghost button on the left of every tool confirm sheet.
 * @param {{ onCancel: Function, loading?: boolean }} props
 */
function CancelToolButton({ onCancel, loading }) {
  return (
    <Pressable
      style={({ pressed }) => [
        sharedStyles.cancelButton,
        buildPressedFeedbackStyle(pressed, loading, PRESSED_CANCEL_OPACITY),
      ]}
      onPress={onCancel}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={CANCEL_LABEL}
      accessibilityState={{ disabled: loading }}
    >
      <Text style={sharedStyles.cancelText}>{CANCEL_LABEL}</Text>
    </Pressable>
  );
}

/**
 * Warm gradient confirm on the right. Spinner replaces the label while loading.
 * @param {{ onConfirm: Function, loading?: boolean, confirmLabel: string }} props
 */
function ConfirmToolButton({ onConfirm, loading, confirmLabel }) {
  const showSpinner = Boolean(loading);

  return (
    <Pressable
      onPress={onConfirm}
      disabled={loading}
      style={({ pressed }) => [
        sharedStyles.confirmPressable,
        buildPressedFeedbackStyle(pressed, loading, PRESSED_CONFIRM_OPACITY),
      ]}
      accessibilityRole="button"
      accessibilityLabel={DEFAULT_CONFIRM_LABEL}
      accessibilityHint={CONFIRM_ACCESSIBILITY_HINT}
      accessibilityState={{ disabled: loading }}
    >
      <LinearGradient
        colors={AI_COACH_UI.gradient.ctaWarm}
        start={GRADIENT_START}
        end={GRADIENT_END}
        style={sharedStyles.confirmGradient}
      >
        <ConfirmButtonFace isLoading={showSpinner} confirmLabel={confirmLabel} />
      </LinearGradient>
    </Pressable>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One labeled value. Hidden when the value is empty so the popup does not show blank rows.
 * @param {{ label?: string, value?: * }} props
 */
export function DetailRow({ label, value }) {
  const valueIsMissing = value == null || value === '';
  if (valueIsMissing) return null;

  return (
    <View style={sharedStyles.section}>
      <DetailLabel label={label} />
      <Text style={sharedStyles.value}>{String(value)}</Text>
    </View>
  );
}

/**
 * Title, optional "why the coach wants this", then the popup's own fields.
 * @param {{ title: string, children?: *, reasoning?: string }} props
 */
export function ToolModalBody({ title, children, reasoning }) {
  return (
    <View>
      <Text style={sharedStyles.title}>{title}</Text>
      <ReasoningLine reasoning={reasoning} />
      {children}
    </View>
  );
}

/**
 * Cancel (ghost) + Confirm (warm gradient). Confirm shows a spinner while the action runs.
 * @param {{ onConfirm: Function, onCancel: Function, loading?: boolean, confirmLabel?: string }} props
 */
export function ConfirmCancelRow({ onConfirm, onCancel, loading, confirmLabel = DEFAULT_CONFIRM_LABEL }) {
  return (
    <View style={sharedStyles.buttons}>
      <CancelToolButton onCancel={onCancel} loading={loading} />
      <ConfirmToolButton onConfirm={onConfirm} loading={loading} confirmLabel={confirmLabel} />
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
    height: 48,
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
    height: 48,
  },
  confirmGradient: {
    width: '100%',
    height: 48,
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
