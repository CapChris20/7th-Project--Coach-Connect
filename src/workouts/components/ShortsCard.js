import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const TRANS_MS = 220;

function ytThumb(videoId) {
  // Shorts thumbnails still use the same endpoint; we just present them 9:16.
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function formatShortDuration(seconds) {
  const s = typeof seconds === 'number' ? seconds : null;
  if (!s || s <= 0) return 'Shorts';
  if (s < 60) return `${Math.max(1, Math.round(s))} sec • Shorts`;
  const m = Math.max(1, Math.round(s / 60));
  return `${m} min • Shorts`;
}

export default function ShortsCard({
  item,
  width = 110,
  accentGradient = ['#F97316', '#06B6D4'],
  isDark = true,
  onPress,
  saved = false,
  onToggleSave,
  style,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const height = useMemo(() => Math.round(width * 1.78), [width]); // ~9:16
  const durationText = useMemo(() => formatShortDuration(item?.durationSeconds), [item?.durationSeconds]);

  const animateTo = (down) => {
    setPressed(down);
    Animated.parallel([
      Animated.timing(scale, { toValue: down ? 1.02 : 1, duration: TRANS_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: down ? -2 : 0, duration: TRANS_MS, useNativeDriver: true }),
    ]).start();
  };

  const bg = isDark
    ? pressed
      ? 'rgba(255,255,255,0.08)'
      : 'rgba(255,255,255,0.04)'
    : pressed
      ? 'rgba(0,0,0,0.04)'
      : 'rgba(0,0,0,0.02)';
  const border = isDark ? (pressed ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)') : pressed ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(true)}
      onPressOut={() => animateTo(false)}
      style={[{ width }, style]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <View style={[styles.card, { height, backgroundColor: bg, borderColor: border }]}>
          <Image source={{ uri: ytThumb(item?.videoId) }} style={styles.image} contentFit="cover" transition={TRANS_MS} />

          {/* Bottom accent */}
          <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.accentBottom} />

          {/* Bookmark */}
          {onToggleSave ? (
            <Pressable
              onPress={(e) => {
                e?.stopPropagation?.();
                onToggleSave();
              }}
              hitSlop={10}
              style={styles.bookmarkBtn}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={14} color={saved ? '#FF6B9D' : '#FFFFFF'} />
            </Pressable>
          ) : null}

          {/* Scrim */}
          <LinearGradient
            colors={['rgba(0,0,0,0)', pressed ? 'rgba(0,0,0,0.90)' : 'rgba(0,0,0,0.82)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.scrim}
          />

          {/* Overlay text */}
          <View style={styles.overlay}>
            <Text style={styles.title} numberOfLines={1}>
              {item?.name || '—'}
            </Text>
            <Text style={styles.channel} numberOfLines={1}>
              {item?.channel || '—'}
            </Text>
            <Text style={styles.duration} numberOfLines={1}>
              {durationText}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  accentBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    opacity: 0.4,
  },
  bookmarkBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    zIndex: 10,
    opacity: 0.92,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 84,
    zIndex: 5,
  },
  overlay: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    zIndex: 8,
    gap: 2,
  },
  title: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  channel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.70)' },
  duration: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.55)' },
});

