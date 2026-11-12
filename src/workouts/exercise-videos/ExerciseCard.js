// Results-grid video card — thumb with play + duration, title, equipment pill.
// Flow: press scales → tap opens detail player (parent onPress).
// Used by: ExerciseVideosTab library results (2-column grid).
// Design Law: HardShadow + 3px border; equipment as neutral Nb-style mini tag.

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

const PRESS_ANIMATION_MS = 160;
const PRESS_SCALE = 0.97;
const YOUTUBE_THUMB_HOST = 'https://i.ytimg.com/vi';
const FALLBACK_LABEL = '—';
const DEFAULT_IMAGE_HEIGHT = 118;
// Manipulate here: grid play circle (mockup grid uses ~40)
const PLAY_SIZE = 40;

// ===== HELPER FUNCTIONS =====

function youtubeThumbUrl(videoId) {
  return `${YOUTUBE_THUMB_HOST}/${videoId}/hqdefault.jpg`;
}

/**
 * Badge text like "0:48". Missing duration → null.
 * @param {number|undefined} seconds
 * @param {number|undefined} minutes
 * @returns {string|null}
 */
function formatDurationBadge(seconds, minutes) {
  if (typeof seconds === 'number' && seconds > 0) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${String(secs).padStart(2, '0')}`;
  }
  if (typeof minutes === 'number' && minutes > 0) {
    return `${minutes}:00`;
  }
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * Library result card with equipment tag under the title.
 * @param {object} props
 */
export default function ExerciseCard({
  exercise,
  imageHeight = DEFAULT_IMAGE_HEIGHT,
  onPress,
  style,
  // Kept so older call sites do not crash; Design Law cards ignore these.
  colors: _deprecatedColors,
  accentGradient: _deprecatedAccent,
  saved: _deprecatedSaved,
  onToggleSave: _deprecatedSave,
}) {
  void _deprecatedColors;
  void _deprecatedAccent;
  void _deprecatedSaved;
  void _deprecatedSave;

  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const durationText = useMemo(
    () => formatDurationBadge(exercise?.durationSeconds, exercise?.durationMinutes),
    [exercise?.durationSeconds, exercise?.durationMinutes],
  );

  const equipmentLabel = useMemo(() => {
    const raw = exercise?.equipment || exercise?.equipmentHint;
    return raw ? String(raw) : null;
  }, [exercise?.equipment, exercise?.equipmentHint]);

  const animatePress = (down) => {
    Animated.timing(scale, {
      toValue: down ? PRESS_SCALE : 1,
      duration: PRESS_ANIMATION_MS,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animatePress(true)}
      onPressOut={() => animatePress(false)}
      style={[styles.press, style]}
      accessibilityRole="button"
      accessibilityLabel={exercise?.name || FALLBACK_LABEL}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
          <View
            style={[
              styles.thumb,
              {
                height: imageHeight,
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSoft,
              },
            ]}
          >
            <HatchedThumbFill />
            {exercise?.videoId ? (
              <Image
                source={{ uri: youtubeThumbUrl(exercise.videoId) }}
                style={styles.image}
                contentFit="cover"
                transition={PRESS_ANIMATION_MS}
              />
            ) : null}
            <View style={styles.playCenter} pointerEvents="none">
              <View
                style={[
                  styles.playCircle,
                  {
                    backgroundColor: colors.nbFill,
                    borderColor: colors.nbBorder,
                  },
                ]}
              >
                <Ionicons name="play" size={16} color={colors.nbOnFill} style={styles.playIcon} />
              </View>
            </View>
            {durationText ? (
              <View style={[styles.durationBadge, { backgroundColor: colors.nbFill }]}>
                <Text style={[styles.durationText, { color: colors.nbOnFill }]}>{durationText}</Text>
              </View>
            ) : null}
          </View>
        </HardShadow>

        <Text style={[styles.title, { color: colors.nbInk }]} numberOfLines={2}>
          {exercise?.name || FALLBACK_LABEL}
        </Text>

        {equipmentLabel ? (
          <View
            style={[
              styles.equipPill,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft },
            ]}
          >
            <Text style={[styles.equipText, { color: colors.nbInk }]} numberOfLines={1}>
              {equipmentLabel}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: { marginLeft: 2 },
  // Mockup `.du` — square-ish radius 4, fill ink
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
  // Mockup `.mini` — soft fill, radius 6, 2.5px border (not a full pill)
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
