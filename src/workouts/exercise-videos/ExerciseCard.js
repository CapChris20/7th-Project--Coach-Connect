// Results-grid video card — YouTube thumb (or hatch), play circle, duration, title, equipment pill.
// Flow: press scales the card → tap calls parent onPress (opens the detail player).
// Used by: ExerciseVideosTab library results (2-column grid).
// Design Law: HardShadow + 3px border; equipment as a neutral mini tag.

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
const FALLBACK_TITLE = '—';
const DEFAULT_THUMB_HEIGHT = 118;
const SECONDS_PER_MINUTE = 60;
const SECOND_PAD_WIDTH = 2;
const PLAY_ICON_SIZE = 16;
const TITLE_MAX_LINES = 2;
const EQUIPMENT_MAX_LINES = 1;

// Manipulate here: grid play circle (mockup grid uses ~40)
const PLAY_CIRCLE_SIZE = 40;

// ===== HELPER FUNCTIONS =====

/**
 * Build the public YouTube still URL for an 11-char video id.
 * @param {string} videoId
 * @returns {string}
 */
function buildYoutubeThumbnailUrl(videoId) {
  return `${YOUTUBE_THUMB_HOST}/${videoId}/${YOUTUBE_THUMB_QUALITY}`;
}

/**
 * Badge text like "0:48". Missing / zero duration → null (hide the badge).
 * Prefers durationSeconds; falls back to whole durationMinutes as "N:00".
 * @param {number|undefined} durationSeconds
 * @param {number|undefined} durationMinutes
 * @returns {string|null}
 */
function formatDurationBadgeLabel(durationSeconds, durationMinutes) {
  const hasSeconds = typeof durationSeconds === 'number' && durationSeconds > 0;
  if (hasSeconds) {
    return formatSecondsAsMinuteColonSecond(durationSeconds);
  }

  const hasMinutes = typeof durationMinutes === 'number' && durationMinutes > 0;
  if (hasMinutes) {
    return `${durationMinutes}:00`;
  }

  return null;
}

/**
 * Read equipment text from either `equipment` or `equipmentHint` on the exercise row.
 * @param {object|undefined} exercise
 * @returns {string|null}
 */
function readEquipmentLabelFromExercise(exercise) {
  const equipmentRaw = exercise?.equipment || exercise?.equipmentHint;
  if (!equipmentRaw) return null;
  return String(equipmentRaw);
}

/**
 * Scale the card on press-in / press-out. Native driver keeps this off the JS thread.
 * vocab: useNativeDriver = RN runs the animation on the UI thread (smoother)
 * @param {Animated.Value} scaleAnimatedValue
 * @param {boolean} fingerIsDown
 */
function animateCardPressScale(scaleAnimatedValue, fingerIsDown) {
  let targetScale = PRESS_SCALE_AT_REST;
  if (fingerIsDown) {
    targetScale = PRESS_SCALE_WHEN_DOWN;
  }
  Animated.timing(scaleAnimatedValue, {
    toValue: targetScale,
    duration: PRESS_ANIMATION_MS,
    useNativeDriver: true,
  }).start();
}

/**
 * Play circle centered on the thumb. pointerEvents none so presses hit the Pressable.
 */
function PlayCircleOverlay({ themeColors }) {
  const playCircleStyle = [
    cardStyles.playCircle,
    {
      backgroundColor: themeColors.nbFill,
      borderColor: themeColors.nbBorder,
    },
  ];

  return (
    <View style={cardStyles.playCenter} pointerEvents="none">
      <View style={playCircleStyle}>
        <Ionicons
          name="play"
          size={PLAY_ICON_SIZE}
          color={themeColors.nbOnFill}
          style={cardStyles.playIcon}
        />
      </View>
    </View>
  );
}

/**
 * Bottom-right duration chip on the thumb (e.g. "1:05").
 */
function DurationBadge({ badgeText, themeColors }) {
  const badgeBoxStyle = [cardStyles.durationBadge, { backgroundColor: themeColors.nbFill }];
  const badgeTextStyle = [cardStyles.durationText, { color: themeColors.nbOnFill }];

  return (
    <View style={badgeBoxStyle}>
      <Text style={badgeTextStyle}>{badgeText}</Text>
    </View>
  );
}

/**
 * Thumb: hatch fill → optional YouTube image → play → optional duration.
 */
function ExerciseThumbBlock({
  thumbHeightPixels,
  themeColors,
  youtubeImageUri,
  durationBadgeText,
}) {
  const thumbBoxStyle = [
    cardStyles.thumb,
    {
      height: thumbHeightPixels,
      borderColor: themeColors.nbBorder,
      backgroundColor: themeColors.nbSoft,
    },
  ];
  const showYoutubeImage = Boolean(youtubeImageUri);
  const showDurationBadge = Boolean(durationBadgeText);

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
      <View style={thumbBoxStyle}>
        <HatchedThumbFill />
        {showYoutubeImage ? (
          <Image
            source={{ uri: youtubeImageUri }}
            style={cardStyles.image}
            contentFit="cover"
            transition={PRESS_ANIMATION_MS}
          />
        ) : null}
        <PlayCircleOverlay themeColors={themeColors} />
        {showDurationBadge ? (
          <DurationBadge badgeText={durationBadgeText} themeColors={themeColors} />
        ) : null}
      </View>
    </HardShadow>
  );
}

