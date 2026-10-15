// One horizontal exercise tile: YouTube thumb, title, instructor initials, difficulty or duration.
// Flow: press-in scales the card up → press-out snaps back; tap opens the video; bookmark is optional.
// Used by the exercise-video list. Dark vs light inner colors follow colors.background.

import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

const PRESS_ANIMATION_MS = 220;
const DEFAULT_RIM = ['#FF6B9D', '#C2410C'];
const PRESS_SCALE = 1.02;
const PRESS_LIFT_Y = -2;
const MIN_GRADIENT_STOPS = 2;
const DARK_BACKGROUND = '#0a0a0f';
const YOUTUBE_THUMB_HOST = 'https://i.ytimg.com/vi';
const FALLBACK_LABEL = '—';
const FALLBACK_INITIALS = 'CC';
const MAX_INITIAL_WORDS = 2;
const BOOKMARK_HIT_SLOP = 10;
const SAVED_BOOKMARK_COLOR = '#FF6B9D';
const UNSAVED_BOOKMARK_COLOR = '#FFFFFF';

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
 * "Beginner • 12 min" — whichever pieces exist, joined with a bullet.
 * @param {object} exercise
 * @returns {string}
 */
function formatExerciseMeta(exercise) {
  const difficulty = exercise?.difficulty ? String(exercise.difficulty) : null;
  const minutes =
    typeof exercise?.durationMinutes === 'number' ? `${exercise.durationMinutes} min` : null;
  return [difficulty, minutes].filter(Boolean).join(' • ');
}

/**
 * First letter of the first two words of the channel name. Empty channel → "CC".
 * @param {string|undefined} channel
 * @returns {string}
 */
function initialsFromChannel(channel) {
  const channelName = String(channel || '').trim();
  if (!channelName) return FALLBACK_INITIALS;
  const words = channelName.split(/\s+/).filter(Boolean).slice(0, MAX_INITIAL_WORDS);
  const initials = words.map((word) => word.slice(0, 1).toUpperCase()).join('');
  return initials || FALLBACK_INITIALS;
}

/**
 * A one-stop array would crash LinearGradient, so fall back to the pink/orange rim.
 * @param {string[]|undefined} accentGradient
 * @returns {string[]}
 */
function rimColors(accentGradient) {
  return accentGradient?.length >= MIN_GRADIENT_STOPS ? accentGradient : DEFAULT_RIM;
}

function isDarkBackground(colors) {
  return (colors?.background || '').toLowerCase() === DARK_BACKGROUND;
}

// ===== MAIN FUNCTION =====

/**
 * Exercise video card with a gradient rim, thumbnail, instructor row, and optional bookmark.
 * @param {object} props
 */
export default function ExerciseCard({
  exercise,
  colors,
  accentGradient = DEFAULT_RIM,
  imageHeight = 132,
  onPress,
  saved = false,
  onToggleSave,
  style,
}) {
  // vocab: Animated.Value = a number the native driver can tween without bouncing through JS.
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);

  const metaText = useMemo(
    () => formatExerciseMeta(exercise),
    [exercise?.difficulty, exercise?.durationMinutes],
  );

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

  const isDark = isDarkBackground(colors);
  const innerBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const channelColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.62)';
  const metaColor = isDark ? 'rgba(255,255,255,0.48)' : 'rgba(10,10,15,0.48)';
  const rim = rimColors(accentGradient);

  const instructorInitials = useMemo(
    () => initialsFromChannel(exercise?.channel),
    [exercise?.channel],
  );

  const difficulty = exercise?.difficulty ? String(exercise.difficulty) : null;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateToPressed(true)}
      onPressOut={() => animateToPressed(false)}
      style={[styles.press, style]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rim}>
          <View style={[styles.card, { backgroundColor: innerBg }]}>
            <View style={[styles.imageWrap, { height: imageHeight }]}>
              <Image
                source={{ uri: youtubeThumbUrl(exercise.videoId) }}
                style={styles.image}
                contentFit="cover"
                transition={PRESS_ANIMATION_MS}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {onToggleSave ? (
                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    onToggleSave();
                  }}
                  hitSlop={BOOKMARK_HIT_SLOP}
                  style={styles.saveBtn}
                >
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={16}
                    color={saved ? SAVED_BOOKMARK_COLOR : UNSAVED_BOOKMARK_COLOR}
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.body}>
              <Text style={[styles.title, { color: colors?.text || '#FFFFFF' }]} numberOfLines={2}>
                {exercise?.name || FALLBACK_LABEL}
              </Text>

              <View style={styles.instructorRow}>
                <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGrad}>
                  <View style={[styles.avatarInner, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' }]}>
                    <Text style={[styles.avatarText, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>
                      {instructorInitials}
                    </Text>
                  </View>
                </LinearGradient>
                <Text style={[styles.instructor, { color: channelColor }]} numberOfLines={1}>
                  {exercise?.channel || FALLBACK_LABEL}
                </Text>
              </View>

              {difficulty ? (
                <LinearGradient
                  colors={[`${rim[0]}22`, `${rim[1] ?? rim[0]}14`]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.diffChip}
                >
                  <Text style={[styles.diffText, { color: rim[0] }]}>{difficulty}</Text>
                </LinearGradient>
              ) : metaText ? (
                <Text style={[styles.meta, { color: metaColor }]} numberOfLines={1}>
                  {metaText}
                </Text>
              ) : null}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  rim: {
    borderRadius: 16,
    padding: 1.5,
  },
  card: {
    borderRadius: 14.5,
    overflow: 'hidden',
  },
  imageWrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  image: { width: '100%', height: '100%' },
  saveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
  },
  title: { fontSize: 13, fontWeight: '800', lineHeight: 18, letterSpacing: -0.2 },
  instructorRow: { flexDirection: 'row', alignItems: 'center' },
  avatarGrad: { width: 22, height: 22, borderRadius: 11, padding: 1, marginRight: 7 },
  avatarInner: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 9, fontWeight: '900' },
  instructor: { flex: 1, fontSize: 11, fontWeight: '700' },
  meta: { fontSize: 10, fontWeight: '700' },
  diffChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  diffText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
});
