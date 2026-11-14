// Confirm / sent / error sheets for marketplace connection requests (PNG 17 / 19 / 21).
// Flow: confirm timeline → Cancel/Confirm; sent → Got it; error → Try again / Send message.
// Used by SearchTrainersScreen. Monthly rate falls back price → pricing.perMonth → rate.

import React from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const TRAINER_NAME_DEFAULT = 'Trainer';
const MIN_BOTTOM_PAD = 16;
const VARIANT_CONFIRM = 'confirm';
const VARIANT_SENT = 'sent';
const VARIANT_ERROR = 'error';
const CONFIRM_TITLE = 'Confirm your request';
const CONFIRM_BUSY_LABEL = 'Sending…';
const CONFIRM_READY_LABEL = 'Confirm';
const SENT_BADGE_TEXT = 'Request sent';
const ERROR_EYEBROW = 'UNABLE TO CONNECT';
const ERROR_TITLE = 'Connection requests are not available right now.';
const ERROR_BODY =
  'Nothing was sent. Try again in a minute, or message the coach directly.';
const SENT_SUBTITLE =
  'You are told as soon as they reply. Until then you can keep browsing.';
// Manipulate here: which accent pair paints the "Request sent" badge
const SENT_BADGE_GRADIENT_INDEX = 3;

// ===== HELPER FUNCTIONS =====

function readMonthlyRateFromTrainer(trainer) {
  if (!trainer) {
    return null;
  }
  if (trainer.price != null) {
    return trainer.price;
  }

  const pricingBlock = trainer.pricing;
  if (pricingBlock && pricingBlock.perMonth != null) {
    return pricingBlock.perMonth;
  }

  if (trainer.rate != null) {
    return trainer.rate;
  }
  return null;
}

function trainerFullName(trainer) {
  if (!trainer) {
    return TRAINER_NAME_DEFAULT;
  }
  if (trainer.displayName) {
    return trainer.displayName;
  }
  if (trainer.name) {
    return trainer.name;
  }
  return TRAINER_NAME_DEFAULT;
}

function firstNameFromFullName(fullName) {
  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts[0]) {
    return nameParts[0];
  }
  return fullName;
}

function monthlyRateIsValid(monthlyRate) {
  if (monthlyRate == null) {
    return false;
  }
  if (monthlyRate === '') {
    return false;
  }
  const rateAsNumber = Number(monthlyRate);
  if (!Number.isFinite(rateAsNumber)) {
    return false;
  }
  if (rateAsNumber <= 0) {
    return false;
  }
  return true;
}

function buildTrainerConfirmCopy(trainer) {
  const fullName = trainerFullName(trainer);
  const firstName = firstNameFromFullName(fullName);
  const monthlyRate = readMonthlyRateFromTrainer(trainer);
  const hasValidMonthlyRate = monthlyRateIsValid(monthlyRate);

  return {
    name: fullName,
    firstName,
    price: monthlyRate,
    hasPrice: hasValidMonthlyRate,
  };
}

function trialPriceSubtitle(hasPrice, price) {
  if (hasPrice) {
    return `Then $${Number(price)} per month. Cancel any time.`;
  }
  return 'Then their listed monthly rate. Cancel any time.';
}

function sentBadgeGradientColors() {
  const chosen = accentGradients[SENT_BADGE_GRADIENT_INDEX];
  if (chosen) {
    return chosen;
  }
  return accentGradients[0];
}

function pickBackdropCloseHandler(busy, onCancel, onGotIt) {
  if (busy) {
    return undefined;
  }
  if (onCancel) {
    return onCancel;
  }
  return onGotIt;
}

function resolveActiveVariant(variant) {
  if (variant) {
    return variant;
  }
  return VARIANT_CONFIRM;
}

// ===== SMALL UI PIECES =====

function TimelineStep({ index, title, subtitle, current, colors, isLast }) {
  const stepIsFilled = Boolean(current);
  let dotBackground = colors.nbSurface;
  let numberColor = colors.nbInk;
  if (stepIsFilled) {
    dotBackground = colors.nbFill;
    numberColor = colors.nbOnFill;
  }

  let connectorLine = null;
  if (!isLast) {
    connectorLine = (
      <View style={[styles.stepLine, { backgroundColor: colors.nbBorder }]} />
    );
  }

  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View
          style={[
            styles.stepDot,
            { backgroundColor: dotBackground, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.stepNum, { color: numberColor }]}>{index}</Text>
        </View>
        {connectorLine}
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepTitle, { color: colors.nbInk }]}>{title}</Text>
        <Text style={[styles.stepSub, { color: colors.nbMuted }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function SheetChrome({ colors, insets, children }) {
  const bottomPad = Math.max(insets.bottom, MIN_BOTTOM_PAD);

  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
          paddingBottom: bottomPad,
        },
      ]}
    >
      <View style={styles.handle}>
        <View style={[styles.handleBar, { backgroundColor: colors.nbBorder }]} />
      </View>
      {children}
    </View>
  );
}

function ConfirmBody({ firstName, hasPrice, price, busy, onCancel, onConfirm, colors }) {
  const trialPriceLine = trialPriceSubtitle(hasPrice, price);
  let confirmButtonLabel = CONFIRM_READY_LABEL;
  if (busy) {
    confirmButtonLabel = CONFIRM_BUSY_LABEL;
  }

  return (
    <>
      <Text style={[styles.title, { color: colors.nbInk }]}>{CONFIRM_TITLE}</Text>
      <View style={styles.timeline}>
        <TimelineStep
          index={1}
          title="You send the request"
          subtitle={`${firstName} sees your goals and message`}
          current
          colors={colors}
        />
        <TimelineStep
          index={2}
          title={`${firstName} accepts`}
          subtitle="Usually within a day"
          colors={colors}
        />
        <TimelineStep
          index={3}
          title="3–5 day free trial"
          subtitle={trialPriceLine}
          colors={colors}
          isLast
        />
      </View>
      <View style={styles.actions}>
        <NbButton variant="plain" onPress={onCancel} disabled={busy} style={styles.actionBtn}>
          Cancel
        </NbButton>
        <NbButton variant="fill" onPress={onConfirm} disabled={busy} style={styles.actionBtn}>
          {confirmButtonLabel}
        </NbButton>
      </View>
    </>
  );
}

