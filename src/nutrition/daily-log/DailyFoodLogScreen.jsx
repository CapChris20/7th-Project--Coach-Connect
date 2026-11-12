// Design Law Nutrition daily log (PNG 01–04 light/dark).
// Flow: date header → week strip → ring+macros card → steps → quick picks → meal cards.
// Rendered by DailyLogContent after goals exist. Keeps meal keys breakfast/lunch/dinner/snacks.

import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import {
  useShellBottomNavInset,
  useShellTopPad,
  FORM_SCROLL_PROPS,
} from '../../navigation/bottomMenuSpacing';
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
// Manipulate here: space between stacked HardShadow cards (Design Law block gap = 16; 20 reads less cramped with heavy borders)
const BLOCK_GAP = 20;
// Manipulate here: air above QUICK PICKS / MEALS labels (Design Law dense-page section gap 24–28)
const SECTION_GAP_TOP = 24;

const DEFAULT_MEALS = [
  { name: 'Breakfast', cals: 0, foods: [] },
  { name: 'Lunch', cals: 0, foods: [] },
  { name: 'Dinner', cals: 0, foods: [] },
  { name: 'Snacks', cals: 0, foods: [] },
];

const DEFAULT_MACROS = [
  { label: 'Protein', val: 0, goal: 150 },
  { label: 'Carbs', val: 0, goal: 250 },
  { label: 'Fat', val: 0, goal: 70 },
];

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
  fat: ['#FB7185', '#EF4444'],
};

// ===== HELPER FUNCTIONS =====

