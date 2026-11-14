// Client home building blocks: greeting, stat rows, agenda, nutrition card, notes/files.
// Flow: theme tokens → stat cards → agenda / nutrition / notes. Each piece reads props; none own Firestore.
// Used by ClientMainScreen. HomeTopBanner is re-exported from the shared banner file.
// Read order: constants → UI helpers → exported rows/cards → PLUMBING (calorie goal / streak) at bottom.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import ColorText from '../../look-and-feel/ColorText';
import { HERO_TITLE_TEXT_GRADIENT } from '../../look-and-feel/brandColors';
import { getClientDateKey } from '../../helpers/dateStrings';
import { HOME_STAT_WORKOUT_GRADIENT, HOME_STAT_WATER_GRADIENT, HOME_STAT_SLEEP_GRADIENT, HOME_STAT_SORENESS_GRADIENT, HOME_STAT_ENERGY_GRADIENT, HOME_STAT_STRESS_GRADIENT, StatColorText } from '../../look-and-feel/homeStatColors';
import { DailyQuotePill } from '../../for-both/home-cards/DailyQuoteCard';
import HomeTopBanner, { getAuroraHeroGreeting } from '../../for-both/home-cards/HomeTopBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-video';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { calculateBMR, calculateTDEE } from '../../for-both/calorieAndMacroMath';
import styles, { SCREEN_WIDTH, STATS_ROW_PAD_H, STATS_ROW_CARD_GAP, CARD_GAP } from './homeLooks';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';
const LOTTIE_SORENESS_EMPTY = require('../../assets/sad reaction.json');
const LOTTIE_ENERGY_EMPTY = require('../../assets/Run Hamster... run.json');
const LOTTIE_STRESS_EMPTY = require('../../assets/Stressed Employee At Work.json');
const LOTTIE_NUTRITION_EMPTY = require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json');
const WORKOUT_EMPTY_ICON = require('../../assets/icons/workout.png');

// ===== NAMED CONSTANTS =====

// Design Law ink accent for home chrome (black/white system — not brand pink).
const ACCENT_COLOR = '#0A0A0A';
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
  protein: ['#FF6B9D', '#FB923C'],
  carbs: ['#FBBF24', '#FB7185'],
  fat: ['#E07A32', '#DB2777']
};
const EXTRA_NUTRIENT_RULES = {
  Fiber: {
    goal: DEFAULT_FIBER_GOAL_G,
    color: '#22C55E'
  },
  Sugar: {
    goal: DEFAULT_SUGAR_LIMIT_G,
    color: '#F97316'
  },
  Sodium: {
    goal: SODIUM_LIMIT_MG,
    color: '#06B6D4'
  },
  Potassium: {
    goal: POTASSIUM_GOAL_MG,
    color: '#FB923C'
  }
};

// ===== HELPER FUNCTIONS =====

/**
 * Light/dark style tokens for the home cards.
 * @param {boolean} isDark
 * @param {object} colors
 * @returns {object}
 */
