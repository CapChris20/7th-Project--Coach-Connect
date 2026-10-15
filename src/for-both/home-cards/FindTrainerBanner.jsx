// Premium hero for the trainer marketplace on the client home screen.
// Flow: paint the gradient rim → label, headline, benefits → optional CTA with a notification badge.
// Used by: client home. Optional props reuse the same shell (e.g. trainer session form).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

/** Cohesive accent rim (pink → purple). Not full-spectrum / rainbow. */
const ACCENT_BORDER_GRADIENT = ['#FF6B9D', '#E879C8', '#C084FC', '#A855F7', '#FF6B9D'];
const CTA_GRADIENT = ['#FF6B9D', '#C084FC'];
const CHECK_COLORS = ['#FF6B9D', '#64D2FF', '#F97316', '#C084FC'];
// Manipulate here: badge digits stop at 99+.
const BADGE_CAP = 99;
const BADGE_OVERFLOW_LABEL = '99+';
const DEFAULT_LABEL = 'Trainer Marketplace';
const DEFAULT_HEADLINE = 'Find Your Perfect Coach';
const DEFAULT_SUBHEAD =
  'Search the marketplace, compare trainers, and connect with the coach who fits your goals and style.';
const DEFAULT_CTA_LABEL = 'Browse Trainers';
const DEFAULT_CTA_ICON = 'search';
const DEFAULT_ACCESSIBILITY_LABEL = 'Trainer marketplace';
const GRADIENT_TOP_LEFT = { x: 0, y: 0 };
const GRADIENT_BOTTOM_RIGHT = { x: 1, y: 1 };
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };

// Manipulate here: the four benefit lines under the subhead.
const DEFAULT_BENEFITS = [
  'Custom Workout Plans',
  'Live Coaching Support',
  'Real-Time Progress Tracking',
  'Message & Schedule Sessions',
];

// ===== HELPER FUNCTIONS =====

/**
 * Dark-first palette. Optional color props override only the two text slots callers restyle.
 * vocab/symbol: ?? keeps a parent-supplied color even if it is an empty-looking but defined string.
 * @param {boolean} isDark
 * @param {string} [subheadColorProp]
 * @param {string} [benefitTextColorProp]
 */
function bannerTextColors(isDark, subheadColorProp, benefitTextColorProp) {
  return {
    innerBackground: isDark ? '#0A0A0F' : '#F8F9FC',
    headlineColor: isDark ? '#FFFFFF' : '#0A0A0F',
    subheadColor: subheadColorProp ?? (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.62)'),
    benefitTextColor:
      benefitTextColorProp ?? (isDark ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.85)'),
    labelColor: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)',
    washColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent',
  };
}

/**
 * Badge shows the raw count until 99, then "99+".
 * @param {number} notificationCount
 * @returns {string|number}
 */
function marketplaceBadgeLabel(notificationCount) {
  if (notificationCount > BADGE_CAP) return BADGE_OVERFLOW_LABEL;
  return notificationCount;
}

/**
 * One benefit row. Color cycles through CHECK_COLORS so four lines never share one hue.
 */
function BenefitRow({ line, index, textColor }) {
  const checkColor = CHECK_COLORS[index % CHECK_COLORS.length];
  return (
    <View style={styles.benefitRow}>
      <Ionicons
        name="checkmark-circle"
        size={18}
        color={checkColor}
        style={styles.checkIcon}
      />
      <Text style={[styles.benefitText, { color: textColor }]}>{line}</Text>
    </View>
  );
}

/**
 * Browse CTA. Hidden when hideCta is set or the parent passed no onPress.
 */
function MarketplaceCta({
  onPress,
  hideCta,
  ctaLabel,
  ctaIcon,
  notificationCount,
}) {
  if (hideCta || !onPress) return null;
  return (
    <LinearGradient
      colors={CTA_GRADIENT}
      start={GRADIENT_LEFT}
      end={GRADIENT_RIGHT}
      style={styles.ctaGradient}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={styles.ctaTouchable}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
      >
        <Ionicons name={ctaIcon} size={20} color="#FFFFFF" />
        <Text style={styles.ctaText}>{ctaLabel}</Text>
        {notificationCount > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{marketplaceBadgeLabel(notificationCount)}</Text>
          </View>
        ) : null}
        <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </LinearGradient>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketplace hero card. Optional copy/color props reuse the same shell elsewhere.
 * @param {{ onPress?: Function, notificationCount?: number, isDark?: boolean, label?: string, headline?: string, subhead?: string, benefits?: string[], ctaLabel?: string, ctaIcon?: string, children?: *, hideCta?: boolean, accessibilityLabel?: string, outerStyle?: object, subheadColor?: string, benefitTextColor?: string }} props
 */
export default function FindTrainerBanner({
  onPress,
  notificationCount = 0,
  isDark = true,
  label = DEFAULT_LABEL,
  headline = DEFAULT_HEADLINE,
  subhead = DEFAULT_SUBHEAD,
  benefits = DEFAULT_BENEFITS,
  ctaLabel = DEFAULT_CTA_LABEL,
  ctaIcon = DEFAULT_CTA_ICON,
  children = null,
  hideCta = false,
  accessibilityLabel = DEFAULT_ACCESSIBILITY_LABEL,
  outerStyle = null,
  subheadColor: subheadColorProp,
  benefitTextColor: benefitTextColorProp,
}) {
  const colors = bannerTextColors(isDark, subheadColorProp, benefitTextColorProp);
  const benefitLines = benefits || [];

  // 1. Dark-first paint. Optional color props only restyle the two text slots.
  // 2. Paint the rim, copy, benefits, and the Browse CTA (hidden when hideCta or no onPress).
  return (
    <View
      style={[styles.outer, outerStyle]}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      <LinearGradient
        colors={ACCENT_BORDER_GRADIENT}
        start={GRADIENT_TOP_LEFT}
        end={GRADIENT_BOTTOM_RIGHT}
        style={[styles.borderRing, isDark ? styles.borderRingShadowDark : styles.borderRingShadowLight]}
      >
        <View style={[styles.innerCard, { backgroundColor: colors.innerBackground }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.innerWash,
              { backgroundColor: colors.washColor },
            ]}
            pointerEvents="none"
          />
          <View style={styles.content}>
            <Text style={[styles.label, { color: colors.labelColor }]}>{label}</Text>
            <Text style={[styles.headline, { color: colors.headlineColor }]}>{headline}</Text>
            <Text style={[styles.subhead, { color: colors.subheadColor }]}>{subhead}</Text>

            {children ? <View style={styles.childrenSlot}>{children}</View> : null}

            <View style={styles.benefits}>
              {benefitLines.map((line, index) => (
                <BenefitRow
                  key={`${line}_${index}`}
                  line={line}
                  index={index}
                  textColor={colors.benefitTextColor}
                />
              ))}
            </View>

            <MarketplaceCta
              onPress={onPress}
              hideCta={hideCta}
              ctaLabel={ctaLabel}
              ctaIcon={ctaIcon}
              notificationCount={notificationCount}
            />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  borderRing: {
    borderRadius: 24,
    padding: 2.5,
  },
  borderRingShadowDark: {
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  borderRingShadowLight: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  innerCard: {
    borderRadius: 21,
    overflow: 'hidden',
  },
  innerWash: {
    zIndex: 0,
  },
  content: {
    padding: 20,
    gap: 14,
    zIndex: 1,
  },
  childrenSlot: {
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  benefits: {
    gap: 8,
    marginTop: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  ctaGradient: {
    borderRadius: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  ctaTouchable: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
