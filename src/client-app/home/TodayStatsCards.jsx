// Today's calorie ring on the client home screen: eaten vs goal, remaining, Log food.
// Flow: read current/goal → clamp progress → animate the ring → Log food or Open Nutrition.
// Used by the client home dashboard under the TODAY heading.

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

// ===== NAMED CONSTANTS =====

const BORDER_GRADIENT = ['#06B6D4', '#C084FC', '#FF6B9D'];
/** Dark pink → dark orange — trainer card shell and CTAs */
export const TRAINER_BORDER_GRADIENT = ['#BE185D', '#C2410C'];

const CC = {
  bg: '#0A0A0F',
  cardBg: '#141419',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.4)',
  pink: '#FF6B9D',
  orange: '#F97316',
  cyan: '#06B6D4',
  purple: '#C084FC',
  green: '#10B981',
};

const CC_LIGHT = {
  cardBg: '#FAFAFC',
  textPrimary: '#0F172A',
  textSecondary: 'rgba(15,23,42,0.6)',
  textTertiary: 'rgba(15,23,42,0.42)',
  track: 'rgba(15,23,42,0.08)',
};

const RING_SIZE = 102;
const STROKE = 8;
const RING_RADIUS = (RING_SIZE - STROKE) / 2;
const RING_CENTER_X = RING_SIZE / 2;
const RING_CENTER_Y = RING_SIZE / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
// Manipulate here: fallback daily calorie target when the profile has not set one.
const DEFAULT_CALORIE_GOAL = 2000;
const PERCENT_SCALE = 100;
const RING_ANIMATION_MS = 380;

// ===== HELPER FUNCTIONS =====

function clamp01(progress) {
  return Math.max(0, Math.min(1, progress));
}

function themeForMode(isDark) {
  return isDark ? CC : { ...CC, ...CC_LIGHT };
}

function caloriesProgressRatio(currentCalories, goalCalories) {
  const eaten = Number(currentCalories ?? 0);
  const goal = Number(goalCalories ?? DEFAULT_CALORIE_GOAL);
  return goal > 0 ? eaten / goal : 0;
}

/**
 * Gradient rim around a home card. The inner pad is where the ring / copy sit.
 * @param {object} props
 * @param {boolean} props.isDark
 * @param {import('react').ReactNode} props.children
 * @param {object} [props.style]
 * @param {string[]} [props.borderColors]
 */
