import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const PURPLE = '#C084FC';
const PINK = '#FF6B9D';
const CYAN = '#64D2FF';
const RED = '#EF4444';

const { width: SW } = Dimensions.get('window');

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function formatResetLabel(nextReset) {
  if (!nextReset) return null;
  try {
    const d = nextReset instanceof Date ? nextReset : new Date(nextReset);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return null;
  }
}

function getBackgroundGradient(remaining, total, isDark) {
  const isOut = Number(remaining) <= 0;
  if (isOut) {
    return isDark
      ? ['rgba(239,68,68,0.30)', 'rgba(255,107,157,0.22)']
      : ['rgba(239,68,68,0.48)', 'rgba(255,107,157,0.42)'];
  }
  return isDark
    ? ['rgba(192,132,252,0.34)', 'rgba(255,107,157,0.24)']
    : ['rgba(192,132,252,0.62)', 'rgba(255,107,157,0.52)'];
}

function getBorderGradient(remaining, isDark) {
  const isOut = Number(remaining) <= 0;
  if (isOut) return isDark ? [RED, PINK] : ['rgba(239,68,68,0.55)', 'rgba(255,107,157,0.55)'];
  return isDark ? [PURPLE, PINK] : ['rgba(192,132,252,0.65)', 'rgba(255,107,157,0.55)'];
}

function getBadgeTone(remaining, total, isDark) {
  const r = Number(remaining);
  const t = Number(total) || 0;
  const alpha = isDark ? 0.16 : 0.26;
  if (r <= 0) return { bg: `rgba(239,68,68,${alpha})`, border: RED, text: RED };
  if (t > 0 && r === t) return { bg: `rgba(34,197,94,${alpha})`, border: '#22C55E', text: '#22C55E' }; // green good
  if (t > 0 && r === 1) return { bg: `rgba(249,115,22,${alpha})`, border: '#F97316', text: '#F97316' }; // orange low
  return { bg: `rgba(255,107,157,${alpha + 0.03})`, border: PINK, text: PINK };
}

function buildTipText(remaining, total, nextResetLabel) {
  const r = Number(remaining);
  const t = Number(total) || 0;
  if (r <= 0) {
    return `Next reset: ${nextResetLabel || 'soon'}. Use AI Coach for unlimited help!`;
  }
  if (t > 0 && r === 1) {
    return 'You have 1 plan left. Use AI Coach for tweaks after.';
  }
  return 'Use your plans wisely this month';
}

/**
 * Premium-looking plan generation disclaimer / limit banner.
 *
 * Props:
 * - remaining: number
 * - total: number
 * - nextReset: Date|string (optional)
 * - onTapUpgrade: () => void (optional) – banner becomes tappable if provided
 */
