// Today's logged foods as a searchable FlatList of FoodCards.
// Flow: parent foods (or demo bowl) → search filter → sticky header + kcal → one expanded card.
// Used by nutrition demos and daily-log embeds. FoodCard owns expand/collapse chrome.
// vocab: HardShadow = solid offset shadow chip (Design Law — no blur shadows)

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
import HardShadow from '../../look-and-feel/HardShadow';
import { lightColors, darkColors, borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: fixed US locale so the eyebrow always reads "Today · Mon Oct 8".
const WEEKDAY_FORMAT = { weekday: 'short' };
const MONTH_FORMAT = { month: 'short' };
const LOCALE_US = 'en-US';
const SEARCH_ICON_SIZE = 16;
const SEARCH_ICON_STROKE_WIDTH = 2;
const LIST_ROW_GAP = 10;
const SEARCH_PLACEHOLDER = 'Search logged foods…';
const SCREEN_TITLE = 'Nutrition';
const KCAL_LABEL = 'KCAL';

// ===== HELPER FUNCTIONS =====

// "Today · Mon Oct 8" for the eyebrow above the Nutrition title.
function formatTodayHeaderLine() {
  const now = new Date();
  const weekday = now.toLocaleDateString(LOCALE_US, WEEKDAY_FORMAT);
  const month = now.toLocaleDateString(LOCALE_US, MONTH_FORMAT);
  const dayOfMonth = now.getDate();
  return `Today · ${weekday} ${month} ${dayOfMonth}`;
}

// FlatList needs stable ids; missing ids become food-0, food-1, …
function foodRowWithListId(food, index) {
  const listId = food.id || `food-${index}`;
  return { ...food, id: listId };
}

function foodsOrDemoBowl(foods) {
  if (foods?.length) return foods;
  return [DEMO_YOGURT_BOWL];
}

// Empty search → full list; otherwise case-insensitive name match.
function filterFoodsForSearch(foods, searchText) {
  const sourceFoods = foodsOrDemoBowl(foods);
  const trimmedSearch = searchText.trim().toLowerCase();
  if (!trimmedSearch) {
    return sourceFoods.map(foodRowWithListId);
  }

  const matchingFoods = [];
  for (const food of sourceFoods) {
    const foodNameLower = String(food.name || '').toLowerCase();
    if (!foodNameLower.includes(trimmedSearch)) continue;
    matchingFoods.push(food);
  }
  return matchingFoods.map(foodRowWithListId);
}

function sumCaloriesFromFoodItems(foodItems) {
  let runningSum = 0;
  for (const food of foodItems) {
    runningSum += Number(food.calories) || 0;
  }
  return runningSum;
}

// Parent total wins when supplied so the header matches the rest of the nutrition tab.
function displayCalorieTotal(foodItems, parentTotalCalories) {
  if (parentTotalCalories != null) {
    return Math.round(parentTotalCalories);
  }
  return sumCaloriesFromFoodItems(foodItems);
}

// Design Law search field border — prefer food-card token, else theme border.
function searchFieldBorderColor() {
  const foodCardBorder = colors.cardBorder || colors.nbBorder;
  if (foodCardBorder) return foodCardBorder;
  return lightColors.nbBorder;
}

function themeInkColors(isDark) {
  if (isDark) return darkColors;
  return lightColors;
}

function nextExpandedFoodId(currentId, tappedFoodId) {
  if (currentId === tappedFoodId) return null;
  return tappedFoodId;
}

function FoodListRowGap() {
  return <View style={styles.separator} />;
}

function FoodListStickyHeader({ eyebrowLine, totalKcal }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.eyebrow}>{eyebrowLine}</Text>
        <Text style={styles.title}>{SCREEN_TITLE}</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.totalKcal}>{totalKcal}</Text>
        <Text style={styles.totalLabel}>{KCAL_LABEL}</Text>
      </View>
    </View>
  );
}

