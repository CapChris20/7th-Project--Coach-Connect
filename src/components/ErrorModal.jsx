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

/**
 * CoachConnect-styled error / alert modal (gradient rim, glass inner, optional retry).
 * Uses Ionicons names (default `alert-circle`).
 */
export function ErrorModal({
  visible = false,
  title = 'Error',
  message = 'Something went wrong.',
  icon = 'alert-circle',
  onDismiss,
  onRetry,
  retryText = 'Retry',
}) {
  const { width } = useWindowDimensions();
  const maxCard = Math.min(500, width * 0.9);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss || (() => {})}>
      <View style={styles.overlay}>
        <View style={[styles.cardWrap, { width: maxCard }]}>
          <LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.borderRing}>
            <View style={styles.card}>
              <Ionicons name={icon} size={48} color={COLORS.pink} style={styles.icon} />

              <Text style={styles.title}>{title}</Text>

              <Text style={styles.message}>{message}</Text>

              <View style={[styles.buttonRow, !onRetry && styles.buttonRowSingle]}>
                <TouchableOpacity
                  style={[styles.dismissButton, !onRetry && styles.dismissButtonFull]}
                  onPress={onDismiss}
                  activeOpacity={0.85}
                >
                  <Text style={styles.dismissButtonText}>Dismiss</Text>
                </TouchableOpacity>

                {onRetry ? (
                  <LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.retryGradient}>
                    <TouchableOpacity style={styles.retryTouchable} onPress={onRetry} activeOpacity={0.88}>
                      <Text style={styles.retryButtonText}>{retryText}</Text>
                    </TouchableOpacity>
                  </LinearGradient>
                ) : null}
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

export default ErrorModal;

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
    ...Platform.select({
      ios: {
        shadowColor: COLORS.pink,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 14 },
    }),
  },
  borderRing: {
    borderRadius: 16,
    padding: 2.5,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 13,
    color: COLORS.textSecondary,
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
  dismissButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: COLORS.pink,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissButtonFull: {
    flex: 0,
    width: '100%',
  },
  dismissButtonText: {
    color: COLORS.pink,
    fontSize: 14,
    fontWeight: '700',
  },
  retryGradient: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  retryTouchable: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
