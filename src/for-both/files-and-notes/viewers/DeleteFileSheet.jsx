// Design Law delete confirm for Notes & Files (PNG 11–12).
// Flow: parent sets pending item → NbSheet → Cancel / Delete.
// Used by FilesScreen, FilesSection, and file viewers that offer delete.
// vocab: NbSheet = bottom sheet; accent pill uses accentGradients (small accent only)

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../../look-and-feel/NbSheet';
import NbButton from '../../../look-and-feel/NbButton';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: warning pill copy + gradient index (orange→red family)
const WARNING_LABEL = 'Removes it from your files';
const WARNING_GRADIENT = accentGradients[1];
const DEFAULT_TITLE = 'Delete file?';
const DEFAULT_BODY = 'This will remove it from your files.';

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onConfirm: Function,
 *   title?: string,
 *   body?: string,
 *   confirmLabel?: string,
 * }} props
 */
export default function DeleteFileSheet({
  visible,
  onClose,
  onConfirm,
  title = DEFAULT_TITLE,
  body = DEFAULT_BODY,
  confirmLabel = 'Delete',
}) {
  const { colors } = useTheme();

  return (
    <NbSheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        <LinearGradient
          colors={WARNING_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.warningPill, { borderColor: colors.nbBorder }]}
        >
          <Text style={styles.warningText}>{WARNING_LABEL}</Text>
        </LinearGradient>

        <Text style={[styles.copy, { color: colors.nbMuted }]}>{body}</Text>

        <View style={styles.row}>
          <NbButton variant="plain" onPress={onClose} style={styles.half}>
            Cancel
          </NbButton>
          <NbButton
            variant="fill"
            onPress={() => {
              onConfirm?.();
              onClose?.();
            }}
            style={styles.half}
          >
            {confirmLabel}
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
    gap: 14,
  },
  warningPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0F',
  },
  copy: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  half: { flex: 1 },
});
