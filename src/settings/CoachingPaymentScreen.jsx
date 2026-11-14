// Design Law client Coaching payment (settings PNG 07 active / 08 empty).
// Flow: subscription hero + payment method + recent charges, or dashed empty shell → Add method.
// Used as the modal body from ClientAppStart (replaces bare PayTrainerPopup-only chrome).
//
// vocab: traineePaymentHistory = Firestore payments for this client (hook-shaped helper)
// vocab: HardShadow = solid offset shadow from Design Law
// Manipulate here: empty CTA copy, status pill labels

import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import NbButton from '../look-and-feel/NbButton';
import NbCard from '../look-and-feel/NbCard';
import NbIconChip from '../look-and-feel/NbIconChip';
import HardShadow from '../look-and-feel/HardShadow';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { accentGradients, nb, spacing } from '../look-and-feel/colorPalette';
import { traineePaymentHistory } from '../for-both/payments/traineePaymentHistory';
import { formatPaymentDollars } from '../for-both/payments/howPaymentsWorkText';
import { PayTrainerPopup } from '../for-both/payments/PayTrainerPopup';
import { FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

const ICON_PAY = require('../assets/icons/handoff/week.png');
const SCROLL_BOTTOM = 40;
const STATUS_ACTIVE = 'active';
const STATUS_PAST_DUE = 'past_due';
const STATUS_PAYMENT_REQUIRED = 'payment_required';
const DEFAULT_CARD_BRAND = 'Visa';
const DEFAULT_COACH_LABEL = 'Your trainer';
// Design Law ink on gradient pills (readable on accent fills)
const GRADIENT_PILL_INK = '#0A0A0F';

const ACTIVE_LIKE_STATUSES = new Set([
  STATUS_ACTIVE,
  'succeeded',
  'completed',
  'paid',
]);
const PAST_DUE_LIKE_STATUSES = new Set([
  STATUS_PAST_DUE,
  'failed',
  'past due',
]);

// ===== HELPER FUNCTIONS =====

/**
 * Coerce any value to a trimmed string (empty when missing).
 * @param {*} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return asTrimmedString(value);
}


/**
 * First word of a full name (for charge subtitles).
 * @param {string} fullName
 * @returns {string}
 */
function firstNameFromFullName(fullName) {
  const text = String(fullName || 'your trainer').trim();
  const parts = text.split(/\s+/);
  return parts[0] || text;
}

/**
 * Label + whether to paint the status chip with an accent gradient.
 * @param {string} status
 * @returns {{ label: string, useGradient: boolean, gradientIndex?: number }}
 */
function describePaymentStatusChip(status) {
  const statusKey = String(status || '').toLowerCase();

  if (ACTIVE_LIKE_STATUSES.has(statusKey)) {
    return { label: 'Active', useGradient: true, gradientIndex: 0 };
  }
  if (PAST_DUE_LIKE_STATUSES.has(statusKey)) {
    return { label: 'Past due', useGradient: true, gradientIndex: 1 };
  }
  if (statusKey === 'pending') {
    return { label: 'Pending', useGradient: false };
  }
  return { label: 'Paid', useGradient: false };
}

/**
 * Session / monthly rate from the user doc — null when none stored.
 * @param {object} userData
 * @returns {number|null}
 */
function readSessionRateFromUserData(userData) {
  const fromSession = Number(userData?.sessionRate);
  if (fromSession) return fromSession;
  const fromMonthly = Number(userData?.monthlyRate);
  if (fromMonthly) return fromMonthly;
  const fromTrainer = Number(userData?.trainerRate);
  if (fromTrainer) return fromTrainer;
  return null;
}

/**
 * True when this client should see the active subscription chrome.
 * @param {string|null} trainerId
 * @param {string} paymentStatus
 * @returns {boolean}
 */
function clientHasActiveSubscriptionLook(trainerId, paymentStatus) {
  if (!trainerId) return false;
  if (paymentStatus === STATUS_ACTIVE) return true;
  if (paymentStatus === STATUS_PAST_DUE) return true;
  if (paymentStatus === STATUS_PAYMENT_REQUIRED) return true;
  return false;
}

/**
 * Status pill — gradient for active/past-due, surface for the rest.
 */
function PaymentStatusChip({ status }) {
  const { colors } = useTheme();
  const chipLook = describePaymentStatusChip(status);

  if (chipLook.useGradient) {
    return (
      <LinearGradient
        colors={accentGradients[chipLook.gradientIndex]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.statusPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={styles.statusPillDark}>{chipLook.label}</Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.statusPill,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Text style={[styles.statusPillInk, { color: colors.nbInk }]}>{chipLook.label}</Text>
    </View>
  );
}

/**
 * Empty dashed card when the client has no active coaching subscription.
 */
function EmptyCoachingPaymentCard({ colors, onAddMethod, trainerIdMissing }) {
  return (
    <NbCard style={[styles.empty, { borderStyle: 'dashed' }]}>
      <NbIconChip source={ICON_PAY} index={3} size={56} />
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>No active subscription</Text>
      <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
        You pay your trainer through Coach Connect once you have one. Add a payment method now so booking is quick.
      </Text>
      <NbButton
        variant="fill"
        onPress={onAddMethod}
        disabled={trainerIdMissing}
        style={styles.emptyBtn}
      >
        Add payment method
      </NbButton>
    </NbCard>
  );
}

/**
 * One row in the recent-charges list.
 */
function ChargeRow({ row, coachLabel, isLastRow, colors }) {
  const coachSubtitle = row.coach || firstNameFromFullName(coachLabel);
  const rowBorderStyle = isLastRow
    ? null
    : {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.nbBorder,
      };

  return (
    <View style={[styles.chargeRow, rowBorderStyle]}>
      <View style={styles.chargeMain}>
        <Text style={[styles.chargeDate, { color: colors.nbInk }]}>{row.date}</Text>
        <Text style={[styles.chargeSub, { color: colors.nbMuted }]}>{coachSubtitle}</Text>
      </View>
      <Text style={[styles.chargeAmt, { color: colors.nbInk }]}>
        {formatPaymentDollars(row.amount)}
      </Text>
      <PaymentStatusChip status={row.status} />
    </View>
  );
}

/**
 * Recent charges card — empty copy or a list of ChargeRow.
 */
function RecentChargesCard({ chargeRows, coachLabel, colors }) {
  const rows = chargeRows || [];
  if (rows.length === 0) {
    return (
      <NbCard style={styles.chargesCard}>
        <Text style={[styles.emptyCharges, { color: colors.nbMuted }]}>No charges yet.</Text>
      </NbCard>
    );
  }

  return (
    <NbCard style={styles.chargesCard}>
      {rows.map((row, rowIndex) => (
        <ChargeRow
          key={row.id}
          row={row}
          coachLabel={coachLabel}
          isLastRow={rowIndex === rows.length - 1}
          colors={colors}
        />
      ))}
    </NbCard>
  );
}

/**
 * Active subscription: hero rate + payment method + recent charges.
 */
function ActiveCoachingPaymentBody({
  colors,
  coachLabel,
  paymentStatus,
  rateLabel,
  rateUnit,
  cardLast4,
  cardBrand,
  cardExp,
  chargeRows,
  onOpenPayForm,
}) {
  const heroEyebrow = `COACHING WITH ${coachLabel.toUpperCase()}`;
  const isPastDue = paymentStatus === STATUS_PAST_DUE;
  const heroFootnote = isPastDue
    ? 'Payment past due — update your method to keep coaching.'
    : 'Billed per completed session.';
  const methodTitle = cardLast4
    ? `${cardBrand} ending ${cardLast4}`
    : 'Payment method';
  const methodSubtitle = cardExp
    ? `Expires ${cardExp}`
    : 'Tap Update to manage card';

  return (
    <>
      <HardShadow offset={nb.shadowOffsetCard} radius={16}>
        <View style={[styles.hero, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
          <View style={styles.heroTop}>
            <Text style={[styles.heroEyebrow, { color: colors.nbOnFill }]} numberOfLines={1}>
              {heroEyebrow}
            </Text>
            <PaymentStatusChip status={paymentStatus} />
          </View>
          <View style={styles.rateRow}>
            <Text style={[styles.rateNum, { color: colors.nbOnFill }]}>{rateLabel}</Text>
            <Text style={[styles.rateUnit, { color: colors.nbOnFill }]}>{rateUnit}</Text>
          </View>
          <Text style={[styles.heroFoot, { color: colors.nbOnFill }]}>{heroFootnote}</Text>
        </View>
      </HardShadow>

      <HardShadow offset={nb.shadowOffsetCard} radius={16}>
        <View
          style={[
            styles.methodRow,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          <NbIconChip source={ICON_PAY} index={4} size={44} />
          <View style={styles.methodText}>
            <Text style={[styles.methodTitle, { color: colors.nbInk }]}>{methodTitle}</Text>
            <Text style={[styles.methodSub, { color: colors.nbMuted }]}>{methodSubtitle}</Text>
          </View>
          <NbButton variant="ghost" sm onPress={onOpenPayForm}>
            Update
          </NbButton>
        </View>
      </HardShadow>

      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>RECENT CHARGES</Text>
      <RecentChargesCard chargeRows={chargeRows} coachLabel={coachLabel} colors={colors} />
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Coaching payment settings for a client linked to one trainer.
 */
export default function CoachingPaymentScreen({
  trainerId,
  trainerName,
  userData,
  onClose,
  onSuccess,
}) {
  const { colors } = useTheme();
  const scrollBottomPad = useModalScrollBottomPad(SCROLL_BOTTOM);
  const [showPayForm, setShowPayForm] = useState(false);

  // 1. Labels and rates come from the user doc — do not invent trainer pricing here.
  const trimmedTrainerName = String(trainerName || DEFAULT_COACH_LABEL).trim();
  const coachLabel = trimmedTrainerName || DEFAULT_COACH_LABEL;
  const sessionRate = readSessionRateFromUserData(userData);
  const paymentStatus = String(userData?.paymentStatus || 'inactive').toLowerCase();
  const hasActiveSubscription = clientHasActiveSubscriptionLook(trainerId, paymentStatus);

  // 2. Recent charges load from Firestore via hook-shaped helper (rows only).
  const clientId = userData?.uid || userData?.id || null;
  const { rows: chargeRows } = traineePaymentHistory(clientId, coachLabel);

  const cardLast4 = userData?.paymentMethodLast4 || userData?.cardLast4 || null;
  const cardBrand = userData?.paymentMethodBrand || userData?.cardBrand || DEFAULT_CARD_BRAND;
  const cardExp = userData?.paymentMethodExp || userData?.cardExp || null;

  let rateLabel = '—';
  if (sessionRate != null) {
    rateLabel = `$${Math.round(sessionRate)}`;
  }
  const rateUnit = userData?.monthlyRate ? '/mo' : '/session';
  const trainerIdMissing = !trainerId;

  function closePayForm() {
    setShowPayForm(false);
  }

  function openPayForm() {
    setShowPayForm(true);
  }

  function handlePaySuccess() {
    setShowPayForm(false);
    onSuccess?.();
  }

  // Pay form replaces the whole screen until close / success.
  if (showPayForm) {
    return (
      <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
        <PayTrainerPopup
          trainerId={trainerId}
          trainerName={coachLabel}
          onClose={closePayForm}
          onSuccess={handlePaySuccess}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NbPageHeader title="Coaching payment" onBack={onClose} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {!hasActiveSubscription ? (
          <EmptyCoachingPaymentCard
            colors={colors}
            onAddMethod={openPayForm}
            trainerIdMissing={trainerIdMissing}
          />
        ) : (
          <ActiveCoachingPaymentBody
            colors={colors}
            coachLabel={coachLabel}
            paymentStatus={paymentStatus}
            rateLabel={rateLabel}
            rateUnit={rateUnit}
            cardLast4={cardLast4}
            cardBrand={cardBrand}
            cardExp={cardExp}
            chargeRows={chargeRows}
            onOpenPayForm={openPayForm}
          />
        )}
      </ScrollView>
    </View>
  );
}

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  root: { flex: 1, maxHeight: '92%' },
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyBtn: { alignSelf: 'stretch', marginTop: 4 },
  hero: {
    borderWidth: nb.borderWidth,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroEyebrow: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  rateRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  rateNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 36,
    letterSpacing: -0.8,
  },
  rateUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  heroFoot: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    opacity: 0.85,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 16,
    padding: 12,
  },
  methodText: { flex: 1, minWidth: 0 },
  methodTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  methodSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
  },
  chargesCard: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  chargeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  chargeMain: { flex: 1, minWidth: 0 },
  chargeDate: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  chargeSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  chargeAmt: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  emptyCharges: {
    padding: 16,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  statusPill: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillDark: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    color: GRADIENT_PILL_INK,
  },
  statusPillInk: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
});