function formatDateSubtitle(dateKey) {
  if (!dateKey) {
    return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  const d = new Date(`${dateKey}T12:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function mealKeyFromName(name) {
  return String(name || 'snacks').toLowerCase();
}

function macroBarColorsForLabel(label) {
  const key = String(label || '').toLowerCase();
  if (key.includes('carb')) return MACRO_BAR_COLORS.carbs;
  if (key.includes('fat')) return MACRO_BAR_COLORS.fat;
  return MACRO_BAR_COLORS.protein;
}

function macroIconForLabel(label) {
  const key = String(label || '').toLowerCase();
  if (key.includes('carb')) return CARBS_ICON;
  if (key.includes('fat')) return FATS_ICON;
  return PROTEIN_ICON;
}

/**
 * PNG calorie equation row under the ring + macros.
 */
function CalorieMathRow({ goal, food, exercise, left, colors }) {
  return (
    <View style={styles.mathRow}>
      <Text style={[styles.mathText, { color: colors.nbMuted }]}>
        <Text style={[styles.mathNum, { color: colors.nbInk }]}>{goal.toLocaleString()}</Text>
        {' GOAL − '}
        <Text style={[styles.mathNum, { color: colors.nbInk }]}>{food.toLocaleString()}</Text>
        {' FOOD + '}
        <Text style={[styles.mathNum, { color: colors.nbInk }]}>{exercise.toLocaleString()}</Text>
        {' EXERCISE = '}
        <Text style={[styles.mathNum, { color: colors.nbInk }]}>{left.toLocaleString()}</Text>
        {' LEFT'}
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Presentational nutrition day view. Parent wires Firestore totals into these props.
 */
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
  onQuickAdd = () => {},
  viewDate,
  onSelectViewDate,
  datesWithLogs = [],
  topFoodNames = [],
  steps = null,
  stepGoal = DEFAULT_STEP_GOAL,
  onConnectSteps,
  reserveShellBottomNav = false,
}) => {
  const { colors, isDark } = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : SHELL_BOTTOM_INSET_EXTRA + 24;
  // Shell SafeArea is left/right only — clear status bar / Dynamic Island
  const shellTopPad = useShellTopPad(spacing.sm);

  const safeGoal = Math.max(1, Math.round(Number(goal) || DEFAULT_CALORIE_GOAL));
  const foodKcal = Math.round(Number(consumed) || 0);
  const exerciseKcal = Math.round(Number(burned) || 0);
  // vocab: calories left = goal − food + exercise (PNG equation)
  const leftKcal = Math.max(0, safeGoal - foodKcal + exerciseKcal);
  const ringProgress = safeGoal > 0 ? Math.min(1, foodKcal / safeGoal) : 0;

  const quickPicks = useMemo(() => {
    const fromHistory = (topFoodNames || []).filter(Boolean).slice(0, 6);
    if (fromHistory.length >= 2) return fromHistory;
    return DEFAULT_QUICK_PICKS;
  }, [topFoodNames]);

  const hasSteps = steps != null && Number(steps) >= 0;
  const stepProgress = stepGoal > 0 ? Math.min(1, (Number(steps) || 0) / stepGoal) : 0;

  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: colors.nbBackground }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: shellTopPad, paddingBottom: scrollBottomPad },
        ]}
        {...FORM_SCROLL_PROPS}
      >
        {/* Header: date + Nutrition + settings gear (PNG) */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.dateSub, { color: colors.nbMuted }]}>
              {formatDateSubtitle(viewDate)}
            </Text>
            <Text style={[styles.title, { color: colors.nbInk }]}>Nutrition</Text>
          </View>
          {onOpenSettings ? (
            <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
              <TouchableOpacity
                onPress={onOpenSettings}
                accessibilityLabel="Nutrition settings"
                style={[
                  styles.settingsBtn,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                ]}
                activeOpacity={0.88}
              >
                <NbIconChip source={SETTINGS_ICON} size={40} index={3} />
              </TouchableOpacity>
            </HardShadow>
          ) : null}
        </View>

        {onSelectViewDate ? (
          <DayPicker
            selectedDate={viewDate}
            onSelectDate={onSelectViewDate}
            isDark={isDark}
            datesWithLogs={datesWithLogs}
          />
        ) : null}

        {/* Macro summary card — ring + bars + equation */}
        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
          <View
            style={[
              styles.summaryCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <View style={styles.summaryTop}>
              <NbRing
                progress={ringProgress}
                size={RING_SIZE}
                strokeWidth={14}
                variant="ink"
                value={leftKcal.toLocaleString()}
                label="kcal left"
              />
              <View style={styles.macroCol}>
                {(macros || DEFAULT_MACROS).map((m, i) => {
                  const val = Math.round(Number(m.val) || 0);
                  const gGoal = Math.round(Number(m.goal) || 0);
                  const pct = gGoal > 0 ? Math.min(1, val / gGoal) : 0;
                  const barColors = macroBarColorsForLabel(m.label);
                  return (
                    <View key={m.label || i} style={styles.macroLane}>
                      <View style={styles.macroLabelRow}>
                        <Image
                          source={macroIconForLabel(m.label)}
                          style={styles.macroTinyIcon}
                          resizeMode="contain"
                        />
                        <Text style={[styles.macroLabel, { color: colors.nbInk }]}>{m.label}</Text>
                        <Text style={[styles.macroValue, { color: colors.nbMuted }]}>
                          {val} / {gGoal} g
                        </Text>
                      </View>
                      <NbProgressBar progress={pct} colors={barColors} index={i} />
                    </View>
                  );
                })}
              </View>
            </View>
            <View style={[styles.mathDivider, { backgroundColor: colors.nbBorder }]} />
            <CalorieMathRow
              goal={safeGoal}
              food={foodKcal}
              exercise={exerciseKcal}
              left={leftKcal}
              colors={colors}
            />
          </View>
        </HardShadow>

        {/* Steps card — connected progress or Connect CTA */}
        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
          <View
            style={[
              styles.stepsCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <NbIconChip source={STEPS_ICON} size={40} index={1} />
            {hasSteps ? (
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <Text style={[styles.stepsTitle, { color: colors.nbInk }]}>
                  {Number(steps).toLocaleString()} steps
                </Text>
                <NbProgressBar progress={stepProgress} colors={accentGradients[1]} index={1} />
              </View>
            ) : (
              <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                <Text style={[styles.stepsHint, { color: colors.nbMuted }]}>
                  Connect to track your steps. Steps add to your calories left.
                </Text>
                {typeof onConnectSteps === 'function' ? (
                  <NbButton variant="plain" sm onPress={onConnectSteps}>
                    Connect
                  </NbButton>
                ) : null}
              </View>
            )}
          </View>
        </HardShadow>

        {/* Open full-day Nutrition facts report (HardShadow row) */}
        {typeof onOpenDailyFacts === 'function' ? (
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
            <TouchableOpacity
              onPress={onOpenDailyFacts}
              activeOpacity={0.88}
              accessibilityLabel="Open nutrition facts"
              style={[
                styles.dailyFactsBtn,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
              ]}
            >
              <Ionicons name="nutrition-outline" size={20} color={colors.nbInk} />
              <Text style={[styles.dailyFactsBtnText, { color: colors.nbInk }]}>
                Nutrition facts
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
            </TouchableOpacity>
          </HardShadow>
        ) : null}

        {/* Quick picks */}
        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>QUICK PICKS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
          style={{ marginBottom: BLOCK_GAP }}
        >
          {quickPicks.map((name) => (
            <HardShadow
              key={name}
              offset={nb.shadowOffsetSmall}
              radius={999}
              style={{ marginRight: 8 }}
            >
              <TouchableOpacity
                onPress={() => onPillSearch?.(name)}
                style={[
                  styles.quickPill,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                ]}
                activeOpacity={0.88}
              >
                <Ionicons name="add" size={16} color={colors.nbInk} />
                <Text style={[styles.quickPillText, { color: colors.nbInk }]} numberOfLines={1}>
                  {name}
                </Text>
              </TouchableOpacity>
            </HardShadow>
          ))}
        </ScrollView>

        {/* Meals */}
        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>MEALS</Text>
        {(meals || DEFAULT_MEALS).map((meal) => {
          const key = mealKeyFromName(meal.name);
          return (
            <MealCard
              key={meal.name}
              mealType={meal.name}
              mealKey={key}
              items={meal.foods || []}
              onAddPress={(mealKey) => onLog(mealKey)}
              onDeleteItem={(item) => onRemoveLog?.(item?.id || item)}
              onEditItem={onEditLog}
              onAddScanner={(mealKey) => onScan(mealKey)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    // paddingTop set at runtime via useShellTopPad (status bar safe)
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: 12,
  },
  dateSub: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  settingsBtn: {
    borderRadius: borderRadius.nbIconChip,
    borderWidth: 0,
    overflow: 'hidden',
  },
  block: {
    marginBottom: BLOCK_GAP,
  },
  summaryCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  macroCol: {
    flex: 1,
    minWidth: 0,
    gap: 12,
  },
  macroLane: {
    gap: 6,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroTinyIcon: {
    width: 16,
    height: 16,
  },
  macroLabel: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flex: 1,
  },
  macroValue: {
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  mathDivider: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.35,
    marginTop: 16,
    marginBottom: 14,
  },
  mathRow: {},
  mathText: {
    // Design Law min text 12 — never drop below
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    lineHeight: 18,
  },
  mathNum: {
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  stepsCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  stepsHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  dailyFactsBtn: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dailyFactsBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: SECTION_GAP_TOP,
  },
  quickRow: {
    paddingRight: 8,
    alignItems: 'center',
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
  },
  quickPillText: {
    fontSize: 14,
    fontWeight: '800',
  },
});

export default DailyFoodLogScreen;
