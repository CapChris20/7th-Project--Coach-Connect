// Today's calorie ring on the client home screen: eaten vs goal, remaining, Log food.
// Flow: read current/goal → clamp progress → animate the ring → Log food or Open Nutrition.
// Used by the client home dashboard under the TODAY heading.
//
// vocab: neobrutalist = thick borders, hard shadows, gradient only for primary moment per screen

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

/** Dark pink → dark orange — trainer card shell and CTAs */
export const TRAINER_BORDER_GRADIENT = ['#BE185D', '#C2410C'];

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

function caloriesProgressRatio(currentCalories, goalCalories) {
  const eaten = Number(currentCalories ?? 0);
  const goal = Number(goalCalories ?? DEFAULT_CALORIE_GOAL);
  return goal > 0 ? eaten / goal : 0;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function CaloriesHeroCard({ current, goal, progress, onPress, onPressLogFood }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const isDark = colorScheme === 'dark';
  
  const percentComplete = Math.round(clamp01(progress) * PERCENT_SCALE);
  const caloriesEaten = Math.round(Number(current || 0));
  const caloriesGoal = Math.round(Number(goal || DEFAULT_CALORIE_GOAL));
  const caloriesRemaining = Math.max(0, caloriesGoal - caloriesEaten);
  const clampedProgress = clamp01(progress);

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
    <NbCard style={cardStyles.card}>
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
                  <Stop offset="0" stopColor={gradients.brand.colors[0]} />
                  <Stop offset="1" stopColor={gradients.brand.colors[1]} />
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
              <Text style={[cardStyles.ringBig, { color: colors.nbInk }]}>{caloriesEaten.toLocaleString()}</Text>
              <Text style={[cardStyles.ringGoal, { color: colors.nbMuted }]}>
                / {caloriesGoal.toLocaleString()}{' '}
                <Text style={{ color: colors.nbMuted, fontWeight: '600' }}>kcal</Text>
              </Text>
            </View>
          </View>
        </View>

        <View style={[cardStyles.rightCol, { borderLeftColor: colors.nbBorder }]}>
          <View style={cardStyles.headerRow}>
            <View style={cardStyles.headerTitleWrap}>
              <Text style={[cardStyles.headerTitle, { color: colors.nbInk }]}>Calories</Text>
              <Text style={[cardStyles.headerSubtitle, { color: colors.nbMuted }]}>Today's budget</Text>
            </View>
            {typeof logHandler === 'function' ? (
              <NbButton variant="brand" sm onPress={logHandler}>
                Log food
              </NbButton>
            ) : null}
          </View>

          <View
            style={[
              cardStyles.metricsCard,
              { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
                borderColor: colors.nbBorder,
              },
            ]}
          >
            <View style={cardStyles.metricCol}>
              <Text style={[cardStyles.metricLabel, { color: colors.nbMuted }]}>REMAINING</Text>
              <Text style={[cardStyles.metricValue, { color: colors.nbInk }]}>{caloriesRemaining.toLocaleString()}</Text>
              <Text style={[cardStyles.metricUnit, { color: colors.nbMuted }]}>kcal</Text>
            </View>
            <View style={[cardStyles.metricDivider, { backgroundColor: colors.nbBorder }]} />
            <View style={cardStyles.metricCol}>
              <Text style={[cardStyles.metricLabel, { color: colors.nbMuted }]}>PROGRESS</Text>
              <Text style={[cardStyles.metricValue, { color: percentComplete > 0 ? gradients.brand.colors[0] : colors.nbInk }]}>
                {percentComplete}%
              </Text>
              <Text style={[cardStyles.metricUnit, { color: colors.nbMuted }]}>of goal</Text>
            </View>
          </View>

          {typeof onPress === 'function' ? (
            <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={cardStyles.nutritionTouch}>
              <View style={[cardStyles.nutritionRow, { borderColor: colors.nbBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
                <View style={cardStyles.nutritionRowInner}>
                  <View style={cardStyles.nutritionRowLeft}>
                    <Ionicons name="nutrition-outline" size={20} color={gradients.brand.colors[0]} />
                    <Text style={[cardStyles.nutritionRowTitle, { color: colors.nbInk }]}>Open Nutrition</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </NbCard>
  );
}

// ===== MAIN FUNCTION =====

/**
 * TODAY heading plus the calorie hero card.
 * @param {object} props
 * @param {object} [props.stats]
 * @param {Function} [props.onPressCalories]
 * @param {Function} [props.onPressLogFood]
 */
export default function TodayStatsCards({ stats, onPressCalories, onPressLogFood }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const calories = stats?.calories || {};

  const calProgress = useMemo(
    () => caloriesProgressRatio(calories.current, calories.goal),
    [calories.current, calories.goal],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.nbMuted }]}>
        TODAY
      </Text>

      <CaloriesHeroCard
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
