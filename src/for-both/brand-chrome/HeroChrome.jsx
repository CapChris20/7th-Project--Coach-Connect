// Shared Design Law brand chrome for the welcome stage and home heroes.
// Flow: faint grid wash → scrolling “One Day or Day One!” strip → gradient brand sticker / orbit rings.
// Used by HomeWelcomeHero and the LoginScreen welcome view.
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

const TAGLINE_COPY = 'One Day or Day One!';
// Manipulate here: marquee loop length (mockup GSAP duration 14s for half-width)
const MARQUEE_DURATION_MS = 14000;
// Manipulate here: how many tagline+diamond pairs sit in ONE half of the track
const MARQUEE_COPIES_PER_HALF = 8;
const GRID_CELL_SIZE_PX = 28;
const GRID_LINE_THICKNESS_PX = 1.5;
// Orbit ring timings from heroes.py mockup
const INNER_RING_ROTATION_MS = 28000;
const OUTER_RING_ROTATION_MS = 40000;
const WELCOME_LOGO_SIZE_PX = 182;
const INNER_RING_REFERENCE_PX = 140;
const FULL_CIRCLE_DEGREES = 360;
const OUTER_RING_OPACITY = 0.14;
const INNER_RING_OPACITY = 0.28;
const RING_STROKE_WIDTH_PX = 3;
const RING_INSET_PX = 6;
const OUTER_DASH_PATTERN = '10 12';
const INNER_DASH_PATTERN = '8 10';
const DEFAULT_GRID_OPACITY = 0.08;
const GRADIENT_DIAGONAL_START = { x: 0, y: 0 };
const GRADIENT_DIAGONAL_END = { x: 1, y: 1 };
const PATTERN_ID_RANDOM_SLICE_START = 2;
const PATTERN_ID_RANDOM_SLICE_END = 9;
const PATTERN_ID_BASE_RADIX = 36;

// ===== HELPER FUNCTIONS =====

function makeUniquePatternId(prefix) {
  const randomTail = Math.random()
    .toString(PATTERN_ID_BASE_RADIX)
    .slice(PATTERN_ID_RANDOM_SLICE_START, PATTERN_ID_RANDOM_SLICE_END);
  return `${prefix}_${randomTail}`;
}

function GridCellEdges({ lineColor }) {
  return (
    <>
      <Rect
        x={0}
        y={0}
        width={GRID_CELL_SIZE_PX}
        height={GRID_LINE_THICKNESS_PX}
        fill={lineColor}
      />
      <Rect
        x={0}
        y={0}
        width={GRID_LINE_THICKNESS_PX}
        height={GRID_CELL_SIZE_PX}
        fill={lineColor}
      />
    </>
  );
}

function MarqueeTaglineChunk({ textColor }) {
  return (
    <View style={styles.marqueeItem}>
      <Text style={[styles.marqueeText, { color: textColor }]}>{TAGLINE_COPY}</Text>
      <LinearGradient
        colors={HERO_ACCENT_GRADIENT}
        start={GRADIENT_DIAGONAL_START}
        end={GRADIENT_DIAGONAL_END}
        style={styles.diamond}
      />
    </View>
  );
}

function DashedOrbitCircle({ diameterPixels, strokeColor, dashPattern }) {
  const centerPoint = diameterPixels / 2;
  const radiusPixels = (diameterPixels - RING_INSET_PX) / 2;

  return (
    <Svg width={diameterPixels} height={diameterPixels}>
      <Circle
        cx={centerPoint}
        cy={centerPoint}
        r={radiusPixels}
        stroke={strokeColor}
        strokeWidth={RING_STROKE_WIDTH_PX}
        strokeDasharray={dashPattern}
        fill="none"
      />
    </Svg>
  );
}

function innerRingDiameterForLogo(logoSizePixels) {
  const scaleFromMockup = INNER_RING_REFERENCE_PX / WELCOME_LOGO_SIZE_PX;
  return Math.round(logoSizePixels * scaleFromMockup);
}

function buildMarqueeSegmentIndexes() {
  const totalChunks = MARQUEE_COPIES_PER_HALF * 2;
  const indexes = [];
  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    indexes.push(chunkIndex);
  }
  return indexes;
}

function buildMarqueeChunkElements(segmentIndexes, textColor) {
  const chunks = [];
  for (let index = 0; index < segmentIndexes.length; index += 1) {
    const segmentIndex = segmentIndexes[index];
    chunks.push(
      <MarqueeTaglineChunk
        key={`tag-${segmentIndex}`}
        textColor={textColor}
      />,
    );
  }
  return chunks;
}

function startEndlessLinearProgress(sharedProgress, durationMs) {
  sharedProgress.value = 0;
  sharedProgress.value = withRepeat(
    withTiming(1, { duration: durationMs, easing: Easing.linear }),
    -1,
    false,
  );
}

// ===== MAIN FUNCTION =====

/**
 * Neo-brutalist graph-paper wash behind welcome / home heroes.
 * Why SVG: RN Views cannot paint a clean repeating 28px grid without dozens of children.
 * @param {{ lineColor: string, opacity?: number, style?: object }} props
 */
