/**
 * client Home Components
 *
 * Purpose: client Home Components — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: (see file)
 *
 * @file-header
 */
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
import StableGradientText from '../../shared-ui/StableGradientText';
import BlurBackdropPlate from '../../shared-ui/BlurBackdropPlate';
import { getClientDateKey } from '../../shared-utils/dateKeys';
import {
  HOME_STAT_WORKOUT_GRADIENT,
  HOME_STAT_WATER_GRADIENT,
  HOME_STAT_SLEEP_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_ENERGY_GRADIENT,
  HOME_STAT_STRESS_GRADIENT,
  StatGradientText,
} from '../../shared-ui/homeStatGradients';
import { DailyQuotePill } from '../../shared/components/home/DailyQuoteCard';
import AuroraHeroBanner, { getAuroraHeroGreeting, TODAY_CARD_TOP_STRIPE } from '../../shared/components/home/AuroraHeroBanner';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-video';
import LottieView from 'lottie-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { calculateBMR, calculateTDEE } from '../../shared/fitness-calculations/calculations';
import styles, { SCREEN_WIDTH, STATS_ROW_PAD_H, STATS_ROW_CARD_GAP, CARD_GAP } from './clientAppStyles';

const LOTTIE_SORENESS_EMPTY = require('../../assets/sad reaction.json');
const LOTTIE_ENERGY_EMPTY = require('../../assets/Run Hamster... run.json');
const LOTTIE_STRESS_EMPTY = require('../../assets/Stressed Employee At Work.json');
const LOTTIE_NUTRITION_EMPTY = require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json');
const WORKOUT_EMPTY_ICON = require('../../assets/icons/workout.png');

// Builds light/dark style tokens from `isDark` (theme state). 
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
    background: isDark ? '#0A0A0F' : (colors?.background ?? '#F2F2F7'),
  };
};

