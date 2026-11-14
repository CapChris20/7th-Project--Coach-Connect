// Journey carousel thumb — tall play card with duration badge and title under it.
// Flow: press-in scales → tap opens detail (parent onPress) → YouTube still or hatch behind play.
// Used by: ExerciseVideosTab "Pulled from your journey" horizontal list.
// Design Law: HardShadow + 3px border; black/white/gray only (no purple rims).

import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import HatchedThumbFill from './HatchedThumbFill';

// ===== NAMED CONSTANTS =====

// Manipulate here: press feel — shorter = snappier; scale closer to 1 = subtler
const PRESS_ANIMATION_MS = 160;
const PRESS_SCALE_WHEN_DOWN = 0.97;
const PRESS_SCALE_AT_REST = 1;

const YOUTUBE_THUMB_HOST = 'https://i.ytimg.com/vi';
const YOUTUBE_THUMB_QUALITY = 'hqdefault.jpg';
const FALLBACK_TITLE_LABEL = '—';
const SECONDS_PER_MINUTE = 60;
const SECOND_PAD_WIDTH = 2;
const PLAY_ICON_SIZE = 16;
const TITLE_MAX_LINES = 2;

// Manipulate here: journey card width / thumb aspect (taller than wide, like PNG)
const DEFAULT_CARD_WIDTH = 132;
const THUMB_HEIGHT_RATIO = 1.15;

// Manipulate here: play circle size — mockup journey uses ~40–52
const PLAY_CIRCLE_SIZE = 40;

// ===== HELPER FUNCTIONS =====

/**
 * Public YouTube hqdefault still from the 11-char watch id.
 * @param {string} videoId
 * @returns {string}
 */
function buildYouTubeThumbnailUrl(videoId) {
  return `${YOUTUBE_THUMB_HOST}/${videoId}/${YOUTUBE_THUMB_QUALITY}`;
}

/**
 * Badge text like "0:42". Missing / zero duration → null (hide badge).
 * @param {number|undefined} seconds
 * @returns {string|null}
 */
function formatSecondsAsDurationBadge(seconds) {
  if (typeof seconds !== 'number' || seconds <= 0) return null;

  const wholeMinutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const leftoverSeconds = Math.round(seconds % SECONDS_PER_MINUTE);
  const paddedSeconds = String(leftoverSeconds).padStart(SECOND_PAD_WIDTH, '0');
  return `${wholeMinutes}:${paddedSeconds}`;
}

/**
 * Run the press scale animation to a target (down or rest).
 * vocab: useNativeDriver = animation runs on the UI thread
 * @param {Animated.Value} pressScale
 * @param {number} targetScale
 */
function animatePressScaleTo(pressScale, targetScale) {
  Animated.timing(pressScale, {
    toValue: targetScale,
    duration: PRESS_ANIMATION_MS,
    useNativeDriver: true,
  }).start();
}

/**
 * Centered play circle. Does not steal taps from the outer Pressable.
 */
function JourneyPlayCircle({ themeColors }) {
  const circleStyle = [
    styles.playCircle,
    {
      backgroundColor: themeColors.nbFill,
      borderColor: themeColors.nbBorder,
    },
  ];

  return (
    <View style={styles.playCenter} pointerEvents="none">
      <View style={circleStyle}>
        <Ionicons
          name="play"
          size={PLAY_ICON_SIZE}
          color={themeColors.nbOnFill}
          style={styles.playIcon}
        />
      </View>
    </View>
  );
}

/**
 * Thumb stack: hatch → optional image → play → optional duration chip.
 */
function JourneyThumbBlock({
  thumbHeightPixels,
  themeColors,
  thumbImageUri,
  durationBadgeText,
}) {
  const thumbBoxStyle = [
    styles.thumb,
    {
      height: thumbHeightPixels,
      borderColor: themeColors.nbBorder,
      backgroundColor: themeColors.nbSoft,
    },
  ];
  const showThumbImage = Boolean(thumbImageUri);
  const showDurationBadge = Boolean(durationBadgeText);
  const badgeBoxStyle = [styles.durationBadge, { backgroundColor: themeColors.nbFill }];
  const badgeTextStyle = [styles.durationText, { color: themeColors.nbOnFill }];

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
      <View style={thumbBoxStyle}>
        <HatchedThumbFill />
        {showThumbImage ? (
          <Image
            source={{ uri: thumbImageUri }}
            style={styles.image}
            contentFit="cover"
            transition={PRESS_ANIMATION_MS}
          />
        ) : null}
        <JourneyPlayCircle themeColors={themeColors} />
        {showDurationBadge ? (
          <View style={badgeBoxStyle}>
            <Text style={badgeTextStyle}>{durationBadgeText}</Text>
          </View>
        ) : null}
      </View>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Compact vertical video card for the journey carousel.
 * Flow: 1. theme + press scale  2. thumb size + duration  3. pressable chrome
 * @param {{ item: object, width?: number, onPress?: function, style?: object }} props
 */
export default function ShortVideoCard({
  item,
  width = DEFAULT_CARD_WIDTH,
  onPress,
  style,
}) {
  // 1. Theme + press scale (hook order frozen: theme → ref → memos).
  // vocab: useTheme = Design Law palette for light/dark
  const { colors: themeColors } = useTheme();
  const pressScale = useRef(new Animated.Value(PRESS_SCALE_AT_REST)).current;

  // 2. Thumb height from width × aspect; duration badge from seconds.
  // vocab: useMemo = keep the same number/string until deps change
  const thumbHeightPixels = useMemo(
    () => Math.round(width * THUMB_HEIGHT_RATIO),
    [width],
  );

  const durationBadgeText = useMemo(
    () => formatSecondsAsDurationBadge(item?.durationSeconds),
    [item?.durationSeconds],
  );

  // 3. Name display decisions before JSX.
  const exerciseTitle = item?.name || FALLBACK_TITLE_LABEL;
  const hasYouTubeId = Boolean(item?.videoId);
  let thumbImageUri = null;
  if (hasYouTubeId) {
    thumbImageUri = buildYouTubeThumbnailUrl(item.videoId);
  }
  const pressableStyle = [{ width }, style];
  const scaledCardStyle = { transform: [{ scale: pressScale }] };
  const titleStyle = [styles.title, { color: themeColors.nbInk }];

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animatePressScaleTo(pressScale, PRESS_SCALE_WHEN_DOWN)}
      onPressOut={() => animatePressScaleTo(pressScale, PRESS_SCALE_AT_REST)}
      style={pressableStyle}
      accessibilityRole="button"
      accessibilityLabel={exerciseTitle}
    >
      <Animated.View style={scaledCardStyle}>
        <JourneyThumbBlock
          thumbHeightPixels={thumbHeightPixels}
          themeColors={themeColors}
          thumbImageUri={thumbImageUri}
          durationBadgeText={durationBadgeText}
        />
        <Text style={titleStyle} numberOfLines={TITLE_MAX_LINES}>
          {exerciseTitle}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  thumb: {
    width: '100%',
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playCircle: {
    width: PLAY_CIRCLE_SIZE,
    height: PLAY_CIRCLE_SIZE,
    borderRadius: PLAY_CIRCLE_SIZE / 2,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 2 },
  durationBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
  title: {
    marginTop: 8,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    lineHeight: 17,
  },
});
