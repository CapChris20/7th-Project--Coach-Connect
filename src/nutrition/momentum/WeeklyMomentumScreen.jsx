// Weekly Momentum — seven calorie bars vs goal, next-habit toggle, Log a meal.
// Flow: resolve user → load Mon–Sun food totals → chart + breakfast skip count → CTA.
// Used by CLIENT_ROUTES.WeeklyMomentum. Meal storage keys stay unchanged.

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

// Manipulate here: weekday letters under each bar (Mon-start week)
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
// Manipulate here: fallback daily calorie goal when prop is missing
const DEFAULT_CALORIE_GOAL = 2300;
// Manipulate here: “on target” = calories >= this fraction of goal (PNG dashed line)
const ON_TARGET_RATIO = 0.9;
// Manipulate here: raise = taller bars; chart track height in px
const CHART_HEIGHT = 120;
// Manipulate here: headroom above goal so the tallest day still fits
const CHART_GOAL_HEADROOM = 1.15;
const BEST_WEEK_BADGE_MIN_DAYS = 5;
const MIN_BAR_HEIGHT_PX = 4;
const DEFAULT_BREAKFAST_SKIP_GUESS = 3;
// Manipulate here: Mon–Sun chart always has seven columns
const DAYS_IN_WEEK = 7;
const SUNDAY_WEEKDAY_INDEX = 0;
const DAYS_FROM_SUNDAY_BACK_TO_MONDAY = -6;
const HANDOFF_BREAKFAST = require('../../assets/icons/handoff/apple.png');

// ===== SCREEN LAYOUT (no hooks — pure paint) =====

/**
 * One day column: fill height from calories / chart max, label under the bar.
 */
function CalorieBarColumn({ dayLabel, calories, maxChartValue, colors }) {
  const safeCalories = calories || 0;
  const heightRatio = safeCalories / maxChartValue;
  const barHeight = Math.max(MIN_BAR_HEIGHT_PX, heightRatio * CHART_HEIGHT);

  return (
    <View style={styles.barCol}>
      <View style={[styles.barTrack, { height: CHART_HEIGHT }]}>
        <View
          style={[
            styles.barFill,
            {
              height: barHeight,
              backgroundColor: colors.nbFill,
            },
          ]}
        />
      </View>
      <Text style={[styles.dayLabel, { color: colors.nbMuted }]}>{dayLabel}</Text>
    </View>
  );
}

/**
 * HardShadow card: “X of 7” on-target count, dashed goal line, seven bars.
 */
