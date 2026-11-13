// Design Law client Coaching payment (settings PNG 07 active / 08 empty).
// Flow: show subscription card + payment method + recent charges, or empty dashed shell → Add method.
// Used as the modal body from ClientAppStart (replaces bare PayTrainerPopup-only chrome).
//
// vocab: useTraineePaymentHistory = Firestore payments for this client
// Manipulate here: empty CTA copy, status pill labels

import React, { useMemo, useState } from 'react';
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

// ===== HELPERS =====

function firstName(fullName) {
  const text = String(fullName || 'your trainer').trim();
  return text.split(/\s+/)[0] || text;
}

function statusPill(status) {
  const key = String(status || '').toLowerCase();
  if (key === STATUS_ACTIVE || key === 'succeeded' || key === 'completed' || key === 'paid') {
    return { label: 'Active', fill: true };
  }
  if (key === STATUS_PAST_DUE || key === 'failed' || key === 'past due') {
    return { label: 'Past due', gradient: true };
  }
  if (key === 'pending') return { label: 'Pending', fill: false };
  return { label: 'Paid', fill: false };
}

function StatusChip({ status }) {
  const { colors } = useTheme();
  const pill = statusPill(status);
  if (pill.gradient) {
    return (
      <LinearGradient
        colors={accentGradients[1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.statusPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={styles.statusPillDark}>{pill.label}</Text>
      </LinearGradient>
    );
  }
  if (pill.fill) {
    return (
      <LinearGradient
        colors={accentGradients[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.statusPill, { borderColor: colors.nbBorder }]}
      >
        <Text style={styles.statusPillDark}>{pill.label}</Text>
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
      <Text style={[styles.statusPillInk, { color: colors.nbInk }]}>{pill.label}</Text>
    </View>
  );
}

// ===== MAIN =====

/**
 * @param {{
 *   trainerId: string,
 *   trainerName?: string,
 *   userData?: object,
 *   onClose: Function,
 *   onSuccess?: Function,
 * }} props
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

  const coachLabel = String(trainerName || 'Your trainer').trim() || 'Your trainer';
  const rate =
    Number(userData?.sessionRate) ||
    Number(userData?.monthlyRate) ||
    Number(userData?.trainerRate) ||
    null;
  const paymentStatus = String(userData?.paymentStatus || 'inactive').toLowerCase();
  const hasSubscription =
    !!trainerId &&
    (paymentStatus === STATUS_ACTIVE ||
      paymentStatus === STATUS_PAST_DUE ||
      paymentStatus === 'payment_required');

  const clientId = userData?.uid || userData?.id || null;
  const { rows: chargeRows } = traineePaymentHistory(clientId, coachLabel);

  const cardLast4 = userData?.paymentMethodLast4 || userData?.cardLast4 || null;
  const cardBrand = userData?.paymentMethodBrand || userData?.cardBrand || 'Visa';
  const cardExp = userData?.paymentMethodExp || userData?.cardExp || null;

  const heroEyebrow = `COACHING WITH ${coachLabel.toUpperCase()}`;
  const rateLabel = rate != null ? `$${Math.round(rate)}` : '—';
  const rateUnit = userData?.monthlyRate ? '/mo' : '/session';

  if (showPayForm) {
    return (
      <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
        <PayTrainerPopup
          trainerId={trainerId}
          trainerName={coachLabel}
          onClose={() => setShowPayForm(false)}
          onSuccess={() => {
            setShowPayForm(false);
            onSuccess?.();
          }}
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
        {!hasSubscription ? (
          <NbCard style={[styles.empty, { borderStyle: 'dashed' }]}>
            <NbIconChip source={ICON_PAY} index={3} size={56} />
            <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>
              No active subscription
            </Text>
            <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
              You pay your trainer through Coach Connect once you have one. Add a payment method now so booking is quick.
            </Text>
            <NbButton
              variant="fill"
              onPress={() => setShowPayForm(true)}
              disabled={!trainerId}
              style={styles.emptyBtn}
            >
              Add payment method
            </NbButton>
          </NbCard>
        ) : (
          <>
            <HardShadow offset={nb.shadowOffsetCard} radius={16}>
              <View style={[styles.hero, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
                <View style={styles.heroTop}>
                  <Text style={[styles.heroEyebrow, { color: colors.nbOnFill }]} numberOfLines={1}>
                    {heroEyebrow}
                  </Text>
                  <StatusChip status={paymentStatus} />
                </View>
                <View style={styles.rateRow}>
                  <Text style={[styles.rateNum, { color: colors.nbOnFill }]}>{rateLabel}</Text>
                  <Text style={[styles.rateUnit, { color: colors.nbOnFill }]}>{rateUnit}</Text>
                </View>
                <Text style={[styles.heroFoot, { color: colors.nbOnFill }]}>
                  {paymentStatus === STATUS_PAST_DUE
                    ? 'Payment past due — update your method to keep coaching.'
                    : 'Billed per completed session.'}
                </Text>
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
                  <Text style={[styles.methodTitle, { color: colors.nbInk }]}>
                    {cardLast4
                      ? `${cardBrand} ending ${cardLast4}`
                      : 'Payment method'}
                  </Text>
                  <Text style={[styles.methodSub, { color: colors.nbMuted }]}>
                    {cardExp ? `Expires ${cardExp}` : 'Tap Update to manage card'}
                  </Text>
                </View>
                <NbButton variant="ghost" sm onPress={() => setShowPayForm(true)}>
                  Update
                </NbButton>
              </View>
            </HardShadow>

            <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>RECENT CHARGES</Text>
            <NbCard style={styles.chargesCard}>
              {(chargeRows || []).length === 0 ? (
                <Text style={[styles.emptyCharges, { color: colors.nbMuted }]}>
                  No charges yet.
                </Text>
              ) : (
                (chargeRows || []).map((row, index) => (
                  <View
                    key={row.id}
                    style={[
                      styles.chargeRow,
                      index < chargeRows.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.nbBorder,
                      },
                    ]}
                  >
                    <View style={styles.chargeMain}>
                      <Text style={[styles.chargeDate, { color: colors.nbInk }]}>{row.date}</Text>
                      <Text style={[styles.chargeSub, { color: colors.nbMuted }]}>
                        {row.coach || firstName(coachLabel)}
                      </Text>
                    </View>
                    <Text style={[styles.chargeAmt, { color: colors.nbInk }]}>
                      {formatPaymentDollars(row.amount)}
                    </Text>
                    <StatusChip status={row.status} />
                  </View>
                ))
              )}
            </NbCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

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
    color: '#0A0A0F',
  },
  statusPillInk: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
});
