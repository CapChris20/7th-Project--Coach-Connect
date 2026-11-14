// In-app confirm / error sheet — Design Law stand-in for many Alert.alert calls.
// Flow: parent owns visible + copy → sheet shows title/body → Confirm always → optional Cancel → both close.
// Used by: settings, files, chat, home when Design Law wants a sheet (not a true OS alert).
//
// vocab: NbSheet = shared bottom/modal chrome; this file only fills the body + action buttons
// Keep real OS permission prompts as Alert / system sheets — this is in-app confirm/error only.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NbButton from './NbButton';
import NbSheet from './NbSheet';
import { spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: space between Confirm and Cancel; raise if thumbs hit both at once
const GAP_BETWEEN_ACTIONS = 10;
const DEFAULT_CONFIRM_LABEL = 'OK';

// ===== HELPER FUNCTIONS =====

// Cancel only when the parent passed a real non-empty string (empty string = confirm-only sheet).
function cancelButtonShouldShow(cancelLabel) {
  const labelIsAString = typeof cancelLabel === 'string';
  if (!labelIsAString) {
    return false;
  }
  const labelHasText = cancelLabel.length > 0;
  return labelHasText;
}

// Confirm always closes the sheet after the parent callback (if any) runs.
function pressConfirmThenClose(onConfirm, onClose) {
  const confirmIsAFunction = typeof onConfirm === 'function';
  if (confirmIsAFunction) {
    onConfirm();
  }
  const closeIsAFunction = typeof onClose === 'function';
  if (closeIsAFunction) {
    onClose();
  }
}

// Cancel path mirrors confirm: optional parent callback, then always close.
function pressCancelThenClose(onCancel, onClose) {
  const cancelIsAFunction = typeof onCancel === 'function';
  if (cancelIsAFunction) {
    onCancel();
  }
  const closeIsAFunction = typeof onClose === 'function';
  if (closeIsAFunction) {
    onClose();
  }
}

// vocab: destructive flag is reserved for future red-ink copy — confirm fill stays black (never green)
// Calling this keeps the prop “used” the same way HEAD’s `{destructive ? null : null}` did.
function reservedDestructiveSlot(_destructiveFlag) {
  return null;
}

// ===== SMALL UI PIECES =====

function NoticeBodyMessage({ message, mutedTextColor }) {
  if (!message) {
    return null;
  }
  return (
    <Text style={[styles.message, { color: mutedTextColor }]}>{message}</Text>
  );
}

function NoticeCancelAction({ cancelLabel, onCancel, onClose }) {
  return (
    <>
      <View style={{ height: GAP_BETWEEN_ACTIONS }} />
      <NbButton
        variant="ghost"
        onPress={() => pressCancelThenClose(onCancel, onClose)}
      >
        {cancelLabel}
      </NbButton>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law notice sheet: title, optional body, Confirm, optional Cancel.
 *
 * @param {{
 *   visible: boolean,
 *   onClose: () => void,
 *   title: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   onConfirm?: () => void,
 *   onCancel?: () => void,
 *   cancelLabel?: string,
 *   destructive?: boolean,
 *   confirmDisabled?: boolean,
 * }} props
 */
export default function NbNoticeSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel = DEFAULT_CONFIRM_LABEL,
  onConfirm,
  onCancel,
  cancelLabel,
  destructive = false,
  confirmDisabled = false,
}) {
  const { colors } = useTheme();

  // 1. Decide if the Cancel ghost button belongs on this sheet.
  const showCancelButton = cancelButtonShouldShow(cancelLabel);

  // 2. Treat any truthy visible the same as a boolean open flag for NbSheet.
  const sheetIsOpen = Boolean(visible);

  // 3. Hold the reserved destructive prop so call sites keep passing it safely.
  const unusedDestructiveSlot = reservedDestructiveSlot(destructive);

  return (
    <NbSheet visible={sheetIsOpen} onClose={onClose} title={title}>
      <View style={styles.body}>
        <NoticeBodyMessage message={message} mutedTextColor={colors.nbMuted} />
        <NbButton
          variant="fill"
          disabled={confirmDisabled}
          onPress={() => pressConfirmThenClose(onConfirm, onClose)}
        >
          {confirmLabel}
        </NbButton>
        {showCancelButton ? (
          <NoticeCancelAction
            cancelLabel={cancelLabel}
            onCancel={onCancel}
            onClose={onClose}
          />
        ) : null}
        {unusedDestructiveSlot}
      </View>
    </NbSheet>
  );
}

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  body: {
    paddingBottom: spacing.lg,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 16,
  },
});
