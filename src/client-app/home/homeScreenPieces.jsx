// Client home building blocks: greeting, stat rows, agenda, nutrition card, notes/files.
// Flow: theme tokens → stat cards → agenda / nutrition / notes. Each piece reads props; none own Firestore.
// Used by ClientMainScreen. HomeTopBanner is re-exported from the shared banner file.

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ColorText from '../../look-and-feel/ColorText';
import { HERO_TITLE_TEXT_GRADIENT } from '../../look-and-feel/brandColors';
import BlurredBackground from '../../look-and-feel/BlurredBackground';
import { getClientDateKey } from '../../helpers/dateStrings';
import {
  HOME_STAT_WORKOUT_GRADIENT,
  HOME_STAT_WATER_GRADIENT,
  HOME_STAT_SLEEP_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_ENERGY_GRADIENT,
  HOME_STAT_STRESS_GRADIENT,
  StatColorText,
} from '../../look-and-feel/homeStatColors';
import { DailyQuotePill } from '../../for-both/home-cards/DailyQuoteCard';
import HomeTopBanner, { getAuroraHeroGreeting } from '../../for-both/home-cards/HomeTopBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-video';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { calculateBMR, calculateTDEE } from '../../for-both/calorieAndMacroMath';
import styles, { SCREEN_WIDTH, STATS_ROW_PAD_H, STATS_ROW_CARD_GAP, CARD_GAP } from './homeLooks';

const LOTTIE_SORENESS_EMPTY = require('../../assets/sad reaction.json');
const LOTTIE_ENERGY_EMPTY = require('../../assets/Run Hamster... run.json');
const LOTTIE_STRESS_EMPTY = require('../../assets/Stressed Employee At Work.json');
const LOTTIE_NUTRITION_EMPTY = require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json');
const WORKOUT_EMPTY_ICON = require('../../assets/icons/workout.png');

// ===== NAMED CONSTANTS =====

const ACCENT_COLOR = '#7C3AED';
const DAYS_IN_WEEK = 7;
const SUNDAY_INDEX = 0;
const MONDAY_SHIFT_FROM_SUNDAY = -6;
const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_CALORIE_GOAL = 2000;
const POUNDS_PER_KILOGRAM = 2.20462;
const CM_PER_INCH = 2.54;
const WATER_GOAL_OZ = 8;
const WELLNESS_SCORE_MAX = 8;
const AGENDA_EXERCISE_PREVIEW = 8;
const AGENDA_BASE_MINUTES = 20;
const AGENDA_MINUTES_PER_EXERCISE = 12;
const AGENDA_MIN_MINUTES = 25;
const AGENDA_MAX_MINUTES = 75;
const SODIUM_LIMIT_MG = 2300;
const POTASSIUM_GOAL_MG = 3500;
const DEFAULT_FIBER_GOAL_G = 25;
const DEFAULT_SUGAR_LIMIT_G = 50;
const DEFAULT_EXTRA_NUTRIENT_GOAL = 25;
const PERCENT_SCALE = 100;
const HEX_SHORT_LENGTH = 3;
const HEX_FULL_LENGTH = 6;
const WORKOUT_FONT_START = 34;
const WORKOUT_FONT_FLOOR = 20;
const WORKOUT_FONT_STEP = 2;
const WORKOUT_FONT_WIDTH_FACTOR = 0.52;
const FAT_LOSS_CALORIE_CUT = 500;
const MUSCLE_CALORIE_SURPLUS = 300;
const ATHLETIC_CALORIE_SURPLUS = 500;
const DAYS_VERY_ACTIVE = 6;
const DAYS_ACTIVE = 4;
const DAYS_MODERATE = 3;
const DAYS_LIGHT = 1;
const SHIMMER_DURATION_MS = 520;
const SHIMMER_GAP_MS = 1100;
const DEFAULT_NUTRITION_CARD_GOAL = 2500;
const COMPACT_RING_STROKE = 7;
const DEFAULT_PROTEIN_TARGET = 150;
const DEFAULT_CARBS_TARGET = 250;
const DEFAULT_FAT_TARGET = 70;

const NUT_DONUT_CALORIES_GRADIENT = ['#DB2777', '#C2410C'];
const NUT_DONUT_MACRO_GRADIENTS = {
  protein: ['#6D28D9', '#FDE68A'],
  carbs: ['#FBBF24', '#FB7185'],
  fat: ['#6D28D9', '#DB2777'],
};

const EXTRA_NUTRIENT_RULES = {
  Fiber: { goal: DEFAULT_FIBER_GOAL_G, color: '#22C55E' },
  Sugar: { goal: DEFAULT_SUGAR_LIMIT_G, color: '#F97316' },
  Sodium: { goal: SODIUM_LIMIT_MG, color: '#06B6D4' },
  Potassium: { goal: POTASSIUM_GOAL_MG, color: '#C084FC' },
};

// ===== HELPER FUNCTIONS =====

/**
 * Light/dark style tokens for the home cards.
 * @param {boolean} isDark
 * @param {object} colors
 * @returns {object}
 */
const getPremiumTheme = (isDark, colors) => {
  const text = isDark ? '#FFFFFF' : 'rgba(15,23,42,0.92)';
  const subtext = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.58)';
  const label = isDark ? 'rgba(255,255,255,0.50)' : 'hsla(222, 47.40%, 11.20%, 0.45)';
  const icon = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)';

  return {
    blurTint: isDark ? 'dark' : 'light',
    cardBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
    cardBgStrong: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.86)',
    border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    borderSubtle: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    text,
    subtext,
    label,
    icon,
    background: homeCardBackground(isDark, colors),
  };
};

function homeCardBackground(isDark, colors) {
  if (isDark) return '#0A0A0F';
  return colors?.background ?? '#F2F2F7';
}

function statKickerColor(isDark, colors) {
  if (isDark) return 'rgba(255,255,255,0.72)';
  return colors?.textSecondary ?? '#6B7280';
}

function statFootnoteColor(isDark, colors) {
  if (isDark) return 'rgba(255,255,255,0.58)';
  return colors?.textSecondary ?? '#6B7280';
}

function cardTiltDegrees(cardIndex) {
  if (cardIndex % 2 === 0) return '-1.2deg';
  return '1.2deg';
}

function agendaTextureColorList(isDark) {
  if (isDark) return ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'rgba(192,132,252,0.08)'];
  return ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0)', 'rgba(192,132,252,0.10)'];
}

function agendaCardColors(isEmpty, isDark) {
  if (isEmpty && isDark) return ['#1B1430', '#14101F', '#1A120E'];
  if (isEmpty) return ['#F8F5FF', '#FFFFFF', '#FFF7ED'];
  if (isDark) return ['#1A1F2E', '#0F1419'];
  return ['#FFFFFF', '#F3F4F6'];
}