function getPremiumTheme(isDark, colors) {
  // Solid nb surface tokens — no glass/blur fills on home cards.
  const textColor = isDark ? darkColors.nbInk : lightColors.nbInk;
  const mutedColor = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const blurTint = isDark ? 'dark' : 'light';
  const cardBackground = isDark ? darkColors.nbSurface : lightColors.nbSurface;
  const cardBackgroundStrong = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const borderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  return {
    blurTint,
    cardBg: cardBackground,
    cardBgStrong: cardBackgroundStrong,
    border: borderColor,
    borderSubtle: borderColor,
    text: textColor,
    subtext: mutedColor,
    label: mutedColor,
    icon: mutedColor,
    background: backgroundColorForHomeCard(isDark, colors)
  };
}
function backgroundColorForHomeCard(isDark, colors) {
  if (isDark) return darkColors.nbBackground;
  return (colors == null ? void 0 : colors.nbBackground) ?? lightColors.nbBackground;
}
function statKickerColor(isDark, colors) {
  if (isDark) return darkColors.nbMuted;
  return (colors == null ? void 0 : colors.nbMuted) ?? lightColors.nbMuted;
}
function statFootnoteColor(isDark, colors) {
  if (isDark) return darkColors.nbMuted;
  return (colors == null ? void 0 : colors.nbMuted) ?? lightColors.nbMuted;
}
function cardTiltDegrees(cardIndex) {
  if (cardIndex % 2 === 0) return '-1.2deg';
  return '1.2deg';
}
function agendaTextureColorList(isDark) {
  // Strip: brand wash, not purple mist.
  if (isDark) return [darkColors.nbSurfaceChip, 'transparent', 'rgba(226,85,136,0.10)'];
  return [lightColors.nbSurfaceChip, 'transparent', 'rgba(226,85,136,0.08)'];
}
function agendaCardColors(isEmpty, isDark) {
  if (isEmpty && isDark) return [darkColors.nbSurface, darkColors.nbBackground, darkColors.nbSurfaceChip];
  if (isEmpty) return [lightColors.nbBackground, lightColors.nbSurface, '#FFF7ED'];
  if (isDark) return [darkColors.nbSurface, darkColors.nbBackground];
  return [lightColors.nbSurface, lightColors.nbBackground];
}
function agendaEmptyAmbientColors(isDark) {
  // Strip: purple ambient → brand pink/orange wash only.
  if (isDark) {
    return ['rgba(226,85,136,0.22)', 'rgba(190,24,93,0.16)', 'rgba(194,65,12,0.18)', 'transparent'];
  }
  return ['rgba(226,85,136,0.10)', 'rgba(190,24,93,0.08)', 'rgba(194,65,12,0.10)', 'transparent'];
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
      color: '#0A0A0A',
      gradientColors: NUT_DONUT_CALORIES_GRADIENT,
      unit: ''
    }];
  }
  return [];
}
function calorieBarColor(isDark) {
  if (isDark) return '#F2F2F2';
  return '#0A0A0A';
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function hexToRgba(hex, alpha) {
  if (typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const hexDigits = hex.replace('#', '').trim();
  let fullHex = hexDigits;
  if (hexDigits.length === HEX_SHORT_LENGTH) {
    fullHex = '';
    for (let index = 0; index < hexDigits.length; index += 1) {
      const digit = hexDigits[index];
      fullHex += digit + digit;
    }
  }
  const colorInt = parseInt(fullHex, 16);
  if (Number.isNaN(colorInt) || fullHex.length !== HEX_FULL_LENGTH) {
    return `rgba(0,0,0,${alpha})`;
  }
  const red = colorInt >> 16 & 255;
  const green = colorInt >> 8 & 255;
  const blue = colorInt & 255;
  return `rgba(${red},${green},${blue},${alpha})`;
}
function titleCaseWords(text) {
  const words = String(text).split(/\s+/);
  const titled = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (!word) continue;
    titled.push(word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }
  return titled.join(' ');
}

/**
 * Human label for a stored goal key (lose_fat → Lose Fat).
 * @param {string} primaryGoal
 * @returns {string}
 */
function formatGoalLabel(primaryGoal) {
  if (!primaryGoal) return 'Active Goal';
  const goalKey = String(primaryGoal);
  if (goalKey === 'lose_fat') return 'Lose Fat';
  if (goalKey === 'build_muscle') return 'Build Muscle';
  if (goalKey === 'athletic_performance') return 'Athletic';
  const words = goalKey.replace(/_/g, ' ').split(' ');
  const titled = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    titled.push(word.charAt(0).toUpperCase() + word.slice(1));
  }
  return titled.join(' ');
}

/**
 * Display name for today's workout card — the real workout name (e.g. "Chest Day"), not "Workout".
 * @param {object} todayWorkout
 * @returns {string|null}
 */
function inferWorkoutType(todayWorkout) {
  const name = (todayWorkout == null ? void 0 : todayWorkout.name) || (todayWorkout == null ? void 0 : todayWorkout.workoutName);
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  return titleCaseWords(trimmed);
}
function workoutNameFromDashboardSummary(dashboardWorkoutSummary) {
  const summary = String(dashboardWorkoutSummary).trim();
  let firstLine = summary;
  if (summary.includes('\n')) {
    firstLine = summary.split('\n')[0].trim();
  }
  if (!firstLine) return null;
  return titleCaseWords(firstLine);
}
function pickWorkoutDisplayName(todayWorkout, dashboardWorkoutSummary) {
  if (todayWorkout) return inferWorkoutType(todayWorkout);
  if (dashboardWorkoutSummary) return workoutNameFromDashboardSummary(dashboardWorkoutSummary);
  return null;
}
function exerciseLinesFromArray(exerciseList) {
  const lines = [];
  for (let index = 0; index < exerciseList.length; index += 1) {
    const exercise = exerciseList[index];
    if (!exercise) continue;
    lines.push(String(exercise));
  }
  return lines;
}
function exerciseLinesFromMultilineText(exercisesText) {
  const rawLines = exercisesText.split('\n');
  const lines = [];
  for (let index = 0; index < rawLines.length; index += 1) {
    const trimmed = rawLines[index].trim();
    if (!trimmed) continue;
    lines.push(trimmed);
  }
  return lines;
}
function exerciseLinesFromWorkout(workout) {
  // Agenda card accepts either an exercises array or a newline-joined string from older plans.
  if (!workout) return [];
  if (Array.isArray(workout.exercises)) {
    return exerciseLinesFromArray(workout.exercises);
  }
  const exercisesText = workout.exercises;
  const hasMultilineText = typeof exercisesText === 'string' && exercisesText.trim();
  if (hasMultilineText) {
    return exerciseLinesFromMultilineText(exercisesText);
  }
  return [];
}
function estimateAgendaMinutes(exerciseCount) {
  if (!exerciseCount) return 0;
  return clamp(AGENDA_BASE_MINUTES + exerciseCount * AGENDA_MINUTES_PER_EXERCISE, AGENDA_MIN_MINUTES, AGENDA_MAX_MINUTES);
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
  return {
    name,
    sets
  };
}
function numericFromNutrientValue(value) {
  return parseFloat(String(value ?? '').replace(/[^\d.]/g, ''));
}
function oneMacroRow(macro, nutritionGoals) {
  const numericValue = numericFromNutrientValue(macro.value);
  let goal = (nutritionGoals == null ? void 0 : nutritionGoals.fatTarget) || DEFAULT_FAT_TARGET;
  let color = '#06B6D4';
  let gradientColors = NUT_DONUT_MACRO_GRADIENTS.fat;
  if (macro.label === 'Protein') {
    goal = (nutritionGoals == null ? void 0 : nutritionGoals.proteinTarget) || DEFAULT_PROTEIN_TARGET;
    color = '#EC4899';
    gradientColors = NUT_DONUT_MACRO_GRADIENTS.protein;
  }
  if (macro.label === 'Carbs') {
    goal = (nutritionGoals == null ? void 0 : nutritionGoals.carbsTarget) || DEFAULT_CARBS_TARGET;
    color = '#F97316';
    gradientColors = NUT_DONUT_MACRO_GRADIENTS.carbs;
  }
  return {
    ...macro,
    value: numericValue,
    goal,
    color,
    gradientColors,
    unit: 'g'
  };
}
function macroRowsFromMacros(macros, nutritionGoals) {
  const macroList = macros || [];
  const rows = [];
  for (let index = 0; index < macroList.length; index += 1) {
    rows.push(oneMacroRow(macroList[index], nutritionGoals));
  }
  return rows;
}
function extraNutrientRow(nutrient) {
  const rule = EXTRA_NUTRIENT_RULES[nutrient.label] || {
    goal: DEFAULT_EXTRA_NUTRIENT_GOAL,
    color: '#22C55E'
  };
  const numericValue = numericFromNutrientValue(nutrient.value);
  const unit = String(nutrient.value ?? '').includes('mg') ? 'mg' : 'g';
  return {
    label: nutrient.label,
    value: numericValue,
    goal: rule.goal,
    color: rule.color,
    unit,
    icon: nutrient.icon
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

// Solid nb surface card — no BlurredBackground / glass fill.
function FlatStatCard({
  isDark,
  colors,
  children,
  style,
  centerContent
}) {
  const cardFill = isDark ? darkColors.nbSurface : lightColors.nbSurface;
  const cardBorder = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const shadow = (colors == null ? void 0 : colors.black) ?? (isDark ? darkColors.nbShadow : lightColors.nbShadow);
  return <View style={[styles.statCardShadow, {
    shadowColor: shadow
  }, style]}>
      <View style={[styles.statCardBlur, styles.statCardInner, centerContent && styles.statCardInnerCentered, {
      backgroundColor: cardFill,
      borderColor: cardBorder,
      borderWidth: 2
    }]}>
        {children}
      </View>
    </View>;
}
;

// Circle progress ui components for nutrition stats on client home screen  
function CircularProgress({
  progress = 0,
  size = 72,
  strokeWidth = 8,
  trackColor,
  progressColor
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = clamp(progress, 0, 1);
  const dashOffset = circumference * (1 - clampedProgress);

  // the geometry of the circle progress bar
  return <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={radius} stroke={progressColor} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} strokeLinecap="round" rotation={-90} originX={size / 2} originY={size / 2} />
    </Svg>;
}
;

// Home stat card value gradients live in ../../../look-and-feel/homeStatColors.js

// Light-mode readability: draw a dark "outline" layer behind the value.
// We keep it subtle (shadow-based) so it doesn't look chunky.
function LightModeOutlineText({
  enabled,
  children,
  style,
  align = 'center',
  numberOfLines
}) {
  if (!enabled) return null;
  return <Text numberOfLines={numberOfLines} style={[style, {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    textAlign: align,
    color: 'rgba(0,0,0,0.92)',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: {
      width: 0,
      height: 0
    },
    textShadowRadius: 2.2
  }]}>
      {children}
    </Text>;
}
;
function FightyBouncyCardWrap({
  index = 0,
  width,
  children,
  onPress,
  activeOpacity = 0.9,
  disableAnimations = false
}) {
  const press = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    if (disableAnimations) return;
    shimmer.setValue(-1);
    const loop = Animated.loop(Animated.sequence([Animated.delay(650 + index * 120), Animated.timing(shimmer, {
      toValue: 1,
      duration: SHIMMER_DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }), Animated.delay(SHIMMER_GAP_MS)]));
    loop.start();
    return () => loop.stop();
  }, [disableAnimations, index, shimmer]);
  const onPressIn = () => {
    if (disableAnimations) return;
    Animated.timing(press, {
      toValue: 1,
      duration: 70,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();
  };
  const onPressOut = () => {
    if (disableAnimations) return;
    Animated.spring(press, {
      toValue: 0,
      speed: 28,
      bounciness: 16,
      useNativeDriver: true
    }).start();
  };
  const shimmerWidth = Math.max(90, Math.round((width ?? 160) * 0.55));
  const shimmerX = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-(width ?? 160), width ?? 160]
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [-1, -0.25, 0, 0.25, 1],
    outputRange: [0, 0.0, 0.28, 0.0, 0]
  });
  const tiltDegrees = cardTiltDegrees(index);
  if (disableAnimations) {
    return <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress}>
        <View style={{
        width: '100%'
      }}>{children}</View>
      </TouchableOpacity>;
  }
  return <Animated.View style={{
    transform: [{
      scale: press.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.975]
      })
    }, {
      rotateZ: press.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', tiltDegrees]
      })
    }, {
      translateY: press.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
      })
    }]
  }}>
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={{
        width: '100%'
      }}>
          {children}
          <Animated.View pointerEvents="none" style={{
          position: 'absolute',
          top: -18,
          bottom: -18,
          left: '50%',
          marginLeft: -Math.round(shimmerWidth / 2),
          width: shimmerWidth,
          opacity: shimmerOpacity,
          transform: [{
            translateX: shimmerX
          }, {
            rotateZ: '14deg'
          }]
        }}>
            <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 0
          }} style={{
            flex: 1,
            borderRadius: 22
          }} />
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>;
}
;

