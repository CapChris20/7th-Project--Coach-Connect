// Trainer Money screen — Stripe balance, global billing toggle, per-client pay status (Design Law).
// Flow: hero available balance → billing + rate card → client status list → edit-rate sheet (NbSlider).
// Used by trainer payments tab. Data keys (monthlyRate, paymentStatus) unchanged; projectId stays anatrox-auth.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Pressable,
  Platform,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, nb, borderRadius, accentGradients } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbSlider from '../../look-and-feel/NbSlider';
import HardShadow from '../../look-and-feel/HardShadow';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { useTrainerAppStartShell } from '../navigation/TrainerOpenScreenTracker';
import { getClientInitials } from '../home/trainerHomePieces';
import { resolveStripeStatus, verifyStripeConnectStatus, getStripeConnectBalance } from '../../for-both/payments/trainerPayoutSetup';
import { trainerPayoutSetupFlow } from '../../for-both/payments/trainerPayoutSetupFlow';
import { TrainerPayoutSetupPopup } from '../../for-both/payments/TrainerPayoutSetupPopup';
import { trainerPaymentHistory } from '../../for-both/payments/trainerPaymentHistory';
import { postSetClientRate } from '../../for-both/online-connection/linkTrainerAndTrainee';
import { trainerClientDocRef } from '../trainee-records/traineeDatabaseLocations';
import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const PLATFORM_FEE_RATE = 0.1;
const CENTS_PER_DOLLAR = 100;
const MIN_CENTS_AS_STORED_RATE = 100;
const SHELL_BOTTOM_INSET_EXTRA = 24;
// Manipulate here: edit-rate sheet slider bounds (Design Law mock 30–200, step 5)
const RATE_SLIDER_MIN = 30;
const RATE_SLIDER_MAX = 200;

// ===== HELPER FUNCTIONS =====

function formatUsdFromCents(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return '$0.00';
  return `$${(amount / CENTS_PER_DOLLAR).toFixed(2)}`;
}

/** Stored rates are cents (>= 100 for $1+). Tiny legacy dollar values still supported. */
function monthlyRateToCents(rate) {
  if (rate == null || rate === '') return 0;
  const amount = Number(rate);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount >= MIN_CENTS_AS_STORED_RATE) return Math.round(amount);
  return Math.round(amount * CENTS_PER_DOLLAR);
}

function formatMonthlyRate(rate) {
  const cents = monthlyRateToCents(rate);
  if (!cents) return null;
  return formatUsdFromCents(cents);
}

function isBillingEnabled(paymentStatus, rateCents) {
  if (!rateCents) return false;
  const statusKey = String(paymentStatus || '').trim();
  if (!statusKey || statusKey === 'inactive' || statusKey === 'not_set' || statusKey === 'none') return false;
  return true;
}

function clientPaymentStatusLabel(status, rateCents) {
  if (!rateCents) return 'No rate';
  switch (status) {
    case 'active':
      return 'Paid up';
    case 'awaiting_payment':
    case 'payment_required':
      return 'Awaiting pay';
    case 'past_due':
      return 'Past due';
    case 'inactive':
    case 'not_set':
    case 'none':
    case '':
    case undefined:
      return 'Billing off';
    default:
      return 'Billing off';
  }
}

function formatBalanceDollars(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n)) return '$0';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function clientSessionsSubline(client) {
  const count =
    client?.sessionsThisMonth ??
    client?.sessionsCountThisMonth ??
    client?.monthSessionCount;
  if (count == null || count === '') return null;
  const n = Number(count);
  if (!Number.isFinite(n)) return null;
  return `${n} session${n === 1 ? '' : 's'} this month`;
}

/** Design Law pay status — gradients only on Paid up / Past due; awaiting = neutral outline. */
function PaymentStatusPill({ label, tone, colors }) {
  const textStyle = [pillStyles.text, { color: colors.nbInk }];
  if (tone === 'success') {
    return (
      <LinearGradient colors={accentGradients[8]} style={pillStyles.gradient}>
        <Text style={textStyle}>{label}</Text>
      </LinearGradient>
    );
  }
  if (tone === 'error') {
    return (
      <LinearGradient colors={accentGradients[1]} style={pillStyles.gradient}>
        <Text style={textStyle}>{label}</Text>
      </LinearGradient>
    );
  }
  return (
    <View style={[pillStyles.neutral, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  gradient: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    borderColor: '#0A0A0F',
  },
  neutral: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
  text: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
  },
});