function FoodListSearchBar({ searchText, onSearchTextChange, isDark, inkColors }) {
  let surfaceColor = lightColors.nbSurface;
  if (isDark) {
    surfaceColor = darkColors.nbSurface;
  }
  const borderColor = searchFieldBorderColor();
  const searchFieldStyle = {
    backgroundColor: surfaceColor,
    borderWidth: nb.borderWidth,
    borderColor,
    borderRadius: borderRadius.nbCard,
  };
  const inputTextStyle = [styles.searchInput, { color: inkColors.nbInk }];

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.searchFrame}>
      <View style={searchFieldStyle}>
        <View style={styles.searchRow}>
          <Search
            size={SEARCH_ICON_SIZE}
            color={inkColors.nbMuted}
            strokeWidth={SEARCH_ICON_STROKE_WIDTH}
          />
          <TextInput
            value={searchText}
            onChangeText={onSearchTextChange}
            placeholder={SEARCH_PLACEHOLDER}
            placeholderTextColor={inkColors.nbMuted}
            style={inputTextStyle}
            returnKeyType="search"
          />
        </View>
      </View>
    </HardShadow>
  );
}

function FoodListScreenLayout({
  screenBackground,
  eyebrowLine,
  totalKcal,
  searchText,
  onSearchTextChange,
  isDark,
  inkColors,
  foodItems,
  renderFoodRow,
}) {
  const safeAreaStyle = [styles.safe, { backgroundColor: screenBackground }];

  return (
    <SafeAreaView style={safeAreaStyle} edges={SHELL_SAFE_AREA_EDGES}>
      <FoodListStickyHeader eyebrowLine={eyebrowLine} totalKcal={totalKcal} />
      <FoodListSearchBar
        searchText={searchText}
        onSearchTextChange={onSearchTextChange}
        isDark={isDark}
        inkColors={inkColors}
      />
      <FlatList
        data={foodItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderFoodRow}
        ItemSeparatorComponent={FoodListRowGap}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium nutrition list — FlatList of FoodCards with search and calorie total.
 * Flow: 1. filter rows  2. header kcal  3. toggle expand  4. paint layout
 */
export default function FoodListScreen({ foods, totalCalories }) {
  const { isDark } = useTheme();
  const inkColors = themeInkColors(isDark);
  const [expandedFoodId, setExpandedFoodId] = useState(null);
  const [searchText, setSearchText] = useState('');

  // 1. Derive visible rows from search + parent foods (or demo bowl).
  const foodItems = useMemo(
    () => filterFoodsForSearch(foods, searchText),
    [foods, searchText],
  );

  // 2. Header calorie total — parent prop wins when provided.
  const totalKcal = useMemo(
    () => displayCalorieTotal(foodItems, totalCalories),
    [foodItems, totalCalories],
  );
  const eyebrowLine = formatTodayHeaderLine();
  const screenBackground = inkColors.nbBackground;

  // 3. One expanded card at a time — tap open card to close, tap another to switch.
  const toggleExpandedFoodCard = useCallback((foodId) => {
    setExpandedFoodId((currentId) => nextExpandedFoodId(currentId, foodId));
  }, []);

  const renderFoodRow = useCallback(
    ({ item }) => {
      const cardIsExpanded = expandedFoodId === item.id;
      return (
        <FoodCard
          food={item}
          expanded={cardIsExpanded}
          onToggle={() => toggleExpandedFoodCard(item.id)}
        />
      );
    },
    [expandedFoodId, toggleExpandedFoodCard],
  );

  // 4. Paint sticky header + search + list.
  return (
    <FoodListScreenLayout
      screenBackground={screenBackground}
      eyebrowLine={eyebrowLine}
      totalKcal={totalKcal}
      searchText={searchText}
      onSearchTextChange={setSearchText}
      isDark={isDark}
      inkColors={inkColors}
      foodItems={foodItems}
      renderFoodRow={renderFoodRow}
    />
  );
}

// PLUMBING — skip unless debugging list chrome spacing.
const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
  searchFrame: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    height: LIST_ROW_GAP,
  },
});
