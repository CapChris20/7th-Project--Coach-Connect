// Design Law hold-to-confirm sheet — destructive actions need a full press-and-hold.
// Flow: open sheet → press Hold → bar fills with nbFill → onHoldComplete; release early resets.
// Used by: Settings delete account (and any other irreversible confirm). Theme tokens only.
// Read order: constants → layout chunks → HoldToConfirmPopup → PLUMBING (animation helpers).

import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbButton from '../../look-and-feel/NbButton';
import NbPill from '../../look-and-feel/NbPill';
import { nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: how long the user must hold before the action fires (milliseconds)
const DEFAULT_HOLD_DURATION_MS = 1200;
// Manipulate here: how fast the bar drains when they let go early
const RESET_DURATION_MS = 180;
const DEFAULT_PILL_LABEL = 'Hold to confirm';
const DEFAULT_TITLE = 'Confirm';
const DEFAULT_WARNING_PILL = 'Cannot be undone.';
const HOLD_FAILED_ALERT_TITLE = 'Could not complete';
const FILL_COMPLETE = 1;
const FILL_EMPTY = 0;
const TRACK_OPACITY_IDLE = 1;
const TRACK_OPACITY_SUBMITTING = 0.65;
const TRACK_OPACITY_PRESSED = 0.92;
// Manipulate here: hold track height / corner radius
const TRACK_HEIGHT = 52;
const TRACK_RADIUS = 10;

// ===== HELPER FUNCTIONS =====

// Grab bar, warning pill, title, and optional body copy.
function HoldConfirmCopyBlock({ colors, warningPill, title, message }) {
  const showWarningPill = Boolean(warningPill);
  const showMessage = Boolean(message);

  return (
    <>
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: colors.nbBorder }]} />
      </View>

      {showWarningPill ? (
        <View style={styles.warningRow}>
          <NbPill variant="energy">{warningPill}</NbPill>
        </View>
      ) : null}

      <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>
      {showMessage ? (
        <Text style={[styles.message, { color: colors.nbMuted }]}>{message}</Text>
      ) : null}
    </>
  );
}

// Press-and-hold track: solid nbFill width animation (Design Law — no gradient Save bar).
function HoldConfirmTrack({
  colors,
  pillLabel,
  submitting,
  fillWidth,
  onPressIn,
  onPressOut,
}) {
  const trackOpacity = submitting ? TRACK_OPACITY_SUBMITTING : TRACK_OPACITY_IDLE;

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={submitting}
      style={({ pressed }) =>
        holdTrackStyleList({
          colors,
          trackOpacity,
          submitting,
          pressed,
        })
      }
      accessibilityRole="button"
      accessibilityLabel={pillLabel}
    >
      <Animated.View
        style={[
          styles.fillWrap,
          {
            width: fillWidth,
            backgroundColor: colors.nbFill,
          },
        ]}
      />
      <View style={styles.holdLabelWrap} pointerEvents="none">
        {submitting ? (
          <ActivityIndicator color={colors.nbInk} />
        ) : (
          <Text style={[styles.holdLabel, { color: colors.nbInk }]}>{pillLabel}</Text>
        )}
      </View>
    </Pressable>
  );
}

