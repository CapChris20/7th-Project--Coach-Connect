// Design Law replacement for many Alert.alert calls — title, body, one or two NbButtons.
// Flow: parent owns visible + message state → Confirm / Cancel → clear state.
// Used by settings, files, chat, home when Design Law shows a sheet (not a true OS alert).
//
// vocab: destructive = fill confirm for delete/block style actions (still black fill, never green)
// Keep real OS permission prompts as Alert / system sheets — this is for in-app confirm/error copy.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NbButton from './NbButton';
import NbSheet from './NbSheet';
import { spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== MAIN FUNCTION =====

/**
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
  confirmLabel = 'OK',
  onConfirm,
  onCancel,
  cancelLabel,
  destructive = false,
  confirmDisabled = false,
}) {
  const { colors } = useTheme();
  const showCancel = typeof cancelLabel === 'string' && cancelLabel.length > 0;

  return (
    <NbSheet visible={!!visible} onClose={onClose} title={title}>
      <View style={styles.body}>
        {message ? (
          <Text style={[styles.message, { color: colors.nbMuted }]}>{message}</Text>
        ) : null}
        <NbButton
          variant="fill"
          disabled={confirmDisabled}
          onPress={() => {
            onConfirm?.();
            onClose?.();
          }}
        >
          {confirmLabel}
        </NbButton>
        {showCancel ? (
          <>
            <View style={{ height: 10 }} />
            <NbButton
              variant="ghost"
              onPress={() => {
                onCancel?.();
                onClose?.();
              }}
            >
              {cancelLabel}
            </NbButton>
          </>
        ) : null}
        {/* destructive is reserved for future red-ink copy; Design Law confirm stays fill black */}
        {destructive ? null : null}
      </View>
    </NbSheet>
  );
}

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
