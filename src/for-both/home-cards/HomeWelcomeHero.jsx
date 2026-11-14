// Home welcome hero — client + trainer (Design Law hero-and-welcome-redesign).
// Flow: pick variant tokens → HardShadow card → faint grid → copy + Lottie row → tagline strip.
// Used by TrainingHomeScreen (client) and TrainerHomeBlocks (trainer).
// Owner rule: NO streak, week dots, session counts, countdown, or stats in this card.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { nb } from '../../look-and-feel/colorPalette';
import {
  CLIENT_HERO_DISC_GRADIENT,
  BrandHighlight,
  FaintGrid,
  TaglineStrip,
  TRAINER_HERO_DISC_GRADIENT,
} from '../brand-chrome/HeroChrome';

// ===== NAMED CONSTANTS =====

const CLIENT_EYEBROW = 'Your training home';
const TRAINER_EYEBROW = 'Your coaching home';

const TRAINER_VARIANT = 'trainer';

const HANDOFF_LIFTER = require('../../assets/animations/handoff/zlifter-noyellow.json');
const HANDOFF_BOXER = require('../../assets/animations/handoff/zboxer.json');

const CLIENT_CORNER_RADII = {
  borderTopLeftRadius: 6,
  borderTopRightRadius: 30,
  borderBottomRightRadius: 6,
  borderBottomLeftRadius: 6,
};
const TRAINER_CORNER_RADII = {
  borderTopLeftRadius: 30,
  borderTopRightRadius: 6,
  borderBottomRightRadius: 6,
  borderBottomLeftRadius: 6,
};

const CARD_SHADOW_RADIUS = 10;
const FAINT_GRID_OPACITY = 0.08;

// ===== HELPER FUNCTIONS =====

function homeIsTrainerVariant(variant) {
  return variant === TRAINER_VARIANT;
}

function cornerRadiiForHomeVariant(isTrainerHome) {
  if (isTrainerHome) return TRAINER_CORNER_RADII;
  return CLIENT_CORNER_RADII;
}

/**
 * Parent eyebrow wins; otherwise client vs trainer default.
 * @param {boolean} isTrainerHome
 * @param {string|undefined} eyebrowFromParent
 * @returns {string}
 */
function eyebrowLabelForVariant(isTrainerHome, eyebrowFromParent) {
  if (eyebrowFromParent) return eyebrowFromParent;
  if (isTrainerHome) return TRAINER_EYEBROW;
  return CLIENT_EYEBROW;
}

function lottieSourceForVariant(isTrainerHome) {
  if (isTrainerHome) return HANDOFF_BOXER;
  return HANDOFF_LIFTER;
}

function discGradientForVariant(isTrainerHome) {
  if (isTrainerHome) return TRAINER_HERO_DISC_GRADIENT;
  return CLIENT_HERO_DISC_GRADIENT;
}

/**
 * Light → white surface + dark ink; dark → dark surface + light ink.
 * Why not fill/onFill: those invert (black hero in light), which fights the rest of home.
 * @param {object} themeColors
 * @returns {{ cardBackground: string, inkColor: string }}
 */
function welcomeCardColors(themeColors) {
  const cardBackground = themeColors.cardBg ?? themeColors.fill;
  const inkColor = themeColors.text ?? themeColors.onFill;
  return { cardBackground, inkColor };
}

function WelcomeTextColumn({ eyebrowText, inkColor, cardBorderColor }) {
  return (
    <View style={styles.copy}>
      <Text style={[styles.eyebrow, { color: inkColor }]}>{eyebrowText}</Text>
      <View style={styles.welcomeBlock}>
        <Text style={[styles.welcomeLead, { color: inkColor }]}>Welcome to</Text>
        <BrandHighlight style={styles.brandMark} borderColor={cardBorderColor}>
          Coach Connect
        </BrandHighlight>
      </View>
    </View>
  );
}