export default function PlanLimitBanner({ remaining = 0, total = 2, nextReset, onTapUpgrade, isDark = true }) {
  const [toastText, setToastText] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  const isCompact = SW < 380;
  const padding = isCompact ? 12 : 16;

  const mountOpacity = useRef(new Animated.Value(0)).current;
  const mountTranslateY = useRef(new Animated.Value(10)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(1)).current;
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTranslateY = useRef(new Animated.Value(6)).current;

  const prevRemainingRef = useRef(remaining);

  const nextResetLabel = useMemo(() => formatResetLabel(nextReset), [nextReset]);
  const bgGrad = useMemo(() => getBackgroundGradient(remaining, total, isDark), [remaining, total, isDark]);
  const borderGrad = useMemo(() => getBorderGradient(remaining, isDark), [remaining, isDark]);
  const badgeTone = useMemo(() => getBadgeTone(remaining, total, isDark), [remaining, total, isDark]);

  const isOut = Number(remaining) <= 0;
  const badgeText = useMemo(() => {
    if (isOut) {
      const reset = nextResetLabel ? ` — Reset ${nextResetLabel}` : '';
      return `${Math.max(0, Number(remaining) || 0)}/${Number(total) || 0}${reset}`;
    }
    return `${Math.max(0, Number(remaining) || 0)}/${Number(total) || 0}`;
  }, [isOut, remaining, total, nextResetLabel]);

  const tipIcon = isOut ? 'calendar-outline' : 'bulb-outline';
  const tipPrefix = isOut ? '📅' : '💡';
  const tipText = useMemo(() => buildTipText(remaining, total, nextResetLabel), [remaining, total, nextResetLabel]);

  const titleColor = isDark ? '#FFFFFF' : '#0B1220';
  const subtitleColor = isDark ? '#B0B0B0' : 'rgba(15,23,42,0.72)';
  const tipColor = isDark ? '#909090' : 'rgba(15,23,42,0.64)';

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(mountTranslateY, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [mountOpacity, mountTranslateY]);

  const showToast = (text) => {
    setToastText(text);
    setToastVisible(true);
    toastOpacity.stopAnimation();
    toastTranslateY.stopAnimation();
    toastOpacity.setValue(0);
    toastTranslateY.setValue(6);
    Animated.parallel([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.timing(toastTranslateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(toastOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          Animated.timing(toastTranslateY, { toValue: 6, duration: 180, useNativeDriver: true }),
        ]).start(() => setToastVisible(false));
      }, 900);
    });
  };

  useEffect(() => {
    const prev = prevRemainingRef.current;
    if (prev === remaining) return;
    prevRemainingRef.current = remaining;

    // Pulse badge
    badgeScale.stopAnimation();
    badgeScale.setValue(1);
    Animated.sequence([
      Animated.timing(badgeScale, { toValue: 1.1, duration: 200, useNativeDriver: true }),
      Animated.timing(badgeScale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    // Toast (only when a plan was consumed: remaining decreased)
    if (Number(remaining) < Number(prev)) {
      const r = clamp(Number(remaining) || 0, 0, Number(total) || 0);
      showToast(`Plan generated! ${r} remaining`);
    }
  }, [remaining, total, badgeScale]);

  const glowShadow = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.32] });
  const glowRadius = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [24, 30] });

  const Container = onTapUpgrade ? Pressable : View;
  const containerProps = onTapUpgrade
    ? {
        onPress: onTapUpgrade,
        onPressIn: () => Animated.timing(glowAnim, { toValue: 1, duration: 140, useNativeDriver: false }).start(),
        onPressOut: () => Animated.timing(glowAnim, { toValue: 0, duration: 180, useNativeDriver: false }).start(),
      }
    : {};

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          opacity: mountOpacity,
          transform: [{ translateY: mountTranslateY }],
          marginHorizontal: 16,
          marginVertical: 12,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.shadowWrap,
          {
            shadowColor: PURPLE,
            shadowOpacity: glowShadow,
            shadowRadius: glowRadius,
          },
        ]}
      >
          <LinearGradient colors={borderGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.border, { padding: 1.5, borderRadius: 12 }]}>
          <LinearGradient
            colors={bgGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.inner,
              {
                padding,
                borderRadius: 10.5,
                // Prevent banner from looking like a translucent sticker on light backgrounds.
                backgroundColor: isDark ? 'rgba(13,17,23,0.68)' : 'rgba(255,255,255,0.86)',
              },
            ]}
          >
            <Container {...containerProps} style={styles.row} accessibilityRole={onTapUpgrade ? 'button' : 'none'}>
              <View style={styles.left}>
                <Ionicons name="sparkles" size={16} color={isDark ? PURPLE : '#8B5CF6'} />
              </View>

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: titleColor }]}>Premium Plan Generation</Text>
                </View>
                <Text style={[styles.subtitle, { color: subtitleColor }]}>You have {total} AI-generated plans per month</Text>
                <View style={styles.tipRow}>
                  <Ionicons name={tipIcon} size={12} color={isOut ? '#FCA5A5' : CYAN} />
                  <Text style={[styles.tipText, { color: tipColor }]}>
                    {tipPrefix} {tipText}
                  </Text>
                </View>
              </View>

              <Animated.View style={{ transform: [{ scale: badgeScale }], alignSelf: 'center' }}>
                <View style={[styles.badge, { backgroundColor: badgeTone.bg, borderColor: badgeTone.border }]}>
                  <Text style={[styles.badgeText, { color: badgeTone.text }]} numberOfLines={1}>
                    {badgeText}
                  </Text>
                </View>
              </Animated.View>
            </Container>
          </LinearGradient>
        </LinearGradient>
      </Animated.View>

      {toastVisible ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastOpacity,
              transform: [{ translateY: toastTranslateY }],
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={24} tint="dark" style={styles.toastBlur}>
              <Text style={styles.toastText}>{toastText}</Text>
            </BlurView>
          ) : (
            <View style={[styles.toastBlur, { backgroundColor: 'rgba(10,10,15,0.92)' }]}>
              <Text style={styles.toastText}>{toastText}</Text>
            </View>
          )}
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 'auto',
  },
  shadowWrap: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  border: {
    overflow: 'hidden',
  },
  inner: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  left: {
    width: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#B0B0B0',
  },
  tipRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#909090',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    maxWidth: 160,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: -8,
    alignItems: 'center',
  },
  toastBlur: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    maxWidth: 420,
    width: '100%',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