export function FaintGrid({ lineColor, opacity = DEFAULT_GRID_OPACITY, style }) {
  const patternId = useMemo(() => makeUniquePatternId('heroGrid'), []);
  const patternFillUrl = `url(#${patternId})`;
  const layeredStyle = [StyleSheet.absoluteFill, style];

  return (
    <View pointerEvents="none" style={layeredStyle}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern
            id={patternId}
            patternUnits="userSpaceOnUse"
            width={GRID_CELL_SIZE_PX}
            height={GRID_CELL_SIZE_PX}
          >
            <GridCellEdges lineColor={lineColor} />
          </Pattern>
        </Defs>
        <Rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill={patternFillUrl}
          opacity={opacity}
        />
      </Svg>
    </View>
  );
}

/**
 * Small gradient sticker behind brand words — the only colorful chrome on the hero.
 * @param {{ children: React.ReactNode, style?: object, textStyle?: object, borderColor?: string }} props
 */
export function BrandHighlight({
  children,
  style,
  textStyle,
  borderColor = lightColors.nbInk,
}) {
  const stickerStyle = [styles.mark, { borderColor }, style];
  const labelStyle = [styles.markText, textStyle];

  return (
    <LinearGradient
      colors={HERO_ACCENT_GRADIENT}
      start={GRADIENT_DIAGONAL_START}
      end={GRADIENT_DIAGONAL_END}
      style={stickerStyle}
    >
      <Text style={labelStyle}>{children}</Text>
    </LinearGradient>
  );
}

/**
 * Scrolling italic tagline with gradient diamond separators (mockup `.mq`).
 * Why duplicate the row: seamless loop = translate by exactly half the measured width.
 * @param {{ textColor: string, borderColor: string }} props
 */
export function TaglineStrip({ textColor, borderColor }) {
  const marqueeProgress = useSharedValue(0);
  const [halfTrackWidthPixels, setHalfTrackWidthPixels] = useState(0);

  useEffect(() => {
    // 1. Wait until onLayout measured a real track.
    if (halfTrackWidthPixels <= 0) return undefined;

    // 2. Drive progress 0→1 forever; animated style multiplies by half width.
    startEndlessLinearProgress(marqueeProgress, MARQUEE_DURATION_MS);
    return undefined;
  }, [halfTrackWidthPixels, marqueeProgress]);

  const slidingTrackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -marqueeProgress.value * halfTrackWidthPixels }],
  }));

  const segmentIndexes = useMemo(() => buildMarqueeSegmentIndexes(), []);
  const marqueeChunks = buildMarqueeChunkElements(segmentIndexes, textColor);
  const stripBorderStyle = [styles.marqueeStrip, { borderTopColor: borderColor }];

  const rememberHalfTrackWidth = (layoutEvent) => {
    const trackWidthPixels = layoutEvent.nativeEvent.layout.width;
    if (trackWidthPixels <= 0) return;
    setHalfTrackWidthPixels(trackWidthPixels / 2);
  };

  return (
    <View style={stripBorderStyle}>
      <Animated.View
        style={[styles.marqueeTrack, slidingTrackStyle]}
        onLayout={rememberHalfTrackWidth}
      >
        {marqueeChunks}
      </Animated.View>
    </View>
  );
}

/**
 * Two concentric dashed rings that rotate opposite ways (28s / 40s in the HTML mockup).
 * @param {{ color: string, size?: number }} props
 */
export function OrbitRings({ color, size = WELCOME_LOGO_SIZE_PX }) {
  const innerRingSpin = useSharedValue(0);
  const outerRingSpin = useSharedValue(0);

  useEffect(() => {
    // 1. Inner ring spins one way (faster period from heroes.py).
    // Manipulate here: ring periods — match heroes.py (28s inner, 40s outer)
    startEndlessLinearProgress(innerRingSpin, INNER_RING_ROTATION_MS);

    // 2. Outer ring spins the opposite way (slower).
    startEndlessLinearProgress(outerRingSpin, OUTER_RING_ROTATION_MS);
  }, [innerRingSpin, outerRingSpin]);

  const outerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${outerRingSpin.value * FULL_CIRCLE_DEGREES}deg` }],
  }));
  const innerRingStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-innerRingSpin.value * FULL_CIRCLE_DEGREES}deg` }],
  }));

  const innerDiameterPixels = innerRingDiameterForLogo(size);
  const innerOffsetPixels = (size - innerDiameterPixels) / 2;
  const wrapperSizeStyle = [styles.ringWrap, { width: size, height: size }];
  const outerLayerStyle = [
    StyleSheet.absoluteFill,
    outerRingStyle,
    { opacity: OUTER_RING_OPACITY },
  ];
  const innerLayerStyle = [
    {
      position: 'absolute',
      left: innerOffsetPixels,
      top: innerOffsetPixels,
      width: innerDiameterPixels,
      height: innerDiameterPixels,
      opacity: INNER_RING_OPACITY,
    },
    innerRingStyle,
  ];

  return (
    <View style={wrapperSizeStyle} pointerEvents="none">
      <Animated.View style={outerLayerStyle}>
        <DashedOrbitCircle
          diameterPixels={size}
          strokeColor={color}
          dashPattern={OUTER_DASH_PATTERN}
        />
      </Animated.View>
      <Animated.View style={innerLayerStyle}>
        <DashedOrbitCircle
          diameterPixels={innerDiameterPixels}
          strokeColor={color}
          dashPattern={INNER_DASH_PATTERN}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    borderWidth: nb.borderWidth,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
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
  marqueeStrip: {
    borderTopWidth: 3,
    height: 44,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  marqueeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  marqueeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 18,
  },
  marqueeText: {
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
