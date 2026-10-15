// Destructive confirmation: the user must press and hold until the progress bar fills.
// Flow: press in → animate 0→1 → if they hold to the end, run onHoldComplete; release early → bar resets.
// Used by: delete / unlink / other irreversible actions. Release early never fires the action.

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
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

const DEFAULT_HOLD_DURATION_MS = 1200;
const RESET_DURATION_MS = 180;
const DEFAULT_BAR_GRADIENT = ['#8B5CF6', '#DB7093'];
const DEFAULT_TRACK_COLOR = 'rgba(255,255,255,0.12)';
const DEFAULT_PILL_LABEL = 'Hold to confirm';
const DEFAULT_TITLE = 'Confirm';
const SPINNER_COLOR = '#FDA4AF';

const DARK_TEXT = '#FFFFFF';
const LIGHT_TEXT = '#1a0a2e';
const DARK_MUTED = 'rgba(255,255,255,0.55)';
const LIGHT_MUTED = 'rgba(26,10,46,0.55)';
const DARK_CARD = 'rgba(14,14,20,0.98)';
const LIGHT_CARD = '#FFFFFF';
const DARK_PILL_BORDER = 'rgba(255,255,255,0.14)';
const LIGHT_PILL_BORDER = 'rgba(0,0,0,0.1)';

const FILL_COMPLETE = 1;
const FILL_EMPTY = 0;

// ===== HELPER FUNCTIONS =====

function confirmPalette(isDark) {
  return {
    textColor: isDark ? DARK_TEXT : LIGHT_TEXT,
    muted: isDark ? DARK_MUTED : LIGHT_MUTED,
    cardBg: isDark ? DARK_CARD : LIGHT_CARD,
    pillBorder: isDark ? DARK_PILL_BORDER : LIGHT_PILL_BORDER,
  };
}

function holdPillOpacity(isSubmitting, isPressed) {
  if (isSubmitting) return 0.65;
  if (isPressed) return 0.92;
  return 1;
}

function completeErrorMessage(error) {
  return error?.message || error?.code || 'Something went wrong. Try again.';
}

function stopHoldAnimation(animRef, runningRef, progress) {
  animRef.current?.stop?.();
  animRef.current = null;
  runningRef.current = false;
  progress.setValue(FILL_EMPTY);
}

// vocab: Animated.timing fills 0→1 over holdDurationMs. useNativeDriver: false because we animate width.
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

// ===== MAIN FUNCTION =====

/**
 * Hold-to-confirm modal. `onHoldComplete` should throw on failure so the bar can reset.
 * @param {object} props
 */
export default function HoldToConfirmPopup({
  visible,
  onClose,
  title = DEFAULT_TITLE,
  message = '',
  holdDurationMs = DEFAULT_HOLD_DURATION_MS,
  barGradient = DEFAULT_BAR_GRADIENT,
  trackColor = DEFAULT_TRACK_COLOR,
  pillLabel = DEFAULT_PILL_LABEL,
  onHoldComplete,
  isDark = true,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const runningRef = useRef(false);
  const holdLockedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const palette = confirmPalette(isDark);

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
    // 1. Lock the pill so a second hold cannot fire while the action runs.
    setSubmitting(true);
    try {
      await onHoldComplete();
      onClose();
    } catch (error) {
      // 2. Action threw → tell them, reset the bar, unlock the pill.
      Alert.alert('Could not complete', String(completeErrorMessage(error)));
      resetBar();
    } finally {
      setSubmitting(false);
      holdLockedRef.current = false;
    }
  }, [onHoldComplete, onClose, resetBar]);

  const onPressIn = useCallback(() => {
    // 1. Already submitting → ignore. Otherwise reset and fill 0→1.
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
    // 1. Release early → bar resets. After a finished hold, leave the bar full.
    if (submitting || holdLockedRef.current) return;
    if (!runningRef.current) return;
    cancelHoldFill({ progress, animRef, runningRef });
  }, [submitting, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [FILL_EMPTY, FILL_COMPLETE],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={submitting ? undefined : onClose}>
      <Pressable style={styles.overlay} onPress={submitting ? undefined : onClose}>
        <Pressable style={[styles.card, { backgroundColor: palette.cardBg }]} onPress={(event) => event.stopPropagation?.()}>
          <Text style={[styles.title, { color: palette.textColor }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: palette.muted }]}>{message}</Text> : null}

          <View style={[styles.track, { backgroundColor: trackColor }]}>
            <Animated.View style={[styles.fillWrap, { width: fillWidth }]}>
              <LinearGradient colors={barGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>

          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={submitting}
            style={({ pressed }) => [
              styles.holdPill,
              {
                opacity: holdPillOpacity(submitting, pressed),
                borderColor: palette.pillBorder,
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color={SPINNER_COLOR} />
            ) : (
              <Text style={[styles.holdLabel, { color: palette.textColor }]}>{pillLabel}</Text>
            )}
          </Pressable>

          <Pressable onPress={submitting ? undefined : onClose} style={styles.cancelWrap} disabled={submitting}>
            <Text style={[styles.cancel, { color: palette.muted }]}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    borderRadius: 20,
    padding: 22,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    marginBottom: 18,
  },
  track: {
    height: 8,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 16,
  },
  fillWrap: {
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  holdPill: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  holdLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  cancelWrap: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  cancel: {
    fontSize: 15,
    fontWeight: '700',
  },
});
