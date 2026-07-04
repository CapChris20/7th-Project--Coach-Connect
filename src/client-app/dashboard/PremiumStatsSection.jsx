/**
 * Premium Stats Section
 *
 * Purpose: UI screen or component: Premium Stats Section. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: GradientBorderShell, PremiumStatsSection
 *
 * @file-header
 */
import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

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

const clamp01 = (x) => Math.max(0, Math.min(1, x));

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const GradientBorderShell = ({ isDark, children, style, borderColors = BORDER_GRADIENT }) => (
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

const RING_SIZE = 102;
const STROKE = 8;
const R = (RING_SIZE - STROKE) / 2;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;
const CIRC = 2 * Math.PI * R;

const CaloriesHeroCard = ({ isDark, current, goal, progress, onPress, onPressLogFood }) => {
  const pct = Math.round(clamp01(progress) * 100);
  const cur = Math.round(Number(current || 0));
  const g = Math.round(Number(goal || 2000));
  const remaining = Math.max(0, g - cur);
  const p = clamp01(progress);

  const c = isDark ? CC : { ...CC, ...CC_LIGHT };
  const hairline = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
  const trackStroke = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.12)';
  const gradId = useRef(`calRing_${Math.random().toString(36).slice(2, 9)}`).current;
  const innerDiscR = Math.max(R - STROKE * 0.9, 6);
  const innerFill = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)';
  const innerStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)';

  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: p,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [p, progressAnim]);

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRC, 0],
  });

  const logHandler = typeof onPressLogFood === 'function' ? onPressLogFood : onPress;

  return (
    <GradientBorderShell isDark={isDark} style={s.borderShell}>
      <View style={s.cardRow}>
          <View style={s.ringCol}>
            <View style={s.ringWrap}>
              <Svg width={RING_SIZE} height={RING_SIZE} style={s.ringSvg}>
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
                <Circle cx={CX} cy={CY} r={innerDiscR} fill={innerFill} stroke={innerStroke} strokeWidth={1} />
                <Circle
                  cx={CX}
                  cy={CY}
                  r={R}
                  stroke={trackStroke}
                  strokeWidth={STROKE}
                  fill="none"
                />
                <AnimatedCircle
                  cx={CX}
                  cy={CY}
                  r={R}
                  stroke={p > 0 ? `url(#${gradId})` : trackStroke}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={CIRC}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${CX}, ${CY}`}
                />
              </Svg>
              <View style={s.ringCenter} pointerEvents="none">
                <Text style={[s.ringBig, { color: c.textPrimary }]}>{cur.toLocaleString()}</Text>
                <Text style={[s.ringGoal, { color: c.textSecondary }]}>
                  / {g.toLocaleString()}{' '}
                  <Text style={{ color: c.textTertiary, fontWeight: '600' }}>kcal</Text>
                </Text>
              </View>
            </View>
          </View>

          <View style={[s.rightCol, { borderLeftColor: hairline }]}>
            <View style={s.headerRow}>
              <View style={s.headerTitleWrap}>
                <Text style={[s.headerTitle, { color: c.textPrimary }]}>Calories</Text>
                <Text style={[s.headerSubtitle, { color: c.textSecondary }]}>Today's budget</Text>
              </View>
              {typeof logHandler === 'function' ? (
                <TouchableOpacity style={[s.logFoodBtn, s.logFoodBtnFx]} onPress={logHandler} activeOpacity={0.75}>
                  <Ionicons name="add-circle-outline" size={18} color={CC.pink} />
                  <Text style={s.logFoodText}>Log food</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View
              style={[
                s.metricsCard,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)' },
                isDark ? s.metricsCardEdgeDark : s.metricsCardEdgeLight,
              ]}
            >
              <View style={s.metricCol}>
                <Text style={[s.metricLabel, { color: c.textTertiary }]}>REMAINING</Text>
                <Text style={[s.metricValue, { color: c.textPrimary }]}>{remaining.toLocaleString()}</Text>
                <Text style={[s.metricUnit, { color: c.textSecondary }]}>kcal</Text>
              </View>
              <View style={[s.metricDivider, { backgroundColor: hairline }]} />
              <View style={s.metricCol}>
                <Text style={[s.metricLabel, { color: c.textTertiary }]}>PROGRESS</Text>
                <Text style={[s.metricValue, { color: pct > 0 ? CC.pink : c.textPrimary }]}>
                  {pct}%
                </Text>
                <Text style={[s.metricUnit, { color: c.textSecondary }]}>of goal</Text>
              </View>
            </View>

            {typeof onPress === 'function' ? (
              <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={s.nutritionTouch}>
                <View style={[s.nutritionGrad, { borderColor: hairline, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)' }]}>
                  <View style={s.nutritionRowInner}>
                    <View style={s.nutritionRowLeft}>
                      <Ionicons name="nutrition-outline" size={20} color={CC.pink} />
                      <Text style={[s.nutritionRowTitle, { color: c.textPrimary }]}>Open Nutrition</Text>
                    </View>
                    <View style={[s.chevronPill, { borderColor: hairline, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)' }]}>
                      <Ionicons name="chevron-forward" size={18} color={CC.cyan} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
    </GradientBorderShell>
  );
};

export default function PremiumStatsSection({ isDark = true, stats, onPressCalories, onPressLogFood }) {
  const calories = stats?.calories || {};

  const calProgress = useMemo(() => {
    const cur = Number(calories.current ?? 0);
    const goal = Number(calories.goal ?? 2000);
    return goal > 0 ? cur / goal : 0;
  }, [calories.current, calories.goal]);

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
        onPressLogFood={onPressLogFood}
      />
    </View>
  );
}

const s = StyleSheet.create({
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
