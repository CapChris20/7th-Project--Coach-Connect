// Design Law meal block on the daily food log (nutrition PNG 01–04).
// Flow: icon chip + title + kcal + square + → food rows or dashed empty.
// Used by DailyFoodLogScreen. mealKey stays the Firestore meal bucket the parent taps.

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

// Meal header icons — owner handoff art, rotated accent pairs so neighbors differ
const MEAL_META = {
  breakfast: { icon: require('../../assets/icons/handoff/apple.png'), index: 0 },
  lunch: { icon: require('../../assets/icons/handoff/protein.png'), index: 3 },
  dinner: { icon: require('../../assets/icons/handoff/scales.png'), index: 1 },
  snacks: { icon: require('../../assets/icons/handoff/supp.png'), index: 4 },
};

const FALLBACK_MEAL_ICON = require('../../assets/icons/handoff/apple.png');

// ===== HELPER FUNCTIONS =====

function totalMealCalories(items) {
  return items.reduce((sum, item) => sum + (item.calories || EMPTY_CALORIES), 0);
}

function foodCardFromLogItem(item) {
  return {
    name: item.food_name || item.metadata?.name,
    calories: Number(item.calories) || Number(item.metadata?.calories) || 0,
    protein: Number(item.protein) || Number(item.metadata?.protein) || 0,
    carbs: Number(item.carbs) || Number(item.metadata?.carbs) || 0,
    fat: Number(item.fat) || Number(item.metadata?.fat) || 0,
    servingSize: Number(item.serving_size) || DEFAULT_SERVING_SIZE,
    serving_description: item.serving_label || item.metadata?.serving_label || null,
    serving_unit: item.metadata?.servingUnit || item.serving_unit,
    brand_name: item.brand_name || item.metadata?.brand,
    ...item.metadata,
  };
}

function mealMetaForKey(mealKey) {
  const key = String(mealKey || '').toLowerCase();
  return MEAL_META[key] || { icon: FALLBACK_MEAL_ICON, index: 2 };
}

// ===== MAIN FUNCTION =====

/**
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
  const { colors } = useTheme();
  const hasItems = items.length > 0;
  const mealTotal = totalMealCalories(items);
  const meta = mealMetaForKey(mealKey);
  const mealIcon = meta.icon || FALLBACK_MEAL_ICON;

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.cardOuter}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <NbIconChip
            source={mealIcon}
            size={ICON_CHIP_SIZE}
            index={meta.index}
            colors={accentGradients[meta.index % accentGradients.length]}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.mealTitle, { color: colors.nbInk }]} selectable>
              {mealType}
            </Text>
            <Text style={[styles.mealTotal, { color: colors.nbMuted }]} selectable>
              {Math.round(mealTotal)} kcal
            </Text>
          </View>
          {/* PNG: square + opens add food for this meal */}
          <TouchableOpacity
            onPress={() => onAddPress(mealKey)}
            accessibilityLabel={`Add to ${mealType}`}
            style={[
              styles.addChip,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
              },
            ]}
            activeOpacity={0.88}
          >
            <Ionicons name="add" size={22} color={colors.nbInk} />
          </TouchableOpacity>
        </View>

        {hasItems ? (
          <View style={styles.itemsList}>
            {items.map((item, index) => (
              <View key={item.id || index}>
                {index > 0 ? (
                  <View style={[styles.rowDivider, { backgroundColor: colors.nbBorder }]} />
                ) : null}
                <FoodItem
                  food={foodCardFromLogItem(item)}
                  onDelete={() => onDeleteItem(item)}
                  onPress={onEditItem ? () => onEditItem(item) : undefined}
                  showDelete
                  compact
                />
              </View>
            ))}
          </View>
        ) : (
          // Design Law empty meal = dashed “No items logged” only (no Scan row — barcode lives in add/search)
          <View style={[styles.emptyState, { borderTopColor: colors.nbBorder }]}>
            <Text style={[styles.emptyText, { color: colors.nbMuted }]} selectable>
              No items logged
            </Text>
          </View>
        )}

        {/* Scan stays as a filled-meal shortcut; empty days keep the lighter Design Law shell */}
        {hasItems && onAddScanner ? (
          <TouchableOpacity
            onPress={() => onAddScanner(mealKey)}
            style={[styles.scanLink, { borderColor: colors.nbBorder }]}
            activeOpacity={0.88}
          >
            <Text style={[styles.scanLinkText, { color: colors.nbInk }]}>Scan barcode</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  // Manipulate here: gap under each meal card (Design Law block gap; empty days feel less stacked at 20)
  cardOuter: { marginBottom: 20 },
  card: {
    // Design Law card padding stays 14 — empty breathing comes from emptyState, not outer pad
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
  // Manipulate here: empty-day breathing room inside the dashed “No items logged” band
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
