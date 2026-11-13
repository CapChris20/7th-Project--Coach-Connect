// Design Law welcome poster — CC logo stage + tilted feature tiles + “in sync.” headline.
// Flow: moon chip (parent) → black stage (logo / wordmark / ticker) → 3 tiles → CTA.
// Used only by LoginScreen renderWelcomeView. Screens: hero-and-welcome-redesign 01/02.

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HardShadow from '../look-and-feel/HardShadow';
import AppLogo from '../for-both/icons/AppLogo';
import {
  DesignLawBrandHighlight,
  DesignLawFaintGrid,
  DesignLawOrbitRings,
  DesignLawTaglineStrip,
  HERO_ACCENT_GRADIENT,
  WELCOME_STICKER_GRADIENT,
} from '../for-both/brand-chrome/DesignLawHeroChrome';
import { lightColors, nb } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const HANDOFF_DUMBBELL = require('../assets/icons/handoff/dumbbell.png');
const HANDOFF_CHECKIN = require('../assets/icons/handoff/checkin.png');
const HANDOFF_PROGRESS = require('../assets/icons/handoff/progress.png');

// Manipulate here: feature tile copy from UPDATE-WELCOME-AND-HEROES.md
const FEATURE_TILES = [
  { key: 'plans', label: 'Plans and logs', icon: HANDOFF_DUMBBELL, tilt: -2, radius: { tl: 6, tr: 20, br: 6, bl: 6 }, lift: 0 },
  { key: 'checkins', label: 'Daily check-ins', icon: HANDOFF_CHECKIN, tilt: 1.5, radius: { tl: 6, tr: 6, br: 6, bl: 6 }, lift: 8 },
  { key: 'progress', label: 'Real progress', icon: HANDOFF_PROGRESS, tilt: -1, radius: { tl: 20, tr: 6, br: 6, bl: 6 }, lift: 0 },
];

// ===== TILE =====

function FeatureTile({ label, icon, tilt, radius, lift, theme }) {
  return (
    <HardShadow
      offset={nb.shadowOffsetSmall}
      radius={6}
      style={{
        flex: 1,
        transform: [{ translateY: lift }, { rotate: `${tilt}deg` }],
      }}
    >
      <View
        style={[
          styles.tile,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderTopLeftRadius: radius.tl,
            borderTopRightRadius: radius.tr,
            borderBottomRightRadius: radius.br,
            borderBottomLeftRadius: radius.bl,
          },
        ]}
      >
        <View style={[styles.tileIconShell, { borderColor: theme.border }]}>
          <Image source={icon} style={styles.tileIcon} />
        </View>
        <Text style={[styles.tileLabel, { color: theme.ink }]}>{label}</Text>
      </View>
    </HardShadow>
  );
}

// ===== MAIN =====

/**
 * @param {{ theme: Record<string, string> }} props
 */
export default function DesignLawWelcomeStage({ theme }) {
  return (
    <View>
      {/* Black/white fill stage — logo is the centerpiece, not a side accent */}
      <HardShadow offset={nb.shadowOffsetHero} radius={10} style={{ marginBottom: 14 }}>
        <View
          style={[
            styles.stage,
            {
              backgroundColor: theme.fill,
              borderColor: theme.border,
            },
          ]}
        >
          <DesignLawFaintGrid lineColor={theme.onFill} opacity={0.09} />

          {/* “Day One starts here” sticker — g9 peach→lilac, tilted */}
          <LinearGradient
            colors={WELCOME_STICKER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.sticker, { borderColor: theme.border }]}
          >
            <Text style={styles.stickerText}>Day One starts here</Text>
          </LinearGradient>

          <View style={styles.markArea}>
            {/* Rings sit behind the transparent CC mark; both centered in the stage */}
            <View style={styles.ringsBehind} pointerEvents="none">
              <DesignLawOrbitRings color={theme.onFill} size={182} />
            </View>
            <AppLogo
              variant="transparent"
              width={196}
              accessibilityLabel="Coach Connect logo"
            />
          </View>

          <View style={styles.wordmark}>
            <Text style={[styles.wordmarkLine, { color: theme.onFill }]}>COACH</Text>
            <Text style={[styles.wordmarkLine, { color: theme.onFill }]}>CONNECT</Text>
            <LinearGradient
              colors={HERO_ACCENT_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.bar}
            />
          </View>

          <DesignLawTaglineStrip textColor={theme.onFill} borderColor={theme.onFill} />
        </View>
      </HardShadow>

      {/* Three tilted sticker tiles — replace the old AI + plans pair */}
      <View style={styles.tilesRow}>
        {FEATURE_TILES.map((tile) => (
          <FeatureTile key={tile.key} theme={theme} {...tile} />
        ))}
      </View>

      {/* RN can’t nest Views inside Text — wrap the highlight as a sibling chip */}
      <View style={styles.headlineRow}>
        <Text style={[styles.headline, { color: theme.heading }]}>
          Trainers and clients, finally{' '}
        </Text>
        <DesignLawBrandHighlight
          style={styles.syncMark}
          textStyle={styles.syncMarkText}
          borderColor={theme.border}
        >
          in sync.
        </DesignLawBrandHighlight>
      </View>
    </View>
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  stage: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 34,
    borderBottomRightRadius: 6,
    borderBottomLeftRadius: 6,
    overflow: 'hidden',
  },
  sticker: {
    position: 'absolute',
    top: 14,
    left: 12,
    zIndex: 2,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    transform: [{ rotate: '-5deg' }],
  },
  stickerText: {
    fontSize: 12,
    fontWeight: '900',
    color: lightColors.nbInk,
  },
  markArea: {
    height: 138,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringsBehind: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  wordmarkLine: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 40,
    textAlign: 'center',
  },
  bar: {
    width: 64,
    height: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  tilesRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 4,
  },
  tile: {
    borderWidth: nb.borderWidth,
    padding: 9,
    minHeight: 92,
    gap: 8,
    justifyContent: 'flex-start',
  },
  tileIconShell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: lightColors.nbSoft,
  },
  tileIcon: {
    width: 24,
    height: 24,
    resizeMode: 'contain',
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 16,
    letterSpacing: -0.2,
  },
  headlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 14,
    gap: 6,
  },
  headline: {
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 30,
  },
  syncMark: {
    transform: [{ rotate: '-1.5deg' }],
  },
  syncMarkText: {
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -1,
  },
});
