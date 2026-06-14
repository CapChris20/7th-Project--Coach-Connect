import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/** Dark purple → dark orange (matches Today card & Training Agenda). */
const BORDER_GRADIENT = ['#6D28D9', '#C2410C'];
const CTA_GRADIENT = BORDER_GRADIENT;
const BG_GRADIENT_DARK = ['#12081f', '#08050f'];
const BG_GRADIENT_LIGHT = ['#F3F0FA', '#FFFFFF'];
const ACCENT_ORANGE = '#C2410C';
const ACCENT_PURPLE = '#9333EA';

/**
 * Premium horizontal quick-action tile — centered icon, gradient rim, gradient CTA.
 */
export default function QuickActionCard({
  isDark = true,
  label,
  subtitle,
  icon = 'flash-outline',
  ctaLabel = 'View all',
  onPress,
  width = 216,
  badgeCount,
  style,
  accessibilityLabel,
}) {
  const innerBg = isDark ? '#0A0812' : '#FFFFFF';
  const headlineColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const subColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.52)';
  const iconInnerBg = isDark ? 'rgba(14,12,22,0.98)' : 'rgba(255,255,255,0.98)';
  const iconColor = isDark ? '#FED7AA' : '#6D28D9';
  const bgGradient = isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT;
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)';
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${label}. ${subtitle}. ${ctaLabel}`}
      style={[{ width, marginRight: 12 }, style]}
    >
      <View
        style={[
          styles.borderRing,
          isDark ? styles.shadowDark : styles.shadowLight,
          { borderWidth: 1, borderColor: hairline, padding: 0, backgroundColor: innerBg },
        ]}
      >
        <View style={styles.innerClip}>
          <LinearGradient colors={bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.fill}>
            <View style={styles.body}>
              {showBadge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                </View>
              ) : null}

              <View style={styles.iconWrap}>
                <View
                  style={[
                    styles.iconRing,
                    {
                      borderWidth: 1,
                      borderColor: hairline,
                      padding: 0,
                      backgroundColor: iconInnerBg,
                    },
                  ]}
                >
                  <View style={[styles.iconInner, { backgroundColor: 'transparent' }]}>
                    <Ionicons name={icon} size={26} color={iconColor} />
                  </View>
                </View>
              </View>

              <Text style={[styles.title, { color: headlineColor }]} numberOfLines={2}>
                {label}
              </Text>
              <Text style={[styles.sub, { color: subColor }]} numberOfLines={2}>
                {subtitle}
              </Text>

              <LinearGradient
                colors={CTA_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaPill}
              >
                <View style={styles.ctaInner}>
                  <Text style={styles.ctaText}>{ctaLabel}</Text>
                  <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                </View>
              </LinearGradient>
            </View>
          </LinearGradient>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  borderRing: {
    borderRadius: 20,
    padding: 2,
  },
  shadowDark: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
        }
      : { elevation: 6 }),
  },
  shadowLight: {
    ...(Platform.OS === 'ios'
      ? {
          shadowColor: ACCENT_ORANGE,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.14,
          shadowRadius: 12,
        }
      : { elevation: 4 }),
  },
  innerClip: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  fill: {
    minHeight: 168,
  },
  topAccent: {
    height: 3,
    width: '100%',
  },
  body: {
    position: 'relative',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    minWidth: 26,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(109,40,217,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(194,65,12,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFEDD5',
    fontSize: 11,
    fontWeight: '800',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 18,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.35,
    textAlign: 'center',
    lineHeight: 19,
    width: '100%',
  },
  sub: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    textAlign: 'center',
    width: '100%',
    letterSpacing: 0.1,
  },
  ctaPill: {
    marginTop: 14,
    borderRadius: 14,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
