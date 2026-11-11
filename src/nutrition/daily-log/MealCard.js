// One meal section on the daily food log: title, items, Scan/Log buttons.
// Flow: sum calories → list FoodItems (or empty copy) → Scan (optional) + Log.
// Used by the daily nutrition log. mealKey is what the parent uses to know which meal was tapped.
// Redesigned with neobrutalist components: NbCard, NbButton, thick borders, hard shadows.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import FoodItem from '../food-details/FoodItem';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const EMPTY_CALORIES = 0;
const DEFAULT_SERVING_SIZE = 1;

// ===== HELPER FUNCTIONS =====

/**
 * Add every item's calories. Missing calories count as 0 so a bad row cannot NaN the header.
 * @param {Array} items
 * @returns {number}
 */
function totalMealCalories(items) {
  return items.reduce((sum, item) => sum + (item.calories || EMPTY_CALORIES), 0);
}

/**
 * FoodItem wants a flat card shape. Logs store macros on the row and/or in metadata.
 * @param {object} item
 * @returns {object}
 */
function foodCardFromLogItem(item) {
  return {
    name: item.food_name || item.metadata?.name,
    calories: Number(item.calories) || Number(item.metadata?.calories) || 0,
    protein: Number(item.protein) || Number(item.metadata?.protein) || 0,
    carbs: Number(item.carbs) || Number(item.metadata?.carbs) || 0,
    fat: Number(item.fat) || Number(item.metadata?.fat) || 0,
    servingSize: Number(item.serving_size) || DEFAULT_SERVING_SIZE,
    ...item.metadata,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Neobrutalist meal card with thick border, hard shadow, and NbButton actions.
 * vocab: NbCard = card with thick outline and offset shadow; NbButton = gradient or plain button.
 * @param {{ mealType: string, mealKey: string, items?: Array, onAddPress: Function, onDeleteItem: Function, onAddScanner?: Function }} props
 */
export default function MealCard({ mealType, mealKey, items = [], onAddPress, onDeleteItem, onAddScanner }) {
  const { isDark } = useTheme();
  const colors = isDark ? darkColors : lightColors;
  const styles = createStyles(colors);
  const hasItems = items.length > 0;
  const mealTotal = totalMealCalories(items);

  return (
    <NbCard style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.mealTitle} selectable={true}>{mealType}</Text>
        {hasItems && (
          <Text style={styles.mealTotal} selectable={true}>{Math.round(mealTotal)} kcal</Text>
        )}
      </View>

      {hasItems ? (
        <View style={styles.itemsList}>
          {items.map((item, index) => (
            <FoodItem
              key={item.id || index}
              food={foodCardFromLogItem(item)}
              onDelete={() => onDeleteItem(item)}
              showDelete
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText} selectable={true}>No items logged</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        {onAddScanner && (
          <NbButton
            variant="plain"
            sm
            onPress={() => onAddScanner(mealKey)}
            style={styles.actionButton}
          >
            Scan
          </NbButton>
        )}
        <NbButton
          variant="brand"
          sm
          onPress={() => onAddPress(mealKey)}
          style={styles.actionButton}
        >
          Log Food
        </NbButton>
      </View>
    </NbCard>
  );
}

// vocab: createStyles = factory function that injects theme colors into StyleSheet.create
const createStyles = (colors) =>
  StyleSheet.create({
    card: {
      padding: 16,
      marginBottom: 16,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    mealTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 18,
      color: colors.nbInk,
    },
    mealTotal: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      fontVariant: ['tabular-nums'],
    },
    itemsList: {
      marginBottom: 12,
    },
    emptyState: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: colors.nbMuted,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    actionButton: {
      flex: 1,
    },
  });
