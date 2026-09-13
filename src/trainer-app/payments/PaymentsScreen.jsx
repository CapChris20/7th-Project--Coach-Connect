/**
 * Payments Screen
 *
 * Purpose: UI screen or component: Payments Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: PaymentsScreen
 *
 * @file-header
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { setDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../../shared-ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import { useTrainerAppShell } from '../navigation/TrainerAppShellContext';
import { getClientInitials } from '../dashboard/trainerDashboardUi';
import { resolveStripeStatus, verifyStripeConnectStatus, getStripeConnectBalance } from '../../shared/api/stripeConnectApi';
import { useStripeConnectFlow } from '../../shared/payments/useStripeConnectFlow';
import { StripeConnectWebViewModal } from '../../shared/payments/StripeConnectWebViewModal';
import {
  HowPaymentsWorkSection,
  EarningsDashboardPreview,
} from '../../shared/payments/PaymentEducationSections';
import { useTrainerPaymentHistory } from '../../shared/payments/useTrainerPaymentHistory';
import { postSetClientRate } from '../../shared/api/trainerClientApi';
import { trainerClientDocRef } from '../crm/trainerClientFirestorePaths';
import { auth } from '../../app-start/config';

const ACCENT_PINK = '#BE185D';
const ACCENT_ORANGE = '#C2410C';
const PLATFORM_FEE_RATE = 0.1;

function formatUsdFromCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${(n / 100).toFixed(2)}`;
}

/** Stored rates are cents (>= 100 for $1+). Tiny legacy dollar values still supported. */
function monthlyRateToCents(rate) {
  if (rate == null || rate === '') return 0;
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n >= 100) return Math.round(n);
  return Math.round(n * 100);
}

function formatMonthlyRate(rate) {
  const cents = monthlyRateToCents(rate);
  if (!cents) return null;
  return formatUsdFromCents(cents);
}

