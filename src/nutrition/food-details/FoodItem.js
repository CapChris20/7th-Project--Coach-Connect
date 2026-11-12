// Design Law food row inside a meal card (nutrition PNG 01–04).
// Flow: name + serving on left → kcal on right → optional delete / add.
// Used by MealCard. compact = flat row (no GradientFrame) matching PNG list lines.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_SERVING_SIZE = 1;
const DEFAULT_FOOD_NAME = 'Food Item';
const DEFAULT_SERVING_UNIT = 'serving';
const SINGLE_SERVING_LABEL = '1 serving';
const SERVING_SIZE_DECIMALS = 2;

// ===== HELPER FUNCTIONS =====

function servingLabel(food, servingSize) {
  if (food.serving_description) return food.serving_description;
  if (servingSize > DEFAULT_SERVING_SIZE) {
    return `${servingSize.toFixed(SERVING_SIZE_DECIMALS)} ${food.serving_unit || DEFAULT_SERVING_UNIT}`;
  }
  return food.serving_unit || SINGLE_SERVING_LABEL;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ food: object, onAdd?: Function, onDelete?: Function, onPress?: Function, showDelete?: boolean, compact?: boolean }} props
 */
export default function FoodItem({
  food,
  onAdd,
  onDelete,
  onPress,
  showDelete = false,
  compact = false,
}) {
  const { colors } = useTheme();

  const servingSize = food.servingSize || DEFAULT_SERVING_SIZE;
  const baseCalories = Number(food.calories) || 0;
  // Logged rows already store total calories for the portion — don't double-multiply when compact
  const totalCalories = compact ? baseCalories : baseCalories * servingSize;
  const brandText = food.brand_name || food.brand;
  const displayName = food.name || food.food_name || DEFAULT_FOOD_NAME;
  const subParts = [servingLabel(food, servingSize)];
  if (brandText) subParts.push(brandText);

  const body = (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1} selectable>
          {displayName}
        </Text>
        <Text style={[styles.serving, { color: colors.nbMuted }]} numberOfLines={1} selectable>
          {subParts.join(' · ')}
        </Text>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.calNum, { color: colors.nbInk }]} selectable>
          {Math.round(totalCalories)}
        </Text>

        {showDelete ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onDelete && onDelete()}
            hitSlop={8}
            accessibilityLabel="Remove food"
          >
            <Ionicons name="close" size={18} color={colors.nbMuted} />
          </TouchableOpacity>
        ) : onAdd ? (
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
            onPress={() => onAdd && onAdd()}
            accessibilityLabel="Add food"
          >
            <Ionicons name="add" size={18} color={colors.nbInk} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  if (typeof onPress === 'function') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {body}
      </Pressable>
    );
  }

  return body;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    gap: 10,
  },
  containerCompact: {
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    marginBottom: 2,
  },
  serving: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  calNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
