// In-app card form so a client can pay their coach (POST /api/charges).
// Flow: pick amount → enter card → Stripe token → charge → success, then close.
// Used by the client Pay Coach sheet. Cards never hit our server — Stripe tokenizes them.

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
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import { NbSheet } from '../../look-and-feel/NbSheet';
import { postCoachingCharge } from './chargeCard';
import {
  getStripeNativeModule,
  getStripeCardPaymentBlockReason,
} from './canThisPhoneTakeCards';
import {
  PLATFORM_FEE_RATE,
  trainerGetsFromAmount,
  platformFeeFromAmount,
  formatPaymentDollars,
} from './howPaymentsWorkText';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const QUICK_AMOUNTS = [50, 100, 150];
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000;
// Manipulate here: how long the success screen stays up before we close.
const SUCCESS_CLOSE_MS = 2000;

// Prefer CardField — CardForm on iOS ignores text colors and looks broken in dark mode.
const stripeModule = getStripeNativeModule();
const CardField = stripeModule?.CardField || null;
const useStripeHook =
  typeof stripeModule?.useStripe === 'function' ? stripeModule.useStripe : () => null;
const cardPaymentBlock = getStripeCardPaymentBlockReason();

// ===== HELPER FUNCTIONS =====

function formatMoney(value) {
  return formatPaymentDollars(value);
}

function newChargeIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function digitsOnlyAmountText(typedAmount) {
  return String(typedAmount || '').replace(/[^0-9.]/g, '');
}

function cardUnavailableDetail() {
  const block = cardPaymentBlock || getStripeCardPaymentBlockReason();
  return block?.detail || 'Payments are unavailable on this build. Please update the app.';
}

function trainerGetsFromCharge(result, amountDollars) {
  if (Number.isFinite(result.trainer_gets)) return result.trainer_gets;
  return trainerGetsFromAmount(amountDollars);
}

/**
 * Tokenize the card, then POST /api/charges. Failures come back as { ok: false, reason }.
 * @param {{ stripe: object, trainerId: string, amountDollars: number }} args
 * @returns {Promise<{ ok: boolean, reason?: string, trainerGets?: number, chargeId?: string, result?: object }>}
 */
