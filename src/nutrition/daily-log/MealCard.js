// Design Law meal block on the daily food log (nutrition PNG 01–04).
// Flow: header chip + title + kcal + add → food rows or dashed empty → optional scan shortcut.
// Used by: DailyFoodLogScreen. mealKey stays the Firestore meal bucket the parent taps.
// Read order: constants → styles → main MealCard → in-file layout pieces → PLUMBING.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import FoodItem from '../food-details/FoodItem';
import HardShadow from '../../look-and-feel/HardShadow';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { accentGradients, borderRadius, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const EMPTY_CALORIES = 0;
const DEFAULT_SERVING_SIZE = 1;
const ICON_CHIP_SIZE = 36;
const FALLBACK_MEAL_ACCENT_INDEX = 2;
const ADD_ICON_SIZE = 22;
// Manipulate here: press opacity on add / scan chips
const PRESS_OPACITY = 0.88;

// Meal header icons — owner handoff art, rotated accent pairs so neighbors differ.
const MEAL_CHIP_META_BY_KEY = {
  breakfast: { icon: require('../../assets/icons/handoff/apple.png'), index: 0 },
  lunch: { icon: require('../../assets/icons/handoff/protein.png'), index: 3 },
  dinner: { icon: require('../../assets/icons/handoff/scales.png'), index: 1 },
  snacks: { icon: require('../../assets/icons/handoff/supp.png'), index: 4 },
};

const FALLBACK_MEAL_ICON = require('../../assets/icons/handoff/apple.png');

const styles = StyleSheet.create({
  // Manipulate here: gap under each meal card (Design Law block gap; empty days feel less stacked at 20)
  cardOuter: { marginBottom: 20 },
  card: {
    padding: 14,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  titleColumn: { flex: 1, minWidth: 0 },
  mealTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  mealTotal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  addChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemsList: { marginBottom: 4 },
  rowDivider: { height: StyleSheet.hairlineWidth * 2, width: '100%', opacity: 0.35 },
  emptyState: {
    paddingVertical: 22,
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: nb.borderWidthDivider,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scanLink: {
    marginTop: 12,
    minHeight: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanLinkText: {
    fontSize: 14,
    fontWeight: '800',
  },
});

// ===== HELPER FUNCTIONS =====

/**
 * Sum calorie fields across every logged row in this meal.
 * @param {Array} logRows
 * @returns {number}
 */
function sumCaloriesAcrossMealRows(logRows) {
  let runningTotal = 0;
  for (let index = 0; index < logRows.length; index += 1) {
    const row = logRows[index];
    runningTotal += row.calories || EMPTY_CALORIES;
  }
  return runningTotal;
}

/**
 * Shape a daily-log row into the food card object FoodItem expects.
 * Field letters (food_name, serving_size, brand_name, metadata) stay frozen.
 * @param {object} logRow
 * @returns {object}
 */
function foodCardShapeFromLogRow(logRow) {
  return {
    name: logRow.food_name || logRow.metadata?.name,
    calories: Number(logRow.calories) || Number(logRow.metadata?.calories) || 0,
    protein: Number(logRow.protein) || Number(logRow.metadata?.protein) || 0,
    carbs: Number(logRow.carbs) || Number(logRow.metadata?.carbs) || 0,
    fat: Number(logRow.fat) || Number(logRow.metadata?.fat) || 0,
    servingSize: Number(logRow.serving_size) || DEFAULT_SERVING_SIZE,
    serving_description: logRow.serving_label || logRow.metadata?.serving_label || null,
    serving_unit: logRow.metadata?.servingUnit || logRow.serving_unit,
    brand_name: logRow.brand_name || logRow.metadata?.brand,
    ...logRow.metadata,
  };
}

/**
 * Icon + accent index for breakfast / lunch / dinner / snacks; unknown keys get fallback art.
 * @param {string} mealKey
 * @returns {{ icon: number, index: number }}
 */
function mealChipMetaForKey(mealKey) {
  const normalizedKey = String(mealKey || '').toLowerCase();
  const knownMeta = MEAL_CHIP_META_BY_KEY[normalizedKey];
  if (knownMeta) return knownMeta;
  return { icon: FALLBACK_MEAL_ICON, index: FALLBACK_MEAL_ACCENT_INDEX };
}

// ===== MAIN FUNCTION =====

/**
 * One meal block: header, logged foods or empty band, optional barcode shortcut.
 * @param {{ mealType: string, mealKey: string, items?: Array, onAddPress: Function, onDeleteItem: Function, onEditItem?: Function, onAddScanner?: Function }} props
 */
export default function MealCard({
  mealType,
  mealKey,
  items = [],
  onAddPress,
  onDeleteItem,
  onEditItem,
  onAddScanner,
}) {
  // vocab: useTheme = Design Law light/dark token bag
  const { colors } = useTheme();

  // 1. Meal bucket facts for header art and calorie total.
  const mealHasLoggedItems = items.length > 0;
  const mealCaloriesTotal = sumCaloriesAcrossMealRows(items);
  const mealVisualMeta = mealChipMetaForKey(mealKey);
  const mealIconSource = mealVisualMeta.icon || FALLBACK_MEAL_ICON;
  const accentIndex = mealVisualMeta.index % accentGradients.length;
  const mealAccentGradient = accentGradients[accentIndex];

  // 2. Card shell colors from theme tokens (Design Law — no raw hex here).
  const cardBackgroundColor = colors.nbSurface;
  const cardBorderColor = colors.nbBorder;
  const cardShellStyle = [
    styles.card,
    { backgroundColor: cardBackgroundColor, borderColor: cardBorderColor },
  ];

  // 3. Add-food chip matches the card outline treatment.
  const addButtonStyle = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
  };

  // 4. Decide which body + footer to show (named before JSX).
  const showLoggedFoodRows = mealHasLoggedItems;
  const showScanShortcut = mealHasLoggedItems && Boolean(onAddScanner);

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.cardOuter}>
      <View style={cardShellStyle}>
        <MealCardHeaderRow
          mealType={mealType}
          mealKey={mealKey}
          mealCaloriesTotal={mealCaloriesTotal}
          mealIconSource={mealIconSource}
          mealVisualMeta={mealVisualMeta}
          mealAccentGradient={mealAccentGradient}
          addButtonStyle={addButtonStyle}
          onAddPress={onAddPress}
          inkColor={colors.nbInk}
          mutedColor={colors.nbMuted}
        />

        {showLoggedFoodRows ? (
          <MealCardLoggedItems
            items={items}
            dividerColor={colors.nbBorder}
            onDeleteItem={onDeleteItem}
            onEditItem={onEditItem}
          />
        ) : (
          <MealCardEmptyBand borderColor={colors.nbBorder} mutedColor={colors.nbMuted} />
        )}

        {showScanShortcut ? (
          <MealCardScanShortcut
            mealKey={mealKey}
            borderColor={colors.nbBorder}
            inkColor={colors.nbInk}
            onAddScanner={onAddScanner}
          />
        ) : null}
      </View>
    </HardShadow>
  );
}

// ===== IN-FILE LAYOUT (no hooks) =====

/**
 * Header: icon chip, meal title + kcal, square add button.
 */
function MealCardHeaderRow({
  mealType,
  mealKey,
  mealCaloriesTotal,
  mealIconSource,
  mealVisualMeta,
  mealAccentGradient,
  addButtonStyle,
  onAddPress,
  inkColor,
  mutedColor,
}) {
  const caloriesRounded = Math.round(mealCaloriesTotal);
  const caloriesCaptionText = `${caloriesRounded} kcal`;
  const addAccessibilityLabel = `Add to ${mealType}`;

  return (
    <View style={styles.cardHeader}>
      <NbIconChip
        source={mealIconSource}
        size={ICON_CHIP_SIZE}
        index={mealVisualMeta.index}
        colors={mealAccentGradient}
      />
      <View style={styles.titleColumn}>
        <Text style={[styles.mealTitle, { color: inkColor }]} selectable>
          {mealType}
        </Text>
        <Text style={[styles.mealTotal, { color: mutedColor }]} selectable>
          {caloriesCaptionText}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => onAddPress(mealKey)}
        accessibilityLabel={addAccessibilityLabel}
        style={[styles.addChip, addButtonStyle]}
        activeOpacity={PRESS_OPACITY}
      >
        <Ionicons name="add" size={ADD_ICON_SIZE} color={inkColor} />
      </TouchableOpacity>
    </View>
  );
}

