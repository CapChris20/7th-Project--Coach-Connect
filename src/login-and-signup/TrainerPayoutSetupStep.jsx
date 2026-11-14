// Trainer signup step that offers Stripe Connect so coaches can receive client payments.
// Flow: idle/error show Connect + Skip → connecting/pending show a spinner → active shows Continue.
// Used in Design Law trainer onboarding (step 8) and legacy flows. Bank payout only — not Face ID.
// Read order: constants → small UI helpers → main component → PLUMBING (styles) at the bottom.

import React from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { trainerPayoutSetupFlow } from '../for-both/payments/trainerPayoutSetupFlow';
import { TrainerPayoutSetupPopup } from '../for-both/payments/TrainerPayoutSetupPopup';
import NbButton from '../look-and-feel/NbButton';
import NbCard from '../look-and-feel/NbCard';
import HardShadow from '../look-and-feel/HardShadow';
import { nb, gradients, lightColors, darkColors, borderRadius, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const IDENTITY_ICON_COLOR = '#0A0A0A';
const PAYMENT_ICON_COLOR = lightColors.primary;
const SPINNER_CONNECTING_COLOR = lightColors.primary;
const SPINNER_PENDING_COLOR = '#0A0A0A';
const ERROR_TEXT_COLOR = '#FF453A';

const PHASE_IDLE = 'idle';
const PHASE_ERROR = 'error';
const PHASE_CONNECTING = 'connecting';
const PHASE_PENDING = 'pending';
const PHASE_ACTIVE = 'active';

const CONNECT_LABEL_DESIGN_LAW = 'Connect with Stripe';
const CONNECT_LABEL_LEGACY = 'CONNECT WITH STRIPE';
const RETRY_LABEL = 'Retry';
const SKIP_LABEL_DESIGN_LAW = 'Skip for now';
const SKIP_LABEL_LEGACY = 'SKIP FOR NOW';

// ===== HELPER FUNCTIONS =====

/**
 * Title/body colors that follow the onboarding dark/light theme.
 * @param {boolean} isDark
 * @returns {{ textPrimary: string, textSecondary: string, compareBorder: string, cardBg: string }}
 */
function payoutStepPalette(isDark) {
  if (isDark) {
    return {
      textPrimary: lightColors.nbBackground,
      textSecondary: darkColors.nbMuted,
      compareBorder: lightColors.nbBackground,
      cardBg: darkColors.nbSurface,
    };
  }
  return {
    textPrimary: lightColors.nbInk,
    textSecondary: lightColors.nbMuted,
    compareBorder: lightColors.nbInk,
    cardBg: lightColors.white,
  };
}

/**
 * Which blocks to show. One phase at a time — connecting and pending never share the button row.
 * @param {string} phase
 */
function payoutPhaseFlags(phase) {
  const showButtons = phase === PHASE_IDLE || phase === PHASE_ERROR;
  const isConnecting = phase === PHASE_CONNECTING;
  const isPending = phase === PHASE_PENDING;
  const isActive = phase === PHASE_ACTIVE;
  return { showButtons, isConnecting, isPending, isActive };
}

/**
 * Primary Connect/Retry button label for Design Law vs legacy chrome.
 * @param {boolean} hasError
 * @param {boolean} designLaw
 * @returns {string}
 */
function primaryPayoutButtonLabel(hasError, designLaw) {
  if (hasError) return RETRY_LABEL;
  if (designLaw) return CONNECT_LABEL_DESIGN_LAW;
  return CONNECT_LABEL_LEGACY;
}

/**
 * Skip button label for Design Law vs legacy chrome.
 * @param {boolean} designLaw
 * @returns {string}
 */
function skipPayoutButtonLabel(designLaw) {
  if (designLaw) return SKIP_LABEL_DESIGN_LAW;
  return SKIP_LABEL_LEGACY;
}

/**
 * Subtitle under the Payment method checklist row.
 * Named decision — no nested ternary in JSX.
 * @param {string} phase
 * @param {string|null} error
 * @returns {string}
 */
function paymentMethodChecklistSubtitle(phase, error) {
  if (phase === PHASE_ACTIVE) return 'Bank account verified';
  if (error) return 'Stripe could not finish';
  return 'Connect a bank account with Stripe';
}

/**
 * Subtitle under Identity verification checklist row.
 * @param {boolean} identityDone
 * @returns {string}
 */
function identityChecklistSubtitle(identityDone) {
  if (identityDone) return 'Submitted, in review';
  return 'Upload face photo first';
}

/**
 * Subtitle under "Start taking clients" checklist row.
 * @param {string} phase
 * @returns {string}
 */
function startClientsChecklistSubtitle(phase) {
  if (phase === PHASE_ACTIVE) return 'You are ready';
  return 'Unlock after payouts are active';
}

/**
 * Build the three Design Law checklist rows (trainer-setup-part-2 PNG 13–19).
 * @param {string} phase
 * @param {string|null} error
 * @param {boolean} identityDone
 */
function buildPayoutChecklistRows(phase, error, identityDone) {
  const payoutIsActive = phase === PHASE_ACTIVE;
  return [
    {
      title: 'Identity verification',
      sub: identityChecklistSubtitle(identityDone),
      done: identityDone,
      failed: false,
    },
    {
      title: 'Payment method',
      sub: paymentMethodChecklistSubtitle(phase, error),
      done: payoutIsActive,
      failed: Boolean(error),
    },
    {
      title: 'Start taking clients',
      sub: startClientsChecklistSubtitle(phase),
      done: payoutIsActive,
      failed: false,
    },
  ];
}

/**
 * One side of the Identity vs Payment explainer pair (legacy chrome).
 */
function CompareExplainCard({ iconName, iconColor, title, body, palette }) {
  const cardStyle = [
    payoutStyles.compareCard,
    {
      borderColor: palette.compareBorder,
      backgroundColor: palette.cardBg,
      borderWidth: nb.borderWidth,
    },
  ];

  return (
    <View style={cardStyle}>
      <Ionicons name={iconName} size={22} color={iconColor} />
      <Text style={[payoutStyles.compareTitle, { color: palette.textPrimary }]}>{title}</Text>
      <Text style={[payoutStyles.compareBody, { color: palette.textSecondary }]}>{body}</Text>
    </View>
  );
}

/**
 * Side-by-side explainer so trainers do not mix Face ID with Stripe payouts.
 */
function IdentityVsPaymentCards({ palette }) {
  return (
    <View style={payoutStyles.compareRow}>
      <CompareExplainCard
        iconName="scan-outline"
        iconColor={IDENTITY_ICON_COLOR}
        title="Identity Verification"
        body="Face ID selfie on your profile step — manual review for the Verified badge. Separate from payments."
        palette={palette}
      />
      <CompareExplainCard
        iconName="card-outline"
        iconColor={PAYMENT_ICON_COLOR}
        title="Payment Method"
        body="Bank transfer, debit card, and other Stripe payout options for coaching fees."
        palette={palette}
      />
    </View>
  );
}

/**
 * Connecting spinner + copy.
 */
function ConnectingStatus({ palette }) {
  return (
    <View style={payoutStyles.statusBlock}>
      <ActivityIndicator size="large" color={SPINNER_CONNECTING_COLOR} />
      <Text style={[payoutStyles.statusText, { color: palette.textSecondary }]}>
        Opening Stripe form…
      </Text>
    </View>
  );
}

/**
 * Pending verification spinner + copy (Stripe can take up to 24 hours).
 */
function PendingStatus({ palette }) {
  return (
    <View style={payoutStyles.statusBlock}>
      <ActivityIndicator size="large" color={SPINNER_PENDING_COLOR} />
      <Text style={[payoutStyles.statusText, { color: palette.textSecondary }]}>
        Verifying your account (up to 24 hours)…
      </Text>
    </View>
  );
}

/**
 * Active / success copy once the bank account is verified.
 */
function ActiveStatus({ palette }) {
  return (
    <View style={payoutStyles.statusBlock}>
      <Text style={payoutStyles.successIcon}>✅</Text>
      <Text style={[payoutStyles.successText, { color: palette.textPrimary }]}>
        Bank account verified!
      </Text>
    </View>
  );
}

/**
 * Spinner / success / error copy for the in-flight Stripe phases.
 * Each phase is a named local — no nested ternary in the return.
 */
function PayoutStatusBlock({ isConnecting, isPending, isActive, error, palette }) {
  let connectingBlock = null;
  if (isConnecting) {
    connectingBlock = <ConnectingStatus palette={palette} />;
  }

  let pendingBlock = null;
  if (isPending) {
    pendingBlock = <PendingStatus palette={palette} />;
  }

  let activeBlock = null;
  if (isActive) {
    activeBlock = <ActiveStatus palette={palette} />;
  }

  let errorBlock = null;
  if (error) {
    errorBlock = <Text style={payoutStyles.errorText}>{error}</Text>;
  }

  return (
    <>
      {connectingBlock}
      {pendingBlock}
      {activeBlock}
      {errorBlock}
    </>
  );
}

/**
 * Connect/Retry + Skip, or Continue after Stripe says the account is active.
 */
function PayoutActionButtons({
  showButtons,
  isActive,
  error,
  retry,
  startConnect,
  onSkip,
  onComplete,
  designLaw,
}) {
  const hasError = Boolean(error);
  const primaryLabel = primaryPayoutButtonLabel(hasError, designLaw);
  const primaryPress = hasError ? retry : startConnect;
  const skipLabel = skipPayoutButtonLabel(designLaw);
  const primaryVariant = designLaw ? 'fill' : 'brand';

  let buttonRow = null;
  if (showButtons) {
    buttonRow = (
      <View style={payoutStyles.actions}>
        <NbButton variant={primaryVariant} onPress={primaryPress}>
          {primaryLabel}
        </NbButton>
        <NbButton variant="plain" onPress={onSkip} style={payoutStyles.skipButton}>
          {skipLabel}
        </NbButton>
      </View>
    );
  }

  let continueButton = null;
  if (isActive) {
    continueButton = (
      <NbButton variant={primaryVariant} onPress={onComplete}>
        Continue
      </NbButton>
    );
  }

  return (
    <>
      {buttonRow}
      {continueButton}
    </>
  );
}

/**
 * One checklist row with a done / failed / empty circle.
 */
function ChecklistRow({ row, palette, showTopBorder }) {
  const borderTopWidth = showTopBorder ? nb.borderWidth : 0;
  const borderStyle = row.failed ? 'dashed' : 'solid';
  const circleBackground = row.done ? palette.textPrimary : palette.cardBg;

  let checkMark = null;
  if (row.done) {
    checkMark = (
      <Text style={{ color: palette.cardBg, fontWeight: '900', fontSize: 12 }}>✓</Text>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 14,
        borderTopWidth,
        borderTopColor: palette.compareBorder,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          borderWidth: nb.borderWidth,
          borderColor: palette.compareBorder,
          borderStyle,
          backgroundColor: circleBackground,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checkMark}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: palette.textPrimary }}>
          {row.title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            fontWeight: '600',
            color: palette.textSecondary,
            marginTop: 2,
          }}
        >
          {row.sub}
        </Text>
      </View>
    </View>
  );
}