function agendaEmptyAmbientColors(isDark) {
  if (isDark) {
    return ['rgba(109,40,217,0.28)', 'rgba(190,24,93,0.16)', 'rgba(194,65,12,0.18)', 'transparent'];
  }
  return ['rgba(109,40,217,0.12)', 'rgba(190,24,93,0.08)', 'rgba(194,65,12,0.10)', 'transparent'];
}

function agendaEmptyRuleColors(isDark) {
  if (isDark) {
    return ['transparent', 'rgba(190,24,93,0.55)', 'rgba(194,65,12,0.45)', 'transparent'];
  }
  return ['transparent', 'rgba(190,24,93,0.35)', 'rgba(194,65,12,0.28)', 'transparent'];
}

function agendaDurationColor(isDark) {
  if (isDark) return 'rgba(255,255,255,0.78)';
  return 'rgba(17,24,39,0.72)';
}

function agendaDotColor(isDark) {
  if (isDark) return 'rgba(255,255,255,0.35)';
  return 'rgba(10,10,15,0.28)';
}

function exerciseCountLabel(exerciseCount) {
  const count = exerciseCount || 0;
  if (count === 1) return '1 exercise';
  return `${count} exercises`;
}

function estimatedDurationLabel(estMinutes) {
  if (estMinutes) return `Est. ${estMinutes} min`;
  return 'Est. —';
}

function compactNutritionRings(nutrientsWithData, consumed, goal) {
  if (nutrientsWithData.length > 0) return nutrientsWithData.slice(0, 3);
  const roundedCalories = Math.round(Number(consumed) || 0);
  if (roundedCalories > 0) {
    return [{
      value: roundedCalories,
      goal,
      label: 'Calories',
      color: '#8B5CF6',
      gradientColors: NUT_DONUT_CALORIES_GRADIENT,
      unit: '',
    }];
  }
  return [];
}

function calorieBarColor(isDark) {
  if (isDark) return '#8B5CF6';
  return '#7C3AED';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const hexDigits = hex.replace('#', '').trim();
  const fullHex =
    hexDigits.length === HEX_SHORT_LENGTH
      ? hexDigits.split('').map((digit) => digit + digit).join('')
      : hexDigits;
  const colorInt = parseInt(fullHex, 16);
  if (Number.isNaN(colorInt) || fullHex.length !== HEX_FULL_LENGTH) return `rgba(0,0,0,${alpha})`;
  const red = (colorInt >> 16) & 255;
  const green = (colorInt >> 8) & 255;
  const blue = colorInt & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}

function titleCaseWords(text) {
  return String(text)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Human label for a stored goal key (lose_fat → Lose Fat).
 * @param {string} primaryGoal
 * @returns {string}
 */
const formatGoalLabel = (primaryGoal) => {
  if (!primaryGoal) return 'Active Goal';
  const goalKey = String(primaryGoal);
  if (goalKey === 'lose_fat') return 'Lose Fat';
  if (goalKey === 'build_muscle') return 'Build Muscle';
  if (goalKey === 'athletic_performance') return 'Athletic';
  return goalKey
    .replace(/_/g, ' ')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Display name for today's workout card — the real workout name (e.g. "Chest Day"), not "Workout".
 * @param {object} todayWorkout
 * @returns {string|null}
 */
const inferWorkoutType = (todayWorkout) => {
  const name = todayWorkout?.name || todayWorkout?.workoutName;
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  return titleCaseWords(trimmed);
};

function workoutNameFromDashboardSummary(dashboardWorkoutSummary) {
  const summary = String(dashboardWorkoutSummary).trim();
  const firstLine = summary.includes('\n') ? summary.split('\n')[0].trim() : summary;
  if (!firstLine) return null;
  return titleCaseWords(firstLine);
}

function pickWorkoutDisplayName(todayWorkout, dashboardWorkoutSummary) {
  if (todayWorkout) return inferWorkoutType(todayWorkout);
  if (dashboardWorkoutSummary) return workoutNameFromDashboardSummary(dashboardWorkoutSummary);
  return null;
}

function exerciseLinesFromWorkout(workout) {
  if (!workout) return [];
  if (Array.isArray(workout.exercises)) return workout.exercises.filter(Boolean).map((line) => String(line));
  if (typeof workout.exercises === 'string' && workout.exercises.trim()) {
    return workout.exercises
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function estimateAgendaMinutes(exerciseCount) {
  if (!exerciseCount) return 0;
  return clamp(
    AGENDA_BASE_MINUTES + exerciseCount * AGENDA_MINUTES_PER_EXERCISE,
    AGENDA_MIN_MINUTES,
    AGENDA_MAX_MINUTES,
  );
}

function agendaTitleIconName(rawTitle) {
  const titleLower = rawTitle.toLowerCase();
  if (titleLower.includes('arm')) return 'fitness-outline';
  if (titleLower.includes('leg')) return 'walk-outline';
  if (titleLower.includes('chest')) return 'barbell-outline';
  if (titleLower.includes('back')) return 'body-outline';
  if (titleLower.includes('rest')) return 'leaf-outline';
  return 'flash-outline';
}

function splitAgendaExerciseLine(line) {
  const dashIdx = line.search(/\s[-–—]\s/);
  const parenIdx = line.indexOf('(');
  let name = line;
  let sets = '';
  if (dashIdx > -1) {
    name = line.slice(0, dashIdx).trim();
    sets = line.slice(dashIdx + 1).trim();
  } else if (parenIdx > -1) {
    name = line.slice(0, parenIdx).trim();
    sets = line.slice(parenIdx).trim().replace(/^\(/, '').replace(/\)$/, '').trim();
  }
  return { name, sets };
}

function numericFromNutrientValue(value) {
  return parseFloat(String(value ?? '').replace(/[^\d.]/g, ''));
}

function macroRowsFromMacros(macros, nutritionGoals) {
  return (macros || []).map((macro) => {
    const numericValue = numericFromNutrientValue(macro.value);
    let goal = nutritionGoals?.fatTarget || DEFAULT_FAT_TARGET;
    let color = '#06B6D4';
    let gradientColors = NUT_DONUT_MACRO_GRADIENTS.fat;
    if (macro.label === 'Protein') {
      goal = nutritionGoals?.proteinTarget || DEFAULT_PROTEIN_TARGET;
      color = '#EC4899';
      gradientColors = NUT_DONUT_MACRO_GRADIENTS.protein;
    }
    if (macro.label === 'Carbs') {
      goal = nutritionGoals?.carbsTarget || DEFAULT_CARBS_TARGET;
      color = '#F97316';
      gradientColors = NUT_DONUT_MACRO_GRADIENTS.carbs;
    }
    return {
      ...macro,
      value: numericValue,
      goal,
      color,
      gradientColors,
      unit: 'g',
    };
  });
}

function extraNutrientRow(nutrient) {
  const rule = EXTRA_NUTRIENT_RULES[nutrient.label] || {
    goal: DEFAULT_EXTRA_NUTRIENT_GOAL,
    color: '#22C55E',
  };
  const numericValue = numericFromNutrientValue(nutrient.value);
  const unit = String(nutrient.value ?? '').includes('mg') ? 'mg' : 'g';
  return {
    label: nutrient.label,
    value: numericValue,
    goal: rule.goal,
    color: rule.color,
    unit,
    icon: nutrient.icon,
  };
}

function workoutFontSizeForCard(displayWorkoutType, cardWidth) {
  if (!displayWorkoutType) return WORKOUT_FONT_START;
  const maxWidth = Math.max(96, cardWidth - 28);
  const letterCount = String(displayWorkoutType).length;
  let size = WORKOUT_FONT_START;
  while (size > WORKOUT_FONT_FLOOR && letterCount * size * WORKOUT_FONT_WIDTH_FACTOR > maxWidth) {
    size -= WORKOUT_FONT_STEP;
  }
  return size;
}

const LiquidGlassStatCard = ({ isDark, colors, children, style, centerContent }) => {
  const surface = colors?.surface;
  const border = colors?.border;
  const shadow = colors?.black;
  const cardFill = isDark ? hexToRgba(surface, 0.35) : hexToRgba(surface, 0.75);
  const cardBorder = isDark ? hexToRgba(border, 0.6) : hexToRgba(border, 0.75);

  return (
    <View style={[styles.statCardShadow, { shadowColor: shadow }, style]}>
      <BlurredBackground intensity={28} tint={isDark ? 'dark' : 'light'} style={styles.statCardBlur}>
        <View
          style={[
            styles.statCardInner,
            centerContent && styles.statCardInnerCentered,
            {
              backgroundColor: cardFill,
              borderColor: cardBorder,
            },
          ]}
        >
          {children}
        </View>
      </BlurredBackground>
    </View>
  );
};

// Circle progress ui components for nutrition stats on client home screen  
const CircularProgress = ({ progress = 0, size = 72, strokeWidth = 8, trackColor, progressColor }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = clamp(progress, 0, 1);
  const dashOffset = circumference * (1 - clampedProgress);

  // the geometry of the circle progress bar
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        rotation={-90}
        originX={size / 2}
        originY={size / 2}
      />
    </Svg>
  );
};

// Home stat card value gradients live in ../../../look-and-feel/homeStatColors.js

// Light-mode readability: draw a dark "outline" layer behind the value.
// We keep it subtle (shadow-based) so it doesn't look chunky.
const LightModeOutlineText = ({ enabled, children, style, align = 'center', numberOfLines }) => {
  if (!enabled) return null;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        style,
        {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          textAlign: align,
          color: 'rgba(0,0,0,0.92)',
          textShadowColor: 'rgba(0,0,0,0.85)',
          textShadowOffset: { width: 0, height: 0 },
          textShadowRadius: 2.2,
        },
      ]}
    >
      {children}
    </Text>
  );
};

