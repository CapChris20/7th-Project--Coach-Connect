// Today's logged foods as a searchable list of FoodCards.
// Flow: pick foods (or the demo bowl) → filter by the search box → sticky header + calorie total + cards.
// Used by the nutrition tab. FoodCard owns expand/collapse; this screen only tracks which id is open.

import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { Search } from 'lucide-react-native';
import FoodCard from './FoodCard';
import { colors, fonts } from './foodCardColors';
import { DEMO_YOGURT_BOWL } from './foodCardText';

// ===== NAMED CONSTANTS =====

const WEEKDAY_FORMAT = { weekday: 'short' };
const MONTH_FORMAT = { month: 'short' };
const LOCALE_US = 'en-US';
const SEARCH_ICON_SIZE = 16;
const SEARCH_ICON_STROKE_WIDTH = 2;

// ===== HELPER FUNCTIONS =====

/**
 * "Today · Mon Oct 8" for the eyebrow above the Nutrition title.
 * Device locale is ignored on purpose so the header always looks the same.
 * @returns {string}
 */
function formatTodayHeader() {
  const now = new Date();
  const weekday = now.toLocaleDateString(LOCALE_US, WEEKDAY_FORMAT);
  const month = now.toLocaleDateString(LOCALE_US, MONTH_FORMAT);
  const dayOfMonth = now.getDate();
  return `Today · ${weekday} ${month} ${dayOfMonth}`;
}

/**
 * Every row needs an id for FlatList. Missing ids get food-0, food-1, …
 * @param {object} food
 * @param {number} index
 * @returns {object}
 */
function foodWithListId(food, index) {
  return { ...food, id: food.id || `food-${index}` };
}

/**
 * Empty search shows the full list. Match is case-insensitive on the food name.
 * @param {Array} foods
 * @param {string} searchText
 * @returns {Array}
 */
function foodsMatchingSearch(foods, searchText) {
  const baseFoods = foods?.length ? foods : [DEMO_YOGURT_BOWL];
  const trimmedSearch = searchText.trim().toLowerCase();
  if (!trimmedSearch) return baseFoods.map(foodWithListId);
  return baseFoods
    .filter((food) => String(food.name || '').toLowerCase().includes(trimmedSearch))
    .map(foodWithListId);
}

/**
 * Prefer the parent-supplied total so the header matches the rest of the nutrition tab.
 * @param {Array} foodItems
 * @param {number|null|undefined} totalCalories
 * @returns {number}
 */
function roundedCalorieTotal(foodItems, totalCalories) {
  if (totalCalories != null) return Math.round(totalCalories);
  return foodItems.reduce((sum, food) => sum + (Number(food.calories) || 0), 0);
}

// ===== MAIN FUNCTION =====

/**
 * Premium nutrition list — FlatList of FoodCards with a search box and calorie total.
 * @param {{ foods?: Array, totalCalories?: number }} props
 */
export default function FoodListScreen({ foods, totalCalories }) {
  const [expandedId, setExpandedId] = useState(null);
  const [searchText, setSearchText] = useState('');

  const foodItems = useMemo(
    () => foodsMatchingSearch(foods, searchText),
    [foods, searchText],
  );

  const totalKcal = useMemo(
    () => roundedCalorieTotal(foodItems, totalCalories),
    [foodItems, totalCalories],
  );

  // Tapping the open card closes it; tapping another opens that one instead.
  const renderItem = useCallback(
    ({ item }) => (
      <FoodCard
        food={item}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId((currentId) => (currentId === item.id ? null : item.id))}
      />
    ),
    [expandedId],
  );

  return (
    <SafeAreaView style={styles.safe} edges={SHELL_SAFE_AREA_EDGES}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>{formatTodayHeader()}</Text>
          <Text style={styles.title}>Nutrition</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.totalKcal}>{totalKcal}</Text>
          <Text style={styles.totalLabel}>KCAL</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Search size={SEARCH_ICON_SIZE} color={colors.subtle} strokeWidth={SEARCH_ICON_STROKE_WIDTH} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search logged foods…"
          placeholderTextColor={colors.subtle}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={foodItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerLeft: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.subtle,
    textTransform: 'uppercase',
    letterSpacing: 1.8,
  },
  title: {
    marginTop: 4,
    fontSize: 28,
    fontFamily: fonts.semiBold,
    color: colors.foreground,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  totalKcal: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  totalLabel: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.subtle,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.foreground,
    padding: 0,
    ...Platform.select({ web: { outlineStyle: 'none' } }),
  },
  listContent: {
    padding: 20,
    paddingBottom: 96,
  },
  separator: {
    height: 10,
  },
});
