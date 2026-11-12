// Client-home hero that opens the full dashboard (workouts, stats, progress, history).
// Flow: pick dark/light colors → paint the neobrutalist card → show an unread badge on Explore if needed.
// Used by the client home screen. Tapping Explore Dashboard runs the `onPress` the parent passed in.
//
// vocab: neobrutalist = thick borders, hard shadows, gradient only for primary button

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { nb, lightColors } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const UNREAD_BADGE_CAP = 99;

const FEATURES = [
  { icon: 'fitness-outline', label: 'Workouts' },
  { icon: 'stats-chart-outline', label: 'Analytics' },
  { icon: 'flash-outline', label: 'Progress' },
  { icon: 'calendar-outline', label: 'History' },
];

// ===== HELPER FUNCTIONS =====

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
 * @param {object} colors
 */
function FeaturePills({ colors }) {
  return (
    <View style={styles.pillsRow}>
      {FEATURES.map((feature) => (
        <View key={feature.label} style={[styles.pill, { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder }]}>
          <Ionicons name={feature.icon} size={14} color={colors.nbMuted} />
          <Text style={[styles.pillText, { color: colors.nbInk }]} numberOfLines={1}>
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
 * One gradient moment per screen: this button.
 * @param {object} props
 */
function ExploreDashboardButton({ onPress, unreadMessageCount, colors }) {
  const hasUnread = unreadMessageCount > 0;
  return (
    <View style={styles.ctaWrap}>
      {hasUnread ? (
        <View style={[styles.badge, { borderColor: colors.nbBorder, backgroundColor: colors.error }]} pointerEvents="none">
          <Text style={styles.badgeText}>{unreadBadgeLabel(unreadMessageCount)}</Text>
        </View>
      ) : null}
      <NbButton variant="brand" onPress={onPress}>
        Explore Dashboard
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium hero for the client home "full dashboard" entry.
 * Neobrutalist redesign: thick borders, hard shadows, gradient only on the CTA button.
 * @param {{ onPress?: function, unreadMessageCount?: number }} props
 */
export default function TopBannerCard({ onPress, unreadMessageCount = 0, isDark: _isDark }) {
  // vocab: useTheme follows in-app light/dark toggle — NOT device useColorScheme alone
  // (device scheme mismatch made this card unreadable / looked "broken" vs Settings)
  const { colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <NbCard style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={[styles.label, { color: colors.nbMuted }]}>YOUR COMPLETE DASHBOARD</Text>
          <Ionicons name="grid-outline" size={24} color={colors.nbMuted} />
        </View>

        <Text style={[styles.headline, { color: colors.nbInk }]}>Everything You Need in One Place</Text>

        <Text style={[styles.subhead, { color: colors.nbMuted }]}>
          Log workouts, view stats, track progress, and more
        </Text>

        <FeaturePills colors={colors} />

        <ExploreDashboardButton
          onPress={typeof onPress === 'function' ? onPress : () => {}}
          unreadMessageCount={unreadMessageCount}
          colors={colors}
        />
      </NbCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  card: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginRight: 8,
  },
  headline: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    lineHeight: 32,
  },
  subhead: {
    marginTop: 8,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    lineHeight: 22,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
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
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: nb.borderWidth,
  },
  badgeText: {
    color: lightColors.white,
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
});
