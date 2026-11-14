// Design Law remove-client confirm (trainees PNG 17/18).
// Flow: open from roster swipe / manage ⋯ → summary rows → Cancel / Remove from roster.
// Used by MyTraineesScreen, ManageTraineeScreen, TrainerHomeContent.
//
// vocab: accent pill = small orange→red “Unlinks {Name}” chip only
// Manipulate here: SUMMARY_ROWS labels / right-side status words

import React, { useMemo } from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: warning pill gradient index in accentGradients (Design Law orange→red)
const WARNING_GRADIENT = accentGradients[1];

const SHEET_TITLE = 'Remove client?';
const BODY_COPY =
  'They will be unlinked from you in Coach Connect. You can invite them again later if you change your mind.';
const FALLBACK_CLIENT_NAME = 'Client';
const CANCEL_LABEL = 'Cancel';
const CONFIRM_LABEL = 'Remove from roster';

// Manipulate here: what the summary card promises about plans / logs / billing
const SUMMARY_ROWS = [
  { label: 'Plans and notes', value: 'Kept' },
  { label: 'New logs', value: 'Stop' },
  { label: 'Billing', value: 'Stops' },
];

// ===== HELPER FUNCTIONS =====

/**
 * First word of the client’s display name for the “Unlinks …” pill.
 * @param {string} fullName
 * @returns {string}
 */
function clientFirstName(fullName) {
  const trimmed = String(fullName || FALLBACK_CLIENT_NAME).trim();
  const words = trimmed.split(/\s+/);
  return words[0] || FALLBACK_CLIENT_NAME;
}

/**
 * One label/value row inside the summary card.
 * Divider under every row except the last.
 */
function RemoveSummaryRow({ row, index, rowCount, borderColor, colors }) {
  const showDivider = index < rowCount - 1;
  const dividerStyle = showDivider
    ? {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: borderColor,
      }
    : null;

  return (
    <View style={[styles.summaryRow, dividerStyle]}>
      <Text style={[styles.summaryLabel, { color: colors.nbInk }]}>{row.label}</Text>
      <Text style={[styles.summaryValue, { color: colors.nbMuted }]}>{row.value}</Text>
    </View>
  );
}

/**
 * Build the summary-row React elements once so the layout stays a short list.
 */
function buildSummaryRowElements(colors) {
  const rowCount = SUMMARY_ROWS.length;
  const rowElements = [];

  for (let index = 0; index < rowCount; index += 1) {
    const row = SUMMARY_ROWS[index];
    rowElements.push(
      <RemoveSummaryRow
        key={row.label}
        row={row}
        index={index}
        rowCount={rowCount}
        borderColor={colors.nbBorder}
        colors={colors}
      />,
    );
  }

  return rowElements;
}

/**
 * Pure layout for the sheet body — no hooks.
 * Keeps the exported component to: theme → first name → wrap in NbSheet.
 */
function RemoveClientSheetLayout({
  colors,
  clientFirstNameLabel,
  onClose,
  onConfirm,
  busy,
}) {
  const warningPillLabel = `Unlinks ${clientFirstNameLabel}`;
  const summaryRowElements = buildSummaryRowElements(colors);

  // Name the confirm button content before JSX (spinner vs label).
  let confirmButtonContent = CONFIRM_LABEL;
  if (busy) {
    confirmButtonContent = <ActivityIndicator color={colors.nbOnFill} />;
  }

  return (
    <View style={styles.body}>
      <LinearGradient
        colors={WARNING_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.warningPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={styles.warningText}>{warningPillLabel}</Text>
      </LinearGradient>

      <Text style={[styles.title, { color: colors.nbInk }]}>{SHEET_TITLE}</Text>
      <Text style={[styles.copy, { color: colors.nbMuted }]}>{BODY_COPY}</Text>

      <NbCard style={styles.summaryCard}>{summaryRowElements}</NbCard>

      <View style={styles.actionRow}>
        <NbButton variant="plain" onPress={onClose} style={styles.halfWidth} disabled={busy}>
          {CANCEL_LABEL}
        </NbButton>
        <NbButton
          variant="fill"
          onPress={() => onConfirm?.()}
          style={styles.halfWidth}
          disabled={busy}
        >
          {confirmButtonContent}
        </NbButton>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm sheet before unlinking a client from the trainer roster.
 * Flow: 1. theme  2. first name for the pill  3. paint NbSheet layout
 *
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onConfirm: Function,
 *   clientName?: string,
 *   busy?: boolean,
 * }} props
 */
export default function RemoveClientSheet({
  visible,
  onClose,
  onConfirm,
  clientName = FALLBACK_CLIENT_NAME,
  busy = false,
}) {
  // vocab: useTheme = Design Law light/dark palette hook (colors.nbInk, nbMuted, …)
  const { colors } = useTheme();

  // 1. First name for the warning pill (memo so we don’t re-split on every paint).
  // vocab: useMemo = cache a value until clientName changes
  const clientFirstNameLabel = useMemo(() => clientFirstName(clientName), [clientName]);

  // 2. Wrap the pure layout in NbSheet (visible / onClose stay on the shell).
  return (
    <NbSheet visible={visible} onClose={onClose}>
      <RemoveClientSheetLayout
        colors={colors}
        clientFirstNameLabel={clientFirstNameLabel}
        onClose={onClose}
        onConfirm={onConfirm}
        busy={busy}
      />
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: 12,
  },
  warningPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
  },
  warningText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    // Manipulate here: pill text stays near-black on the orange→red gradient in both themes
    color: '#0A0A0F',
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    letterSpacing: -0.3,
  },
  copy: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCard: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  summaryLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  summaryValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  halfWidth: { flex: 1 },
});
