/**
 * Post-signup payment setup modal — shown on trainer dashboard, not during onboarding.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStripeConnectFlow } from '../shared/payments/useStripeConnectFlow';
import { StripeConnectWebViewModal } from '../shared/payments/StripeConnectWebViewModal';
import { dismissPaymentSetupPopup } from '../shared/payments/paymentSetupPrompt';
import {
  HowPaymentsWorkSection,
  EarningsDashboardPreview,
  VenmoComparisonSection,
  TrainerPaymentFaqSnippet,
} from '../shared/payments/PaymentEducationSections';
import { auth } from '../app-start/config';

const PENDING_DONE_MS = 30000;
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const COLORS = {
  overlay: 'rgba(0,0,0,0.94)',
  card: '#111118',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.62)',
  accent: '#FF3D8A',
  accentSoft: 'rgba(255,61,138,0.14)',
};

export function PaymentSetupPopup({ visible, onClose, userEmail, stripeAccountId = '' }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingTimedOut, setPendingTimedOut] = useState(false);
  const pendingTimerRef = useRef(null);

  const email = String(userEmail || auth?.currentUser?.email || '').trim();

  const stripeConnect = useStripeConnectFlow({
    email,
    onActive: () => {
      setStatus('success');
      setLoading(false);
      setErrorMessage(null);
    },
  });

  useEffect(() => {
    if (stripeConnect.phase === 'connecting') {
      setStatus('connecting');
      setLoading(true);
      setErrorMessage(null);
    } else if (stripeConnect.phase === 'pending') {
      setStatus('verifying');
      setLoading(true);
      setErrorMessage(null);
    } else if (stripeConnect.phase === 'active') {
      setStatus('success');
      setLoading(false);
    } else if (stripeConnect.phase === 'error') {
      setStatus('error');
      setLoading(false);
      setErrorMessage(stripeConnect.error || 'Connection failed, try again');
    }
  }, [stripeConnect.phase, stripeConnect.error]);

  useEffect(() => {
    if (status !== 'verifying') {
      setPendingTimedOut(false);
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
      return;
    }
    pendingTimerRef.current = setTimeout(() => {
      setPendingTimedOut(true);
      setLoading(false);
    }, PENDING_DONE_MS);
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
  }, [status]);

  const handleSetupNow = useCallback(async () => {
    setErrorMessage(null);
    setPendingTimedOut(false);
    setStatus('connecting');
    setLoading(true);
    try {
      await stripeConnect.startConnect();
    } catch (e) {
      setStatus('error');
      setLoading(false);
      setErrorMessage(e?.message || 'Connection failed, try again');
    }
  }, [stripeConnect]);

  const handleMaybeLater = useCallback(async () => {
    try {
      const uid = auth?.currentUser?.uid;
      if (uid) await dismissPaymentSetupPopup(uid);
    } catch (e) {
      console.warn('Failed to save payment popup dismissal:', e?.message || e);
    }
    onClose?.();
  }, [onClose]);

  const handleDone = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    setStatus(null);
    stripeConnect.retry();
  }, [stripeConnect]);

  const showInitialButtons = !status || status === 'error';
  const showConnecting = status === 'connecting';
  const showVerifying = status === 'verifying' && !pendingTimedOut;
  const showPendingDone = status === 'verifying' && pendingTimedOut;
  const showSuccess = status === 'success';

  const maxCardHeight = useMemo(
    () => SCREEN_HEIGHT - insets.top - insets.bottom - 32,
    [insets.top, insets.bottom],
  );

  if (!visible) return null;

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        statusBarTranslucent
        onRequestClose={handleMaybeLater}
      >
        <View style={styles.overlay}>
          <View
            style={[
              styles.card,
              {
                maxHeight: maxCardHeight,
                marginTop: Math.max(insets.top, 16),
                marginBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleMaybeLater}
              accessibilityLabel="Close"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.iconWrap}>
                <LinearGradient
                  colors={['#FF8C42', '#FF3D8A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.iconGradient}
                >
                  <Ionicons name="wallet" size={28} color="#FFFFFF" />
                </LinearGradient>
              </View>

              <Text style={styles.title}>Payment Method (Stripe)</Text>
              <Text style={styles.subtitle}>
                This step is for getting paid — bank transfer, debit card, or other Stripe payout options. Identity Verification (Face ID) is separate on your profile.
              </Text>

              {showInitialButtons ? (
                <>
                  <HowPaymentsWorkSection
                    textColor={COLORS.text}
                    mutedColor={COLORS.textMuted}
                  />
                  <EarningsDashboardPreview
                    textColor={COLORS.text}
                    mutedColor={COLORS.textMuted}
                    borderColor={COLORS.cardBorder}
                    surfaceColor="rgba(255,255,255,0.04)"
                  />
                  <VenmoComparisonSection
                    textColor={COLORS.text}
                    mutedColor={COLORS.textMuted}
                    borderColor={COLORS.cardBorder}
                  />
                  <TrainerPaymentFaqSnippet
                    textColor={COLORS.text}
                    mutedColor={COLORS.textMuted}
                  />
                </>
              ) : (
                <Text style={styles.body}>
                  Trainers with verified accounts receive payouts in 2–5 business days. Setup
                  usually takes under 2 minutes.
                </Text>
              )}

              {showConnecting ? (
                <View style={styles.statusBlock}>
                  <ActivityIndicator size="large" color={COLORS.accent} />
                  <Text style={styles.statusText}>Opening secure Stripe form…</Text>
                </View>
              ) : null}

              {showVerifying ? (
                <View style={styles.statusBlock}>
                  <ActivityIndicator size="large" color="#A78BFA" />
                  <Text style={styles.statusText}>Verifying account (can take up to 24 hours)…</Text>
                </View>
              ) : null}

              {showPendingDone ? (
                <View style={styles.statusBlock}>
                  <Text style={styles.statusText}>Verification in progress. Check back soon.</Text>
                </View>
              ) : null}

              {showSuccess ? (
                <View style={styles.statusBlock}>
                  <Ionicons name="checkmark-circle" size={48} color="#34D399" />
                  <Text style={styles.successTitle}>Account verified</Text>
                  <Text style={styles.statusText}>You&apos;re ready to receive payments.</Text>
                </View>
              ) : null}

              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </ScrollView>

            {showInitialButtons || showPendingDone || showSuccess ? (
              <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom > 0 ? 0 : 8, 4) }]}>
                {showInitialButtons ? (
                  <>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={status === 'error' ? handleRetry : handleSetupNow}
                      disabled={loading}
                      style={styles.primaryWrap}
                    >
                      <LinearGradient
                        colors={['#FF8C42', '#FF3D8A']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryBtn}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryText}>
                            {status === 'error' ? 'Try again' : 'Set up payments'}
                          </Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity activeOpacity={0.85} onPress={handleMaybeLater} style={styles.secondaryBtn}>
                      <Text style={styles.secondaryText}>Maybe later</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity activeOpacity={0.9} onPress={handleDone} style={styles.primaryWrap}>
                    <LinearGradient
                      colors={['#FF8C42', '#FF3D8A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.primaryBtn}
                    >
                      <Text style={styles.primaryText}>Done</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>

      <StripeConnectWebViewModal
        visible={!!stripeConnect.webViewUrl}
        url={stripeConnect.webViewUrl}
        title="Connect with Stripe"
        isDark
        onClose={() => stripeConnect.closeWebView({ userClosed: true })}
        onComplete={stripeConnect.handleWebViewComplete}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.45,
        shadowRadius: 32,
      },
      android: { elevation: 24 },
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingTop: 28,
    paddingHorizontal: 22,
    paddingBottom: 12,
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: 18,
  },
  iconGradient: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  body: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 16,
  },
  statusBlock: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
    width: '100%',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.cardBorder,
    backgroundColor: COLORS.card,
  },
  primaryWrap: {
    width: '100%',
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: COLORS.textMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});