// ===== MAIN FUNCTION =====

/**
 * Trainer payments / earnings screen.
 */
export default function EarningsScreen() {
  const shell = useTrainerAppStartShell();
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const shellNavInset = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const clients = shell.clients || [];
  const profile = shell.trainerProfileDoc || {};

  const stripeConnectStatus = resolveStripeStatus(profile);
  const trainerUid = auth?.currentUser?.uid || profile.uid || profile.id || '';
  const { rows: paymentHistory } = trainerPaymentHistory(
    stripeConnectStatus === 'active' ? trainerUid : null,
  );
  const [stripeBalance, setStripeBalance] = useState({ pending: null, available: null });
  const profileGrossCents = Number(profile.earningsGrossCents) || 0;
  const profileFeesCents =
    Number(profile.earningsPlatformFeesCents) || Math.round(profileGrossCents * PLATFORM_FEE_RATE);
  const profileNetCents =
    Number(profile.earningsNetCents) || Math.max(0, profileGrossCents - profileFeesCents);

  // Prefer live payment history when profile counters are stale / unset.
  const earningsFromHistory = useMemo(() => {
    if (!paymentHistory.length) return null;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    let gross = 0;
    let fee = 0;
    let net = 0;
    let counted = 0;
    for (const row of paymentHistory) {
      if (row.createdAtMs && row.createdAtMs < monthStart) continue;
      if (String(row.status).toLowerCase() === 'failed') continue;
      gross += Number(row.amount) || 0;
      fee += Number(row.fee) || 0;
      net += Number(row.net) || 0;
      counted += 1;
    }
    if (!counted) return null;
    return {
      grossCents: Math.round(gross * 100),
      feesCents: Math.round(fee * 100),
      netCents: Math.round(net * 100),
    };
  }, [paymentHistory]);

  const grossCents = Math.max(profileGrossCents, earningsFromHistory?.grossCents || 0);
  const feesCents =
    grossCents === (earningsFromHistory?.grossCents || 0) && earningsFromHistory
      ? earningsFromHistory.feesCents
      : Math.max(profileFeesCents, earningsFromHistory?.feesCents || 0);
  const netCents =
    grossCents === (earningsFromHistory?.grossCents || 0) && earningsFromHistory
      ? earningsFromHistory.netCents
      : Math.max(profileNetCents, earningsFromHistory?.netCents || 0);
  const textColor = colors.nbInk;
  const mutedColor = colors.nbMuted;

  const sectionLabelStyle = useMemo(
    () => ({
      fontSize: 12,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontWeight: '700',
      letterSpacing: 0.1,
      color: mutedColor,
      textTransform: 'uppercase',
      marginBottom: 12,
    }),
    [mutedColor],
  );

  const [rateModalOpen, setRateModalOpen] = useState(false);
  const [rateModalAllClients, setRateModalAllClients] = useState(true);
  const [rateModalClient, setRateModalClient] = useState(null);
  const [rateSliderDollars, setRateSliderDollars] = useState(75);
  const [savingRate, setSavingRate] = useState(false);
  const [refreshingStripe, setRefreshingStripe] = useState(false);
  const [rateOverrides, setRateOverrides] = useState({});

  const globalRateCents = useMemo(() => {
    for (const client of clients) {
      const override = rateOverrides[client.id] || {};
      const cents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
      if (cents > 0) return cents;
    }
    return 0;
  }, [clients, rateOverrides]);

  const anyBillingOn = useMemo(
    () =>
      clients.some((client) => {
        const override = rateOverrides[client.id] || {};
        const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
        const payStatus = override.paymentStatus || client.paymentStatus || 'inactive';
        return isBillingEnabled(payStatus, rateCents);
      }),
    [clients, rateOverrides],
  );

  const openRateModal = useCallback(
    ({ allClients = true, client = null } = {}) => {
      const existingCents = allClients
        ? globalRateCents
        : monthlyRateToCents(
            rateOverrides[client?.id]?.monthlyRate ?? client?.monthlyRate,
          );
      const dollars =
        existingCents > 0
          ? existingCents / CENTS_PER_DOLLAR
          : Math.max(RATE_SLIDER_MIN, 75);
      const clamped = Math.min(RATE_SLIDER_MAX, Math.max(RATE_SLIDER_MIN, dollars));
      setRateSliderDollars(Math.round(clamped));
      setRateModalAllClients(allClients);
      setRateModalClient(client);
      setRateModalOpen(true);
    },
    [globalRateCents, rateOverrides],
  );

  const refreshStripeStatus = useCallback(async () => {
    setRefreshingStripe(true);
    try {
      await verifyStripeConnectStatus();
      await shell.refreshTrainerUserDoc?.();
    } catch (e) {
      Alert.alert('Couldn’t refresh', e?.message || 'Try Finish setup if Stripe still needs info.');
    } finally {
      setRefreshingStripe(false);
    }
  }, [shell]);

  const stripeConnect = trainerPayoutSetupFlow({
    email: auth?.currentUser?.email || profile.email || '',
    onActive: () => {
      shell.refreshTrainerUserDoc?.();
    },
  });

  useEffect(() => {
    if (stripeConnectStatus !== 'pending') return undefined;
    let cancelled = false;
    (async () => {
      try {
        await verifyStripeConnectStatus();
        if (!cancelled) await shell.refreshTrainerUserDoc?.();
      } catch (_) {
        /* keep pending UI; user can tap Refresh */
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only auto-check when we first land on pending — not on every shell object identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stripeConnectStatus]);

  useEffect(() => {
    if (stripeConnectStatus !== 'active') {
      setStripeBalance({ pending: null, available: null });
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const bal = await getStripeConnectBalance();
        if (!cancelled) {
          setStripeBalance({
            pending: bal?.pending ?? null,
            available: bal?.available ?? null,
          });
        }
      } catch (e) {
        console.warn('Stripe balance load failed:', e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stripeConnectStatus]);

  const handleConnectBank = useCallback(() => {
    if (stripeConnect.error) stripeConnect.retry();
    else stripeConnect.startConnect();
  }, [stripeConnect]);

  const handleManageBank = useCallback(() => {
    stripeConnect.startConnect();
  }, [stripeConnect]);

  const handleSetClientRate = useCallback(
    async (clientId, amountInCents, { billingEnabled = true } = {}) => {
      const trainerId = auth?.currentUser?.uid || shell.user?.uid;
      if (!trainerId || !clientId) throw new Error('Not signed in');

      const prevStatus = String(
        rateOverrides[clientId]?.paymentStatus ||
          clients.find((c) => c.id === clientId)?.paymentStatus ||
          '',
      ).trim();

      let paymentStatus = 'inactive';
      if (billingEnabled && amountInCents > 0) {
        paymentStatus =
          prevStatus === 'active' || prevStatus === 'past_due' ? prevStatus : 'awaiting_payment';
      }

      await setDoc(
        trainerClientDocRef(trainerId, clientId),
        {
          monthlyRate: amountInCents,
          paymentStatus,
          monthlyRateUpdatedAt: serverTimestamp(),
          monthlyRateUpdatedBy: trainerId,
        },
        { merge: true },
      );

      setRateOverrides((prev) => ({
        ...prev,
        [clientId]: { monthlyRate: amountInCents, paymentStatus },
      }));

      try {
        await postSetClientRate({ clientId, monthlyRateCents: amountInCents });
      } catch (e) {
        if (__DEV__) console.warn('[EarningsScreen] set-client-rate API:', e?.message || e);
      }

      await shell.refreshClients?.();
      return { monthlyRate: amountInCents, paymentStatus };
    },
    [shell, clients, rateOverrides],
  );

  const handleGlobalBillingToggle = useCallback(
    async (turnOn) => {
      if (turnOn) {
        const rateCents = globalRateCents;
        if (!rateCents) {
          openRateModal({ allClients: true });
          return;
        }
        try {
          for (const client of clients) {
            await handleSetClientRate(client.id, rateCents, { billingEnabled: true });
          }
        } catch (e) {
          Alert.alert('Couldn’t enable billing', e?.message || 'Please try again.');
        }
        return;
      }
      try {
        for (const client of clients) {
          const override = rateOverrides[client.id] || {};
          const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
          await handleSetClientRate(client.id, rateCents, { billingEnabled: false });
        }
      } catch (e) {
        Alert.alert('Couldn’t turn off billing', e?.message || 'Please try again.');
      }
    },
    [clients, globalRateCents, openRateModal, handleSetClientRate, rateOverrides],
  );

  const availableBalanceDollars =
    stripeBalance.available != null ? Number(stripeBalance.available) : netCents / CENTS_PER_DOLLAR;
  const pendingBalanceDollars =
    stripeBalance.pending != null ? Number(stripeBalance.pending) : null;
  const payoutSubline = useMemo(() => {
    const pendingPart =
      pendingBalanceDollars != null && pendingBalanceDollars > 0
        ? `$${Math.round(pendingBalanceDollars)} pending`
        : null;
    const nextPart =
      profile.nextPayoutLabel ||
      profile.nextPayoutDate ||
      (stripeConnectStatus === 'active' ? 'Next payout on Stripe schedule' : '—');
    if (pendingPart) return `${nextPart}. ${pendingPart}.`;
    return `${nextPart}.`;
  }, [pendingBalanceDollars, profile, stripeConnectStatus]);

  const saveRate = useCallback(async () => {
    if (!rateModalOpen || savingRate) return;
    const dollars = Number(rateSliderDollars);
    if (!Number.isFinite(dollars) || dollars < 1) {
      Alert.alert('Invalid rate', 'Enter a rate of at least $1.');
      return;
    }
    const amountInCents = Math.round(dollars * CENTS_PER_DOLLAR);
    setSavingRate(true);
    try {
      const targets = rateModalAllClients
        ? clients
        : rateModalClient?.id
          ? [rateModalClient]
          : clients;
      for (const client of targets) {
        if (!client?.id) continue;
        await handleSetClientRate(client.id, amountInCents, { billingEnabled: true });
      }
      setRateModalOpen(false);
      setRateModalClient(null);
    } catch (e) {
      Alert.alert('Couldn’t save rate', e?.message || 'Please try again.');
    } finally {
      setSavingRate(false);
    }
  }, [
    rateModalOpen,
    rateSliderDollars,
    rateModalAllClients,
    rateModalClient,
    clients,
    handleSetClientRate,
    savingRate,
  ]);

  const globalRateDisplay = globalRateCents
    ? formatUsdFromCents(globalRateCents).replace('.00', '')
    : '—';

  const closeRateSheet = () => {
    setRateModalOpen(false);
    setRateModalClient(null);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.nbBackground }]} edges={SHELL_SAFE_AREA_EDGES}>
      <TopHeader
        skipTopSafeInset
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: shellNavInset }]}
        {...FORM_SCROLL_PROPS}
      >
        <View style={styles.pageHeaderRow}>
          <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton}>
            <Pressable
              onPress={shell.rootGoBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={[
                styles.backSq,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
            </Pressable>
          </HardShadow>
          <Text style={[styles.pageTitle, { color: colors.nbInk }]}>Money</Text>
        </View>

        <HardShadow style={styles.heroShadow}>
          <View style={[styles.heroCard, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
            <Text style={[styles.heroEyebrow, { color: colors.nbOnFill, opacity: 0.75 }]}>
              AVAILABLE BALANCE
            </Text>
            <Text style={[styles.heroAmount, { color: colors.nbOnFill }]}>
              {formatBalanceDollars(availableBalanceDollars)}
            </Text>
            <Text style={[styles.heroSub, { color: colors.nbOnFill, opacity: 0.8 }]}>{payoutSubline}</Text>
          </View>
        </HardShadow>

        <HardShadow style={{ marginBottom: 16 }}>
          <NbCard style={styles.billingCard}>
            <View style={styles.billingTopRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.billingTitle, { color: colors.nbInk }]}>
                  {anyBillingOn ? 'Billing is on' : 'Billing is off'}
                </Text>
                <Text style={[styles.billingSub, { color: colors.nbMuted }]}>
                  Clients are charged per session
                </Text>
              </View>
              <Switch
                value={anyBillingOn}
                onValueChange={handleGlobalBillingToggle}
                trackColor={{ false: colors.nbBorder, true: colors.nbFill }}
                thumbColor={isDark ? darkColors.nbSurface : lightColors.white}
                ios_backgroundColor={colors.nbBorder}
              />
            </View>
            <View style={[styles.billingDivider, { borderTopColor: colors.nbBorder }]} />
            <View style={styles.rateRow}>
              <View>
                <Text style={[styles.rateEyebrow, { color: colors.nbMuted }]}>Your rate</Text>
                <Text style={[styles.rateAmount, { color: colors.nbInk }]}>
                  {globalRateDisplay}{' '}
                  <Text style={[styles.rateUnit, { color: colors.nbMuted }]}>/ session</Text>
                </Text>
              </View>
              <NbButton variant="ghost" sm onPress={() => openRateModal({ allClients: true })}>
                Edit rate
              </NbButton>
            </View>
          </NbCard>
        </HardShadow>

        <View style={styles.clientsSectionHead}>
          <Text style={sectionLabelStyle}>CLIENTS</Text>
          <NbButton variant="ghost" sm onPress={refreshStripeStatus} disabled={refreshingStripe}>
            {refreshingStripe ? 'Loading…' : 'Refresh status'}
          </NbButton>
        </View>

        {clients.length === 0 ? (
          <NbCard style={styles.card}>
            <Text style={[styles.bodyText, { color: mutedColor, marginBottom: 0 }]}>
              No connected clients yet.
            </Text>
          </NbCard>
        ) : (
          <HardShadow>
            <NbCard style={styles.clientListCard}>
              {clients.map((client, index) => {
                const override = rateOverrides[client.id] || {};
                const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
                const name = client.name || client.displayName || 'Client';
                const initials = getClientInitials(name);
                const payStatus = override.paymentStatus || client.paymentStatus || 'inactive';
                const billingOn = isBillingEnabled(payStatus, rateCents);
                const sessionsLine = clientSessionsSubline(client);
                const statusTone =
                  !rateCents || !billingOn
                    ? 'neutral'
                    : payStatus === 'active'
                      ? 'success'
                      : payStatus === 'past_due'
                        ? 'error'
                        : payStatus === 'awaiting_payment' || payStatus === 'payment_required'
                          ? 'warning'
                          : 'neutral';

                return (
                  <View
                    key={client.id}
                    style={[
                      styles.clientListRow,
                      index > 0 ? { borderTopWidth: nb.borderWidth, borderTopColor: colors.nbBorder } : null,
                    ]}
                  >
                    <NbAvatar size={44} initials={initials} />
                    <View style={styles.clientBody}>
                      <Text style={[styles.clientName, { color: textColor }]} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={[styles.clientSub, { color: mutedColor }]} numberOfLines={1}>
                        {sessionsLine || 'Connected client'}
                      </Text>
                    </View>
                    <PaymentStatusPill
                      label={clientPaymentStatusLabel(payStatus, rateCents)}
                      tone={statusTone}
                      colors={colors}
                    />
                  </View>
                );
              })}
            </NbCard>
          </HardShadow>
        )}

        {stripeConnectStatus === 'not_connected' ? (
          <View style={styles.stripeFoot}>
            <Text style={[styles.stripeFootText, { color: mutedColor }]}>
              Connect Stripe to receive payouts in-app.
            </Text>
            <NbButton variant="fill" onPress={handleConnectBank} style={{ marginTop: 10 }}>
              Connect bank account
            </NbButton>
          </View>
        ) : null}

        {stripeConnectStatus === 'pending' ? (
          <View style={styles.stripeFoot}>
            <Text style={[styles.stripeFootText, { color: mutedColor }]}>
              Stripe still asking for info? Try Finish setup.
            </Text>
            <View style={styles.stripeFootActions}>
              <NbButton variant="ghost" onPress={refreshStripeStatus} disabled={refreshingStripe}>
                Refresh status
              </NbButton>
              <NbButton variant="fill" onPress={handleConnectBank} disabled={refreshingStripe}>
                Finish setup
              </NbButton>
            </View>
          </View>
        ) : null}

        {stripeConnectStatus === 'active' ? (
          <TouchableOpacity onPress={handleManageBank} style={styles.managePayoutLink}>
            <Text style={[styles.stripeFootText, { color: mutedColor }]}>Manage payout account</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ShellBottomNavAnchor>
        <BottomMenuBar
          onHomePress={shell.handleHomePress}
          onProfilePress={shell.openProfile}
          onPlusPress={() => shell.handlePlusPress?.(shell.selectedClientIdFromDashboard)}
          onVoicePress={shell.openVoiceAI}
          onNutritionPress={shell.openNutrition}
          onWorkoutPress={shell.openWorkoutPlan}
          onMessagesPress={() => {
            shell.setShowTrainerMessaging?.(false);
            shell.setShowConversationsList?.(true);
          }}
          activeTabKey="home"
        />
      </ShellBottomNavAnchor>

      <Modal visible={rateModalOpen} transparent animationType="slide" onRequestClose={closeRateSheet}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeRateSheet} />
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.nbMuted }]} />
            <Text style={[styles.sheetTitle, { color: colors.nbInk }]}>Edit rate</Text>
            <View style={styles.sheetRateLine}>
              <Text style={[styles.sheetRateValue, { color: colors.nbInk }]}>
                ${rateSliderDollars}
              </Text>
              <Text style={[styles.sheetRateUnit, { color: colors.nbMuted }]}>per session</Text>
            </View>
            <NbSlider
              min={RATE_SLIDER_MIN}
              max={RATE_SLIDER_MAX}
              value={rateSliderDollars}
              onChange={setRateSliderDollars}
              style={{ marginBottom: 20 }}
            />
            <View style={styles.sheetActions}>
              <NbButton variant="ghost" onPress={closeRateSheet} style={{ flex: 1 }}>
                Cancel
              </NbButton>
              <NbButton variant="fill" onPress={saveRate} disabled={savingRate} style={{ flex: 1.6 }}>
                {savingRate ? 'Saving…' : 'Save and turn billing on'}
              </NbButton>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <TrainerPayoutSetupPopup
        visible={!!stripeConnect.webViewUrl}
        url={stripeConnect.webViewUrl}
        title="Connect with Stripe"
        isDark={isDark}
        onClose={() => stripeConnect.closeWebView({ userClosed: true })}
        onComplete={stripeConnect.handleWebViewComplete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8 },
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backSq: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroShadow: { marginBottom: 16 },
  heroCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 20,
    gap: 6,
  },
  heroEyebrow: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  heroAmount: {
    fontSize: 52,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '800',
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  heroSub: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  billingCard: { padding: 16, marginBottom: 0 },
  billingTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  billingTitle: { fontSize: 17, fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '700' },
  billingSub: { fontSize: 13, marginTop: 4, fontWeight: '600' },
  billingDivider: { borderTopWidth: nb.borderWidth, marginTop: 14, paddingTop: 14 },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rateEyebrow: { fontSize: 13, fontWeight: '600' },
  rateAmount: { fontSize: 30, fontFamily: 'SpaceGrotesk_700Bold', fontWeight: '800', marginTop: 2 },
  rateUnit: { fontSize: 14, fontWeight: '600' },
  clientsSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  card: { padding: 16, marginBottom: 16 },
  clientListCard: { paddingVertical: 4, paddingHorizontal: 14, marginBottom: 16 },
  clientListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    minHeight: nb.minTouchTarget + 8,
  },
  clientBody: { flex: 1, minWidth: 0 },
  clientName: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  clientSub: { fontSize: 13, fontWeight: '600', marginTop: 3 },
  bodyText: { fontSize: 14, lineHeight: 20 },
  stripeFoot: { marginTop: 16, alignItems: 'center', paddingHorizontal: 8 },
  stripeFootText: { fontSize: 13, textAlign: 'center', lineHeight: 18, fontWeight: '600' },
  stripeFootActions: { flexDirection: 'row', gap: 10, marginTop: 10, width: '100%' },
  managePayoutLink: { marginTop: 16, alignItems: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  bottomSheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: nb.borderWidth,
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 4,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '800',
    marginBottom: 12,
  },
  sheetRateLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 16 },
  sheetRateValue: {
    fontSize: 52,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 54,
  },
  sheetRateUnit: { fontSize: 16, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
});
