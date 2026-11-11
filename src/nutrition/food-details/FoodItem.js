// One food row in a meal list: name, serving, calories, plus add or delete.
// Flow: scale calories by serving size → pick a serving label → paint the card → add or trash.
// Used by: MealCard on the daily nutrition log.
// Redesigned with neobrutalist tokens and NbListRow styling.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, nb, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_SERVING_SIZE = 1;
const DEFAULT_FOOD_NAME = 'Food Item';
const DEFAULT_SERVING_UNIT = 'serving';
const SINGLE_SERVING_LABEL = '1 serving';
const SERVING_SIZE_DECIMALS = 2;
const CALORIE_UNIT_LABEL = 'cal';
const ICON_RESTAURANT = 'restaurant-outline';
const ICON_TRASH = 'trash-outline';
const ICON_ADD = 'add';
const DELETE_ICON_COLOR = '#EF4444';
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * FatSecret-style serving copy, or "2.00 serving" when the count is not 1.
 * @param {object} food
 * @param {number} servingSize
 * @returns {string}
 */
function servingLabel(food, servingSize) {
  if (food.serving_description) return food.serving_description;
  if (servingSize > DEFAULT_SERVING_SIZE) {
    return `${servingSize.toFixed(SERVING_SIZE_DECIMALS)} ${food.serving_unit || DEFAULT_SERVING_UNIT}`;
  }
  return food.serving_unit || SINGLE_SERVING_LABEL;
}

/**
 * Neobrutalist color tokens for dark vs light mode.
 * vocab: nb tokens = thick borders, hard shadows, gradient accents.
 * @param {boolean} isDark
 * @returns {object}
 */
function foodItemColors(isDark) {
  const colors = isDark ? darkColors : lightColors;
  return {
    textColor: colors.nbInk,
    textMuted: colors.nbMuted,
    cardBackground: colors.nbSurface,
    borderColor: colors.nbBorder,
    iconColor: gradients.brand.colors[0],
    addBorderColor: colors.nbBorder,
    gradientColors: gradients.soft.colors,
  };
}

// ===== MAIN FUNCTION =====

/**
 * One logged (or search-result) food row with calories and an add or delete control.
 * @param {{ food: object, onAdd?: Function, onDelete?: Function, showDelete?: boolean }} props
 */
export default function FoodItem({ food, onAdd, onDelete, showDelete = false }) {
  const { isDark } = useTheme();
  const colors = foodItemColors(isDark);

  const servingSize = food.servingSize || DEFAULT_SERVING_SIZE;
  const baseCalories = Number(food.calories) || 0;
  const totalCalories = baseCalories * servingSize;
  const brandText = food.brand_name || food.brand;
  const displayName = food.name || food.food_name || DEFAULT_FOOD_NAME;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
      <View style={styles.leftSection}>
        <LinearGradient
          colors={colors.gradientColors}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.iconBox}
        >
          <Ionicons name={ICON_RESTAURANT} size={20} color={colors.iconColor} />
        </LinearGradient>

        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.textColor }]} numberOfLines={1} selectable={true}>
            {displayName}
          </Text>
          <Text style={[styles.serving, { color: colors.textMuted }]} selectable={true}>
            {servingLabel(food, servingSize)}
            {brandText ? ` · ${brandText}` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <View style={styles.calBlock}>
          <Text style={[styles.calNum, { color: colors.textColor }]} selectable={true}>
            {Math.round(totalCalories)}
          </Text>
          <Text style={[styles.calLabel, { color: colors.textMuted }]}>{CALORIE_UNIT_LABEL}</Text>
        </View>

        {showDelete ? (
          <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete && onDelete()}>
            <Ionicons name={ICON_TRASH} size={16} color={DELETE_ICON_COLOR} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.addBorderColor }]}
            onPress={() => onAdd && onAdd()}
          >
            <Ionicons name={ICON_ADD} size={18} color={colors.iconColor} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: nb.borderWidth,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    marginBottom: 3,
  },
  serving: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  calBlock: {
    alignItems: 'flex-end',
  },
  calNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  calLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    letterSpacing: 0.4,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