function DaysOnTargetChart({ dayCalories, goal, colors }) {
  const highestDayCalories = Math.max(...dayCalories.map((value) => value || 0), 0);
  const maxChartValue = Math.max(goal * CHART_GOAL_HEADROOM, highestDayCalories, 1);
  const goalLineFromTop = CHART_HEIGHT - (goal / maxChartValue) * CHART_HEIGHT;

  const onTargetDayCount = dayCalories.filter(
    (value) => value >= goal * ON_TARGET_RATIO,
  ).length;
  const showBestWeekBadge = onTargetDayCount >= BEST_WEEK_BADGE_MIN_DAYS;
  const goalCaption = `Dashed line is your ${formatCalorieGoal(goal)} calorie goal.`;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <View style={styles.cardHead}>
          <View style={styles.cardHeadText}>
            <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>DAYS ON TARGET</Text>
            <Text style={[styles.bigStat, { color: colors.nbInk }]}>
              {onTargetDayCount} of 7
            </Text>
          </View>
          {showBestWeekBadge ? (
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
          <View
            pointerEvents="none"
            style={[
              styles.goalLine,
              {
                top: goalLineFromTop,
                borderColor: colors.nbMuted,
              },
            ]}
          />
          <View style={styles.barsRow}>
            {dayCalories.map((kcal, index) => (
              <CalorieBarColumn
                key={`bar-${DAY_LABELS[index]}-${index}`}
                dayLabel={DAY_LABELS[index]}
                calories={kcal}
                maxChartValue={maxChartValue}
                colors={colors}
              />
            ))}
          </View>
        </View>

        <Text style={[styles.caption, { color: colors.nbMuted }]}>{goalCaption}</Text>
      </View>
    </HardShadow>
  );
}

/**
 * Next habit row: apple icon, breakfast copy, NbSwitch.
 */
function NextHabitCard({ habitOn, onToggle, colors, skipCount }) {
  const habitSubtitle = `You skipped it ${skipCount} of 7 days. That is where you miss protein.`;

  return (
    <View style={styles.habitBlock}>
      <Text style={[styles.eyebrow, styles.habitEyebrow, { color: colors.nbMuted }]}>
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
            <Image source={HANDOFF_BREAKFAST} style={styles.habitIconImage} resizeMode="contain" />
          </View>
          <View style={styles.habitCopy}>
            <Text style={[styles.habitTitle, { color: colors.nbInk }]}>
              Log breakfast before 9 am
            </Text>
            <Text style={[styles.habitSub, { color: colors.nbMuted }]}>{habitSubtitle}</Text>
          </View>
          <NbSwitch value={habitOn} onValueChange={onToggle} />
        </View>
      </HardShadow>
    </View>
  );
}

/**
 * Full screen chrome: header + scroll of chart / habit / Log a meal.
 */
function WeeklyMomentumLayout({
  colors,
  loading,
  goal,
  dayCalories,
  habitOn,
  onHabitToggle,
  breakfastSkipCount,
  onBack,
  onLogMeal,
}) {
  const showLoadingCopy = loading;
  const showWeekContent = !loading;

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
        {showLoadingCopy ? (
          <Text style={[styles.loadingText, { color: colors.nbMuted }]}>Loading week…</Text>
        ) : null}
        {showWeekContent ? (
          <>
            <DaysOnTargetChart dayCalories={dayCalories} goal={goal} colors={colors} />
            <NextHabitCard
              habitOn={habitOn}
              onToggle={onHabitToggle}
              colors={colors}
              skipCount={breakfastSkipCount}
            />
            <NbButton
              variant="fill"
              onPress={() => onLogMeal?.()}
              style={styles.logMealButton}
            >
              Log a meal
            </NbButton>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== HELPER FUNCTIONS =====

function formatCalorieGoal(number) {
  return Number(number || 0).toLocaleString();
}

/**
 * Move a "YYYY-MM-DD" key by dayDelta calendar days (local timezone).
 */
function shiftDateKeyByDays(dateKey, dayDelta) {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + dayDelta);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

/**
 * Monday-start week of seven keys that contains `endKey` (usually today).
 * Sunday (getDay === 0) walks back 6 days to Monday.
 */
function mondayThroughSundayKeysEndingNear(endKey) {
  const [year, month, day] = String(endKey).split('-').map(Number);
  const endDate = new Date(year, month - 1, day);
  const weekdayIndex = endDate.getDay();
  const endIsSunday = weekdayIndex === SUNDAY_WEEKDAY_INDEX;
  const daysBackToMonday = endIsSunday
    ? DAYS_FROM_SUNDAY_BACK_TO_MONDAY
    : 1 - weekdayIndex;
  const mondayKey = shiftDateKeyByDays(endKey, daysBackToMonday);

  const keys = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
    keys.push(shiftDateKeyByDays(mondayKey, dayIndex));
  }
  return keys;
}

/**
 * One day’s calorie total + whether breakfast had any logs.
 * On failure returns zeros so one bad day does not blank the chart.
 */
async function loadOneDayCaloriesAndBreakfast(userId, dateKey) {
  try {
    const logs = await getFoodLogsForDate(userId, dateKey);
    const foodList = Array.isArray(logs) ? logs : [];
    const totals = calculateMacroTotals(foodList);
    // vocab: splitLogsByMeal = groups by mealType (breakfast/lunch/…)
    const mealsBySlot = splitLogsByMeal(foodList);
    const breakfastLogs = mealsBySlot?.breakfast || [];
    const hasBreakfast = breakfastLogs.length > 0;
    const dailyCalories = Math.round(Number(totals?.calories) || 0);
    return { calories: dailyCalories, hasBreakfast };
  } catch {
    return { calories: 0, hasBreakfast: false };
  }
}

async function loadAllWeekDayRows(userId, weekKeys) {
  // vocab: Promise.all = wait for every day fetch; order matches weekKeys
  return Promise.all(
    weekKeys.map((dateKey) => loadOneDayCaloriesAndBreakfast(userId, dateKey)),
  );
}

function countDaysWithoutBreakfast(dayRows) {
  return dayRows.filter((row) => !row.hasBreakfast).length;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: spacing.xl,
  },
  loadingText: { fontWeight: '600' },
  logMealButton: { marginTop: spacing.lg },
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
  cardHeadText: { flex: 1, minWidth: 0 },
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
  habitBlock: { marginTop: spacing.lg },
  habitEyebrow: { marginBottom: 8 },
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
  habitIconImage: { width: 26, height: 26 },
  habitCopy: { flex: 1, minWidth: 0 },
  habitTitle: { fontSize: 15, fontWeight: '900' },
  habitSub: { fontSize: 12, fontWeight: '600', marginTop: 4, lineHeight: 17 },
});

// ===== MAIN FUNCTION =====

/**
 * Weekly Momentum screen — loads last Mon–Sun calorie totals for the signed-in user.
 * Flow: 1. resolve uid  2. build week keys  3. fetch each day  4. paint layout
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
  // vocab: useTheme = Design Law light/dark tokens (nbBackground, nbInk, …)
  const { colors } = useTheme();

  // Prefer prop uid; else Firebase Auth current user (projectId stays anatrox-auth).
  const userId = userIdProp || auth?.currentUser?.uid || null;
  const goalCalories = Math.max(1, Math.round(Number(calorieGoal) || DEFAULT_CALORIE_GOAL));
  // vocab: getClientDateKey = "YYYY-MM-DD" in the client's local calendar
  const todayKey = getClientDateKey();
  // vocab: useMemo = recompute week keys only when todayKey changes
  const weekKeys = useMemo(() => mondayThroughSundayKeysEndingNear(todayKey), [todayKey]);

  const [dayCalories, setDayCalories] = useState(() => weekKeys.map(() => 0));
  const [breakfastSkipCount, setBreakfastSkipCount] = useState(DEFAULT_BREAKFAST_SKIP_GUESS);
  const [habitOn, setHabitOn] = useState(false);
  const [loading, setLoading] = useState(true);

  // vocab: useEffect = after paint; cleanup sets cancelled so late fetches do not setState
  useEffect(() => {
    let loadWasCancelled = false;

    async function loadWeekCalorieRows() {
      // 1. No signed-in user → stop the spinner; chart stays zeros.
      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        // 2. Parallel fetch: calories + “had breakfast?” for each day key.
        const dayRows = await loadAllWeekDayRows(userId, weekKeys);
        if (loadWasCancelled) {
          return;
        }

        // 3. Split rows into bar heights and breakfast skip count for the habit card.
        const calorieList = dayRows.map((row) => row.calories);
        const skippedBreakfastDays = countDaysWithoutBreakfast(dayRows);
        setDayCalories(calorieList);
        setBreakfastSkipCount(skippedBreakfastDays);
      } finally {
        if (!loadWasCancelled) {
          setLoading(false);
        }
      }
    }

    loadWeekCalorieRows();
    return () => {
      loadWasCancelled = true;
    };
  }, [userId, weekKeys]);

  return (
    <WeeklyMomentumLayout
      colors={colors}
      loading={loading}
      goal={goalCalories}
      dayCalories={dayCalories}
      habitOn={habitOn}
      onHabitToggle={setHabitOn}
      breakfastSkipCount={breakfastSkipCount}
      onBack={onBack}
      onLogMeal={onLogMeal}
    />
  );
}

