// Design Law Nutrition tab — calorie ring, macro bars, micros, and today’s meal list for one trainee.
// Flow: nothing logged → dashed empty shell + Remind; else summary card → micros → foods.
// Used by TrainerHomeContent and ManageTraineeScreen. Food field keys match client nutrition log writes.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { lightColors, darkColors, nb } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import NbButton from '../../look-and-feel/NbButton';

// ===== NAMED CONSTANTS =====

const ICON_PROTEIN = require('../../assets/icons/handoff/protein.png');
const ICON_CARBS = require('../../assets/icons/handoff/carbs.png');
const ICON_FATS = require('../../assets/icons/handoff/fats.png');
const ICON_FOOD = require('../../assets/icons/handoff/protein.png');

// Manipulate here: ring geometry — must match Design Law PNG calorie ring.
const RING_SIZE = 96;
const RING_STROKE = 8;
const RING_RADIUS = 40;

// Manipulate here: placeholder goals when the client has not set their own yet.
const CALORIES_GOAL_DEFAULT = 2000;
const PROTEIN_GOAL_DEFAULT_G = 150;
const CARBS_GOAL_DEFAULT_G = 250;
const FAT_GOAL_DEFAULT_G = 70;

// Design Law empty day still lists four meal slots with “No meals logged yet”.
const EMPTY_MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];

const MICRO_KEYS = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
];

// ===== LAYOUT PIECES (pure — no hooks) =====

function CalorieRing({ calories, goal, isDark }) {
  const { ink, muted } = inkAndMutedForTheme(isDark);
  const trackColor = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(10,10,10,0.12)';
  const progressFraction = goal > 0 ? Math.min(calories / goal, 1) : 0;
  const circumference = 2 * Math.PI * RING_RADIUS;
  const strokeOffset = circumference - progressFraction * circumference;
  const ringCenter = RING_SIZE / 2;
  const caloriesLabel = Math.round(calories).toLocaleString();
  const goalLabel = Math.round(goal).toLocaleString();
  const ringRotateStyle = { transform: [{ rotate: '-90deg' }] };
  const caloriesTextStyle = [styles.ringNum, { color: ink }];
  const goalTextStyle = [styles.ringOf, { color: muted }];

  return (
    <View style={styles.ringWrap}>
      <View style={ringRotateStyle}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={ringCenter}
            cy={ringCenter}
            r={RING_RADIUS}
            stroke={trackColor}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={ringCenter}
            cy={ringCenter}
            r={RING_RADIUS}
            stroke={ink}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeOffset}
            strokeLinecap="butt"
          />
        </Svg>
      </View>
      <View style={styles.ringCenter}>
        <Text style={caloriesTextStyle} numberOfLines={1}>
          {caloriesLabel}
        </Text>
        <Text style={goalTextStyle} numberOfLines={1}>
          of {goalLabel}
        </Text>
      </View>
    </View>
  );
}

function MacroBarRow({ icon, label, value, goal, barIndex, isDark }) {
  const { ink, muted } = inkAndMutedForTheme(isDark);
  const progressFraction = goal > 0 ? Math.min(value / goal, 1) : 0;
  const valueText = `${Math.round(value)} / ${Math.round(goal)} g`;
  const labelTextStyle = [styles.macLabel, { color: ink }];
  const valueTextStyle = [styles.macVal, { color: muted }];

  return (
    <View style={styles.macRow}>
      <View style={styles.macTop}>
        <View style={styles.macLabelRow}>
          <NbIconChip source={icon} index={barIndex} size={28} />
          <Text style={labelTextStyle} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={valueTextStyle} numberOfLines={1}>
          {valueText}
        </Text>
      </View>
      <NbProgressBar progress={progressFraction} index={barIndex} />
    </View>
  );
}