const FightyBouncyCardWrap = ({ index = 0, width, children, onPress, activeOpacity = 0.9, disableAnimations = false }) => {
  const press = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (disableAnimations) return;
    shimmer.setValue(-1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(650 + index * 120),
        Animated.timing(shimmer, { toValue: 1, duration: SHIMMER_DURATION_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(SHIMMER_GAP_MS),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [disableAnimations, index, shimmer]);

  const onPressIn = () => {
    if (disableAnimations) return;
    Animated.timing(press, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (disableAnimations) return;
    Animated.spring(press, { toValue: 0, speed: 28, bounciness: 16, useNativeDriver: true }).start();
  };

  const shimmerWidth = Math.max(90, Math.round((width ?? 160) * 0.55));
  const shimmerX = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-(width ?? 160), width ?? 160],
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [-1, -0.25, 0, 0.25, 1],
    outputRange: [0, 0.0, 0.28, 0.0, 0],
  });
  const tiltDegrees = cardTiltDegrees(index);

  if (disableAnimations) {
    return (
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress}>
        <View style={{ width: '100%' }}>{children}</View>
      </TouchableOpacity>
    );
  }

  return (
    <Animated.View
      style={{
        transform: [
          { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) },
          { rotateZ: press.interpolate({ inputRange: [0, 1], outputRange: ['0deg', tiltDegrees] }) },
          { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
        ],
      }}
    >
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={{ width: '100%' }}>
          {children}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -18,
              bottom: -18,
              left: '50%',
              marginLeft: -Math.round(shimmerWidth / 2),
              width: shimmerWidth,
              opacity: shimmerOpacity,
              transform: [{ translateX: shimmerX }, { rotateZ: '14deg' }],
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 22 }}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ===== MAIN FUNCTION =====

