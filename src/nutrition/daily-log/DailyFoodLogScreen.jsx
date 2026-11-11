// Nutrition Today: calorie ring, macros, meal cards, and weekly sparkline.
// Flow: pick a day → read consumed/macros/meals from props → scan/search/quick-add per meal.
// Rendered by DailyLogContent after goals exist; does not talk to Firestore itself.
// Redesigned with neobrutalist components: NbRing, gradient bars, NbButton, NbListRow, NbCard.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Polyline } from 'react-native-svg';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset, FORM_SCROLL_PROPS } from '../../navigation/bottomMenuSpacing';
import NbRing from '../../look-and-feel/NbRing';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbListRow from '../../look-and-feel/NbListRow';
import { lightColors, darkColors, nb, gradients } from '../../look-and-feel/colorPalette';

import DayPicker from './DayPicker';
import LoggedFoodRow from '../food-cards/LoggedFoodRow';
import { NUT_CALORIES_GRADIENT as THEME_CAL_GRAD, NUT_MACRO_GRADIENTS } from '../nutritionColors';

// ===== NAMED CONSTANTS =====

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
const DAYS_PER_WEEK = 7;
const DEFAULT_CALORIE_GOAL = 2200;
const SHELL_BOTTOM_INSET_EXTRA = 24;

const ACCENT = {
  hotPink: '#FF6B9D',
  orange: '#F97316',
  purple: '#C084FC',
  cyan: '#06B6D4',
  green: '#22C55E',
};

// ===== HELPER FUNCTIONS =====

/**
 * Meal card action button gradients (scan / search / quick-add).
 * @param {boolean} isDark
 * @returns {{ scanGradient: string[], searchGradient: string[], quickGradient: string[], label: string }}
 */
function getMealActionColors(isDark) {
  return {
    scanGradient: ['#C2410C', '#FF6B9D'],
    searchGradient: ['#C2410C', '#A855F7'],
    quickGradient: ['#CA8A04', '#F97316'],
    label: '#FFFFFF',
  };
}

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

const FALLBACK_DARK_COLORS = getColors(true);

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
  // vocab: NbRing renders the neobrutalist calorie ring with gradient stroke
  const progress = total > 0 ? Math.min(consumed / total, 1) : 0;
  const colors = isDark ? darkColors : lightColors;
  
  return (
    <NbRing
      progress={isEmpty ? 0 : progress}
      size={168}
      strokeWidth={14}
      value={Math.round(isEmpty ? 0 : consumed).toLocaleString()}
      label="kcal"
      style={{ marginVertical: 20 }}
    />
  );
};

