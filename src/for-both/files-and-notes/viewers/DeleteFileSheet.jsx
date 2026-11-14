// Design Law delete confirm for Notes & Files (PNG 11–12).
// Flow: parent sets pending item → NbSheet opens → Cancel closes, Delete confirms then closes.
// Used by FilesScreen, FilesSection, and file viewers that offer delete.

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbSheet from '../../../look-and-feel/NbSheet';
import NbButton from '../../../look-and-feel/NbButton';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: warning pill copy + gradient index (orange→red family)
const WARNING_PILL_LABEL = 'Removes it from your files';
const WARNING_PILL_GRADIENT = accentGradients[1];
const DEFAULT_SHEET_TITLE = 'Delete file?';
const DEFAULT_SHEET_BODY = 'This will remove it from your files.';
const DEFAULT_CONFIRM_LABEL = 'Delete';
const GRADIENT_LEFT_TO_RIGHT_START = { x: 0, y: 0 };
const GRADIENT_LEFT_TO_RIGHT_END = { x: 1, y: 0 };
// Design Law pill text sits on a bright gradient — keep ink dark in both themes.
const WARNING_PILL_INK = '#0A0A0F';

// ===== HELPER FUNCTIONS =====

/**
 * Run the parent delete, then close the sheet so the grid is tappable again.
 * Order matters: confirm first so the parent still has the pending item.
 */
function runDeleteThenCloseSheet(onConfirm, onClose) {
  // 1. Let the parent delete Firestore + Storage for the pending file.
  if (typeof onConfirm === 'function') {
    onConfirm();
  }

  // 2. Close the sheet so the file grid can receive taps again.
  if (typeof onClose === 'function') {
    onClose();
  }
}

function warningPillStyleWithBorder(warningBorderColor) {
  return [styles.warningPill, { borderColor: warningBorderColor }];
}

function bodyCopyStyleWithColor(bodyTextColor) {
  return [styles.copy, { color: bodyTextColor }];
}

/**
 * Warning pill + body copy + Cancel / Delete row (no hooks).
 */
function DeleteFileSheetBody({
  warningBorderColor,
  bodyTextColor,
  bodyCopy,
  confirmLabel,
  onCancelPress,
  onConfirmPress,
}) {
  const warningPillStyle = warningPillStyleWithBorder(warningBorderColor);
  const bodyCopyStyle = bodyCopyStyleWithColor(bodyTextColor);

  return (
    <View style={styles.body}>
      <LinearGradient
        colors={WARNING_PILL_GRADIENT}
        start={GRADIENT_LEFT_TO_RIGHT_START}
        end={GRADIENT_LEFT_TO_RIGHT_END}
        style={warningPillStyle}
      >
        <Text style={styles.warningText}>{WARNING_PILL_LABEL}</Text>
      </LinearGradient>

      <Text style={bodyCopyStyle}>{bodyCopy}</Text>

      <View style={styles.row}>
        <NbButton variant="plain" onPress={onCancelPress} style={styles.half}>
          Cancel
        </NbButton>
        <NbButton variant="fill" onPress={onConfirmPress} style={styles.half}>
          {confirmLabel}
        </NbButton>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom-sheet confirm before removing a file from Notes & Files.
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
  title = DEFAULT_SHEET_TITLE,
  body = DEFAULT_SHEET_BODY,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
}) {
  // vocab: useTheme = Design Law light/dark token bag (nbBorder, nbMuted, …)
  const { colors } = useTheme();

  const handleConfirmPress = () => {
    // 1. Delete via parent, then close.
    runDeleteThenCloseSheet(onConfirm, onClose);
  };

  const handleCancelPress = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  return (
    <NbSheet visible={visible} onClose={onClose} title={title}>
      <DeleteFileSheetBody
        warningBorderColor={colors.nbBorder}
        bodyTextColor={colors.nbMuted}
        bodyCopy={body}
        confirmLabel={confirmLabel}
        onCancelPress={handleCancelPress}
        onConfirmPress={handleConfirmPress}
      />
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
    color: WARNING_PILL_INK,
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
