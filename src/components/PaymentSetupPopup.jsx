/**
 * Post-signup payment setup modal (Option B) — shown on trainer dashboard, not during onboarding.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Pressable,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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

export function PaymentSetupPopup({ visible, onClose, userEmail, stripeAccountId = '' }) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [pendingTimedOut, setPendingTimedOut] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pendingTimerRef = useRef(null);

  const email = String(userEmail || auth?.currentUser?.email || '').trim();

  const stripeConnect = useStripeConnectFlow({
    email,
    onActive: () => {
      console.log('✅ Account verified!');
      setStatus('success');
      setLoading(false);
      setErrorMessage(null);
    },
  });

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      return;
    }
    console.log('🎯 PaymentSetupPopup: Showing popup');
    console.log('User email:', email || '(none)');
    console.log('Stripe account:', stripeAccountId || 'none');
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible, email, stripeAccountId, fadeAnim]);

  useEffect(() => {
    if (stripeConnect.phase === 'connecting') {
      setStatus('connecting');
      setLoading(true);
      setErrorMessage(null);
      console.log('🔄 Creating Stripe account...');
      console.log('Opening Stripe onboarding form...');
    } else if (stripeConnect.phase === 'pending') {
      setStatus('verifying');
      setLoading(true);
      setErrorMessage(null);
      console.log('🔍 Checking Stripe status...');
      console.log('Status: pending_verification');
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
    console.log('✖️ Popup dismissed');
    try {
      const uid = auth?.currentUser?.uid;
      if (uid) {
        await dismissPaymentSetupPopup(uid);
        console.log('Dismissal saved to Firestore');
      }
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

  const styles = useMemo(() => makeStyles(), []);

  const showInitialButtons = !status || status === 'error';
  const showConnecting = status === 'connecting';
  const showVerifying = status === 'verifying' && !pendingTimedOut;
  const showPendingDone = status === 'verifying' && pendingTimedOut;
  const showSuccess = status === 'success';

  if (!visible) return null;

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={handleMaybeLater}>
        <Pressable style={styles.overlay} onPress={handleMaybeLater}>
          <Animated.View style={[styles.overlayInner, { opacity: fadeAnim }]}>
            <Pressable onPress={(e) => e.stopPropagation?.()}>
              <View style={styles.card}>
                <ScrollView
                  style={styles.scroll}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                >
                <View style={styles.iconWrap}>
                  <Ionicons name="wallet-outline" size={40} color="#FF1493" />
                </View>

                <Text style={styles.title}>Ready to Get Paid?</Text>
                <Text style={styles.subtitle}>
                  Receive payments from clients directly to your bank account
                </Text>

                {showInitialButtons ? (
                  <>
                    <HowPaymentsWorkSection />
                    <EarningsDashboardPreview />
                    <VenmoComparisonSection />
                    <TrainerPaymentFaqSnippet />
                  </>
                ) : (
                  <Text style={styles.body}>
                    Trainers with verified accounts receive payouts in 2–5 business days. Set up takes
                    less than 2 minutes.
                  </Text>
                )}

                {showConnecting ? (
                  <View style={styles.statusBlock}>
                    <ActivityIndicator size="large" color="#FF1493" />
                    <Text style={styles.statusText}>Opening secure form...</Text>
                  </View>
                ) : null}

                {showVerifying ? (
                  <View style={styles.statusBlock}>
                    <ActivityIndicator size="large" color="#A78BFA" />
                    <Text style={styles.statusText}>Verifying account (up to 24 hours)...</Text>
                  </View>
                ) : null}

                {showPendingDone ? (
                  <View style={styles.statusBlock}>
                    <Text style={styles.statusText}>
                      Verification in progress. Check back soon.
                    </Text>
                    <TouchableOpacity activeOpacity={0.9} onPress={handleDone} style={styles.primaryWrap}>
                      <LinearGradient
                        colors={['#FF1493', '#A78BFA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryText}>DONE</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {showSuccess ? (
                  <View style={styles.statusBlock}>
                    <Text style={styles.successEmoji}>✅</Text>
                    <Text style={styles.successTitle}>Account verified!</Text>
                    <Text style={styles.statusText}>You're ready to receive payments</Text>
                    <TouchableOpacity activeOpacity={0.9} onPress={handleDone} style={styles.primaryWrap}>
                      <LinearGradient
                        colors={['#FF1493', '#A78BFA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryBtn}
                      >
                        <Text style={styles.primaryText}>DONE</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : null}

                {errorMessage ? (
                  <Text style={styles.errorText}>{errorMessage}</Text>
                ) : null}

                {showInitialButtons ? (
                  <View style={styles.actions}>
                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={status === 'error' ? handleRetry : handleSetupNow}
                      disabled={loading}
                      style={styles.primaryWrap}
                    >
                      <LinearGradient
                        colors={['#FF1493', '#A78BFA']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.primaryBtn}
                      >
                        {loading ? (
                          <ActivityIndicator color="#FFFFFF" />
                        ) : (
                          <Text style={styles.primaryText}>
                            {status === 'error' ? 'TRY AGAIN' : 'SET UP NOW'}
                          </Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleMaybeLater}
                      style={styles.secondaryBtn}
                    >
                      <Text style={styles.secondaryText}>MAYBE LATER</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
                </ScrollView>
              </View>
            </Pressable>
          </Animated.View>
        </Pressable>
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

function makeStyles() {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.65)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
    },
    overlayInner: {
      width: '100%',
      alignItems: 'center',
    },
    card: {
      width: '90%',
      maxWidth: 400,
      maxHeight: '88%',
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      borderRadius: 24,
      padding: 24,
    },
    scroll: { flexGrow: 0 },
    scrollContent: { alignItems: 'center', paddingBottom: 8 },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 20,
      backgroundColor: 'rgba(255,20,147,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.65)',
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 20,
    },
    body: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.55)',
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 24,
    },
    statusBlock: {
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
      width: '100%',
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.65)',
      textAlign: 'center',
    },
    successEmoji: {
      fontSize: 36,
    },
    successTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    errorText: {
      color: '#FF453A',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 12,
    },
    actions: {
      width: '100%',
    },
    primaryWrap: {
      width: '100%',
      marginBottom: 12,
    },
    primaryBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    secondaryBtn: {
      height: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    secondaryText: {
      color: 'rgba(255,255,255,0.55)',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
