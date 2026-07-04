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
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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

const stripeModule = getStripeNativeModule();
const CardField = stripeModule?.CardField || null;
const useStripeHook =
  typeof stripeModule?.useStripe === 'function' ? stripeModule.useStripe : () => null;
const cardPaymentBlock = getStripeCardPaymentBlockReason();

function formatMoney(value) {
  return formatPaymentDollars(value);
}

function ClientPaymentModal({ trainerId, trainerName, onClose, onSuccess }) {
  const { colors, isDark } = useTheme();
  const stripe = useStripeHook();

  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardReady, setCardReady] = useState(false);
  const [success, setSuccess] = useState(null); // { amount, trainerGets }

  const displayName = trainerName || 'your coach';
  const numericAmount = parseFloat(amount);
  const trainerGets = trainerGetsFromAmount(numericAmount);
  const platformFee = platformFeeFromAmount(numericAmount);

  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

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

  const handlePayNow = useCallback(async () => {
    setError(null);

    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < MIN_AMOUNT || value > MAX_AMOUNT) {
      setError('Enter amount between $1-$10,000');
      return;
    }

    if (!stripe?.createToken) {
      const block = cardPaymentBlock || getStripeCardPaymentBlockReason();
      setError(block?.detail || 'Payments are unavailable on this build. Please update the app.');
      return;
    }

    setLoading(true);
    try {
      const { token, error: tokenError } = await stripe.createToken({ type: 'Card' });
      if (tokenError) {
        setError(tokenError.message || 'Please check your card details.');
        setLoading(false);
        return;
      }
      if (!token?.id) {
        setError('Could not read your card. Please try again.');
        setLoading(false);
        return;
      }

      const result = await postCoachingCharge({
        trainerId,
        amount: value,
        token: token.id,
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
      setLoading(false);
    }
  }, [amount, stripe, trainerId, onSuccess, onClose, resetForm, mapError]);

  if (success) {
    return (
      <View style={styles.card}>
        <Text style={styles.successCheck}>✅</Text>
        <Text style={styles.successTitle}>Payment successful!</Text>
        <Text style={styles.successLine}>You paid: {formatMoney(success.amount)}</Text>
        <Text style={styles.successLine}>Coach receives: {formatMoney(success.trainerGets)}</Text>
        <Text style={styles.successSub}>
          This transaction is saved in your payment history (Settings → Billing).
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Pay Coach {displayName}</Text>
      <Text style={styles.trustLine}>Secure payment via Stripe · Receipt saved in your history</Text>

      <Text style={styles.label}>Amount</Text>
      <View style={styles.amountRow}>
        <Text style={styles.dollarSign}>$</Text>
        <TextInput
          style={styles.amountInput}
          value={amount}
          onChangeText={(t) => {
            setAmount(t.replace(/[^0-9.]/g, ''));
            setError(null);
          }}
          keyboardType="decimal-pad"
          placeholder="Amount ($)"
          placeholderTextColor={colors.textSecondary}
          editable={!loading}
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
        <View style={[styles.quickBtn, styles.customBtn]}>
          <Text style={styles.quickBtnText}>Custom</Text>
        </View>
      </View>

      {Number.isFinite(numericAmount) && numericAmount >= MIN_AMOUNT ? (
        <View style={styles.feeBreakdown}>
          <Text style={styles.feeBreakdownText}>
            You pay {formatMoney(numericAmount)} · Coach gets {formatMoney(trainerGets)} · Platform fee{' '}
            {Math.round(PLATFORM_FEE_RATE * 100)}% ({formatMoney(platformFee)})
          </Text>
          <Text style={styles.feeNote}>One-time coaching payment — not your Coach Connect Pro subscription.</Text>
        </View>
      ) : null}

      <Text style={styles.label}>Card details</Text>
      {CardField ? (
        <CardField
          postalCodeEnabled
          placeholders={{ number: '4242 4242 4242 4242' }}
          cardStyle={{
            backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
            textColor: colors.textPrimary || colors.text,
            placeholderColor: colors.textSecondary,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 12,
          }}
          style={styles.cardField}
          onCardChange={(details) => setCardReady(!!details?.complete)}
        />
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

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePayNow}
        disabled={loading || (CardField && !cardReady)}
        style={styles.payWrap}
      >
        <LinearGradient
          colors={['#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.payBtn, (loading || (CardField && !cardReady)) && styles.payBtnDisabled]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.payText}>{error ? 'RETRY' : 'PAY NOW'}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} disabled={loading}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors, isDark) {
  const textPrimary = colors.textPrimary || colors.text || '#FFFFFF';
  return StyleSheet.create({
    card: {
      borderRadius: 16,
      padding: 20,
      backgroundColor: isDark ? 'rgba(28,28,30,0.96)' : colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        },
        android: { elevation: 8 },
      }),
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: textPrimary,
      marginBottom: 6,
    },
    trustLine: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
      lineHeight: 18,
    },
    feeBreakdown: {
      marginTop: 12,
      padding: 12,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    feeBreakdownText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      lineHeight: 17,
    },
    feeNote: {
      marginTop: 6,
      fontSize: 11,
      color: colors.textSecondary,
      opacity: 0.85,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 8,
      marginTop: 12,
    },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
      paddingHorizontal: 14,
    },
    dollarSign: {
      fontSize: 22,
      fontWeight: '700',
      color: textPrimary,
      marginRight: 6,
    },
    amountInput: {
      flex: 1,
      fontSize: 22,
      fontWeight: '700',
      color: textPrimary,
      paddingVertical: 14,
    },
    quickRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    quickBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
    },
    quickBtnActive: {
      borderColor: '#C084FC',
      backgroundColor: isDark ? 'rgba(192,132,252,0.18)' : 'rgba(192,132,252,0.12)',
    },
    customBtn: {
      opacity: 0.6,
    },
    quickBtnText: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    quickBtnTextActive: {
      color: '#C084FC',
    },
    cardField: {
      height: 50,
      marginBottom: 4,
    },
    cardFallback: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      backgroundColor: isDark ? colors.surfaceSecondary : '#FFFFFF',
    },
    cardFallbackText: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    error: {
      color: colors.error || '#FF453A',
      fontSize: 14,
      fontWeight: '600',
      marginTop: 12,
    },
    payWrap: {
      marginTop: 20,
    },
    payBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    payBtnDisabled: {
      opacity: 0.6,
    },
    payText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    cancelBtn: {
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 4,
    },
    cancelText: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: '600',
    },
    successCheck: {
      fontSize: 40,
      textAlign: 'center',
      marginBottom: 8,
    },
    successTitle: {
      fontSize: 18,
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
      marginTop: 8,
      lineHeight: 18,
    },
  });
}

export { ClientPaymentModal };