// ===== MAIN FUNCTION =====

// First row: day of workout (ex: Chest Day) / water / sleep — logo-aligned gradient, slightly softened (no grey)
function TopStatsRow({
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
  onOpenDashboard
}) {
  const {
    width: windowWidth
  } = useWindowDimensions();
  // Live window width (not module-level Dimensions) — fixes Expo Go on device where initial width is wrong and cards look full-width.
  const cardWidth = Math.max(132, Math.floor((windowWidth - STATS_ROW_PAD_H - STATS_ROW_CARD_GAP) / 2));
  const accent = ACCENT_COLOR;
  const primary = (colors == null ? void 0 : colors.primary) ?? accent;
  const workoutType = pickWorkoutDisplayName(todayWorkout, dashboardWorkoutSummary);
  const displayWorkoutType = workoutType;
  const workoutFontSize = workoutFontSizeForCard(displayWorkoutType, cardWidth);
  const workoutTextStyle = [styles.statGradientNumber, styles.statGradientWorkoutText, {
    fontWeight: '800',
    fontSize: workoutFontSize,
    lineHeight: workoutFontSize + 4,
    width: '100%',
    alignSelf: 'stretch'
  }];
  const isRestDay = workoutType === 'Rest Day';
  const fallbackBorder = isDark ? '#38383A' : '#E5E5E7';
  const border = (colors == null ? void 0 : colors.border) ?? fallbackBorder;
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
  return <View style={styles.statsRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRowContent} decelerationRate="fast">
        {/* Card 1 — Workout */}
        <View style={{
        width: cardWidth
      }}>
          <FightyBouncyCardWrap index={0} width={cardWidth} disableAnimations>
            <FlatStatCard isDark={isDark} colors={colors} style={{
            width: cardWidth
          }}>
              <Text style={[styles.statKicker, {
              color: kickerColor
            }]}>TODAY'S WORKOUT</Text>
              {displayWorkoutType ? <View style={styles.statGradientBlock}>
                  <View style={{
                position: 'relative',
                width: '100%'
              }}>
                    <LightModeOutlineText enabled={!isDark} style={workoutTextStyle} align="center" numberOfLines={2}>
                      {displayWorkoutType}
                    </LightModeOutlineText>
                    <StatColorText textProps={{
                  numberOfLines: 2
                }} style={workoutTextStyle} colors={HOME_STAT_WORKOUT_GRADIENT}>
                      {displayWorkoutType}
                    </StatColorText>
                  </View>
                  <Text style={[styles.statGradientLabel, {
                color: footnoteColor
              }]}>today's workout</Text>
                </View> : <View style={styles.statEmpty}>
                  <LottieView source={require('../../assets/animations/legacy/boxer lottie.json')} autoPlay loop style={styles.statEmptyLottie} />
                  <Text style={[styles.statEmptyText, {
                color: colors == null ? void 0 : colors.textSecondary
              }]}>No workout planned yet</Text>
                </View>}
            </FlatStatCard>
          </FightyBouncyCardWrap>
        </View>

        {/* Card 2 — Water */}
        <View style={{
        width: cardWidth
      }}>
          <FightyBouncyCardWrap index={1} width={cardWidth} disableAnimations>
            <FlatStatCard isDark={isDark} colors={colors} style={{
            width: cardWidth
          }}>
              <Text style={[styles.statKicker, {
              color: kickerColor
            }]}>WATER INTAKE</Text>
              {waterVal !== null ? <View style={styles.statGradientBlock}>
                  <View style={{
                position: 'relative',
                width: '100%'
              }}>
                    <LightModeOutlineText enabled={!isDark} style={[styles.statGradientNumber, {
                  fontWeight: '800'
                }]} align="center">
                      {waterVal}
                    </LightModeOutlineText>
                    <StatColorText style={[styles.statGradientNumber, {
                  fontWeight: '800'
                }]} colors={HOME_STAT_WATER_GRADIENT}>
                      {waterVal}
                    </StatColorText>
                  </View>
                  <Text style={[styles.statGradientLabel, {
                color: footnoteColor
              }]}>oz water</Text>
                </View> : <View style={styles.statEmpty}>
                  <LottieView source={require('../../assets/animations/legacy/glass water.json')} autoPlay loop style={styles.statEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.statEmptyCta, {
                  color: colors == null ? void 0 : colors.textSecondary
                }]}>Log Water →</Text>
                  </TouchableOpacity>
                </View>}
            </FlatStatCard>
          </FightyBouncyCardWrap>
        </View>

        {/* Card 3 — Sleep */}
        <View style={{
        width: cardWidth
      }}>
          <FightyBouncyCardWrap index={2} width={cardWidth} disableAnimations>
            <FlatStatCard isDark={isDark} colors={colors} style={{
            width: cardWidth
          }}>
              <Text style={[styles.statKicker, {
              color: kickerColor
            }]}>SLEEP</Text>
              {sleepVal !== null ? <View style={styles.statGradientBlock}>
                  <View style={{
                position: 'relative',
                width: '100%'
              }}>
                    <LightModeOutlineText enabled={!isDark} style={[styles.statGradientNumber, {
                  fontWeight: '800'
                }]} align="center">
                      {sleepVal}
                    </LightModeOutlineText>
                    <StatColorText style={[styles.statGradientNumber, {
                  fontWeight: '800'
                }]} colors={HOME_STAT_SLEEP_GRADIENT}>
                      {sleepVal}
                    </StatColorText>
                  </View>
                  <Text style={[styles.statGradientLabel, {
                color: footnoteColor
              }]}>hours of sleep</Text>
                </View> : <View style={styles.statEmpty}>
                  <LottieView source={require('../../assets/animations/legacy/sleep.json')} autoPlay loop style={styles.statEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.statEmptyCta, {
                  color: colors == null ? void 0 : colors.textSecondary
                }]}>Log Sleep →</Text>
                  </TouchableOpacity>
                </View>}
            </FlatStatCard>
          </FightyBouncyCardWrap>
        </View>

        
      </ScrollView>
    </View>;
}
;

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
  const pct = Math.round(clamped / scaleMax * PERCENT_SCALE);
  return `${pct}%`;
}
const wellnessKicker = {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.6,
  textAlign: 'center',
  width: '100%'
};
const wellnessNumber = {
  fontSize: 38,
  fontWeight: '800',
  lineHeight: 42,
  textAlign: 'center'
};
const wellnessLabel = {
  fontSize: 12,
  fontWeight: '600',
  marginTop: 2,
  textAlign: 'center'
};
const wellnessEmptyText = {
  fontSize: 11,
  fontWeight: '600',
  textAlign: 'center'
};
function WellnessStatsRow({
  isDark,
  colors,
  soreness,
  energyLevel,
  stressLevel,
  onOpenDashboard
}) {
  const {
    width: windowWidth
  } = useWindowDimensions();
  const cardWidth = Math.max(132, Math.floor((windowWidth - STATS_ROW_PAD_H - STATS_ROW_CARD_GAP) / 2));
  const kickerColor = statKickerColor(isDark, colors);
  const footnoteColor = statFootnoteColor(isDark, colors);
  return <View style={styles.statsRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRowContent} decelerationRate="fast">
        <View style={{
        width: cardWidth
      }}>
          <FightyBouncyCardWrap index={0} width={cardWidth} disableAnimations>
            <FlatStatCard isDark={isDark} colors={colors} style={{
            width: '100%'
          }} centerContent>
              <Text style={[wellnessKicker, {
              color: kickerColor
            }]}>SORENESS</Text>
              {soreness != null && soreness !== '' ? <View style={styles.statWellnessValueBlock}>
                  <View style={{
                position: 'relative',
                width: '100%'
              }}>
                    <LightModeOutlineText enabled={!isDark} style={wellnessNumber} align="center">
                      {formatWellnessScore(soreness, WELLNESS_SCORE_MAX) || soreness}
                    </LightModeOutlineText>
                    <StatColorText style={wellnessNumber} colors={HOME_STAT_SORENESS_GRADIENT}>
                      {formatWellnessScore(soreness, WELLNESS_SCORE_MAX) || soreness}
                    </StatColorText>
                  </View>
                  <Text style={[wellnessLabel, {
                color: footnoteColor
              }]}>muscle soreness</Text>
                </View> : <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_SORENESS_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.wellnessEmptyCta, {
                  color: colors == null ? void 0 : colors.textSecondary
                }]}>Log Soreness →</Text>
                  </TouchableOpacity>
                </View>}
            </FlatStatCard>
          </FightyBouncyCardWrap>
        </View>

        <View style={{
        width: cardWidth
      }}>
          <FightyBouncyCardWrap index={1} width={cardWidth} disableAnimations>
            <FlatStatCard isDark={isDark} colors={colors} style={{
            width: '100%'
          }} centerContent>
              <Text style={[wellnessKicker, {
              color: kickerColor
            }]}>ENERGY LEVEL</Text>
              {energyLevel != null && energyLevel !== '' ? <View style={styles.statWellnessValueBlock}>
                  <View style={{
                position: 'relative',
                width: '100%'
              }}>
                    <LightModeOutlineText enabled={!isDark} style={wellnessNumber} align="center">
                      {formatWellnessScore(energyLevel, WELLNESS_SCORE_MAX) || energyLevel}
                    </LightModeOutlineText>
                    <StatColorText style={wellnessNumber} colors={HOME_STAT_ENERGY_GRADIENT}>
                      {formatWellnessScore(energyLevel, WELLNESS_SCORE_MAX) || energyLevel}
                    </StatColorText>
                  </View>
                  <Text style={[wellnessLabel, {
                color: footnoteColor
              }]}>today</Text>
                </View> : <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_ENERGY_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.wellnessEmptyCta, {
                  color: colors == null ? void 0 : colors.textSecondary
                }]}>Rate Energy →</Text>
                  </TouchableOpacity>
                </View>}
            </FlatStatCard>
          </FightyBouncyCardWrap>
        </View>

        <View style={{
        width: cardWidth
      }}>
          <FightyBouncyCardWrap index={2} width={cardWidth} disableAnimations>
            <FlatStatCard isDark={isDark} colors={colors} style={{
            width: '100%'
          }} centerContent>
              <Text style={[wellnessKicker, {
              color: kickerColor
            }]}>STRESS LEVEL</Text>
              {stressLevel != null && stressLevel !== '' ? <View style={styles.statWellnessValueBlock}>
                  <View style={{
                position: 'relative',
                width: '100%'
              }}>
                    <LightModeOutlineText enabled={!isDark} style={wellnessNumber} align="center">
                      {formatWellnessScore(stressLevel, WELLNESS_SCORE_MAX) || stressLevel}
                    </LightModeOutlineText>
                    <StatColorText style={wellnessNumber} colors={HOME_STAT_STRESS_GRADIENT}>
                      {formatWellnessScore(stressLevel, WELLNESS_SCORE_MAX) || stressLevel}
                    </StatColorText>
                  </View>
                  <Text style={[wellnessLabel, {
                color: footnoteColor
              }]}>today</Text>
                </View> : <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_STRESS_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <TouchableOpacity onPress={onOpenDashboard} activeOpacity={0.7}>
                    <Text style={[styles.wellnessEmptyCta, {
                  color: colors == null ? void 0 : colors.textSecondary
                }]}>Log Stress →</Text>
                  </TouchableOpacity>
                </View>}
            </FlatStatCard>
          </FightyBouncyCardWrap>
        </View>
      </ScrollView>
    </View>;
}
;
function GreetingSection({
  userName = "Client",
  theme,
  isDark
}) {
  const dark = isDark ?? theme === 'dark';
  return <View style={styles.greetingSection}>
      {/* Keep greeting logic — just style/layout changes */}
      <View style={styles.greetingLineWrap}>
        <Text style={[styles.greetingTitle, {
        color: dark ? lightColors.white : '#111827'
      }]}>
          Good {getAuroraHeroGreeting()},
        </Text>
        <ColorText style={[styles.greetingTitle, {
        marginLeft: 6
      }]} colors={['#FF6B9D', '#FB923C']} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }}>
          {userName}!
        </ColorText>
      </View>
    </View>;
}
;
function datesForThisWeekMondayFirst() {
  const today = new Date();
  const currentDay = today.getDay();
  const daysBackToMonday = currentDay === SUNDAY_INDEX ? MONDAY_SHIFT_FROM_SUNDAY : 1;
  const diff = today.getDate() - currentDay + daysBackToMonday;
  const monday = new Date(today.setDate(diff));
  const weekDays = [];
  for (let dayOffset = 0; dayOffset < DAYS_IN_WEEK; dayOffset += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + dayOffset);
    weekDays.push(date);
  }
  return weekDays;
}
function OneWeekDayCell({
  day,
  dayIndex,
  todayKey,
  isDark
}) {
  const dayKey = day.toISOString().split('T')[0];
  const isToday = dayKey === todayKey;
  const dayName = WEEKDAY_NAMES[dayIndex];
  return <TouchableOpacity style={[styles.weekDay, isToday && styles.weekDayToday, !isDark && styles.lightWeekDay]}>
      <Text style={[styles.weekDayName, !isDark && styles.lightMutedText]}>
        {dayName}
      </Text>
      <Text style={[styles.weekDayNumber, isToday && styles.weekDayNumberToday, !isDark && styles.lightText]}>
        {day.getDate()}
      </Text>
    </TouchableOpacity>;
}
function NewCalendar({
  theme
}) {
  const isDark = theme === 'dark';
  const weekDays = datesForThisWeekMondayFirst();
  const todayKey = getClientDateKey();
  const borderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const dayCells = [];
  for (let dayIndex = 0; dayIndex < weekDays.length; dayIndex += 1) {
    dayCells.push(<OneWeekDayCell key={dayIndex} day={weekDays[dayIndex]} dayIndex={dayIndex} todayKey={todayKey} isDark={isDark} />);
  }
  return <View style={styles.calendarContainer}>
      <View style={[styles.weekCalendar, !isDark && styles.lightCard, {
      borderWidth: 1,
      borderColor,
      borderRadius: 16
    }]}>
        <View style={styles.weekHeader}>
          <Text style={[styles.weekHeaderText, !isDark && styles.lightText]}>This Week</Text>
        </View>
        <View style={styles.weekDays}>{dayCells}</View>
      </View>
    </View>;
}
function OneAgendaExerciseRow({
  line,
  rowIndex,
  itemAnim,
  dotColor,
  textColor,
  mutedColor
}) {
  const {
    name,
    sets
  } = splitAgendaExerciseLine(line);
  let setsLine = null;
  if (sets) {
    setsLine = <Text style={[styles.agendaExerciseSets, {
      color: mutedColor
    }]} numberOfLines={2}>
        {sets}
      </Text>;
  }
  const slideUp = itemAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 0]
  });
  return <Animated.View key={`${line}_${rowIndex}`} style={{
    opacity: itemAnim,
    transform: [{
      translateY: slideUp
    }]
  }}>
      <View style={styles.agendaExerciseRowPremium}>
        <View style={[styles.agendaDot, {
        backgroundColor: dotColor
      }]} />
        <View style={{
        flex: 1
      }}>
          <Text style={[styles.agendaExerciseName, {
          color: textColor
        }]} numberOfLines={1}>
            {name}
          </Text>
          {setsLine}
        </View>
      </View>
    </Animated.View>;
}
function AgendaExerciseList({
  shownExercises,
  itemAnims,
  dotColor,
  textColor,
  mutedColor
}) {
  const rows = [];
  for (let rowIndex = 0; rowIndex < shownExercises.length; rowIndex += 1) {
    rows.push(<OneAgendaExerciseRow key={`${shownExercises[rowIndex]}_${rowIndex}`} line={shownExercises[rowIndex]} rowIndex={rowIndex} itemAnim={itemAnims[rowIndex]} dotColor={dotColor} textColor={textColor} mutedColor={mutedColor} />);
  }
  return <View style={styles.agendaExercisesWrap}>{rows}</View>;
}
function AgendaFocusBody({
  isEmpty,
  mutedColor,
  shownExercises,
  itemAnims,
  dotColor,
  textColor,
  emptyRuleColors
}) {
  if (isEmpty) {
    return <View style={styles.agendaEmptyStage}>
        <LinearGradient colors={HERO_TITLE_TEXT_GRADIENT} start={{
        x: 0,
        y: 0
      }} end={{
        x: 1,
        y: 1
      }} style={styles.agendaEmptyIconWrap}>
          <Ionicons name="barbell-outline" size={22} color={lightColors.white} />
        </LinearGradient>
        <ColorText colors={HERO_TITLE_TEXT_GRADIENT} start={{
        x: 0,
        y: 0.5
      }} end={{
        x: 1,
        y: 0.5
      }} style={styles.agendaEmptyHeadline}>
          Ready when you are
        </ColorText>
        <Text style={[styles.agendaEmptySubcopy, {
        color: mutedColor
      }]}>
          No lifts on the board yet — today's agenda is wide open.
        </Text>
        <LinearGradient colors={emptyRuleColors} locations={[0, 0.35, 0.65, 1]} start={{
        x: 0,
        y: 0.5
      }} end={{
        x: 1,
        y: 0.5
      }} style={styles.agendaEmptyRule} />
      </View>;
  }
  return <AgendaExerciseList shownExercises={shownExercises} itemAnims={itemAnims} dotColor={dotColor} textColor={textColor} mutedColor={mutedColor} />;
}