/**
 * Error card shown when Stripe did not finish (Design Law body).
 */
function StripeDidNotFinishCard({ palette }) {
  return (
    <HardShadow>
      <NbCard>
        <Text style={{ fontSize: 16, fontWeight: '900', color: palette.textPrimary }}>
          That did not finish
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '600',
            color: palette.textSecondary,
            marginTop: 6,
          }}
        >
          Stripe still needs a detail. Try Finish setup again. Your progress is saved.
        </Text>
      </NbCard>
    </HardShadow>
  );
}

/**
 * Big success banner when payouts are active (Design Law body).
 */
function PayoutsVerifiedBanner({ palette }) {
  return (
    <View
      style={{
        borderWidth: nb.borderWidth,
        borderColor: palette.compareBorder,
        borderRadius: borderRadius.nbHero,
        backgroundColor: palette.textPrimary,
        padding: 16,
        gap: 6,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: '900',
          color: palette.textSecondary,
          letterSpacing: 1.1,
        }}
      >
        PAYOUTS
      </Text>
      <Text style={{ fontSize: 26, fontWeight: '900', color: palette.cardBg }}>
        Bank account verified!
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.cardBg, opacity: 0.9 }}>
        Clients can pay you and payouts go to your account on Tuesdays.
      </Text>
    </View>
  );
}

