

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
} from 'react-native-svg';
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
        cardBg: 'rgba(255,255,255,0.05)',
        cardBorder: 'rgba(255,255,255,0.09)',
        cardBorderSubtle: 'rgba(255,255,255,0.07)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.5)',
        textVeryMuted: 'rgba(255,255,255,0.35)',
        inputBg: 'rgba(255,255,255,0.06)',
        divider: 'rgba(255,255,255,0.05)',
        screenBg: '#0A0A0F',
      }
    : {
        ...ACCENT,
        cardBg: 'rgba(0,0,0,0.04)',
        cardBorder: 'rgba(0,0,0,0.08)',
        cardBorderSubtle: 'rgba(0,0,0,0.06)',
        text: '#1a0a2e',
        textMuted: 'rgba(26,10,46,0.6)',
        textVeryMuted: 'rgba(26,10,46,0.4)',
        inputBg: 'rgba(0,0,0,0.05)',
        divider: 'rgba(0,0,0,0.06)',
        screenBg: '#F5F3FF',
      };
}

const C = getColors(true);

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

const CalorieRing = ({ consumed, total }) => {
  const size = 200;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = Math.PI * 2 * r;
  const progress = total > 0 ? Math.min(consumed / total, 1) : 0;
  const offset = circumference - progress * circumference;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Defs>
        <SvgGradient id="calorieGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FF6B9D" />
          <Stop offset="50%" stopColor="#F97316" />
          <Stop offset="100%" stopColor="#C084FC" />
        </SvgGradient>
      </Defs>
      <Circle cx={size/2} cy={size/2} r={r} stroke="white" strokeWidth={stroke} fill="none" strokeOpacity={0.06} />
      <Circle cx={size/2} cy={size/2} r={r} stroke="url(#calorieGrad)" strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </Svg>
  );
};

const ArcProgress = ({ size, stroke, progress, color }) => {
  const r = (size - stroke) / 2;
  const circumference = Math.PI * 2 * r;
  const offset = circumference - (progress / 100) * circumference;
  return (
    <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none" opacity={0.1} />
      <Circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
    </Svg>
  );
};

const WaterDrop = ({ filled }) => (
  <Svg width={22} height={28} viewBox="0 0 28 36" fill="none">
    <Defs>
      <SvgGradient id="dropFill" x1="2" y1="2" x2="26" y2="34" gradientUnits="userSpaceOnUse">
        <Stop stopColor="#06B6D4" />
        <Stop offset="1" stopColor="#C084FC" />
      </SvgGradient>
    </Defs>
    <Path
      d="M14 2C14 2 2 16 2 22C2 28.6274 7.37258 34 14 34C20.6274 34 26 28.6274 26 22C26 16 14 2 14 2Z"
      fill={filled ? 'url(#dropFill)' : 'none'}
      stroke={filled ? 'none' : 'white'}
      strokeWidth="1.5"
      opacity={filled ? 0.7 : 0.15}
    />
  </Svg>
);

