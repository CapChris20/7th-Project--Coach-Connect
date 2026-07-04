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
import React, { useMemo, useState, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared-ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor, FORM_SCROLL_PROPS } from '../../navigation/bottomNavMetrics';
import { useTrainerAppShell } from '../navigation/TrainerAppShellContext';
import { getClientInitials } from '../dashboard/trainerDashboardUi';
import { resolveStripeStatus } from '../../shared/api/stripeConnectApi';
import { useStripeConnectFlow } from '../../shared/payments/useStripeConnectFlow';
import { StripeConnectWebViewModal } from '../../shared/payments/StripeConnectWebViewModal';
import {
  HowPaymentsWorkSection,
  EarningsDashboardPreview,
} from '../../shared/payments/PaymentEducationSections';
import { auth } from '../../app-start/config';

const ACCENT_PINK = '#BE185D';
const ACCENT_ORANGE = '#C2410C';
const PLATFORM_FEE_RATE = 0.1;

function formatUsdFromCents(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${(n / 100).toFixed(2)}`;
}

function formatUsdFromDollars(dollars) {
  const n = Number(dollars);
  if (!Number.isFinite(n)) return '$0.00';
  return `$${n.toFixed(2)}`;
}

function formatMonthlyRate(rate) {
  if (rate == null || rate === '') return null;
  const n = Number(rate);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n >= 100 ? formatUsdFromCents(n) : formatUsdFromDollars(n);
}

function clientPaymentStatusLabel(status) {
  switch (status) {
    case 'active':
      return 'Active';
    case 'awaiting_payment':
    case 'payment_required':
      return 'Awaiting payment';
    case 'past_due':
      return 'Past due';
    default:
      return 'Inactive';
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
  const clients = shell.clients || [];
  const profile = shell.trainerProfileDoc || {};

  const stripeConnectStatus = resolveStripeStatus(profile);
  const stripeAccountId = profile.stripeAccountId || '';
  const grossCents = Number(profile.earningsGrossCents) || 0;
  const feesCents = Number(profile.earningsPlatformFeesCents) || Math.round(grossCents * PLATFORM_FEE_RATE);
  const netCents = Number(profile.earningsNetCents) || Math.max(0, grossCents - feesCents);
  const nextPayout = profile.nextPayoutLabel || profile.nextPayoutDate || '—';

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

  const openRateModal = useCallback((client) => {
    const existing = client?.monthlyRate;
    const display =
      existing != null && Number(existing) >= 100
        ? String(Number(existing) / 100)
        : existing != null
          ? String(existing)
          : '';
    setRateInput(display);
    setRateModalClient(client);
  }, []);

  const stripeConnect = useStripeConnectFlow({
    email: auth?.currentUser?.email || profile.email || '',
    onActive: () => {
      shell.refetchTrainerProfile?.();
    },
  });

  const handleConnectBank = useCallback(() => {
    if (stripeConnect.error) stripeConnect.retry();
    else stripeConnect.startConnect();
  }, [stripeConnect]);

  const handleManageBank = useCallback(() => {
    stripeConnect.startConnect();
  }, [stripeConnect]);

  const handleSetClientRate = useCallback((clientId, amountInCents) => {
    console.log('[PaymentsScreen] handleSetClientRate placeholder', { clientId, amountInCents });
  }, []);

  const parsedRatePreview = useMemo(() => {
    const dollars = parseFloat(String(rateInput).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) return null;
    const net = dollars * (1 - PLATFORM_FEE_RATE);
    return { gross: dollars, net };
  }, [rateInput]);

  const saveRate = useCallback(() => {
    if (!rateModalClient?.id) return;
    const dollars = parseFloat(String(rateInput).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) return;
    handleSetClientRate(rateModalClient.id, Math.round(dollars * 100));
    setRateModalClient(null);
    setRateInput('');
  }, [rateModalClient, rateInput, handleSetClientRate]);

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
        contentContainerStyle={[styles.scroll, { paddingBottom: BOTTOM_NAV_BAR_HEIGHT + 24 }]}
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
            <Text style={[styles.bodyText, { color: mutedColor }]}>
              {bankMask ? `Bank account: ${bankMask}. ` : ''}
              Stripe is verifying your account. This usually takes 1-2 business days.
            </Text>
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
        <Text style={[sectionLabelStyle, { marginLeft: 4, marginBottom: 10 }]}>CLIENT BILLING</Text>
        {clients.length === 0 ? (
          <GlassCard isDark={isDark} colors={colors}>
            <Text style={[styles.bodyText, { color: mutedColor }]}>No connected clients yet.</Text>
          </GlassCard>
        ) : (
          clients.map((client) => {
            const name = client.name || client.displayName || 'Client';
            const initials = getClientInitials(name);
            const rateLabel = formatMonthlyRate(client.monthlyRate);
            const payStatus = client.paymentStatus || 'inactive';
            const statusTone =
              payStatus === 'active'
                ? 'success'
                : payStatus === 'past_due'
                  ? 'error'
                  : payStatus === 'awaiting_payment' || payStatus === 'payment_required'
                    ? 'warning'
                    : 'neutral';

            return (
              <TouchableOpacity key={client.id} activeOpacity={0.88} onPress={() => openRateModal(client)}>
                <GlassCard isDark={isDark} colors={colors} style={{ marginBottom: 10 }}>
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
                      <Text style={[styles.clientRate, { color: mutedColor }]}>
                        {rateLabel ? `${rateLabel}/mo` : 'No rate set'}
                      </Text>
                    </View>
                    <StatusChip
                      label={clientPaymentStatusLabel(payStatus)}
                      tone={statusTone}
                      colors={colors}
                      isDark={isDark}
                    />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}

        {/* Section 4 — Payout History */}
        <GlassCard isDark={isDark} colors={colors}>
          <Text style={sectionLabelStyle}>PAYOUT HISTORY</Text>
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={36} color={mutedColor} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No payouts yet</Text>
            <Text style={[styles.emptySub, { color: mutedColor }]}>
              Completed payouts will appear here once clients are billed.
            </Text>
          </View>
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
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Set Monthly Coaching Rate</Text>
            {rateModalClient ? (
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {rateModalClient.name || rateModalClient.displayName || 'Client'}
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
              <Text style={[styles.netPreviewHint, { color: colors.textSecondary }]}>After 5% platform fee</Text>
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

            <TouchableOpacity activeOpacity={0.92} onPress={saveRate} style={styles.primaryBtnOuter}>
              <LinearGradient
                colors={[ACCENT_PINK, ACCENT_ORANGE]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryBtnGradient}
              >
                <Text style={styles.primaryBtnText}>Save Rate</Text>
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
  clientRate: { fontSize: 13, fontWeight: '600', marginTop: 2 },
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
