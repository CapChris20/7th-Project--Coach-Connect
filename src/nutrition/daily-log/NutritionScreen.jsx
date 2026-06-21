/**
 * Nutrition Screen
 *
 * Purpose: UI screen or component: Nutrition Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: NutritionScreen
 *
 * @file-header
 */
import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Polyline } from 'react-native-svg';
import { useTheme } from '../../shared-ui/ThemeContext';

import NutritionDayPicker from './NutritionDayPicker';
import { LoggedFoodCard } from '../components/premiumFoodCard';
import { NUT_CALORIES_GRADIENT as THEME_CAL_GRAD, NUT_MACRO_GRADIENTS } from '../nutritionTheme';

// Nutrition Today gradients (macro donuts + calorie ring when logging)
const NUT_CALORIES_GRADIENT = THEME_CAL_GRAD;
const NUT_MACRO_GRADIENTS_LOCAL = {
  protein: NUT_MACRO_GRADIENTS.protein,
  carbs: NUT_MACRO_GRADIENTS.carbs,
  fat: NUT_MACRO_GRADIENTS.fat,
};

const NUT_NEUTRAL_TRACK = {
  dark: 'rgba(255,255,255,0.12)',
  light: 'rgba(0,0,0,0.08)',
};

const G_TO_OZ = 1 / 28.3495;
const ML_TO_FL_OZ = 1 / 29.5735;

const ACCENT = {
  hotPink: '#FF6B9D',
  orange: '#F97316',
  purple: '#C084FC',
  cyan: '#06B6D4',
  green: '#22C55E',
};

/** Meal card action row — matches vibrant macro / brand styling */
const NUT_SCAN_CYAN = '#64D2FF';
const NUT_QUICK_PURPLE = '#C084FC';
const NUT_SEARCH_GRADIENT = ['#FF6B9D', '#F97316'];

function getColors(isDark) {
  return isDark
    ? {
        ...ACCENT,
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.08)',
        cardBorderSubtle: 'rgba(255,255,255,0.08)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.55)',
        textVeryMuted: 'rgba(255,255,255,0.38)',
        inputBg: 'rgba(255,255,255,0.08)',
        divider: 'rgba(255,255,255,0.06)',
        screenBg: '#0A0A0F',
        mealOuterBg: 'rgba(124,58,237,0.22)',
        // Remove the grey/frost overlay behind food rows.
        mealInnerBg: 'transparent',
        weeklyGlass: 'rgba(255,255,255,0.06)',
        chipBg: 'rgba(255,255,255,0.08)',
        foodItemCardBg: 'rgba(255,255,255,0.05)',
        foodItemCardBorder: 'rgba(255,255,255,0.14)',
        foodItemTitle: '#FFFFFF',
        foodItemSub: '#A6A6A6',
        foodItemIcon: 'rgba(255,255,255,0.5)',
        foodItemActionIcon: 'rgba(255,255,255,0.55)',
      }
    : {
        ...ACCENT,
        cardBg: '#FFFFFF',
        cardBorder: '#E5E5EA',
        cardBorderSubtle: 'rgba(0,0,0,0.06)',
        text: '#1C1C1E',
        textMuted: 'rgba(28,28,30,0.55)',
        textVeryMuted: 'rgba(28,28,30,0.4)',
        inputBg: '#F2F2F7',
        divider: 'rgba(0,0,0,0.08)',
        screenBg: '#F2F2F7',
        mealOuterBg: '#EDE9FE',
        mealInnerBg: '#FFFFFF',
        weeklyGlass: '#FFFFFF',
        chipBg: '#E5E5EA',
        foodItemCardBg: 'rgba(0,0,0,0.03)',
        foodItemCardBorder: 'rgba(0,0,0,0.08)',
        foodItemTitle: '#0A0A0F',
        foodItemSub: '#666666',
        foodItemIcon: 'rgba(10,10,15,0.5)',
        foodItemActionIcon: 'rgba(10,10,15,0.55)',
      };
}

const C = getColors(true);

function cardShadowStyle(isDark) {
  if (isDark) return {};
  if (Platform.OS === 'ios') {
    return {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    };
  }
  return { elevation: 3 };
}