/**
 * Title under the thumb, plus optional equipment pill.
 */
function TitleAndEquipmentRow({ cardTitle, equipmentLabel, themeColors }) {
  const titleStyle = [cardStyles.title, { color: themeColors.nbInk }];
  const showEquipmentPill = Boolean(equipmentLabel);

  if (!showEquipmentPill) {
    return (
      <Text style={titleStyle} numberOfLines={TITLE_MAX_LINES}>
        {cardTitle}
      </Text>
    );
  }

  const pillBoxStyle = [
    cardStyles.equipPill,
    { borderColor: themeColors.nbBorder, backgroundColor: themeColors.nbSoft },
  ];
  const pillTextStyle = [cardStyles.equipText, { color: themeColors.nbInk }];

  return (
    <>
      <Text style={titleStyle} numberOfLines={TITLE_MAX_LINES}>
        {cardTitle}
      </Text>
      <View style={pillBoxStyle}>
        <Text style={pillTextStyle} numberOfLines={EQUIPMENT_MAX_LINES}>
          {equipmentLabel}
        </Text>
      </View>
    </>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One library-grid exercise card. Parent owns navigation (onPress).
 * Flow: 1. theme + press scale  2. duration / equipment labels  3. pressable card chrome
 * @param {{ exercise: object, imageHeight?: number, onPress?: function, style?: object }} props
 */
export default function ExerciseCard({
  exercise,
  imageHeight = DEFAULT_THUMB_HEIGHT,
  onPress,
  style,
  colors: deprecatedColors,
  accentGradient: deprecatedAccentGradient,
  saved: deprecatedSavedFlag,
  onToggleSave: deprecatedOnToggleSave,
}) {
  // Old callers still pass these; we ignore them so the Design Law card stays black/white/gray.
  void deprecatedColors;
  void deprecatedAccentGradient;
  void deprecatedSavedFlag;
  void deprecatedOnToggleSave;

  // 1. Theme colors + a scale value that does not re-render every animation frame.
  // vocab: useTheme = Design Law light/dark palette for this screen
  // vocab: useRef(Animated.Value) = hold scale without setState on every frame
  const { colors: themeColors } = useTheme();
  const pressScale = useRef(new Animated.Value(PRESS_SCALE_AT_REST)).current;

  // 2. Memoize badge + equipment so we only recompute when those fields change.
  // vocab: useMemo = keep the same string until the listed deps change
  const durationBadgeText = useMemo(
    () => formatDurationBadgeLabel(exercise?.durationSeconds, exercise?.durationMinutes),
    [exercise?.durationSeconds, exercise?.durationMinutes],
  );

  const equipmentLabel = useMemo(
    () => readEquipmentLabelFromExercise(exercise),
    [exercise?.equipment, exercise?.equipmentHint],
  );

  // 3. Name the display decisions before JSX.
  const cardTitle = exercise?.name || FALLBACK_TITLE;
  const hasYoutubeThumb = Boolean(exercise?.videoId);
  const youtubeImageUri = hasYoutubeThumb
    ? buildYoutubeThumbnailUrl(exercise.videoId)
    : null;
  const pressableStyle = [cardStyles.press, style];
  const scaledCardStyle = { transform: [{ scale: pressScale }] };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateCardPressScale(pressScale, true)}
      onPressOut={() => animateCardPressScale(pressScale, false)}
      style={pressableStyle}
      accessibilityRole="button"
      accessibilityLabel={cardTitle}
    >
      <Animated.View style={scaledCardStyle}>
        <ExerciseThumbBlock
          thumbHeightPixels={imageHeight}
          themeColors={themeColors}
          youtubeImageUri={youtubeImageUri}
          durationBadgeText={durationBadgeText}
        />
        <TitleAndEquipmentRow
          cardTitle={cardTitle}
          equipmentLabel={equipmentLabel}
          themeColors={themeColors}
        />
      </Animated.View>
    </Pressable>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Turn total seconds into "M:SS" for the corner badge.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatSecondsAsMinuteColonSecond(totalSeconds) {
  const wholeMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const leftoverSeconds = Math.round(totalSeconds % SECONDS_PER_MINUTE);
  const paddedSeconds = String(leftoverSeconds).padStart(SECOND_PAD_WIDTH, '0');
  return `${wholeMinutes}:${paddedSeconds}`;
}

const cardStyles = StyleSheet.create({
  press: { width: '100%' },
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
  equipPill: {
    alignSelf: 'flex-start',
    marginTop: 6,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: nb.borderWidthPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
});
