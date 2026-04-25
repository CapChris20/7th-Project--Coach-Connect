import React, { useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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
  dim: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)',
});

/**
 * PremiumTrainerCard
 * - Prominent, tappable trainer card with gradient avatar ring, badges, and CTA.
 */
export default function PremiumTrainerCard({
  isDark = true,
  accent = 'purple',
  trainer,
  onPressCard,
  onPressCTA,
  ctaLabel = 'Message',
  secondaryCtaLabel = 'View Profile',
  onPressSecondaryCTA,
}) {
  const t = glass(isDark);
  const a = ACCENTS[accent] || ACCENTS.purple;
  const ring = useMemo(
    () => (accent === 'cyan' ? ['#64D2FF', '#C084FC'] : accent === 'pink' ? ['#FF6B9D', '#C084FC'] : ['#C084FC', '#FF6B9D']),
    [accent],
  );

  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 22, bounciness: 6 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 7 }).start();

  const name = String(trainer?.name || trainer?.displayName || 'Your Trainer').trim();
  const specialty = String(trainer?.specialty || trainer?.headline || 'Strength & Nutrition').trim();
  const location = String(trainer?.location || 'Remote').trim();
  const rating = typeof trainer?.rating === 'number' ? trainer.rating : trainer?.rating ? Number(trainer.rating) : null;
  const clients = typeof trainer?.clients === 'number' ? trainer.clients : trainer?.clients ? Number(trainer.clients) : null;
  const years = typeof trainer?.experienceYears === 'number' ? trainer.experienceYears : null;

  const badge = (icon, label) => (
    <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: t.border }]}>
      <Ionicons name={icon} size={14} color={a} />
      <Text style={[styles.badgeText, { color: t.text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPressCard}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.outer, { borderColor: t.border, backgroundColor: t.bg }]}
      >
        {/* Subtle top glow */}
        <LinearGradient
          colors={[`${a}22`, 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.row}>
          {/* Avatar ring */}
          <LinearGradient colors={ring} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
            <View style={[styles.avatarInner, { backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF', borderColor: t.border }]}>
              {trainer?.avatarUrl || trainer?.photoURL ? (
                <Image source={{ uri: trainer.avatarUrl || trainer.photoURL }} style={styles.avatarImg} />
              ) : (
                <Text style={[styles.avatarFallback, { color: a }]}>{name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</Text>
              )}
            </View>
          </LinearGradient>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.titleRow}>
              <Text style={[styles.name, { color: t.text }]} numberOfLines={1}>
                {name}
              </Text>
              <View style={[styles.pill, { borderColor: `${a}55`, backgroundColor: `${a}1A` }]}>
                <Text style={[styles.pillText, { color: a }]}>ACTIVE</Text>
              </View>
            </View>

            <Text style={[styles.specialty, { color: t.muted }]} numberOfLines={1}>
              {specialty}
            </Text>

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={14} color={t.dim} />
              <Text style={[styles.meta, { color: t.dim }]} numberOfLines={1}>
                {location}
              </Text>
            </View>

            <View style={styles.badgesRow}>
              {rating ? badge('star', `${rating.toFixed(1)} rating`) : badge('star-outline', 'Top rated')}
              {clients ? badge('people-outline', `${clients} clients`) : badge('people-outline', 'Clients')}
              {years ? badge('ribbon-outline', `${years}+ yrs`) : null}
            </View>
          </View>
        </View>

        {/* CTA row */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={onPressSecondaryCTA}
            style={[styles.secondaryBtn, { borderColor: t.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' }]}
          >
            <Ionicons name="person-circle-outline" size={18} color={t.text} />
            <Text style={[styles.secondaryText, { color: t.text }]}>{secondaryCtaLabel}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.9} onPress={onPressCTA} style={styles.primaryBtnWrap}>
            <LinearGradient colors={[a, '#FF6B9D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>{ctaLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  avatarRing: { width: 74, height: 74, borderRadius: 37, padding: 2 },
  avatarInner: { flex: 1, borderRadius: 35, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  name: { fontSize: 18, fontWeight: '900', flex: 1 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  specialty: { marginTop: 4, fontSize: 13, fontWeight: '700' },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontSize: 12, fontWeight: '600' },
  badgesRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  ctaRow: { marginTop: 14, flexDirection: 'row', gap: 10 },
  secondaryBtn: { flex: 1, height: 46, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  primaryBtnWrap: { flex: 1 },
  primaryBtn: { height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});