function HeroLottieColumn({ isTrainerHome, inkColor, lottieSource, discGradientColors }) {
  let discMirroredStyle = null;
  let lottieMirroredStyle = null;
  if (isTrainerHome) {
    discMirroredStyle = styles.discMirrored;
    lottieMirroredStyle = styles.lotMirrored;
  }

  const discStyle = [styles.disc, { borderColor: inkColor }, discMirroredStyle];
  const lottieStyle = [styles.lot, lottieMirroredStyle];

  return (
    <View style={styles.art}>
      <LinearGradient
        colors={discGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={discStyle}
      />
      <LottieView source={lottieSource} autoPlay loop style={lottieStyle} />
    </View>
  );
}

function WelcomeHeroRow({
  isTrainerHome,
  eyebrowText,
  inkColor,
  cardBorderColor,
  lottieSource,
  discGradientColors,
}) {
  let rowMirroredStyle = null;
  let rowReverseStyle = null;
  if (isTrainerHome) {
    rowMirroredStyle = styles.rowMirrored;
    rowReverseStyle = { flexDirection: 'row-reverse' };
  }

  const rowStyle = [styles.row, rowMirroredStyle, rowReverseStyle];

  return (
    <View style={rowStyle}>
      <WelcomeTextColumn
        eyebrowText={eyebrowText}
        inkColor={inkColor}
        cardBorderColor={cardBorderColor}
      />
      <HeroLottieColumn
        isTrainerHome={isTrainerHome}
        inkColor={inkColor}
        lottieSource={lottieSource}
        discGradientColors={discGradientColors}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Welcome hero for client home or trainer home.
 * @param {{
 *   themeColors: {
 *     cardBg?: string,
 *     text?: string,
 *     fill: string,
 *     onFill: string,
 *     cardBorder: string,
 *   },
 *   variant?: 'client' | 'trainer',
 *   eyebrow?: string,
 * }} props
 */
export default function HomeWelcomeHero({
  themeColors,
  variant = 'client',
  eyebrow,
}) {
  const isTrainerHome = homeIsTrainerVariant(variant);

  // 1. Pick eyebrow copy, Lottie asset, and disc gradient for client vs trainer.
  const eyebrowText = eyebrowLabelForVariant(isTrainerHome, eyebrow);
  const lottieSource = lottieSourceForVariant(isTrainerHome);
  const discGradientColors = discGradientForVariant(isTrainerHome);

  // 2. Surface card (cardBg + ink) follows light/dark with the rest of home.
  const { cardBackground, inkColor } = welcomeCardColors(themeColors);
  const cornerRadii = cornerRadiiForHomeVariant(isTrainerHome);
  const cardBorderColor = themeColors.cardBorder;

  const cardShellStyle = [
    styles.card,
    cornerRadii,
    {
      backgroundColor: cardBackground,
      borderColor: cardBorderColor,
    },
  ];
  const hardShadowStyle = { marginBottom: nb.blockGap };

  // 3. HardShadow shell → faint grid → copy + art row → tagline strip.
  return (
    <HardShadow
      offset={nb.shadowOffsetHero}
      radius={CARD_SHADOW_RADIUS}
      style={hardShadowStyle}
    >
      <View style={cardShellStyle}>
        <FaintGrid lineColor={inkColor} opacity={FAINT_GRID_OPACITY} />

        <WelcomeHeroRow
          isTrainerHome={isTrainerHome}
          eyebrowText={eyebrowText}
          inkColor={inkColor}
          cardBorderColor={cardBorderColor}
          lottieSource={lottieSource}
          discGradientColors={discGradientColors}
        />

        <TaglineStrip textColor={inkColor} borderColor={inkColor} />
      </View>
    </HardShadow>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  card: {
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 18,
    paddingBottom: 12,
    paddingLeft: 16,
    paddingRight: 0,
    minHeight: 138,
  },
  rowMirrored: {
    paddingLeft: 0,
    paddingRight: 16,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    opacity: 0.75,
  },
  welcomeBlock: {
    marginTop: 8,
    gap: 6,
  },
  welcomeLead: {
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 30,
  },
  brandMark: {
    marginLeft: -2,
  },
  art: {
    width: 128,
    height: 138,
    position: 'relative',
  },
  disc: {
    position: 'absolute',
    right: -6,
    bottom: -14,
    width: 118,
    height: 118,
    borderRadius: 59,
    borderWidth: 3,
    opacity: 0.9,
  },
  discMirrored: {
    right: undefined,
    left: -6,
  },
  lot: {
    position: 'absolute',
    right: 2,
    bottom: 0,
    width: 122,
    height: 122,
  },
  lotMirrored: {
    right: undefined,
    left: 2,
  },
});