// First row: day of workout (ex: Chest Day) / water / sleep — logo-aligned gradient, slightly softened (no grey)
const TopStatsRow = ({
  isDark,
  themeMode,
  colors,
  todayWorkout,
  dashboardWorkoutSummary,
  waterIntake,
  sleepHours,
  primaryGoal,
  goalProgress,
  onPlanWorkout,
  onOpenDashboard,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  // Live window width (not module-level Dimensions) — fixes Expo Go on device where initial width is wrong and cards look full-width.
  const cardWidth = Math.max(
    132,
    Math.floor((windowWidth - STATS_ROW_PAD_H - STATS_ROW_CARD_GAP) / 2),
  );
  const accent = ACCENT_COLOR;
  const primary = colors?.primary ?? accent;
  const workoutType = pickWorkoutDisplayName(todayWorkout, dashboardWorkoutSummary);
  const displayWorkoutType = workoutType;
  const workoutFontSize = workoutFontSizeForCard(displayWorkoutType, cardWidth);
  const workoutTextStyle = [
    styles.statGradientNumber,
    styles.statGradientWorkoutText,
    {
      fontWeight: '800',
      fontSize: workoutFontSize,
      lineHeight: workoutFontSize + 4,
      width: '100%',
      alignSelf: 'stretch',
    },
  ];
  const isRestDay = workoutType === 'Rest Day';

  const fallbackBorder = isDark ? '#38383A' : '#E5E5E7';
  const border = colors?.border ?? fallbackBorder;
  const borderAlpha = isDark ? 0.5 : 0.55;
  const track = hexToRgba(border, borderAlpha);

  const waterVal = typeof waterIntake === 'number' ? waterIntake : null;
  const waterGoal = WATER_GOAL_OZ;
  const waterPct = waterVal === null ? 0 : clamp(waterVal / waterGoal, 0, 1);

  const sleepVal = typeof sleepHours === 'number' ? sleepHours : null;

  const goalLabel = formatGoalLabel(primaryGoal);
  const goalProgressRatio = typeof goalProgress === 'number' ? clamp(goalProgress, 0, 1) : null;

  const kickerColor = statKickerColor(isDark, colors);
  const footnoteColor = statFootnoteColor(isDark, colors);

  return (
    <View style={styles.statsRowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRowContent}
        decelerationRate="fast"
      >
        {/* Card 1 — Workout */}
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={0} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: cardWidth }}>
              <Text style={[styles.statKicker, { color: kickerColor }]}>TODAY'S WORKOUT</Text>
              {displayWorkoutType ? (
                <View style={styles.statGradientBlock}>
                  <View style={{ position: 'relative', width: '100%' }}>
                    <LightModeOutlineText
                      enabled={!isDark}
                      style={workoutTextStyle}
                      align="center"
                      numberOfLines={2}
                    >
                      {displayWorkoutType}
                    </LightModeOutlineText>
                    <StatColorText
                      textProps={{ numberOfLines: 2 }}
                      style={workoutTextStyle}
                      colors={HOME_STAT_WORKOUT_GRADIENT}
                    >
                      {displayWorkoutType}
                    </StatColorText>
                  </View>
                  <Text style={[styles.statGradientLabel, { color: footnoteColor }]}>today's workout</Text>
                </View>
              ) : (
                <View style={styles.statEmpty}>
                  <LottieView
                    source={require('../../assets/animations/legacy/boxer lottie.json')}
                    autoPlay
                    loop
                    style={styles.statEmptyLottie}
                  />
                  <Text style={[styles.statEmptyText, { color: colors?.textSecondary }]}>No workout planned yet</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        {/* Card 2 — Water */}
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={1} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: cardWidth }}>
              <Text style={[styles.statKicker, { color: kickerColor }]}>WATER INTAKE</Text>
              {waterVal !== null ? (
                <View style={styles.statGradientBlock}>
                  <View style={{ position: 'relative', width: '100%' }}>
                    <LightModeOutlineText enabled={!isDark} style={[styles.statGradientNumber, { fontWeight: '800' }]} align="center">
                      {waterVal}
                    </LightModeOutlineText>
                    <StatColorText style={[styles.statGradientNumber, { fontWeight: '800' }]} colors={HOME_STAT_WATER_GRADIENT}>
                      {waterVal}
                    </StatColorText>
                  </View>
                  <Text style={[styles.statGradientLabel, { color: footnoteColor }]}>oz water</Text>
                </View>
              ) : (
                <View style={styles.statEmpty}>
                  <LottieView
                    source={require('../../assets/animations/legacy/glass water.json')}
                    autoPlay
                    loop
                    style={styles.statEmptyLottie}
                  />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.statEmptyCta, { color: colors?.textSecondary }]}>Log Water →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        {/* Card 3 — Sleep */}
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={2} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: cardWidth }}>
              <Text style={[styles.statKicker, { color: kickerColor }]}>SLEEP</Text>
              {sleepVal !== null ? (
                <View style={styles.statGradientBlock}>
                  <View style={{ position: 'relative', width: '100%' }}>
                    <LightModeOutlineText enabled={!isDark} style={[styles.statGradientNumber, { fontWeight: '800' }]} align="center">
                      {sleepVal}
                    </LightModeOutlineText>
                    <StatColorText style={[styles.statGradientNumber, { fontWeight: '800' }]} colors={HOME_STAT_SLEEP_GRADIENT}>
                      {sleepVal}
                    </StatColorText>
                  </View>
                  <Text style={[styles.statGradientLabel, { color: footnoteColor }]}>hours of sleep</Text>
                </View>
              ) : (
                <View style={styles.statEmpty}>
                  <LottieView
                    source={require('../../assets/animations/legacy/sleep.json')}
                    autoPlay
                    loop
                    style={styles.statEmptyLottie}
                  />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.statEmptyCta, { color: colors?.textSecondary }]}>Log Sleep →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        
      </ScrollView>
    </View>
  );
};

// Second row: Soreness, Energy Level, Stress Level — smaller type, teal/indigo color combo
function formatWellnessScore(rawValue, max) {
  if (rawValue == null || rawValue === '') return null;
  const raw = String(rawValue).trim();
  if (raw.includes('%')) return raw;
  const slash = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  const scoreNumber = slash ? Number(slash[1]) : Number(raw);
  const scaleMax = slash ? Number(slash[2]) : max;
  if (!Number.isFinite(scoreNumber) || !Number.isFinite(scaleMax) || scaleMax <= 0) return raw;
  const clamped = Math.max(0, Math.min(scaleMax, scoreNumber));
  const pct = Math.round((clamped / scaleMax) * PERCENT_SCALE);
  return `${pct}%`;
}

const wellnessKicker = {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.6,
  textAlign: 'center',
  width: '100%',
}; 
const wellnessNumber = {
  fontSize: 38,
  fontWeight: '800',
  lineHeight: 42,
  textAlign: 'center',
};
const wellnessLabel = { fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'center' };
const wellnessEmptyText = { fontSize: 11, fontWeight: '600', textAlign: 'center' };

