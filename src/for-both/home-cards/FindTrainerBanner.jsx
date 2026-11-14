// Home marketplace entry (Design Law marketplace-new PNG 01) — fill hero + Find / invite CTAs.
// Flow: theme + muted-on-fill → HardShadow nbFill card (copy + zcoach Lottie) → primary CTA → invite.
// Used by client home when the user has no trainer yet (TrainingHomeScreen).

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

const LOTTIE_SIZE = 84;
const ART_PAD = 4;
const ART_BOX_SIZE = LOTTIE_SIZE + ART_PAD * 2;

const ZCOACH_LOTTIE = require('../../assets/animations/handoff/zcoach.json');

const LIGHT_ON_FILL_MUTED = 'rgba(255,255,255,0.65)';
const DARK_ON_FILL_MUTED = 'rgba(10,10,10,0.55)';

// ===== HELPER FUNCTIONS =====

/**
 * CTA badge digits when the marketplace has waiting notifications.
 * @param {number} notificationCount
 * @returns {string|number}
 */
function marketplaceBadgeLabel(notificationCount) {
  if (notificationCount > BADGE_CAP) return BADGE_OVERFLOW_LABEL;
  return notificationCount;
}

/**
 * Muted copy sitting on nbFill. Light theme wants a white wash; dark wants an ink wash.
 * @param {object} colors
 * @param {boolean} isDark
 * @returns {string}
 */
function mutedTextColorOnFill(colors, isDark) {
  if (colors.nbOnFillMuted) return colors.nbOnFillMuted;
  if (isDark) return DARK_ON_FILL_MUTED;
  return LIGHT_ON_FILL_MUTED;
}

/**
 * Prefer an explicit isDark prop; otherwise follow the live theme.
 * @param {boolean|undefined} isDarkProp
 * @param {boolean} themeIsDark
 * @returns {boolean}
 */
function resolveIsDark(isDarkProp, themeIsDark) {
  if (typeof isDarkProp === 'boolean') return isDarkProp;
  return themeIsDark;
}

/**
 * Primary button label; append · count when there are marketplace notifications.
 * @param {string} ctaLabel
 * @param {number} notificationCount
 * @returns {string}
 */
function primaryCtaLabelWithBadge(ctaLabel, notificationCount) {
  if (notificationCount <= 0) return ctaLabel;
  const badgePart = marketplaceBadgeLabel(notificationCount);
  return `${ctaLabel} · ${badgePart}`;
}

function MarketplaceCopyColumn({ label, headline, subhead, mutedOnFill, onFillColor }) {
  return (
    <View style={styles.copyCol}>
      <Text style={[styles.label, { color: mutedOnFill }]}>{label}</Text>
      <Text style={[styles.headline, { color: onFillColor }]}>{headline}</Text>
      <Text style={[styles.subhead, { color: mutedOnFill }]}>{subhead}</Text>
    </View>
  );
}

function MarketplaceLottieArt({ borderColor, onFillColor }) {
  const lottieStyle = { width: LOTTIE_SIZE, height: LOTTIE_SIZE };
  return (
    <View
      style={[
        styles.artBox,
        {
          borderColor,
          backgroundColor: onFillColor,
        },
      ]}
    >
      <LottieView source={ZCOACH_LOTTIE} autoPlay loop style={lottieStyle} />
    </View>
  );
}

function MarketplaceCtaStack({
  showPrimaryCta,
  showInviteButton,
  primaryCtaText,
  inviteLabel,
  onPress,
  onInvitePress,
}) {
  // Same as before: invite only paints when the primary CTA stack is shown.
  if (!showPrimaryCta) return null;

  let inviteButton = null;
  if (showInviteButton) {
    inviteButton = (
      <NbButton variant="plain" onPress={onInvitePress}>
        {inviteLabel}
      </NbButton>
    );
  }

  return (
    <View style={styles.ctaStack}>
      <NbButton variant="fill" onPress={onPress}>
        {primaryCtaText}
      </NbButton>
      {inviteButton}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Home marketplace hook. Optional copy overrides keep reuse sites flexible.
 * CTAs sit under the fill card (PNG): fill primary on the page, plain invite below.
 * Legacy props (benefits / ctaIcon / colors) are accepted but not painted.
 * @param {object} props
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
  benefits: _benefits,
  ctaIcon: _ctaIcon,
  subheadColor: _subheadColor,
  benefitTextColor: _benefitTextColor,
}) {
  const { colors, isDark: themeIsDark } = useTheme();

  // 1. Resolve theme override and muted-on-fill text for the black hero card.
  const isDark = resolveIsDark(isDarkProp, themeIsDark);
  const mutedOnFill = mutedTextColorOnFill(colors, isDark);

  // 2. Name which slots render before JSX.
  // Freeze: primary CTA uses truthy onPress (same as before), not typeof === 'function'.
  const showInviteButton = !hideInvite && typeof onInvitePress === 'function';
  const showPrimaryCta = !hideCta && onPress;
  const showChildrenSlot = Boolean(children);
  const primaryCtaText = primaryCtaLabelWithBadge(ctaLabel, notificationCount);

  // 3. Card surface tokens — fill + border from theme.
  const cardSurfaceStyle = [
    styles.card,
    { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
  ];
  const outerWrapStyle = [styles.outer, outerStyle];

  let childrenSlot = null;
  if (showChildrenSlot) {
    childrenSlot = <View style={styles.childrenSlot}>{children}</View>;
  }

  return (
    <View
      style={outerWrapStyle}
      accessibilityRole="summary"
      accessibilityLabel={accessibilityLabel}
    >
      <HardShadow offset={nb.shadowOffsetHero} radius={borderRadius.nbCard}>
        <View style={cardSurfaceStyle}>
          <View style={styles.cardRow}>
            <MarketplaceCopyColumn
              label={label}
              headline={headline}
              subhead={subhead}
              mutedOnFill={mutedOnFill}
              onFillColor={colors.nbOnFill}
            />
            <MarketplaceLottieArt
              borderColor={colors.nbBorder}
              onFillColor={colors.nbOnFill}
            />
          </View>
          {childrenSlot}
        </View>
      </HardShadow>

      <MarketplaceCtaStack
        showPrimaryCta={showPrimaryCta}
        showInviteButton={showInviteButton}
        primaryCtaText={primaryCtaText}
        inviteLabel={inviteLabel}
        onPress={onPress}
        onInvitePress={onInvitePress}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
    width: ART_BOX_SIZE,
    height: ART_BOX_SIZE,
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
