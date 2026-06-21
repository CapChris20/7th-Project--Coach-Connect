/**
 * Premium Welcome Card
 *
 * Purpose: UI screen or component: Premium Welcome Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: PremiumWelcomeCard
 *
 * @file-header
 */
import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';

const ACCENTS = {
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  green: '#10B981',
};

const glass = (isDark) => ({
  bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.78)',
  border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  text: isDark ? '#FFFFFF' : '#0A0A0F',
  muted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)',
  dim: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(10,10,15,0.45)',
});

const formatDateLine = () => {
  const d = new Date();
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
};

/**
 * PremiumWelcomeCard
 * - Glass card with mascot/illustration, personalized greeting, and one clear primary action.
 */
export default function PremiumWelcomeCard({
  isDark = true,
  accent = 'pink',
  userName = 'Athlete',
  message,
  primaryActionLabel,
  onPressPrimaryAction,
  illustrationSource,
}) {
  const t = glass(isDark);
  const a = ACCENTS[accent] || ACCENTS.pink;

  const firstName = useMemo(() => {
    const s = String(userName || 'Athlete').trim();
    return s.split(/\s+/)[0] || 'Athlete';
  }, [userName]);

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.985, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();

  const motivational =
    String(message || '').trim() ||
    'Small wins today beat perfect plans tomorrow. Pick one thing and execute it.';

  const lottie = illustrationSource || require('../../assets/animations/legacy/Fitness.json');

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <View style={[styles.card, { backgroundColor: t.bg, borderColor: t.border }]}>
        {/* Accent aura */}
        <LinearGradient
          colors={[`${a}2A`, 'transparent', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.topRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.kicker, { color: t.dim }]}>{formatDateLine().toUpperCase()}</Text>
            <Text style={[styles.title, { color: t.text }]} numberOfLines={2}>
              Welcome back, <Text style={{ color: a }}>{firstName}</Text>
            </Text>
            <Text style={[styles.subtitle, { color: t.muted }]} numberOfLines={3}>
              {motivational}
            </Text>
          </View>

          <View style={[styles.illusWrap, { backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.04)', borderColor: t.border }]}>
            <LottieView source={lottie} autoPlay loop style={styles.illus} />
          </View>
        </View>

        {onPressPrimaryAction && String(primaryActionLabel || '').trim() ? (
          <TouchableOpacity
            activeOpacity={1}
            onPress={onPressPrimaryAction}
            onPressIn={pressIn}
            onPressOut={pressOut}
            style={{ marginTop: 14 }}
          >
            <LinearGradient
              colors={[a, '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtn}
            >
              <Ionicons name="flash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>{primaryActionLabel}</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.92)" />
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: { marginTop: 8, fontSize: 22, fontWeight: '900', lineHeight: 26 },
  subtitle: { marginTop: 8, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  illusWrap: { width: 72, height: 72, borderRadius: 18, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  illus: { width: 92, height: 92 },
  primaryBtn: { height: 50, borderRadius: 16, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.2 },
});

