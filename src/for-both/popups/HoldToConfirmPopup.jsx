// Design Law hold-to-confirm sheet — destructive actions need a full press-and-hold.
// Flow: open sheet → press Hold → bar fills with nbFill → onHoldComplete; release early resets.
// Used by: Settings delete account (and any other irreversible confirm). Theme tokens only.

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

const DEFAULT_HOLD_DURATION_MS = 1200;
const RESET_DURATION_MS = 180;
const DEFAULT_PILL_LABEL = 'Hold to confirm';
const DEFAULT_TITLE = 'Confirm';
const DEFAULT_WARNING_PILL = 'Cannot be undone.';
const FILL_COMPLETE = 1;
const FILL_EMPTY = 0;
// Manipulate here: hold track height / corner radius
const TRACK_HEIGHT = 52;
const TRACK_RADIUS = 10;

// ===== HELPER FUNCTIONS =====

function completeErrorMessage(error) {
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
  const anim = Animated.timing(progress, {
    toValue: FILL_COMPLETE,
    duration: holdDurationMs,
    useNativeDriver: false,
  });
  animRef.current = anim;
  anim.start(({ finished }) => {
    animRef.current = null;
    if (!finished || !runningRef.current) return;
    runningRef.current = false;
    holdLockedRef.current = true;
    void runComplete();
  });
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

function holdPillOpacity(isSubmitting, isPressed) {
  if (isSubmitting) return 0.65;
  if (isPressed) return 0.92;
  return 1;
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet: warning pill + title + hold track (solid fill, not a gradient Save bar).
 * `onHoldComplete` should throw on failure so the bar can reset.
 * @param {object} props
 */
export default function HoldToConfirmPopup({
  visible,
  onClose,
  title = DEFAULT_TITLE,
  message = '',
  holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  // kept for call-site compat — Design Law fill uses nbFill, never a pink/purple bar
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

  useEffect(() => {
    if (!visible) {
      resetBar();
      setSubmitting(false);
      holdLockedRef.current = false;
    }
  }, [visible, resetBar]);

  const runComplete = useCallback(async () => {
    // 1. Lock so a second hold cannot fire while the action runs.
    setSubmitting(true);
    try {
      await onHoldComplete();
      onClose();
    } catch (error) {
      Alert.alert('Could not complete', String(completeErrorMessage(error)));
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={submitting ? undefined : onClose}>
      <Pressable style={styles.scrim} onPress={submitting ? undefined : onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
          onPress={(event) => event.stopPropagation?.()}
        >
          {/* Design Law sheet grab bar */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.nbBorder }]} />
          </View>

          {/* Warning accent pill — Design Law allows small gradient pills, not Save buttons */}
          {warningPill ? (
            <View style={styles.warningRow}>
              <NbPill variant="energy">{warningPill}</NbPill>
            </View>
          ) : null}

          <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.nbMuted }]}>{message}</Text> : null}

          {/* Hold track: press-and-hold fills with solid nbFill (no brand gradient bar) */}
          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={submitting}
            style={({ pressed }) => [
              styles.holdTrack,
              {
                opacity: holdPillOpacity(submitting, pressed),
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                shadowColor: colors.nbShadow,
              },
            ]}
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

          <View style={styles.cancelWrap}>
            <NbButton variant="ghost" onPress={submitting ? undefined : onClose} disabled={submitting}>
              Cancel
            </NbButton>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