// vocab: Macro gradient bar = horizontal progress bar with gradient fill and thick border
const MacroGradientBar = ({ label, current, target, gradientColors, isDark }) => {
  const colors = isDark ? darkColors : lightColors;
  const fillPercent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const trackColor = colors.nbSurfaceChip;
  
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13, color: colors.nbInk, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.nbMuted, fontVariant: ['tabular-nums'] }}>
          {Math.round(current)} / {Math.round(target)}g
        </Text>
      </View>
      <View style={{ height: 14, borderRadius: 8, backgroundColor: trackColor, overflow: 'hidden', borderWidth: nb.borderWidth, borderColor: colors.nbBorder }}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${fillPercent}%`, height: '100%' }}
        />
      </View>
    </View>
  );
};

// Percent text inside donut should follow theme (not macro colors)
const MacroPercentText = ({ children, style, color }) => (
  <Text style={[style, { color }]}>{children}</Text>
);

const getMealAccentColor = (mealName) => {
  const mealNameKey = (mealName || '').toLowerCase();
  if (mealNameKey.includes('breakfast')) return '#F97316';
  if (mealNameKey.includes('lunch')) return '#06B6D4';
  if (mealNameKey.includes('dinner')) return '#7C3AED';
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

const MealSection = ({ meal, goal, onScan, onLog, onQuickAdd, onRemoveLog, onEditLog, colors = FALLBACK_DARK_COLORS, isDark }) => {
  const mealS = useMemo(() => createMealS(colors), [colors]);
  const emptyStyles = useMemo(() => createEmptyStyles(colors), [colors]);
  const actionColors = useMemo(() => getMealActionColors(isDark), [isDark]);
  const foods = meal?.foods ?? [];
  const hasFood = foods.length > 0;
  const mealType = meal?.name ? meal.name.toLowerCase() : 'snacks';
  const emptyVisual = getMealEmptyVisual(meal?.name);
  const accent = getMealAccentColor(meal?.name);
  const mealLabel = meal?.name ?? 'meal';
  const mealTitleColor = isDark ? '#FFFFFF' : colors.text;
  const mealCalsColor = isDark ? 'rgba(255,255,255,0.65)' : colors.textMuted;
  const toDisplayAmount = (gramsOrMl, isMl) => {
    const amountNumber = Number(gramsOrMl) || 0;
    return (amountNumber * (isMl ? ML_TO_FL_OZ : G_TO_OZ)).toFixed(1) + ' oz';
  };
  const safeGoal = Number(goal) || 0;
  const mealCals = Number(meal?.cals) || 0;
  const innerShadow = cardShadowStyle(isDark);

  // vocab: NbButton components for scan/search/quick-add actions with neobrutalist style
  const actionRow = () => (
    <View style={mealS.btnRow}>
      <NbButton variant="brand" sm onPress={() => onScan(meal.name)} style={{ flex: 1 }}>
        Scan
      </NbButton>
      <NbButton variant="ink" sm onPress={() => onLog(meal.name)} style={{ flex: 1 }}>
        Search
      </NbButton>
      <NbButton variant="plain" sm onPress={() => onQuickAdd?.(mealType)} style={{ flex: 1.2 }}>
        Quick Add
      </NbButton>
    </View>
  );

  // vocab: NbCard wraps meal content with neobrutalist thick border and hard shadow
  return (
    <NbCard style={{ padding: 16, marginHorizontal: 16, marginBottom: 14 }}>
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
        <View style={{ marginTop: 8 }}>
          <View style={mealS.foodList}>
            {meal.foods.map((food) => (
              <NbListRow
                key={food.id || food.food_name}
                title={food.food_name || 'Unknown'}
                subtitle={`${toDisplayAmount(food.serving_grams ?? 0, (food.metadata?.servingUnit || '').toLowerCase() === 'ml') || '—'} • ${Math.round(food.calories || 0)} cal`}
                right={
                  <TouchableOpacity onPress={() => onRemoveLog?.(food)}>
                    <Ionicons name="close-circle-outline" size={22} color={isDark ? darkColors.nbMuted : lightColors.nbMuted} />
                  </TouchableOpacity>
                }
                onPress={() => onEditLog?.(food)}
                style={{ marginBottom: 6 }}
              />
            ))}
          </View>
          {actionRow()}
        </View>
      ) : (
        <View style={emptyStyles.container}>
          <View style={emptyStyles.lottieWrap}>
            <LottieView source={emptyVisual.lottie} autoPlay loop style={emptyStyles.lottie} />
          </View>
          <Text style={[emptyStyles.title, { color: colors.text }]}>Fuel Your Progress</Text>
          <Text style={emptyStyles.subtitle}>
            Your {mealLabel.toLowerCase()} is a blank canvas. Start tracking to see your macros in action.
          </Text>
          {actionRow()}
        </View>
      )}
    </NbCard>
  );
};

const createMealS = (colors) =>
  StyleSheet.create({
    foodList: {
      marginBottom: 8,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    titleBlock: { flex: 1 },
    accentBar: { width: 44, height: 4, borderRadius: 2, marginTop: 8 },
    mealName: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 18, letterSpacing: -0.2 },
    mealCals: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 2, fontVariant: ['tabular-nums'] },
    progressTrack: {
      height: 4,
      borderRadius: 99,
      marginBottom: 10,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', borderRadius: 99 },
    btnRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
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
      gap: 6,
      marginTop: 8,
      width: '100%',
      alignItems: 'stretch',
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
    },
    actionBtnWrap: {
      flex: 1,
      minWidth: 0,
      borderRadius: 22,
      overflow: 'hidden',
    },
    actionBtnWrapWide: {
      flex: 1.25,
    },
    actionBtn: {
      minHeight: 44,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
    actionText: {
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0,
      flexShrink: 1,
    },
  });

const WeeklyChart = ({ weekData, colors = FALLBACK_DARK_COLORS, isDark }) => {
  const days = weekData?.length ? weekData : DEFAULT_WEEK;
  const hasData = days.some((d) => Number(d?.cals) > 0);
  const weekAvg = days.reduce((sum, day) => sum + (Number(day?.cals) || 0), 0) / DAYS_PER_WEEK;
  const weekMax = hasData ? Math.max(...days.map((d) => Number(d?.cals) || 0), 1) : 1;
  const todayIndex = new Date().getDay();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartW = 320;
  const chartH = 56;
  const pad = 8;
  const pts = days.map((dayPoint, dayIndex) => {
    const cals = Number(dayPoint?.cals) || 0;
    const progressAlong = dayIndex / Math.max(days.length - 1, 1);
    const x = pad + progressAlong * (chartW - pad * 2);
    const y = chartH - pad - (hasData ? (cals / weekMax) * (chartH - pad * 2) : chartH / 2 - pad);
    return `${x},${y}`;
  });
  return (
    <NbCard style={{ padding: 16, marginHorizontal: 16, marginBottom: 12 }}>
      <View style={chart.header}>
        <View>
          <Text style={[chart.title, { fontFamily: 'SpaceGrotesk_700Bold', color: colors.text }]}>Weekly Momentum</Text>
          <Text style={[chart.sub, { fontFamily: 'Inter_500Medium', color: colors.textMuted }]}>
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
                    isToday && { fontFamily: 'SpaceGrotesk_700Bold', color: colors.text },
                  ]}
                >
                  {dayLabels[i].charAt(0)}
                </Text>
              </View>
              <Text
                style={[
                  chart.dayLabel,
                  { color: colors.textMuted },
                  isToday && { fontFamily: 'Inter_600SemiBold', color: colors.text },
                ]}
              >
                {dayLabels[i].substring(0, 3)}
              </Text>
            </View>
          );
        })}
      </View>
    </NbCard>
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

// ===== MAIN FUNCTION =====

/**
 * Presentational nutrition day view. Parent wires Firestore totals into these props.
 * @param {object} props
 */
export const DailyFoodLogScreen = ({
  consumed   = 0,
  goal       = DEFAULT_CALORIE_GOAL,
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
  reserveShellBottomNav = false,
}) => {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const scrollBottomPad = shellBottomPad;
  const handleOpenQuickAdd = (mealType) => onQuickAdd?.(mealType ?? 'snacks');
  const ringShadow = cardShadowStyle(isDark);
  const solidCardBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const isEmpty = consumed <= 0;
  const remainingKcal = Math.max(Math.round(goal - consumed), 0);

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.screenBg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[screen.scroll, { flexGrow: 1, paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >

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
          <DayPicker
            selectedDate={viewDate}
            onSelectDate={onSelectViewDate}
            isDark={isDark}
            datesWithLogs={datesWithLogs}
          />
        ) : null}

        {/* Calorie ring — center hero with NbRing */}
        <NbCard style={{ alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 12, marginBottom: 12 }}>
          <Text style={{ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.1, color: colors.textMuted, marginBottom: 8 }}>
            {isEmpty ? 'Start logging' : 'Today'}
          </Text>
          <CalorieRing consumed={consumed} total={goal} isDark={isDark} isEmpty={isEmpty} />
          <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 13, color: colors.textMuted, marginTop: 8 }}>
            {isEmpty
              ? `${remainingKcal.toLocaleString()} of ${goal.toLocaleString()} remaining`
              : `${Math.round(consumed).toLocaleString()} of ${goal.toLocaleString()} kcal`}
          </Text>
        </NbCard>

        {/* Macro gradient bars - neobrutalist style with thick borders */}
        <NbCard style={{ padding: 16, marginHorizontal: 16, marginBottom: 12 }}>
          {(macros || DEFAULT_MACROS).map((m, macroIndex) => {
            const val = Math.round(Number(m.val) || 0);
            const gGoal = Math.round(Number(m.goal) || 0);
            const macroKey = String(m.label || '').toLowerCase();
            const gradColors = NUT_MACRO_GRADIENTS_LOCAL[macroKey] ?? NUT_CALORIES_GRADIENT;
            return (
              <MacroGradientBar
                key={m.label}
                label={m.label}
                current={val}
                target={gGoal}
                gradientColors={gradColors}
                isDark={isDark}
              />
            );
          })}
        </NbCard>

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

        <View style={{ height: SHELL_BOTTOM_INSET_EXTRA }} />
      </ScrollView>
    </View>
  );
};

export default DailyFoodLogScreen;

