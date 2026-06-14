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

const TRANS_MS = 220;
const DEFAULT_RIM = ['#FF6B9D', '#C2410C'];

function ytThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

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
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const metaText = useMemo(() => {
    const diff = exercise?.difficulty ? String(exercise.difficulty) : null;
    const mins = typeof exercise?.durationMinutes === 'number' ? `${exercise.durationMinutes} min` : null;
    return [diff, mins].filter(Boolean).join(' • ');
  }, [exercise?.difficulty, exercise?.durationMinutes]);

  const animateTo = (down) => {
    setPressed(down);
    Animated.parallel([
      Animated.timing(scale, { toValue: down ? 1.02 : 1, duration: TRANS_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: down ? -2 : 0, duration: TRANS_MS, useNativeDriver: true }),
    ]).start();
  };

  const isDark = (colors?.background || '').toLowerCase() === '#0a0a0f';
  const innerBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const channelColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.62)';
  const metaColor = isDark ? 'rgba(255,255,255,0.48)' : 'rgba(10,10,15,0.48)';
  const rim = accentGradient?.length >= 2 ? accentGradient : DEFAULT_RIM;

  const instructorInitials = useMemo(() => {
    const ch = String(exercise?.channel || '').trim();
    if (!ch) return 'CC';
    const parts = ch.split(/\s+/).filter(Boolean).slice(0, 2);
    const ini = parts.map((p) => p.slice(0, 1).toUpperCase()).join('');
    return ini || 'CC';
  }, [exercise?.channel]);

  const difficulty = exercise?.difficulty ? String(exercise.difficulty) : null;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(true)}
      onPressOut={() => animateTo(false)}
      style={[styles.press, style]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.rim}>
          <View style={[styles.card, { backgroundColor: innerBg }]}>
            <View style={[styles.imageWrap, { height: imageHeight }]}>
              <Image source={{ uri: ytThumb(exercise.videoId) }} style={styles.image} contentFit="cover" transition={TRANS_MS} />
              <LinearGradient colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.45)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
              {onToggleSave ? (
                <Pressable
                  onPress={(e) => {
                    e?.stopPropagation?.();
                    onToggleSave();
                  }}
                  hitSlop={10}
                  style={styles.saveBtn}
                >
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? '#FF6B9D' : '#FFFFFF'} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.body}>
              <Text style={[styles.title, { color: colors?.text || '#FFFFFF' }]} numberOfLines={2}>
                {exercise?.name || '—'}
              </Text>

              <View style={styles.instructorRow}>
                <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGrad}>
                  <View style={[styles.avatarInner, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF' }]}>
                    <Text style={[styles.avatarText, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>{instructorInitials}</Text>
                  </View>
                </LinearGradient>
                <Text style={[styles.instructor, { color: channelColor }]} numberOfLines={1}>
                  {exercise?.channel || '—'}
                </Text>
              </View>

              {difficulty ? (
                <LinearGradient colors={[`${rim[0]}22`, `${rim[1] ?? rim[0]}14`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.diffChip}>
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
