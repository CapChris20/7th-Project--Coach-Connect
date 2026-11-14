// Design Law welcome poster — CC logo stage + tilted feature tiles + “in sync.” headline.
// Flow: moon chip (parent) → black stage (logo / wordmark / ticker) → 3 tiles → CTA.
// Used only by LoginScreen renderWelcomeView. Screens: hero-and-welcome-redesign 01/02.

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import HardShadow from '../look-and-feel/HardShadow';
import AppLogo from '../for-both/icons/AppLogo';
import {
  BrandHighlight,
  FaintGrid,
  OrbitRings,
  TaglineStrip,
  HERO_ACCENT_GRADIENT,
  WELCOME_STICKER_GRADIENT,
} from '../for-both/brand-chrome/HeroChrome';
import { lightColors, nb } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const HANDOFF_DUMBBELL = require('../assets/icons/handoff/dumbbell.png');
const HANDOFF_CHECKIN = require('../assets/icons/handoff/checkin.png');
const HANDOFF_PROGRESS = require('../assets/icons/handoff/progress.png');

const ORBIT_RING_SIZE = 182;
const LOGO_WIDTH = 196;
const STICKER_TILT_DEGREES = -5;

// Manipulate here: feature tile copy + tilt from UPDATE-WELCOME-AND-HEROES.md / Design Law PNGs.
const FEATURE_TILES = [
  {
    key: 'plans',
    label: 'Plans and logs',
    icon: HANDOFF_DUMBBELL,
    tiltDegrees: -2,
    cornerRadius: { topLeft: 6, topRight: 20, bottomRight: 6, bottomLeft: 6 },
    liftPixels: 0,
  },
  {
    key: 'checkins',
    label: 'Daily check-ins',
    icon: HANDOFF_CHECKIN,
    tiltDegrees: 1.5,
    cornerRadius: { topLeft: 6, topRight: 6, bottomRight: 6, bottomLeft: 6 },
    liftPixels: 8,
  },
  {
    key: 'progress',
    label: 'Real progress',
    icon: HANDOFF_PROGRESS,
    tiltDegrees: -1,
    cornerRadius: { topLeft: 20, topRight: 6, bottomRight: 6, bottomLeft: 6 },
    liftPixels: 0,
  },
];

// ===== HELPER FUNCTIONS =====

// Per-corner radii match the uneven sticker look on the Design Law welcome PNG.
function cornerRadiusStyle(cornerRadius) {
  return {
    borderTopLeftRadius: cornerRadius.topLeft,
    borderTopRightRadius: cornerRadius.topRight,
    borderBottomRightRadius: cornerRadius.bottomRight,
    borderBottomLeftRadius: cornerRadius.bottomLeft,
  };
}

// One tilted sticker tile — icon shell, label, per-corner radius from Design Law PNGs.
function FeatureTile({ label, icon, tiltDegrees, cornerRadius, liftPixels, theme }) {
  const tileTransform = [{ translateY: liftPixels }, { rotate: `${tiltDegrees}deg` }];
  const tileSurfaceStyle = {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    ...cornerRadiusStyle(cornerRadius),
  };

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={6} style={{ flex: 1, transform: tileTransform }}>
      <View style={[styles.tile, tileSurfaceStyle]}>
        <View style={[styles.tileIconShell, { borderColor: theme.border }]}>
          <Image source={icon} style={styles.tileIcon} />
        </View>
        <Text style={[styles.tileLabel, { color: theme.ink }]}>{label}</Text>
      </View>
    </HardShadow>
  );
}

// Black fill stage: sticker, logo, wordmark, ticker strip — matches hero PNG 01.
function WelcomePosterStage({ theme }) {
  const stageSurfaceStyle = {
    backgroundColor: theme.fill,
    borderColor: theme.border,
  };
  const stickerRotate = [{ rotate: `${STICKER_TILT_DEGREES}deg` }];

  return (
    <HardShadow offset={nb.shadowOffsetHero} radius={10} style={{ marginBottom: 14 }}>
      <View style={[styles.stage, stageSurfaceStyle]}>
        <FaintGrid lineColor={theme.onFill} opacity={0.09} />

        <LinearGradient
          colors={WELCOME_STICKER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.sticker, { borderColor: theme.border, transform: stickerRotate }]}
        >
          <Text style={styles.stickerText}>Day One starts here</Text>
        </LinearGradient>

        <View style={styles.markArea}>
          <View style={styles.ringsBehind} pointerEvents="none">
            <OrbitRings color={theme.onFill} size={ORBIT_RING_SIZE} />
          </View>
          <AppLogo variant="transparent" width={LOGO_WIDTH} accessibilityLabel="Coach Connect logo" />
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

        <TaglineStrip textColor={theme.onFill} borderColor={theme.onFill} />
      </View>
    </HardShadow>
  );
}

// Headline row: plain text + BrandHighlight sibling (RN cannot nest Views inside Text).
function WelcomeHeadline({ theme }) {
  return (
    <View style={styles.headlineRow}>
      <Text style={[styles.headline, { color: theme.heading }]}>Trainers and clients, finally </Text>
      <BrandHighlight
        style={styles.syncMark}
        textStyle={styles.syncMarkText}
        borderColor={theme.border}
      >
        in sync.
      </BrandHighlight>
    </View>
  );
}

function WelcomeFeatureTilesRow({ theme }) {
  return (
    <View style={styles.tilesRow}>
      {FEATURE_TILES.map((tile) => (
        <FeatureTile
          key={tile.key}
          theme={theme}
          label={tile.label}
          icon={tile.icon}
          tiltDegrees={tile.tiltDegrees}
          cornerRadius={tile.cornerRadius}
          liftPixels={tile.liftPixels}
        />
      ))}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Welcome hero block for the login screen — poster, tiles, headline only (no buttons here).
 * @param {{ theme: Record<string, string> }} props Theme colors from LoginScreen landingTheme.
 */
export default function WelcomeStage({ theme }) {
  // 1. Center stage (logo + wordmark).
  // 2. Three feature tiles in a row.
  // 3. “in sync.” headline under the tiles.
  return (
    <View>
      <WelcomePosterStage theme={theme} />
      <WelcomeFeatureTilesRow theme={theme} />
      <WelcomeHeadline theme={theme} />
    </View>
  );
}

// PLUMBING — skip unless debugging

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
