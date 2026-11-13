// Design Law delete-session confirm (scheduling PNG 15/16).
// Flow: parent sets pending session → NbSheet → Keep it / Delete → onConfirm deletes.
// Used by BookSessionScreen detail sheet and ScheduleSessionScreen edit form.
//
// vocab: NbSheet = bottom sheet; accent pill = small orange→red chip only (not chrome)
// Manipulate here: pill copy template (“{Name} is told”)

import React, { useMemo } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const WARNING_GRADIENT = accentGradients[1];
const TITLE = 'Delete Session';

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
export default function DeleteSessionSheet({
  visible,
  onClose,
  onConfirm,
  clientName = 'Client',
  busy = false,
}) {
  const { colors } = useTheme();
  const first = useMemo(() => firstName(clientName), [clientName]);
  const pillLabel = `${first} is told`;
  const body = `Are you sure? ${first} gets a note that this session was cancelled.`;

  return (
    <NbSheet visible={visible} onClose={onClose}>
      <View style={styles.body}>
        <LinearGradient
          colors={WARNING_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.warningPill, { borderColor: colors.nbBorder }]}
        >
          <Text style={styles.warningText}>{pillLabel}</Text>
        </LinearGradient>

        <Text style={[styles.title, { color: colors.nbInk }]}>{TITLE}</Text>
        <Text style={[styles.copy, { color: colors.nbMuted }]}>{body}</Text>

        <View style={styles.row}>
          <NbButton variant="plain" onPress={onClose} style={styles.half} disabled={busy}>
            Keep it
          </NbButton>
          <NbButton
            variant="fill"
            onPress={() => onConfirm?.()}
            style={styles.half}
            disabled={busy}
          >
            {busy ? 'Deleting…' : 'Delete'}
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
  row: { flexDirection: 'row', gap: 12, marginTop: 8 },
  half: { flex: 1 },
});