const WellnessStatsRow = ({ isDark, colors, soreness, energyLevel, stressLevel, onOpenDashboard }) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.max(
    132,
    Math.floor((windowWidth - STATS_ROW_PAD_H - STATS_ROW_CARD_GAP) / 2),
  );
  const kickerColor = statKickerColor(isDark, colors);
  const footnoteColor = statFootnoteColor(isDark, colors);
  return (
    <View style={styles.statsRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRowContent} decelerationRate="fast">
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={0} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: '100%' }} centerContent>
              <Text style={[wellnessKicker, { color: kickerColor }]}>SORENESS</Text>
              {soreness != null && soreness !== '' ? (
                <View style={styles.statWellnessValueBlock}>
                  <View style={{ position: 'relative', width: '100%' }}>
                    <LightModeOutlineText enabled={!isDark} style={wellnessNumber} align="center">
                      {formatWellnessScore(soreness, WELLNESS_SCORE_MAX) || soreness}
                    </LightModeOutlineText>
                    <StatColorText style={wellnessNumber} colors={HOME_STAT_SORENESS_GRADIENT}>
                      {formatWellnessScore(soreness, WELLNESS_SCORE_MAX) || soreness}
                    </StatColorText>
                  </View>
                  <Text style={[wellnessLabel, { color: footnoteColor }]}>muscle soreness</Text>
                </View>
              ) : (
                <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_SORENESS_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.wellnessEmptyCta, { color: colors?.textSecondary }]}>Log Soreness →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={1} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: '100%' }} centerContent>
              <Text style={[wellnessKicker, { color: kickerColor }]}>ENERGY LEVEL</Text>
              {energyLevel != null && energyLevel !== '' ? (
                <View style={styles.statWellnessValueBlock}>
                  <View style={{ position: 'relative', width: '100%' }}>
                    <LightModeOutlineText enabled={!isDark} style={wellnessNumber} align="center">
                      {formatWellnessScore(energyLevel, WELLNESS_SCORE_MAX) || energyLevel}
                    </LightModeOutlineText>
                    <StatColorText style={wellnessNumber} colors={HOME_STAT_ENERGY_GRADIENT}>
                      {formatWellnessScore(energyLevel, WELLNESS_SCORE_MAX) || energyLevel}
                    </StatColorText>
                  </View>
                  <Text style={[wellnessLabel, { color: footnoteColor }]}>today</Text>
                </View>
              ) : (
                <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_ENERGY_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.wellnessEmptyCta, { color: colors?.textSecondary }]}>Rate Energy →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={2} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: '100%' }} centerContent>
              <Text style={[wellnessKicker, { color: kickerColor }]}>STRESS LEVEL</Text>
              {stressLevel != null && stressLevel !== '' ? (
                <View style={styles.statWellnessValueBlock}>
                  <View style={{ position: 'relative', width: '100%' }}>
                    <LightModeOutlineText enabled={!isDark} style={wellnessNumber} align="center">
                      {formatWellnessScore(stressLevel, WELLNESS_SCORE_MAX) || stressLevel}
                    </LightModeOutlineText>
                    <StatColorText style={wellnessNumber} colors={HOME_STAT_STRESS_GRADIENT}>
                      {formatWellnessScore(stressLevel, WELLNESS_SCORE_MAX) || stressLevel}
                    </StatColorText>
                  </View>
                  <Text style={[wellnessLabel, { color: footnoteColor }]}>today</Text>
                </View>
              ) : (
                <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_STRESS_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.wellnessEmptyCta, { color: colors?.textSecondary }]}>Log Stress →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>
      </ScrollView>
    </View>
  );
};