// Shared UI helpers: app accent color + number clamping + hex→rgba conversion for opacity-based styling.
const ACCENT_COLOR = '#7C3AED';
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const hexToRgba = (hex, alpha) => {
  if (typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatGoalLabel = (primaryGoal) => {
  if (!primaryGoal) return 'Active Goal';
  const g = String(primaryGoal);
  if (g === 'lose_fat') return 'Lose Fat';
  if (g === 'build_muscle') return 'Build Muscle';
  if (g === 'athletic_performance') return 'Athletic';
  return g
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Display name for today's workout card — use actual workout name (e.g. "Chest Day"), not generic "Workout"
const inferWorkoutType = (todayWorkout) => {
  const name = todayWorkout?.name || todayWorkout?.workoutName;
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  // Title-case: first letter of each word uppercase
  const titleCase = trimmed.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return titleCase;
};

const LiquidGlassStatCard = ({ isDark, colors, children, style, centerContent }) => {
  const surface = colors?.surface;
  const border = colors?.border;
  const shadow = colors?.black;
  const bg = isDark ? hexToRgba(surface, 0.35) : hexToRgba(surface, 0.75);
  const bd = isDark ? hexToRgba(border, 0.6) : hexToRgba(border, 0.75);

  return (
    <View style={[styles.statCardShadow, { shadowColor: shadow }, style]}>
      <BlurBackdropPlate intensity={28} tint={isDark ? 'dark' : 'light'} style={styles.statCardBlur}>
        <View
          style={[
            styles.statCardInner,
            centerContent && styles.statCardInnerCentered,
            {
              backgroundColor: bg,
              borderColor: bd,
            },
          ]}
        >
          {children}
        </View>
      </BlurBackdropPlate>
    </View>
  );
};

// Circle progress ui components for nutrition stats on client home screen  
const CircularProgress = ({ progress = 0, size = 72, strokeWidth = 8, trackColor, progressColor }) => {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const p = clamp(progress, 0, 1);
  const dashOffset = c * (1 - p);

  // the geometry of the circle progress bar
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        rotation={-90}
        originX={size / 2}
        originY={size / 2}
      />
    </Svg>
  );
};

// Home stat card value gradients live in ../../../shared-ui/homeStatGradients.js

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
        Animated.timing(shimmer, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(1100),
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

  return (
    disableAnimations ? (
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress}>
        <View style={{ width: '100%' }}>{children}</View>
      </TouchableOpacity>
    ) : (
    <Animated.View
      style={{
        transform: [
          { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) },
          { rotateZ: press.interpolate({ inputRange: [0, 1], outputRange: ['0deg', index % 2 === 0 ? '-1.2deg' : '1.2deg'] }) },
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
    )
  );
};

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
  let workoutType = null;
  if (todayWorkout) {
    workoutType = inferWorkoutType(todayWorkout);
  } else if (dashboardWorkoutSummary) {
    const summary = String(dashboardWorkoutSummary).trim();
    workoutType = summary.includes('\n') ? summary.split('\n')[0].trim() : summary;
    if (workoutType) workoutType = workoutType.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  let displayWorkoutType = workoutType;
  const workoutFontSize = (() => {
    if (!displayWorkoutType) return 34;
    const maxWidth = Math.max(96, cardWidth - 28);
    const len = String(displayWorkoutType).length;
    let size = 34;
    while (size > 20 && len * size * 0.52 > maxWidth) size -= 2;
    return size;
  })();
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

  const border = colors?.border ?? (isDark ? '#38383A' : '#E5E5E7');
  const track = hexToRgba(border, isDark ? 0.5 : 0.55);

  const waterVal = typeof waterIntake === 'number' ? waterIntake : null;
  const waterGoal = 8;
  const waterPct = waterVal === null ? 0 : clamp(waterVal / waterGoal, 0, 1);

  const sleepVal = typeof sleepHours === 'number' ? sleepHours : null;

  const goalLabel = formatGoalLabel(primaryGoal);
  const gp = typeof goalProgress === 'number' ? clamp(goalProgress, 0, 1) : null;

  const kickerColor = isDark ? 'rgba(255,255,255,0.72)' : (colors?.textSecondary ?? '#6B7280');
  const footnoteColor = isDark ? 'rgba(255,255,255,0.58)' : (colors?.textSecondary ?? '#6B7280');

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
                    <StatGradientText
                      textProps={{ numberOfLines: 2 }}
                      style={workoutTextStyle}
                      colors={HOME_STAT_WORKOUT_GRADIENT}
                    >
                      {displayWorkoutType}
                    </StatGradientText>
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
                    <StatGradientText style={[styles.statGradientNumber, { fontWeight: '800' }]} colors={HOME_STAT_WATER_GRADIENT}>
                      {waterVal}
                    </StatGradientText>
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
                    <StatGradientText style={[styles.statGradientNumber, { fontWeight: '800' }]} colors={HOME_STAT_SLEEP_GRADIENT}>
                      {sleepVal}
                    </StatGradientText>
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
  const kickerColor = isDark ? 'rgba(255,255,255,0.72)' : (colors?.textSecondary ?? '#6B7280');
  const footnoteColor = isDark ? 'rgba(255,255,255,0.58)' : (colors?.textSecondary ?? '#6B7280');
  const formatScore = (v, max) => {
    if (v == null || v === '') return null;
    const raw = String(v).trim();
    if (raw.includes('%')) return raw;
    const slash = raw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    const n = slash ? Number(slash[1]) : Number(raw);
    const scaleMax = slash ? Number(slash[2]) : max;
    if (!Number.isFinite(n) || !Number.isFinite(scaleMax) || scaleMax <= 0) return raw;
    const clamped = Math.max(0, Math.min(scaleMax, n));
    const pct = Math.round((clamped / scaleMax) * 100);
    return `${pct}%`;
  };

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
                      {formatScore(soreness, 8) || soreness}
                    </LightModeOutlineText>
                    <StatGradientText style={wellnessNumber} colors={HOME_STAT_SORENESS_GRADIENT}>
                      {formatScore(soreness, 8) || soreness}
                    </StatGradientText>
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
                      {formatScore(energyLevel, 8) || energyLevel}
                    </LightModeOutlineText>
                    <StatGradientText style={wellnessNumber} colors={HOME_STAT_ENERGY_GRADIENT}>
                      {formatScore(energyLevel, 8) || energyLevel}
                    </StatGradientText>
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
                      {formatScore(stressLevel, 8) || stressLevel}
                    </LightModeOutlineText>
                    <StatGradientText style={wellnessNumber} colors={HOME_STAT_STRESS_GRADIENT}>
                      {formatScore(stressLevel, 8) || stressLevel}
                    </StatGradientText>
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
        <StableGradientText
          style={[styles.greetingTitle, { marginLeft: 6 }]}
          colors={['#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {userName}!
        </StableGradientText>
      </View>
    </View>
  );
};

const NewCalendar = ({ theme }) => {
  const isDark = theme === 'dark';
  const getWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDays.push(date);
    }
    return weekDays;
  };

  const weekDays = getWeekDays();
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
              const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
              
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

// Training agenda: Today's workouts list with checkboxes and structured exercises.
const AGENDA_BORDER_GRADIENT = TODAY_CARD_TOP_STRIPE;

const TrainingAgenda = ({ theme, workouts = [] }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const mutedColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(17,24,39,0.58)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const subtleFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const agendaBgColors = isDark ? ['#1A1F2E', '#0F1419'] : ['#FFFFFF', '#F3F4F6'];
  const agendaTextureColors = isDark
    ? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'rgba(192,132,252,0.08)']
    : ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0)', 'rgba(192,132,252,0.10)'];
  const emptyGlassBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)';
  const emptyGlassBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';

  const w0 = (workouts || [])[0] || null;
  const rawTitle = String(w0?.name || w0?.workoutName || 'Training Agenda').trim();

  const exercises = (() => {
    if (!w0) return [];
    if (Array.isArray(w0.exercises)) return w0.exercises.filter(Boolean).map((x) => String(x));
    if (typeof w0.exercises === 'string' && w0.exercises.trim()) {
      // Attempt to split "Exercise — 3x10" lines if present
      return w0.exercises
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  })();

  const exerciseCount = exercises.length;
  const estMinutes = (() => {
    if (!exerciseCount) return 0;
    // Premium-feeling estimate without overthinking it.
    const base = 20;
    const perExercise = 12;
    return clamp(base + exerciseCount * perExercise, 25, 75);
  })();

  const titleIconName = (() => {
    const t = rawTitle.toLowerCase();
    if (t.includes('arm')) return 'fitness-outline';
    if (t.includes('leg')) return 'walk-outline';
    if (t.includes('chest')) return 'barbell-outline';
    if (t.includes('back')) return 'body-outline';
    if (t.includes('rest')) return 'leaf-outline';
    return 'flash-outline';
  })();

  const nowTime = useRef(new Date()).current;
  const timestamp = nowTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Animations: card entrance + cascade items
  const enter = useRef(new Animated.Value(0)).current;
  const emptyPulse = useRef(new Animated.Value(1)).current;
  const itemAnims = useRef([]).current;
  const shownExercises = exercises.slice(0, 8);
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

  useEffect(() => {
    if (exerciseCount !== 0) {
      emptyPulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(emptyPulse, {
          toValue: 1.04,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(emptyPulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [exerciseCount, emptyPulse]);

  const isEmpty = exerciseCount === 0;

  return (
    <View style={styles.agendaContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText]}>Training Agenda Today</Text>
      <View
        style={[
          styles.agendaGradientBorder,
          isEmpty && styles.agendaGradientBorderPremiumEmpty,
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
            isEmpty && styles.agendaCardInnerPremiumEmpty,
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
            style={[styles.agendaBg, isEmpty && styles.agendaBgPremiumEmpty]}
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
                colors={
                  isDark
                    ? ['rgba(109,40,217,0.14)', 'rgba(194,65,12,0.08)']
                    : ['rgba(109,40,217,0.08)', 'rgba(194,65,12,0.06)']
                }
                start={{ x: 0.1, y: 0 }}
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
                    isEmpty && styles.agendaBadgeEmptyPremium,
                    { backgroundColor: subtleFill, borderColor: subtleBorder },
                  ]}
                >
                  <Text style={[styles.agendaBadgeText, { color: textColor }]}>
                    {exerciseCount || 0} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>
              </View>

              {isEmpty ? (
                <View style={styles.agendaEmptyPremiumShell}>
                  <View
                    style={[
                      styles.agendaEmptyGlass,
                      {
                        backgroundColor: emptyGlassBg,
                        borderColor: emptyGlassBorder,
                      },
                    ]}
                  >
                    <View style={styles.agendaEmptyPremiumRow}>
                      <Animated.View style={{ transform: [{ scale: emptyPulse }] }}>
                          <View
                            style={[
                              styles.agendaEmptyIconRingOuter,
                              {
                                borderWidth: 1,
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.10)',
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                              },
                            ]}
                          >
                          <View
                            style={[
                              styles.agendaEmptyIconRingInner,
                              {
                                backgroundColor: isDark ? '#12131A' : '#FAFAFC',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
                              },
                            ]}
                          >
                            <Ionicons name="barbell-outline" size={26} color="#C2410C" />
                          </View>
                        </View>
                      </Animated.View>
                      <View style={styles.agendaEmptyCopyCol}>
                        <Text style={[styles.agendaEmptyHeadline, { color: textColor }]}>
                          {"Today's canvas is clear"}
                        </Text>
                        <Text style={[styles.agendaEmptySubcopy, { color: mutedColor }]}>
                          No exercises logged yet. Stack your first lifts here—or open Workout to generate a plan and
                          sync it to today.
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.agendaExercisesWrap}>
                  {shownExercises.map((line, i) => {
                    // Accept "Exercise — sets", or "Exercise (sets)", or plain "Exercise"
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
                          <View
                            style={[
                              styles.agendaDot,
                              { backgroundColor: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(10,10,15,0.28)' },
                            ]}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.agendaExerciseName, { color: textColor }]} numberOfLines={1}>
                              {name}
                            </Text>
                            {sets ? (
                              <Text style={[styles.agendaExerciseSets, { color: mutedColor }]} numberOfLines={2}>
                                {sets}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}

              {/* Footer */}
              <View style={styles.agendaFooterRow}>
                <Text style={[styles.agendaDuration, { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.72)' }]}>
                  {estMinutes ? `Est. ${estMinutes} min` : 'Est. —'}
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
const NutritionCard = ({ theme, consumed = 0, goal = 2500, macros = null, additionalNutrients = null, nutritionGoals = null, compact = true }) => {
  const isDark = theme === 'dark';

  // Nutrition Today donut gradients (match Nutrition screen)
  const NUT_DONUT_CALORIES_GRADIENT = ['#DB2777', '#C2410C']; // dark pink → dark orange
  const NUT_DONUT_MACRO_GRADIENTS = {
    protein: ['#6D28D9', '#FDE68A'], // purple → sand
    carbs: ['#FBBF24', '#FB7185'],   // gold → pink
    fat: ['#6D28D9', '#DB2777'],     // purple → pink
  };
  
  // Combine all nutrients for arc progress display
  const allNutrients = [];
  
  // Add main macros with actual goals if available
  if (macros) {
    allNutrients.push(...(macros || []).map(m => {
      // Extract numeric value from string like "25g"
      const numericValue = parseFloat(String(m.value ?? '').replace(/[^\d.]/g, ''));
      return {
        ...m,
        value: numericValue,
        goal: m.label === 'Protein' ? (nutritionGoals?.proteinTarget || 150) : 
              m.label === 'Carbs' ? (nutritionGoals?.carbsTarget || 250) : 
              (nutritionGoals?.fatTarget || 70),
        color: m.label === 'Protein' ? '#EC4899' : m.label === 'Carbs' ? '#F97316' : '#06B6D4',
        gradientColors:
          m.label === 'Protein' ? NUT_DONUT_MACRO_GRADIENTS.protein :
          m.label === 'Carbs' ? NUT_DONUT_MACRO_GRADIENTS.carbs :
          NUT_DONUT_MACRO_GRADIENTS.fat,
        unit: 'g'
      };
    }));
  }
  
  // Add additional nutrients with evidence-based goals
  if (additionalNutrients) {
    additionalNutrients.forEach(n => {
      let nutrientGoal = 25; // Default goal
      let nutrientColor = '#22C55E'; // Default green
      
      if (n.label === 'Fiber') {
        nutrientGoal = 25; // Daily fiber goal (25g for women, 38g for men, using average)
        nutrientColor = '#22C55E'; // Green
      } else if (n.label === 'Sugar') {
        nutrientGoal = 50; // Added sugar limit (50g per WHO recommendation)
        nutrientColor = '#F97316'; // Orange
      } else if (n.label === 'Sodium') {
        nutrientGoal = 2300; // Daily sodium limit (2300mg per FDA)
        nutrientColor = '#06B6D4'; // Cyan
      } else if (n.label === 'Potassium') {
        nutrientGoal = 3500; // Daily potassium goal (3500mg per NIH)
        nutrientColor = '#C084FC'; // Purple
      }
      
      // Extract numeric value from string like "25g" or "2300mg"
      const numericValue = parseFloat(String(n.value ?? '').replace(/[^\d.]/g, ''));
      const unit = String(n.value ?? '').includes('mg') ? 'mg' : 'g';
      
      allNutrients.push({
        label: n.label,
        value: numericValue,
        goal: nutrientGoal,
        color: nutrientColor,
        unit: unit,
        icon: n.icon // Keep icon for fallback display
      });
    });
  }
  
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
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
    const strokeWidth = compact ? 7 : 6;
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

  const nutrientsWithData = (allNutrients || []).filter((n) => Number(n.value) > 0);
  const compactRings =
    nutrientsWithData.length > 0
      ? nutrientsWithData.slice(0, 3)
      : Math.round(Number(consumed) || 0) > 0
        ? [{ value: Math.round(consumed), goal, label: 'Calories', color: '#8B5CF6', gradientColors: NUT_DONUT_CALORIES_GRADIENT, unit: '' }]
        : [];

  return (
    <View style={styles.nutritionContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText]}>Nutrition Today</Text>
      <View
        style={[
          styles.nutritionGradientBorder,
          {
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
            borderRadius: 18,
            overflow: 'hidden',
          },
        ]}
      >
        <View style={[styles.nutritionCard, !isDark && styles.nutritionCardLight]}>
        {!hasLoggedNutrition ? (
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
        ) : (
          <>
            {compact ? (
              <View style={styles.nutritionCompactCirclesRow}>
                {compactRings.map((n) => (
                  <View key={n.label} style={styles.nutritionCompactCircleCell}>
                    <ClientArcProgress
                      value={n.value}
                      goal={n.goal}
                      label={n.label}
                      color={n.color}
                      gradientColors={n.gradientColors}
                      unit={n.unit}
                    />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.nutritionGrid2x2}>
                {(nutrientsWithData.length > 0 ? nutrientsWithData.slice(0, 3) : []).map((n) => (
                  <View key={n.label} style={styles.nutritionGridCell}>
                    <ClientArcProgress
                      value={n.value}
                      goal={n.goal}
                      label={n.label}
                      color={n.color}
                      gradientColors={n.gradientColors}
                      unit={n.unit}
                    />
                  </View>
                ))}
                {Math.round(Number(consumed) || 0) > 0 ? (
                  <View style={styles.nutritionGridCell}>
                    <ClientArcProgress
                      value={Math.round(consumed)}
                      goal={goal}
                      label="Calories"
                      color="#8B5CF6"
                      gradientColors={NUT_DONUT_CALORIES_GRADIENT}
                      unit=""
                    />
                  </View>
                ) : null}
              </View>
            )}
            <View style={styles.caloriesSection}>
              <View style={styles.caloriesInfo}>
                <Text style={[styles.caloriesLabel, { color: textMuted }]}>Calories</Text>
                <Text style={[styles.caloriesValue, { color: textPrimary }]}>{Math.round(consumed)} / {goal} kcal</Text>
              </View>
              <View style={[styles.progressBarBackground, !isDark && { backgroundColor: '#E5E7EB' }]}>
                <View style={[styles.progressBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: isDark ? '#8B5CF6' : '#7C3AED' }]} />
              </View>
            </View>
          </>
        )}
        </View>
      </View>
    </View>
  );
};

const NotesFiles = ({ theme, items = [], onOpenFile }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#fff' : '#1a1040';
  const mutedColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,16,64,0.6)';
  const fromYou = (items || []).filter((x) => (x.addedBy || 'client') === 'client');
  const fromTrainer = (items || []).filter((x) => x.addedBy === 'trainer' || (x.type === 'document' && x.trainerId));
  const hasAny = items.length > 0;

  const openUrl = (url, file) => {
    if (onOpenFile) onOpenFile(url, file);
    else if (url) Linking.openURL(url).catch(() => {});
  };

  const formatDate = (d) => {
    if (!d) return '';
    const t = d instanceof Date ? d : new Date(d);
    return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
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
    const notes = (list || []).filter((x) => x.type === 'note');
    const photos = (list || []).filter((x) => x.type === 'photo');
    const videos = (list || []).filter((x) => x.type === 'video');
    const docs = (list || []).filter((x) => x.type === 'pdf' || x.type === 'doc');
    const spreadsheets = (list || []).filter((x) => x.type === 'spreadsheet');
    const trainerDocs = (list || []).filter((x) => x.type === 'document' || (x.documentId && x.trainerId));
    const allFiles = [...docs, ...spreadsheets, ...trainerDocs];
    if (list.length === 0) return null;
    return (
      <View key={sectionTitle} style={styles.notesSection}>
        <Text style={[styles.notesCategoryTitle, { color: mutedColor }]}>{sectionTitle}</Text>
        {notes.length > 0 && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Notes</Text>
            {(notes || []).map((n, i) => (
              <View key={n.id || i} style={[styles.notesNoteCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.notesNoteText, { color: textColor }]}>{n.content}</Text>
                <Text style={[styles.notesNoteDate, { color: mutedColor }]}>{formatDate(n.createdAt)}</Text>
              </View>
            ))}
          </>
        )}
        {(photos.length > 0 || videos.length > 0) && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Photos & Videos</Text>
            <View style={styles.notesMediaGrid}>
              {(photos || []).map((p, i) => (
                <TouchableOpacity key={p.id || i} onPress={() => p.url && openUrl(p.url, p)} style={styles.notesMediaCard} activeOpacity={0.8}>
                  <Image source={{ uri: p.url }} style={[styles.notesMediaThumb, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                  <Text style={[styles.notesMediaLabel, { color: mutedColor }]} numberOfLines={1}>{p.name || 'Photo'}</Text>
                </TouchableOpacity>
              ))}
              {(videos || []).map((v, i) => (
                <TouchableOpacity key={v.id || i} onPress={() => v.url && openUrl(v.url, v)} style={styles.notesMediaCard} activeOpacity={0.8}>
                  <View style={[styles.notesMediaThumb, styles.notesVideoPlaceholder, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                    <Feather name="video" size={24} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'} />
                  </View>
                  <Text style={[styles.notesMediaLabel, { color: mutedColor }]} numberOfLines={1}>{v.name || 'Video'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {allFiles.length > 0 && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Files</Text>
            {(allFiles || []).map((f, i) => (
              <TouchableOpacity
                key={f.id || i}
                onPress={() => {
                  if (f.type === 'document' || (f.documentId && f.trainerId)) {
                    if (onOpenFile) onOpenFile(null, f);
                  } else if (f.url) {
                    openUrl(f.url, f);
                  }
                }}
                style={[styles.notesDocRow, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
                activeOpacity={0.8}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={fileIcon(f)} size={22} color={textColor} />
                </View>
                <View style={styles.notesFileInfo}>
                  <Text style={[styles.notesDocName, { color: textColor }]} numberOfLines={1}>{f.name || f.title || 'File'}</Text>
                  <Text style={[styles.notesFileMeta, { color: mutedColor }]}>{formatDate(f.createdAt)} · <Text style={{ color: fileTypeLabelColor(f), fontWeight: '600' }}>{fileTypeLabel(f)}</Text></Text>
                </View>
                {f.type !== 'document' && f.type !== 'spreadsheet' && <Feather name="external-link" size={18} color={mutedColor} />}
                {(f.type === 'document' || f.type === 'spreadsheet' || (f.documentId && f.trainerId)) && <Ionicons name="chevron-forward" size={20} color={mutedColor} />}
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.notesContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText]}>Notes & Files</Text>
      <LinearGradient
        colors={['#C084FC', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.notesGradientBorder}
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
const calculateCalorieGoal = (primaryGoal, weight, height, age, gender, daysPerWeek) => {
  if (!weight || !height || !age || !gender) return 2000;
  const weightKg = weight / 2.20462;
  const heightCm = height * 2.54;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  let activityLevel = 'sedentary';
  if (daysPerWeek >= 6) activityLevel = 'very_active';
  else if (daysPerWeek >= 4) activityLevel = 'active';
  else if (daysPerWeek >= 3) activityLevel = 'moderate';
  else if (daysPerWeek >= 1) activityLevel = 'light';
  const tdee = calculateTDEE(bmr, activityLevel);
  switch (primaryGoal) {
    case 'lose_fat': return Math.round(tdee - 500);
    case 'build_muscle': return Math.round(tdee + 300);
    case 'athletic_performance': return Math.round(tdee + 500);
    default: return Math.round(tdee);
  }
};

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
  AuroraHeroBanner,
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
