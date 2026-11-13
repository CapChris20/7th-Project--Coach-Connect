// Shared Design Law brand chrome for the welcome stage and home heroes.
// Flow: faint grid + scrolling “One Day or Day One!” strip + gradient “Coach Connect” mark.
// Used by DesignLawHomeWelcomeHero and the LoginScreen welcome view.
// Visual law: docs/design/Design-Law/screens/hero-and-welcome-redesign/

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { lightColors, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: owner accent from heroes.py (.mk / diamonds / bar2) — yellow→pink wins for these screens
export const HERO_ACCENT_GRADIENT = ['#FCD34D', '#F472B6'];
// Manipulate here: welcome sticker uses g9 (peach→lilac)
export const WELCOME_STICKER_GRADIENT = ['#FDBA74', '#C4B5FD'];
// Manipulate here: client lifter disc (g2) / trainer boxer disc (g5)
export const CLIENT_HERO_DISC_GRADIENT = ['#FBBF24', '#EF4444'];
export const TRAINER_HERO_DISC_GRADIENT = ['#FDE047', '#FB923C'];

const TAGLINE = 'One Day or Day One!';
// Manipulate here: marquee loop length (mockup GSAP duration 14s for half-width)
const MARQUEE_MS = 14000;
const MARQUEE_COPIES = 8;
const GRID_CELL_PX = 28;
const GRID_LINE_PX = 1.5;

// ===== HELPERS =====

function uniquePatternId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// ===== FAINT GRID =====

/**
 * Neo-brutalist graph-paper wash behind welcome / home heroes.
 * Why SVG: RN Views can’t do a clean repeating 28px grid without dozens of children.
 * vocab: patternUnits userSpaceOnUse = tile size is device px, not % of the SVG.
 */
export function DesignLawFaintGrid({ lineColor, opacity = 0.08, style }) {
  const patternId = useMemo(() => uniquePatternId('heroGrid'), []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={GRID_CELL_PX}
            height={GRID_CELL_PX}
          >
            {/* Top + left edges only — adjacent tiles complete the square */}
            <Rect x={0} y={0} width={GRID_CELL_PX} height={GRID_LINE_PX} fill={lineColor} />
            <Rect x={0} y={0} width={GRID_LINE_PX} height={GRID_CELL_PX} fill={lineColor} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} opacity={opacity} />
      </Svg>
    </View>
  );
}

// ===== GRADIENT HIGHLIGHT (“Coach Connect” / “in sync.”) =====

/**
 * Small gradient sticker behind brand words — the only colorful chrome on the hero.
 * @param {{ children: React.ReactNode, style?: object, textStyle?: object, borderColor?: string }} props
 */
export function DesignLawBrandHighlight({
  children,
  style,
  textStyle,
  borderColor = lightColors.nbInk,
}) {
  return (
    <LinearGradient
      colors={HERO_ACCENT_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.mark, { borderColor }, style]}
    >
      <Text style={[styles.markText, textStyle]}>{children}</Text>
    </LinearGradient>
  );
}

// ===== TAGLINE STRIP =====

/**
 * Scrolling italic tagline with gradient diamond separators (mockup `.mq`).
 * Why duplicate the row: seamless loop = translate by exactly half the measured width.
 */
export function DesignLawTaglineStrip({ textColor, borderColor }) {
  const progress = useSharedValue(0);
  const [halfWidth, setHalfWidth] = useState(0);

  useEffect(() => {
    // Start only after we know half-width so x distance matches one full copy set.
    if (halfWidth <= 0) return undefined;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: MARQUEE_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return undefined;
  }, [halfWidth, progress]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * halfWidth }],
  }));

  // Two identical runs of TAGLINE so the loop never shows a gap.
  const segments = useMemo(
    () => Array.from({ length: MARQUEE_COPIES * 2 }, (_, i) => i),
    [],
  );

  return (
    <View style={[styles.mq, { borderTopColor: borderColor }]}>
      <Animated.View
        style={[styles.mqTrack, rowStyle]}
        onLayout={(e) => {
          // Half of the full track = one copy of the 8-span set.
          const w = e.nativeEvent.layout.width;
          if (w > 0) setHalfWidth(w / 2);
        }}
      >
        {segments.map((i) => (
          <View key={`tag-${i}`} style={styles.mqItem}>
            <Text style={[styles.mqText, { color: textColor }]}>{TAGLINE}</Text>
            <LinearGradient
              colors={HERO_ACCENT_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.diamond}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// ===== SLOW DASHED RINGS (welcome logo) =====

/**
 * Two concentric dashed rings that rotate opposite ways (28s / 40s in the HTML mockup).
 */
export function DesignLawOrbitRings({ color, size = 182 }) {
  const spinA = useSharedValue(0);
  const spinB = useSharedValue(0);

  useEffect(() => {
    // Manipulate here: ring periods — match heroes.py (28s inner, 40s outer)
    spinA.value = withRepeat(withTiming(1, { duration: 28000, easing: Easing.linear }), -1, false);
    spinB.value = withRepeat(withTiming(1, { duration: 40000, easing: Easing.linear }), -1, false);
  }, [spinA, spinB]);

  const ringAStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinA.value * 360}deg` }],
  }));
  const ringBStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-spinB.value * 360}deg` }],
  }));

  const inner = Math.round(size * (140 / 182));
  const stroke = color;

  return (
    <View style={[styles.ringWrap, { width: size, height: size }]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, ringBStyle, { opacity: 0.14 }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={(size - 6) / 2}
            stroke={stroke}
            strokeWidth={3}
            strokeDasharray="10 12"
            fill="none"
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: (size - inner) / 2,
            top: (size - inner) / 2,
            width: inner,
            height: inner,
            opacity: 0.28,
          },
          ringAStyle,
        ]}
      >
        <Svg width={inner} height={inner}>
          <Circle
            cx={inner / 2}
            cy={inner / 2}
            r={(inner - 6) / 2}
            stroke={stroke}
            strokeWidth={3}
            strokeDasharray="8 10"
            fill="none"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  mark: {
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    // Slight sticker tilt from the mockup `.mk`
    transform: [{ rotate: '-1.5deg' }],
    alignSelf: 'flex-start',
  },
  markText: {
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -1.1,
    color: lightColors.nbInk,
    lineHeight: 32,
  },
  mq: {
    borderTopWidth: 3,
    height: 44,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  mqTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 18,
  },
  mqText: {
    fontSize: 15,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },
  diamond: {
    width: 12,
    height: 12,
    borderRadius: 3,
    marginLeft: 18,
    transform: [{ rotate: '45deg' }],
  },
  ringWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
