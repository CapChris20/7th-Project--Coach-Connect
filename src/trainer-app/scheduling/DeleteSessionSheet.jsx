// Design Law delete-session confirm sheet (scheduling PNG 15/16).
// Flow: parent sets pending session → NbSheet → Keep it / Delete → onConfirm deletes.
// Used by: BookSessionScreen detail sheet and ScheduleSessionScreen edit form.
// Read order: constants → name helper → sheet pieces → exported sheet → PLUMBING styles.
//
// vocab: NbSheet = bottom sheet chrome; warning pill = small orange→red chip (accent only)
// Manipulate here: pill copy template (“{Name} is told”) and confirmation body sentence

import React, { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const WARNING_GRADIENT = accentGradients[1];
const SHEET_TITLE = 'Delete Session';
const FALLBACK_CLIENT_NAME = 'Client';
const KEEP_BUTTON_LABEL = 'Keep it';
const DELETE_BUTTON_LABEL = 'Delete';
const DELETE_BUSY_LABEL = 'Deleting…';
// Same ink as NbPill gradient labels — readable on orange→red chips.
const GRADIENT_PILL_INK = '#0A0A0F';

// ===== HELPER FUNCTIONS =====

/**
 * First word of the client’s full name for the warning pill + body copy.
 * @param {string} fullName
 * @returns {string}
 */
function clientFirstNameFromFullName(fullName) {
  const trimmedName = String(fullName || FALLBACK_CLIENT_NAME).trim();
  const nameParts = trimmedName.split(/\s+/);
  const firstPart = nameParts[0];
  if (firstPart) {
    return firstPart;
  }
  return FALLBACK_CLIENT_NAME;
}

/**
 * Build the pill label and confirmation paragraph from the first name.
 * @param {string} clientFirstName
 * @returns {{ warningPillLabel: string, confirmationBody: string }}
 */
function buildDeleteSessionCopy(clientFirstName) {
  // Manipulate here: change the told / cancelled wording for both themes at once
  const warningPillLabel = `${clientFirstName} is told`;
  const confirmationBody = `Are you sure? ${clientFirstName} gets a note that this session was cancelled.`;
  return { warningPillLabel, confirmationBody };
}

/**
 * Orange→red “{Name} is told” chip above the title (accent only — not a solid purple).
 */
function WarningToldPill({ warningPillLabel, borderColor }) {
  return (
    <LinearGradient
      colors={WARNING_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.warningPill, { borderColor }]}
    >
      <Text style={styles.warningText}>{warningPillLabel}</Text>
    </LinearGradient>
  );
}

/**
 * Title + body copy under the warning pill.
 */
function DeleteSessionCopyBlock({ titleInk, mutedInk, confirmationBody }) {
  return (
    <>
      <Text style={[styles.title, { color: titleInk }]}>{SHEET_TITLE}</Text>
      <Text style={[styles.copy, { color: mutedInk }]}>{confirmationBody}</Text>
    </>
  );
}

/**
 * Keep it (plain) + Delete (fill) — both disabled while the parent is deleting.
 */
function DeleteSessionActionRow({
  onClose,
  onConfirmPress,
  deleteButtonLabel,
  busy,
}) {
  return (
    <View style={styles.row}>
      <NbButton variant="plain" onPress={onClose} style={styles.half} disabled={busy}>
        {KEEP_BUTTON_LABEL}
      </NbButton>
      <NbButton
        variant="fill"
        onPress={onConfirmPress}
        style={styles.half}
        disabled={busy}
      >
        {deleteButtonLabel}
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm sheet before a trainer deletes a booked session.
 * @param {{ visible: boolean, onClose: Function, onConfirm: Function, clientName?: string, busy?: boolean }} props
 */
export default function DeleteSessionSheet({
  visible,
  onClose,
  onConfirm,
  clientName = FALLBACK_CLIENT_NAME,
  busy = false,
}) {
  // 1. Theme tokens for sheet copy (not the gradient pill ink).
  // vocab: useTheme = Design Law light/dark color bag for nbInk / nbMuted / nbBorder
  const { colors } = useTheme();

  // 2. Personalize pill + body without re-parsing the name every render.
  // vocab: useMemo = recompute only when clientName changes
  const clientFirstName = useMemo(
    () => clientFirstNameFromFullName(clientName),
    [clientName],
  );
  const { warningPillLabel, confirmationBody } =
    buildDeleteSessionCopy(clientFirstName);

  // 3. Name the Delete button label before JSX (busy → “Deleting…”).
  let deleteButtonLabel = DELETE_BUTTON_LABEL;
  if (busy) {
    deleteButtonLabel = DELETE_BUSY_LABEL;
  }

  // 4. Confirm hands back to the parent; parent owns the actual delete write.
  const handleConfirmPress = () => {
    if (!onConfirm) {
      return;
    }
    onConfirm();
  };

  return (
    <NbSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <WarningToldPill
          warningPillLabel={warningPillLabel}
          borderColor={colors.nbBorder}
        />
        <DeleteSessionCopyBlock
          titleInk={colors.nbInk}
          mutedInk={colors.nbMuted}
          confirmationBody={confirmationBody}
        />
        <DeleteSessionActionRow
          onClose={onClose}
          onConfirmPress={handleConfirmPress}
          deleteButtonLabel={deleteButtonLabel}
          busy={busy}
        />
      </View>
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
    color: GRADIENT_PILL_INK,
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
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  half: { flex: 1 },
});