function isBillingEnabled(paymentStatus, rateCents) {
  if (!rateCents) return false;
  const s = String(paymentStatus || '').trim();
  if (!s || s === 'inactive' || s === 'not_set' || s === 'none') return false;
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

function StatusChip({ label, tone, colors, isDark }) {
  const toneColor =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'error'
          ? colors.error
          : colors.textSecondary;
  const bg =
    tone === 'success'
      ? isDark
        ? 'rgba(48,209,88,0.15)'
        : 'rgba(48,209,88,0.12)'
      : tone === 'warning'
        ? isDark
          ? 'rgba(255,159,10,0.15)'
          : 'rgba(255,159,10,0.12)'
        : tone === 'error'
          ? isDark
            ? 'rgba(255,59,48,0.15)'
            : 'rgba(255,59,48,0.12)'
          : isDark
            ? 'rgba(255,255,255,0.08)'
            : 'rgba(0,0,0,0.06)';

  return (
    <View style={[chipStyles.wrap, { backgroundColor: bg, borderColor: `${toneColor}44` }]}>
      <Text style={[chipStyles.text, { color: toneColor }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
});

function GlassCard({ isDark, colors, children, style }) {
  return (
    <View
      style={[
        cardStyles.shell,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : colors.surface,
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  shell: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 16,
  },
});

export default function PaymentsScreen() {
  const shell = useTrainerAppShell();
  const { colors, isDark } = useTheme();
  const shellNavInset = useShellBottomNavInset(24);
  const clients = shell.clients || [];
  const profile = shell.trainerProfileDoc || {};

  const stripeConnectStatus = resolveStripeStatus(profile);
  const stripeAccountId = profile.stripeAccountId || '';
  const trainerUid = auth?.currentUser?.uid || profile.uid || profile.id || '';
  const { rows: paymentHistory, loading: paymentHistoryLoading } = useTrainerPaymentHistory(
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
  const nextPayout =
    stripeBalance.available != null
      ? `$${Number(stripeBalance.available).toFixed(2)} available`
      : profile.nextPayoutLabel || profile.nextPayoutDate || '—';

  const textColor = colors.text;
  const mutedColor = colors.textSecondary;

  const sectionLabelStyle = useMemo(
    () => ({
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 2,
      color: mutedColor,
      textTransform: 'uppercase',
      marginBottom: 12,
    }),
    [mutedColor],
  );

  const [rateModalClient, setRateModalClient] = useState(null);
  const [rateInput, setRateInput] = useState('');
  const [savingRate, setSavingRate] = useState(false);
  const [refreshingStripe, setRefreshingStripe] = useState(false);
  const [rateOverrides, setRateOverrides] = useState({});

  const openRateModal = useCallback((client) => {
    const existing = rateOverrides[client?.id]?.monthlyRate ?? client?.monthlyRate;
    const display =
      existing != null && Number(existing) >= 100
        ? String(Number(existing) / 100)
        : existing != null
          ? String(existing)
          : '';
    setRateInput(display);
    setRateModalClient(client);
  }, [rateOverrides]);

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

  const stripeConnect = useStripeConnectFlow({
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
        if (__DEV__) console.warn('[PaymentsScreen] set-client-rate API:', e?.message || e);
      }

      await shell.refreshClients?.();
      return { monthlyRate: amountInCents, paymentStatus };
    },
    [shell, clients, rateOverrides],
  );

  const handleToggleBilling = useCallback(
    async (client, turnOn) => {
      const override = rateOverrides[client.id] || {};
      const rateCents = monthlyRateToCents(override.monthlyRate ?? client.monthlyRate);

      if (turnOn) {
        if (!rateCents) {
          openRateModal(client);
          return;
        }
        try {
          await handleSetClientRate(client.id, rateCents, { billingEnabled: true });
        } catch (e) {
          Alert.alert('Couldn’t enable billing', e?.message || 'Please try again.');
        }
        return;
      }

      try {
        await handleSetClientRate(client.id, rateCents, { billingEnabled: false });
      } catch (e) {
        Alert.alert('Couldn’t turn off billing', e?.message || 'Please try again.');
      }
    },
    [rateOverrides, openRateModal, handleSetClientRate],
  );

  const parsedRatePreview = useMemo(() => {
    const dollars = parseFloat(String(rateInput).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) return null;
    const net = dollars * (1 - PLATFORM_FEE_RATE);
    return { gross: dollars, net };
  }, [rateInput]);

  const saveRate = useCallback(async () => {
    if (!rateModalClient?.id || savingRate) return;
    const dollars = parseFloat(String(rateInput).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(dollars) || dollars < 1) {
      Alert.alert('Invalid rate', 'Enter a monthly rate of at least $1.');
      return;
    }
    setSavingRate(true);
    try {
      await handleSetClientRate(rateModalClient.id, Math.round(dollars * 100), {
        billingEnabled: true,
      });
      setRateModalClient(null);
      setRateInput('');
    } catch (e) {
      Alert.alert('Couldn’t save rate', e?.message || 'Please try again.');
    } finally {
      setSavingRate(false);
    }
  }, [rateModalClient, rateInput, handleSetClientRate, savingRate]);

  const payoutStatusChip = () => {
    if (stripeConnectStatus === 'active') {
      return <StatusChip label="Active" tone="success" colors={colors} isDark={isDark} />;
    }
    if (stripeConnectStatus === 'pending') {
      return <StatusChip label="Pending verification" tone="warning" colors={colors} isDark={isDark} />;
    }
    return <StatusChip label="Not connected" tone="neutral" colors={colors} isDark={isDark} />;
  };

  const bankMask = stripeAccountId ? `****${String(stripeAccountId).slice(-4)}` : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={SHELL_SAFE_AREA_EDGES}>
      <CoachConnectHeader
        title="PAYMENTS"
        skipTopSafeInset
        onBack={shell.rootGoBack}
        onProfilePress={shell.openProfile}
        onSettingsPress={shell.openSettings}
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: shellNavInset }]}
        {...FORM_SCROLL_PROPS}
      >
        {/* Section 1 — Payout Account */}
        <GlassCard isDark={isDark} colors={colors}>
          <View style={styles.sectionHeaderRow}>
            <Text style={sectionLabelStyle}>PAYOUT ACCOUNT</Text>
            {payoutStatusChip()}
          </View>

          {stripeConnectStatus === 'not_connected' ? (
            <>
              <Text style={[styles.bodyText, { color: mutedColor }]}>
                Connect your bank account to receive in-app payments from clients. You keep 90% of each
                payment; payouts typically arrive in 2–5 business days.
              </Text>
              <View style={{ marginVertical: 12 }}>
                <HowPaymentsWorkSection
                  compact
                  textColor={textColor}
                  mutedColor={mutedColor}
                />
                <EarningsDashboardPreview
                  textColor={textColor}
                  mutedColor={mutedColor}
                  borderColor={isDark ? 'rgba(255,255,255,0.1)' : colors.border}
                />
              </View>
              <TouchableOpacity activeOpacity={0.92} onPress={handleConnectBank} style={styles.primaryBtnOuter}>
                <LinearGradient
                  colors={[ACCENT_PINK, ACCENT_ORANGE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  <Text style={styles.primaryBtnText}>Connect Bank Account</Text>
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : null}

          {stripeConnectStatus === 'pending' ? (
            <>
              <Text style={[styles.bodyText, { color: mutedColor }]}>
                {bankMask ? `Account: ${bankMask}. ` : ''}
                Stripe still needs your payout details, or is finishing verification. If you already
                submitted everything, tap Refresh — otherwise Finish setup.
              </Text>
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={handleConnectBank}
                style={styles.primaryBtnOuter}
                disabled={refreshingStripe}
              >
                <LinearGradient
                  colors={[ACCENT_PINK, ACCENT_ORANGE]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  <Text style={styles.primaryBtnText}>Finish setup</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={refreshStripeStatus}
                disabled={refreshingStripe}
                style={[
                  styles.secondaryBtn,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary,
                    opacity: refreshingStripe ? 0.7 : 1,
                  },
                ]}
              >
                {refreshingStripe ? (
                  <ActivityIndicator color={textColor} />
                ) : (
                  <Text style={[styles.secondaryBtnText, { color: textColor }]}>Refresh status</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}

          {stripeConnectStatus === 'active' ? (
            <>
              <Text style={[styles.bodyText, { color: mutedColor }]}>
                {bankMask ? `Bank account: ${bankMask}. ` : ''}
                Payouts are sent automatically every 2 business days by Stripe
              </Text>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={handleManageBank}
                style={[
                  styles.secondaryBtn,
                  {
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary,
                  },
                ]}
              >
                <Text style={[styles.secondaryBtnText, { color: textColor }]}>Manage Payout Account</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </GlassCard>

        {/* Section 2 — Earnings This Month */}
        <GlassCard isDark={isDark} colors={colors}>
          <Text style={sectionLabelStyle}>EARNINGS THIS MONTH</Text>
          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabel, { color: mutedColor }]}>Gross earnings</Text>
            <Text style={[styles.earningsValue, { color: textColor }]}>{formatUsdFromCents(grossCents)}</Text>
          </View>
          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabel, { color: mutedColor }]}>Platform fees (10%)</Text>
            <Text style={[styles.earningsValue, { color: textColor }]}>{formatUsdFromCents(feesCents)}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border }]} />
          <View style={styles.earningsRow}>
            <Text style={[styles.earningsLabelNet, { color: textColor }]}>Your net</Text>
            <Text style={[styles.earningsValueNet, { color: textColor }]}>{formatUsdFromCents(netCents)}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border, marginTop: 12 }]} />
          <View style={[styles.earningsRow, { marginTop: 12, marginBottom: 0 }]}>
            <Text style={[styles.earningsLabel, { color: mutedColor }]}>Next payout</Text>
            <Text style={[styles.earningsValue, { color: textColor }]}>{String(nextPayout)}</Text>
          </View>
        </GlassCard>

        {/* Section 3 — Client Billing Overview */}
        <View style={styles.billingHeaderBlock}>
          <Text style={[sectionLabelStyle, { marginBottom: 6 }]}>CLIENT BILLING</Text>
          <Text style={[styles.billingHint, { color: mutedColor }]}>
            Flip billing on, set their monthly rate. They get charged that amount in-app; you keep 90%.
          </Text>
        </View>
        {clients.length === 0 ? (
          <GlassCard isDark={isDark} colors={colors}>
            <Text style={[styles.bodyText, { color: mutedColor }]}>No connected clients yet.</Text>
          </GlassCard>
        ) : (
          clients.map((client) => {
            const override = rateOverrides[client.id] || {};
            const monthlyRate = override.monthlyRate ?? client.monthlyRate;
            const rateCents = monthlyRateToCents(monthlyRate);
            const name = client.name || client.displayName || 'Client';
            const initials = getClientInitials(name);
            const rateLabel = formatMonthlyRate(monthlyRate);
            const payStatus = override.paymentStatus || client.paymentStatus || 'inactive';
            const billingOn = isBillingEnabled(payStatus, rateCents);
            const youKeep = rateCents
              ? formatUsdFromCents(Math.round(rateCents * (1 - PLATFORM_FEE_RATE)))
              : null;
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
              <GlassCard key={client.id} isDark={isDark} colors={colors} style={{ marginBottom: 10, paddingVertical: 14 }}>
                <View style={styles.clientRow}>
                  <LinearGradient
                    colors={[ACCENT_PINK, ACCENT_ORANGE]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.clientAvatar}
                  >
                    <Text style={styles.clientAvatarText}>{initials}</Text>
                  </LinearGradient>
                  <View style={styles.clientBody}>
                    <Text style={[styles.clientName, { color: textColor }]} numberOfLines={1}>
                      {name}
                    </Text>
                    {rateLabel ? (
                      <Text style={[styles.clientRate, { color: textColor }]}>
                        {rateLabel}/mo
                        {youKeep ? (
                          <Text style={{ color: mutedColor, fontWeight: '600' }}>
                            {' '}
                            · you keep {youKeep}
                          </Text>
                        ) : null}
                      </Text>
                    ) : (
                      <Text style={[styles.clientRate, { color: mutedColor }]}>
                        No monthly rate yet
                      </Text>
                    )}
                  </View>
                  <View style={styles.billingToggleCol}>
                    <Text style={[styles.billingToggleLabel, { color: mutedColor }]}>
                      {billingOn ? 'On' : 'Off'}
                    </Text>
                    <Switch
                      value={billingOn}
                      onValueChange={(on) => handleToggleBilling(client, on)}
                      trackColor={{
                        false: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
                        true: ACCENT_PINK,
                      }}
                      thumbColor="#FFFFFF"
                      ios_backgroundColor={isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'}
                    />
                  </View>
                </View>

                <View
                  style={[
                    styles.clientActionsRow,
                    {
                      borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                    },
                  ]}
                >
                  <StatusChip
                    label={clientPaymentStatusLabel(payStatus, rateCents)}
                    tone={statusTone}
                    colors={colors}
                    isDark={isDark}
                  />
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => openRateModal(client)}
                    style={[
                      styles.setRateBtn,
                      {
                        borderColor: isDark ? 'rgba(255,255,255,0.14)' : colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text style={[styles.setRateBtnText, { color: textColor }]}>
                      {rateLabel ? 'Edit rate' : 'Set rate'}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={mutedColor} />
                  </TouchableOpacity>
                </View>
              </GlassCard>
            );
          })
        )}

        {/* Section 4 — Payment / Payout History */}
        <GlassCard isDark={isDark} colors={colors}>
          <Text style={sectionLabelStyle}>PAYMENT HISTORY</Text>
          {paymentHistoryLoading ? (
            <ActivityIndicator color={textColor} style={{ marginVertical: 16 }} />
          ) : paymentHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={36} color={mutedColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No payments yet</Text>
              <Text style={[styles.emptySub, { color: mutedColor }]}>
                When clients pay you in-app, each charge (minus the 10% platform fee) shows up here.
              </Text>
            </View>
          ) : (
            paymentHistory.map((row) => (
              <View
                key={row.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : colors.border,
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: textColor, fontWeight: '700', fontSize: 14 }}>
                    ${Number(row.net).toFixed(2)} net
                  </Text>
                  <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>
                    {row.date} · ${Number(row.amount).toFixed(2)} gross · {row.status}
                  </Text>
                </View>
                <Text style={{ color: mutedColor, fontSize: 12 }}>
                  Fee ${Number(row.fee).toFixed(2)}
                </Text>
              </View>
            ))
          )}
          {stripeBalance.pending != null || stripeBalance.available != null ? (
            <Text style={{ color: mutedColor, fontSize: 12, marginTop: 12 }}>
              Stripe balance — available ${Number(stripeBalance.available || 0).toFixed(2)}
              {stripeBalance.pending != null
                ? ` · pending $${Number(stripeBalance.pending).toFixed(2)}`
                : ''}
            </Text>
          ) : null}
        </GlassCard>
      </ScrollView>

      <ShellBottomNavAnchor>
        <BottomNavBar
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

      <Modal visible={!!rateModalClient} transparent animationType="slide" onRequestClose={() => setRateModalClient(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setRateModalClient(null)} />
          <View
            style={[
              styles.bottomSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Monthly rate</Text>
            {rateModalClient ? (
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {rateModalClient.name || rateModalClient.displayName || 'Client'} — what they pay you each month
              </Text>
            ) : null}

            <View
              style={[
                styles.netPreview,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surfaceSecondary,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : colors.border,
                },
              ]}
            >
              <Text style={[styles.netPreviewLabel, { color: colors.textSecondary }]}>You receive</Text>
              <Text style={[styles.netPreviewValue, { color: colors.text }]}>
                {parsedRatePreview ? `$${parsedRatePreview.net.toFixed(2)}/mo` : '—/mo'}
              </Text>
              <Text style={[styles.netPreviewHint, { color: colors.textSecondary }]}>After 10% platform fee</Text>
            </View>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Monthly rate (USD)</Text>
            <View
              style={[
                styles.inputWrap,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : colors.border,
                },
              ]}
            >
              <Text style={[styles.inputPrefix, { color: colors.textSecondary }]}>$</Text>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                value={rateInput}
                onChangeText={setRateInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.92}
              onPress={saveRate}
              style={[styles.primaryBtnOuter, savingRate && { opacity: 0.7 }]}
              disabled={savingRate}
            >
              <LinearGradient
                colors={[ACCENT_PINK, ACCENT_ORANGE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                {savingRate ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Save & turn billing on</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setRateModalClient(null)}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <StripeConnectWebViewModal
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
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  bodyText: { fontSize: 14, lineHeight: 20, marginTop: 4, marginBottom: 16 },
  primaryBtnOuter: { borderRadius: 12, overflow: 'hidden', marginTop: 4 },
  primaryBtnGradient: { paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryBtn: {
    marginTop: 4,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '700' },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  earningsLabel: { fontSize: 14, fontWeight: '600' },
  earningsValue: { fontSize: 15, fontWeight: '700' },
  earningsLabelNet: { fontSize: 15, fontWeight: '800' },
  earningsValueNet: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  clientBody: { flex: 1, minWidth: 0 },
  clientName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  clientRate: { fontSize: 13, fontWeight: '700', marginTop: 3 },
  billingHeaderBlock: { marginLeft: 4, marginBottom: 12 },
  billingHint: { fontSize: 13, lineHeight: 18, fontWeight: '500', paddingRight: 8 },
  billingToggleCol: { alignItems: 'center', gap: 4 },
  billingToggleLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  clientActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  setRateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  setRateBtnText: { fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, textAlign: 'center', marginBottom: 16, fontWeight: '600' },
  netPreview: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  netPreviewLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  netPreviewValue: { fontSize: 28, fontWeight: '900', marginTop: 4 },
  netPreviewHint: { fontSize: 12, marginTop: 4 },
  inputLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8, letterSpacing: 0.3 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  inputPrefix: { fontSize: 18, fontWeight: '700', marginRight: 4 },
  input: { flex: 1, fontSize: 18, fontWeight: '700', paddingVertical: 14 },
  cancelBtn: { paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
});
