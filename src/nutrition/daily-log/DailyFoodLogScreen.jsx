// Design Law Nutrition daily log (PNG 01–04 light/dark).
// Flow: date header → week strip → ring+macros card → steps → quick picks → meal cards.
// DailyLogContent loads goals/logs then renders this screen. Meal keys: breakfast/lunch/dinner/snacks.
// Read order: layout JSX (no hooks) → exported screen (hooks + numbers) → styles → PLUMBING.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset, useShellTopPad, FORM_SCROLL_PROPS } from '../../navigation/bottomMenuSpacing';
import NbRing from '../../look-and-feel/NbRing';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import DayPicker from './DayPicker';
import MealCard from './MealCard';

// ===== NAMED CONSTANTS =====

const DEFAULT_CALORIE_GOAL = 2200;
// Manipulate here: extra scroll clearance above the tab bar (nav height already counted in the inset hook)
const SHELL_BOTTOM_INSET_EXTRA = 40;
const DEFAULT_STEP_GOAL = 10000;
const RING_SIZE = 118;
const RING_STROKE_WIDTH = 14;
// Manipulate here: space between stacked HardShadow cards (Design Law block gap = 16; 20 reads less cramped)
const BLOCK_GAP = 20;
// Manipulate here: air above QUICK PICKS / MEALS labels (Design Law dense-page section gap 24–28)
const SECTION_GAP_TOP = 24;
const MAX_QUICK_PICKS_FROM_HISTORY = 6;
const MIN_HISTORY_QUICK_PICKS = 2;
// Manipulate here: extra pad when the screen is not reserving the shell bottom nav
const EXTRA_PAD_WITHOUT_SHELL_NAV = 24;
const FALLBACK_SCROLL_BOTTOM_PAD = SHELL_BOTTOM_INSET_EXTRA + EXTRA_PAD_WITHOUT_SHELL_NAV;
const DEFAULT_MEALS = [{
  name: 'Breakfast',
  cals: 0,
  foods: []
}, {
  name: 'Lunch',
  cals: 0,
  foods: []
}, {
  name: 'Dinner',
  cals: 0,
  foods: []
}, {
  name: 'Snacks',
  cals: 0,
  foods: []
}];
const DEFAULT_MACROS = [{
  label: 'Protein',
  val: 0,
  goal: 150
}, {
  label: 'Carbs',
  val: 0,
  goal: 250
}, {
  label: 'Fat',
  val: 0,
  goal: 70
}];

// Manipulate here: fallback quick-pick labels when the user has no frequent foods yet
const DEFAULT_QUICK_PICKS = ['Greek Yogurt', 'Salmon', 'Chicken Breast', 'Oatmeal', 'Avocado'];
const SETTINGS_ICON = require('../../assets/icons/handoff/settings.png');
const STEPS_ICON = require('../../assets/icons/handoff/checkin.png');
const PROTEIN_ICON = require('../../assets/icons/handoff/protein.png');
const CARBS_ICON = require('../../assets/icons/handoff/carbs.png');
const FATS_ICON = require('../../assets/icons/handoff/fats.png');

// Design Law macro bar fills (PNG) — never green
const MACRO_BAR_COLORS = {
  protein: ['#60A5FA', '#818CF8'],
  carbs: ['#FDA4AF', '#FB923C'],
  fat: ['#FB7185', '#EF4444']
};

// ===== HELPER FUNCTIONS =====
// Layout subcomponents (no hooks). Date / macro helpers live under PLUMBING.

// ===== MAIN FUNCTION =====
// Layout pieces first; exported DailyFoodLogScreen (hooks) follows after them.

/**
 * PNG calorie equation row under the ring + macros.
 */
