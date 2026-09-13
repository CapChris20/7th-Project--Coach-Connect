/**
 * Client Payment Modal
 *
 * Purpose: In-app card form for a client to pay their coach via Stripe (POST /api/charges).
 * Why it matters: Turns the "Pay Coach" flow into a real, tokenized charge without cards touching our backend.
 * Area: src/components
 * Key exports: ClientPaymentModal
 *
 * @file-header
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../shared-ui/ThemeContext';
import { postCoachingCharge } from '../shared/api/chargesApi';
import {
  getStripeNativeModule,
  getStripeCardPaymentBlockReason,
} from '../shared/payments/stripeNativeStatus';
import {
  PLATFORM_FEE_RATE,
  trainerGetsFromAmount,
  platformFeeFromAmount,
  formatPaymentDollars,
} from '../shared/payments/paymentEducationCopy';

const QUICK_AMOUNTS = [50, 100, 150];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000;

// Prefer CardField — CardForm on iOS ignores text colors and looks broken in dark mode.
const stripeModule = getStripeNativeModule();
const CardField = stripeModule?.CardField || null;
const useStripeHook =
  typeof stripeModule?.useStripe === 'function' ? stripeModule.useStripe : () => null;
const cardPaymentBlock = getStripeCardPaymentBlockReason();

function formatMoney(value) {
  return formatPaymentDollars(value);
}

function newChargeIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function ClientPaymentModal({ trainerId, trainerName, onClose, onSuccess }) {
  const { colors, isDark } = useTheme();
  const stripe = useStripeHook();
  const amountInputRef = useRef(null);
  const payInFlightRef = useRef(false);

  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardMeta, setCardMeta] = useState(null); // { brand, last4 }
  const [success, setSuccess] = useState(null);

  const displayName = trainerName || 'your coach';
  const numericAmount = parseFloat(amount);
  const trainerGets = trainerGetsFromAmount(numericAmount);
  const platformFee = platformFeeFromAmount(numericAmount);
  const amountOk = Number.isFinite(numericAmount) && numericAmount >= MIN_AMOUNT;

  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  // Always use a light Stripe field — iOS CardField text colors are unreliable on dark fills.
  const stripeCardStyle = useMemo(
    () => ({
      backgroundColor: '#FFFFFF',
      textColor: '#111111',
      placeholderColor: '#8E8E93',
      borderWidth: 0,
      borderRadius: 12,
      fontSize: 16,
      cursorColor: '#BE185D',
      textErrorColor: '#FF3B30',
    }),
    [],
  );

  const selectQuickAmount = useCallback((value) => {
    setAmount(String(value));
    setError(null);
  }, []);

  const resetForm = useCallback(() => {
    setAmount('100');
    setError(null);
    setLoading(false);
    setSuccess(null);
    setCardReady(false);
    setCardMeta(null);
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onClose?.();
  }, [resetForm, onClose]);

  const mapError = useCallback((e) => {
    const msg = e?.message || '';
    if (e?.code === 'network_error' || /network|timeout|aborted/i.test(msg)) {
      return 'Network error, try again';
    }
    if (/declin/i.test(msg)) return 'Card declined, try different card';
    if (/set up payments|not set up|not verified/i.test(msg)) {
      return "Trainer hasn't set up payments yet";
    }
    if (/trainer not found/i.test(msg)) return 'Trainer not found';
    return msg || 'Payment failed, try again';
  }, []);

  const onCardChange = useCallback((details) => {
    setCardReady(!!details?.complete);
    if (details?.complete && (details.brand || details.last4)) {
      setCardMeta({
        brand: details.brand || null,
        last4: details.last4 || null,
      });
    } else if (!details?.complete) {
      setCardMeta(null);
    }
  }, []);

  const handlePayNow = useCallback(async () => {
    if (payInFlightRef.current) return;
    setError(null);

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < MIN_AMOUNT || value > MAX_AMOUNT) {
      setError('Enter an amount between $1 and $10,000');
      return;
    }

    if (!stripe?.createToken) {
      const block = cardPaymentBlock || getStripeCardPaymentBlockReason();
      setError(block?.detail || 'Payments are unavailable on this build. Please update the app.');
      return;
    }

    if (CardField && !cardReady) {
      setError('Enter your card number, expiry, CVC, and ZIP.');
      return;
    }

    payInFlightRef.current = true;
    setLoading(true);
    try {
      const { token, error: tokenError } = await stripe.createToken({ type: 'Card' });
      if (tokenError) {
        setError(tokenError.message || 'Please check your card details.');
        return;
      }
      if (!token?.id) {
        setError('Could not read your card. Please try again.');
        return;
      }

      const result = await postCoachingCharge({
        trainerId,
        amount: value,
        token: token.id,
        idempotencyKey: newChargeIdempotencyKey(),
      });

      if (result?.success) {
        const gets = Number.isFinite(result.trainer_gets)
          ? result.trainer_gets
          : trainerGetsFromAmount(value);
        setSuccess({ amount: value, trainerGets: gets, chargeId: result.charge_id });
        onSuccess?.(result);
        setTimeout(() => {
          resetForm();
          onClose?.();
        }, 2000);
      } else {
        setError('Payment could not be completed. Please try again.');
      }
    } catch (e) {
      setError(mapError(e));
    } finally {
      payInFlightRef.current = false;
      setLoading(false);
    }
  }, [amount, stripe, trainerId, onSuccess, onClose, resetForm, mapError, cardReady]);

  if (success) {
    return (
      <View style={styles.sheet}>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={52} color="#30D158" />
        </View>
        <Text style={styles.successTitle}>Payment successful</Text>
        <Text style={styles.successLine}>You paid {formatMoney(success.amount)}</Text>
        <Text style={styles.successLine}>Coach receives {formatMoney(success.trainerGets)}</Text>
        <Text style={styles.successSub}>Saved to your payment history.</Text>
      </View>
    );
  }

  const payDisabled = loading || (CardField && !cardReady);

  return (
    <View style={styles.sheet}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Pay Coach {displayName}</Text>
        <Text style={styles.trustLine}>Secured by Stripe</Text>

        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            ref={amountInputRef}
            style={styles.amountInput}
            value={amount}
            onChangeText={(t) => {
              setAmount(t.replace(/[^0-9.]/g, ''));
              setError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={isDark ? '#636366' : '#8E8E93'}
            editable={!loading}
            selectionColor="#BE185D"
          />
        </View>

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((value) => {
            const active = amount === String(value);
            return (
              <TouchableOpacity
                key={value}
                style={[styles.quickBtn, active && styles.quickBtnActive]}
                onPress={() => selectQuickAmount(value)}
                disabled={loading}
                activeOpacity={0.85}
              >
                <Text style={[styles.quickBtnText, active && styles.quickBtnTextActive]}>
                  {formatMoney(value)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {amountOk ? (
          <Text style={styles.feeOneLiner}>
            Coach gets {formatMoney(trainerGets)} · {Math.round(PLATFORM_FEE_RATE * 100)}% platform fee (
            {formatMoney(platformFee)})
          </Text>
        ) : null}

        <Text style={styles.label}>Card</Text>
        {CardField ? (
          <View style={styles.stripeLightPanel}>
            <CardField
              postalCodeEnabled
              placeholders={{
                number: 'Card number',
                expiration: 'MM/YY',
                cvc: 'CVC',
                postalCode: 'ZIP',
              }}
              cardStyle={stripeCardStyle}
              style={styles.cardField}
              onCardChange={onCardChange}
              disabled={loading}
            />
          </View>
        ) : (
          <View style={styles.cardFallback}>
            <Text style={[styles.cardFallbackText, { fontWeight: '700', marginBottom: 6 }]}>
              {cardPaymentBlock?.title || 'Card payments unavailable'}
            </Text>
            <Text style={styles.cardFallbackText}>
              {cardPaymentBlock?.detail ||
                'Rebuild the app with npm run ios:run, then try again.'}
            </Text>
          </View>
        )}

        {cardReady && cardMeta?.last4 ? (
          <View style={styles.readyRow}>
            <Ionicons name="shield-checkmark" size={14} color="#30D158" />
            <Text style={styles.readyText}>
              {cardMeta.brand ? `${String(cardMeta.brand)} ` : ''}···· {cardMeta.last4}
            </Text>
          </View>
        ) : (
          <Text style={styles.cardHelp}>Enter card number, expiry, CVC, and ZIP</Text>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePayNow}
          disabled={payDisabled}
          style={styles.payWrap}
        >
          <LinearGradient
            colors={['#BE185D', '#C2410C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.payBtn, payDisabled && styles.payBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.payText}>
                {error
                  ? 'Try again'
                  : amountOk
                    ? `Pay ${formatMoney(numericAmount)}`
                    : 'Pay now'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={loading}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors, isDark) {
  const textPrimary = colors.textPrimary || colors.text || '#FFFFFF';
  return StyleSheet.create({
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 22,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 28 : 20,
      backgroundColor: isDark ? '#141416' : colors.surface,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -4 },
        },
        android: { elevation: 10 },
      }),
    },
    scrollContent: {
      paddingBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      color: textPrimary,
      letterSpacing: -0.4,
      marginBottom: 4,
    },
    trustLine: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 18,
      fontWeight: '600',
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 4,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    dollarSign: {
      fontSize: 28,
      fontWeight: '700',
      color: textPrimary,
      marginRight: 4,
    },
    amountInput: {
      flex: 1,
      fontSize: 28,
      fontWeight: '800',
      color: textPrimary,
      paddingVertical: 16,
      letterSpacing: -0.5,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    quickBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: 'center',
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    quickBtnActive: {
      borderColor: '#BE185D',
      backgroundColor: isDark ? 'rgba(190,24,93,0.18)' : 'rgba(190,24,93,0.1)',
    },
    quickBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    quickBtnTextActive: {
      color: isDark ? '#FF6B9D' : '#BE185D',
    },
    feeOneLiner: {
      fontSize: 12,
      lineHeight: 17,
      color: colors.textSecondary,
      fontWeight: '600',
      marginBottom: 16,
      marginTop: 2,
    },
    stripeLightPanel: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        },
        android: { elevation: 2 },
      }),
    },
    cardField: {
      width: '100%',
      height: 50,
    },
    cardHelp: {
      marginTop: 8,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    readyRow: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    readyText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#30D158',
      textTransform: 'capitalize',
    },
    cardFallback: {
      borderRadius: 16,
      padding: 16,
      backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7',
    },
    cardFallbackText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    error: {
      color: colors.error || '#FF453A',
      fontSize: 14,
      fontWeight: '700',
      marginTop: 12,
    },
    payWrap: {
      marginTop: 18,
    },
    payBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payBtnDisabled: {
      opacity: 0.5,
    },
    payText: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },
    cancelBtn: {
      paddingVertical: 14,
      alignItems: 'center',
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    successIconWrap: {
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 12,
    },
    successTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: textPrimary,
      textAlign: 'center',
      marginBottom: 10,
    },
    successLine: {
      fontSize: 15,
      fontWeight: '600',
      color: textPrimary,
      textAlign: 'center',
      marginBottom: 4,
    },
    successSub: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 10,
      marginBottom: 20,
    },
  });
}

export { ClientPaymentModal };
