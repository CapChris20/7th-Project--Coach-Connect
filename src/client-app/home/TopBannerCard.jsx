// Client-home hero card that sells the full dashboard and opens it on Explore.
// Flow: read theme colors → paint eyebrow + headline + feature chips → Explore CTA (optional unread badge).
// Used by the client home screen. Parent passes onPress for Explore Dashboard.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { nb, lightColors } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const UNREAD_BADGE_CAP = 99;

const DASHBOARD_FEATURE_CHIPS = [
  { icon: 'fitness-outline', label: 'Workouts' },
  { icon: 'stats-chart-outline', label: 'Analytics' },
  { icon: 'flash-outline', label: 'Progress' },
  { icon: 'calendar-outline', label: 'History' },
];

const EYEBROW_COPY = 'YOUR COMPLETE DASHBOARD';
const HEADLINE_COPY = 'Everything You Need in One Place';
const SUBHEAD_COPY = 'Log workouts, view stats, track progress, and more';
const EXPLORE_BUTTON_LABEL = 'Explore Dashboard';

// ===== HELPER FUNCTIONS =====

function doNothingWhenPressed() {}

function explorePressOrDoNothing(onPress) {
  if (typeof onPress === 'function') return onPress;
  return doNothingWhenPressed;
}

function unreadBadgeText(unreadMessageCount) {
  if (unreadMessageCount > UNREAD_BADGE_CAP) return '99+';
  return unreadMessageCount;
}

function FeatureChip({ iconName, label, colors }) {
  const chipSurfaceStyle = [
    styles.pill,
    { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder },
  ];
  const labelStyle = [styles.pillText, { color: colors.nbInk }];

  return (
    <View style={chipSurfaceStyle}>
      <Ionicons name={iconName} size={14} color={colors.nbMuted} />
      <Text style={labelStyle} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function buildFeatureChipViews(colors) {
  const chipViews = [];
  for (let chipIndex = 0; chipIndex < DASHBOARD_FEATURE_CHIPS.length; chipIndex += 1) {
    const feature = DASHBOARD_FEATURE_CHIPS[chipIndex];
    chipViews.push(
      <FeatureChip
        key={feature.label}
        iconName={feature.icon}
        label={feature.label}
        colors={colors}
      />,
    );
  }
  return chipViews;
}

function FeatureChipsRow({ colors }) {
  const chipViews = buildFeatureChipViews(colors);
  return <View style={styles.pillsRow}>{chipViews}</View>;
}

function UnreadBadgeBubble({ unreadMessageCount, colors }) {
  const badgeSurfaceStyle = [
    styles.badge,
    { borderColor: colors.nbBorder, backgroundColor: colors.error },
  ];
  return (
    <View style={badgeSurfaceStyle} pointerEvents="none">
      <Text style={styles.badgeText}>{unreadBadgeText(unreadMessageCount)}</Text>
    </View>
  );
}

function ExploreDashboardButton({ onPress, unreadMessageCount, colors }) {
  const hasUnreadMessages = unreadMessageCount > 0;

  let unreadBadgeNode = null;
  if (hasUnreadMessages) {
    unreadBadgeNode = (
      <UnreadBadgeBubble unreadMessageCount={unreadMessageCount} colors={colors} />
    );
  }

  return (
    <View style={styles.ctaWrap}>
      {unreadBadgeNode}
      <NbButton variant="brand" onPress={onPress}>
        {EXPLORE_BUTTON_LABEL}
      </NbButton>
    </View>
  );
}

function DashboardHeroCard({ colors, explorePress, unreadMessageCount }) {
  const eyebrowStyle = [styles.label, { color: colors.nbMuted }];
  const headlineStyle = [styles.headline, { color: colors.nbInk }];
  const subheadStyle = [styles.subhead, { color: colors.nbMuted }];

  return (
    <View style={styles.wrapper}>
      <NbCard style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={eyebrowStyle}>{EYEBROW_COPY}</Text>
          <Ionicons name="grid-outline" size={24} color={colors.nbMuted} />
        </View>

        <Text style={headlineStyle}>{HEADLINE_COPY}</Text>
        <Text style={subheadStyle}>{SUBHEAD_COPY}</Text>

        <FeatureChipsRow colors={colors} />

        <ExploreDashboardButton
          onPress={explorePress}
          unreadMessageCount={unreadMessageCount}
          colors={colors}
        />
      </NbCard>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Home-screen dashboard hero.
 * Flow: 1. theme  2. safe Explore handler  3. paint hero card
 * @param {object} props
 * @param {Function} [props.onPress]
 * @param {number} [props.unreadMessageCount]
 * @param {boolean} [props.isDark] kept for callers; theme hook owns colors now
 */
export default function TopBannerCard({ onPress, unreadMessageCount = 0, isDark: _isDark }) {
  const { colors } = useTheme();

  // 1. Resolve Explore so a missing parent callback cannot crash NbButton.
  const explorePress = explorePressOrDoNothing(onPress);

  // 2. Paint eyebrow → headline → chips → CTA (badge only when unread > 0).
  return (
    <DashboardHeroCard
      colors={colors}
      explorePress={explorePress}
      unreadMessageCount={unreadMessageCount}
    />
  );
}

// PLUMBING — skip unless spacing / type / badge size looks wrong on device.

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