function MealRow({ food, iconIndex, isDark, isLast }) {
  const { ink, muted, border } = inkMutedAndBorderForTheme(isDark);
  const rowIcon = iconForMealRowIndex(iconIndex);
  const showBottomBorder = !isLast;
  const rowBorderStyle = showBottomBorder
    ? { borderBottomWidth: 2, borderBottomColor: border }
    : null;
  const titleStyle = [styles.mealTitle, { color: ink }];
  const subtitleStyle = [styles.mealSub, { color: muted }];
  const caloriesStyle = [styles.mealCals, { color: ink }];
  const hasCalories = food.calories != null;

  return (
    <View style={[styles.mealRow, rowBorderStyle]}>
      <NbIconChip source={rowIcon} index={iconIndex} size={40} />
      <View style={styles.grow}>
        <Text style={titleStyle} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={subtitleStyle} numberOfLines={1}>
          {food.meal}
        </Text>
      </View>
      {hasCalories ? (
        <Text style={caloriesStyle} numberOfLines={1}>
          {food.calories}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyMealSlot({ label, isDark, isLast }) {
  const { muted, border } = inkMutedAndBorderForTheme(isDark);
  const showBottomBorder = !isLast;
  const rowBorderStyle = showBottomBorder
    ? { borderBottomWidth: 2, borderBottomColor: border }
    : null;
  const titleStyle = [styles.mealTitle, { color: muted }];
  const subtitleStyle = [styles.mealSub, { color: muted }];

  return (
    <View style={[styles.mealRow, rowBorderStyle]}>
      <View style={styles.grow}>
        <Text style={titleStyle} numberOfLines={1}>
          {label}
        </Text>
        <Text style={subtitleStyle} numberOfLines={1}>
          No meals logged yet
        </Text>
      </View>
    </View>
  );
}

function NutritionEmptyDay({ isDark, clientName, onRemindLog }) {
  const { ink, muted } = inkAndMutedForTheme(isDark);
  const remindFirstName = firstNameFromFullName(clientName);
  const canRemind = typeof onRemindLog === 'function';
  const emptyShellStyle = [styles.emptyShell, { borderStyle: 'dashed' }];
  const titleStyle = [styles.emptyTitle, { color: ink }];
  const bodyStyle = [styles.emptyBody, { color: muted }];
  const remindButtonLabel = `Remind ${remindFirstName} to log`;

  return (
    <View style={styles.root}>
      <NbCard style={emptyShellStyle}>
        <NbIconChip source={ICON_FOOD} index={2} size={56} />
        <Text style={titleStyle}>No nutrition logged yet</Text>
        <Text style={bodyStyle}>
          When your client tracks meals in the app, their daily intake shows up here automatically.
        </Text>
        {canRemind ? (
          <NbButton variant="ghost" onPress={onRemindLog} style={styles.remindBtn}>
            {remindButtonLabel}
          </NbButton>
        ) : null}
      </NbCard>
    </View>
  );
}

function MicroRow({ row, isLast, ink, border }) {
  const dividerWidth = nb.borderWidthDivider || 2;
  const rowBorderStyle = isLast
    ? null
    : { borderBottomWidth: dividerWidth, borderBottomColor: border };
  const labelStyle = [styles.microLabel, { color: ink }];
  const valueStyle = [styles.microValue, { color: ink }];

  return (
    <View style={[styles.microRow, rowBorderStyle]}>
      <Text style={labelStyle}>{row.label}</Text>
      <Text style={valueStyle}>{row.valueText}</Text>
    </View>
  );
}

function NutritionLoggedDay({
  isDark,
  foods,
  calories,
  caloriesGoal,
  protein,
  carbs,
  fat,
  proteinGoal,
  carbsGoal,
  fatGoal,
  microRows,
}) {
  const { ink, muted, border } = inkMutedAndBorderForTheme(isDark);
  const missingMealSlots = missingDesignLawMealSlots(foods);
  const foodCountLabel = foods.length === 1 ? '1 ITEM' : `${foods.length} ITEMS`;
  const sectionMutedStyle = [styles.sectionLabel, { color: muted }];

  return (
    <View style={styles.root}>
      <NbCard style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <CalorieRing calories={calories} goal={caloriesGoal} isDark={isDark} />
          <View style={styles.macCol}>
            <MacroBarRow
              icon={ICON_PROTEIN}
              label="Protein"
              value={protein}
              goal={proteinGoal}
              barIndex={8}
              isDark={isDark}
            />
            <MacroBarRow
              icon={ICON_CARBS}
              label="Carbs"
              value={carbs}
              goal={carbsGoal}
              barIndex={0}
              isDark={isDark}
            />
            <MacroBarRow
              icon={ICON_FATS}
              label="Fats"
              value={fat}
              goal={fatGoal}
              barIndex={3}
              isDark={isDark}
            />
          </View>
        </View>
      </NbCard>

      <Text style={sectionMutedStyle}>MICRONUTRIENTS</Text>
      <NbCard style={styles.microCard}>
        {microRows.map((row, index) => {
          const isLastMicro = index === microRows.length - 1;
          return (
            <MicroRow
              key={row.id}
              row={row}
              isLast={isLastMicro}
              ink={ink}
              border={border}
            />
          );
        })}
      </NbCard>

      <View style={styles.foodsHeader}>
        <Text style={sectionMutedStyle}>FOODS LOGGED TODAY</Text>
        <Text style={sectionMutedStyle}>{foodCountLabel}</Text>
      </View>
      <NbCard style={styles.listCard}>
        {foods.map((foodRow, index) => {
          const isLastFood = index === foods.length - 1 && missingMealSlots.length === 0;
          return (
            <MealRow
              key={foodRow.id}
              food={foodRow}
              iconIndex={index}
              isDark={isDark}
              isLast={isLastFood}
            />
          );
        })}
        {missingMealSlots.map((mealLabel, index) => {
          const isLastEmptySlot = index === missingMealSlots.length - 1;
          return (
            <EmptyMealSlot
              key={`empty-${mealLabel}`}
              label={mealLabel}
              isDark={isDark}
              isLast={isLastEmptySlot}
            />
          );
        })}
      </NbCard>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer Nutrition tab body for one client’s today totals.
 * Flow: 1. normalize foods/micros  2. pull totals/goals  3. empty shell or logged day
 */
const NutritionTab = ({ isDark, clientData, clientName, onRemindLog }) => {
  // vocab: useMemo = remember a computed value until its inputs change (foods / micros reshape).
  const nutrition = clientData?.nutrition || {};
  const foods = useMemo(() => normalizeFoodRows(nutrition.foods), [nutrition.foods]);
  const microRows = useMemo(() => microRowsFromNutrition(nutrition), [nutrition]);

  // 1. Pull totals and goals (defaults match Design Law placeholder day).
  const calories = Number(nutrition.calories) || 0;
  const caloriesGoal = Number(nutrition.caloriesGoal) || CALORIES_GOAL_DEFAULT;
  const protein = Number(nutrition.protein) || 0;
  const carbs = Number(nutrition.carbs) || 0;
  const fat = Number(nutrition.fat) || 0;
  const proteinGoal = Number(nutrition.proteinGoal) || PROTEIN_GOAL_DEFAULT_G;
  const carbsGoal = Number(nutrition.carbsGoal) || CARBS_GOAL_DEFAULT_G;
  const fatGoal = Number(nutrition.fatGoal) || FAT_GOAL_DEFAULT_G;

  // 2. Totally empty → dashed shell (Design Law PNG 08/10).
  const isTotallyEmpty = foods.length === 0 && calories <= 0;
  if (isTotallyEmpty) {
    return (
      <NutritionEmptyDay isDark={isDark} clientName={clientName} onRemindLog={onRemindLog} />
    );
  }

  // 3. Otherwise render ring, micros, and meal list.
  return (
    <NutritionLoggedDay
      isDark={isDark}
      foods={foods}
      calories={calories}
      caloriesGoal={caloriesGoal}
      protein={protein}
      carbs={carbs}
      fat={fat}
      proteinGoal={proteinGoal}
      carbsGoal={carbsGoal}
      fatGoal={fatGoal}
      microRows={microRows}
    />
  );
};

export default NutritionTab;

// ===== PLUMBING — skip unless debugging food-row / micro reshape =====

function firstNameFromFullName(fullName) {
  const trimmed = String(fullName || 'Alex').trim();
  const nameParts = trimmed.split(/\s+/);
  return nameParts[0] || 'Alex';
}

function capitalizeMealLabel(rawMeal) {
  const text = String(rawMeal || 'Meal');
  if (!text) return 'Meal';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function normalizeFoodRows(foods) {
  if (!Array.isArray(foods)) return [];
  const normalizedRows = [];
  for (let index = 0; index < foods.length; index += 1) {
    normalizedRows.push(normalizeOneFoodRow(foods[index], index));
  }
  return normalizedRows;
}

function normalizeOneFoodRow(item, index) {
  if (typeof item === 'string') {
    return { id: `food-${index}`, name: item, meal: 'Meal', calories: null };
  }

  const caloriesNumber = item.calories != null ? Number(item.calories) : null;
  const caloriesAreFinite = caloriesNumber != null && Number.isFinite(caloriesNumber);
  const roundedCalories = caloriesAreFinite ? Math.round(caloriesNumber) : null;
  const mealRaw = item.meal || item.meal_type || item.mealType || 'Meal';

  return {
    id: item.id || `food-${index}`,
    name: item.name || item.food_name || item.foodName || 'Food',
    meal: capitalizeMealLabel(mealRaw),
    calories: roundedCalories,
  };
}

function microRowsFromNutrition(nutrition) {
  const microsArray = nutrition?.micros;
  if (Array.isArray(microsArray) && microsArray.length) {
    return microsArrayFromExplicitList(microsArray);
  }
  return microsArrayFromFlatFields(nutrition);
}

function microsArrayFromExplicitList(microsArray) {
  const rows = [];
  for (let index = 0; index < microsArray.length; index += 1) {
    const row = microsArray[index];
    const fallbackLabel = MICRO_KEYS[index]?.label || 'Micro';
    let valueText = row.valueText;
    if (!valueText && row.value != null) {
      valueText = row.unit ? `${row.value} ${row.unit}` : `${row.value}`;
    }
    if (!valueText) valueText = '—';
    rows.push({
      id: `micro-${index}`,
      label: row.label || row.name || fallbackLabel,
      valueText,
    });
  }
  return rows;
}

function microsArrayFromFlatFields(nutrition) {
  const rows = [];
  for (let index = 0; index < MICRO_KEYS.length; index += 1) {
    const spec = MICRO_KEYS[index];
    const fieldValue = nutrition?.[spec.key];
    const hasValue = fieldValue != null && fieldValue !== '';
    rows.push({
      id: spec.key,
      label: spec.label,
      valueText: hasValue ? `${fieldValue} ${spec.unit}` : '—',
    });
  }
  return rows;
}

function iconForMealRowIndex(rowIndex) {
  const slot = rowIndex % 3;
  if (slot === 0) return ICON_PROTEIN;
  if (slot === 1) return ICON_CARBS;
  return ICON_FATS;
}

function inkAndMutedForTheme(isDark) {
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  return { ink, muted };
}

function inkMutedAndBorderForTheme(isDark) {
  const { ink, muted } = inkAndMutedForTheme(isDark);
  const border = isDark ? darkColors.nbBorder : lightColors.nbBorder;
  return { ink, muted, border };
}

function missingDesignLawMealSlots(foods) {
  // Partial day: show at most one missing Design Law meal slot.
  const mealsPresent = new Set();
  for (let i = 0; i < foods.length; i += 1) {
    mealsPresent.add(foods[i].meal);
  }
  const emptySlots = [];
  for (let i = 0; i < EMPTY_MEAL_SLOTS.length; i += 1) {
    const mealLabel = EMPTY_MEAL_SLOTS[i];
    if (!mealsPresent.has(mealLabel)) emptySlots.push(mealLabel);
  }
  return emptySlots.slice(0, 1);
}

const styles = StyleSheet.create({
  root: {
    gap: 16,
    paddingTop: 4,
  },
  emptyShell: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  remindBtn: { alignSelf: 'stretch', marginTop: 4 },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.1,
  },
  foodsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  microCard: { paddingVertical: 0, paddingHorizontal: 0, overflow: 'hidden' },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  microLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  microValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  summaryCard: {
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  ringNum: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  ringOf: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  macCol: {
    flex: 1,
    minWidth: 0,
    gap: 9,
  },
  macRow: {
    gap: 6,
  },
  macTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  macLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  macLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  macVal: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  listCard: {
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingVertical: 10,
  },
  grow: {
    flex: 1,
    minWidth: 0,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  mealSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  mealCals: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
    marginLeft: 8,
  },
});
