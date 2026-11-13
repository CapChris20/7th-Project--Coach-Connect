// Home welcome hero — client + trainer (Design Law hero-and-welcome-redesign).
// Flow: eyebrow → “Welcome to” + gradient “Coach Connect” → Lottie on disc → tagline strip.
// Used by TrainingHomeScreen (client) and DesignLawTrainerHomeBlocks (trainer).
// Owner rule: NO streak, week dots, session counts, countdown, or stats in this card.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { nb } from '../../look-and-feel/colorPalette';
import {
  CLIENT_HERO_DISC_GRADIENT,
  DesignLawBrandHighlight,
  DesignLawFaintGrid,
  DesignLawTaglineStrip,
  TRAINER_HERO_DISC_GRADIENT,
} from '../brand-chrome/DesignLawHeroChrome';

// ===== NAMED CONSTANTS =====

const HANDOFF_LIFTER = require('../../assets/animations/handoff/zlifter-noyellow.json');
const HANDOFF_BOXER = require('../../assets/animations/handoff/zboxer.json');

// Manipulate here: placeholder labels from UPDATE-WELCOME-AND-HEROES.md
const CLIENT_EYEBROW = 'Your training home';
const TRAINER_EYEBROW = 'Your coaching home';

// ===== MAIN =====

/**
 * @param {{
 *   themeColors: { fill: string, onFill: string, cardBorder: string },
 *   variant?: 'client' | 'trainer',
 *   eyebrow?: string,
 * }} props
 */
export default function DesignLawHomeWelcomeHero({
  themeColors,
  variant = 'client',
  eyebrow,
}) {
  // Trainer mirrors client: animation on the LEFT (mockup `.hero4.rev`).
  const mirrored = variant === 'trainer';
  const label = eyebrow || (mirrored ? TRAINER_EYEBROW : CLIENT_EYEBROW);
  const lottieSource = mirrored ? HANDOFF_BOXER : HANDOFF_LIFTER;
  const discColors = mirrored ? TRAINER_HERO_DISC_GRADIENT : CLIENT_HERO_DISC_GRADIENT;

  // Asymmetric radii: client opens top-right; trainer opens top-left.
  const radii = mirrored
    ? {
        borderTopLeftRadius: 30,
        borderTopRightRadius: 6,
        borderBottomRightRadius: 6,
        borderBottomLeftRadius: 6,
      }
    : {
        borderTopLeftRadius: 6,
        borderTopRightRadius: 30,
        borderBottomRightRadius: 6,
        borderBottomLeftRadius: 6,
      };

  const copy = (
    <View style={styles.copy}>
      <Text style={[styles.eyebrow, { color: themeColors.onFill }]}>{label}</Text>
      <View style={styles.welcomeBlock}>
        <Text style={[styles.welcomeLead, { color: themeColors.onFill }]}>Welcome to</Text>
        <DesignLawBrandHighlight
          style={styles.brandMark}
          borderColor={themeColors.cardBorder}
        >
          Coach Connect
        </DesignLawBrandHighlight>
      </View>
    </View>
  );

  const art = (
    <View style={styles.art}>
      <LinearGradient
        colors={discColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.disc,
          { borderColor: themeColors.onFill },
          mirrored ? styles.discMirrored : null,
        ]}
      />
      <LottieView
        source={lottieSource}
        autoPlay
        loop
        style={[styles.lot, mirrored ? styles.lotMirrored : null]}
      />
    </View>
  );

  return (
    <HardShadow offset={nb.shadowOffsetHero} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View
        style={[
          styles.card,
          radii,
          {
            backgroundColor: themeColors.fill,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <DesignLawFaintGrid lineColor={themeColors.onFill} opacity={0.08} />

        {/* row-reverse puts art on the left for trainer without duplicating markup */}
        <View
          style={[
            styles.row,
            mirrored ? styles.rowMirrored : null,
            mirrored ? { flexDirection: 'row-reverse' } : null,
          ]}
        >
          {copy}
          {art}
        </View>

        <DesignLawTaglineStrip
          textColor={themeColors.onFill}
          borderColor={themeColors.onFill}
        />
      </View>
    </HardShadow>
  );
}

// ===== STYLES =====

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
