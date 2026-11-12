// Confirm / sent / error sheets for marketplace connection requests (PNG 17 / 19 / 21).
// Flow: confirm timeline → Cancel/Confirm; sent → Got it; error → Try again / Send message.
// Used by SearchTrainersScreen. Price is read from price, then pricing.perMonth, then rate.
//
// vocab: variant = 'confirm' | 'sent' | 'error' — same Modal shell, different body
// vocab: HardShadow sheet = Design Law bottom modal with 3px border + grabber

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

// ===== HELPER FUNCTIONS =====

/**
 * Marketplace cards store the monthly rate in three different fields. First one that exists wins.
 * @param {object} trainer
 * @returns {*}
 */
function getTrainerPrice(trainer) {
  if (!trainer) return null;
  if (trainer.price != null) return trainer.price;
  const perMonth = trainer.pricing && trainer.pricing.perMonth != null ? trainer.pricing.perMonth : null;
  if (perMonth != null) return perMonth;
  return trainer.rate != null ? trainer.rate : null;
}

/**
 * @param {object} trainer
 */
function trainerConfirmFields(trainer) {
  const name = trainer?.displayName || trainer?.name || TRAINER_NAME_DEFAULT;
  const firstName = name.trim().split(/\s+/)[0] || name;
  const price = getTrainerPrice(trainer);
  const hasPrice = price != null && price !== '' && Number.isFinite(Number(price)) && Number(price) > 0;
  return { name, firstName, price, hasPrice };
}

/**
 * One numbered step in the confirm timeline (PNG 17).
 */
function TimelineStep({ index, title, subtitle, current, colors, isLast }) {
  const filled = current;
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepRail}>
        <View
          style={[
            styles.stepDot,
            {
              backgroundColor: filled ? colors.nbFill : colors.nbSurface,
              borderColor: colors.nbBorder,
            },
          ]}
        >
          <Text style={[styles.stepNum, { color: filled ? colors.nbOnFill : colors.nbInk }]}>
            {index}
          </Text>
        </View>
        {!isLast ? (
          <View style={[styles.stepLine, { backgroundColor: colors.nbBorder }]} />
        ) : null}
      </View>
      <View style={styles.stepCopy}>
        <Text style={[styles.stepTitle, { color: colors.nbInk }]}>{title}</Text>
        <Text style={[styles.stepSub, { color: colors.nbMuted }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function SheetChrome({ colors, insets, children }) {
  return (
    <View
      style={[
        styles.sheet,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
          paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_PAD),
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
  const trialPriceLine = hasPrice
    ? `Then $${Number(price)} per month. Cancel any time.`
    : 'Then their listed monthly rate. Cancel any time.';

  return (
    <>
      <Text style={[styles.title, { color: colors.nbInk }]}>Confirm your request</Text>
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
          {busy ? 'Sending…' : 'Confirm'}
        </NbButton>
      </View>
    </>
  );
}

function SentBody({ firstName, onGotIt, colors }) {
  return (
    <>
      <LinearGradient
        colors={accentGradients[3] || accentGradients[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.sentBadge, { borderColor: colors.nbBorder }]}
      >
        <Text style={[styles.sentBadgeText, { color: colors.nbInk }]}>Request sent</Text>
      </LinearGradient>
      <Text style={[styles.title, { color: colors.nbInk }]}>
        {firstName} has your request
      </Text>
      <Text style={[styles.sentSub, { color: colors.nbMuted }]}>
        You are told as soon as they reply. Until then you can keep browsing.
      </Text>
      <NbButton variant="fill" onPress={onGotIt}>
        Got it
      </NbButton>
    </>
  );
}

function ErrorBody({ onRetry, onMessage, onCancel, colors }) {
  return (
    <View
      style={[
        styles.errorBox,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Text style={[styles.errorEyebrow, { color: colors.nbMuted }]}>UNABLE TO CONNECT</Text>
      <Text style={[styles.errorTitle, { color: colors.nbInk }]}>
        Connection requests are not available right now.
      </Text>
      <Text style={[styles.sentSub, { color: colors.nbMuted }]}>
        Nothing was sent. Try again in a minute, or message the coach directly.
      </Text>
      <NbButton variant="fill" onPress={onRetry || onCancel}>
        Try again
      </NbButton>
      {typeof onMessage === 'function' ? (
        <NbButton variant="plain" onPress={onMessage} style={{ marginTop: spacing.sm }}>
          Send message
        </NbButton>
      ) : null}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trial confirm / request-sent / unable-to-connect sheets.
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { firstName, price, hasPrice } = trainerConfirmFields(trainer);
  const closeIfNotBusy = busy ? undefined : (onCancel || onGotIt);
  const mode = variant || VARIANT_CONFIRM;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeIfNotBusy}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={closeIfNotBusy} />
        <SheetChrome colors={colors} insets={insets}>
          {mode === VARIANT_SENT ? (
            <SentBody firstName={firstName} onGotIt={onGotIt || onCancel} colors={colors} />
          ) : null}
          {mode === VARIANT_ERROR ? (
            <ErrorBody
              onRetry={onRetry}
              onMessage={onMessage}
              onCancel={onCancel}
              colors={colors}
            />
          ) : null}
          {mode === VARIANT_CONFIRM ? (
            <ConfirmBody
              firstName={firstName}
              hasPrice={hasPrice}
              price={price}
              busy={busy}
              onCancel={onCancel}
              onConfirm={onConfirm}
              colors={colors}
            />
          ) : null}
        </SheetChrome>
      </View>
    </Modal>
  );
}

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
});
