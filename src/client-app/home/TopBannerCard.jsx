// Client-home hero that opens the full dashboard (workouts, stats, progress, history).
// Flow: pick dark/light colors → paint the gradient card → show an unread badge on Explore if needed.
// Used by the client home screen. Tapping Explore Dashboard runs the `onPress` the parent passed in.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const BG_GRADIENT_DARK = ['#1a0a2e', '#0f0a1a'];
const BG_GRADIENT_LIGHT = ['#F8FAFF', '#FFFFFF'];
// Manipulate here: same pink → orange as the Aurora hero and Settings pills.
const TOP_BORDER_GRADIENT = ['#BE185D', '#C2410C'];
const CTA_GRADIENT = ['#BE185D', '#C2410C'];

const CYAN = '#64D2FF';
const INK = '#0A0A0F';
const UNREAD_BADGE_CAP = 99;

const FEATURES = [
  { icon: 'fitness-outline', label: 'Workouts' },
  { icon: 'stats-chart-outline', label: 'Analytics' },
  { icon: 'flash-outline', label: 'Progress' },
  { icon: 'calendar-outline', label: 'History' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Dark vs light text/fill for every label on the card.
 * Why a helper: the JSX only paints; it should not re-decide rgba strings in five places.
 * @param {boolean} isDark
 * @returns {object}
 */
function bannerPalette(isDark) {
  if (isDark) {
    return {
      backgroundGradient: BG_GRADIENT_DARK,
      labelColor: 'rgba(255,255,255,0.45)',
      headlineColor: '#FFFFFF',
      subheadColor: 'rgba(255,255,255,0.6)',
      pillBackground: 'rgba(255,255,255,0.08)',
      pillText: '#FFFFFF',
      badgeBorder: '#1a0a2e',
    };
  }
  return {
    backgroundGradient: BG_GRADIENT_LIGHT,
    labelColor: 'rgba(10,10,15,0.55)',
    headlineColor: INK,
    subheadColor: 'rgba(10,10,15,0.6)',
    pillBackground: 'rgba(10,10,15,0.06)',
    pillText: INK,
    badgeBorder: '#FFFFFF',
  };
}

/**
 * Badge copy. 100+ unread would overflow the circle, so we cap the digits.
 * @param {number} unreadMessageCount
 * @returns {string|number}
 */
function unreadBadgeLabel(unreadMessageCount) {
  if (unreadMessageCount > UNREAD_BADGE_CAP) return '99+';
  return unreadMessageCount;
}

/**
 * Four feature chips under the subhead. Keys are labels so a duplicate icon still stays unique.
 * @param {object} palette
 */
function FeaturePills({ palette }) {
  return (
    <View style={styles.pillsRow}>
      {FEATURES.map((feature) => (
        <View key={feature.label} style={[styles.pill, { backgroundColor: palette.pillBackground }]}>
          <Ionicons name={feature.icon} size={12} color={CYAN} style={styles.pillIcon} />
          <Text style={[styles.pillText, { color: palette.pillText }]} numberOfLines={1}>
            {feature.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Explore button plus the unread bubble sitting on its top-right corner.
 * The bubble uses pointerEvents="none" so it never steals the tap meant for Explore.
 * @param {object} props
 */
function ExploreDashboardButton({ onPress, unreadMessageCount, palette }) {
  const hasUnread = unreadMessageCount > 0;
  return (
    <View style={styles.ctaWrap}>
      {hasUnread ? (
        <View style={[styles.badge, { borderColor: palette.badgeBorder }]} pointerEvents="none">
          <Text style={styles.badgeText}>{unreadBadgeLabel(unreadMessageCount)}</Text>
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Explore Dashboard"
        disabled={typeof onPress !== 'function'}
        style={({ pressed, hovered }) => [
          styles.ctaPressable,
          pressed && styles.ctaPressablePressed,
          hovered && styles.ctaPressableHovered,
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
      >
        <LinearGradient
          colors={CTA_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.ctaGradient}
        >
          <View style={styles.ctaInner}>
            <Text style={styles.ctaText}>Explore Dashboard</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium hero for the client home “full dashboard” entry — matches FindTrainerBanner hierarchy.
 * @param {{ onPress?: function, unreadMessageCount?: number, isDark?: boolean }} props
 */
export default function TopBannerCard({ onPress, unreadMessageCount = 0, isDark = true }) {
  const palette = bannerPalette(isDark);

  return (
    <View style={styles.wrapper}>
      <View style={styles.cardShadow}>
        <View style={styles.cardClip}>
          <LinearGradient
            colors={TOP_BORDER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topBorder}
          />
          <LinearGradient
            colors={palette.backgroundGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.inner}
          >
            <View style={styles.headerRow}>
              <Text style={[styles.label, { color: palette.labelColor }]}>Your Complete Dashboard</Text>
              <Ionicons name="grid-outline" size={24} color={CYAN} />
            </View>

            <Text style={[styles.headline, { color: palette.headlineColor }]}>Everything You Need in One Place</Text>

            <Text style={[styles.subhead, { color: palette.subheadColor }]}>
              Log workouts, view stats, track progress, and more
            </Text>

            <FeaturePills palette={palette} />

            <ExploreDashboardButton
              onPress={onPress}
              unreadMessageCount={unreadMessageCount}
              palette={palette}
            />
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 16,
    paddingHorizontal: 16,
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
    minHeight: 220,
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
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 8,
  },
  headline: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  subhead: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
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
    color: '#FFFFFF',
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
    borderColor: '#1a0a2e',
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
