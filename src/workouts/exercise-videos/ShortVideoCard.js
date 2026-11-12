// Journey / horizontal video thumb — play circle, duration badge, title under the card.
// Flow: press scales slightly → tap opens the video (parent onPress).
// Used by: ExerciseVideosTab "Pulled from your journey" carousel.
// Design Law: HardShadow + 3px border; black/white only (no purple rims).

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
// Manipulate here: journey card width / thumb aspect (taller than wide, like PNG)
const DEFAULT_WIDTH = 132;
const THUMB_ASPECT = 1.15;
// Manipulate here: play circle size — mockup journey uses ~40–52
const PLAY_SIZE = 40;

// ===== HELPER FUNCTIONS =====

/** YouTube hqdefault still from the 11-char watch id. */
function youtubeThumbUrl(videoId) {
  return `${YOUTUBE_THUMB_HOST}/${videoId}/hqdefault.jpg`;
}

/**
 * Badge text like "0:42". Missing duration → null (hide badge).
 * @param {number|undefined} seconds
 * @returns {string|null}
 */
function formatDurationBadge(seconds) {
  if (typeof seconds !== 'number' || seconds <= 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// ===== MAIN FUNCTION =====

/**
 * Compact vertical video card for the journey carousel.
 * @param {object} props
 */
export default function ShortVideoCard({
  item,
  width = DEFAULT_WIDTH,
  onPress,
  style,
}) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const thumbHeight = useMemo(() => Math.round(width * THUMB_ASPECT), [width]);
  const durationText = useMemo(
    () => formatDurationBadge(item?.durationSeconds),
    [item?.durationSeconds],
  );

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
      style={[{ width }, style]}
      accessibilityRole="button"
      accessibilityLabel={item?.name || FALLBACK_LABEL}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall}>
          <View
            style={[
              styles.thumb,
              {
                height: thumbHeight,
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSoft,
              },
            ]}
          >
            {/* Hatch shows through when the still is missing or still loading */}
            <HatchedThumbFill />
            {item?.videoId ? (
              <Image
                source={{ uri: youtubeThumbUrl(item.videoId) }}
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
          {item?.name || FALLBACK_LABEL}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

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
    width: PLAY_SIZE,
    height: PLAY_SIZE,
    borderRadius: PLAY_SIZE / 2,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Manipulate here: play triangle optical centering
  playIcon: { marginLeft: 2 },
  // Mockup `.du` uses radius 4 (not a pill)
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