// Training agenda: Today's workouts list with checkboxes and structured exercises.
function TrainingAgenda({
  theme,
  workouts = []
}) {
  const isDark = theme === 'dark';
  const textColor = isDark ? lightColors.white : '#111827';
  const mutedColor = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const subtleBorder = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const subtleFill = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const agendaTextureColors = agendaTextureColorList(isDark);
  const firstWorkout = (workouts || [])[0] || null;
  const rawTitle = String((firstWorkout == null ? void 0 : firstWorkout.name) || (firstWorkout == null ? void 0 : firstWorkout.workoutName) || 'Training Agenda').trim();
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
  const timestamp = nowTime.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });

  // Animations: card entrance + cascade items
  const enter = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef([]).current;
  const shownExercises = exercises.slice(0, AGENDA_EXERCISE_PREVIEW);
  while (itemAnims.length < shownExercises.length) itemAnims.push(new Animated.Value(0));
  useEffect(() => {
    enter.setValue(0);
    for (let index = 0; index < itemAnims.length; index += 1) {
      itemAnims[index].setValue(0);
    }
    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
    if (!shownExercises.length) return;
    const cascadeSteps = [];
    for (let index = 0; index < shownExercises.length; index += 1) {
      cascadeSteps.push(Animated.timing(itemAnims[index], {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }));
    }
    Animated.stagger(100, cascadeSteps).start();
  }, [enter, exercises.length]);
  return <View style={styles.agendaContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText, {
      fontFamily: Platform.select({
        ios: 'SpaceGrotesk_600SemiBold',
        android: 'SpaceGrotesk_600SemiBold',
        default: 'SpaceGrotesk_600SemiBold'
      })
    }]}>
        Training Agenda Today
      </Text>
      <View style={[styles.agendaColorBorder, {
      borderWidth: 1,
      borderColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
      borderRadius: 18,
      padding: 0
    }]}>
        <Animated.View style={[styles.agendaCardInner, {
        opacity: enter,
        transform: [{
          translateY: enter.interpolate({
            inputRange: [0, 1],
            outputRange: [16, 0]
          })
        }]
      }]}>
          {/* Rich background */}
          <LinearGradient colors={agendaBgColors} start={{
          x: 0,
          y: 0
        }} end={{
          x: 1,
          y: 1
        }} style={styles.agendaBg}>
            {/* Subtle texture */}
            <LinearGradient colors={agendaTextureColors} start={{
            x: 0,
            y: 0
          }} end={{
            x: 1,
            y: 1
          }} style={styles.agendaTexture} />
            {isEmpty ? <LinearGradient colors={emptyAmbientColors} locations={[0, 0.35, 0.7, 1]} start={{
            x: 0.15,
            y: 0
          }} end={{
            x: 0.9,
            y: 1
          }} style={styles.agendaEmptyAmbient} pointerEvents="none" /> : null}
            <View style={styles.agendaPad}>
              <View style={styles.agendaHeaderRow}>
                <View style={{
                flex: 1
              }}>
                  <Text style={[styles.agendaSubtitle, {
                  color: mutedColor
                }]}>TODAY'S FOCUS</Text>
                  <View style={styles.agendaTitleRow}>
                    <View style={[styles.agendaTitleIconWrap, {
                    backgroundColor: subtleFill,
                    borderColor: subtleBorder
                  }]}>
                      <Ionicons name={titleIconName} size={16} color={textColor} />
                    </View>
                    <Text style={[styles.agendaTitle, {
                    color: textColor
                  }]} numberOfLines={1}>
                      {rawTitle || 'Training Agenda'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.agendaBadge, {
                backgroundColor: subtleFill,
                borderColor: subtleBorder
              }]}>
                  <Text style={[styles.agendaBadgeText, {
                  color: textColor
                }]}>
                    {exerciseLabel}
                  </Text>
                </View>
              </View>

              <AgendaFocusBody isEmpty={isEmpty} mutedColor={mutedColor} shownExercises={shownExercises} itemAnims={itemAnims} dotColor={dotColor} textColor={textColor} emptyRuleColors={emptyRuleColors} />

              {/* Footer */}
              <View style={styles.agendaFooterRow}>
                <Text style={[styles.agendaDuration, {
                color: durationColor
              }]}>
                  {durationLabel}
                </Text>
                <Text style={[styles.agendaTimestamp, {
                color: mutedColor
              }]}>{timestamp}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </View>;
}
;
function nutritionRingHasGradient(gradientColors) {
  return Array.isArray(gradientColors) && gradientColors.length >= 2;
}
function ClientArcProgress({
  value,
  goal,
  label,
  color,
  unit,
  gradientColors,
  compact,
  trackColor,
  textPrimary,
  textMuted
}) {
  let progressPercent = 0;
  if (goal > 0) {
    progressPercent = Math.min(value / goal * 100, 100);
  }
  const size = compact ? 78 : 72;
  const strokeWidth = compact ? COMPACT_RING_STROKE : 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progressPercent / 100);
  const gradientId = `clientNutGrad-${String(label || 'x').replace(/\s+/g, '-')}`;
  const usesGradient = nutritionRingHasGradient(gradientColors);
  let strokePaint = color;
  if (usesGradient) {
    strokePaint = `url(#${gradientId})`;
  }
  return <View style={styles.nutritionCircleWrap}>
      <View style={{
      width: size,
      height: size
    }}>
        <View style={{
        transform: [{
          rotate: '-90deg'
        }]
      }}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {usesGradient ? <Defs>
                <SvgLinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
                  <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
                </SvgLinearGradient>
              </Defs> : null}
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
            <Circle cx={size / 2} cy={size / 2} r={radius} stroke={strokePaint} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} strokeLinecap="round" />
          </Svg>
        </View>
        <View style={[StyleSheet.absoluteFill, {
        alignItems: 'center',
        justifyContent: 'center'
      }]}>
          <Text style={[styles.nutritionCircleValue, {
          color: textPrimary
        }]}>
            {Math.round(progressPercent)}%
          </Text>
        </View>
      </View>
      <Text style={[styles.nutritionCircleLabel, {
      color: textMuted,
      marginTop: 6
    }]}>{label}</Text>
    </View>;
}
function buildNutritionRingCells(rings, cellStyle, arcProps) {
  const cells = [];
  for (let index = 0; index < rings.length; index += 1) {
    const ring = rings[index];
    cells.push(<View key={ring.label} style={cellStyle}>
        <ClientArcProgress value={ring.value} goal={ring.goal} label={ring.label} color={ring.color} gradientColors={ring.gradientColors} unit={ring.unit} {...arcProps} />
      </View>);
  }
  return cells;
}
function collectNutritionRows(macros, additionalNutrients, nutritionGoals) {
  const allNutrients = [];
  if (macros) {
    const macroRows = macroRowsFromMacros(macros, nutritionGoals);
    for (let index = 0; index < macroRows.length; index += 1) {
      allNutrients.push(macroRows[index]);
    }
  }
  if (!additionalNutrients) return allNutrients;
  for (let index = 0; index < additionalNutrients.length; index += 1) {
    allNutrients.push(extraNutrientRow(additionalNutrients[index]));
  }
  return allNutrients;
}
function nutrientsWithPositiveValues(allNutrients) {
  const nutrientsWithData = [];
  for (let index = 0; index < allNutrients.length; index += 1) {
    const nutrientValue = Number(allNutrients[index].value);
    if (nutrientValue <= 0) continue;
    nutrientsWithData.push(allNutrients[index]);
  }
  return nutrientsWithData;
}
function hasAnyLoggedNutrition(roundedCalories, allNutrients) {
  if (roundedCalories > 0) return true;
  return nutrientsWithPositiveValues(allNutrients).length > 0;
}
function caloriePercentOfGoal(consumed, goal) {
  if (goal <= 0) return 0;
  return Math.min(PERCENT_SCALE, consumed / goal * PERCENT_SCALE);
}
function nutritionThemeColors(isDark) {
  const textPrimary = isDark ? darkColors.nbInk : lightColors.nbInk;
  const textMuted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const trackColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const nutritionBorderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  return {
    textPrimary,
    textMuted,
    trackColor,
    nutritionBorderColor
  };
}
function LoggedNutritionBody({
  isDark,
  compact,
  nutrientsWithData,
  consumed,
  goal,
  roundedCalories,
  caloriePercent,
  textPrimary,
  textMuted,
  trackColor
}) {
  const arcProps = {
    compact,
    trackColor,
    textPrimary,
    textMuted
  };
  const compactRings = compactNutritionRings(nutrientsWithData, consumed, goal);
  const gridNutrients = nutrientsWithData.length > 0 ? nutrientsWithData.slice(0, 3) : [];
  const showCalorieRing = roundedCalories > 0;
  const barColor = calorieBarColor(isDark);
  const calorieSummary = `${Math.round(consumed)} / ${goal} kcal`;
  const barWidth = `${Math.min(caloriePercent, 100)}%`;

  // Named above JSX so the return stays a short recipe (no nested ternaries).
  let nutritionRings = <View style={styles.nutritionGrid2x2}>
      {buildNutritionRingCells(gridNutrients, styles.nutritionGridCell, arcProps)}
      {showCalorieRing ? <View style={styles.nutritionGridCell}>
          <ClientArcProgress value={roundedCalories} goal={goal} label="Calories" color="#0A0A0A" gradientColors={NUT_DONUT_CALORIES_GRADIENT} unit="" />
        </View> : null}
    </View>;
  if (compact) {
    nutritionRings = <View style={styles.nutritionCompactCirclesRow}>
        {buildNutritionRingCells(compactRings, styles.nutritionCompactCircleCell, arcProps)}
      </View>;
  }
  let calorieTrackStyle = [styles.progressBarBackground, {
    backgroundColor: '#E5E7EB'
  }];
  if (isDark) calorieTrackStyle = styles.progressBarBackground;
  return <>
      {nutritionRings}
      <View style={styles.caloriesSection}>
        <View style={styles.caloriesInfo}>
          <Text style={[styles.caloriesLabel, {
          color: textMuted
        }]}>Calories</Text>
          <Text style={[styles.caloriesValue, {
          color: textPrimary
        }]}>{calorieSummary}</Text>
        </View>
        <View style={calorieTrackStyle}>
          <View style={[styles.progressBar, {
          width: barWidth,
          backgroundColor: barColor
        }]} />
        </View>
      </View>
    </>;
}
function EmptyNutritionBody({
  textPrimary,
  textMuted
}) {
  return <View style={{
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12
  }}>
      <LottieView source={LOTTIE_NUTRITION_EMPTY} autoPlay loop style={{
      width: 100,
      height: 100
    }} />
      <View style={{
      flex: 1,
      minWidth: 0
    }}>
        <Text style={{
        fontSize: 15,
        fontWeight: '800',
        color: textPrimary,
        textAlign: 'left',
        letterSpacing: -0.2
      }}>
          No meals logged yet
        </Text>
        <Text style={{
        fontSize: 13,
        fontWeight: '500',
        color: textMuted,
        textAlign: 'left',
        marginTop: 6,
        lineHeight: 19
      }}>
          Open Nutrition to log food — macros and rings will show here.
        </Text>
      </View>
    </View>;
}

