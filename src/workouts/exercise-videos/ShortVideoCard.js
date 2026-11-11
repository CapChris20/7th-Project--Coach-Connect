// One vertical "Shorts" tile: YouTube thumb, title, channel, duration chip, optional bookmark.
// Flow: press-in scales the card up → overlay darkens → press-out snaps back; tap opens the video.
// Used by the exercise-video grid. Bookmark is omitted unless the parent passes onToggleSave.
//
// vocab: neobrutalist = thick outlines (2.5px), hard shadows (no blur), offset 4/4
// Manipulate here: card border radius (16), press scale (1.02), animation duration (220ms)

import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const PRESS_ANIMATION_MS = 220;
const SECONDS_PER_MINUTE = 60;
const SHORTS_ASPECT_RATIO = 1.78;
const PRESS_SCALE = 1.02;
const PRESS_LIFT_Y = -2;
const MIN_GRADIENT_STOPS = 2;
const YOUTUBE_THUMB_HOST = 'https://i.ytimg.com/vi';
const FALLBACK_LABEL = '—';
const BOOKMARK_HIT_SLOP = 10;

// ===== HELPER FUNCTIONS =====

/**
 * YouTube's standard hqdefault still. videoId is the 11-char watch id, not a full URL.
 * @param {string} videoId
 * @returns {string}
 */
function youtubeThumbUrl(videoId) {
  return `${YOUTUBE_THUMB_HOST}/${videoId}/hqdefault.jpg`;
}

/**
 * Under a minute shows seconds; a minute or more shows minutes. Missing time shows "Shorts".
 * @param {number|undefined} seconds
 * @returns {string}
 */
function formatShortDuration(seconds) {
  const durationSeconds = typeof seconds === 'number' ? seconds : null;
  if (!durationSeconds || durationSeconds <= 0) return 'Shorts';
  if (durationSeconds < SECONDS_PER_MINUTE) {
    return `${Math.max(1, Math.round(durationSeconds))} sec`;
  }
  const durationMinutes = Math.max(1, Math.round(durationSeconds / SECONDS_PER_MINUTE));
  return `${durationMinutes} min`;
}

/**
 * A one-stop array would crash LinearGradient, so fall back to the brand gradient.
 * @param {string[]|undefined} accentGradient
 * @returns {string[]}
 */
function rimColors(accentGradient) {
  return accentGradient?.length >= MIN_GRADIENT_STOPS ? accentGradient : gradients.brand.colors;
}

// ===== MAIN FUNCTION =====

/**
 * Vertical shorts card with a gradient rim, YouTube thumbnail, and optional bookmark.
 * @param {object} props
 */
export default function ShortVideoCard({
  item,
  width = 110,
  accentGradient,
  isDark: deprecatedIsDark,
  onPress,
  saved = false,
  onToggleSave,
  style,
}) {
  // vocab: Animated.Value = a number the native driver can tween without bouncing through JS.
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);

  const height = useMemo(() => Math.round(width * SHORTS_ASPECT_RATIO), [width]);
  const durationText = useMemo(
    () => formatShortDuration(item?.durationSeconds),
    [item?.durationSeconds],
  );
  const rim = rimColors(accentGradient);

  const animateToPressed = (isFingerDown) => {
    setIsPressed(isFingerDown);
    Animated.parallel([
      Animated.timing(scale, {
        toValue: isFingerDown ? PRESS_SCALE : 1,
        duration: PRESS_ANIMATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: isFingerDown ? PRESS_LIFT_Y : 0,
        duration: PRESS_ANIMATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateToPressed(true)}
      onPressOut={() => animateToPressed(false)}
      style={[{ width }, style]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <NbCard style={{ height, padding: 0 }}>
          <Image
            source={{ uri: youtubeThumbUrl(item?.videoId) }}
            style={styles.image}
            contentFit="cover"
            transition={PRESS_ANIMATION_MS}
          />

          {onToggleSave ? (
            <Pressable
              onPress={(event) => {
                event?.stopPropagation?.();
                onToggleSave();
              }}
              hitSlop={BOOKMARK_HIT_SLOP}
              style={styles.bookmarkBtn}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={14}
                color={saved ? gradients.brand.colors[0] : colors.nbSurface}
              />
            </Pressable>
          ) : null}

          <LinearGradient
            colors={['rgba(0,0,0,0)', isPressed ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.78)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.scrim}
          />

          <View style={styles.overlay}>
            <Text style={styles.title} numberOfLines={2}>
              {item?.name || FALLBACK_LABEL}
            </Text>
            <Text style={styles.channel} numberOfLines={1}>
              {item?.channel || FALLBACK_LABEL}
            </Text>
            <View style={styles.durationRow}>
              <LinearGradient
                colors={rim}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.durationChip}
              >
                <Text style={styles.duration} numberOfLines={1}>
                  {durationText}
                </Text>
              </LinearGradient>
            </View>
          </View>
        </NbCard>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: '100%' },
  bookmarkBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    zIndex: 10,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    zIndex: 5,
  },
  overlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 8,
    gap: 3,
  },
  title: { fontSize: 12, fontFamily: 'SpaceGrotesk_700Bold', color: '#FFFFFF', lineHeight: 16 },
  channel: { fontSize: 10, fontFamily: 'Inter_500Medium', color: 'rgba(255,255,255,0.72)' },
  durationRow: { marginTop: 2 },
  durationChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  duration: { fontSize: 9, fontFamily: 'SpaceGrotesk_700Bold', color: '#FFFFFF', letterSpacing: 0.3 },
});
