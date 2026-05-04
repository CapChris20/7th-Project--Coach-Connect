import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

/** Same palette as session meeting cards: cyan → purple → pink */
const BORDER_GRADIENT = ['#06B6D4', '#C084FC', '#FF6B9D'];

const ACCENTS = {
  calories: '#FF6B9D',
  sleep: '#C084FC',
  water: '#06B6D4',
};

const innerWash = (isDark) =>
  isDark
    ? ['rgba(255,107,157,0.12)', 'rgba(192,132,252,0.08)', 'rgba(6,182,212,0.06)']
    : ['rgba(255,107,157,0.08)', 'rgba(192,132,252,0.06)', 'rgba(6,182,212,0.05)'];

const glass = (isDark) => ({
  text: isDark ? '#FFFFFF' : '#0F172A',
  muted: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.55)',
  dim: isDark ? 'rgba(255,255,255,0.42)' : 'rgba(15,23,42,0.45)',
  track: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
});

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const GradientBorderShell = ({ isDark, children, style }) => (
  <LinearGradient
    colors={BORDER_GRADIENT}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[
      {
        borderRadius: 22,
        padding: 1.5,
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: isDark ? 0.35 : 0.22,
        shadowRadius: 18,
        elevation: 8,
      },
      style,
    ]}
  >
    <View
      style={{
        borderRadius: 20.5,
        overflow: 'hidden',
        backgroundColor: isDark ? 'rgba(12, 10, 28, 0.96)' : 'rgba(255, 255, 255, 0.97)',
      }}
    >
      <LinearGradient
        colors={innerWash(isDark)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 14 }}
      >
        {children}
      </LinearGradient>
    </View>
  </LinearGradient>
);

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

const MiniStatCard = ({ isDark, icon, label, value, unit, progress, accent, onPress, helperText }) => {
  const t = glass(isDark);
  const pct = Math.round(clamp01(progress) * 100);
  const iconBg = isDark ? `${accent}22` : `${accent}18`;
  const iconBorder = isDark ? `${accent}40` : `${accent}35`;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={{ flex: 1 }}>
      <GradientBorderShell isDark={isDark} style={{ flex: 1 }}>
        <View style={styles.miniTopRow}>
          <View style={[styles.miniIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
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
      </GradientBorderShell>
    </TouchableOpacity>
  );
};

const PROGRESS_GRADIENT = ['#FF6B9D', '#C084FC', '#06B6D4'];

const CaloriesHeroCard = ({ isDark, current, goal, progress, onPress }) => {
  const t = glass(isDark);
  const pct = Math.round(clamp01(progress) * 100);
  const remaining = Math.max(0, Math.round(Number(goal || 0) - Number(current || 0)));
  const accent = ACCENTS.calories;
  const iconBg = isDark ? `${accent}22` : `${accent}18`;
  const iconBorder = isDark ? `${accent}40` : `${accent}35`;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
      <GradientBorderShell isDark={isDark}>
        <View style={styles.heroHeader}>
          <View style={[styles.heroIcon, { backgroundColor: iconBg, borderColor: iconBorder }]}>
            <Ionicons name="flame-outline" size={18} color={accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.heroLabel, { color: t.muted }]}>{'CALORIES'.toUpperCase()}</Text>
            <Text style={[styles.heroValue, { color: t.text }]} numberOfLines={1}>
              {Math.round(Number(current || 0))}{' '}
              <Text style={{ color: t.dim, fontWeight: '900' }}>/ {Math.round(Number(goal || 2000))}</Text>
            </Text>
          </View>
          <View
            style={[
              styles.heroPill,
              {
                backgroundColor: isDark ? 'rgba(255,107,157,0.14)' : 'rgba(192,132,252,0.12)',
                borderColor: isDark ? 'rgba(255,107,157,0.28)' : 'rgba(192,132,252,0.22)',
              },
            ]}
          >
            <Text style={[styles.heroPillText, { color: t.text }]}>{pct}%</Text>
          </View>
        </View>

        <View style={[styles.heroTrack, { backgroundColor: t.track }]}>
          <LinearGradient
            colors={PROGRESS_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.heroFill, { width: `${Math.max(pct, 0)}%` }]}
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
      </GradientBorderShell>
    </TouchableOpacity>
  );
};

/**
 * PremiumStatsSection — Calories / Sleep / Water with session-card gradient borders + glass inner.
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
      <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.65)' }]}>
        TODAY
      </Text>

      <CaloriesHeroCard
        isDark={isDark}
        current={Number(calories.current ?? 0)}
        goal={Number(calories.goal ?? 2000)}
        progress={calProgress}
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
  miniTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  miniIcon: { width: 34, height: 34, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  miniPct: { fontSize: 11, fontWeight: '900' },
  miniMiddle: {
    marginTop: 12,
    width: 56,
    height: 56,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValueOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniValue: { fontSize: 16, fontWeight: '900', lineHeight: 18 },
  miniUnit: { marginTop: 2, fontSize: 10, fontWeight: '800' },
  miniLabel: { marginTop: 12, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  miniHelper: { marginTop: 4, fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
