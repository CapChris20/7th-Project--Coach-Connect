// Trainer Money screen — Stripe balance, global billing toggle, per-client pay status (Design Law).
// Flow: hero available balance → billing + rate card → client status list → edit-rate sheet (NbSlider).
// Used by trainer payments tab. Data keys (monthlyRate, paymentStatus) unchanged; projectId stays anatrox-auth.
//
// vocab: monthlyRate = cents on the client doc (>= 100 means $1+); tiny legacy dollar values still supported
// vocab: paymentStatus = active | past_due | awaiting_payment | inactive (frozen letters)

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
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
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
const DEFAULT_RATE_SLIDER_DOLLARS = 75;
// Manipulate here: edit-rate sheet slider bounds (Design Law mock 30–200, step 5)
const RATE_SLIDER_MIN = 30;
const RATE_SLIDER_MAX = 200;

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  return maybeFunction(...args);
}

async function callIfFunctionAsync(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  return await maybeFunction(...args);
}

function authCurrentUserUid() {
  if (!auth) return '';
  if (!auth.currentUser) return '';
  return auth.currentUser.uid || '';
}

function authCurrentUserEmail() {
  if (!auth) return '';
  if (!auth.currentUser) return '';
  return auth.currentUser.email || '';
}

function shellUserUid(shell) {
  if (!shell || !shell.user) return '';
  return shell.user.uid || '';
}

function errorMessageOrFallback(errorObject, fallbackText) {
  if (errorObject && errorObject.message) return errorObject.message;
  return fallbackText;
}

function noticeTitle(notice) {
  if (!notice) return '';
  return notice.title || '';
}

function noticeMessage(notice) {
  if (!notice) return undefined;
  return notice.message;
}

function noticeConfirmLabel(notice) {
  if (!notice) return 'OK';
  return notice.confirmLabel || 'OK';
}

function noticeCancelLabel(notice) {
  if (!notice) return undefined;
  return notice.cancelLabel;
}

function noticeOnConfirm(notice) {
  if (!notice) return undefined;
  return notice.onConfirm;
}

function historyGrossCents(earningsFromHistory) {
  if (!earningsFromHistory) return 0;
  return earningsFromHistory.grossCents || 0;
}

function historyFeesCents(earningsFromHistory) {
  if (!earningsFromHistory) return 0;
  return earningsFromHistory.feesCents || 0;
}