// Nutrition card: Daily macros + calories progress (empty state is Lottie + copy only).
function NutritionCard({
  theme,
  consumed = 0,
  goal = DEFAULT_NUTRITION_CARD_GOAL,
  macros = null,
  additionalNutrients = null,
  nutritionGoals = null,
  compact = true
}) {
  // 1. Theme + row data from macros / extras.
  const isDark = theme === 'dark';
  const {
    textPrimary,
    textMuted,
    trackColor,
    nutritionBorderColor
  } = nutritionThemeColors(isDark);
  const allNutrients = collectNutritionRows(macros, additionalNutrients, nutritionGoals);

  // 2. Decide empty vs logged from calories and positive nutrient values.
  const roundedCalories = Math.round(Number(consumed) || 0);
  const caloriePercent = caloriePercentOfGoal(consumed, goal);
  const nutrientsWithData = nutrientsWithPositiveValues(allNutrients);
  const hasLoggedNutrition = hasAnyLoggedNutrition(roundedCalories, allNutrients);

  // 3. Build the body, then wrap in the section chrome.
  let nutritionBody = <EmptyNutritionBody textPrimary={textPrimary} textMuted={textMuted} />;
  if (hasLoggedNutrition) {
    nutritionBody = <LoggedNutritionBody isDark={isDark} compact={compact} nutrientsWithData={nutrientsWithData} consumed={consumed} goal={goal} roundedCalories={roundedCalories} caloriePercent={caloriePercent} textPrimary={textPrimary} textMuted={textMuted} trackColor={trackColor} />;
  }
  const sectionTitleFont = Platform.select({
    ios: 'SpaceGrotesk_600SemiBold',
    android: 'SpaceGrotesk_600SemiBold',
    default: 'SpaceGrotesk_600SemiBold'
  });
  return <View style={styles.nutritionContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText, {
      fontFamily: sectionTitleFont
    }]}>
        Nutrition Today
      </Text>
      <View style={[styles.nutritionColorBorder, {
      borderWidth: 1,
      borderColor: nutritionBorderColor,
      borderRadius: 18,
      overflow: 'hidden'
    }]}>
        <View style={[styles.nutritionCard, !isDark && styles.nutritionCardLight]}>
          {nutritionBody}
        </View>
      </View>
    </View>;
}
function notesItemsFromClient(items) {
  const list = items || [];
  const fromClient = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    const addedBy = item.addedBy || 'client';
    if (addedBy !== 'client') continue;
    fromClient.push(item);
  }
  return fromClient;
}
function notesItemIsFromTrainer(item) {
  if (item.addedBy === 'trainer') return true;
  if (item.type === 'document' && item.trainerId) return true;
  return false;
}
function notesItemsFromTrainer(items) {
  const list = items || [];
  const fromTrainer = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!notesItemIsFromTrainer(item)) continue;
    fromTrainer.push(item);
  }
  return fromTrainer;
}
function formatNotesDate(dateValue) {
  if (!dateValue) return '';
  const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
function notesFileIsTrainerDocument(file) {
  if (file.type === 'document') return true;
  if (file.documentId && file.trainerId) return true;
  return false;
}
function notesFileIconName(file) {
  if (file.type === 'spreadsheet') return 'grid-outline';
  if (notesFileIsTrainerDocument(file)) return 'document-outline';
  if (file.type === 'pdf') return 'document-text-outline';
  if (file.type === 'photo') return 'image-outline';
  return 'attach-outline';
}
function notesFileTypeLabel(file) {
  if (file.type === 'spreadsheet') return 'Spreadsheet';
  if (notesFileIsTrainerDocument(file)) return 'Document';
  if (file.type === 'pdf') return 'PDF';
  if (file.type === 'photo') return 'Image';
  return 'File';
}
function notesFileTypeLabelColor(file) {
  if (file.type === 'spreadsheet') return '#10B981';
  if (notesFileIsTrainerDocument(file)) return '#64D2FF';
  return '#8A8A8A';
}
function notesFileShowsChevron(file) {
  if (file.type === 'document') return true;
  if (file.type === 'spreadsheet') return true;
  if (file.documentId && file.trainerId) return true;
  return false;
}
function notesFileShowsExternalLink(file) {
  if (file.type === 'document') return false;
  if (file.type === 'spreadsheet') return false;
  return true;
}
function splitNotesFilesByKind(list) {
  const safeList = list || [];
  const notes = [];
  const photos = [];
  const videos = [];
  const pdfOrDocFiles = [];
  const spreadsheets = [];
  const trainerDocuments = [];
  for (let index = 0; index < safeList.length; index += 1) {
    const item = safeList[index];
    if (item.type === 'note') {
      notes.push(item);
      continue;
    }
    if (item.type === 'photo') {
      photos.push(item);
      continue;
    }
    if (item.type === 'video') {
      videos.push(item);
      continue;
    }
    if (item.type === 'pdf' || item.type === 'doc') {
      pdfOrDocFiles.push(item);
      continue;
    }
    if (item.type === 'spreadsheet') {
      spreadsheets.push(item);
      continue;
    }
    if (notesFileIsTrainerDocument(item)) {
      trainerDocuments.push(item);
    }
  }
  const allFiles = [...pdfOrDocFiles, ...spreadsheets, ...trainerDocuments];
  return {
    notes,
    photos,
    videos,
    allFiles
  };
}
function openNotesFileUrl(url, file, onOpenFile) {
  if (onOpenFile) {
    onOpenFile(url, file);
    return;
  }
  if (!url) return;
  Linking.openURL(url).catch(() => {});
}
function pressNotesFileRow(file, onOpenFile) {
  if (notesFileIsTrainerDocument(file)) {
    if (onOpenFile) onOpenFile(null, file);
    return;
  }
  if (!file.url) return;
  openNotesFileUrl(file.url, file, onOpenFile);
}
function NotesEmptyBody({
  mutedColor
}) {
  return <View style={styles.notesEmptyContent}>
      <Feather name="file-plus" size={40} color={mutedColor} />
      <Text style={[styles.notesEmptyText, {
      color: mutedColor
    }]}>
        You have no notes or files yet.
      </Text>
      <Text style={[styles.notesEmptySubtext, {
      color: mutedColor
    }]}>
        Tap the + button to add photos, videos, notes, or PDFs. Documents shared by your trainer appear under From trainer.
      </Text>
    </View>;
}
function NotesTextCards({
  notes,
  isDark,
  textColor,
  mutedColor
}) {
  if (notes.length === 0) return null;
  const borderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const cards = [];
  for (let index = 0; index < notes.length; index += 1) {
    const note = notes[index];
    cards.push(<View key={note.id || index} style={[styles.notesNoteCard, {
      borderColor
    }]}>
        <Text style={[styles.notesNoteText, {
        color: textColor
      }]}>{note.content}</Text>
        <Text style={[styles.notesNoteDate, {
        color: mutedColor
      }]}>
          {formatNotesDate(note.createdAt)}
        </Text>
      </View>);
  }
  return <>
      <Text style={[styles.notesSectionTitle, {
      color: mutedColor
    }]}>Notes</Text>
      {cards}
    </>;
}
function NotesMediaGrid({
  photos,
  videos,
  isDark,
  mutedColor,
  onOpenFile
}) {
  const hasMedia = photos.length > 0 || videos.length > 0;
  if (!hasMedia) return null;
  const borderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const videoIconColor = isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
  const mediaCards = [];
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    mediaCards.push(<TouchableOpacity key={photo.id || index} onPress={() => {
      if (!photo.url) return;
      openNotesFileUrl(photo.url, photo, onOpenFile);
    }} style={styles.notesMediaCard} activeOpacity={0.8}>
        <Image source={{
        uri: photo.url
      }} style={[styles.notesMediaThumb, {
        borderColor
      }]} />
        <Text style={[styles.notesMediaLabel, {
        color: mutedColor
      }]} numberOfLines={1}>
          {photo.name || 'Photo'}
        </Text>
      </TouchableOpacity>);
  }
  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    mediaCards.push(<TouchableOpacity key={video.id || index} onPress={() => {
      if (!video.url) return;
      openNotesFileUrl(video.url, video, onOpenFile);
    }} style={styles.notesMediaCard} activeOpacity={0.8}>
        <View style={[styles.notesMediaThumb, styles.notesVideoPlaceholder, {
        borderColor
      }]}>
          <Feather name="video" size={24} color={videoIconColor} />
        </View>
        <Text style={[styles.notesMediaLabel, {
        color: mutedColor
      }]} numberOfLines={1}>
          {video.name || 'Video'}
        </Text>
      </TouchableOpacity>);
  }
  return <>
      <Text style={[styles.notesSectionTitle, {
      color: mutedColor
    }]}>Photos & Videos</Text>
      <View style={styles.notesMediaGrid}>{mediaCards}</View>
    </>;
}
function NotesFileRows({
  allFiles,
  isDark,
  textColor,
  mutedColor,
  onOpenFile
}) {
  if (allFiles.length === 0) return null;
  const borderColor = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  const chipFill = isDark ? darkColors.nbSurfaceChip : lightColors.nbSurfaceChip;
  const rows = [];
  for (let index = 0; index < allFiles.length; index += 1) {
    const file = allFiles[index];
    const fileName = file.name || file.title || 'File';
    const typeLabel = notesFileTypeLabel(file);
    const typeColor = notesFileTypeLabelColor(file);
    const dateAndType = `${formatNotesDate(file.createdAt)} · `;
    const showExternalLink = notesFileShowsExternalLink(file);
    const showChevron = notesFileShowsChevron(file);
    rows.push(<TouchableOpacity key={file.id || index} onPress={() => pressNotesFileRow(file, onOpenFile)} style={[styles.notesDocRow, {
      borderColor
    }]} activeOpacity={0.8}>
        <View style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: chipFill,
        alignItems: 'center',
        justifyContent: 'center'
      }}>
          <Ionicons name={notesFileIconName(file)} size={22} color={textColor} />
        </View>
        <View style={styles.notesFileInfo}>
          <Text style={[styles.notesDocName, {
          color: textColor
        }]} numberOfLines={1}>
            {fileName}
          </Text>
          <Text style={[styles.notesFileMeta, {
          color: mutedColor
        }]}>
            {dateAndType}
            <Text style={{
            color: typeColor,
            fontWeight: '600'
          }}>{typeLabel}</Text>
          </Text>
        </View>
        {showExternalLink ? <Feather name="external-link" size={18} color={mutedColor} /> : null}
        {showChevron ? <Ionicons name="chevron-forward" size={20} color={mutedColor} /> : null}
      </TouchableOpacity>);
  }
  return <>
      <Text style={[styles.notesSectionTitle, {
      color: mutedColor
    }]}>Files</Text>
      {rows}
    </>;
}
function NotesOwnerSection({
  list,
  sectionTitle,
  isDark,
  textColor,
  mutedColor,
  onOpenFile
}) {
  if (!list || list.length === 0) return null;
  const {
    notes,
    photos,
    videos,
    allFiles
  } = splitNotesFilesByKind(list);
  return <View style={styles.notesSection}>
      <Text style={[styles.notesCategoryTitle, {
      color: mutedColor
    }]}>{sectionTitle}</Text>
      <NotesTextCards notes={notes} isDark={isDark} textColor={textColor} mutedColor={mutedColor} />
      <NotesMediaGrid photos={photos} videos={videos} isDark={isDark} mutedColor={mutedColor} onOpenFile={onOpenFile} />
      <NotesFileRows allFiles={allFiles} isDark={isDark} textColor={textColor} mutedColor={mutedColor} onOpenFile={onOpenFile} />
    </View>;
}
function NotesFiles({
  theme,
  items = [],
  onOpenFile
}) {
  // 1. Theme ink + muted for the card chrome.
  const isDark = theme === 'dark';
  const textColor = isDark ? darkColors.nbInk : lightColors.nbInk;
  const mutedColor = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const cardInnerStyle = isDark ? styles.notesCardDark : styles.notesCardLight;
  const sectionTitleFont = Platform.select({
    ios: 'SpaceGrotesk_600SemiBold',
    android: 'SpaceGrotesk_600SemiBold',
    default: 'SpaceGrotesk_600SemiBold'
  });

  // 2. Split into “from you” vs “from trainer”, then pick empty vs filled body.
  const fromYou = notesItemsFromClient(items);
  const fromTrainer = notesItemsFromTrainer(items);
  const hasAny = items.length > 0;
  let notesBody = <NotesEmptyBody mutedColor={mutedColor} />;
  if (hasAny) {
    notesBody = <View style={styles.notesContent}>
        <NotesOwnerSection list={fromYou} sectionTitle="From you" isDark={isDark} textColor={textColor} mutedColor={mutedColor} onOpenFile={onOpenFile} />
        <NotesOwnerSection list={fromTrainer} sectionTitle="From trainer" isDark={isDark} textColor={textColor} mutedColor={mutedColor} onOpenFile={onOpenFile} />
      </View>;
  }

  // 3. Section title + gradient border + body.
  return <View style={styles.notesContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText, {
      fontFamily: sectionTitleFont
    }]}>
        Notes & Files
      </Text>
      <LinearGradient colors={['#FF6B9D', '#FB923C']} start={{
      x: 0,
      y: 0
    }} end={{
      x: 1,
      y: 1
    }} style={styles.notesColorBorder}>
        <View style={[styles.notesCardInner, cardInnerStyle]}>{notesBody}</View>
      </LinearGradient>
    </View>;
}

