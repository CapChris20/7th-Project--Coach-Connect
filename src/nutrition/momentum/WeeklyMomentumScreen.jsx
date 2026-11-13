// Design Law Weekly Momentum — days-on-target calorie bars + next habit + Log a meal (11/12).
// Flow: load last 7 days of food totals vs calorie goal → bar chart → habit toggle → CTA.
// Used by CLIENT_ROUTES.WeeklyMomentum. Opened from nutrition. Does not change meal storage keys.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSwitch from '../../look-and-feel/NbSwitch';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { auth } from '../../app-start/cloudConnection';
import {
  getFoodLogsForDate,
  calculateMacroTotals,
  splitLogsByMeal,
} from '../daily-log/saveLoggedFood';
import { getClientDateKey } from '../../helpers/dateStrings';

// ===== NAMED CONSTANTS =====

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DEFAULT_CALORIE_GOAL = 2300;
// Manipulate here: “on target” = within this fraction of goal (PNG dashed line)
const ON_TARGET_RATIO = 0.9;
const CHART_HEIGHT = 120;
const HANDOFF_BREAKFAST = require('../../assets/icons/handoff/apple.png');

// ===== HELPERS =====

function addDaysKey(dateKey, delta) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Monday-start week keys ending on `endKey` (today by default).
 * @param {string} endKey
 * @returns {string[]}
 */
function lastSevenDayKeys(endKey) {
  // Build Mon→Sun containing endKey so labels M T W T F S S line up with PNG
  const [y, m, d] = String(endKey).split('-').map(Number);
  const end = new Date(y, m - 1, d);
  const day = end.getDay(); // 0=Sun … 6=Sat
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = addDaysKey(endKey, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}

function formatGoal(n) {
  return Number(n || 0).toLocaleString();
}

// ===== UI PIECES =====

function DaysOnTargetChart({ dayCalories, goal, colors }) {
  const maxVal = Math.max(goal * 1.15, ...dayCalories.map((v) => v || 0), 1);
  const goalY = CHART_HEIGHT - (goal / maxVal) * CHART_HEIGHT;
  const onTarget = dayCalories.filter((v) => v >= goal * ON_TARGET_RATIO).length;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <View style={styles.cardHead}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>DAYS ON TARGET</Text>
            <Text style={[styles.bigStat, { color: colors.nbInk }]}>
              {onTarget} of 7
            </Text>
          </View>
          {onTarget >= 5 ? (
            <LinearGradient
              colors={accentGradients[0]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={[styles.badge, { borderColor: colors.nbBorder }]}
            >
              <Text style={[styles.badgeText, { color: colors.nbInk }]}>Best week yet</Text>
            </LinearGradient>
          ) : null}
        </View>

        <View style={styles.chartArea}>
          {/* vocab: dashed goal line — horizontal rule at the calorie goal Y */}
          <View
            pointerEvents="none"
            style={[
              styles.goalLine,
              {
                top: goalY,
                borderColor: colors.nbMuted,
              },
            ]}
          />
          <View style={styles.barsRow}>
            {dayCalories.map((kcal, i) => {
              const h = Math.max(4, ((kcal || 0) / maxVal) * CHART_HEIGHT);
              return (
                <View key={`bar-${i}`} style={styles.barCol}>
                  <View style={[styles.barTrack, { height: CHART_HEIGHT }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: h,
                          backgroundColor: colors.nbFill,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.dayLabel, { color: colors.nbMuted }]}>
                    {DAY_LABELS[i]}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <Text style={[styles.caption, { color: colors.nbMuted }]}>
          Dashed line is your {formatGoal(goal)} calorie goal.
        </Text>
      </View>
    </HardShadow>
  );
}

function NextHabitCard({ habitOn, onToggle, colors, skipCount }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <Text style={[styles.eyebrow, { color: colors.nbMuted, marginBottom: 8 }]}>
        NEXT HABIT
      </Text>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.habitCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <View style={[styles.habitIcon, { borderColor: colors.nbBorder }]}>
            <LinearGradient
              colors={accentGradients[3]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Image source={HANDOFF_BREAKFAST} style={{ width: 26, height: 26 }} resizeMode="contain" />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.habitTitle, { color: colors.nbInk }]}>
              Log breakfast before 9 am
            </Text>
            <Text style={[styles.habitSub, { color: colors.nbMuted }]}>
              You skipped it {skipCount} of 7 days. That is where you miss protein.
            </Text>
          </View>
          <NbSwitch value={habitOn} onValueChange={onToggle} />
        </View>
      </HardShadow>
    </View>
  );
}

// ===== MAIN =====

/**
 * @param {{
 *   userId?: string|null,
 *   calorieGoal?: number,
 *   onBack?: Function,
 *   onLogMeal?: Function,
 * }} props
 */
export default function WeeklyMomentumScreen({
  userId: userIdProp,
  calorieGoal = DEFAULT_CALORIE_GOAL,
  onBack,
  onLogMeal,
}) {
  const { colors } = useTheme();
  const uid = userIdProp || auth?.currentUser?.uid || null;
  const goal = Math.max(1, Math.round(Number(calorieGoal) || DEFAULT_CALORIE_GOAL));
  const todayKey = getClientDateKey();
  const weekKeys = useMemo(() => lastSevenDayKeys(todayKey), [todayKey]);

  const [dayCalories, setDayCalories] = useState(() => weekKeys.map(() => 0));
  const [breakfastSkipCount, setBreakfastSkipCount] = useState(3);
  const [habitOn, setHabitOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadWeek() {
      if (!uid) {
        setLoading(false);
        return;
      }
      try {
        const rows = await Promise.all(
          weekKeys.map(async (key) => {
            try {
              // vocab: getFoodLogsForDate accepts a YYYY-MM-DD string via toDateKey
              const logs = await getFoodLogsForDate(uid, key);
              const list = Array.isArray(logs) ? logs : [];
              const totals = calculateMacroTotals(list);
              const meals = splitLogsByMeal(list);
              const hasBreakfast = (meals?.breakfast || []).length > 0;
              return {
                calories: Math.round(Number(totals?.calories) || 0),
                hasBreakfast,
              };
            } catch {
              return { calories: 0, hasBreakfast: false };
            }
          }),
        );
        if (cancelled) return;
        setDayCalories(rows.map((r) => r.calories));
        setBreakfastSkipCount(rows.filter((r) => !r.hasBreakfast).length);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadWeek();
    return () => {
      cancelled = true;
    };
  }, [uid, weekKeys]);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader
        title="Weekly Momentum"
        subtitle="Calories against your goal"
        onBack={onBack}
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <Text style={{ color: colors.nbMuted, fontWeight: '600' }}>Loading week…</Text>
        ) : (
          <>
            <DaysOnTargetChart dayCalories={dayCalories} goal={goal} colors={colors} />
            <NextHabitCard
              habitOn={habitOn}
              onToggle={setHabitOn}
              colors={colors}
              skipCount={breakfastSkipCount}
            />
            <NbButton
              variant="fill"
              onPress={() => onLogMeal?.()}
              style={{ marginTop: spacing.lg }}
            >
              Log a meal
            </NbButton>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.xl,
  },
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  bigStat: {
    fontSize: 28,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  badge: {
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '900' },
  chartArea: {
    height: CHART_HEIGHT + 28,
    marginBottom: 8,
    justifyContent: 'flex-end',
  },
  goalLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    zIndex: 2,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  barFill: {
    width: '70%',
    borderRadius: 4,
    minHeight: 4,
  },
  dayLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '800',
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  habitCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  habitIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  habitTitle: { fontSize: 15, fontWeight: '900' },
  habitSub: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },
});
