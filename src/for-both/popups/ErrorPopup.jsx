// Design Law error / alert modal (loading-and-errors cannot-reach / form toasts).
// Flow: parent sets visible → Dismiss (onDismiss) or Retry (onRetry).
// Used by login and other screens that need a branded alert instead of a system Alert.

import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_TITLE = 'Error';
const DEFAULT_MESSAGE = 'Something went wrong.';
const DEFAULT_ICON = 'alert-circle-outline';
const DEFAULT_RETRY_TEXT = 'Retry';
const MAX_CARD_WIDTH = 500;
const CARD_WIDTH_RATIO = 0.9;
const ICON_SIZE = 40;

// ===== HELPER FUNCTIONS =====

function noop() {}

// ===== MAIN FUNCTION =====

/**
 * @param {{ visible?: boolean, title?: string, message?: string, icon?: string, onDismiss?: Function, onRetry?: Function, retryText?: string }} props
 */
export function ErrorPopup({
  visible = false,
  title = DEFAULT_TITLE,
  message = DEFAULT_MESSAGE,
  icon = DEFAULT_ICON,
  onDismiss,
  onRetry,
  retryText = DEFAULT_RETRY_TEXT,
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const maxCard = Math.min(MAX_CARD_WIDTH, width * CARD_WIDTH_RATIO);
  const hasRetry = Boolean(onRetry);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss || noop}>
      <View style={styles.overlay}>
        <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ width: maxCard }}>
          <NbCard noShadow style={styles.card}>
            <View style={styles.cardContent}>
              <View
                style={[
                  styles.iconWrap,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft },
                ]}
              >
                <Ionicons name={icon} size={ICON_SIZE} color={colors.nbInk} />
              </View>

              <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>
              <Text style={[styles.message, { color: colors.nbMuted }]}>{message}</Text>

              <View style={[styles.buttonRow, !hasRetry && styles.buttonRowSingle]}>
                <View style={{ flex: 1 }}>
                  <NbButton variant="ghost" onPress={onDismiss}>
                    Dismiss
                  </NbButton>
                </View>
                {hasRetry ? (
                  <View style={{ flex: 1 }}>
                    <NbButton variant="fill" onPress={onRetry}>
                      {retryText}
                    </NbButton>
                  </View>
                ) : null}
              </View>
            </View>
          </NbCard>
        </HardShadow>
      </View>
    </Modal>
  );
}

export default ErrorPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    padding: 0,
  },
  cardContent: {
    alignItems: 'center',
    padding: 20,
    gap: 10,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  buttonRowSingle: {
    justifyContent: 'center',
  },
});
