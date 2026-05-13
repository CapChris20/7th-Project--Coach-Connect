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

/**
 * Destructive confirmation: user must press and hold until the progress bar fills.
 * Release early → bar resets; complete → `onHoldComplete` runs (should throw on failure).
 */
export default function HoldToConfirmModal({
  visible,
  onClose,
  title = 'Confirm',
  message = '',
  holdDurationMs = 1200,
  /** Gradient for the filling bar */
  barGradient = ['#8B5CF6', '#DB7093'],
  trackColor = 'rgba(255,255,255,0.12)',
  pillLabel = 'Hold to confirm',
  onHoldComplete,
  isDark = true,
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);
  const runningRef = useRef(false);
  const holdLockedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const textColor = isDark ? '#FFFFFF' : '#1a0a2e';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,10,46,0.55)';
  const cardBg = isDark ? 'rgba(14,14,20,0.98)' : '#FFFFFF';

  const resetBar = useCallback(() => {
    animRef.current?.stop?.();
    animRef.current = null;
    runningRef.current = false;
    progress.setValue(0);
  }, [progress]);

  useEffect(() => {
    if (!visible) {
      resetBar();
      setSubmitting(false);
      holdLockedRef.current = false;
    }
  }, [visible, resetBar]);

  const runComplete = useCallback(async () => {
    setSubmitting(true);
    try {
      await onHoldComplete();
      onClose();
    } catch (e) {
      const msg = e?.message || e?.code || 'Something went wrong. Try again.';
      Alert.alert('Could not complete', String(msg));
      resetBar();
    } finally {
      setSubmitting(false);
      holdLockedRef.current = false;
    }
  }, [onHoldComplete, onClose, resetBar]);

  const onPressIn = useCallback(() => {
    if (submitting) return;
    resetBar();
    runningRef.current = true;
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: holdDurationMs,
      useNativeDriver: false,
    });
    animRef.current = anim;
    anim.start(({ finished }) => {
      animRef.current = null;
      if (finished && runningRef.current) {
        runningRef.current = false;
        holdLockedRef.current = true;
        void runComplete();
      }
    });
  }, [submitting, resetBar, progress, holdDurationMs, runComplete]);

  const onPressOut = useCallback(() => {
    if (submitting || holdLockedRef.current) return;
    if (!runningRef.current) return;
    animRef.current?.stop();
    animRef.current = null;
    runningRef.current = false;
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [submitting, progress]);

  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={submitting ? undefined : onClose}>
      <Pressable style={styles.overlay} onPress={submitting ? undefined : onClose}>
        <Pressable style={[styles.card, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation?.()}>
          <Text style={[styles.title, { color: textColor }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: muted }]}>{message}</Text> : null}

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
                opacity: submitting ? 0.65 : pressed ? 0.92 : 1,
                borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)',
              },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#FDA4AF" />
            ) : (
              <Text style={[styles.holdLabel, { color: textColor }]}>{pillLabel}</Text>
            )}
          </Pressable>

          <Pressable onPress={submitting ? undefined : onClose} style={styles.cancelWrap} disabled={submitting}>
            <Text style={[styles.cancel, { color: muted }]}>Cancel</Text>
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