function SentBody({ firstName, onGotIt, colors }) {
  // Manipulate here: SENT_BADGE_GRADIENT_INDEX picks which accentGradients pair
  const badgeGradient = sentBadgeGradientColors();

  return (
    <>
      <LinearGradient
        colors={badgeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.sentBadge, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.sentBadgeText, { color: colors.nbInk }]}>
          {SENT_BADGE_TEXT}
        </Text>
      </LinearGradient>
      <Text style={[styles.title, { color: colors.nbInk }]}>
        {firstName} has your request
      </Text>
      <Text style={[styles.sentSub, { color: colors.nbMuted }]}>{SENT_SUBTITLE}</Text>
      <NbButton variant="fill" onPress={onGotIt}>
        Got it
      </NbButton>
    </>
  );
}

function ErrorBody({ onRetry, onMessage, onCancel, colors }) {
  let retryHandler = onCancel;
  if (onRetry) {
    retryHandler = onRetry;
  }
  const showMessageButton = typeof onMessage === 'function';

  let messageButton = null;
  if (showMessageButton) {
    messageButton = (
      <NbButton variant="plain" onPress={onMessage} style={styles.messageBtnGap}>
        Send message
      </NbButton>
    );
  }

  return (
    <View
      style={[
        styles.errorBox,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Text style={[styles.errorEyebrow, { color: colors.nbMuted }]}>{ERROR_EYEBROW}</Text>
      <Text style={[styles.errorTitle, { color: colors.nbInk }]}>{ERROR_TITLE}</Text>
      <Text style={[styles.sentSub, { color: colors.nbMuted }]}>{ERROR_BODY}</Text>
      <NbButton variant="fill" onPress={retryHandler}>
        Try again
      </NbButton>
      {messageButton}
    </View>
  );
}

function sheetBodyForVariant(activeVariant, bodyProps) {
  if (activeVariant === VARIANT_SENT) {
    let gotItHandler = bodyProps.onCancel;
    if (bodyProps.onGotIt) {
      gotItHandler = bodyProps.onGotIt;
    }
    return (
      <SentBody
        firstName={bodyProps.firstName}
        onGotIt={gotItHandler}
        colors={bodyProps.colors}
      />
    );
  }

  if (activeVariant === VARIANT_ERROR) {
    return (
      <ErrorBody
        onRetry={bodyProps.onRetry}
        onMessage={bodyProps.onMessage}
        onCancel={bodyProps.onCancel}
        colors={bodyProps.colors}
      />
    );
  }

  return (
    <ConfirmBody
      firstName={bodyProps.firstName}
      hasPrice={bodyProps.hasPrice}
      price={bodyProps.price}
      busy={bodyProps.busy}
      onCancel={bodyProps.onCancel}
      onConfirm={bodyProps.onConfirm}
      colors={bodyProps.colors}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace connection-request bottom sheet (confirm / sent / error).
 * @param {object} props
 */
export default function ConfirmRequestPopup({
  visible,
  trainer,
  busy,
  onConfirm,
  onCancel,
  onGotIt,
  onRetry,
  onMessage,
  variant = VARIANT_CONFIRM,
}) {
  // 1. Theme + home-indicator insets for the sheet pad.
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // 2. Trainer copy shared by every variant (name + optional price).
  const confirmCopy = buildTrainerConfirmCopy(trainer);
  const firstName = confirmCopy.firstName;
  const price = confirmCopy.price;
  const hasPrice = confirmCopy.hasPrice;
  const activeVariant = resolveActiveVariant(variant);

  // 3. Busy blocks backdrop dismiss so a half-sent request cannot be cancelled by accident.
  const backdropCloseHandler = pickBackdropCloseHandler(busy, onCancel, onGotIt);

  // 4. Same shell — body swaps on variant.
  const sheetBody = sheetBodyForVariant(activeVariant, {
    firstName,
    hasPrice,
    price,
    busy,
    onCancel,
    onConfirm,
    onGotIt,
    onRetry,
    onMessage,
    colors,
  });

  // 5. Modal overlay + grabber sheet.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={backdropCloseHandler}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={backdropCloseHandler} />
        <SheetChrome colors={colors} insets={insets}>
          {sheetBody}
        </SheetChrome>
      </View>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignItems: 'center',
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  timeline: {
    marginBottom: spacing.lg,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 64,
  },
  stepRail: {
    width: 28,
    alignItems: 'center',
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNum: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  stepLine: {
    flex: 1,
    width: 3,
    marginVertical: 4,
    borderRadius: 2,
  },
  stepCopy: {
    flex: 1,
    paddingBottom: 16,
    gap: 2,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  stepSub: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.sm,
  },
  actionBtn: { flex: 1 },
  sentBadge: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.sm,
  },
  sentBadgeText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  sentSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  errorBox: {
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    padding: spacing.md,
    gap: 8,
    marginBottom: spacing.sm,
  },
  errorEyebrow: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
  },
  errorTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
    lineHeight: 26,
  },
  messageBtnGap: {
    marginTop: spacing.sm,
  },
});