/**
 * Design Law checklist body (trainer-setup-part-2 PNG 13–19).
 */
function PayoutSetupBody({ palette, phase, error, identityDone }) {
  const rows = buildPayoutChecklistRows(phase, error, identityDone);
  const payoutIsActive = phase === PHASE_ACTIVE;

  let errorCard = null;
  if (error) {
    errorCard = <StripeDidNotFinishCard palette={palette} />;
  }

  let verifiedBanner = null;
  if (payoutIsActive) {
    verifiedBanner = <PayoutsVerifiedBanner palette={palette} />;
  }

  return (
    <View style={{ width: '100%', gap: spacing.md }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: palette.textPrimary }}>
        Get paid for sessions
      </Text>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          color: palette.textSecondary,
          lineHeight: 20,
        }}
      >
        Connect a bank account with Stripe. It takes about five minutes.
      </Text>
      {errorCard}
      {verifiedBanner}
      <HardShadow>
        <NbCard style={{ paddingVertical: 0 }}>
          {rows.map((row, rowIndex) => (
            <ChecklistRow
              key={row.title}
              row={row}
              palette={palette}
              showTopBorder={rowIndex > 0}
            />
          ))}
        </NbCard>
      </HardShadow>
    </View>
  );
}

/**
 * Legacy (non–Design Law) hero: card icon + title + compare cards.
 */
