import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TRANS_MS = 220;

function ytThumb(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export default function ExerciseCard({
  exercise,
  colors,
  accentGradient,
  accentPlacement = 'left', // 'left' | 'bottom'
  imageHeight = 140,
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
  const cardBg = isDark
    ? pressed
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(255,255,255,0.04)'
    : pressed
      ? 'rgba(0,0,0,0.04)'
      : 'rgba(0,0,0,0.02)';
  const border = isDark ? (pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)') : pressed ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)';
  const channelColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const metaColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)';

  const instructorInitials = useMemo(() => {
    const ch = String(exercise?.channel || '').trim();
    if (!ch) return 'CC';
    const parts = ch.split(/\s+/).filter(Boolean).slice(0, 2);
    const ini = parts.map((p) => p.slice(0, 1).toUpperCase()).join('');
    return ini || 'CC';
  }, [exercise?.channel]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(true)}
      onPressOut={() => animateTo(false)}
      style={[styles.press, style]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <View style={[styles.card, { borderColor: border, backgroundColor: cardBg }]}>
          {accentPlacement === 'left' ? (
            <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.accentLeft} />
          ) : (
            <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBottom} />
          )}

          <View style={[styles.imageWrap, { height: imageHeight }]}>
            <Image source={{ uri: ytThumb(exercise.videoId) }} style={styles.image} contentFit="cover" transition={TRANS_MS} />
            <LinearGradient colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.18)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            {onToggleSave ? (
              <Pressable
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onToggleSave();
                }}
                hitSlop={10}
                style={styles.saveBtn}
              >
                <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? '#FF6B9D' : '#FFFFFF'} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.body}>
            <Text style={[styles.title, { color: colors?.text || '#FFFFFF' }]} numberOfLines={2}>
              {exercise?.name || '—'}
            </Text>

            <View style={styles.instructorRow}>
              <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarGrad}>
                <View style={styles.avatarInner}>
                  <Text style={styles.avatarText}>{instructorInitials}</Text>
                </View>
              </LinearGradient>
              <Text style={[styles.instructor, { color: channelColor }]} numberOfLines={1}>
                {exercise?.channel || '—'}
              </Text>
            </View>

            <Text style={[styles.meta, { color: metaColor }]} numberOfLines={1}>
              {metaText || '—'}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { width: '100%' },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  accentLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 2,
    opacity: 0.3,
    zIndex: 2,
  },
  accentBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    opacity: 0.3,
    zIndex: 2,
  },
  imageWrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.02)',
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
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  body: {
    padding: 12,
    paddingTop: 12,
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '900', lineHeight: 20 },
  instructorRow: { flexDirection: 'row', alignItems: 'center' },
  avatarGrad: { width: 24, height: 24, borderRadius: 12, padding: 1.5, marginRight: 8 },
  avatarInner: { flex: 1, borderRadius: 10.5, backgroundColor: 'rgba(0,0,0,0.30)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },
  instructor: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
});