export const ColorBorderShell = ({ isDark, children, style, borderColors = BORDER_GRADIENT }) => (
  <LinearGradient
    colors={borderColors}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[
      {
        borderRadius: 22,
        padding: 1.5,
        shadowColor: borderColors[0] || '#BE185D',
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
        backgroundColor: isDark ? '#0E0C16' : '#FFFFFF',
        borderWidth: isDark ? 0 : 1,
        borderColor: isDark ? 'transparent' : 'rgba(15,23,42,0.06)',
      }}
    >
      <View style={{ padding: 14 }}>{children}</View>
    </View>
  </LinearGradient>
);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CaloriesHeroCard({ isDark, current, goal, progress, onPress, onPressLogFood }) {
  const percentComplete = Math.round(clamp01(progress) * PERCENT_SCALE);
  const caloriesEaten = Math.round(Number(current || 0));
  const caloriesGoal = Math.round(Number(goal || DEFAULT_CALORIE_GOAL));
  const caloriesRemaining = Math.max(0, caloriesGoal - caloriesEaten);
  const clampedProgress = clamp01(progress);

  const themeColors = themeForMode(isDark);
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
  const trackStroke = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.12)';
  // vocab: toString(36) = base-36 id so two rings on screen do not share one SVG gradient id.
  const gradId = useRef(`calRing_${Math.random().toString(36).slice(2, 9)}`).current;
  const innerDiscR = Math.max(RING_RADIUS - STROKE * 0.9, 6);
  const innerFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const innerStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';

  const progressAnim = useRef(new Animated.Value(0)).current;
  // vocab: useEffect = run the ring animation after paint when progress changes.
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

  const logHandler = typeof onPressLogFood === 'function' ? onPressLogFood : onPress;

  return (
    <ColorBorderShell isDark={isDark} style={cardStyles.borderShell}>
      <View style={cardStyles.cardRow}>
          <View style={cardStyles.ringCol}>
            <View style={cardStyles.ringWrap}>
              <Svg width={RING_SIZE} height={RING_SIZE} style={cardStyles.ringSvg}>
                <Defs>
                  <SvgLinearGradient
                    id={gradId}
                    x1="0"
                    y1="0"
                    x2={RING_SIZE}
                    y2={RING_SIZE}
                    gradientUnits="userSpaceOnUse"
                  >
                    <Stop offset="0" stopColor={CC.pink} />
                    <Stop offset="1" stopColor={CC.cyan} />
                  </SvgLinearGradient>
                </Defs>
                <Circle cx={RING_CENTER_X} cy={RING_CENTER_Y} r={innerDiscR} fill={innerFill} stroke={innerStroke} strokeWidth={1} />
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
                  stroke={clampedProgress > 0 ? `url(#${gradId})` : trackStroke}
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
                <Text style={[cardStyles.ringBig, { color: themeColors.textPrimary }]}>{caloriesEaten.toLocaleString()}</Text>
                <Text style={[cardStyles.ringGoal, { color: themeColors.textSecondary }]}>
                  / {caloriesGoal.toLocaleString()}{' '}
                  <Text style={{ color: themeColors.textTertiary, fontWeight: '600' }}>kcal</Text>
                </Text>
              </View>
            </View>
          </View>

          <View style={[cardStyles.rightCol, { borderLeftColor: hairline }]}>
            <View style={cardStyles.headerRow}>
              <View style={cardStyles.headerTitleWrap}>
                <Text style={[cardStyles.headerTitle, { color: themeColors.textPrimary }]}>Calories</Text>
                <Text style={[cardStyles.headerSubtitle, { color: themeColors.textSecondary }]}>Today's budget</Text>
              </View>
              {typeof logHandler === 'function' ? (
                <TouchableOpacity style={[cardStyles.logFoodBtn, cardStyles.logFoodBtnFx]} onPress={logHandler} activeOpacity={0.75}>
                  <Ionicons name="add-circle-outline" size={18} color={CC.pink} />
                  <Text style={cardStyles.logFoodText}>Log food</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View
              style={[
                cardStyles.metricsCard,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' },
                isDark ? cardStyles.metricsCardEdgeDark : cardStyles.metricsCardEdgeLight,
              ]}
            >
              <View style={cardStyles.metricCol}>
                <Text style={[cardStyles.metricLabel, { color: themeColors.textTertiary }]}>REMAINING</Text>
                <Text style={[cardStyles.metricValue, { color: themeColors.textPrimary }]}>{caloriesRemaining.toLocaleString()}</Text>
                <Text style={[cardStyles.metricUnit, { color: themeColors.textSecondary }]}>kcal</Text>
              </View>
              <View style={[cardStyles.metricDivider, { backgroundColor: hairline }]} />
              <View style={cardStyles.metricCol}>
                <Text style={[cardStyles.metricLabel, { color: themeColors.textTertiary }]}>PROGRESS</Text>
                <Text style={[cardStyles.metricValue, { color: percentComplete > 0 ? CC.pink : themeColors.textPrimary }]}>
                  {percentComplete}%
                </Text>
                <Text style={[cardStyles.metricUnit, { color: themeColors.textSecondary }]}>of goal</Text>
              </View>
            </View>

            {typeof onPress === 'function' ? (
              <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={cardStyles.nutritionTouch}>
                <View style={[cardStyles.nutritionGrad, { borderColor: hairline, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
                  <View style={cardStyles.nutritionRowInner}>
                    <View style={cardStyles.nutritionRowLeft}>
                      <Ionicons name="nutrition-outline" size={20} color={CC.pink} />
                      <Text style={[cardStyles.nutritionRowTitle, { color: themeColors.textPrimary }]}>Open Nutrition</Text>
                    </View>
                    <View style={[cardStyles.chevronPill, { borderColor: hairline, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)' }]}>
                      <Ionicons name="chevron-forward" size={18} color={CC.cyan} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
    </ColorBorderShell>
  );
}

// ===== MAIN FUNCTION =====

/**
 * TODAY heading plus the calorie hero card.
 * @param {object} props
 * @param {boolean} [props.isDark]
 * @param {object} [props.stats]
 * @param {Function} [props.onPressCalories]
 * @param {Function} [props.onPressLogFood]
 */
export default function TodayStatsCards({ isDark = true, stats, onPressCalories, onPressLogFood }) {
  const calories = stats?.calories || {};

  const calProgress = useMemo(
    () => caloriesProgressRatio(calories.current, calories.goal),
    [calories.current, calories.goal],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.65)' }]}>
        TODAY
      </Text>

      <CaloriesHeroCard
        isDark={isDark}
        current={Number(calories.current ?? 0)}
        goal={Number(calories.goal ?? DEFAULT_CALORIE_GOAL)}
        progress={calProgress}
        onPress={onPressCalories}
        onPressLogFood={onPressLogFood}
      />
    </View>
  );
}

const cardStyles = StyleSheet.create({
  borderShell: {
    marginBottom: 0,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ringCol: {
    width: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  rightCol: {
    flex: 1,
    minWidth: 0,
    paddingLeft: 12,
    marginLeft: 10,
    borderLeftWidth: StyleSheet.hairlineWidth * 2,
    justifyContent: 'flex-start',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  logFoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: CC.pink,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  logFoodBtnFx: {
    shadowColor: CC.pink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 6,
  },
  logFoodText: {
    fontSize: 14,
    fontWeight: '800',
    color: CC.pink,
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
    fontWeight: '900',
    letterSpacing: -1,
  },
  ringGoal: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '700',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '600',
  },
  metricsCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginTop: 12,
    overflow: 'hidden',
  },
  metricsCardEdgeDark: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  metricsCardEdgeLight: {
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.22)',
  },
  metricCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  metricUnit: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  metricDivider: {
    width: StyleSheet.hairlineWidth * 2,
    alignSelf: 'stretch',
    marginHorizontal: 8,
  },
  nutritionTouch: {
    marginTop: 14,
    borderRadius: 14,
    overflow: 'hidden',
  },
  nutritionGrad: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  nutritionRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chevronPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  nutritionRowTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

const styles = StyleSheet.create({
  wrap: { marginTop: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 8 },
});