// ===== PLUMBING — skip unless debugging calorie goal / streak math =====

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
function calculateCalorieGoal(primaryGoal, weight, height, age, gender, daysPerWeek) {
  if (!weight || !height || !age || !gender) return DEFAULT_CALORIE_GOAL;
  const weightKg = weight / POUNDS_PER_KILOGRAM;
  const heightCm = height * CM_PER_INCH;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const activityLevel = activityLevelFromDaysPerWeek(daysPerWeek);
  const tdee = calculateTDEE(bmr, activityLevel);
  return calorieGoalFromTdee(primaryGoal, tdee);
}
;

/**
 * Consecutive days with a completed workout, counting back from today.
 * @param {object[]} completedWorkouts
 * @returns {number}
 */
function workoutCompletedDate(workout) {
  var _optObj;
  if ((_optObj = workout.completedAt) == null ? void 0 : _optObj.toDate) {
    return workout.completedAt.toDate();
  }
  return new Date(workout.completedAt);
}
function dateKeyFromDay(day) {
  return day.toISOString().split('T')[0];
}
function calculateStreak(completedWorkouts) {
  if (!completedWorkouts || completedWorkouts.length === 0) return 0;
  const sortedNewestFirst = [...completedWorkouts];
  sortedNewestFirst.sort((left, right) => {
    const leftDate = workoutCompletedDate(left);
    const rightDate = workoutCompletedDate(right);
    return rightDate - leftDate;
  });
  const workoutsByDate = {};
  for (let index = 0; index < sortedNewestFirst.length; index += 1) {
    const workoutDate = workoutCompletedDate(sortedNewestFirst[index]);
    workoutDate.setHours(0, 0, 0, 0);
    const dateKey = dateKeyFromDay(workoutDate);
    workoutsByDate[dateKey] = true;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streakDays = 0;
  const cursor = new Date(today);
  while (workoutsByDate[dateKeyFromDay(cursor)]) {
    streakDays += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streakDays;
}
export { getPremiumTheme, formatGoalLabel, inferWorkoutType, calculateCalorieGoal, calculateStreak, TopStatsRow, WellnessStatsRow, HomeTopBanner, GreetingSection, NewCalendar, TrainingAgenda, NutritionCard, NotesFiles, SCREEN_WIDTH, STATS_ROW_PAD_H, STATS_ROW_CARD_GAP, CARD_GAP };