function CalorieMathRow({
  goal,
  food,
  exercise,
  left,
  colors
}) {
  const mutedStyle = [styles.mathText, {
    color: colors.nbMuted
  }];
  const numberStyle = [styles.mathNum, {
    color: colors.nbInk
  }];
  return <View style={styles.mathRow}>
      <Text style={mutedStyle}>
        <Text style={numberStyle}>{goal.toLocaleString()}</Text>
        {' GOAL − '}
        <Text style={numberStyle}>{food.toLocaleString()}</Text>
        {' FOOD + '}
        <Text style={numberStyle}>{exercise.toLocaleString()}</Text>
        {' EXERCISE = '}
        <Text style={numberStyle}>{left.toLocaleString()}</Text>
        {' LEFT'}
      </Text>
    </View>;
}
function MacroLaneRow({
  macroLane,
  laneIndex,
  colors
}) {
  const gramsEaten = Math.round(Number(macroLane.val) || 0);
  const gramsGoal = Math.round(Number(macroLane.goal) || 0);
  let fillRatio = 0;
  if (gramsGoal > 0) {
    fillRatio = Math.min(1, gramsEaten / gramsGoal);
  }
  const barColors = macroBarColorsForLabel(macroLane.label);
  const macroIcon = macroIconForLabel(macroLane.label);
  return <View style={styles.macroLane}>
      <View style={styles.macroLabelRow}>
        <Image source={macroIcon} style={styles.macroTinyIcon} resizeMode="contain" />
        <Text style={[styles.macroLabel, {
        color: colors.nbInk
      }]}>{macroLane.label}</Text>
        <Text style={[styles.macroValue, {
        color: colors.nbMuted
      }]}>
          {gramsEaten} / {gramsGoal} g
        </Text>
      </View>
      <NbProgressBar progress={fillRatio} colors={barColors} index={laneIndex} />
    </View>;
}
function NutritionHeader({
  colors,
  viewDate,
  onOpenWeeklyMomentum,
  onOpenSettings
}) {
  const dateSubtitle = formatDateSubtitle(viewDate);
  const canOpenWeeklyMomentum = typeof onOpenWeeklyMomentum === 'function';
  const canOpenSettings = Boolean(onOpenSettings);
  let weeklyMomentumLink = null;
  if (canOpenWeeklyMomentum) {
    weeklyMomentumLink = <TouchableOpacity onPress={onOpenWeeklyMomentum} hitSlop={8} style={{
      marginTop: 4
    }}>
        <Text style={{
        fontSize: 13,
        fontWeight: '800',
        color: colors.nbInk,
        textDecorationLine: 'underline'
      }}>
          Weekly Momentum
        </Text>
      </TouchableOpacity>;
  }
  let settingsButton = null;
  if (canOpenSettings) {
    settingsButton = <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
        <TouchableOpacity onPress={onOpenSettings} accessibilityLabel="Nutrition settings" style={[styles.settingsBtn, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSurface
      }]} activeOpacity={0.88}>
          <NbIconChip source={SETTINGS_ICON} size={40} index={3} />
        </TouchableOpacity>
      </HardShadow>;
  }
  return <View style={styles.headerRow}>
      <View style={{
      flex: 1,
      minWidth: 0
    }}>
        <Text style={[styles.dateSub, {
        color: colors.nbMuted
      }]}>{dateSubtitle}</Text>
        <Text style={[styles.title, {
        color: colors.nbInk
      }]}>Nutrition</Text>
        {weeklyMomentumLink}
      </View>
      {settingsButton}
    </View>;
}
function CalorieSummaryCard({
  colors,
  ringProgress,
  leftKcal,
  macros,
  safeGoal,
  foodKcal,
  exerciseKcal
}) {
  const macroLanes = macros || DEFAULT_MACROS;
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
      <View style={[styles.summaryCard, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        <View style={styles.summaryTop}>
          <NbRing progress={ringProgress} size={RING_SIZE} strokeWidth={RING_STROKE_WIDTH} variant="ink" value={leftKcal.toLocaleString()} label="kcal left" />
          <View style={styles.macroCol}>
            {macroLanes.map((macroLane, laneIndex) => <MacroLaneRow key={macroLane.label || laneIndex} macroLane={macroLane} laneIndex={laneIndex} colors={colors} />)}
          </View>
        </View>
        <View style={[styles.mathDivider, {
        backgroundColor: colors.nbBorder
      }]} />
        <CalorieMathRow goal={safeGoal} food={foodKcal} exercise={exerciseKcal} left={leftKcal} colors={colors} />
      </View>
    </HardShadow>;
}
function StepsCard({
  colors,
  hasSteps,
  steps,
  stepProgress,
  onConnectSteps
}) {
  const canConnectSteps = typeof onConnectSteps === 'function';
  let stepsBody;
  if (hasSteps) {
    stepsBody = <View style={{
      flex: 1,
      minWidth: 0,
      gap: 8
    }}>
        <Text style={[styles.stepsTitle, {
        color: colors.nbInk
      }]}>
          {Number(steps).toLocaleString()} steps
        </Text>
        <NbProgressBar progress={stepProgress} colors={accentGradients[1]} index={1} />
      </View>;
  } else {
    let connectButton = null;
    if (canConnectSteps) {
      connectButton = <NbButton variant="plain" sm onPress={onConnectSteps}>
          Connect
        </NbButton>;
    }
    stepsBody = <View style={{
      flex: 1,
      minWidth: 0,
      gap: 8
    }}>
        <Text style={[styles.stepsHint, {
        color: colors.nbMuted
      }]}>
          Connect to track your steps. Steps add to your calories left.
        </Text>
        {connectButton}
      </View>;
  }
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
      <View style={[styles.stepsCard, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        <NbIconChip source={STEPS_ICON} size={40} index={1} />
        {stepsBody}
      </View>
    </HardShadow>;
}
function DailyFactsRow({
  colors,
  onOpenDailyFacts
}) {
  const canOpenDailyFacts = typeof onOpenDailyFacts === 'function';
  if (!canOpenDailyFacts) return null;
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
      <TouchableOpacity onPress={onOpenDailyFacts} activeOpacity={0.88} accessibilityLabel="Open nutrition facts" style={[styles.dailyFactsBtn, {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface
    }]}>
        <Ionicons name="nutrition-outline" size={20} color={colors.nbInk} />
        <Text style={[styles.dailyFactsBtnText, {
        color: colors.nbInk
      }]}>Nutrition facts</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
      </TouchableOpacity>
    </HardShadow>;
}
function QuickPicksRow({
  colors,
  quickPicks,
  onPillSearch
}) {
  return <>
      <Text style={[styles.sectionLabel, {
      color: colors.nbMuted
    }]}>QUICK PICKS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow} style={{
      marginBottom: BLOCK_GAP
    }}>
        {quickPicks.map(foodName => <HardShadow key={foodName} offset={nb.shadowOffsetSmall} radius={999} style={{
        marginRight: 8
      }}>
            <TouchableOpacity onPress={() => onPillSearch?.(foodName)} style={[styles.quickPill, {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface
        }]} activeOpacity={0.88}>
              <Ionicons name="add" size={16} color={colors.nbInk} />
              <Text style={[styles.quickPillText, {
            color: colors.nbInk
          }]} numberOfLines={1}>
                {foodName}
              </Text>
            </TouchableOpacity>
          </HardShadow>)}
      </ScrollView>
    </>;
}
function MealsSection({
  colors,
  meals,
  onLog,
  onRemoveLog,
  onEditLog,
  onScan
}) {
  const mealList = meals || DEFAULT_MEALS;
  return <>
      <Text style={[styles.sectionLabel, {
      color: colors.nbMuted
    }]}>MEALS</Text>
      {mealList.map(meal => {
      const mealKey = mealKeyFromName(meal.name);
      const mealItems = meal.foods || [];
      return <MealCard key={meal.name} mealType={meal.name} mealKey={mealKey} items={mealItems} onAddPress={pressedMealKey => onLog(pressedMealKey)} onDeleteItem={item => onRemoveLog?.(item?.id || item)} onEditItem={onEditLog} onAddScanner={pressedMealKey => onScan(pressedMealKey)} />;
    })}
    </>;
}

// ===== LAYOUT (no hooks — pure Design Law chrome) =====

function DailyFoodLogLayout({
  colors,
  isDark,
  shellTopPad,
  scrollBottomPad,
  viewDate,
  onOpenWeeklyMomentum,
  onOpenSettings,
  onSelectViewDate,
  datesWithLogs,
  ringProgress,
  leftKcal,
  macros,
  safeGoal,
  foodKcal,
  exerciseKcal,
  hasSteps,
  steps,
  stepProgress,
  onConnectSteps,
  onOpenDailyFacts,
  quickPicks,
  onPillSearch,
  meals,
  onLog,
  onRemoveLog,
  onEditLog,
  onScan
}) {
  const canPickDay = Boolean(onSelectViewDate);
  const screenBackground = {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.nbBackground
  };
  const scrollContentStyle = [styles.scroll, {
    paddingTop: shellTopPad,
    paddingBottom: scrollBottomPad
  }];
  let dayPicker = null;
  if (canPickDay) {
    dayPicker = <DayPicker selectedDate={viewDate} onSelectDate={onSelectViewDate} isDark={isDark} datesWithLogs={datesWithLogs} />;
  }
  return <View style={screenBackground}>
      <ScrollView style={{
      flex: 1
    }} contentContainerStyle={scrollContentStyle} {...FORM_SCROLL_PROPS}>
        <NutritionHeader colors={colors} viewDate={viewDate} onOpenWeeklyMomentum={onOpenWeeklyMomentum} onOpenSettings={onOpenSettings} />
        {dayPicker}
        <CalorieSummaryCard colors={colors} ringProgress={ringProgress} leftKcal={leftKcal} macros={macros} safeGoal={safeGoal} foodKcal={foodKcal} exerciseKcal={exerciseKcal} />
        <StepsCard colors={colors} hasSteps={hasSteps} steps={steps} stepProgress={stepProgress} onConnectSteps={onConnectSteps} />
        <DailyFactsRow colors={colors} onOpenDailyFacts={onOpenDailyFacts} />
        <QuickPicksRow colors={colors} quickPicks={quickPicks} onPillSearch={onPillSearch} />
        <MealsSection colors={colors} meals={meals} onLog={onLog} onRemoveLog={onRemoveLog} onEditLog={onEditLog} onScan={onScan} />
      </ScrollView>
    </View>;
}

// ===== MAIN EXPORT (hooks + derived numbers) =====

export const DailyFoodLogScreen = ({
  consumed = 0,
  goal = DEFAULT_CALORIE_GOAL,
  burned = 0,
  macros = DEFAULT_MACROS,
  meals = DEFAULT_MEALS,
  onScan = () => {},
  onLog = () => {},
  onRemoveLog,
  onEditLog,
  onPillSearch,
  onOpenSettings,
  // vocab: onOpenDailyFacts = opens NutritionFactsScreen (full-day totals, not ConfirmFoodPopup)
  onOpenDailyFacts,
  // Design Law Weekly Momentum (missing-screens 11/12)
  onOpenWeeklyMomentum,
  onQuickAdd = () => {},
  viewDate,
  onSelectViewDate,
  datesWithLogs = [],
  topFoodNames = [],
  steps = null,
  stepGoal = DEFAULT_STEP_GOAL,
  onConnectSteps,
  reserveShellBottomNav = false
}) => {
  // Hook order frozen — do not reorder.
  const {
    colors,
    isDark
  } = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  let scrollBottomPad;
  if (reserveShellBottomNav) {
    scrollBottomPad = shellBottomPad;
  } else {
    scrollBottomPad = FALLBACK_SCROLL_BOTTOM_PAD;
  }
  const shellTopPad = useShellTopPad(spacing.sm);

  // 1. Calorie ring math — goal − food + exercise (Design Law equation row)
  const safeGoal = Math.max(1, Math.round(Number(goal) || DEFAULT_CALORIE_GOAL));
  const foodKcal = Math.round(Number(consumed) || 0);
  const exerciseKcal = Math.round(Number(burned) || 0);
  // vocab: calories left = goal − food + exercise (PNG equation)
  const leftKcal = Math.max(0, safeGoal - foodKcal + exerciseKcal);
  let ringProgress = 0;
  if (safeGoal > 0) {
    ringProgress = Math.min(1, foodKcal / safeGoal);
  }

  // 2. Quick picks from history, or the default list when history is thin.
  const quickPicks = useMemo(() => {
    const fromHistory = (topFoodNames || []).filter(Boolean).slice(0, MAX_QUICK_PICKS_FROM_HISTORY);
    if (fromHistory.length >= MIN_HISTORY_QUICK_PICKS) return fromHistory;
    return DEFAULT_QUICK_PICKS;
  }, [topFoodNames]);

  // 3. Steps progress for the steps card.
  const hasSteps = steps != null && Number(steps) >= 0;
  let stepProgress = 0;
  if (stepGoal > 0) {
    stepProgress = Math.min(1, (Number(steps) || 0) / stepGoal);
  }
  return <DailyFoodLogLayout colors={colors} isDark={isDark} shellTopPad={shellTopPad} scrollBottomPad={scrollBottomPad} viewDate={viewDate} onOpenWeeklyMomentum={onOpenWeeklyMomentum} onOpenSettings={onOpenSettings} onSelectViewDate={onSelectViewDate} datesWithLogs={datesWithLogs} ringProgress={ringProgress} leftKcal={leftKcal} macros={macros} safeGoal={safeGoal} foodKcal={foodKcal} exerciseKcal={exerciseKcal} hasSteps={hasSteps} steps={steps} stepProgress={stepProgress} onConnectSteps={onConnectSteps} onOpenDailyFacts={onOpenDailyFacts} quickPicks={quickPicks} onPillSearch={onPillSearch} meals={meals} onLog={onLog} onRemoveLog={onRemoveLog} onEditLog={onEditLog} onScan={onScan} />;
};
const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md
    // paddingTop set at runtime via useShellTopPad (status bar safe)
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: 12
  },
  dateSub: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6
  },
  settingsBtn: {
    borderRadius: borderRadius.nbIconChip,
    borderWidth: 0,
    overflow: 'hidden'
  },
  block: {
    marginBottom: BLOCK_GAP
  },
  summaryCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16
  },
  macroCol: {
    flex: 1,
    minWidth: 0,
    gap: 12
  },
  macroLane: {
    gap: 6
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  macroTinyIcon: {
    width: 16,
    height: 16
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1
  },
  macroValue: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums']
  },
  mathDivider: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.35,
    marginTop: 16,
    marginBottom: 14
  },
  mathRow: {},
  mathText: {
    // Design Law min text 12 — never drop below
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 18
  },
  mathNum: {
    fontWeight: '900',
    fontVariant: ['tabular-nums']
  },
  stepsCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '900'
  },
  stepsHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18
  },
  dailyFactsBtn: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  dailyFactsBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800'
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: SECTION_GAP_TOP
  },
  quickRow: {
    paddingRight: 8,
    alignItems: 'center'
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: nb.borderWidth
  },
  quickPillText: {
    fontSize: 14,
    fontWeight: '800'
  }
});
export default DailyFoodLogScreen;

// ===== PLUMBING — skip unless debugging =====

function formatDateSubtitle(dateKey) {
  if (!dateKey) {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
  }
  const parsedDate = new Date(`${dateKey}T12:00:00`);
  return parsedDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}
function mealKeyFromName(name) {
  return String(name || 'snacks').toLowerCase();
}
function macroBarColorsForLabel(label) {
  const labelKey = String(label || '').toLowerCase();
  if (labelKey.includes('carb')) return MACRO_BAR_COLORS.carbs;
  if (labelKey.includes('fat')) return MACRO_BAR_COLORS.fat;
  return MACRO_BAR_COLORS.protein;
}
function macroIconForLabel(label) {
  const labelKey = String(label || '').toLowerCase();
  if (labelKey.includes('carb')) return CARBS_ICON;
  if (labelKey.includes('fat')) return FATS_ICON;
  return PROTEIN_ICON;
}