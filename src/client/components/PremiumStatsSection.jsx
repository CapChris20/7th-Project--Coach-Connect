import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

const ACCENTS = {
  calories: '#FF6B9D', // pink
  sleep: '#64D2FF', // cyan
  water: '#10B981', // green
};

const glass = (isDark) => ({
  bg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.78)',
  border: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  text: isDark ? '#FFFFFF' : '#0A0A0F',
  muted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)',
  dim: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(10,10,15,0.45)',
  track: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
});

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const Ring = ({ size = 56, strokeWidth = 6, progress = 0, trackColor, accent }) => {
  const pct = clamp01(progress);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dashOffset = c * (1 - pct);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    </View>
  );
};

const MiniStatCard = ({
  isDark,
  icon,
  label,
  value,
  unit,
  progress,
  accent,
  onPress,
  helperText,
}) => {
  const t = glass(isDark);
  const pct = Math.round(clamp01(progress) * 100);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[styles.miniCard, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      <LinearGradient
        colors={[`${accent}26`, 'transparent']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.miniTopRow}>
        <View style={[styles.miniIcon, { backgroundColor: `${accent}16`, borderColor: `${accent}44` }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        <View style={{ flex: 1 }} />
        <Text style={[styles.miniPct, { color: t.dim }]}>{pct}%</Text>
      </View>

      <View style={styles.miniMiddle}>
        <Ring size={56} strokeWidth={6} progress={progress} trackColor={t.track} accent={accent} />
        <View style={styles.miniValueOverlay} pointerEvents="none">
          <Text style={[styles.miniValue, { color: t.text }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={[styles.miniUnit, { color: t.dim }]} numberOfLines={1}>
            {unit}
          </Text>
        </View>
      </View>

      <Text style={[styles.miniLabel, { color: t.muted }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      {!!helperText && (
        <Text style={[styles.miniHelper, { color: t.dim }]} numberOfLines={1}>
          {helperText}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const CaloriesHeroCard = ({ isDark, current, goal, progress, accent, onPress }) => {
  const t = glass(isDark);
  const pct = Math.round(clamp01(progress) * 100);
  const remaining = Math.max(0, Math.round(Number(goal || 0) - Number(current || 0)));

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[styles.heroCard, { backgroundColor: t.bg, borderColor: t.border }]}
    >
      {/* Border glow */}
      <LinearGradient
        colors={[`${accent}30`, 'transparent', `${accent}10`]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.heroHeader}>
        <View style={[styles.heroIcon, { backgroundColor: `${accent}16`, borderColor: `${accent}44` }]}>
          <Ionicons name="flame-outline" size={18} color={accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.heroLabel, { color: t.muted }]}>{'CALORIES'.toUpperCase()}</Text>
          <Text style={[styles.heroValue, { color: t.text }]} numberOfLines={1}>
            {Math.round(Number(current || 0))}{' '}
            <Text style={{ color: t.dim, fontWeight: '900' }}>/ {Math.round(Number(goal || 2000))}</Text>
          </Text>
        </View>
        <View style={[styles.heroPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderColor: t.border }]}>
          <Text style={[styles.heroPillText, { color: t.text }]}>{pct}%</Text>
        </View>
      </View>

      <View style={[styles.heroTrack, { backgroundColor: t.track }]}>
        <LinearGradient
          colors={[accent, `${accent}AA`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.heroFill, { width: `${pct}%` }]}
        />
      </View>

      <View style={styles.heroFooter}>
        <Text style={[styles.heroFooterText, { color: t.dim }]} numberOfLines={1}>
          {remaining === 0 ? 'Goal hit' : `${remaining} cal remaining`}
        </Text>
        <View style={styles.heroChevron}>
          <Ionicons name="chevron-forward" size={16} color={t.dim} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * PremiumStatsSection
 * - 3 compact glass cards with progress bars: calories, sleep, water.
 */
export default function PremiumStatsSection({
  isDark = true,
  stats,
  onPressCalories,
  onPressSleep,
  onPressWater,
}) {
  const calories = stats?.calories || {};
  const sleep = stats?.sleep || {};
  const water = stats?.water || {};

  const calProgress = useMemo(() => {
    const cur = Number(calories.current ?? 0);
    const goal = Number(calories.goal ?? 2000);
    return goal > 0 ? cur / goal : 0;
  }, [calories.current, calories.goal]);

  const sleepProgress = useMemo(() => {
    const cur = Number(sleep.current ?? 0);
    const goal = Number(sleep.goal ?? 8);
    return goal > 0 ? cur / goal : 0;
  }, [sleep.current, sleep.goal]);

  const waterProgress = useMemo(() => {
    const cur = Number(water.current ?? 0);
    const goal = Number(water.goal ?? 64);
    return goal > 0 ? cur / goal : 0;
  }, [water.current, water.goal]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.65)' }]}>
        TODAY
      </Text>

      <CaloriesHeroCard
        isDark={isDark}
        current={Number(calories.current ?? 0)}
        goal={Number(calories.goal ?? 2000)}
        progress={calProgress}
        accent={ACCENTS.calories}
        onPress={onPressCalories}
      />

      <View style={styles.miniRow}>
        <MiniStatCard
          isDark={isDark}
          icon="moon-outline"
          label="Sleep"
          value={`${Number(sleep.current ?? 0) || 0}`}
          unit="hrs"
          progress={sleepProgress}
          accent={ACCENTS.sleep}
          onPress={onPressSleep}
          helperText="last night"
        />
        <MiniStatCard
          isDark={isDark}
          icon="water-outline"
          label="Water"
          value={`${Math.round(Number(water.current ?? 0))}`}
          unit="oz"
          progress={waterProgress}
          accent={ACCENTS.water}
          onPress={onPressWater}
          helperText="hydration"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  sectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 10 },

  heroCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  heroLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  heroValue: { marginTop: 4, fontSize: 20, fontWeight: '900' },
  heroPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  heroPillText: { fontSize: 12, fontWeight: '900' },
  heroTrack: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  heroFill: { height: '100%', borderRadius: 999 },
  heroFooter: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroFooterText: { fontSize: 12, fontWeight: '800' },
  heroChevron: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },

  miniRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  miniCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    overflow: 'hidden',
  },
  miniTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniIcon: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  miniPct: { fontSize: 11, fontWeight: '900' },
  miniMiddle: { marginTop: 12, alignItems: 'center', justifyContent: 'center' },
  miniValueOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  miniValue: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  miniUnit: { marginTop: 2, fontSize: 10, fontWeight: '800' },
  miniLabel: { marginTop: 12, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  miniHelper: { marginTop: 4, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