async function tokenizeAndCharge({ stripe, trainerId, amountDollars }) {
  const { token, error: tokenError } = await stripe.createToken({ type: 'Card' });
  if (tokenError) {
    return { ok: false, reason: tokenError.message || 'Please check your card details.' };
  }
  if (!token || !token.id) {
    return { ok: false, reason: 'Could not read your card. Please try again.' };
  }

  const result = await postCoachingCharge({
    trainerId,
    amount: amountDollars,
    token: token.id,
    idempotencyKey: newChargeIdempotencyKey(),
  });
  if (!result || !result.success) {
    return { ok: false, reason: 'Payment could not be completed. Please try again.' };
  }
  return {
    ok: true,
    trainerGets: trainerGetsFromCharge(result, amountDollars),
    chargeId: result.charge_id,
    result,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Charge this coach now. Failures first: bad amount, no Stripe, incomplete card.
 * @param {{ trainerId: string, trainerName?: string, onClose?: Function, onSuccess?: Function }} props
 */
function PayTrainerPopup({ trainerId, trainerName, onClose, onSuccess }) {
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
      backgroundColor: lightColors.white,
      textColor: '#111111',
      placeholderColor: '#8E8E93',
      borderWidth: 0,
      borderRadius: 12,
      fontSize: 16,
      cursorColor: lightColors.primaryDark,
      textErrorColor: lightColors.error,
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
    // 1. Wipe the form, then close. Closing first would leave stale amount/error on reopen.
    resetForm();
    onClose?.();
  }, [resetForm, onClose]);

  const mapError = useCallback((chargeError) => {
    const errorMessage = chargeError?.message || '';
    if (chargeError?.code === 'network_error' || /network|timeout|aborted/i.test(errorMessage)) {
      return 'Network error, try again';
    }
    if (/declin/i.test(errorMessage)) return 'Card declined, try different card';
    if (/set up payments|not set up|not verified/i.test(errorMessage)) {
      return "Trainer hasn't set up payments yet";
    }
    if (/trainer not found/i.test(errorMessage)) return 'Trainer not found';
    return errorMessage || 'Payment failed, try again';
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
    // 1. Ignore a second tap while a charge is already in flight.
    if (payInFlightRef.current) return;
    setError(null);

    // 2. Amount must be $1–$10,000.
    const amountDollars = parseFloat(amount);
    if (!Number.isFinite(amountDollars) || amountDollars < MIN_AMOUNT || amountDollars > MAX_AMOUNT) {
      setError('Enter an amount between $1 and $10,000');
      return;
    }

    // 3. This install must be able to create a Stripe card token.
    const canCreateCardToken = stripe && stripe.createToken;
    if (!canCreateCardToken) {
      setError(cardUnavailableDetail());
      return;
    }

    // 4. Card field must be complete (number, expiry, CVC, ZIP).
    if (CardField && !cardReady) {
      setError('Enter your card number, expiry, CVC, and ZIP.');
      return;
    }

    // 5. Tokenize the card and POST the charge. Failures first inside tokenizeAndCharge.
    payInFlightRef.current = true;
    setLoading(true);
    try {
      const outcome = await tokenizeAndCharge({ stripe, trainerId, amountDollars });
      if (!outcome.ok) {
        setError(outcome.reason);
        return;
      }

      // 6. Show success, tell the parent, then close after a short beat.
      setSuccess({
        amount: amountDollars,
        trainerGets: outcome.trainerGets,
        chargeId: outcome.chargeId,
      });
      onSuccess?.(outcome.result);
      setTimeout(() => {
        resetForm();
        onClose?.();
      }, SUCCESS_CLOSE_MS);
    } catch (chargeError) {
      setError(mapError(chargeError));
    } finally {
      payInFlightRef.current = false;
      setLoading(false);
    }
  }, [amount, stripe, trainerId, onSuccess, onClose, resetForm, mapError, cardReady]);

  if (success) {
    return (
      <NbSheet>
        <View style={styles.successIconWrap}>
          <Ionicons name="checkmark-circle" size={52} color="#30D158" />
        </View>
        <Text style={styles.successTitle}>Payment successful</Text>
        <Text style={styles.successLine}>You paid {formatMoney(success.amount)}</Text>
        <Text style={styles.successLine}>Coach receives {formatMoney(success.trainerGets)}</Text>
        <Text style={styles.successSub}>Saved to your payment history.</Text>
      </NbSheet>
    );
  }

  const payDisabled = loading || (CardField && !cardReady);

  return (
    <NbSheet>
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
            onChangeText={(typedAmount) => {
              setAmount(digitsOnlyAmountText(typedAmount));
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

        <View style={styles.payWrap}>
          <NbButton
            variant="brand"
            onPress={handlePayNow}
            disabled={payDisabled}
          >
            {loading ? (
              <ActivityIndicator color={colors.nbInk} />
            ) : (
              error
                ? 'Try again'
                : amountOk
                  ? `Pay ${formatMoney(numericAmount)}`
                  : 'Pay now'
            )}
          </NbButton>
        </View>

        <NbButton variant="plain" onPress={handleCancel} disabled={loading}>
          Cancel
        </NbButton>
      </ScrollView>
    </NbSheet>
  );
}

function makeStyles(colors, isDark) {
  const textPrimary = colors.nbInk;
  return StyleSheet.create({
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
      borderRadius: 14,
      backgroundColor: colors.nbSurface,
      borderWidth: 2.5,
      borderColor: colors.nbBorder,
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
      backgroundColor: colors.nbSurfaceChip,
      borderWidth: 2.5,
      borderColor: colors.nbBorder,
    },
    quickBtnActive: {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
    },
    quickBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    quickBtnTextActive: {
      color: isDark ? lightColors.primary : lightColors.primaryDark,
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
      backgroundColor: lightColors.white,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 10 : 6,
      borderWidth: 2.5,
      borderColor: colors.nbBorder,
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
      color: lightColors.success,
      textTransform: 'capitalize',
    },
    cardFallback: {
      borderRadius: 14,
      padding: 16,
      backgroundColor: colors.nbSurface,
      borderWidth: 2.5,
      borderColor: colors.nbBorder,
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
      marginBottom: 8,
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

export { PayTrainerPopup };
