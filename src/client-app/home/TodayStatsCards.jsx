// Today’s calorie ring on the client home screen: eaten vs goal, remaining, Log food.
// Flow: read current/goal → clamp progress → animate the ring → Log food or Open Nutrition.
// Used by the client home dashboard under the TODAY heading.

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import HardShadow from '../../look-and-feel/HardShadow';
import { lightColors, darkColors, gradients, borderRadius, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

/** Kept for callers that still pass accent ramps — shell itself is HardShadow now (no GradientFrame). */
export const TRAINER_BORDER_GRADIENT = ['#FF6B9D', '#FB923C'];

const RING_SIZE = 102;
const STROKE = 8;
const RING_RADIUS = (RING_SIZE - STROKE) / 2;
const RING_CENTER_X = RING_SIZE / 2;
const RING_CENTER_Y = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const DEFAULT_CALORIE_GOAL = 2000;
const PERCENT_SCALE = 100;
const RING_ANIMATION_MS = 380;
const INNER_DISC_STROKE_FACTOR = 0.9;
const INNER_DISC_MIN_RADIUS = 6;
const DARK_SCHEME = 'dark';
const GRADIENT_ID_RANDOM_SLICE_START = 2;
const GRADIENT_ID_RANDOM_SLICE_END = 9;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ===== HELPER FUNCTIONS =====

function clampBetweenZeroAndOne(progress) {
  return Math.max(0, Math.min(1, progress));
}

function caloriesProgressRatio(currentCalories, goalCalories) {
  const eaten = Number(currentCalories ?? 0);
  const goal = Number(goalCalories ?? DEFAULT_CALORIE_GOAL);
  if (goal <= 0) return 0;
  return eaten / goal;
}

function buildCalorieDisplayNumbers(currentCalories, goalCalories, rawProgress) {
  const clampedProgress = clampBetweenZeroAndOne(rawProgress);
  const percentComplete = Math.round(clampedProgress * PERCENT_SCALE);
  const caloriesEaten = Math.round(Number(currentCalories || 0));
  const caloriesGoal = Math.round(Number(goalCalories || DEFAULT_CALORIE_GOAL));
  const caloriesRemaining = Math.max(0, caloriesGoal - caloriesEaten);
  return {
    clampedProgress,
    percentComplete,
    caloriesEaten,
    caloriesGoal,
    caloriesRemaining,
  };
}

function pickLogFoodHandler(onPressLogFood, onPressCalories) {
  if (typeof onPressLogFood === 'function') return onPressLogFood;
  return onPressCalories;
}

function progressPercentTextColor(percentComplete, inkColor) {
  if (percentComplete > 0) return gradients.brand.colors[0];
  return inkColor;
}

function themePaletteForScheme(colorScheme) {
  if (colorScheme === DARK_SCHEME) return darkColors;
  return lightColors;
}

function isDarkColorScheme(colorScheme) {
  return colorScheme === DARK_SCHEME;
}

function uniqueRingGradientId() {
  const randomPart = Math.random().toString(36).slice(
    GRADIENT_ID_RANDOM_SLICE_START,
    GRADIENT_ID_RANDOM_SLICE_END,
  );
  return `calRing_${randomPart}`;
}

function caloriesBagFromStats(stats) {
  if (!stats) return {};
  if (!stats.calories) return {};
  return stats.calories;
}

/**
 * Design Law card shell for trainer / empty-trainer CTAs (HardShadow + 3px border).
 * Replaces the old GradientFrame rim so home stays black/white/gray chrome.
 */
export function ColorBorderShell({
  isDark = false,
  children,
  style,
  borderColors: _borderColors = TRAINER_BORDER_GRADIENT,
}) {
  const shellBackground = isDark ? darkColors.nbSurface : lightColors.nbSurface;
  const shellBorderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;

  return (
    <HardShadow radius={borderRadius.nbHero} offset={nb.shadowOffsetCard} style={style}>
      <View
        style={{
          backgroundColor: shellBackground,
          borderColor: shellBorderColor,
          borderWidth: nb.borderWidth,
          borderRadius: borderRadius.nbHero,
          padding: 14,
        }}
      >
        {children}
      </View>
    </HardShadow>
  );
}

function CalorieRingGraphic({
  ringGradientId,
  innerDiscRadius,
  innerDiscFill,
  innerDiscStroke,
  trackStroke,
  ringActiveStroke,
  strokeDashoffset,
  caloriesEatenLabel,
  caloriesGoalLabel,
  inkColor,
  mutedColor,
}) {
  return (
    <View style={cardStyles.ringWrap}>
      <Svg width={RING_SIZE} height={RING_SIZE} style={cardStyles.ringSvg}>
        <Defs>
          <SvgLinearGradient
            id={ringGradientId}
            x1="0"
            y1="0"
            x2={RING_SIZE}
            y2={RING_SIZE}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={gradients.brand.colors[0]} />
            <Stop offset="1" stopColor={gradients.brand.colors[1]} />
          </SvgLinearGradient>
        </Defs>
        <Circle
          cx={RING_CENTER_X}
          cy={RING_CENTER_Y}
          r={innerDiscRadius}
          fill={innerDiscFill}
          stroke={innerDiscStroke}
          strokeWidth={1}
        />
        <Circle
          cx={RING_CENTER_X}
          cy={RING_CENTER_Y}
          r={RING_RADIUS}
          stroke={trackStroke}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING_CENTER_X}
          cy={RING_CENTER_Y}
          r={RING_RADIUS}
          stroke={ringActiveStroke}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_CENTER_X}, ${RING_CENTER_Y}`}
        />
      </Svg>
      <View style={cardStyles.ringCenter} pointerEvents="none">
        <Text style={[cardStyles.ringBig, { color: inkColor }]}>{caloriesEatenLabel}</Text>
        <Text style={[cardStyles.ringGoal, { color: mutedColor }]}>
          / {caloriesGoalLabel}{' '}
          <Text style={{ color: mutedColor, fontWeight: '600' }}>kcal</Text>
        </Text>
      </View>
    </View>
  );
}

function CaloriesHeroCard({ current, goal, progress, onPress, onPressLogFood }) {
  // Hook order frozen: colorScheme → ringGradientId → progressAnim → ring fill effect
  const colorScheme = useColorScheme();
  const colors = themePaletteForScheme(colorScheme);
  const isDark = isDarkColorScheme(colorScheme);

  const display = buildCalorieDisplayNumbers(current, goal, progress);
  const clampedProgress = display.clampedProgress;
  const percentComplete = display.percentComplete;
  const caloriesEaten = display.caloriesEaten;
  const caloriesGoal = display.caloriesGoal;
  const caloriesRemaining = display.caloriesRemaining;

  const trackStroke = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const ringGradientId = useRef(uniqueRingGradientId()).current;
  const innerDiscRadius = Math.max(
    RING_RADIUS - STROKE * INNER_DISC_STROKE_FACTOR,
    INNER_DISC_MIN_RADIUS,
  );
  const innerDiscFill = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const innerDiscStroke = isDark ? darkColors.nbBorder : lightColors.nbBorder;

  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: clampedProgress,
      duration: RING_ANIMATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [clampedProgress, progressAnim]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  const logFoodHandler = pickLogFoodHandler(onPressLogFood, onPress);
  const showLogFoodButton = typeof logFoodHandler === 'function';
  const showOpenNutritionRow = typeof onPress === 'function';
  const ringHasProgress = clampedProgress > 0;

  let ringActiveStroke = trackStroke;
  if (ringHasProgress) {
    ringActiveStroke = `url(#${ringGradientId})`;
  }

  const progressValueColor = progressPercentTextColor(percentComplete, colors.nbInk);
  const metricsCardBackground = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const nutritionRowBackground = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const caloriesEatenLabel = caloriesEaten.toLocaleString();
  const caloriesGoalLabel = caloriesGoal.toLocaleString();
  const caloriesRemainingLabel = caloriesRemaining.toLocaleString();
  const percentCompleteLabel = `${percentComplete}%`;

  let logFoodButton = null;
  if (showLogFoodButton) {
    logFoodButton = (
      <NbButton variant="brand" sm onPress={logFoodHandler}>
        Log food
      </NbButton>
    );
  }

  let openNutritionRow = null;
  if (showOpenNutritionRow) {
    openNutritionRow = (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={cardStyles.nutritionTouch}>
        <View
          style={[
            cardStyles.nutritionRow,
            { borderColor: colors.nbBorder, backgroundColor: nutritionRowBackground },
          ]}
        >
          <View style={cardStyles.nutritionRowInner}>
            <View style={cardStyles.nutritionRowLeft}>
              <Ionicons name="nutrition-outline" size={20} color={gradients.brand.colors[0]} />
              <Text style={[cardStyles.nutritionRowTitle, { color: colors.nbInk }]}>
                Open Nutrition
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <NbCard style={cardStyles.card}>
      <View style={cardStyles.cardRow}>
        <View style={cardStyles.ringCol}>
          <CalorieRingGraphic
            ringGradientId={ringGradientId}
            innerDiscRadius={innerDiscRadius}
            innerDiscFill={innerDiscFill}
            innerDiscStroke={innerDiscStroke}
            trackStroke={trackStroke}
            ringActiveStroke={ringActiveStroke}
            strokeDashoffset={strokeDashoffset}
            caloriesEatenLabel={caloriesEatenLabel}
            caloriesGoalLabel={caloriesGoalLabel}
            inkColor={colors.nbInk}
            mutedColor={colors.nbMuted}
          />
        </View>

        <View style={[cardStyles.rightCol, { borderLeftColor: colors.nbBorder }]}>
          <View style={cardStyles.headerRow}>
            <View style={cardStyles.headerTitleWrap}>
              <Text style={[cardStyles.headerTitle, { color: colors.nbInk }]}>Calories</Text>
              <Text style={[cardStyles.headerSubtitle, { color: colors.nbMuted }]}>Today's budget</Text>
            </View>
            {logFoodButton}
          </View>

          <View
            style={[
              cardStyles.metricsCard,
              {
                backgroundColor: metricsCardBackground,
                borderColor: colors.nbBorder,
              },
            ]}
          >
            <View style={cardStyles.metricCol}>
              <Text style={[cardStyles.metricLabel, { color: colors.nbMuted }]}>REMAINING</Text>
              <Text style={[cardStyles.metricValue, { color: colors.nbInk }]}>
                {caloriesRemainingLabel}
              </Text>
              <Text style={[cardStyles.metricUnit, { color: colors.nbMuted }]}>kcal</Text>
            </View>
            <View style={[cardStyles.metricDivider, { backgroundColor: colors.nbBorder }]} />
            <View style={cardStyles.metricCol}>
              <Text style={[cardStyles.metricLabel, { color: colors.nbMuted }]}>PROGRESS</Text>
              <Text style={[cardStyles.metricValue, { color: progressValueColor }]}>
                {percentCompleteLabel}
              </Text>
              <Text style={[cardStyles.metricUnit, { color: colors.nbMuted }]}>of goal</Text>
            </View>
          </View>

          {openNutritionRow}
        </View>
      </View>
    </NbCard>
  );
}

// ===== MAIN FUNCTION =====

/**
 * TODAY section: muted label + calorie hero card.
 * Flow: 1. progress ratio  2. eaten/goal numbers  3. paint TODAY + hero
 * @param {{ stats?: object, onPressCalories?: Function, onPressLogFood?: Function }} props
 */
export default function TodayStatsCards({ stats, onPressCalories, onPressLogFood }) {
  // Hook order frozen: colorScheme → calorieProgress memo
  const colorScheme = useColorScheme();
  const colors = themePaletteForScheme(colorScheme);
  const calories = caloriesBagFromStats(stats);

  // 1. Turn eaten + goal into a 0–1 ring progress value (memoized so the ring does not jitter).
  const calorieProgress = useMemo(
    () => caloriesProgressRatio(calories.current, calories.goal),
    [calories.current, calories.goal],
  );

  // 2. Name the numbers the hero card needs (?? keeps 0 calories alive — do not switch to ||).
  const currentCalories = Number(calories.current ?? 0);
  const goalCalories = Number(calories.goal ?? DEFAULT_CALORIE_GOAL);

  // 3. Paint TODAY label + calorie hero card.
  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>TODAY</Text>

      <CaloriesHeroCard
        current={currentCalories}
        goal={goalCalories}
        progress={calorieProgress}
        onPress={onPressCalories}
        onPressLogFood={onPressLogFood}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const cardStyles = StyleSheet.create({
  card: {
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  ringCol: {
    width: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rightCol: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 16,
    borderLeftWidth: 2.5,
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  ringSvg: {
    zIndex: 1,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  ringBig: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -1,
  },
  ringGoal: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    borderWidth: 2.5,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  metricCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.1,
    textTransform: 'uppercase',
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  metricUnit: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  metricDivider: {
    width: 2.5,
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  nutritionTouch: {
    marginTop: 12,
  },
  nutritionRow: {
    borderRadius: 12,
    borderWidth: 2.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  nutritionRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nutritionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  nutritionRowTitle: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
});

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.1,
    marginBottom: 12,
  },
});
