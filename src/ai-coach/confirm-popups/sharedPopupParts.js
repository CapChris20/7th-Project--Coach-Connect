// Shared pieces for AI-coach confirm popups (neobrutalist design): labeled value, title body, and Confirm/Cancel.
// Flow: DetailRow hides empty values → ToolModalBody stacks title + optional reasoning → ConfirmCancelRow.
// Used by: every confirm-popup in this folder (log water, book session, delete, …).
//
// vocab: NbButton = neobrutalist button with thick border, hard shadow, gradient fill
// vocab: NbCard = neobrutalist card for detail sections

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useColorScheme } from 'react-native';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_CONFIRM_LABEL = 'Confirm';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_ACCESSIBILITY_HINT = 'Applies this coach action in the app';
const SPINNER_COLOR = '#0A0A0F';

// ===== HELPER FUNCTIONS =====

function DetailLabel({ label, colors }) {
  if (!label) return null;
  return <Text style={[sharedStyles.label, { color: colors.nbMuted }]}>{label}</Text>;
}

function ReasoningLine({ reasoning, colors }) {
  if (!reasoning) return null;
  return <Text style={[sharedStyles.reasoning, { color: colors.nbMuted }]}>{reasoning}</Text>;
}

// ===== MAIN FUNCTION =====

/**
 * Date row text for a log popup: the tool's date, or "Today" when it omits
 * one (every log writer defaults to today). Popups that skip this row leave
 * the user guessing which day they are about to write to.
 * @param {object|undefined} params
 * @returns {string}
 */
export function logDateLabel(params) {
  const date = params?.date;
  return date ? String(date) : 'Today';
}

/**
 * One labeled value. Hidden when the value is empty so the popup does not show blank rows.
 * @param {{ label?: string, value?: * }} props
 */
export function DetailRow({ label, value }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const valueIsMissing = value == null || value === '';
  if (valueIsMissing) return null;

  return (
    <View style={sharedStyles.section}>
      <DetailLabel label={label} colors={colors} />
      <Text style={[sharedStyles.value, { color: colors.nbInk }]}>{String(value)}</Text>
    </View>
  );
}

/**
 * Title, optional "why the coach wants this", then the popup's own fields.
 * @param {{ title: string, children?: *, reasoning?: string }} props
 */
export function ToolModalBody({ title, children, reasoning }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  return (
    <View>
      <Text style={[sharedStyles.title, { color: colors.nbInk }]}>{title}</Text>
      <ReasoningLine reasoning={reasoning} colors={colors} />
      {children}
    </View>
  );
}

/**
 * Cancel (plain) + Confirm (brand gradient). Confirm shows a spinner while the action runs.
 * Uses neobrutalist NbButton components.
 * @param {{ onConfirm: Function, onCancel: Function, loading?: boolean, confirmLabel?: string }} props
 */
export function ConfirmCancelRow({ onConfirm, onCancel, loading, confirmLabel = DEFAULT_CONFIRM_LABEL }) {
  // Show spinner inside the confirm button label when loading
  const confirmContent = loading ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <ActivityIndicator color={SPINNER_COLOR} size="small" />
      <Text>{confirmLabel}</Text>
    </View>
  ) : (
    confirmLabel
  );
  
  return (
    <View style={sharedStyles.buttons}>
      <View style={{ flex: 1 }}>
        <NbButton
          variant="plain"
          onPress={onCancel}
          disabled={loading}
        >
          {CANCEL_LABEL}
        </NbButton>
      </View>
      <View style={{ flex: 1 }}>
        <NbButton
          variant="brand"
          onPress={onConfirm}
          disabled={loading}
        >
          {confirmContent}
        </NbButton>
      </View>
    </View>
  );
}

const sharedStyles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: spacing.sm,
  },
  reasoning: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.sm + 2 },
  label: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: {
    fontSize: 15,
    fontFamily: 'Inter_600Semi',
    fontWeight: '600',
    lineHeight: 21,
  },
  buttons: {
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginTop: spacing.md + 4,
    width: '100%',
  },
});