const FoodItemRow = ({ name, cals, amount, p, c, f, fiber, sugar, sodium, potassium, logId, log, onRemove, onEdit, colors = C }) => {
  const hasSodium = Number(sodium) > 0;
  const hasFiber = Number(fiber) > 0;
  const hasSugar = Number(sugar) > 0;
  const hasPotassium = Number(potassium) > 0;
  const hasSecondary = hasFiber || hasSugar || hasSodium || hasPotassium;
  const toOz = (g) => (Number(g) || 0) * G_TO_OZ;
  const secondaryParts = [];
  if (hasFiber) secondaryParts.push(`Fiber ${(toOz(fiber)).toFixed(1)} oz`);
  if (hasSugar) secondaryParts.push(`Sugar ${(toOz(sugar)).toFixed(1)} oz`);
  if (hasSodium) secondaryParts.push(`Sodium ${Math.round(Number(sodium) || 0)}mg`);
  if (hasPotassium) secondaryParts.push(`Potassium ${Math.round(Number(potassium) || 0)}mg`);
  return (
    <View style={[foodRow.container, { borderBottomColor: colors.divider }]}>
      <View style={[foodRow.iconBox, { backgroundColor: colors.inputBg }]}><Text style={{ fontSize: 14 }}>🍽️</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={[foodRow.name, { color: colors.text }]}>{name}</Text>
        <Text style={[foodRow.amount, { color: colors.textMuted }]}>{amount}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
        <Text style={[foodRow.cals, { color: colors.textMuted }]}>{Math.round(Number(cals) || 0)} cal</Text>
        <Text style={[foodRow.macros, { color: colors.textVeryMuted }]}>
          P {(toOz(p)).toFixed(1)} oz  C {(toOz(c)).toFixed(1)} oz  F {(toOz(f)).toFixed(1)} oz
        </Text>
        {hasSecondary ? (
          <Text style={[foodRow.secondary, { color: colors.textVeryMuted }]}>
            {secondaryParts.join('  ')}
          </Text>
        ) : null}
      </View>
      {onEdit && log ? (
        <TouchableOpacity onPress={() => onEdit(log)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={foodRow.editBtn}>
          <Ionicons name="pencil-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
      {onRemove && logId ? (
        <TouchableOpacity onPress={() => onRemove(logId)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={foodRow.removeBtn}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const foodRow = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  amount: { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 },
  cals: { color: 'rgba(255,255,255,0.45)', fontSize: 12 },
  macros: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 4 },
  secondary: { color: 'rgba(255,255,255,0.25)', fontSize: 10, marginTop: 3 },
  editBtn: { padding: 8, marginRight: -4 },
  removeBtn: { padding: 8, marginRight: -8 },
});

const MealSection = ({ meal, goal, onScan, onLog, onQuickAdd, onRemoveLog, onEditLog, colors = C }) => {
  const mealS = useMemo(() => createMealS(colors), [colors]);
  const emptyStyles = useMemo(() => createEmptyStyles(colors), [colors]);
  const hasFood = meal.foods && meal.foods.length > 0;
  const mealType = meal.name ? meal.name.toLowerCase() : 'snacks';
  const emptyVisual = getMealEmptyVisual(meal.name);
  const toDisplayAmount = (gramsOrMl, isMl) => {
    const n = Number(gramsOrMl) || 0;
    return (n * (isMl ? ML_TO_FL_OZ : G_TO_OZ)).toFixed(1) + ' oz';
  };
  return (
    <View style={[mealS.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={mealS.header}>
        <Text style={[mealS.mealName, { color: colors.text }]}>{meal.name}</Text>
        <Text style={[mealS.mealCals, { color: colors.textMuted }]}>{meal.cals > 0 ? `${meal.cals} cal` : '—'}</Text>
      </View>
      {hasFood && goal > 0 && (
        <View style={[mealS.progressTrack, { backgroundColor: colors.cardBorderSubtle }]}>
          <LinearGradient colors={[colors.hotPink, colors.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[mealS.progressFill, { width: `${Math.min((meal.cals / goal) * 100, 100)}%` }]} />
        </View>
      )}
      {hasFood ? (
        <>
          <View style={{ marginBottom: 10 }}>
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
          <View style={mealS.btnRow}>
            <TouchableOpacity
              onPress={() => onScan(meal.name)}
              activeOpacity={0.8}
              style={[mealS.scanBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
            >
              <Text style={[mealS.scanBtnText, { color: colors.textMuted }]}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onLog(meal.name)}
              activeOpacity={0.85}
              style={mealS.logBtnWrap}
            >
              <LinearGradient
                colors={[colors.hotPink, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={mealS.logBtn}
              >
                <Text style={mealS.logBtnText}>Search</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onQuickAdd && onQuickAdd(mealType)}
              activeOpacity={0.85}
              style={[mealS.quickAddBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
            >
              <Text style={[mealS.quickAddBtnText, { color: colors.textMuted }]}>Quick Add</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={emptyStyles.container}>
          <View style={emptyStyles.lottieWrap}>
            <LottieView
              source={emptyVisual.lottie}
              autoPlay
              loop
              style={emptyStyles.lottie}
            />
          </View>
          <Text style={emptyStyles.title}>Nothing logged yet</Text>
          <Text style={emptyStyles.subtitle}>
            Track your {meal.name ? meal.name.toLowerCase() : 'meal'} to hit your goals
          </Text>
          <View style={emptyStyles.buttonRow}>
            <TouchableOpacity
              style={emptyStyles.scanBtn}
              onPress={() => onScan(meal.name)}
              activeOpacity={0.8}
            >
              <Ionicons name="scan-outline" size={15} color={colors.textMuted} />
              <Text style={emptyStyles.scanText}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={emptyStyles.searchBtn}
              onPress={() => onLog(meal.name)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[colors.hotPink, colors.purple]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={emptyStyles.searchGradient}
              >
                <Ionicons name="search-outline" size={15} color="#FFFFFF" />
                <Text style={emptyStyles.searchText}>Search Food</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={emptyStyles.quickBtn}
              onPress={() => onQuickAdd && onQuickAdd(mealType)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-outline" size={15} color={colors.textMuted} />
              <Text style={emptyStyles.quickText}>Quick Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const createMealS = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderRadius: 24,
      padding: 16,
      marginBottom: 12,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    mealName: { color: colors.text, fontSize: 14, fontWeight: '700' },
    mealCals: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    progressTrack: {
      height: 4,
      borderRadius: 99,
      marginBottom: 12,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 99 },
    emptyState: { alignItems: 'center', paddingVertical: 20, marginBottom: 8 },
    emptyIconBox: {
      width: 52,
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
      backgroundColor: colors.inputBg,
    },
    emptyText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
    emptySub: { color: colors.textVeryMuted, fontSize: 12, marginTop: 4 },
    btnRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    scanBtn: {
      flex: 1,
      minWidth: 70,
      paddingVertical: 12,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.inputBg,
      alignItems: 'center',
    },
    scanBtnText: { color: colors.textVeryMuted, fontSize: 12, fontWeight: '500' },
    logBtnWrap: { flex: 1, minWidth: 70 },
    logBtn: { borderRadius: 50, paddingVertical: 12, alignItems: 'center' },
    logBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
    quickAddBtn: {
      flex: 1,
      minWidth: 70,
      paddingVertical: 12,
      borderRadius: 50,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.inputBg,
      alignItems: 'center',
    },
    quickAddBtnText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  });

const createEmptyStyles = (colors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: 24,
      paddingHorizontal: 16,
      gap: 8,
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
    title: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
    subtitle: {
      fontSize: 12,
      color: colors.textVeryMuted,
      textAlign: 'center',
      lineHeight: 18,
    },
    buttonRow: { flexDirection: 'row', gap: 8, marginTop: 8, width: '100%' },
    scanBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    scanText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
    searchBtn: { flex: 1.4, borderRadius: 12, overflow: 'hidden' },
    searchGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
    },
    searchText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
    quickBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    quickText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  });

const WeeklyChart = ({ weekData, colors = C }) => {
  const hasData = weekData.some(d => d.cals > 0);
  const weekMax = hasData ? Math.max(...weekData.map(d => d.cals), 1) : 1;
  const weekAvg = weekData.reduce((s, d) => s + d.cals, 0) / 7;
  const todayIndex = new Date().getDay();
  const dayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const barStubColor = colors.textVeryMuted;
  return (
    <View style={[chart.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
      <View style={chart.header}>
        <Text style={[chart.title, { color: colors.text }]}>This Week</Text>
        <Text style={[chart.avg, { color: colors.textMuted }]}>{hasData ? `Avg ${Math.round(weekAvg).toLocaleString()} cal` : 'No data yet'}</Text>
      </View>
      <View style={chart.barsRow}>
        {weekData.map((d, i) => {
          const isToday = i === todayIndex;
          const hasValue = hasData && d.cals > 0;
          const barH = hasValue ? `${Math.max((d.cals / weekMax) * 100, 8)}%` : '20%';
          return (
            <View key={d.day} style={chart.barCol}>
              <View style={chart.barTrack}>
                <View style={[chart.bar, { height: barH }]}>
                  {isToday && hasValue ? (
                    <LinearGradient colors={[C.hotPink, C.purple]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View
                      style={[
                        StyleSheet.absoluteFill,
                        { backgroundColor: hasValue ? colors.cardBorderSubtle : barStubColor },
                      ]}
                    />
                  )}
                </View>
              </View>
              <Text style={[chart.dayLabel, { color: colors.textMuted }, isToday && { color: colors.text, fontWeight: '700' }]}>
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
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: C.text, fontSize: 14, fontWeight: '700' },
  avg: { color: C.textMuted, fontSize: 12 },
  barsRow: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 8, overflow: 'hidden', minHeight: 4 },
  dayLabel: { color: C.textMuted, fontSize: 10 },
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
  burned     = 0,
  macros     = DEFAULT_MACROS,
  meals      = DEFAULT_MEALS,
  weekData   = DEFAULT_WEEK,
  waterCount = 0,
  onScan     = () => {},
  onLog      = () => {},
  onManualSave = () => {},
  onRemoveLog,
  onEditLog,
  onAddWater = () => {},
  onSetWater,
  onSearch   = () => {},
  onOpenSettings,
  onQuickAdd = () => {},
}) => {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const remaining = goal - consumed + burned;
  const handleOpenQuickAdd = (mealType) => onQuickAdd?.(mealType ?? 'snacks');

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={screen.scroll} showsVerticalScrollIndicator={false}>

        {/* Search Bar + Settings */}
        <View style={screen.searchRow}>
          <TouchableOpacity onPress={onSearch} activeOpacity={0.8} style={[screen.searchCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={[screen.searchInner, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="search-outline" size={18} color={colors.textMuted} />
              <Text style={[screen.searchPlaceholder, { color: colors.textMuted }]}>Search foods, brands, restaurants...</Text>
              <Ionicons name="barcode-outline" size={20} color={colors.textMuted} />
            </View>
            <View style={screen.suggRow}>
              {['McDonalds', 'Chicken Breast', 'Chipotle'].map(t => (
                <View key={t} style={[screen.suggChip, { borderColor: colors.cardBorder }]}><Text style={[screen.suggText, { color: colors.textMuted }]}>{t}</Text></View>
              ))}
            </View>
          </TouchableOpacity>
          {onOpenSettings ? (
            <TouchableOpacity onPress={onOpenSettings} style={[screen.settingsIconBtn, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]} activeOpacity={0.8}>
              <Ionicons name="settings-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Calorie Ring */}
        <View style={[screen.ringCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={screen.ringSide}>
            <Ionicons name="flame-outline" size={22} color={C.orange} />
            <Text style={[screen.ringSideLabel, { color: colors.textMuted }]}>Burned</Text>
            <Text style={[screen.ringSideValue, { color: C.orange }]}>{burned}</Text>
          </View>
          <View style={screen.ringCenter}>
            <CalorieRing consumed={consumed} total={goal} />
            <View style={screen.ringTextOverlay}>
              {consumed > 0 ? (
                <>
                  <Text style={[screen.ringSmallLabel, { color: colors.textMuted }]}>calories consumed</Text>
                  <Text style={[screen.ringBigNumber, { color: colors.text }]}>{consumed.toLocaleString()}</Text>
                  <Text style={[screen.ringSubLabel, { color: colors.textMuted }]}>of {goal.toLocaleString()} cal</Text>
                </>
              ) : (
                <>
                  <Text style={[screen.ringSmallLabel, { color: colors.textMuted }]}>daily goal</Text>
                  <Text style={[screen.ringBigNumber, { color: colors.text }]}>{goal.toLocaleString()}</Text>
                  <Text style={[screen.ringSubLabel, { color: colors.textMuted }]}>calories remaining</Text>
                </>
              )}
            </View>
          </View>
          <View style={screen.ringSide}>
            <Ionicons name="radio-button-on-outline" size={22} color={C.green} />
            <Text style={[screen.ringSideLabel, { color: colors.textMuted }]}>Left</Text>
            <Text style={[screen.ringSideValue, { color: C.green }]}>{remaining}</Text>
          </View>
        </View>

        {/* Macro Rings */}
        <View style={screen.macroRow}>
          {macros.map(m => (
            <View
              key={m.label}
              style={[
                screen.macroCard,
                { backgroundColor: colors.cardBg, borderColor: colors.cardBorderSubtle, borderLeftWidth: 3, borderLeftColor: m.color },
              ]}
            >
              <View style={{ position: 'relative', width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}>
                <ArcProgress size={64} stroke={6} progress={m.pct} color={m.color} />
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={[screen.macroVal, { color: colors.text }]}>{(m.val * G_TO_OZ).toFixed(1)}<Text style={[screen.macroUnit, { color: colors.textMuted }]}> oz</Text></Text>
                </View>
              </View>
              <Text style={[screen.macroLabel, { color: colors.text }]}>{m.label}</Text>
              <Text style={[screen.macroGoal, { color: colors.textMuted }]}>{(m.goal * G_TO_OZ).toFixed(1)} oz goal</Text>
            </View>
          ))}
        </View>

        {/* Weekly Chart */}
        <WeeklyChart weekData={weekData} colors={colors} />

        {/* Meal Cards */}
        {meals.map(meal => (
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
          />
        ))}

        {/* Water */}
        <View style={[screen.waterCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
          <View style={screen.waterHeader}>
            <View>
              <Text style={[screen.waterTitle, { color: colors.text }]}>Water Intake</Text>
              <Text style={[screen.waterSub, { color: colors.textMuted }]}>{waterCount} of 8 cups</Text>
            </View>
            <TouchableOpacity onPress={onAddWater} activeOpacity={0.85}>
              <LinearGradient colors={[C.cyan, C.purple]} style={screen.waterAddBtn}>
                <Text style={{ color: 'white', fontSize: 22, fontWeight: '300', lineHeight: 28 }}>+</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          <View style={screen.waterDropRow}>
            {Array.from({ length: 8 }).map((_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => onSetWater?.(i + 1)}
                activeOpacity={0.7}
                style={screen.waterDropTouch}
              >
                <WaterDrop filled={i < waterCount} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* FAB — opens full-page Quick Add */}
      <TouchableOpacity onPress={() => handleOpenQuickAdd('snacks')} activeOpacity={0.85} style={screen.fabWrapper}>
        <LinearGradient colors={[C.hotPink, C.orange, C.purple]} style={screen.fab}>
          <Text style={screen.fabText}>+</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const screen = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  searchRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  searchCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
  },
  settingsIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchPlaceholder: { flex: 1, color: C.textMuted, fontSize: 13 },
  suggRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  suggChip: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4 },
  suggText: { color: C.textMuted, fontSize: 11, fontWeight: '500' },
  ringCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ringSide: { alignItems: 'center', gap: 4, width: 60 },
  ringSideLabel: { color: C.textMuted, fontSize: 11 },
  ringSideValue: { fontSize: 18, fontWeight: '800' },
  ringCenter: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  ringTextOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringSmallLabel: { color: C.textMuted, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  ringBigNumber: { color: C.text, fontSize: 36, fontWeight: '900', lineHeight: 42 },
  ringSubLabel: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  macroRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  macroCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  macroVal: { fontSize: 13, fontWeight: '800' },
  macroUnit: { fontSize: 10, fontWeight: '400', color: C.textMuted },
  macroLabel: { color: C.text, fontSize: 12, fontWeight: '600' },
  macroGoal: { color: C.textMuted, fontSize: 10 },
  waterCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
  },
  waterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  waterTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  waterSub: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  waterAddBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waterDropRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 },
  waterDropTouch: { padding: 4 },
  fabWrapper: { position: 'absolute', bottom: 24, right: 20 },
  fab: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  fabText: { color: 'white', fontSize: 28, fontWeight: '300', lineHeight: 32 },
});

export default NutritionScreen;

