import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

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

export const GradientBorderShell = ({ isDark, children, style }) => (
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

  const t = glass(isDark);
  const sleepValue = Number(sleep.current ?? 0) || 0;
  const waterValue = Math.round(Number(water.current ?? 0) || 0);
  const sleepPct = Math.round(clamp01(sleepProgress) * 100);
  const waterPct = Math.round(clamp01(waterProgress) * 100);

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

      <View style={styles.metricsRow}>
        {/* Sleep card */}
        <TouchableOpacity activeOpacity={0.9} onPress={onPressSleep} style={{ flex: 1 }}>
          <View style={styles.metricOuter}>
            <LinearGradient
              colors={['#C084FC', '#FF6B9D']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.metricTopBorder}
            />
            <View style={[styles.metricBody, { backgroundColor: '#13131A' }]}>
              <View style={styles.metricHeaderRow}>
                <View
                  style={[
                    styles.metricIconCircle,
                    { backgroundColor: '#C084FC', borderColor: 'rgba(192,132,252,0.7)' },
                  ]}
                >
                  <Ionicons name="moon-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.metricStatus, { color: t.dim }]}>{`${sleepPct}%`}</Text>
              </View>

              <View style={styles.metricCenter}>
                <Text style={[styles.metricNumber, { color: t.text }]}>{sleepValue}</Text>
                <Text style={[styles.metricUnit, { color: t.muted }]}>hrs</Text>

                <View style={[styles.metricBarTrack, { backgroundColor: t.track }]}>
                  <LinearGradient
                    colors={['#C084FC', '#FF6B9D']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.metricBarFill, { width: `${sleepPct}%` }]}
                  />
                </View>
              </View>

              <View style={styles.metricFooter}>
                <Text style={[styles.metricLabel, { color: t.muted }]}>SLEEP</Text>
                <Text style={[styles.metricSub, { color: t.dim }]}>last night</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Water card */}
        <TouchableOpacity activeOpacity={0.9} onPress={onPressWater} style={{ flex: 1 }}>
          <View style={styles.metricOuter}>
            <LinearGradient
              colors={['#64D2FF', '#4A90E2']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.metricTopBorder}
            />
            <View style={[styles.metricBody, { backgroundColor: '#13131A' }]}>
              <View style={styles.metricHeaderRow}>
                <View
                  style={[
                    styles.metricIconCircle,
                    { backgroundColor: '#64D2FF', borderColor: 'rgba(100,210,255,0.75)' },
                  ]}
                >
                  <Ionicons name="water-outline" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.metricStatus, { color: t.dim }]}>{`${waterPct}%`}</Text>
              </View>

              <View style={styles.metricCenter}>
                <Text style={[styles.metricNumber, { color: t.text }]}>{waterValue}</Text>
                <Text style={[styles.metricUnit, { color: t.muted }]}>oz</Text>

                <View style={[styles.metricBarTrack, { backgroundColor: t.track }]}>
                  <LinearGradient
                    colors={['#64D2FF', '#4A90E2']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.metricBarFill, { width: `${waterPct}%` }]}
                  />
                </View>
              </View>

              <View style={styles.metricFooter}>
                <Text style={[styles.metricLabel, { color: t.muted }]}>WATER</Text>
                <Text style={[styles.metricSub, { color: t.dim }]}>hydration</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
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

  metricsRow: { flexDirection: 'row', gap: 16, marginTop: 14 },
  metricOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#13131A',
  },
  metricTopBorder: {
    height: 3,
    width: '100%',
  },
  metricBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  metricHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metricIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  metricNumber: {
    fontSize: 36,
    fontWeight: '900',
  },
  metricUnit: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  metricBarTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 999,
    width: '100%',
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  metricFooter: {
    alignItems: 'center',
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
});
