

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Polyline } from 'react-native-svg';
import { useTheme } from '../../shared/ui/ThemeContext';

const G_TO_OZ = 1 / 28.3495;
const ML_TO_FL_OZ = 1 / 29.5735;

const ACCENT = {
  hotPink: '#FF6B9D',
  orange: '#F97316',
  purple: '#C084FC',
  cyan: '#06B6D4',
  green: '#22C55E',
};

function getColors(isDark) {
  return isDark
    ? {
        ...ACCENT,
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.1)',
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
      lottie: require('../../assets/Lotties for Anatrox/Healthy food for diet & fitness.json'),
    };
  }
  if (key.includes('lunch')) {
    return {
      lottie: require('../../assets/Lotties for Anatrox/Food squeeze_With Burger and hot dog.json'),
    };
  }
  if (key.includes('dinner')) {
    return {
      lottie: require('../../assets/Lotties for Anatrox/Fast food.json'),
    };
  }
  // snacks / default
  return {
    lottie: require('../../assets/Lotties for Anatrox/food around the city.json'),
  };
};

const CalorieRing = ({ consumed, total, isDark = true }) => {
  const size = 264;
  const cx = size / 2;
  const cy = size / 2;
  const strokeOuter = 13;
  const strokeInner = 16;
  const rInner = (size - strokeInner) / 2 - 12;
  const circumferenceInner = Math.PI * 2 * rInner;
  const progress = total > 0 ? Math.min(consumed / total, 1) : 0;
  const offset = circumferenceInner - progress * circumferenceInner;
  // Remove the outer decorative ring entirely (it made the circle look "cut"/segmented).
  const trackOuter = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const innerDiscR = Math.max(rInner - strokeInner / 2 - 14, size * 0.26);
  const innerDiscFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.035)';
  const innerDiscStroke = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGradient id="calorieGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF2D78" stopOpacity={1} />
          <Stop offset="45%" stopColor="#F97316" stopOpacity={1} />
          <Stop offset="100%" stopColor="#EC4899" stopOpacity={1} />
        </SvgGradient>
      </Defs>
      {/* Inner hub — drawn first so rings sit on top */}
      <Circle cx={cx} cy={cy} r={innerDiscR} fill={innerDiscFill} stroke={innerDiscStroke} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={rInner} stroke={trackOuter} strokeWidth={strokeInner} fill="none" />
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
    </Svg>
  );
};

const ArcProgress = ({
  size,
  stroke,
  progress,
  color,
  trackColor = 'rgba(255,255,255,0.08)',
  isDark = true,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = Math.PI * 2 * r;
  const offset = circumference - (progress / 100) * circumference;
  const innerDiscR = Math.max(r - stroke / 2 - 10, size * 0.22);
  const innerDiscFill = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const innerDiscStroke = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={cx} cy={cy} r={innerDiscR} fill={innerDiscFill} stroke={innerDiscStroke} strokeWidth={1} />
      <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
      <Circle
        cx={cx}
        cy={cy}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </Svg>
  );
};

const MACRO_RING_COLORS = {
  Protein: '#EC4899',
  Carbs: '#F97316',
  Fat: '#06B6D4',
};

const getMacroRingColor = (label) => MACRO_RING_COLORS[label] || '#EC4899';

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

