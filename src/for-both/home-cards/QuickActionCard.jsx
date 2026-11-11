// Neobrutalist quick-action tile — centered icon, hard shadow, gradient CTA.
// Flow: pick dark/light paint → optional badge → icon → label/subtitle → CTA button.
// Used by: home screens for shortcuts (messages, marketplace, workouts).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { NbCard } from '../../look-and-feel/NbCard';
import { NbButton } from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

/** Dark purple → dark orange (matches Today card & Training Agenda). */
const BORDER_GRADIENT = ['#6D28D9', '#C2410C'];
const CTA_GRADIENT = BORDER_GRADIENT;
const BG_GRADIENT_DARK = ['#12081f', '#08050f'];
const BG_GRADIENT_LIGHT = ['#F3F0FA', '#FFFFFF'];
const ACCENT_ORANGE = '#C2410C';
const ACCENT_PURPLE = '#9333EA';
const DEFAULT_ICON = 'flash-outline';
const DEFAULT_CTA_LABEL = 'View all';
const DEFAULT_WIDTH = 216;
// Manipulate here: badge digits stop at 99+.
const BADGE_CAP = 99;
const BADGE_OVERFLOW_LABEL = '99+';
const GRADIENT_TOP = { x: 0, y: 0 };
const GRADIENT_BOTTOM = { x: 0, y: 1 };
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDark
 */
function quickActionColors(isDark) {
  return {
    innerBackground: isDark ? '#0A0812' : '#FFFFFF',
    headlineColor: isDark ? '#FFFFFF' : '#0A0A0F',
    subColor: isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.52)',
    iconInnerBackground: isDark ? 'rgba(14,12,22,0.98)' : 'rgba(255,255,255,0.98)',
    iconColor: isDark ? '#FED7AA' : '#6D28D9',
    backgroundGradient: isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT,
    hairline: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.10)',
  };
}

/**
 * Badge shows the raw count until 99, then "99+".
 * @param {number} badgeCount
 * @returns {string|number}
 */
function badgeLabel(badgeCount) {
  if (badgeCount > BADGE_CAP) return BADGE_OVERFLOW_LABEL;
  return badgeCount;
}

/**
 * Spoken label for VoiceOver / TalkBack when the parent did not pass one.
 * @param {string} label
 * @param {string} subtitle
 * @param {string} ctaLabel
 * @returns {string}
 */
function defaultAccessibilityLabel(label, subtitle, ctaLabel) {
  return `${label}. ${subtitle}. ${ctaLabel}`;
}

// ===== MAIN FUNCTION =====

/**
 * Premium horizontal quick-action tile.
 * @param {{ isDark?: boolean, label: string, subtitle: string, icon?: string, ctaLabel?: string, onPress?: Function, width?: number, badgeCount?: number, style?: object, accessibilityLabel?: string }} props
 */
export default function QuickActionCard({
  isDark = true,
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
  const showBadge = typeof badgeCount === 'number' && badgeCount > 0;
  const spokenLabel = accessibilityLabel || defaultAccessibilityLabel(label, subtitle, ctaLabel);

  // 1. Neobrutalist card with hard shadow
  // 2. Paint the tile. The badge only appears when badgeCount is a number above 0.
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spokenLabel}
      style={[{ width, marginRight: 12 }, style]}
    >
      <NbCard style={styles.card}>
        <View style={styles.body}>
          {showBadge ? (
            <View style={[styles.badge, { backgroundColor: colors.nbSurfaceChip, borderColor: colors.nbBorder }]}>
              <Text style={[styles.badgeText, { color: colors.nbInk }]}>{badgeLabel(badgeCount)}</Text>
            </View>
          ) : null}

          <View style={styles.iconWrap}>
            <View style={[styles.iconRing, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip }]}>
              <Ionicons name={icon} size={26} color={COLORS.pink} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={2}>
            {label}
          </Text>
          <Text style={[styles.sub, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>

          <View style={styles.ctaWrap}>
            <NbButton variant="brand" size="sm" onPress={onPress}>
              {ctaLabel}
            </NbButton>
          </View>
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

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
