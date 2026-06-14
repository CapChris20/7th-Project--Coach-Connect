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

function formatShortDuration(seconds) {
  const s = typeof seconds === 'number' ? seconds : null;
  if (!s || s <= 0) return 'Shorts';
  if (s < 60) return `${Math.max(1, Math.round(s))} sec`;
  const m = Math.max(1, Math.round(s / 60));
  return `${m} min`;
}

export default function ShortsCard({
  item,
  width = 110,
  accentGradient = DEFAULT_RIM,
  isDark = true,
  onPress,
  saved = false,
  onToggleSave,
  style,
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [pressed, setPressed] = useState(false);

  const height = useMemo(() => Math.round(width * 1.78), [width]);
  const durationText = useMemo(() => formatShortDuration(item?.durationSeconds), [item?.durationSeconds]);
  const rim = accentGradient?.length >= 2 ? accentGradient : DEFAULT_RIM;

  const animateTo = (down) => {
    setPressed(down);
    Animated.parallel([
      Animated.timing(scale, { toValue: down ? 1.02 : 1, duration: TRANS_MS, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: down ? -2 : 0, duration: TRANS_MS, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(true)}
      onPressOut={() => animateTo(false)}
      style={[{ width }, style]}
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.rim, { height: height + 3 }]}>
          <View style={[styles.card, { height }]}>
            <Image source={{ uri: ytThumb(item?.videoId) }} style={styles.image} contentFit="cover" transition={TRANS_MS} />

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

            <LinearGradient
              colors={['rgba(0,0,0,0)', pressed ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.78)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.scrim}
            />

            <View style={styles.overlay}>
              <Text style={styles.title} numberOfLines={2}>
                {item?.name || '—'}
              </Text>
              <Text style={styles.channel} numberOfLines={1}>
                {item?.channel || '—'}
              </Text>
              <View style={styles.durationRow}>
                <LinearGradient colors={rim} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.durationChip}>
                  <Text style={styles.duration} numberOfLines={1}>
                    {durationText}
                  </Text>
                </LinearGradient>
              </View>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rim: {
    borderRadius: 16,
    padding: 1.5,
  },
  card: {
    borderRadius: 14.5,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0A0A0F',
  },
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
  title: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', lineHeight: 16 },
  channel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.72)' },
  durationRow: { marginTop: 2 },
  durationChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  duration: { fontSize: 9, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
});