function historyNetCents(earningsFromHistory) {
  if (!earningsFromHistory) return 0;
  return earningsFromHistory.netCents || 0;
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

/** Design Law pay status — gradients only on Paid up / Past due; awaiting = neutral outline. */
function ClientPayStatusPill({ label, tone, colors }) {
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
    <View
      style={[
        pillStyles.neutral,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Text style={textStyle}>{label}</Text>
    </View>
  );
}

function payStatusPillTone(payStatus, rateCents, billingOn) {
  if (!rateCents || !billingOn) return 'neutral';
  if (payStatus === 'active') return 'success';
  if (payStatus === 'past_due') return 'error';
  if (payStatus === 'awaiting_payment' || payStatus === 'payment_required') return 'warning';
  return 'neutral';
}

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

function isBillingEnabled(paymentStatus, rateCents) {
  if (!rateCents) return false;
  const statusKey = String(paymentStatus || '').trim();
  if (!statusKey || statusKey === 'inactive' || statusKey === 'not_set' || statusKey === 'none') {
    return false;
  }
  return true;
}

function clientPaymentStatusLabel(status, rateCents) {
  if (!rateCents) return 'No rate';
  if (status === 'active') return 'Paid up';
  if (status === 'awaiting_payment' || status === 'payment_required') return 'Awaiting pay';
  if (status === 'past_due') return 'Past due';
  return 'Billing off';
}

function formatBalanceDollars(dollars) {
  const dollarAmount = Number(dollars);
  if (!Number.isFinite(dollarAmount)) return '$0';
  return `$${Math.round(dollarAmount).toLocaleString('en-US')}`;
}

function rawSessionCountFromClient(client) {
  if (!client) return null;
  if (client.sessionsThisMonth != null) return client.sessionsThisMonth;
  if (client.sessionsCountThisMonth != null) return client.sessionsCountThisMonth;
  return client.monthSessionCount;
}

function clientSessionsSubline(client) {
  const count = rawSessionCountFromClient(client);
  if (count == null || count === '') return null;
  const sessionCount = Number(count);
  if (!Number.isFinite(sessionCount)) return null;
  const plural = sessionCount === 1 ? '' : 's';
  return `${sessionCount} session${plural} this month`;
}

function findClientById(clients, clientId) {
  for (const client of clients) {
    if (client.id === clientId) return client;
  }
  return null;
}

function pickPaymentStatusForRateSave(prevStatus, billingEnabled, amountInCents) {
  if (!billingEnabled || amountInCents <= 0) return 'inactive';
  if (prevStatus === 'active' || prevStatus === 'past_due') return prevStatus;
  return 'awaiting_payment';
}

function clampRateSliderDollars(dollars) {
  return Math.min(RATE_SLIDER_MAX, Math.max(RATE_SLIDER_MIN, dollars));
}

function pendingAndAvailableFromBalance(balance) {
  let pendingBalance = null;
  let availableBalance = null;
  if (!balance) {
    return { pendingBalance, availableBalance };
  }
  if (balance.pending != null) pendingBalance = balance.pending;
  if (balance.available != null) availableBalance = balance.available;
  return { pendingBalance, availableBalance };
}

async function loadStripeBalanceIntoState(setStripeBalance, isCancelled) {
  try {
    const balance = await getStripeConnectBalance();
    if (isCancelled()) return;
    const { pendingBalance, availableBalance } = pendingAndAvailableFromBalance(balance);
    setStripeBalance({
      pending: pendingBalance,
      available: availableBalance,
    });
  } catch (earningsError) {
    console.warn('Stripe balance load failed:', errorMessageOrFallback(earningsError, earningsError));
  }
}

function sumThisMonthPaymentHistory(paymentHistory) {
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
}

function pickFeesCents(grossCents, profileFeesCents, earningsFromHistory) {
  const historyGross = historyGrossCents(earningsFromHistory);
  const historyMatchesGross = earningsFromHistory && grossCents === historyGross;
  if (historyMatchesGross) return earningsFromHistory.feesCents;
  return Math.max(profileFeesCents, historyFeesCents(earningsFromHistory));
}

function pickNetCents(grossCents, profileNetCents, earningsFromHistory) {
  const historyGross = historyGrossCents(earningsFromHistory);
  const historyMatchesGross = earningsFromHistory && grossCents === historyGross;
  if (historyMatchesGross) return earningsFromHistory.netCents;
  return Math.max(profileNetCents, historyNetCents(earningsFromHistory));
}

function buildPayoutSubline(pendingBalanceDollars, profile, stripeConnectStatus) {
  let pendingPart = null;
  if (pendingBalanceDollars != null && pendingBalanceDollars > 0) {
    pendingPart = `$${Math.round(pendingBalanceDollars)} pending`;
  }

  let nextPart = profile.nextPayoutLabel || profile.nextPayoutDate || '—';
  if (!profile.nextPayoutLabel && !profile.nextPayoutDate && stripeConnectStatus === 'active') {
    nextPart = 'Next payout on Stripe schedule';
  }

  if (pendingPart) return `${nextPart}. ${pendingPart}.`;
  return `${nextPart}.`;
}

function EarningsClientListRow({
  client,
  index,
  rateOverrides,
  colors,
  textColor,
  mutedColor,
}) {
  const override = rateOverrides[client.id] || {};
  const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
  const displayName = client.name || client.displayName || 'Client';
  const initials = getClientInitials(displayName);
  const payStatus = override.paymentStatus || client.paymentStatus || 'inactive';
  const billingOn = isBillingEnabled(payStatus, rateCents);
  const sessionsLine = clientSessionsSubline(client);
  const statusLabel = clientPaymentStatusLabel(payStatus, rateCents);
  const statusTone = payStatusPillTone(payStatus, rateCents, billingOn);
  const sublineText = sessionsLine || 'Connected client';

  let rowBorder = null;
  if (index > 0) {
    rowBorder = { borderTopWidth: nb.borderWidth, borderTopColor: colors.nbBorder };
  }

  return (
    <View style={[styles.clientListRow, rowBorder]}>
      <NbAvatar size={44} initials={initials} />
      <View style={styles.clientBody}>
        <Text style={[styles.clientName, { color: textColor }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.clientSub, { color: mutedColor }]} numberOfLines={1}>
          {sublineText}
        </Text>
      </View>
      <ClientPayStatusPill label={statusLabel} tone={statusTone} colors={colors} />
    </View>
  );
}

function StripeNotConnectedFoot({ mutedColor, onConnect }) {
  return (
    <View style={styles.stripeFoot}>
      <Text style={[styles.stripeFootText, { color: mutedColor }]}>
        Connect Stripe to receive payouts in-app.
      </Text>
      <NbButton variant="fill" onPress={onConnect} style={{ marginTop: 10 }}>
        Connect bank account
      </NbButton>
    </View>
  );
}

function StripePendingFoot({ mutedColor, onRefresh, onFinish, refreshingStripe }) {
  return (
    <View style={styles.stripeFoot}>
      <Text style={[styles.stripeFootText, { color: mutedColor }]}>
        Stripe still asking for info? Try Finish setup.
      </Text>
      <View style={styles.stripeFootActions}>
        <NbButton variant="ghost" onPress={onRefresh} disabled={refreshingStripe}>
          Refresh status
        </NbButton>
        <NbButton variant="fill" onPress={onFinish} disabled={refreshingStripe}>
          Finish setup
        </NbButton>
      </View>
    </View>
  );
}


function buildClientListRows(clients, rateOverrides, colors, textColor, mutedColor) {
  const rows = [];
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    rows.push(
      <EarningsClientListRow
        key={client.id}
        client={client}
        index={index}
        rateOverrides={rateOverrides}
        colors={colors}
        textColor={textColor}
        mutedColor={mutedColor}
      />,
    );
  }
  return rows;
}

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
  const trainerUid = authCurrentUserUid() || profile.uid || profile.id || '';
  const { rows: paymentHistory } = trainerPaymentHistory(
    stripeConnectStatus === 'active' ? trainerUid : null,
  );
  const [stripeBalance, setStripeBalance] = useState({ pending: null, available: null });
  const [notice, setNotice] = useState(null);

  function showNotice(title, message, extras = {}) {
    setNotice({ title, message, ...extras });
  }

  const profileGrossCents = Number(profile.earningsGrossCents) || 0;
  const profileFeesCents =
    Number(profile.earningsPlatformFeesCents) ||
    Math.round(profileGrossCents * PLATFORM_FEE_RATE);
  const profileNetCents =
    Number(profile.earningsNetCents) || Math.max(0, profileGrossCents - profileFeesCents);

  // Prefer live payment history when profile counters are stale / unset.
  const earningsFromHistory = useMemo(
    () => sumThisMonthPaymentHistory(paymentHistory),
    [paymentHistory],
  );

  const grossCents = Math.max(profileGrossCents, historyGrossCents(earningsFromHistory));
  const feesCents = pickFeesCents(grossCents, profileFeesCents, earningsFromHistory);
  const netCents = pickNetCents(grossCents, profileNetCents, earningsFromHistory);
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
  const [rateSliderDollars, setRateSliderDollars] = useState(DEFAULT_RATE_SLIDER_DOLLARS);
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

  const anyBillingOn = useMemo(() => {
    for (const client of clients) {
      const override = rateOverrides[client.id] || {};
      const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
      const payStatus = override.paymentStatus || client.paymentStatus || 'inactive';
      if (isBillingEnabled(payStatus, rateCents)) return true;
    }
    return false;
  }, [clients, rateOverrides]);

  const openRateModal = useCallback(
    ({ allClients = true, client = null } = {}) => {
      // 1. Prefer the global rate when editing everyone; else this client's rate.
      let existingCents = globalRateCents;
      if (!allClients) {
        let overrideRate = null;
        const clientIdForRate = client && client.id;
        if (clientIdForRate && rateOverrides[clientIdForRate]) {
          overrideRate = rateOverrides[clientIdForRate].monthlyRate;
        }
        const clientRate = client ? client.monthlyRate : null;
        existingCents = monthlyRateToCents(
          overrideRate != null ? overrideRate : clientRate,
        );
      }

      // 2. Seed the slider (default $75 when no rate yet).
      let dollars = DEFAULT_RATE_SLIDER_DOLLARS;
      if (existingCents > 0) {
        dollars = existingCents / CENTS_PER_DOLLAR;
      } else {
        dollars = Math.max(RATE_SLIDER_MIN, DEFAULT_RATE_SLIDER_DOLLARS);
      }

      // 3. Clamp to Design Law bounds and open the sheet.
      setRateSliderDollars(Math.round(clampRateSliderDollars(dollars)));
      setRateModalAllClients(allClients);
      setRateModalClient(client);
      setRateModalOpen(true);
    },
    [globalRateCents, rateOverrides],
  );

  const refreshStripeStatus = useCallback(async () => {
    // 1. Ask Stripe Connect for the latest status.
    setRefreshingStripe(true);
    try {
      await verifyStripeConnectStatus();
      // 2. Refresh the trainer profile doc so the UI catches up.
      await callIfFunctionAsync(shell.refreshTrainerUserDoc);
    } catch (earningsError) {
      showNotice('Couldn’t refresh', errorMessageOrFallback(earningsError, 'Try Finish setup if Stripe still needs info.'));
    } finally {
      setRefreshingStripe(false);
    }
  }, [shell]);

  const stripeConnect = trainerPayoutSetupFlow({
    email: authCurrentUserEmail() || profile.email || '',
    onActive: () => {
      callIfFunction(shell.refreshTrainerUserDoc);
    },
  });

  useEffect(() => {
    if (stripeConnectStatus !== 'pending') return undefined;
    let cancelled = false;
    (async () => {
      try {
        await verifyStripeConnectStatus();
        if (!cancelled) await callIfFunctionAsync(shell.refreshTrainerUserDoc);
      } catch (_pendingError) {
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
    loadStripeBalanceIntoState(setStripeBalance, () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [stripeConnectStatus]);

  const handleConnectBank = useCallback(() => {
    if (stripeConnect.error) {
      stripeConnect.retry();
      return;
    }
    stripeConnect.startConnect();
  }, [stripeConnect]);

  const handleManageBank = useCallback(() => {
    stripeConnect.startConnect();
  }, [stripeConnect]);

  const handleSetClientRate = useCallback(
    async (clientId, amountInCents, { billingEnabled = true } = {}) => {
      // 1. Need a signed-in trainer and a client id.
      const trainerId = authCurrentUserUid() || shellUserUid(shell);
      if (!trainerId || !clientId) throw new Error('Not signed in');

      // 2. Keep active / past_due when billing stays on; otherwise awaiting or inactive.
      const matchedClient = findClientById(clients, clientId);
      let overridePaymentStatus = '';
      if (rateOverrides[clientId] && rateOverrides[clientId].paymentStatus) {
        overridePaymentStatus = rateOverrides[clientId].paymentStatus;
      }
      let matchedPaymentStatus = '';
      if (matchedClient && matchedClient.paymentStatus) {
        matchedPaymentStatus = matchedClient.paymentStatus;
      }
      const prevStatus = String(
        overridePaymentStatus || matchedPaymentStatus || '',
      ).trim();
      const paymentStatus = pickPaymentStatusForRateSave(
        prevStatus,
        billingEnabled,
        amountInCents,
      );

      // 3. Write monthlyRate + paymentStatus on the trainer↔client doc (field letters frozen).
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

      // 4. Optimistic local override so the list updates before the refresh lands.
      setRateOverrides((prev) => ({
        ...prev,
        [clientId]: { monthlyRate: amountInCents, paymentStatus },
      }));

      // 5. Best-effort API mirror — Firestore write already succeeded.
      try {
        await postSetClientRate({ clientId, monthlyRateCents: amountInCents });
      } catch (earningsError) {
        if (__DEV__) console.warn('[EarningsScreen] set-client-rate API:', errorMessageOrFallback(earningsError, earningsError));
      }

      await callIfFunctionAsync(shell.refreshClients);
      return { monthlyRate: amountInCents, paymentStatus };
    },
    [shell, clients, rateOverrides],
  );

  async function enableBillingForAllClients(rateCents) {
    for (const client of clients) {
      await handleSetClientRate(client.id, rateCents, { billingEnabled: true });
    }
  }

  async function disableBillingForAllClients() {
    for (const client of clients) {
      const override = rateOverrides[client.id] || {};
      const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);
      await handleSetClientRate(client.id, rateCents, { billingEnabled: false });
    }
  }

  const handleGlobalBillingToggle = useCallback(
    async (turnOn) => {
      // 1. Turning on with no rate yet → open the edit-rate sheet instead.
      if (turnOn) {
        const rateCents = globalRateCents;
        if (!rateCents) {
          openRateModal({ allClients: true });
          return;
        }
        try {
          await enableBillingForAllClients(rateCents);
        } catch (earningsError) {
          showNotice('Couldn’t enable billing', errorMessageOrFallback(earningsError, 'Please try again.'));
        }
        return;
      }

      // 2. Turning off → keep rates, set paymentStatus inactive for everyone.
      try {
        await disableBillingForAllClients();
      } catch (earningsError) {
        showNotice('Couldn’t turn off billing', errorMessageOrFallback(earningsError, 'Please try again.'));
      }
    },
    // enable/disable close over latest clients / rateOverrides / handleSetClientRate
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, globalRateCents, openRateModal, handleSetClientRate, rateOverrides],
  );

  let availableBalanceDollars = netCents / CENTS_PER_DOLLAR;
  if (stripeBalance.available != null) {
    availableBalanceDollars = Number(stripeBalance.available);
  }

  let pendingBalanceDollars = null;
  if (stripeBalance.pending != null) {
    pendingBalanceDollars = Number(stripeBalance.pending);
  }

  const payoutSubline = useMemo(
    () => buildPayoutSubline(pendingBalanceDollars, profile, stripeConnectStatus),
    [pendingBalanceDollars, profile, stripeConnectStatus],
  );

  async function saveRateForTargets(amountInCents) {
    let rateSaveTargets = clients;
    if (!rateModalAllClients && rateModalClient && rateModalClient.id) {
      rateSaveTargets = [rateModalClient];
    }
    for (const client of rateSaveTargets) {
      if (!client || !client.id) continue;
      await handleSetClientRate(client.id, amountInCents, { billingEnabled: true });
    }
  }

  const saveRate = useCallback(async () => {
    // 1. Ignore double-taps while the sheet is closed or already saving.
    if (!rateModalOpen || savingRate) return;

    // 2. Need a finite rate of at least $1.
    const dollars = Number(rateSliderDollars);
    if (!Number.isFinite(dollars) || dollars < 1) {
      showNotice('Invalid rate', 'Enter a rate of at least $1.');
      return;
    }

    // 3. Write the rate (all clients or one) and turn billing on.
    const amountInCents = Math.round(dollars * CENTS_PER_DOLLAR);
    setSavingRate(true);
    try {
      await saveRateForTargets(amountInCents);
      setRateModalOpen(false);
      setRateModalClient(null);
    } catch (earningsError) {
      showNotice('Couldn’t save rate', errorMessageOrFallback(earningsError, 'Please try again.'));
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

  let globalRateDisplay = '—';
  if (globalRateCents) {
    globalRateDisplay = formatUsdFromCents(globalRateCents).replace('.00', '');
  }

  const billingTitle = anyBillingOn ? 'Billing is on' : 'Billing is off';
  const refreshStatusLabel = refreshingStripe ? 'Loading…' : 'Refresh status';
  const saveRateLabel = savingRate ? 'Saving…' : 'Save and turn billing on';
  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : 'height';
  const switchThumbColor = isDark ? darkColors.nbSurface : lightColors.white;
  const hasClients = clients.length > 0;
  const showNotConnected = stripeConnectStatus === 'not_connected';
  const showPending = stripeConnectStatus === 'pending';
  const showActiveManage = stripeConnectStatus === 'active';

  function closeRateSheet() {
    setRateModalOpen(false);
    setRateModalClient(null);
  }

  function openGlobalRateModal() {
    openRateModal({ allClients: true });
  }

  function openMessagesFromNav() {
    callIfFunction(shell.setShowTrainerMessaging, false);
    callIfFunction(shell.setShowConversationsList, true);
  }

  function closeNotice() {
    setNotice(null);
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
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
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
            ]}
          >
            <Text style={[styles.heroEyebrow, { color: colors.nbOnFill, opacity: 0.75 }]}>
              AVAILABLE BALANCE
            </Text>
            <Text style={[styles.heroAmount, { color: colors.nbOnFill }]}>
              {formatBalanceDollars(availableBalanceDollars)}
            </Text>
            <Text style={[styles.heroSub, { color: colors.nbOnFill, opacity: 0.8 }]}>
              {payoutSubline}
            </Text>
          </View>
        </HardShadow>

        <HardShadow style={{ marginBottom: 16 }}>
          <NbCard style={styles.billingCard}>
            <View style={styles.billingTopRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.billingTitle, { color: colors.nbInk }]}>
                  {billingTitle}
                </Text>
                <Text style={[styles.billingSub, { color: colors.nbMuted }]}>
                  Clients are charged per session
                </Text>
              </View>
              <Switch
                value={anyBillingOn}
                onValueChange={handleGlobalBillingToggle}
                trackColor={{ false: colors.nbBorder, true: colors.nbFill }}
                thumbColor={switchThumbColor}
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
              <NbButton variant="ghost" sm onPress={openGlobalRateModal}>
                Edit rate
              </NbButton>
            </View>
          </NbCard>
        </HardShadow>

        <View style={styles.clientsSectionHead}>
          <Text style={sectionLabelStyle}>CLIENTS</Text>
          <NbButton variant="ghost" sm onPress={refreshStripeStatus} disabled={refreshingStripe}>
            {refreshStatusLabel}
          </NbButton>
        </View>

        {!hasClients ? (
          <NbCard style={styles.card}>
            <Text style={[styles.bodyText, { color: mutedColor, marginBottom: 0 }]}>
              No connected clients yet.
            </Text>
          </NbCard>
        ) : (
          <HardShadow>
            <NbCard style={styles.clientListCard}>
              {buildClientListRows(clients, rateOverrides, colors, textColor, mutedColor)}
            </NbCard>
          </HardShadow>
        )}

        {showNotConnected ? (
          <StripeNotConnectedFoot mutedColor={mutedColor} onConnect={handleConnectBank} />
        ) : null}

        {showPending ? (
          <StripePendingFoot
            mutedColor={mutedColor}
            onRefresh={refreshStripeStatus}
            onFinish={handleConnectBank}
            refreshingStripe={refreshingStripe}
          />
        ) : null}

        {showActiveManage ? (
          <TouchableOpacity onPress={handleManageBank} style={styles.managePayoutLink}>
            <Text style={[styles.stripeFootText, { color: mutedColor }]}>
              Manage payout account
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <ShellBottomNavAnchor>
        <BottomMenuBar
          onHomePress={shell.handleHomePress}
          onProfilePress={shell.openProfile}
          onPlusPress={() => callIfFunction(shell.handlePlusPress, shell.selectedClientIdFromDashboard)}
          onVoicePress={shell.openVoiceAI}
          onNutritionPress={shell.openNutrition}
          onWorkoutPress={shell.openWorkoutPlan}
          onMessagesPress={openMessagesFromNav}
          activeTabKey="home"
        />
      </ShellBottomNavAnchor>

      <Modal
        visible={rateModalOpen}
        transparent
        animationType="slide"
        onRequestClose={closeRateSheet}
      >
        <KeyboardAvoidingView behavior={keyboardBehavior} style={styles.modalRoot}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeRateSheet}
          />
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
              <NbButton
                variant="fill"
                onPress={saveRate}
                disabled={savingRate}
                style={{ flex: 1.6 }}
              >
                {saveRateLabel}
              </NbButton>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <NbNoticeSheet
        visible={!!notice}
        onClose={closeNotice}
        title={noticeTitle(notice)}
        message={noticeMessage(notice)}
        confirmLabel={noticeConfirmLabel(notice)}
        cancelLabel={noticeCancelLabel(notice)}
        onConfirm={noticeOnConfirm(notice)}
      />

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

// ===== PLUMBING — skip unless debugging =====

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
  rateAmount: {
    fontSize: 30,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '800',
    marginTop: 2,
  },
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
