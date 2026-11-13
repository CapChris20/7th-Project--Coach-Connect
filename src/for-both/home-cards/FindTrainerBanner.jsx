// Design Law home marketplace entry (marketplace-new PNG 01) — fill card + Find / invite CTAs.
// Flow: black (nbFill) hero card with zcoach Lottie → headline/body → primary fill CTA → outline invite CTA.
// Used by client home when the user has no trainer yet.
//
// vocab: nbFill = theme ink surface (black in light, light in dark); never rainbow borders or green checks
// Manipulate here: DEFAULT_* copy strings if marketing wants different banner wording; LOTTIE_SIZE for art

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE_CAP = 99;
const BADGE_OVERFLOW_LABEL = '99+';
const DEFAULT_LABEL = 'NO TRAINER YET';
const DEFAULT_HEADLINE = 'Find Your Perfect Trainer';
const DEFAULT_SUBHEAD =
  'Custom workouts, direct messaging, progress tracking and session booking.';
const DEFAULT_CTA_LABEL = 'Find a Trainer';
const DEFAULT_INVITE_LABEL = 'I have an invite code';
const DEFAULT_ACCESSIBILITY_LABEL = 'Find a trainer';
// Manipulate here: PNG 01 art box is ~84; keep touch/visual balance with headline
const LOTTIE_SIZE = 84;
const ART_PAD = 4;

const ZCOACH_LOTTIE = require('../../assets/animations/handoff/zcoach.json');

// ===== HELPER FUNCTIONS =====

function marketplaceBadgeLabel(notificationCount) {
  if (notificationCount > BADGE_CAP) return BADGE_OVERFLOW_LABEL;
  return notificationCount;
}

/**
 * Muted copy on nbFill — light theme = white wash; dark theme = ink wash.
 * vocab: nbFill flips by theme, so on-fill muted cannot be a single fixed gray token
 */
function onFillMuted(colors, isDark) {
  if (colors.nbOnFillMuted) return colors.nbOnFillMuted;
  return isDark ? 'rgba(10,10,10,0.55)' : 'rgba(255,255,255,0.65)';
}

// ===== MAIN FUNCTION =====

/**
 * Home marketplace hook. Keeps optional copy overrides for reuse elsewhere.
 * CTAs sit under the fill card (PNG): fill primary on the page background, plain invite.
 * @param {{ onPress?: Function, onInvitePress?: Function, notificationCount?: number, isDark?: boolean, label?: string, headline?: string, subhead?: string, ctaLabel?: string, inviteLabel?: string, hideCta?: boolean, hideInvite?: boolean, accessibilityLabel?: string, outerStyle?: object, children?: *, benefits?: string[], ctaIcon?: string, subheadColor?: string, benefitTextColor?: string }} props
 */
export default function FindTrainerBanner({
  onPress,
  onInvitePress = null,
  notificationCount = 0,
  isDark: isDarkProp,
  label = DEFAULT_LABEL,
  headline = DEFAULT_HEADLINE,
  subhead = DEFAULT_SUBHEAD,
  ctaLabel = DEFAULT_CTA_LABEL,
  inviteLabel = DEFAULT_INVITE_LABEL,
  hideCta = false,
  hideInvite = false,
  accessibilityLabel = DEFAULT_ACCESSIBILITY_LABEL,
  outerStyle = null,
  children = null,
  // Legacy props kept so older call sites do not crash (benefits / icons no longer painted).
  benefits: _benefits,
  ctaIcon: _ctaIcon,
  subheadColor: _subheadColor,
  benefitTextColor: _benefitTextColor,
}) {
  const { colors, isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : themeIsDark;
  const showInvite = !hideInvite && typeof onInvitePress === 'function';
  const mutedOnFill = onFillMuted(colors, isDark);
  const ctaText =
    notificationCount > 0
      ? `${ctaLabel} · ${marketplaceBadgeLabel(notificationCount)}`
      : ctaLabel;

  return (
    <View
      style={[styles.outer, outerStyle]}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      <HardShadow offset={nb.shadowOffsetHero} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
          ]}
        >
          {/* PNG 01: copy left, zcoach Lottie in a hard-bordered on-fill art box right */}
          <View style={styles.cardRow}>
            <View style={styles.copyCol}>
              <Text style={[styles.label, { color: mutedOnFill }]}>{label}</Text>
              <Text style={[styles.headline, { color: colors.nbOnFill }]}>{headline}</Text>
              <Text style={[styles.subhead, { color: mutedOnFill }]}>{subhead}</Text>
            </View>
            <View
              style={[
                styles.artBox,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbOnFill },
              ]}
            >
              <LottieView
                source={ZCOACH_LOTTIE}
                autoPlay
                loop
                style={{ width: LOTTIE_SIZE, height: LOTTIE_SIZE }}
              />
            </View>
          </View>
          {children ? <View style={styles.childrenSlot}>{children}</View> : null}
        </View>
      </HardShadow>

      {/* PNG 01: CTAs live under the black banner on the page surface — not inside the fill card */}
      {!hideCta && onPress ? (
        <View style={styles.ctaStack}>
          <NbButton variant="fill" onPress={onPress}>
            {ctaText}
          </NbButton>
          {showInvite ? (
            <NbButton variant="plain" onPress={onInvitePress}>
              {inviteLabel}
            </NbButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: nb.screenGutter || spacing.md,
    gap: 12,
  },
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 20,
    gap: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copyCol: {
    flex: 1,
    minWidth: 0,
    gap: 10,
  },
  artBox: {
    width: LOTTIE_SIZE + ART_PAD * 2,
    height: LOTTIE_SIZE + ART_PAD * 2,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 26,
    lineHeight: 32,
  },
  subhead: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  childrenSlot: { gap: 10 },
  ctaStack: { gap: 10 },
});
