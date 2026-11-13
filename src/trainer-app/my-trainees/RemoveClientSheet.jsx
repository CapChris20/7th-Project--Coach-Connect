// Design Law remove-client confirm (trainees PNG 17/18).
// Flow: open from roster swipe / manage ⋯ → summary rows → Cancel / Remove from roster.
// Used by MyTraineesScreen, ManageTraineeScreen, TrainerHomeContent.
//
// vocab: accent pill = small orange→red “Unlinks {Name}” chip only
// Manipulate here: summary row labels / right-side status words

import React, { useMemo } from 'react';
import { Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const WARNING_GRADIENT = accentGradients[1];
const TITLE = 'Remove client?';
const SUMMARY_ROWS = [
  { label: 'Plans and notes', value: 'Kept' },
  { label: 'New logs', value: 'Stop' },
  { label: 'Billing', value: 'Stops' },
];

// ===== HELPERS =====

function firstName(fullName) {
  const text = String(fullName || 'Client').trim();
  return text.split(/\s+/)[0] || 'Client';
}

// ===== MAIN =====

/**
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
  clientName = 'Client',
  busy = false,
}) {
  const { colors } = useTheme();
  const first = useMemo(() => firstName(clientName), [clientName]);
  const body =
    'They will be unlinked from you in Coach Connect. You can invite them again later if you change your mind.';

  return (
    <NbSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <LinearGradient
          colors={WARNING_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.warningPill, { borderColor: colors.nbBorder }]}
        >
          <Text style={styles.warningText}>{`Unlinks ${first}`}</Text>
        </LinearGradient>

        <Text style={[styles.title, { color: colors.nbInk }]}>{TITLE}</Text>
        <Text style={[styles.copy, { color: colors.nbMuted }]}>{body}</Text>

        <NbCard style={styles.summaryCard}>
          {SUMMARY_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={[
                styles.summaryRow,
                index < SUMMARY_ROWS.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.nbBorder,
                },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: colors.nbInk }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: colors.nbMuted }]}>{row.value}</Text>
            </View>
          ))}
        </NbCard>

        <View style={styles.row}>
          <NbButton variant="plain" onPress={onClose} style={styles.half} disabled={busy}>
            Cancel
          </NbButton>
          <NbButton
            variant="fill"
            onPress={() => onConfirm?.()}
            style={styles.half}
            disabled={busy}
          >
            {busy ? <ActivityIndicator color={colors.nbOnFill} /> : 'Remove from roster'}
          </NbButton>
        </View>
      </View>
    </NbSheet>
  );
}

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
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  half: { flex: 1 },
});