function LegacyPayoutIntro({ palette }) {
  return (
    <>
      <View style={payoutStyles.iconWrap}>
        <Ionicons name="card-outline" size={36} color={lightColors.white} />
      </View>

      <Text style={[payoutStyles.title, { color: palette.textPrimary }]}>Payment Method</Text>
      <Text style={[payoutStyles.subtitle, { color: palette.textSecondary }]}>
        This is for receiving client payments — not Face ID / identity verification.
      </Text>
      <Text style={[payoutStyles.message, { color: palette.textSecondary }]}>
        Stripe Connect lets you add a bank account, debit card, or other payout options so clients
        can pay you securely.
      </Text>

      <IdentityVsPaymentCards palette={palette} />
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Optional Stripe Connect step during trainer signup.
 * vocab: trainerPayoutSetupFlow = hook that opens Stripe's hosted form and reports phase.
 * Hook order must stay: flow first (it owns Stripe state), then derived UI flags.
 * @param {{ email?: string, isDark?: boolean, onSkip?: function, onComplete?: function, designLaw?: boolean, identitySubmitted?: boolean }} props
 */
export function TrainerPayoutSetupStep({
  email,
  isDark = true,
  onSkip,
  onComplete,
  designLaw = false,
  identitySubmitted = false,
}) {
  // Hook order frozen: payout flow owns Stripe state and must run first.
  const {
    phase,
    error,
    webViewUrl,
    startConnect,
    closeWebView,
    handleWebViewComplete,
    retry,
  } = trainerPayoutSetupFlow({
    email,
    onActive: () => {
      if (onComplete) {
        onComplete();
      }
    },
  });

  // 1. Theme palette + phase flags for which blocks to show.
  const palette = payoutStepPalette(isDark);
  const { showButtons, isConnecting, isPending, isActive } = payoutPhaseFlags(phase);
  const stripePopupVisible = Boolean(webViewUrl);

  // 2. Root layout: Design Law stretches full width; legacy stays centered.
  let rootStyle = payoutStyles.container;
  if (designLaw) {
    rootStyle = [payoutStyles.container, { alignItems: 'stretch', paddingTop: 0 }];
  }

  // 3. Intro body: Design Law checklist vs legacy icon + compare cards.
  let introBody = <LegacyPayoutIntro palette={palette} />;
  if (designLaw) {
    introBody = (
      <PayoutSetupBody
        palette={palette}
        phase={phase}
        error={error}
        identityDone={identitySubmitted}
      />
    );
  }

  // 4. Close handler for the Stripe WebView popup (user tapped X).
  const closeStripePopup = () => {
    closeWebView({ userClosed: true });
  };

  return (
    <View style={rootStyle}>
      {introBody}

      <PayoutStatusBlock
        isConnecting={isConnecting}
        isPending={isPending}
        isActive={isActive}
        error={error}
        palette={palette}
      />

      <PayoutActionButtons
        showButtons={showButtons}
        isActive={isActive}
        error={error}
        retry={retry}
        startConnect={startConnect}
        onSkip={onSkip}
        onComplete={onComplete}
        designLaw={designLaw}
      />

      <TrainerPayoutSetupPopup
        visible={stripePopupVisible}
        url={webViewUrl}
        title="Connect with Stripe"
        isDark={isDark}
        onClose={closeStripePopup}
        onComplete={handleWebViewComplete}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

function makePayoutStepStyles() {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: 8,
    },
    iconWrap: {
      marginBottom: 20,
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: gradients.brand.colors[0],
      borderWidth: nb.borderWidth,
      borderColor: lightColors.nbInk,
    },
    compareRow: {
      width: '100%',
      flexDirection: 'row',
      gap: 10,
      marginBottom: 20,
    },
    compareCard: {
      flex: 1,
      borderRadius: 14,
      padding: 12,
      gap: 6,
    },
    compareTitle: {
      fontSize: 13,
      fontWeight: '800',
      marginTop: 4,
    },
    compareBody: {
      fontSize: 11,
      lineHeight: 15,
    },
    title: {
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 20,
    },
    statusBlock: {
      alignItems: 'center',
      marginVertical: 20,
      gap: 12,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      paddingHorizontal: 16,
    },
    successIcon: {
      fontSize: 40,
    },
    successText: {
      fontSize: 18,
      fontWeight: '800',
      textAlign: 'center',
    },
    errorText: {
      color: ERROR_TEXT_COLOR,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 16,
      paddingHorizontal: 8,
    },
    actions: {
      width: '100%',
      marginTop: 8,
      gap: 12,
    },
    skipButton: {
      marginTop: 0,
    },
  });
}

const payoutStyles = makePayoutStepStyles();