const getMealEmptyVisual = (mealName) => {
  const key = (mealName || '').toLowerCase();
  if (key.includes('breakfast')) {
    return {
      lottie: require('../../assets/animations/legacy/Healthy food for diet & fitness.json'),
    };
  }
  if (key.includes('lunch')) {
    return {
      lottie: require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json'),
    };
  }
  if (key.includes('dinner')) {
    return {
      lottie: require('../../assets/animations/legacy/Fast food.json'),
    };
  }
  // snacks / default
  return {
    lottie: require('../../assets/animations/legacy/food around the city.json'),
  };
};

const CalorieRing = ({ consumed, total, isDark = true, isEmpty = false }) => {
  const size = 264;
  const cx = size / 2;
  const cy = size / 2;
  const strokeInner = 16;
  const rInner = (size - strokeInner) / 2 - 12;
  const circumferenceInner = Math.PI * 2 * rInner;
  const progress = total > 0 ? Math.min(consumed / total, 1) : 0;
  const offset = circumferenceInner - progress * circumferenceInner;
  const trackOuter = isDark ? NUT_NEUTRAL_TRACK.dark : NUT_NEUTRAL_TRACK.light;
  const innerDiscR = Math.max(rInner - strokeInner / 2 - 14, size * 0.26);
  const innerDiscFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.035)';
  const innerDiscStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGradient id="calorieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={NUT_CALORIES_GRADIENT[0]} stopOpacity={1} />
          <Stop offset="100%" stopColor={NUT_CALORIES_GRADIENT[1]} stopOpacity={1} />
        </SvgGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={innerDiscR} fill={innerDiscFill} stroke={innerDiscStroke} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={rInner} stroke={trackOuter} strokeWidth={strokeInner} fill="none" />
      {!isEmpty ? (
        <Circle
          cx={cx}
          cy={cy}
          r={rInner}
          stroke="url(#calorieGrad)"
          strokeWidth={strokeInner}
          fill="none"
          strokeDasharray={circumferenceInner}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
};

const ArcProgress = ({
  size,
  stroke,
  progress,
  gradientColors = NUT_CALORIES_GRADIENT,
  trackColor = 'rgba(255,255,255,0.08)',
  isDark = true,
  isEmpty = false,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = Math.PI * 2 * r;
  const offset = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;
  const innerDiscR = Math.max(r - stroke / 2 - 8, size * 0.2);
  const innerDiscFill = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const innerDiscStroke = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  const gradId = `macroGrad-${size}-${gradientColors.join('-')}`;

  if (isEmpty) {
    return (
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={cx} cy={cy} r={innerDiscR} fill={innerDiscFill} stroke={innerDiscStroke} strokeWidth={1} />
        <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
          <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
        </SvgGradient>
      </Defs>
      <Circle cx={cx} cy={cy} r={innerDiscR} fill={innerDiscFill} stroke={innerDiscStroke} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      {progress > 0 ? (
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
};

// Percent text inside donut should follow theme (not macro colors)
const MacroPercentText = ({ children, style, color }) => (
  <Text style={[style, { color }]}>{children}</Text>
);

const getMealAccentColor = (mealName) => {
  const n = (mealName || '').toLowerCase();
  if (n.includes('breakfast')) return '#F97316';
  if (n.includes('lunch')) return '#06B6D4';
  if (n.includes('dinner')) return '#7C3AED';
  return '#EC4899';
};

const WaterCupCircle = ({ filled, index, isDark }) => {
  const gradId = `waterCupGrad-${index}`;
  const emptyBorder = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.1)';
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: filled ? 0 : 2,
        borderColor: emptyBorder,
        overflow: 'hidden',
        backgroundColor: filled ? 'transparent' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      }}
    >
      {filled ? (
        <Svg width={30} height={30} viewBox="0 0 30 30" style={StyleSheet.absoluteFill}>
          <Defs>
            <SvgGradient id={gradId} x1="0" y1="0" x2="30" y2="30">
              <Stop stopColor="#06B6D4" />
              <Stop offset="1" stopColor="#7B61FF" />
            </SvgGradient>
          </Defs>
          <Circle cx={15} cy={15} r={14} fill={`url(#${gradId})`} />
        </Svg>
      ) : null}
    </View>
  );
};

const MealSection = ({ meal, goal, onScan, onLog, onQuickAdd, onRemoveLog, onEditLog, colors = C, isDark }) => {
  const mealS = useMemo(() => createMealS(colors), [colors]);
  const emptyStyles = useMemo(() => createEmptyStyles(colors), [colors]);
  const foods = meal?.foods ?? [];
  const hasFood = foods.length > 0;
  const mealType = meal?.name ? meal.name.toLowerCase() : 'snacks';
  const emptyVisual = getMealEmptyVisual(meal?.name);
  const accent = getMealAccentColor(meal?.name);
  const mealLabel = meal?.name ?? 'meal';
  const mealTitleColor = isDark ? '#FFFFFF' : colors.text;
  const mealCalsColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textMuted;
  const toDisplayAmount = (gramsOrMl, isMl) => {
    const n = Number(gramsOrMl) || 0;
    return (n * (isMl ? ML_TO_FL_OZ : G_TO_OZ)).toFixed(1) + ' oz';
  };
  const safeGoal = Number(goal) || 0;
  const mealCals = Number(meal?.cals) || 0;
  const innerShadow = cardShadowStyle(isDark);

  const actionSurface = isDark ? '#14141C' : '#FAFAFC';

  const actionRow = () => (
    <View style={mealS.btnRow}>
      <Pressable
        onPress={() => onScan(meal.name)}
        style={({ pressed }) => [
          mealS.scanBtn,
          {
            borderColor: NUT_SCAN_CYAN,
            backgroundColor: actionSurface,
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Ionicons name="barcode-outline" size={18} color={NUT_SCAN_CYAN} />
        <Text style={[mealS.scanBtnText, { color: NUT_SCAN_CYAN }]}>Scan</Text>
      </Pressable>
      <Pressable onPress={() => onLog(meal.name)} style={({ pressed }) => [mealS.logBtnWrap, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
        <LinearGradient colors={NUT_SEARCH_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={mealS.logBtn}>
          <Ionicons name="search-outline" size={20} color="#FFFFFF" />
          <Text style={mealS.logBtnText}>Search</Text>
        </LinearGradient>
      </Pressable>
      <Pressable
        onPress={() => onQuickAdd?.(mealType)}
        style={({ pressed }) => [
          mealS.quickAddBtn,
          {
            borderColor: NUT_QUICK_PURPLE,
            backgroundColor: actionSurface,
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <View style={mealS.quickAddContent}>
          <Ionicons name="create-outline" size={18} color={NUT_QUICK_PURPLE} />
          <Text style={[mealS.quickAddBtnText, { color: NUT_QUICK_PURPLE }]}>Quick Add</Text>
        </View>
      </Pressable>
    </View>
  );

  return (
    <View style={[mealS.outer, { backgroundColor: colors.mealOuterBg }]}>
      <View style={mealS.header}>
        <View style={mealS.titleBlock}>
          <Text style={[mealS.mealName, { color: mealTitleColor }]}>{meal?.name ?? 'Meal'}</Text>
          <View style={[mealS.accentBar, { backgroundColor: accent }]} />
        </View>
        <Text style={[mealS.mealCals, { color: mealCalsColor }]}>
          {mealCals > 0 ? `${mealCals} cal` : '—'}
        </Text>
      </View>
      {hasFood && safeGoal > 0 && (
        <View style={[mealS.progressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : colors.cardBorderSubtle }]}>
          <LinearGradient
            colors={[colors.hotPink, colors.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[mealS.progressFill, { width: `${Math.min((mealCals / safeGoal) * 100, 100)}%` }]}
          />
        </View>
      )}
      {hasFood ? (
        <View
          style={[
            mealS.inner,
            mealS.innerWithFood,
            { backgroundColor: colors.mealInnerBg, borderColor: colors.cardBorder },
            innerShadow,
          ]}
        >
          <View style={mealS.foodList}>
            {meal.foods.map((food) => (
              <LoggedFoodCard
                key={food.id || food.food_name}
                log={food}
                isDark={isDark}
                amount={toDisplayAmount(food.serving_grams ?? 0, (food.metadata?.servingUnit || '').toLowerCase() === 'ml') || '—'}
                onRemove={onRemoveLog}
                onEdit={onEditLog}
              />
            ))}
          </View>
          {actionRow()}
        </View>
      ) : (
        <View style={[mealS.inner, { backgroundColor: colors.mealInnerBg, borderColor: colors.cardBorder }, innerShadow]}>
          <View style={emptyStyles.container}>
            <View style={emptyStyles.lottieWrap}>
              <LottieView source={emptyVisual.lottie} autoPlay loop style={emptyStyles.lottie} />
            </View>
            <Text style={[emptyStyles.title, { color: colors.text }]}>Fuel Your Progress</Text>
            <Text style={emptyStyles.subtitle}>
              Your {mealLabel.toLowerCase()} is a blank canvas. Start tracking to see your macros in action.
            </Text>
            <View style={emptyStyles.buttonRow}>
              <Pressable
                onPress={() => onScan(meal?.name)}
                style={({ pressed }) => [
                  emptyStyles.scanBtn,
                  {
                    borderColor: NUT_SCAN_CYAN,
                    backgroundColor: isDark ? '#14141C' : '#FAFAFC',
                    opacity: pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <Ionicons name="barcode-outline" size={18} color={NUT_SCAN_CYAN} />
                <Text style={[emptyStyles.scanText, { color: NUT_SCAN_CYAN }]}>Scan</Text>
              </Pressable>
              <Pressable onPress={() => onLog(meal?.name)} style={({ pressed }) => [emptyStyles.searchBtn, { opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
                <LinearGradient colors={NUT_SEARCH_GRADIENT} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={emptyStyles.searchGradient}>
                  <Ionicons name="search-outline" size={20} color="#FFFFFF" />
                  <Text style={emptyStyles.searchText} numberOfLines={1} ellipsizeMode="tail">
                    Search
                  </Text>
                </LinearGradient>
              </Pressable>
              <Pressable
                onPress={() => onQuickAdd?.(mealType)}
                style={({ pressed }) => [
                  emptyStyles.quickBtn,
                  {
                    borderColor: NUT_QUICK_PURPLE,
                    backgroundColor: isDark ? '#14141C' : '#FAFAFC',
                    opacity: pressed ? 0.88 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                <View style={emptyStyles.quickAddContent}>
                  <Ionicons name="create-outline" size={18} color={NUT_QUICK_PURPLE} />
                  <Text style={[emptyStyles.quickText, { color: NUT_QUICK_PURPLE }]}>Quick Add</Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const createMealS = (colors) =>
  StyleSheet.create({
    outer: {
      borderRadius: 28,
      padding: 16,
      marginBottom: 14,
      overflow: 'visible',
    },
    inner: {
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: 4,
      overflow: 'hidden',
    },
    innerWithFood: {
      overflow: 'visible',
      paddingTop: 8,
      paddingHorizontal: 8,
      paddingBottom: 12,
    },
    foodList: {
      marginBottom: 6,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    titleBlock: { flex: 1 },
    accentBar: { width: 44, height: 4, borderRadius: 2, marginTop: 8 },
    mealName: { fontSize: 17, fontWeight: '800' },
    mealCals: { fontSize: 13, fontWeight: '600', marginTop: 2 },
    progressTrack: {
      height: 4,
      borderRadius: 99,
      marginBottom: 10,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 99 },
    btnRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
      flexWrap: 'nowrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 2,
    },
    scanBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    scanBtnText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
    logBtnWrap: {
      flex: 1.55,
      flexShrink: 1,
      minWidth: 0,
      borderRadius: 28,
      overflow: 'visible',
      ...Platform.select({
        ios: {
          shadowColor: '#FF6B9D',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.42,
          shadowRadius: 12,
        },
        android: { elevation: 10 },
      }),
    },
    logBtn: {
      borderRadius: 28,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      gap: 8,
      minHeight: 52,
    },
    logBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
    quickAddBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 12,
    },
    quickAddContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
      maxWidth: '100%',
    },
    quickAddBtnText: {
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 0.15,
      textAlign: 'center',
      flexShrink: 1,
    },
  });

const createEmptyStyles = (colors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      gap: 4,
    },
    lottieWrap: {
      width: 80,
      height: 80,
      marginBottom: 2,
    },
    lottie: {
      width: '100%',
      height: '100%',
    },
    title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 18,
      paddingHorizontal: 4,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
      width: '100%',
      alignItems: 'center',
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
      paddingVertical: 0,
    },
    scanBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    scanText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
    searchBtn: {
      flex: 1.55,
      flexShrink: 1,
      minWidth: 0,
      borderRadius: 28,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: '#FF6B9D',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.42,
          shadowRadius: 12,
        },
        android: { elevation: 10 },
      }),
    },
    searchGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 52,
      width: '100%',
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    searchText: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', minWidth: 0, letterSpacing: 0.3 },
    quickBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 1.5,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    quickAddContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: '100%',
      maxWidth: '100%',
    },
    quickText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.15, textAlign: 'center', flexShrink: 1 },
  });

const WeeklyChart = ({ weekData, colors = C, isDark }) => {
  const days = weekData?.length ? weekData : DEFAULT_WEEK;
  const hasData = days.some((d) => Number(d?.cals) > 0);
  const weekAvg = days.reduce((s, d) => s + (Number(d?.cals) || 0), 0) / 7;
  const weekMax = hasData ? Math.max(...days.map((d) => Number(d?.cals) || 0), 1) : 1;
  const todayIndex = new Date().getDay();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartW = 320;
  const chartH = 56;
  const pad = 8;
  const pts = days.map((d, i) => {
    const cals = Number(d?.cals) || 0;
    const t = i / Math.max(days.length - 1, 1);
    const x = pad + t * (chartW - pad * 2);
    const y = chartH - pad - (hasData ? (cals / weekMax) * (chartH - pad * 2) : chartH / 2 - pad);
    return `${x},${y}`;
  });
  const shadow = cardShadowStyle(isDark);
  return (
    <View
      style={[
        chart.card,
        { backgroundColor: colors.weeklyGlass, borderColor: colors.cardBorder },
        shadow,
      ]}
    >
      <View style={chart.header}>
        <View>
          <Text style={[chart.title, { color: colors.text }]}>Weekly Momentum</Text>
          <Text style={[chart.sub, { color: colors.textMuted }]}>
            {hasData ? `Avg ${Math.round(weekAvg).toLocaleString()} cal / day` : 'Your journey starts this week'}
          </Text>
        </View>
      </View>
      <View style={chart.sparkWrap}>
        <Svg width={chartW} height={chartH} style={chart.sparkSvg}>
          <Polyline
            points={pts.join(' ')}
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.2)' : 'rgba(123,97,255,0.25)'}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <View style={chart.daysRow}>
        {days.map((d, i) => {
          const isToday = i === todayIndex;
          const dayKey = d?.day ?? dayLabels[i] ?? i;
          return (
            <View key={String(dayKey)} style={chart.dayCol}>
              <View
                style={[
                  chart.dayCircle,
                  {
                    borderColor: isToday ? ACCENT.hotPink : colors.cardBorder,
                    backgroundColor: isToday
                      ? isDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(123,97,255,0.12)'
                      : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    chart.dayInitial,
                    { color: colors.textMuted },
                    isToday && { color: colors.text, fontWeight: '800' },
                  ]}
                >
                  {dayLabels[i].charAt(0)}
                </Text>
              </View>
              <Text
                style={[
                  chart.dayLabel,
                  { color: colors.textMuted },
                  isToday && { color: colors.text, fontWeight: '700' },
                ]}
              >
                {dayLabels[i].substring(0, 3)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const chart = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  header: { marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  sparkWrap: { alignItems: 'center', marginBottom: 4 },
  sparkSvg: { alignSelf: 'center' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: 4 },
  dayCol: { flex: 1, alignItems: 'center', gap: 6 },
  dayCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInitial: { fontSize: 13, fontWeight: '600' },
  dayLabel: { fontSize: 10, fontWeight: '500' },
});

const DEFAULT_MEALS = [
  { name: 'Breakfast', cals: 0, foods: [] },
  { name: 'Lunch',     cals: 0, foods: [] },
  { name: 'Dinner',    cals: 0, foods: [] },
  { name: 'Snacks',    cals: 0, foods: [] },
];
const DEFAULT_WEEK = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => ({ day: d, cals: 0 }));
const DEFAULT_MACROS = [
  { label: 'Protein', val: 0, goal: 150, color: '#FF6B9D', pct: 0 },
  { label: 'Carbs',   val: 0, goal: 250, color: '#F97316', pct: 0 },
  { label: 'Fat',     val: 0, goal: 70,  color: '#06B6D4', pct: 0 },
];

export const NutritionScreen = ({
  consumed   = 0,
  goal       = 2200,
  burned: _burned = 0,
  macros     = DEFAULT_MACROS,
  meals      = DEFAULT_MEALS,
  weekData   = DEFAULT_WEEK,
  onScan     = () => {},
  onLog      = () => {},
  onManualSave: _onManualSave = () => {},
  onRemoveLog,
  onEditLog,
  onSearch   = () => {},
  onPillSearch,
  onOpenSettings,
  onQuickAdd = () => {},
  viewDate,
  onSelectViewDate,
  datesWithLogs = [],
  onOpenDailyFacts,
  topFoodNames = [],
}) => {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const handleOpenQuickAdd = (mealType) => onQuickAdd?.(mealType ?? 'snacks');
  const ringShadow = cardShadowStyle(isDark);
  const solidCardBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const isEmpty = consumed <= 0;
  const remainingKcal = Math.max(Math.round(goal - consumed), 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={screen.scroll} showsVerticalScrollIndicator={false}>

        {/* Search, filter, theme, settings */}
        <View style={screen.searchBlock}>
          <View style={screen.searchTopRow}>
            <TouchableOpacity
              onPress={onSearch}
              activeOpacity={0.8}
              style={[
                screen.searchCard,
                { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
                ringShadow,
              ]}
            >
              <View style={[screen.searchInner, { backgroundColor: colors.inputBg, opacity: 0.92 }]}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <Text style={[screen.searchPlaceholder, { color: colors.textMuted }]} numberOfLines={1}>
                  Search foods, brands...
                </Text>
              </View>
            </TouchableOpacity>
            {onOpenSettings ? (
              <TouchableOpacity
                onPress={onOpenSettings}
                style={[screen.filterIconBtn, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, ringShadow]}
                activeOpacity={0.8}
              >
                <Ionicons name="options-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            ) : null}
          </View>
          {/* Theme toggle removed — controlled via Settings */}
        </View>

        {onSelectViewDate ? (
          <NutritionDayPicker
            selectedDate={viewDate}
            onSelectDate={onSelectViewDate}
            isDark={isDark}
            datesWithLogs={datesWithLogs}
          />
        ) : null}

        {/* Calorie ring — center hero */}
        <View
          style={[
            screen.ringCard,
            { backgroundColor: solidCardBg, borderColor: colors.cardBorder },
            ringShadow,
            screen.ringCardOuter,
          ]}
        >
          <View style={screen.ringCenter}>
            <CalorieRing consumed={consumed} total={goal} isDark={isDark} isEmpty={isEmpty} />
            <View style={screen.ringTextOverlay}>
              {isEmpty ? (
                <Text style={[screen.ringSmallLabel, { color: colors.textMuted }]}>Start logging</Text>
              ) : (
                <Text style={[screen.ringSmallLabel, { color: colors.textMuted }]}>CONSUMED</Text>
              )}
              <Text style={[screen.ringBigNumber, { color: colors.text }]}>
                {(isEmpty ? remainingKcal : Math.round(consumed)).toLocaleString()}
              </Text>
              <Text style={[screen.ringSubLabel, { color: colors.textMuted }]}>
                {isEmpty
                  ? `of ${goal.toLocaleString()} remaining`
                  : `of ${goal.toLocaleString()} kcal`}
              </Text>
            </View>
          </View>
        </View>

        {/* Macro rings + bars */}
        <View style={screen.macroRow}>
          {(macros || DEFAULT_MACROS).map((m, macroIndex) => {
            const pct = Math.min(Math.max(Math.round(Number(m.pct) || 0), 0), 999);
            const pctFill = Math.min(Number(m.pct) || 0, 100);
            const val = Math.round(Number(m.val) || 0);
            const gGoal = Math.round(Number(m.goal) || 0);
            const macroKey = String(m.label || '').toLowerCase();
            const macroEmpty = val <= 0 && pctFill <= 0;
            const trackColor = isDark ? NUT_NEUTRAL_TRACK.dark : NUT_NEUTRAL_TRACK.light;
            const gradColors = NUT_MACRO_GRADIENTS_LOCAL[macroKey] ?? NUT_CALORIES_GRADIENT;
            return (
              <View
                key={m.label}
                style={[
                  screen.macroCard,
                  { backgroundColor: solidCardBg, borderColor: colors.cardBorderSubtle },
                  ringShadow,
                ]}
              >
                <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
                  <ArcProgress
                    size={100}
                    stroke={8}
                    progress={pctFill}
                    gradientColors={gradColors}
                    trackColor={trackColor}
                    isDark={isDark}
                    isEmpty={macroEmpty}
                  />
                  <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <MacroPercentText style={screen.macroPct} color={colors.text}>
                      {pct}%
                    </MacroPercentText>
                    <Text style={[screen.macroRemaining, { color: colors.textMuted }]}>
                      {Math.max(gGoal - val, 0)}g left
                    </Text>
                  </View>
                </View>
                <Text style={[screen.macroLabel, { color: colors.textMuted }]}>{m.label}</Text>
                <Text style={[screen.macroGoal, { color: colors.text }]}>
                  {val} / {gGoal}g
                </Text>
                {macroEmpty ? null : (
                  <View style={[screen.macroBarTrack, { backgroundColor: trackColor }]}>
                    <View style={[screen.macroBarFill, { width: `${pctFill}%` }]}>
                      <LinearGradient
                        colors={gradColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                      />
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <WeeklyChart weekData={weekData ?? DEFAULT_WEEK} colors={colors} isDark={isDark} />

        {onOpenDailyFacts ? (
          <TouchableOpacity
            onPress={onOpenDailyFacts}
            activeOpacity={0.85}
            style={[
              screen.dailyFactsBtn,
              { borderColor: colors.cardBorder },
            ]}
          >
            <Ionicons name="nutrition-outline" size={20} color={colors.text} />
            <Text style={[screen.dailyFactsBtnText, { color: colors.text }]}>
              Daily Nutrition Facts
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}

        {(meals || DEFAULT_MEALS).map((meal) => (
          <MealSection
            key={meal.name}
            meal={meal}
            goal={goal}
            onScan={onScan}
            onLog={onLog}
            onQuickAdd={handleOpenQuickAdd}
            onRemoveLog={onRemoveLog}
            onEditLog={onEditLog}
            colors={colors}
            isDark={isDark}
          />
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
};

const screen = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
  dailyFactsBtn: {
    marginTop: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'transparent',
  },
  dailyFactsBtnText: { fontWeight: '800', fontSize: 14, flex: 1 },
  searchBlock: { marginBottom: 14 },
  searchTopRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  searchCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 12,
  },
  filterIconBtn: {
    width: 48,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  smallIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  searchPlaceholder: { flex: 1, fontSize: 13 },
  suggRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
  suggChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  suggText: { fontSize: 11, fontWeight: '600' },
  ringCardOuter: {
    marginTop: 12,
    marginBottom: 12,
  },
  ringCard: {
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringTextOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center', maxWidth: 168 },
  ringSmallLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: '700' },
  ringBigNumber: { fontSize: 38, fontWeight: '900', lineHeight: 44 },
  ringSubLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  macroCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
  },
  macroPct: { fontSize: 17, fontWeight: '800' },
  macroRemaining: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  macroLabel: { fontSize: 11, fontWeight: '700' },
  macroGoal: { fontSize: 11, fontWeight: '600' },
  macroBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 99,
    marginTop: 2,
    overflow: 'hidden',
  },
  macroBarFill: { height: '100%', borderRadius: 99, overflow: 'hidden' },
});

export default NutritionScreen;

