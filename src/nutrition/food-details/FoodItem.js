// Design Law food row inside a meal card (nutrition PNG 01–04).
// Flow: name + serving on left → kcal on right → optional delete / add.
// Used by MealCard. compact = flat row (no GradientFrame) matching PNG list lines.
// Read order: constants → layout pieces → FoodItem numbered steps → styles.

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
const TRAILING_ICON_SIZE = 18;
const PRESS_OPACITY = 0.85;
const HIT_SLOP = 8;

// ===== HELPER FUNCTIONS =====

function buildServingSubtitle(food, servingSize) {
  // Package already wrote a human serving line — prefer it.
  if (food.serving_description) return food.serving_description;

  const portionIsBiggerThanOne = servingSize > DEFAULT_SERVING_SIZE;
  if (portionIsBiggerThanOne) {
    const unitWord = food.serving_unit || DEFAULT_SERVING_UNIT;
    const sizeText = servingSize.toFixed(SERVING_SIZE_DECIMALS);
    return `${sizeText} ${unitWord}`;
  }

  return food.serving_unit || SINGLE_SERVING_LABEL;
}

function buildSubtitleLine(food, servingSize) {
  // vocab: brand_name = FatSecret-style; brand = other search rows — same display idea
  const brandText = food.brand_name || food.brand;
  const subtitleParts = [buildServingSubtitle(food, servingSize)];
  if (brandText) subtitleParts.push(brandText);
  return subtitleParts.join(' · ');
}

function caloriesToShow(food, servingSize, compact) {
  const caloriesPerBaseServing = Number(food.calories) || 0;
  // Compact (logged) rows already store total kcal for the portion — do not multiply again.
  if (compact) return caloriesPerBaseServing;
  return caloriesPerBaseServing * servingSize;
}

function displayNameFromFoodRow(food) {
  return food.name || food.food_name || DEFAULT_FOOD_NAME;
}

function FoodItemTrailingButton({ showDelete, onDelete, onAdd, colors }) {
  if (showDelete) {
    return (
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => onDelete && onDelete()}
        hitSlop={HIT_SLOP}
        accessibilityLabel="Remove food"
      >
        <Ionicons name="close" size={TRAILING_ICON_SIZE} color={colors.nbMuted} />
      </TouchableOpacity>
    );
  }

  if (onAdd) {
    const addButtonStyle = [
      styles.addBtn,
      { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
    ];
    return (
      <TouchableOpacity
        style={addButtonStyle}
        onPress={() => onAdd && onAdd()}
        accessibilityLabel="Add food"
      >
        <Ionicons name="add" size={TRAILING_ICON_SIZE} color={colors.nbInk} />
      </TouchableOpacity>
    );
  }

  return null;
}

function FoodItemRowBody({
  displayName,
  subtitleLine,
  displayCalories,
  showDelete,
  onDelete,
  onAdd,
  compact,
  colors,
}) {
  const containerStyle = [styles.container, compact && styles.containerCompact];
  const roundedCalories = Math.round(displayCalories);

  return (
    <View style={containerStyle}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1} selectable>
          {displayName}
        </Text>
        <Text style={[styles.serving, { color: colors.nbMuted }]} numberOfLines={1} selectable>
          {subtitleLine}
        </Text>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.calNum, { color: colors.nbInk }]} selectable>
          {roundedCalories}
        </Text>
        <FoodItemTrailingButton
          showDelete={showDelete}
          onDelete={onDelete}
          onAdd={onAdd}
          colors={colors}
        />
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One food line inside a meal card — name, serving, calories, optional trash/add.
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
  // 1. Theme ink / muted for name, serving line, and icons.
  // vocab: useTheme = Design Law light/dark color bag
  const { colors } = useTheme();

  // 2. Serving size and calories — compact rows already store total kcal for the portion.
  const servingSize = food.servingSize || DEFAULT_SERVING_SIZE;
  const displayCalories = caloriesToShow(food, servingSize, compact);

  // 3. Title line and subtitle (serving text · optional brand).
  const displayName = displayNameFromFoodRow(food);
  const subtitleLine = buildSubtitleLine(food, servingSize);

  // 4. Row body — wrap in Pressable only when the parent wants detail navigation.
  const rowBody = (
    <FoodItemRowBody
      displayName={displayName}
      subtitleLine={subtitleLine}
      displayCalories={displayCalories}
      showDelete={showDelete}
      onDelete={onDelete}
      onAdd={onAdd}
      compact={compact}
      colors={colors}
    />
  );

  const userCanOpenDetails = typeof onPress === 'function';
  if (!userCanOpenDetails) return rowBody;

  // vocab: Pressable style callback gets { pressed } — dim slightly while the finger is down
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => {
        if (pressed) return { opacity: PRESS_OPACITY };
        return undefined;
      }}
    >
      {rowBody}
    </Pressable>
  );
}

// ===== PLUMBING — skip unless debugging =====
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