const FoodItemRow = ({ name, cals, amount, p, c, f, fiber, sugar, sodium, potassium, logId, log, onRemove, onEdit, colors = C }) => {
  const hasSodium = Number(sodium) > 0;
  const hasFiber = Number(fiber) > 0;
  const hasSugar = Number(sugar) > 0;
  const hasPotassium = Number(potassium) > 0;
  const hasSecondary = hasFiber || hasSugar || hasSodium || hasPotassium;
  const toG = (g) => Number(g) || 0;
  const secondaryParts = [];
  if (hasFiber) secondaryParts.push(`Fiber ${toG(fiber).toFixed(1)} g`);
  if (hasSugar) secondaryParts.push(`Sugar ${toG(sugar).toFixed(1)} g`);
  if (hasSodium) secondaryParts.push(`Sodium ${Math.round(Number(sodium) || 0)}mg`);
  if (hasPotassium) secondaryParts.push(`Potassium ${Math.round(Number(potassium) || 0)}mg`);
  const pg = toG(p).toFixed(1);
  const cg = toG(c).toFixed(1);
  const fg = toG(f).toFixed(1);
  const iconMuted = colors.textVeryMuted;
  const editIcon = colors.textMuted;
  return (
    <View style={[foodRow.container, { borderBottomColor: colors.divider }]}>
      <View style={[foodRow.iconBox, { backgroundColor: colors.inputBg }]}>
        <Ionicons name="restaurant-outline" size={18} color={iconMuted} />
      </View>
      <View style={foodRow.mid}>
        <View style={foodRow.nameCalRow}>
          <Text style={[foodRow.name, { color: colors.text }]} numberOfLines={2}>
            {name}
          </Text>
          <Text style={[foodRow.calsInline, { color: colors.textMuted }]}>{Math.round(Number(cals) || 0)} cal</Text>
        </View>
        <Text style={[foodRow.amount, { color: colors.textVeryMuted }]}>{amount}</Text>
        <View style={foodRow.pillRow}>
          <View style={foodRow.pillProtein}>
            <Text style={foodRow.pillProteinText}>P {pg}g</Text>
          </View>
          <View style={foodRow.pillCarbs}>
            <Text style={foodRow.pillCarbsText}>C {cg}g</Text>
          </View>
          <View style={foodRow.pillFat}>
            <Text style={foodRow.pillFatText}>F {fg}g</Text>
          </View>
        </View>
        {hasSecondary ? <Text style={[foodRow.secondary, { color: colors.textVeryMuted }]}>{secondaryParts.join('  ')}</Text> : null}
      </View>
      <View style={foodRow.actionsCol}>
        {onEdit && log ? (
          <TouchableOpacity onPress={() => onEdit(log)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Ionicons name="pencil-outline" size={16} color={editIcon} />
          </TouchableOpacity>
        ) : null}
        {onRemove && logId ? (
          <TouchableOpacity onPress={() => onRemove(logId)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={16} color="rgba(255,107,157,0.85)" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const foodRow = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mid: { flex: 1, gap: 3 },
  nameCalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  calsInline: { fontSize: 13, fontWeight: '700' },
  amount: { fontSize: 12 },
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  pillProtein: {
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillProteinText: { fontSize: 11, fontWeight: '700', color: '#EC4899' },
  pillCarbs: {
    backgroundColor: 'rgba(249,115,22,0.15)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillCarbsText: { fontSize: 11, fontWeight: '700', color: '#F97316' },
  pillFat: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillFatText: { fontSize: 11, fontWeight: '700', color: '#06B6D4' },
  secondary: { fontSize: 10, marginTop: 4 },
  actionsCol: { gap: 8, paddingTop: 2 },
});

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

  const actionRow = (compact) => (
    <View style={[mealS.btnRow, compact && { marginTop: 6 }]}>
      <TouchableOpacity
        onPress={() => onScan(meal.name)}
        activeOpacity={0.8}
        style={[
          mealS.scanBtn,
          { borderColor: colors.cardBorder, backgroundColor: colors.inputBg },
        ]}
      >
        <Ionicons name="barcode-outline" size={compact ? 14 : 16} color={accent} />
        {!compact ? <Text style={[mealS.scanBtnText, { color: accent }]}>Scan</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => onLog(meal.name)} activeOpacity={0.85} style={mealS.logBtnWrap}>
        <LinearGradient colors={['#FF5D9E', '#FF834D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mealS.logBtn}>
          <Ionicons name="search-outline" size={compact ? 14 : 16} color="#FFFFFF" />
          <Text style={mealS.logBtnText}>Search</Text>
        </LinearGradient>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onQuickAdd && onQuickAdd(mealType)}
        activeOpacity={0.85}
        style={[
          mealS.quickAddBtn,
          {
            borderColor: isDark ? `${accent}55` : `${accent}40`,
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
          },
        ]}
      >
        <Ionicons name="add-circle-outline" size={compact ? 14 : 16} color={accent} />
        <Text style={[mealS.quickAddBtnText, { color: accent }]}>Quick Add</Text>
      </TouchableOpacity>
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
        <View style={[mealS.inner, { backgroundColor: colors.mealInnerBg, borderColor: colors.cardBorder }, innerShadow]}>
          <View style={{ marginBottom: 6 }}>
            {meal.foods.map((food) => (
              <FoodItemRow
                key={food.id || food.food_name}
                name={food.food_name}
                cals={food.calories}
                p={food.protein}
                c={food.carbs}
                f={food.fat}
                fiber={food.fiber}
                sugar={food.sugar}
                sodium={food.sodium}
                potassium={food.potassium ?? food.metadata?.potassium}
                amount={toDisplayAmount(food.serving_grams ?? 0, (food.metadata?.servingUnit || '').toLowerCase() === 'ml') || '—'}
                logId={food.id}
                log={food}
                onRemove={onRemoveLog}
                onEdit={onEditLog}
                colors={colors}
              />
            ))}
          </View>
          {actionRow(false)}
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
              <TouchableOpacity style={emptyStyles.scanBtn} onPress={() => onScan(meal?.name)} activeOpacity={0.8}>
                <Ionicons name="barcode-outline" size={16} color={accent} />
                <Text style={[emptyStyles.scanText, { color: accent }]}>Scan</Text>
              </TouchableOpacity>
              <TouchableOpacity style={emptyStyles.searchBtn} onPress={() => onLog(meal?.name)} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#FF5D9E', '#FF834D']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={emptyStyles.searchGradient}
                >
                  <Ionicons name="search-outline" size={14} color="#FFFFFF" />
                  <Text style={emptyStyles.searchText} numberOfLines={1} ellipsizeMode="tail">
                    Search
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={emptyStyles.quickBtn} onPress={() => onQuickAdd && onQuickAdd(mealType)} activeOpacity={0.8}>
                <Text style={[emptyStyles.quickText, { color: colors.textVeryMuted }]}>Quick Add</Text>
              </TouchableOpacity>
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
      overflow: 'hidden',
    },
    inner: {
      borderRadius: 22,
      borderWidth: StyleSheet.hairlineWidth,
      marginTop: 4,
      overflow: 'hidden',
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
    btnRow: { flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'nowrap', alignItems: 'center' },
    scanBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      height: 44,
      borderRadius: 99,
      borderWidth: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
    },
    scanBtnText: { fontSize: 13, fontWeight: '700' },
    logBtnWrap: { flex: 1.4, flexShrink: 1, minWidth: 0, minHeight: 44, height: 44 },
    logBtn: {
      borderRadius: 99,
      height: 44,
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      flexDirection: 'row',
      gap: 6,
    },
    logBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    quickAddBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      height: 44,
      borderRadius: 99,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickAddBtnText: { fontSize: 12, fontWeight: '600' },
  });

const createEmptyStyles = (colors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 12,
      gap: 6,
    },
    lottieWrap: {
      width: 120,
      height: 120,
      marginBottom: 4,
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
    buttonRow: { flexDirection: 'row', gap: 6, marginTop: 12, width: '100%', alignItems: 'center', flexWrap: 'nowrap' },
    scanBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      height: 44,
      borderRadius: 99,
      backgroundColor: 'transparent',
    },
    scanText: { fontSize: 12, fontWeight: '700' },
    searchBtn: { flex: 1.35, flexShrink: 1, minWidth: 0, height: 44, borderRadius: 99, overflow: 'hidden' },
    searchGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 44,
      width: '100%',
      paddingHorizontal: 8,
    },
    searchText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', minWidth: 0 },
    quickBtn: {
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      alignItems: 'center',
      justifyContent: 'center',
      height: 44,
      borderRadius: 99,
    },
    quickText: { fontSize: 12, fontWeight: '600' },
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
  onOpenSettings,
  onQuickAdd = () => {},
}) => {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const handleOpenQuickAdd = (mealType) => onQuickAdd?.(mealType ?? 'snacks');
  const ringShadow = cardShadowStyle(isDark);
  const solidCardBg = isDark ? '#0A0A0F' : '#FFFFFF';

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
              <View style={[screen.searchInner, { backgroundColor: colors.inputBg }]}>
                <Ionicons name="search-outline" size={18} color={colors.textMuted} />
                <Text style={[screen.searchPlaceholder, { color: colors.textMuted }]} numberOfLines={1}>
                  Search foods, brands...
                </Text>
                <Ionicons name="barcode-outline" size={22} color={ACCENT.hotPink} />
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
          <View style={screen.suggRow}>
            {['McDonalds', 'Chicken Breast', 'Chipotle'].map((t) => (
              <View key={t} style={[screen.suggChip, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }]}>
                <Text style={[screen.suggText, { color: colors.textMuted }]}>{t}</Text>
              </View>
            ))}
          </View>
          {/* Theme toggle removed — controlled via Settings */}
        </View>

        {/* Calorie ring — center hero */}
        <View style={[screen.ringGradientBorder, ringShadow]}>
          <LinearGradient
            colors={['#E91E63', '#FF6B9D', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              screen.ringCard,
              { backgroundColor: solidCardBg, borderColor: colors.cardBorder },
            ]}
          >
            <View style={screen.ringCenter}>
              <CalorieRing consumed={consumed} total={goal} isDark={isDark} />
              <View style={screen.ringTextOverlay}>
                <Text style={[screen.ringSmallLabel, { color: colors.textMuted }]}>CONSUMED</Text>
                <Text style={[screen.ringBigNumber, { color: colors.text }]}>{Math.round(consumed).toLocaleString()}</Text>
                <Text style={[screen.ringSubLabel, { color: colors.textMuted }]}>of {goal.toLocaleString()} kcal</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Macro rings + bars */}
        <View style={screen.macroRow}>
          {(macros || DEFAULT_MACROS).map((m) => {
            const ringColor = getMacroRingColor(m.label);
            const trackColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
            const pct = Math.min(Math.max(Math.round(Number(m.pct) || 0), 0), 999);
            const pctFill = Math.min(Number(m.pct) || 0, 100);
            const val = Math.round(Number(m.val) || 0);
            const gGoal = Math.round(Number(m.goal) || 0);
            const labelColor = colors.textMuted;
            return (
              <View key={m.label} style={[screen.macroGradientBorder, ringShadow]}>
                <LinearGradient
                  colors={['#E91E63', '#FF6B9D', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <View
                  style={[
                    screen.macroCard,
                    { backgroundColor: solidCardBg, borderColor: colors.cardBorderSubtle },
                  ]}
                >
                  <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
                    <ArcProgress
                      size={100}
                      stroke={8}
                      progress={pctFill}
                      color={ringColor}
                      trackColor={trackColor}
                      isDark={isDark}
                    />
                    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={[screen.macroPct, { color: ringColor }]}>{pct}%</Text>
                    </View>
                  </View>
                  <Text style={[screen.macroLabel, { color: labelColor }]}>{m.label}</Text>
                  <Text style={[screen.macroGoal, { color: colors.text }]}>
                    {val} / {gGoal}g
                  </Text>
                  <View style={[screen.macroBarTrack, { backgroundColor: trackColor }]}>
                    <View style={[screen.macroBarFill, { width: `${pctFill}%`, backgroundColor: ringColor }]} />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        <WeeklyChart weekData={weekData ?? DEFAULT_WEEK} colors={colors} isDark={isDark} />

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

        <View style={{ height: 90 }} />
      </ScrollView>

      <TouchableOpacity onPress={() => handleOpenQuickAdd('snacks')} activeOpacity={0.85} style={screen.fabWrapper}>
        <LinearGradient colors={['#FF5D9E', '#FF834D']} style={screen.fab}>
          <Text style={screen.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const screen = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 12 },
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
  suggRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
  suggChip: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  suggText: { fontSize: 11, fontWeight: '600' },
  ringGradientBorder: {
    borderRadius: 24,
    padding: 2,
    overflow: 'hidden',
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
  macroGradientBorder: {
    flex: 1,
    borderRadius: 20,
    padding: 2,
    overflow: 'hidden',
  },
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
  macroLabel: { fontSize: 11, fontWeight: '700' },
  macroGoal: { fontSize: 11, fontWeight: '600' },
  macroBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 99,
    marginTop: 2,
    overflow: 'hidden',
  },
  macroBarFill: { height: '100%', borderRadius: 99 },
  fabWrapper: { position: 'absolute', bottom: 24, right: 20 },
  fab: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: 'white', fontSize: 30, fontWeight: '300', lineHeight: 34 },
});

export default NutritionScreen;

