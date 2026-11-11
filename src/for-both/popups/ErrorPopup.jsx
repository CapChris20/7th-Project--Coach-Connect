// App-styled error / alert modal: neobrutalist card, icon, title, message, Dismiss, optional Retry.
// Flow: parent sets visible → user taps Dismiss (onDismiss) or Retry (onRetry).
// Used by login and other screens that need a branded alert instead of a system Alert.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { NbCard } from '../../look-and-feel/NbCard';
import { NbButton } from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

const COLORS = {
  bg: '#0A0A0F',
  cardBg: '#141419',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.4)',
  pink: '#FF6B9D',
  orange: '#F97316',
  cyan: '#06B6D4',
  purple: '#C084FC',
};

const CTA_GRADIENT = [COLORS.pink, COLORS.orange];
const DEFAULT_TITLE = 'Error';
const DEFAULT_MESSAGE = 'Something went wrong.';
const DEFAULT_ICON = 'alert-circle';
const DEFAULT_RETRY_TEXT = 'Retry';
const MAX_CARD_WIDTH = 500;
const CARD_WIDTH_RATIO = 0.9;
const ICON_SIZE = 48;

// ===== HELPER FUNCTIONS =====

function noop() {}

// ===== MAIN FUNCTION =====

/**
 * CoachConnect-styled error / alert modal (gradient rim, glass inner, optional retry).
 * Uses Ionicons names (default `alert-circle`).
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

  // 1. Dismiss always. Retry only when the parent passed onRetry.
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss || noop}>
      <View style={styles.overlay}>
        <View style={[styles.cardWrap, { width: maxCard }]}>
          <NbCard>
            <View style={styles.cardContent}>
              <Ionicons name={icon} size={ICON_SIZE} color={COLORS.pink} style={styles.icon} />

              <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>

              <Text style={[styles.message, { color: colors.nbMuted }]}>{message}</Text>

              <View style={[styles.buttonRow, !hasRetry && styles.buttonRowSingle]}>
                <View style={{ flex: 1 }}>
                  <NbButton variant="plain" onPress={onDismiss}>
                    Dismiss
                  </NbButton>
                </View>

                {hasRetry ? (
                  <View style={{ flex: 1 }}>
                    <NbButton variant="brand" onPress={onRetry}>
                      {retryText}
                    </NbButton>
                  </View>
                ) : null}
              </View>
            </View>
          </NbCard>
        </View>
      </View>
    </Modal>
  );
}

export default ErrorPopup;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardWrap: {
    maxWidth: 500,
  },
  cardContent: {
    alignItems: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    alignItems: 'stretch',
  },
  buttonRowSingle: {
    flexDirection: 'column',
  },
});
