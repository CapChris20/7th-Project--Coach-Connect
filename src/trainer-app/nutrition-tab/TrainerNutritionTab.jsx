// Design Law Nutrition tab (trainer-home PNG 03/04 + trainees 07–10): ring + macros + micros + meals.
// Flow: zero foods → dashed empty shell + Remind CTA; otherwise ring/bars/micros/meal list.
// Used by TrainerHomeContent and ManageTraineeScreen. Food keys stay as the client nutrition log writes them.
//
// vocab: NbProgressBar = hard-border track with gradient fill (accent only)
// Manipulate here: empty copy, remind button label template

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

const RING_SIZE = 96;
const RING_STROKE = 8;
const RING_RADIUS = 40;
const CALORIES_GOAL_DEFAULT = 2000;
const PROTEIN_GOAL_DEFAULT_G = 150;
const CARBS_GOAL_DEFAULT_G = 250;
const FAT_GOAL_DEFAULT_G = 70;
// Design Law empty day shows the four meal slots, each “No meals logged yet”.
const EMPTY_MEAL_SLOTS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'];
const MICRO_KEYS = [
  { key: 'fiber', label: 'Fiber', unit: 'g' },
  { key: 'sugar', label: 'Sugar', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
  { key: 'potassium', label: 'Potassium', unit: 'mg' },
];

// ===== HELPERS =====

function normalizeFoodRows(foods) {
  if (!Array.isArray(foods)) return [];
  return foods.map((item, index) => {
    if (typeof item === 'string') {
      return { id: `food-${index}`, name: item, meal: 'Meal', calories: null };
    }
    return {
      id: item.id || `food-${index}`,
      name: item.name || item.food_name || item.foodName || 'Food',
      meal: capitalizeMeal(item.meal || item.meal_type || item.mealType || 'Meal'),
      calories:
        item.calories != null && Number.isFinite(Number(item.calories))
          ? Math.round(Number(item.calories))
          : null,
    };
  });
}

function capitalizeMeal(raw) {
  const text = String(raw || 'Meal');
  if (!text) return 'Meal';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

function CalorieRing({ calories, goal, isDark }) {
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const track = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(10,10,10,0.12)';
  const pct = goal > 0 ? Math.min(calories / goal, 1) : 0;
  const circumference = 2 * Math.PI * RING_RADIUS;
  const offset = circumference - pct * circumference;
  const center = RING_SIZE / 2;

  return (
    <View style={styles.ringWrap}>
      <View style={{ transform: [{ rotate: '-90deg' }] }}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={center}
            cy={center}
            r={RING_RADIUS}
            stroke={track}
            strokeWidth={RING_STROKE}
            fill="none"
          />
          <Circle
            cx={center}
            cy={center}
            r={RING_RADIUS}
            stroke={ink}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="butt"
          />
        </Svg>
      </View>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringNum, { color: ink }]} numberOfLines={1}>
          {Math.round(calories).toLocaleString()}
        </Text>
        <Text style={[styles.ringOf, { color: muted }]} numberOfLines={1}>
          of {Math.round(goal).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

function MacroBarRow({ icon, label, value, goal, barIndex, isDark }) {
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={styles.macRow}>
      <View style={styles.macTop}>
        <View style={styles.macLabelRow}>
          <NbIconChip source={icon} index={barIndex} size={28} />
          <Text style={[styles.macLabel, { color: ink }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[styles.macVal, { color: muted }]} numberOfLines={1}>
          {Math.round(value)} / {Math.round(goal)} g
        </Text>
      </View>
      <NbProgressBar progress={pct} index={barIndex} />
    </View>
  );
}

function MealRow({ food, iconIndex, isDark, isLast }) {
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  const icon =
    iconIndex % 3 === 0 ? ICON_PROTEIN : iconIndex % 3 === 1 ? ICON_CARBS : ICON_FATS;
  return (
    <View
      style={[
        styles.mealRow,
        !isLast
          ? {
              borderBottomWidth: 2,
              borderBottomColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
            }
          : null,
      ]}
    >
      <NbIconChip source={icon} index={iconIndex} size={40} />
      <View style={styles.grow}>
        <Text style={[styles.mealTitle, { color: ink }]} numberOfLines={2}>
          {food.name}
        </Text>
        <Text style={[styles.mealSub, { color: muted }]} numberOfLines={1}>
          {food.meal}
        </Text>
      </View>
      {food.calories != null ? (
        <Text style={[styles.mealCals, { color: ink }]} numberOfLines={1}>
          {food.calories}
        </Text>
      ) : null}
    </View>
  );
}

function EmptyMealSlot({ label, isDark, isLast }) {
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;
  return (
    <View
      style={[
        styles.mealRow,
        !isLast
          ? {
              borderBottomWidth: 2,
              borderBottomColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
            }
          : null,
      ]}
    >
      <View style={styles.grow}>
        <Text style={[styles.mealTitle, { color: muted }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.mealSub, { color: muted }]} numberOfLines={1}>
          No meals logged yet
        </Text>
      </View>
    </View>
  );
}

// ===== MAIN =====

function firstName(fullName) {
  const text = String(fullName || 'Alex').trim();
  return text.split(/\s+/)[0] || 'Alex';
}

function microRowsFromNutrition(nutrition) {
  const micros = nutrition?.micros;
  if (Array.isArray(micros) && micros.length) {
    return micros.map((row, index) => ({
      id: `micro-${index}`,
      label: row.label || row.name || MICRO_KEYS[index]?.label || 'Micro',
      valueText:
        row.valueText ||
        (row.value != null ? `${row.value}${row.unit ? ` ${row.unit}` : ''}` : '—'),
    }));
  }
  return MICRO_KEYS.map((spec) => {
    const raw = nutrition?.[spec.key];
    return {
      id: spec.key,
      label: spec.label,
      valueText: raw != null && raw !== '' ? `${raw} ${spec.unit}` : '—',
    };
  });
}

const NutritionTab = ({ isDark, clientData, clientName, onRemindLog }) => {
  const nutrition = clientData?.nutrition || {};
  const foods = useMemo(() => normalizeFoodRows(nutrition.foods), [nutrition.foods]);
  const ink = isDark ? darkColors.nbInk : lightColors.nbInk;
  const muted = isDark ? darkColors.nbMuted : lightColors.nbMuted;

  const calories = Number(nutrition.calories) || 0;
  const caloriesGoal = Number(nutrition.caloriesGoal) || CALORIES_GOAL_DEFAULT;
  const protein = Number(nutrition.protein) || 0;
  const carbs = Number(nutrition.carbs) || 0;
  const fat = Number(nutrition.fat) || 0;
  const proteinGoal = Number(nutrition.proteinGoal) || PROTEIN_GOAL_DEFAULT_G;
  const carbsGoal = Number(nutrition.carbsGoal) || CARBS_GOAL_DEFAULT_G;
  const fatGoal = Number(nutrition.fatGoal) || FAT_GOAL_DEFAULT_G;
  const microRows = useMemo(() => microRowsFromNutrition(nutrition), [nutrition]);

  const isTotallyEmpty = foods.length === 0 && calories <= 0;

  // PNG 08/10: dashed empty shell + Remind when nothing logged
  if (isTotallyEmpty) {
    const remindName = firstName(clientName);
    return (
      <View style={styles.root}>
        <NbCard style={[styles.emptyShell, { borderStyle: 'dashed' }]}>
          <NbIconChip source={ICON_FOOD} index={2} size={56} />
          <Text style={[styles.emptyTitle, { color: ink }]}>No nutrition logged yet</Text>
          <Text style={[styles.emptyBody, { color: muted }]}>
            When your client tracks meals in the app, their daily intake shows up here automatically.
          </Text>
          {typeof onRemindLog === 'function' ? (
            <NbButton variant="ghost" onPress={onRemindLog} style={styles.remindBtn}>
              {`Remind ${remindName} to log`}
            </NbButton>
          ) : null}
        </NbCard>
      </View>
    );
  }

  const mealsPresent = new Set(foods.map((f) => f.meal));
  // Partial day → only missing named slots still shown.
  const emptySlots = EMPTY_MEAL_SLOTS.filter((meal) => !mealsPresent.has(meal)).slice(0, 1);

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

      <Text style={[styles.sectionLabel, { color: muted }]}>MICRONUTRIENTS</Text>
      <NbCard style={styles.microCard}>
        {microRows.map((row, index) => (
          <View
            key={row.id}
            style={[
              styles.microRow,
              index < microRows.length - 1 && {
                borderBottomWidth: nb.borderWidthDivider || 2,
                borderBottomColor: isDark ? darkColors.nbBorder : lightColors.nbBorder,
              },
            ]}
          >
            <Text style={[styles.microLabel, { color: ink }]}>{row.label}</Text>
            <Text style={[styles.microValue, { color: ink }]}>{row.valueText}</Text>
          </View>
        ))}
      </NbCard>

      <View style={styles.foodsHeader}>
        <Text style={[styles.sectionLabel, { color: muted }]}>FOODS LOGGED TODAY</Text>
        <Text style={[styles.sectionLabel, { color: muted }]}>
          {`${foods.length} ITEM${foods.length === 1 ? '' : 'S'}`}
        </Text>
      </View>
      <NbCard style={styles.listCard}>
        {foods.map((food, index) => (
          <MealRow
            key={food.id}
            food={food}
            iconIndex={index}
            isDark={isDark}
            isLast={index === foods.length - 1 && emptySlots.length === 0}
          />
        ))}
        {emptySlots.map((label, index) => (
          <EmptyMealSlot
            key={`empty-${label}`}
            label={label}
            isDark={isDark}
            isLast={index === emptySlots.length - 1}
          />
        ))}
      </NbCard>
    </View>
  );
};

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

export default NutritionTab;