const GreetingSection = ({ userName = "User", theme, isDark }) => {
  const dark = isDark ?? (theme === 'dark');
  return (
    <View style={styles.greetingSection}>
      {/* Keep greeting logic — just style/layout changes */}
      <View style={styles.greetingLineWrap}>
        <Text style={[styles.greetingTitle, { color: dark ? '#FFFFFF' : '#111827' }]}>
          Good {getAuroraHeroGreeting()},
        </Text>
        <ColorText
          style={[styles.greetingTitle, { marginLeft: 6 }]}
          colors={['#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {userName}!
        </ColorText>
      </View>
    </View>
  );
};

function datesForThisWeekMondayFirst() {
  const today = new Date();
  const currentDay = today.getDay();
  const daysBackToMonday = currentDay === SUNDAY_INDEX ? MONDAY_SHIFT_FROM_SUNDAY : 1;
  const diff = today.getDate() - currentDay + daysBackToMonday;
  const monday = new Date(today.setDate(diff));
  const weekDays = [];
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    weekDays.push(date);
  }
  return weekDays;
}

const NewCalendar = ({ theme }) => {
  const isDark = theme === 'dark';
  const weekDays = datesForThisWeekMondayFirst();
  const today = getClientDateKey();

  return (
    <View style={styles.calendarContainer}>
      <View
        style={[
          styles.weekCalendar,
          !isDark && styles.lightCard,
          {
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
            borderRadius: 16,
          },
        ]}
      >
          <View style={styles.weekHeader}>
            <Text style={[styles.weekHeaderText, !isDark && styles.lightText]}>This Week</Text>
          </View>
          <View style={styles.weekDays}>
            {weekDays.map((day, index) => {
              const dayStr = day.toISOString().split('T')[0];
              const isToday = dayStr === today;
              const dayName = WEEKDAY_NAMES[index];
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.weekDay, 
                    isToday && styles.weekDayToday,
                    !isDark && styles.lightWeekDay
                  ]}
                >
                  <Text style={[styles.weekDayName, !isDark && styles.lightMutedText]}>
                    {dayName}
                  </Text>
                  <Text style={[
                    styles.weekDayNumber, 
                    isToday && styles.weekDayNumberToday,
                    !isDark && styles.lightText
                  ]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
    </View>
  );
};

function AgendaExerciseList({ shownExercises, itemAnims, dotColor, textColor, mutedColor }) {
  return (
    <View style={styles.agendaExercisesWrap}>
      {shownExercises.map((line, i) => {
        const { name, sets } = splitAgendaExerciseLine(line);
        let setsLine = null;
        if (sets) {
          setsLine = (
            <Text style={[styles.agendaExerciseSets, { color: mutedColor }]} numberOfLines={2}>
              {sets}
            </Text>
          );
        }
        return (
          <Animated.View
            key={`${line}_${i}`}
            style={{
              opacity: itemAnims[i],
              transform: [
                {
                  translateY: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                },
              ],
            }}
          >
            <View style={styles.agendaExerciseRowPremium}>
              <View style={[styles.agendaDot, { backgroundColor: dotColor }]} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.agendaExerciseName, { color: textColor }]} numberOfLines={1}>
                  {name}
                </Text>
                {setsLine}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

function AgendaFocusBody({ isEmpty, mutedColor, shownExercises, itemAnims, dotColor, textColor, emptyRuleColors }) {
  if (isEmpty) {
    return (
      <View style={styles.agendaEmptyStage}>
        <LinearGradient
          colors={HERO_TITLE_TEXT_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.agendaEmptyIconWrap}
        >
          <Ionicons name="barbell-outline" size={22} color="#FFFFFF" />
        </LinearGradient>
        <ColorText
          colors={HERO_TITLE_TEXT_GRADIENT}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.agendaEmptyHeadline}
        >
          Ready when you are
        </ColorText>
        <Text style={[styles.agendaEmptySubcopy, { color: mutedColor }]}>
          No lifts on the board yet — today's agenda is wide open.
        </Text>
        <LinearGradient
          colors={emptyRuleColors}
          locations={[0, 0.35, 0.65, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.agendaEmptyRule}
        />
      </View>
    );
  }

  return (
    <AgendaExerciseList
      shownExercises={shownExercises}
      itemAnims={itemAnims}
      dotColor={dotColor}
      textColor={textColor}
      mutedColor={mutedColor}
    />
  );
}

// Training agenda: Today's workouts list with checkboxes and structured exercises.
const TrainingAgenda = ({ theme, workouts = [] }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const mutedColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(17,24,39,0.58)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const subtleFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const agendaTextureColors = agendaTextureColorList(isDark);

  const firstWorkout = (workouts || [])[0] || null;
  const rawTitle = String(firstWorkout?.name || firstWorkout?.workoutName || 'Training Agenda').trim();

  const exercises = exerciseLinesFromWorkout(firstWorkout);

  const exerciseCount = exercises.length;
  const isEmpty = exerciseCount === 0;
  const agendaBgColors = agendaCardColors(isEmpty, isDark);
  const emptyAmbientColors = agendaEmptyAmbientColors(isDark);
  const emptyRuleColors = agendaEmptyRuleColors(isDark);
  const durationColor = agendaDurationColor(isDark);
  const dotColor = agendaDotColor(isDark);
  const exerciseLabel = exerciseCountLabel(exerciseCount);

  const estMinutes = estimateAgendaMinutes(exerciseCount);
  const durationLabel = estimatedDurationLabel(estMinutes);
  const titleIconName = agendaTitleIconName(rawTitle);

  const nowTime = useRef(new Date()).current;
  const timestamp = nowTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Animations: card entrance + cascade items
  const enter = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef([]).current;
  const shownExercises = exercises.slice(0, AGENDA_EXERCISE_PREVIEW);
  while (itemAnims.length < shownExercises.length) itemAnims.push(new Animated.Value(0));

  useEffect(() => {
    enter.setValue(0);
    itemAnims.forEach((v) => v.setValue(0));

    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (shownExercises.length) {
      Animated.stagger(
        100,
        shownExercises.map((_, i) =>
          Animated.timing(itemAnims[i], {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
  }, [enter, exercises.length]);

  return (
    <View style={styles.agendaContainer}>
      <Text
        style={[
          styles.sectionTitle,
          !isDark && styles.lightText,
          {
            fontFamily: Platform.select({
              ios: 'SpaceGrotesk_600SemiBold',
              android: 'SpaceGrotesk_600SemiBold',
              default: 'SpaceGrotesk_600SemiBold',
            }),
          },
        ]}
      >
        Training Agenda Today
      </Text>
      <View
        style={[
          styles.agendaColorBorder,
          {
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
            borderRadius: 18,
            padding: 0,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.agendaCardInner,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                },
              ],
            },
          ]}
        >
          {/* Rich background */}
          <LinearGradient
            colors={agendaBgColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.agendaBg}
          >
            {/* Subtle texture */}
            <LinearGradient
              colors={agendaTextureColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.agendaTexture}
            />
            {isEmpty ? (
              <LinearGradient
                colors={emptyAmbientColors}
                locations={[0, 0.35, 0.7, 1]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={styles.agendaEmptyAmbient}
                pointerEvents="none"
              />
            ) : null}
            <View style={styles.agendaPad}>
              <View style={styles.agendaHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agendaSubtitle, { color: mutedColor }]}>TODAY'S FOCUS</Text>
                  <View style={styles.agendaTitleRow}>
                    <View
                      style={[
                        styles.agendaTitleIconWrap,
                        { backgroundColor: subtleFill, borderColor: subtleBorder },
                      ]}
                    >
                      <Ionicons name={titleIconName} size={16} color={textColor} />
                    </View>
                    <Text style={[styles.agendaTitle, { color: textColor }]} numberOfLines={1}>
                      {rawTitle || 'Training Agenda'}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.agendaBadge,
                    { backgroundColor: subtleFill, borderColor: subtleBorder },
                  ]}
                >
                  <Text style={[styles.agendaBadgeText, { color: textColor }]}>
                    {exerciseLabel}
                  </Text>
                </View>
              </View>

              <AgendaFocusBody
                isEmpty={isEmpty}
                mutedColor={mutedColor}
                shownExercises={shownExercises}
                itemAnims={itemAnims}
                dotColor={dotColor}
                textColor={textColor}
                emptyRuleColors={emptyRuleColors}
              />

              {/* Footer */}
              <View style={styles.agendaFooterRow}>
                <Text style={[styles.agendaDuration, { color: durationColor }]}>
                  {durationLabel}
                </Text>
                <Text style={[styles.agendaTimestamp, { color: mutedColor }]}>{timestamp}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </View>
  );
};

// Nutrition card: Daily macros + calories progress (empty state is Lottie + copy only).
const NutritionCard = ({ theme, consumed = 0, goal = DEFAULT_NUTRITION_CARD_GOAL, macros = null, additionalNutrients = null, nutritionGoals = null, compact = true }) => {
  const isDark = theme === 'dark';

  const allNutrients = [];
  if (macros) {
    allNutrients.push(...macroRowsFromMacros(macros, nutritionGoals));
  }
  if (additionalNutrients) {
    additionalNutrients.forEach((nutrient) => {
      allNutrients.push(extraNutrientRow(nutrient));
    });
  }

  const pct = goal > 0 ? Math.min(PERCENT_SCALE, (consumed / goal) * PERCENT_SCALE) : 0;
  const hasLoggedNutrition =
    Math.round(Number(consumed) || 0) > 0 ||
    (allNutrients || []).some((n) => Number(n.value) > 0);

  const textPrimary = isDark ? '#FFFFFF' : '#1a1040';
  const textMuted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(26,16,64,0.6)';
  const trackColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  // Arc progress — one circle with value in center, label below
  const ClientArcProgress = ({ value, goal, label, color, unit, gradientColors }) => {
    const progress = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    // Compact for home feed (reduces overall card height).
    const size = compact ? 78 : 72;
    const strokeWidth = compact ? COMPACT_RING_STROKE : 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress / 100);
    const gradId = `clientNutGrad-${String(label || 'x').replace(/\s+/g, '-')}`;
    return (
      <View style={styles.nutritionCircleWrap}>
        <View style={{ width: size, height: size }}>
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {Array.isArray(gradientColors) && gradientColors.length >= 2 ? (
                <Defs>
                  <SvgLinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
                    <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
                  </SvgLinearGradient>
                </Defs>
              ) : null}
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
              <Circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={Array.isArray(gradientColors) && gradientColors.length >= 2 ? `url(#${gradId})` : color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[styles.nutritionCircleValue, { color: textPrimary }]}>
              {Math.round(progress)}%
            </Text>
          </View>
        </View>
        <Text style={[styles.nutritionCircleLabel, { color: textMuted, marginTop: 6 }]}>{label}</Text>
      </View>
    );
  };

  // 2x2 grid: row0 = Protein, Carbs; row1 = Fats, Calories
  const caloriesProgress = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;

  const nutrientsWithData = (allNutrients || []).filter((nutrient) => Number(nutrient.value) > 0);
  const compactRings = compactNutritionRings(nutrientsWithData, consumed, goal);
  const gridNutrients = nutrientsWithData.length > 0 ? nutrientsWithData.slice(0, 3) : [];
  const roundedCalories = Math.round(Number(consumed) || 0);
  const showCalorieRing = roundedCalories > 0;
  const barColor = calorieBarColor(isDark);
  const calorieSummary = `${Math.round(consumed)} / ${goal} kcal`;
  const barWidth = `${Math.min(pct, 100)}%`;
  let nutritionBorderColor = 'rgba(10,10,15,0.08)';
  if (isDark) nutritionBorderColor = 'rgba(255,255,255,0.10)';

  const ringCells = (rings, cellStyle) => rings.map((ring) => (
    <View key={ring.label} style={cellStyle}>
      <ClientArcProgress
        value={ring.value}
        goal={ring.goal}
        label={ring.label}
        color={ring.color}
        gradientColors={ring.gradientColors}
        unit={ring.unit}
      />
    </View>
  ));

  let nutritionRings = (
    <View style={styles.nutritionGrid2x2}>
      {ringCells(gridNutrients, styles.nutritionGridCell)}
      {showCalorieRing ? (
        <View style={styles.nutritionGridCell}>
          <ClientArcProgress
            value={roundedCalories}
            goal={goal}
            label="Calories"
            color="#8B5CF6"
            gradientColors={NUT_DONUT_CALORIES_GRADIENT}
            unit=""
          />
        </View>
      ) : null}
    </View>
  );
  if (compact) {
    nutritionRings = (
      <View style={styles.nutritionCompactCirclesRow}>
        {ringCells(compactRings, styles.nutritionCompactCircleCell)}
      </View>
    );
  }

  let calorieTrackStyle = [styles.progressBarBackground, { backgroundColor: '#E5E7EB' }];
  if (isDark) calorieTrackStyle = styles.progressBarBackground;

  const loggedNutritionBody = (
    <>
      {nutritionRings}
      <View style={styles.caloriesSection}>
        <View style={styles.caloriesInfo}>
          <Text style={[styles.caloriesLabel, { color: textMuted }]}>Calories</Text>
          <Text style={[styles.caloriesValue, { color: textPrimary }]}>{calorieSummary}</Text>
        </View>
        <View style={calorieTrackStyle}>
          <View style={[styles.progressBar, { width: barWidth, backgroundColor: barColor }]} />
        </View>
      </View>
    </>
  );

  const emptyNutritionBody = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        gap: 12,
      }}
    >
      <LottieView
        source={LOTTIE_NUTRITION_EMPTY}
        autoPlay
        loop
        style={{ width: 100, height: 100 }}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontSize: 15,
            fontWeight: '800',
            color: textPrimary,
            textAlign: 'left',
            letterSpacing: -0.2,
          }}
        >
          No meals logged yet
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            color: textMuted,
            textAlign: 'left',
            marginTop: 6,
            lineHeight: 19,
          }}
        >
          Open Nutrition to log food — macros and rings will show here.
        </Text>
      </View>
    </View>
  );

  let nutritionBody = loggedNutritionBody;
  if (!hasLoggedNutrition) nutritionBody = emptyNutritionBody;

  return (
    <View style={styles.nutritionContainer}>
      <Text
        style={[
          styles.sectionTitle,
          !isDark && styles.lightText,
          {
            fontFamily: Platform.select({
              ios: 'SpaceGrotesk_600SemiBold',
              android: 'SpaceGrotesk_600SemiBold',
              default: 'SpaceGrotesk_600SemiBold',
            }),
          },
        ]}
      >
        Nutrition Today
      </Text>
      <View
        style={[
          styles.nutritionColorBorder,
          {
            borderWidth: 1,
            borderColor: nutritionBorderColor,
            borderRadius: 18,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={[styles.nutritionCard, !isDark && styles.nutritionCardLight]}>
        {nutritionBody}
        </View>
      </View>
    </View>
  );
};

const NotesFiles = ({ theme, items = [], onOpenFile }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#fff' : '#1a1040';
  const mutedColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,16,64,0.6)';
  const fromYou = (items || []).filter((item) => (item.addedBy || 'client') === 'client');
  const fromTrainer = (items || []).filter((item) => item.addedBy === 'trainer' || (item.type === 'document' && item.trainerId));
  const hasAny = items.length > 0;

  const openUrl = (url, file) => {
    if (onOpenFile) onOpenFile(url, file);
    else if (url) Linking.openURL(url).catch(() => {});
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return '';
    const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
    return parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fileIcon = (file) => {
    if (file.type === 'spreadsheet') return 'grid-outline';
    if (file.type === 'document' || (file.documentId && file.trainerId)) return 'document-outline';
    if (file.type === 'pdf') return 'document-text-outline';
    if (file.type === 'photo') return 'image-outline';
    return 'attach-outline';
  };

  const fileTypeLabel = (file) => {
    if (file.type === 'spreadsheet') return 'Spreadsheet';
    if (file.type === 'document' || (file.documentId && file.trainerId)) return 'Document';
    if (file.type === 'pdf') return 'PDF';
    if (file.type === 'photo') return 'Image';
    return 'File';
  };

  const fileTypeLabelColor = (file) => {
    if (file.type === 'spreadsheet') return '#10B981';
    if (file.type === 'document' || (file.documentId && file.trainerId)) return '#64D2FF';
    return '#8A8A8A';
  };

  const renderBlock = (list, sectionTitle) => {
    const notes = (list || []).filter((item) => item.type === 'note');
    const photos = (list || []).filter((item) => item.type === 'photo');
    const videos = (list || []).filter((item) => item.type === 'video');
    const docs = (list || []).filter((item) => item.type === 'pdf' || item.type === 'doc');
    const spreadsheets = (list || []).filter((item) => item.type === 'spreadsheet');
    const trainerDocs = (list || []).filter((item) => item.type === 'document' || (item.documentId && item.trainerId));
    const allFiles = [...docs, ...spreadsheets, ...trainerDocs];
    if (list.length === 0) return null;
    return (
      <View key={sectionTitle} style={styles.notesSection}>
        <Text style={[styles.notesCategoryTitle, { color: mutedColor }]}>{sectionTitle}</Text>
        {notes.length > 0 && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Notes</Text>
            {(notes || []).map((note, i) => (
              <View key={note.id || i} style={[styles.notesNoteCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.notesNoteText, { color: textColor }]}>{note.content}</Text>
                <Text style={[styles.notesNoteDate, { color: mutedColor }]}>{formatDate(note.createdAt)}</Text>
              </View>
            ))}
          </>
        )}
        {(photos.length > 0 || videos.length > 0) && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Photos & Videos</Text>
            <View style={styles.notesMediaGrid}>
              {(photos || []).map((photo, i) => (
                <TouchableOpacity key={photo.id || i} onPress={() => photo.url && openUrl(photo.url, photo)} style={styles.notesMediaCard} activeOpacity={0.8}>
                  <Image source={{ uri: photo.url }} style={[styles.notesMediaThumb, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                  <Text style={[styles.notesMediaLabel, { color: mutedColor }]} numberOfLines={1}>{photo.name || 'Photo'}</Text>
                </TouchableOpacity>
              ))}
              {(videos || []).map((video, i) => (
                <TouchableOpacity key={video.id || i} onPress={() => video.url && openUrl(video.url, video)} style={styles.notesMediaCard} activeOpacity={0.8}>
                  <View style={[styles.notesMediaThumb, styles.notesVideoPlaceholder, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                    <Feather name="video" size={24} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'} />
                  </View>
                  <Text style={[styles.notesMediaLabel, { color: mutedColor }]} numberOfLines={1}>{video.name || 'Video'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {allFiles.length > 0 && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Files</Text>
            {(allFiles || []).map((file, i) => (
              <TouchableOpacity
                key={file.id || i}
                onPress={() => {
                  if (file.type === 'document' || (file.documentId && file.trainerId)) {
                    if (onOpenFile) onOpenFile(null, file);
                  } else if (file.url) {
                    openUrl(file.url, file);
                  }
                }}
                style={[styles.notesDocRow, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
                activeOpacity={0.8}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={fileIcon(file)} size={22} color={textColor} />
                </View>
                <View style={styles.notesFileInfo}>
                  <Text style={[styles.notesDocName, { color: textColor }]} numberOfLines={1}>{file.name || file.title || 'File'}</Text>
                  <Text style={[styles.notesFileMeta, { color: mutedColor }]}>{formatDate(file.createdAt)} · <Text style={{ color: fileTypeLabelColor(file), fontWeight: '600' }}>{fileTypeLabel(file)}</Text></Text>
                </View>
                {file.type !== 'document' && file.type !== 'spreadsheet' && <Feather name="external-link" size={18} color={mutedColor} />}
                {(file.type === 'document' || file.type === 'spreadsheet' || (file.documentId && file.trainerId)) && <Ionicons name="chevron-forward" size={20} color={mutedColor} />}
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.notesContainer}>
      <Text
        style={[
          styles.sectionTitle,
          !isDark && styles.lightText,
          {
            fontFamily: Platform.select({
              ios: 'SpaceGrotesk_600SemiBold',
              android: 'SpaceGrotesk_600SemiBold',
              default: 'SpaceGrotesk_600SemiBold',
            }),
          },
        ]}
      >
        Notes & Files
      </Text>
      <LinearGradient
        colors={['#C084FC', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.notesColorBorder}
      >
        <View style={[styles.notesCardInner, isDark ? styles.notesCardDark : styles.notesCardLight]}>
          {!hasAny ? (
            <View style={styles.notesEmptyContent}>
              <Feather name="file-plus" size={40} color={mutedColor} />
              <Text style={[styles.notesEmptyText, { color: mutedColor }]}>You have no notes or files yet.</Text>
              <Text style={[styles.notesEmptySubtext, { color: mutedColor }]}>Tap the + button to add photos, videos, notes, or PDFs. Documents shared by your trainer appear under From trainer.</Text>
            </View>
          ) : (
            <View style={styles.notesContent}>
              {renderBlock(fromYou, 'From you')}
              {renderBlock(fromTrainer, 'From trainer')}
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

// Helper functions
function activityLevelFromDaysPerWeek(daysPerWeek) {
  if (daysPerWeek >= DAYS_VERY_ACTIVE) return 'very_active';
  if (daysPerWeek >= DAYS_ACTIVE) return 'active';
  if (daysPerWeek >= DAYS_MODERATE) return 'moderate';
  if (daysPerWeek >= DAYS_LIGHT) return 'light';
  return 'sedentary';
}

function calorieGoalFromTdee(primaryGoal, tdee) {
  if (primaryGoal === 'lose_fat') return Math.round(tdee - FAT_LOSS_CALORIE_CUT);
  if (primaryGoal === 'build_muscle') return Math.round(tdee + MUSCLE_CALORIE_SURPLUS);
  if (primaryGoal === 'athletic_performance') return Math.round(tdee + ATHLETIC_CALORIE_SURPLUS);
  return Math.round(tdee);
}

/**
 * Daily calorie target from weight (lbs), height (inches), age, and days trained.
 * @param {string} primaryGoal
 * @param {number} weight
 * @param {number} height
 * @param {number} age
 * @param {string} gender
 * @param {number} daysPerWeek
 * @returns {number}
 */
const calculateCalorieGoal = (primaryGoal, weight, height, age, gender, daysPerWeek) => {
  if (!weight || !height || !age || !gender) return DEFAULT_CALORIE_GOAL;
  const weightKg = weight / POUNDS_PER_KILOGRAM;
  const heightCm = height * CM_PER_INCH;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const activityLevel = activityLevelFromDaysPerWeek(daysPerWeek);
  const tdee = calculateTDEE(bmr, activityLevel);
  return calorieGoalFromTdee(primaryGoal, tdee);
};

/**
 * Consecutive days with a completed workout, counting back from today.
 * @param {object[]} completedWorkouts
 * @returns {number}
 */
const calculateStreak = (completedWorkouts) => {
  if (!completedWorkouts || completedWorkouts.length === 0) return 0;
  const sorted = [...completedWorkouts].sort((a, b) => {
    const aDate = a.completedAt?.toDate?.() || new Date(a.completedAt);
    const bDate = b.completedAt?.toDate?.() || new Date(b.completedAt);
    return bDate - aDate;
  });
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const workoutsByDate = {};
  sorted.forEach(workout => {
    const workoutDate = workout.completedAt?.toDate?.() || new Date(workout.completedAt);
    workoutDate.setHours(0, 0, 0, 0);
    const dateKey = workoutDate.toISOString().split('T')[0];
    if (!workoutsByDate[dateKey]) workoutsByDate[dateKey] = true;
  });
  let currentDate = new Date(today);
  while (workoutsByDate[currentDate.toISOString().split('T')[0]]) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  return streak;
};

export {
  getPremiumTheme,
  formatGoalLabel,
  inferWorkoutType,
  calculateCalorieGoal,
  calculateStreak,
  TopStatsRow,
  WellnessStatsRow,
  HomeTopBanner,
  GreetingSection,
  NewCalendar,
  TrainingAgenda,
  NutritionCard,
  NotesFiles,
  SCREEN_WIDTH,
  STATS_ROW_PAD_H,
  STATS_ROW_CARD_GAP,
  CARD_GAP,
};