/**
 * Logged food rows with hairline dividers between them.
 */
function MealCardLoggedItems({ items, dividerColor, onDeleteItem, onEditItem }) {
  return (
    <View style={styles.itemsList}>
      {items.map((logRow, rowIndex) => {
        const rowKey = logRow.id || rowIndex;
        const showDividerAbove = rowIndex > 0;
        const foodCardShape = foodCardShapeFromLogRow(logRow);
        const editPressHandler = onEditItem ? () => onEditItem(logRow) : undefined;

        return (
          <View key={rowKey}>
            {showDividerAbove ? (
              <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />
            ) : null}
            <FoodItem
              food={foodCardShape}
              onDelete={() => onDeleteItem(logRow)}
              onPress={editPressHandler}
              showDelete
              compact
            />
          </View>
        );
      })}
    </View>
  );
}

/**
 * Dashed empty band when this meal has no logged foods yet.
 */
function MealCardEmptyBand({ borderColor, mutedColor }) {
  return (
    <View style={[styles.emptyState, { borderTopColor: borderColor }]}>
      <Text style={[styles.emptyText, { color: mutedColor }]} selectable>
        No items logged
      </Text>
    </View>
  );
}

/**
 * Barcode shortcut under a filled meal (empty meals keep the lighter Design Law shell).
 */
function MealCardScanShortcut({ mealKey, borderColor, inkColor, onAddScanner }) {
  return (
    <TouchableOpacity
      onPress={() => onAddScanner(mealKey)}
      style={[styles.scanLink, { borderColor }]}
      activeOpacity={PRESS_OPACITY}
    >
      <Text style={[styles.scanLinkText, { color: inkColor }]}>Scan barcode</Text>
    </TouchableOpacity>
  );
}

