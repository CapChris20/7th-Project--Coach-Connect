// Neobrutalist quick-action tile — centered icon, hard shadow, brand CTA.
// Flow: decide badge + VoiceOver label → TouchableOpacity NbCard → badge → icon ring → copy → CTA.
// Used by home screens for shortcuts (messages, marketplace, workouts).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON = 'flash-outline';
const DEFAULT_CTA_LABEL = 'View all';
const DEFAULT_WIDTH = 216;

const BADGE_CAP = 99;
const BADGE_OVERFLOW_LABEL = '99+';

const ICON_RING_SIZE = 26;
const TILE_ACTIVE_OPACITY = 0.92;
const TILE_RIGHT_GAP = 12;

// ===== HELPER FUNCTIONS =====

function countIsBigEnoughForBadge(badgeCount) {
  return typeof badgeCount === 'number' && badgeCount > 0;
}

function digitsOrNinetyNinePlus(badgeCount) {
  if (badgeCount > BADGE_CAP) return BADGE_OVERFLOW_LABEL;
  return badgeCount;
}

function voiceOverLabelForTile(label, subtitle, ctaLabel, labelFromParent) {
  if (labelFromParent) return labelFromParent;
  return `${label}. ${subtitle}. ${ctaLabel}`;
}

function CornerBadge({ badgeCount, chipBackground, chipBorder, inkColor }) {
  const badgeDigits = digitsOrNinetyNinePlus(badgeCount);
  const badgeSurfaceStyle = [
    styles.badge,
    { backgroundColor: chipBackground, borderColor: chipBorder },
  ];

  return (
    <View style={badgeSurfaceStyle}>
      <Text style={[styles.badgeText, { color: inkColor }]}>{badgeDigits}</Text>
    </View>
  );
}

function IconInsideRing({ iconName, ringBorder, ringBackground, iconColor }) {
  const ringSurfaceStyle = [
    styles.iconRing,
    { borderColor: ringBorder, backgroundColor: ringBackground },
  ];

  return (
    <View style={styles.iconWrap}>
      <View style={ringSurfaceStyle}>
        <Ionicons name={iconName} size={ICON_RING_SIZE} color={iconColor} />
      </View>
    </View>
  );
}

function TitleAndSubtitle({ label, subtitle, inkColor, mutedColor }) {
  return (
    <>
      <Text style={[styles.title, { color: inkColor }]} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.sub, { color: mutedColor }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium horizontal quick-action tile.
 * Parent may pass `isDark`; paint comes from useTheme (same as before).
 * @param {{
 *   isDark?: boolean,
 *   label: string,
 *   subtitle: string,
 *   icon?: string,
 *   ctaLabel?: string,
 *   onPress?: Function,
 *   width?: number,
 *   badgeCount?: number,
 *   style?: object,
 *   accessibilityLabel?: string,
 * }} props
 */
export default function QuickActionCard({
  isDark: _isDarkKeptForCallSites,
  label,
  subtitle,
  icon = DEFAULT_ICON,
  ctaLabel = DEFAULT_CTA_LABEL,
  onPress,
  width = DEFAULT_WIDTH,
  badgeCount,
  style,
  accessibilityLabel,
}) {
  const { colors } = useTheme();

  // 1. Decide whether the numeric badge sits in the top-right corner.
  const showBadge = countIsBigEnoughForBadge(badgeCount);

  // 2. Build the VoiceOver string when the parent did not pass one.
  const voiceLabel = voiceOverLabelForTile(
    label,
    subtitle,
    ctaLabel,
    accessibilityLabel,
  );

  // 3. Whole tile is one touch target; CTA button repeats onPress for thumb reach.
  const outerTouchStyle = [{ width, marginRight: TILE_RIGHT_GAP }, style];

  let badgeNode = null;
  if (showBadge) {
    badgeNode = (
      <CornerBadge
        badgeCount={badgeCount}
        chipBackground={colors.nbSurfaceChip}
        chipBorder={colors.nbBorder}
        inkColor={colors.nbInk}
      />
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={TILE_ACTIVE_OPACITY}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={voiceLabel}
      style={outerTouchStyle}
    >
      <NbCard style={styles.card}>
        <View style={styles.body}>
          {badgeNode}

          <IconInsideRing
            iconName={icon}
            ringBorder={colors.nbBorder}
            ringBackground={colors.nbSurfaceChip}
            iconColor={colors.nbInk}
          />

          <TitleAndSubtitle
            label={label}
            subtitle={subtitle}
            inkColor={colors.nbInk}
            mutedColor={colors.nbMuted}
          />

          <View style={styles.ctaWrap}>
            <NbButton variant="brand" sm onPress={onPress}>
              {ctaLabel}
            </NbButton>
          </View>
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  card: {
    minHeight: 168,
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
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
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
    borderRadius: 14,
    borderWidth: 2.5,
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
  ctaWrap: {
    marginTop: 14,
    alignSelf: 'stretch',
  },
});
