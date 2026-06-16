import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const BG_GRADIENT_DARK = ['#1a0a2e', '#0f0a1a'];
const BG_GRADIENT_LIGHT = ['#F8FAFF', '#FFFFFF'];
const TOP_BORDER_GRADIENT = ['#BE185D', '#C2410C'];
const CTA_GRADIENT = ['#BE185D', '#C2410C'];
const CYAN = '#64D2FF';
const INK = '#0A0A0F';

const FEATURES = [
  { icon: 'people-outline', label: 'Clients' },
  { icon: 'mail-unread-outline', label: 'Requests' },
  { icon: 'chatbubbles-outline', label: 'Messages' },
  { icon: 'bar-chart-outline', label: 'Reports' },
];

/**
 * Trainer home hero — mirrors client DashboardHeroCard hierarchy.
 */
export default function TrainerDashboardHeroCard({
  onPress,
  pendingRequestCount = 0,
  unreadMessageCount = 0,
  clientCount = 0,
  isDark = true,
}) {
  const bgGradient = isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT;
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.55)';
  const headlineColor = isDark ? '#FFFFFF' : INK;
  const subheadColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.6)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)';
  const pillText = isDark ? '#FFFFFF' : INK;
  const badgeBorder = isDark ? '#1a0a2e' : '#FFFFFF';
  const badgeTotal = (pendingRequestCount || 0) + (unreadMessageCount || 0);

  return (
    <View style={styles.wrapper}>
      <View style={styles.cardShadow}>
        <View style={styles.cardClip}>
          <LinearGradient colors={TOP_BORDER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topBorder} />
          <LinearGradient colors={bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.inner}>
            <View style={styles.headerRow}>
              <Text style={[styles.label, { color: labelColor }]}>Your Coaching Hub</Text>
              <Ionicons name="briefcase-outline" size={24} color={CYAN} />
            </View>

            <Text style={[styles.headline, { color: headlineColor }]}>Everything for Your Clients</Text>

            <Text style={[styles.subhead, { color: subheadColor }]}>
              {clientCount > 0
                ? `${clientCount} active client${clientCount === 1 ? '' : 's'} · requests, messages, and progress in one place`
                : 'Review requests, message clients, and track their progress'}
            </Text>

            <View style={styles.pillsRow}>
              {FEATURES.map(({ icon, label }) => (
                <View key={label} style={[styles.pill, { backgroundColor: pillBg }]}>
                  <Ionicons name={icon} size={12} color={CYAN} style={styles.pillIcon} />
                  <Text style={[styles.pillText, { color: pillText }]} numberOfLines={1}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.ctaWrap}>
              {badgeTotal > 0 && (
                <View style={[styles.badge, { borderColor: badgeBorder }]} pointerEvents="none">
                  <Text style={styles.badgeText}>{badgeTotal > 99 ? '99+' : badgeTotal}</Text>
                </View>
              )}
              <Pressable
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Open client roster"
                disabled={typeof onPress !== 'function'}
                style={({ pressed, hovered }) => [
                  styles.ctaPressable,
                  pressed && styles.ctaPressablePressed,
                  hovered && styles.ctaPressableHovered,
                ]}
                android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
              >
                <LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaGradient}>
                  <View style={styles.ctaInner}>
                    <Text style={styles.ctaText}>Open Client Roster</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
    marginBottom: 4,
  },
  ctaPressable: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaPressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  ctaPressableHovered: {
    ...Platform.select({
      web: { opacity: 0.96 },
      default: {},
    }),
  },
  cardShadow: {
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#BE185D',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  cardClip: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  topBorder: {
    height: 3,
    width: '100%',
  },
  inner: {
    padding: 24,
    minHeight: 200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 8,
  },
  headline: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  subhead: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillIcon: {
    marginTop: 0,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  ctaWrap: {
    marginTop: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 10,
    backgroundColor: '#FF3B30',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ctaGradient: {
    height: 48,
    justifyContent: 'center',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
