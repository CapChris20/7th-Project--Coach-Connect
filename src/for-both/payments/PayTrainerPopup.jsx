// In-app card form so a client can pay their coach (POST /api/charges).
// Flow: pick amount → enter card → Stripe token → charge → brief success → close.
// Used by the client Pay Coach sheet. Card numbers never hit our server — Stripe tokenizes them.

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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbButton from '../../look-and-feel/NbButton';
import NbSheet from '../../look-and-feel/NbSheet';
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
const DEFAULT_AMOUNT_TEXT = '100';
const SUCCESS_ICON_NAME = 'checkmark-circle';
const SUCCESS_ICON_SIZE = 52;
const SUCCESS_ICON_COLOR = '#F97316';
const READY_SHIELD_ICON = 'shield-checkmark';
const READY_SHIELD_SIZE = 14;
const PLATFORM_FEE_PERCENT_DISPLAY = Math.round(PLATFORM_FEE_RATE * 100);

// Prefer CardField — CardForm on iOS ignores text colors and looks broken in dark mode.
const stripeModule = getStripeNativeModule();
const CardField = stripeModule?.CardField || null;
const useStripeHook =
  typeof stripeModule?.useStripe === 'function' ? stripeModule.useStripe : () => null;
const cardPaymentBlock = getStripeCardPaymentBlockReason();

// ===== HELPER FUNCTIONS =====

/**
 * Pay button caption: loading / retry / dollar amount / default.
 * @param {{ loading: boolean, error: string|null, amountOk: boolean, numericAmount: number }} args
 * @returns {string}
 */
function captionForPayButton({ loading, error, amountOk, numericAmount }) {
  if (loading) {
    return 'Pay now';
  }
  if (error) {
    return 'Try again';
  }
  if (amountOk) {
    return `Pay ${formatPaymentDollars(numericAmount)}`;
  }
  return 'Pay now';
}

/**
 * Strip everything except digits and a decimal point from the amount field.
 * @param {string} typedAmount
 * @returns {string}
 */
function keepDigitsAndDecimalOnly(typedAmount) {
  return String(typedAmount || '').replace(/[^0-9.]/g, '');
}

/**
 * Unique key so a double-tap does not create two charges.
 * vocab: idempotencyKey = server uses this to ignore duplicate POSTs
 * @returns {string}
 */
function newChargeIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `cc_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Human detail when this install cannot create a Stripe card token.
 * @returns {string}
 */
function readCardUnavailableDetail() {
  const block = cardPaymentBlock || getStripeCardPaymentBlockReason();
  return (
    block?.detail ||
    'Payments are unavailable on this build. Please update the app.'
  );
}

/**
 * Prefer the server's trainer_gets; otherwise compute the local split.
 * @param {object} result
 * @param {number} amountDollars
 * @returns {number}
 */
function trainerShareFromChargeResult(result, amountDollars) {
  if (Number.isFinite(result.trainer_gets)) {
    return result.trainer_gets;
  }
  return trainerGetsFromAmount(amountDollars);
}

/**
 * Tokenize the card with Stripe, then POST /api/charges.
 * Failures come back as { ok: false, reason } — no throw for expected declines.
 * @param {{ stripe: object, trainerId: string, amountDollars: number }} args
 * @returns {Promise<{ ok: boolean, reason?: string, trainerGets?: number, chargeId?: string, result?: object }>}
 */
async function tokenizeCardAndPostCharge({ stripe, trainerId, amountDollars }) {
  // vocab: createToken = Stripe SDK turns CardField into a one-time token id
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
    trainerGets: trainerShareFromChargeResult(result, amountDollars),
    chargeId: result.charge_id,
    result,
  };
}

/**
 * Always-light Stripe CardField style — iOS text colors are unreliable on dark fills.
 * @returns {object}
 */
function buildStripeCardFieldStyle() {
  return {
    backgroundColor: lightColors.white,
    textColor: '#111111',
    placeholderColor: '#8E8E93',
    borderWidth: 0,
    borderRadius: 12,
    fontSize: 16,
    cursorColor: lightColors.primaryDark,
    textErrorColor: lightColors.error,
  };
}

/**
 * Turn a thrown charge/network error into short button-friendly copy.
 * @param {Error|object|null} chargeError
 * @returns {string}
 */
function humanMessageForChargeError(chargeError) {
  const errorMessage = chargeError?.message || '';
  const looksLikeNetwork =
    chargeError?.code === 'network_error' ||
    /network|timeout|aborted/i.test(errorMessage);
  if (looksLikeNetwork) return 'Network error, try again';

  const looksLikeDecline = /declin/i.test(errorMessage);
  if (looksLikeDecline) return 'Card declined, try different card';

  const trainerNotReady = /set up payments|not set up|not verified/i.test(errorMessage);
  if (trainerNotReady) return "Trainer hasn't set up payments yet";

  const trainerMissing = /trainer not found/i.test(errorMessage);
  if (trainerMissing) return 'Trainer not found';

  if (errorMessage) return errorMessage;
  return 'Payment failed, try again';
}

// ===== LAYOUT PIECES (no hooks) =====

function PaySuccessSheet({ styles, successPayload }) {
  return (
    <NbSheet>
      <View style={styles.successIconWrap}>
        <Ionicons
          name={SUCCESS_ICON_NAME}
          size={SUCCESS_ICON_SIZE}
          color={SUCCESS_ICON_COLOR}
        />
      </View>
      <Text style={styles.successTitle}>Payment successful</Text>
      <Text style={styles.successLine}>
        You paid {formatPaymentDollars(successPayload.amount)}
      </Text>
      <Text style={styles.successLine}>
        Coach receives {formatPaymentDollars(successPayload.trainerGets)}
      </Text>
      <Text style={styles.successSub}>Saved to your payment history.</Text>
    </NbSheet>
  );
}

function QuickAmountChip({ value, isSelected, onPick, loading, styles }) {
  return (
    <TouchableOpacity
      style={[styles.quickBtn, isSelected && styles.quickBtnActive]}
      onPress={() => onPick(value)}
      disabled={loading}
      activeOpacity={0.85}
    >
      <Text style={[styles.quickBtnText, isSelected && styles.quickBtnTextActive]}>
        {formatPaymentDollars(value)}
      </Text>
    </TouchableOpacity>
  );
}

function StripeCardEntryPanel({
  loading,
  cardStyle,
  styles,
  onCardChange,
  CardFieldComponent,
  blockReason,
}) {
  if (CardFieldComponent) {
    return (
      <View style={styles.stripeLightPanel}>
        <CardFieldComponent
          postalCodeEnabled
          placeholders={{
            number: 'Card number',
            expiration: 'MM/YY',
            cvc: 'CVC',
            postalCode: 'ZIP',
          }}
          cardStyle={cardStyle}
          style={styles.cardField}
          onCardChange={onCardChange}
          disabled={loading}
        />
      </View>
    );
  }

  const fallbackTitle = blockReason?.title || 'Card payments unavailable';
  const fallbackDetail =
    blockReason?.detail || 'Rebuild the app with npm run ios:run, then try again.';

  return (
    <View style={styles.cardFallback}>
      <Text style={[styles.cardFallbackText, { fontWeight: '700', marginBottom: 6 }]}>
        {fallbackTitle}
      </Text>
      <Text style={styles.cardFallbackText}>{fallbackDetail}</Text>
    </View>
  );
}

function CardReadyHint({ cardReady, cardMeta, styles }) {
  if (cardReady && cardMeta?.last4) {
    const brandPrefix = cardMeta.brand ? `${String(cardMeta.brand)} ` : '';
    return (
      <View style={styles.readyRow}>
        <Ionicons
          name={READY_SHIELD_ICON}
          size={READY_SHIELD_SIZE}
          color={SUCCESS_ICON_COLOR}
        />
        <Text style={styles.readyText}>
          {brandPrefix}···· {cardMeta.last4}
        </Text>
      </View>
    );
  }
  return <Text style={styles.cardHelp}>Enter card number, expiry, CVC, and ZIP</Text>;
}

// ===== MAIN FUNCTION =====

/**
 * Client Pay Coach sheet: amount chips, Stripe CardField, charge, success beat.
 * @param {{ trainerId: string, trainerName?: string, onClose?: Function, onSuccess?: Function }} props
 */
function PayTrainerPopup({ trainerId, trainerName, onClose, onSuccess }) {
  // Hook order is frozen — do not reorder.
  // vocab: useTheme = Design Law light/dark tokens for NbSheet / NbButton
  const { colors, isDark } = useTheme();
  // vocab: useStripe = Stripe React Native hook (null when native module is missing)
  const stripe = useStripeHook();
  const amountInputRef = useRef(null);
  const payInFlightRef = useRef(false);

  const [amount, setAmount] = useState(DEFAULT_AMOUNT_TEXT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cardReady, setCardReady] = useState(false);
  const [cardMeta, setCardMeta] = useState(null);
  const [success, setSuccess] = useState(null);

  const displayName = trainerName || 'your coach';
  const numericAmount = parseFloat(amount);
  const trainerShare = trainerGetsFromAmount(numericAmount);
  const platformShare = platformFeeFromAmount(numericAmount);
  const amountOk = Number.isFinite(numericAmount) && numericAmount >= MIN_AMOUNT;

  // vocab: useMemo = rebuild StyleSheet only when theme tokens change
  const styles = useMemo(() => buildPayTrainerStyles(colors, isDark), [colors, isDark]);
  const stripeCardStyle = useMemo(() => buildStripeCardFieldStyle(), []);

  const selectQuickAmount = useCallback((value) => {
    setAmount(String(value));
    setError(null);
  }, []);

  const resetForm = useCallback(() => {
    setAmount(DEFAULT_AMOUNT_TEXT);
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

  const mapChargeErrorToMessage = useCallback((chargeError) => {
    return humanMessageForChargeError(chargeError);
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
    if (payInFlightRef.current) {
      return;
    }
    setError(null);

    // 2. Amount must be $1–$10,000.
    const amountDollars = parseFloat(amount);
    const amountInRange =
      Number.isFinite(amountDollars) &&
      amountDollars >= MIN_AMOUNT &&
      amountDollars <= MAX_AMOUNT;
    if (!amountInRange) {
      setError('Enter an amount between $1 and $10,000');
      return;
    }

    // 3. This install must be able to create a Stripe card token.
    const canCreateCardToken = stripe && stripe.createToken;
    if (!canCreateCardToken) {
      setError(readCardUnavailableDetail());
      return;
    }

    // 4. Card field must be complete (number, expiry, CVC, ZIP).
    if (CardField && !cardReady) {
      setError('Enter your card number, expiry, CVC, and ZIP.');
      return;
    }

    // 5. Tokenize the card and POST the charge.
    payInFlightRef.current = true;
    setLoading(true);
    try {
      const outcome = await tokenizeCardAndPostCharge({
        stripe,
        trainerId,
        amountDollars,
      });
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
      setError(mapChargeErrorToMessage(chargeError));
    } finally {
      payInFlightRef.current = false;
      setLoading(false);
    }
  }, [
    amount,
    stripe,
    trainerId,
    onSuccess,
    onClose,
    resetForm,
    mapChargeErrorToMessage,
    cardReady,
  ]);

  if (success) {
    return <PaySuccessSheet styles={styles} successPayload={success} />;
  }

  const payDisabled = loading || (CardField && !cardReady);
  const payCaption = captionForPayButton({
    loading,
    error,
    amountOk,
    numericAmount,
  });
  const amountPlaceholderColor = isDark ? '#636366' : '#8E8E93';
  const showFeeOneLiner = amountOk;
  const feeOneLinerText = `Coach gets ${formatPaymentDollars(trainerShare)} · ${PLATFORM_FEE_PERCENT_DISPLAY}% platform fee (${formatPaymentDollars(platformShare)})`;

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
              setAmount(keepDigitsAndDecimalOnly(typedAmount));
              setError(null);
            }}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={amountPlaceholderColor}
            editable={!loading}
            selectionColor="#0A0A0A"
          />
        </View>

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((value) => (
            <QuickAmountChip
              key={value}
              value={value}
              isSelected={amount === String(value)}
              onPick={selectQuickAmount}
              loading={loading}
              styles={styles}
            />
          ))}
        </View>

        {showFeeOneLiner ? (
          <Text style={styles.feeOneLiner}>{feeOneLinerText}</Text>
        ) : null}

        <Text style={styles.label}>Card</Text>
        <StripeCardEntryPanel
          loading={loading}
          cardStyle={stripeCardStyle}
          styles={styles}
          onCardChange={onCardChange}
          CardFieldComponent={CardField}
          blockReason={cardPaymentBlock}
        />

        <CardReadyHint cardReady={cardReady} cardMeta={cardMeta} styles={styles} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.payWrap}>
          <NbButton variant="brand" onPress={handlePayNow} disabled={payDisabled}>
            {loading ? <ActivityIndicator color={colors.nbInk} /> : payCaption}
          </NbButton>
        </View>

        <NbButton variant="plain" onPress={handleCancel} disabled={loading}>
          Cancel
        </NbButton>
      </ScrollView>
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

function buildPayTrainerStyles(colors, isDark) {
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
