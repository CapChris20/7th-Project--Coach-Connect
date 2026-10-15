// One food row in a meal list: name, serving, calories, plus add or delete.
// Flow: scale calories by serving size → pick a serving label → paint the card → add or trash.
// Used by: MealCard on the daily nutrition log.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';

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
const TEXT_DARK = '#FFFFFF';
const TEXT_LIGHT = '#0A0A0F';
const MUTED_DARK = 'rgba(255,255,255,0.55)';
const MUTED_LIGHT = 'rgba(10,10,15,0.55)';
const CARD_BG_DARK = 'rgba(255,255,255,0.06)';
const CARD_BG_LIGHT = 'rgba(255,255,255,0.92)';
const BORDER_DARK = 'rgba(255,255,255,0.08)';
const BORDER_LIGHT = 'rgba(10,10,15,0.07)';
const ICON_COLOR_DARK = '#FF6B9D';
const ICON_COLOR_LIGHT = '#BE185D';
const DELETE_ICON_COLOR = '#EF4444';
const ADD_BORDER_DARK = 'rgba(255,255,255,0.15)';
const ADD_BORDER_LIGHT = 'rgba(10,10,15,0.15)';
const GRADIENT_DARK = ['rgba(255,107,157,0.18)', 'rgba(192,132,252,0.14)'];
const GRADIENT_LIGHT = ['rgba(255,107,157,0.12)', 'rgba(192,132,252,0.10)'];
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
 * Theme colors for this card. Dark mode uses faint glass; light mode uses an almost-solid white.
 * @param {boolean} isDark
 * @returns {object}
 */
function foodItemColors(isDark) {
  return {
    textColor: isDark ? TEXT_DARK : TEXT_LIGHT,
    textMuted: isDark ? MUTED_DARK : MUTED_LIGHT,
    cardBackground: isDark ? CARD_BG_DARK : CARD_BG_LIGHT,
    borderColor: isDark ? BORDER_DARK : BORDER_LIGHT,
    iconColor: isDark ? ICON_COLOR_DARK : ICON_COLOR_LIGHT,
    addBorderColor: isDark ? ADD_BORDER_DARK : ADD_BORDER_LIGHT,
    gradientColors: isDark ? GRADIENT_DARK : GRADIENT_LIGHT,
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
    borderWidth: 1,
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
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  serving: {
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  calLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
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