function holdTrackStyleList({ colors, trackOpacity, submitting, pressed }) {
  let opacityForPress = trackOpacity;
  if (!submitting && pressed) opacityForPress = TRACK_OPACITY_PRESSED;

  return [
    styles.holdTrack,
    {
      opacity: opacityForPress,
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      shadowColor: colors.nbShadow,
    },
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet: warning pill + title + hold track (solid fill, not a gradient Save bar).
 * `onHoldComplete` should throw on failure so the bar can reset.
 * Unused gradient / track / isDark props stay for call-site compat — Design Law fill uses nbFill.
 */
export default function HoldToConfirmPopup({
  visible,
  onClose,
  title = DEFAULT_TITLE,
  message = '',
  holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  barGradient: _barGradient,
  trackColor: _trackColor,
  pillLabel = DEFAULT_PILL_LABEL,
  warningPill = DEFAULT_WARNING_PILL,
  onHoldComplete,
  isDark: _isDark = true,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const runningRef = useRef(false);
  const holdLockedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const resetBar = useCallback(() => {
    stopHoldAnimation(animRef, runningRef, progress);
  }, [progress]);

  // When the sheet hides, drain the bar and unlock so the next open starts fresh.
  useEffect(() => {
    if (!visible) {
      resetBar();
      setSubmitting(false);
      holdLockedRef.current = false;
    }
  }, [visible, resetBar]);

  const runComplete = useCallback(async () => {
    // 1. Lock UI while the destructive action runs.
    setSubmitting(true);
    try {
      await onHoldComplete();
      onClose();
    } catch (error) {
      Alert.alert(HOLD_FAILED_ALERT_TITLE, String(messageFromHoldError(error)));
      resetBar();
    } finally {
      setSubmitting(false);
      holdLockedRef.current = false;
    }
  }, [onHoldComplete, onClose, resetBar]);

  const onPressIn = useCallback(() => {
    if (submitting) return;
    resetBar();
    startHoldFill({
      progress,
      holdDurationMs,
      animRef,
      runningRef,
      holdLockedRef,
      runComplete,
    });
  }, [submitting, resetBar, progress, holdDurationMs, runComplete]);

  const onPressOut = useCallback(() => {
    if (submitting || holdLockedRef.current) return;
    if (!runningRef.current) return;
    cancelHoldFill({ progress, animRef, runningRef });
  }, [submitting, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [FILL_EMPTY, FILL_COMPLETE],
    outputRange: ['0%', '100%'],
  });

  const sheetBottomPadding = Math.max(insets.bottom, spacing.md) + spacing.sm;
  const canDismissFromScrim = !submitting;
  const dismissHandler = canDismissFromScrim ? onClose : undefined;
  const sheetSurfaceStyle = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    paddingBottom: sheetBottomPadding,
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissHandler}
    >
      <Pressable style={styles.scrim} onPress={dismissHandler}>
        <Pressable
          style={[styles.sheet, sheetSurfaceStyle]}
          onPress={(event) => event.stopPropagation?.()}
        >
          <HoldConfirmCopyBlock
            colors={colors}
            warningPill={warningPill}
            title={title}
            message={message}
          />

          <HoldConfirmTrack
            colors={colors}
            pillLabel={pillLabel}
            submitting={submitting}
            fillWidth={fillWidth}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          />

          <View style={styles.cancelWrap}>
            <NbButton variant="ghost" onPress={dismissHandler} disabled={submitting}>
              Cancel
            </NbButton>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging hold animation or error strings =====

function messageFromHoldError(error) {
  return error?.message || error?.code || 'Something went wrong. Try again.';
}

function stopHoldAnimation(animRef, runningRef, progress) {
  animRef.current?.stop?.();
  animRef.current = null;
  runningRef.current = false;
  progress.setValue(FILL_EMPTY);
}

// vocab: Animated.timing fills 0→1 over holdDurationMs. useNativeDriver: false because we animate width %.
function startHoldFill({ progress, holdDurationMs, animRef, runningRef, holdLockedRef, runComplete }) {
  runningRef.current = true;
  const fillAnimation = Animated.timing(progress, {
    toValue: FILL_COMPLETE,
    duration: holdDurationMs,
    useNativeDriver: false,
  });
  animRef.current = fillAnimation;
  fillAnimation.start(({ finished }) => {
    finishHoldFillIfComplete({
      finished,
      animRef,
      runningRef,
      holdLockedRef,
      runComplete,
    });
  });
}

function finishHoldFillIfComplete({ finished, animRef, runningRef, holdLockedRef, runComplete }) {
  animRef.current = null;
  if (!finished || !runningRef.current) return;
  runningRef.current = false;
  holdLockedRef.current = true;
  void runComplete();
}

function cancelHoldFill({ progress, animRef, runningRef }) {
  animRef.current?.stop();
  animRef.current = null;
  runningRef.current = false;
  Animated.timing(progress, {
    toValue: FILL_EMPTY,
    duration: RESET_DURATION_MS,
    useNativeDriver: false,
  }).start();
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handleWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
  },
  warningRow: {
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    marginBottom: spacing.sm,
  },
  message: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  // Manipulate here: hold button height / hard shadow
  holdTrack: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_RADIUS,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowOffset: { width: nb.shadowOffset, height: nb.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  fillWrap: {
    ...StyleSheet.absoluteFillObject,
    right: undefined,
  },
  holdLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holdLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  cancelWrap: {
    marginTop: spacing.xs,
  },
});
