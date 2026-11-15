// Design Law “Add food” search (PNG 05–08): header → field → Scan|Quick add → segment → card → basket.
// Flow: debounce search → normalize hits → Results/Favorites/Recent → toggle basket → ConfirmFoodPopup → logFood.
// Used by DailyLogContent (embedded + reserveShellBottomNav). Props wire barcode / quick-add into the parent shell.
// Read order: constants → row/empty UI → normalize helpers → FoodSearchScreen → PLUMBING styles.
//
// vocab: HardShadow = solid offset shadow (no blur); nbFill = selected / primary solid (black light, white dark)
// vocab: basket = foods toggled with +; Log-to-Meal opens ConfirmFoodPopup sequentially for each pick
// KEEP food-card keys: name, food_name, brand, servingSize, calories, protein, carbs, fat, …

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchFoods, getRecentFoods, getFoodSearchHint, getFavoriteFoods } from '../daily-log/saveLoggedFood';
import { resolveFoodBrandLabel } from '../food-details/tidyBrandName';
import { cleanSerperFoodTitle, isJunkWebSearchTitle } from '../food-search/tidyFoodTitles';
import { formatServingDisplayLine } from '../food-search/guessServingLabel';
import FoodConfirmSheet from '../food-search/ConfirmFoodPopup';
import { auth } from '../../app-start/cloudConnection';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: debounce / auto-search thresholds
const SEARCH_DEBOUNCE_MS = 550;
const MIN_CHARS_AUTO_SEARCH = 2;
const RECENT_FOODS_LIMIT = 15;
const SEARCH_RESULT_LIMIT = 20;
const SHELL_BOTTOM_INSET_EXTRA = 16;
const DEFAULT_LIST_BOTTOM_EXTRA = 32;
const MIN_SAFE_BOTTOM = 12;
const DEFAULT_SERVING_GRAMS = 100;
// Manipulate here: floating basket clearance above the shell dock (PNG floats above Nutrition tab)
const BASKET_ABOVE_DOCK_GAP = 10;
const BASKET_CLEARANCE = 72;
const NEXT_BASKET_ITEM_DELAY_MS = 180;
const SCALES_ICON = require('../../assets/icons/handoff/scales.png');

// Manipulate here: quick-pick chip labels (PNG 07/08 empty state)
const QUICK_PICKS = ['Greek Yogurt', 'Salmon', 'Oatmeal', 'Chicken Breast', 'Brown Rice', 'Avocado'];
const BROWSE_SEGMENTS = [{
  id: 'results',
  label: 'Search results'
}, {
  id: 'favorites',
  label: 'Favorites'
}, {
  id: 'recent',
  label: 'Recent'
}];
const BROWSE_TAB_RESULTS = 'results';
const BROWSE_TAB_FAVORITES = 'favorites';
const BROWSE_TAB_RECENT = 'recent';

// Manipulate here: soft disc copy under the results card (PNG 05/06 `.disc`)
const DISCLAIMER_COPY = 'Search packaged foods, restaurants, and groceries. Nutrition data comes from public databases and can be off. Check the label when it matters.';
const GENERIC_UNIT_PATTERN = /^(serving|portion|each|g|gram|grams|ml)$/i;

// ===== HELPER FUNCTIONS =====

function mealTypeAsTitle(mealType) {
  const mealKey = String(mealType || 'meal');
  return mealKey.charAt(0).toUpperCase() + mealKey.slice(1).toLowerCase();
}

// Household serving text when the API only gave a unit (not "serving"/"g").
function portionTextFromServingUnit(item) {
  const servingUnit = String(item.serving_unit || item.servingUnit || '').trim();
  if (!servingUnit) return null;
  if (GENERIC_UNIT_PATTERN.test(servingUnit)) return null;
  return servingUnit;
}
function roundMacroNumber(value) {
  if (value == null) return Math.round(0);
  return Math.round(value);
}

/**
 * Metadata object from a search hit when it is a plain object.
 * @param {object|null|undefined} item
 * @returns {object}
 */
function metadataBagFromItem(item) {
  if (!item) return {};
  const metadata = item.metadata;
  if (!metadata) return {};
  if (typeof metadata !== 'object') return {};
  return metadata;
}

/**
 * Portion / serving label text from item fields or nested metadata.
 * @param {object} item
 * @param {object} metadataBag
 * @returns {*}
 */
function portionTextFromItem(item, metadataBag) {
  if (item.serving_label) return item.serving_label;
  if (item.servingLabel) return item.servingLabel;
  if (item.householdServingFullText) return item.householdServingFullText;
  if (metadataBag.serving_label) return metadataBag.serving_label;
  if (metadataBag.servingLabel) return metadataBag.servingLabel;
  if (metadataBag.householdServingFullText) return metadataBag.householdServingFullText;
  return portionTextFromServingUnit(item);
}

/**
 * Display name from API name / food_name / description.
 * @param {object} item
 * @returns {string}
 */
function nameFromApiItem(item) {
  if (item.name) return item.name;
  if (item.food_name) return item.food_name;
  if (item.description) return item.description;
  return 'Unknown Food';
}

/**
 * Brand string from any frozen brand alias.
 * @param {object} item
 * @returns {string}
 */
function explicitBrandFromItem(item) {
  if (item.brand) return item.brand;
  if (item.brand_name) return item.brand_name;
  if (item.brand_owner) return item.brand_owner;
  if (item.brandOwner) return item.brandOwner;
  return '';
}

/**
 * Macro number preferring camelCase then Nutritionix nf_ key.
 * @param {object} item
 * @param {string} camelKey
 * @param {string} nfKey
 * @returns {number}
 */
function macroFromItem(item, camelKey, nfKey) {
  if (item[camelKey] != null) return roundMacroNumber(item[camelKey]);
  return roundMacroNumber(item[nfKey]);
}

function pickFoodServingSize(item) {
  if (item.servingSize) return item.servingSize;
  if (item.serving_qty) return item.serving_qty;
  if (item.serving_size) return item.serving_size;
  return 1;
}

function pickFoodServingUnit(item) {
  if (item.servingUnit) return item.servingUnit;
  if (item.serving_unit) return item.serving_unit;
  if (item.servingSizeUnit) return item.servingSizeUnit;
  return 'serving';
}

function pickFoodServingGrams(item) {
  if (item.servingGrams) return item.servingGrams;
  if (item.serving_weight_grams) return item.serving_weight_grams;
  if (item.serving_grams) return item.serving_grams;
  return DEFAULT_SERVING_GRAMS;
}

function pickFoodServingSizeSnake(item) {
  if (item.serving_qty) return item.serving_qty;
  if (item.servingSize) return item.servingSize;
  return 1;
}

function pickFoodServingUnitSnake(item) {
  if (item.serving_unit) return item.serving_unit;
  if (item.servingUnit) return item.servingUnit;
  return 'serving';
}

function pickFoodServingGramsSnake(item) {
  if (item.serving_weight_grams) return item.serving_weight_grams;
  if (item.servingGrams) return item.servingGrams;
  return DEFAULT_SERVING_GRAMS;
}

function pickFoodServingLabel(item) {
  if (item.serving_label) return item.serving_label;
  if (item.servingLabel) return item.servingLabel;
  if (item.householdServingFullText) return item.householdServingFullText;
  return null;
}

// Flatten a search / recent / favorite hit for ConfirmFoodPopup and logFood (camelCase + snake_case keys).
function normalizeFood(item, searchQuery = '') {
  const metadataBag = metadataBagFromItem(item);
  const portion_text = portionTextFromItem(item, metadataBag);
  const nameFromApi = nameFromApiItem(item);
  const isWebSearchSource = item.source === 'serper' || item.source === 'mixed';
  const shouldTidyWebTitle = isWebSearchSource && Boolean(searchQuery);
  let foodName = nameFromApi;
  if (shouldTidyWebTitle) {
    foodName = cleanSerperFoodTitle(nameFromApi, searchQuery);
  }
  const explicitBrand = explicitBrandFromItem(item);
  const brandLabel = resolveFoodBrandLabel(foodName, explicitBrand);

  const servingSize = pickFoodServingSize(item);
  const servingUnit = pickFoodServingUnit(item);
  const servingGrams = pickFoodServingGrams(item);
  const servingSizeSnake = pickFoodServingSizeSnake(item);
  const servingUnitSnake = pickFoodServingUnitSnake(item);
  const servingGramsSnake = pickFoodServingGramsSnake(item);
  const servingLabel = pickFoodServingLabel(item);

  let servingMultiplier = null;
  if (item.servingMultiplier != null) servingMultiplier = item.servingMultiplier;

  return {
    name: foodName,
    brand: brandLabel,
    servingSize,
    servingUnit,
    servingGrams,
    calories: macroFromItem(item, 'calories', 'nf_calories'),
    protein: macroFromItem(item, 'protein', 'nf_protein'),
    carbs: macroFromItem(item, 'carbs', 'nf_total_carbohydrate'),
    fat: macroFromItem(item, 'fat', 'nf_total_fat'),
    fiber: macroFromItem(item, 'fiber', 'nf_dietary_fiber'),
    sugar: macroFromItem(item, 'sugar', 'nf_sugars'),
    sodium: macroFromItem(item, 'sodium', 'nf_sodium'),
    source: item.source || 'server',
    nutrition_unverified: Boolean(item.nutrition_unverified),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier,
    food_name: foodName,
    brand_name: brandLabel,
    serving_size: servingSizeSnake,
    serving_unit: servingUnitSnake,
    serving_grams: servingGramsSnake,
    serving_label: servingLabel,
    portion_text,
    metadata: item,
  };
}

/**
 * matchedQuery nested under item.metadata when present.
 * @param {object|null|undefined} item
 * @returns {string}
 */
function matchedQueryFromItem(item) {
  if (!item) return '';
  const metadata = item.metadata;
  if (!metadata) return '';
  if (!metadata.matchedQuery) return '';
  return metadata.matchedQuery;
}

function formatServingLine(item, userQuery = '') {
  const matchedQuery = matchedQueryFromItem(item);
  const queryForServing = userQuery || matchedQuery;
  return formatServingDisplayLine(item, queryForServing);
}

/**
 * Macro grams from a favorite’s macros bag.
 * @param {object|null|undefined} favorite
 * @param {string} macroKey
 * @returns {*}
 */
function favoriteMacro(favorite, macroKey) {
  if (!favorite) return undefined;
  const macros = favorite.macros;
  if (!macros) return undefined;
  return macros[macroKey];
}

function normalizeFavoriteRow(favorite) {
  return normalizeFood({
    id: favorite.foodId,
    name: favorite.foodName,
    food_name: favorite.foodName,
    calories: favorite.calories,
    protein: favoriteMacro(favorite, 'protein'),
    carbs: favoriteMacro(favorite, 'carbs'),
    fat: favoriteMacro(favorite, 'fat'),
    brand: favorite.brand,
  });
}

/**
 * Title string from a raw search hit for junk-title filtering.
 * @param {object|null|undefined} item
 * @returns {string}
 */
function titleFromSearchHit(item) {
  if (!item) return '';
  if (item.name) return item.name;
  if (item.food_name) return item.food_name;
  return '';
}

function normalizeSearchHits(rawHits, trimmedQuery) {
  const safeHits = rawHits || [];
  const cleanedHits = [];
  for (let index = 0; index < safeHits.length; index += 1) {
    const item = safeHits[index];
    const title = titleFromSearchHit(item);
    if (isJunkWebSearchTitle(title)) continue;
    cleanedHits.push(normalizeFood(item, trimmedQuery));
  }
  return cleanedHits;
}
function rowMetaLine(item, query) {
  const brand = String(item.brand || item.brand_name || '').trim() || 'Generic';
  const serving = formatServingLine(item, query);
  if (serving) return `${brand} · ${serving}`;
  return brand;
}

/**
 * Stable id piece for a list row key.
 * @param {object|null|undefined} item
 * @param {number} index
 * @returns {*}
 */
function idPieceFromItem(item, index) {
  if (!item) return index;
  if (item.id) return item.id;
  if (item.food_id) return item.food_id;
  if (item.name) return item.name;
  if (item.food_name) return item.food_name;
  return index;
}

function rowKey(item, index, listKey) {
  const id = idPieceFromItem(item, index);
  return `${listKey}-${id}-${index}`;
}
function foodRowId(item) {
  const idPiece = idPieceFromItem(item, '');
  return String(idPiece || '').trim().toLowerCase();
}

/**
 * Call an optional press handler when it is a function.
 * @param {Function|undefined|null} handler
 * @param {*} [argument]
 */
function callIfFunction(handler, argument) {
  if (typeof handler !== 'function') return;
  if (argument === undefined) {
    handler();
    return;
  }
  handler(argument);
}

/**
 * True when the query string has non-whitespace characters.
 * @param {string|null|undefined} query
 * @returns {boolean}
 */
function queryHasTypedText(query) {
  if (!query) return false;
  return Boolean(query.trim());
}

/**
 * Initial browse tab — Results when the screen opened with a seed query.
 * @param {string|null|undefined} initialQuery
 * @returns {string}
 */
function initialBrowseTab(initialQuery) {
  if (queryHasTypedText(initialQuery)) return BROWSE_TAB_RESULTS;
  return BROWSE_TAB_RECENT;
}

/**
 * Signed-in uid from prop or Firebase auth.currentUser.
 * @param {string|null|undefined} userId
 * @returns {string|undefined}
 */
function resolveSignedInUid(userId) {
  if (userId) return userId;
  const currentUser = auth.currentUser;
  if (!currentUser) return undefined;
  return currentUser.uid;
}
function browseListForTab(browseTab, favoriteFoods, recentFoods, results) {
  if (browseTab === BROWSE_TAB_FAVORITES) {
    return {
      listData: favoriteFoods,
      listKey: BROWSE_TAB_FAVORITES
    };
  }
  if (browseTab === BROWSE_TAB_RECENT) {
    return {
      listData: recentFoods,
      listKey: BROWSE_TAB_RECENT
    };
  }
  return {
    listData: results,
    listKey: BROWSE_TAB_RESULTS
  };
}
function shouldShowEmptyBrowseState({
  loading,
  browseTab,
  hasSearched,
  results,
  recentFoods,
  favoriteFoods
}) {
  if (loading) return false;
  const onResultsTab = browseTab === BROWSE_TAB_RESULTS;
  const onRecentTab = browseTab === BROWSE_TAB_RECENT;
  const onFavoritesTab = browseTab === BROWSE_TAB_FAVORITES;
  if (onResultsTab && hasSearched && results.length === 0) return true;
  if (onRecentTab && recentFoods.length === 0 && !hasSearched) return true;
  if (onFavoritesTab && favoriteFoods.length === 0) return true;
  if (onResultsTab && !hasSearched && results.length === 0 && recentFoods.length === 0) {
    return true;
  }
  return false;
}
function sumBasketCalories(basketFoods) {
  let totalCalories = 0;
  for (let index = 0; index < basketFoods.length; index += 1) {
    totalCalories += Number(basketFoods[index].calories) || 0;
  }
  return totalCalories;
}
function foodIsInBasket(basketFoods, food) {
  const foodId = foodRowId(food);
  for (let index = 0; index < basketFoods.length; index += 1) {
    if (foodRowId(basketFoods[index]) === foodId) return true;
  }
  return false;
}
function removeFoodFromBasket(basketFoods, foodId) {
  const remaining = [];
  for (let index = 0; index < basketFoods.length; index += 1) {
    if (foodRowId(basketFoods[index]) !== foodId) {
      remaining.push(basketFoods[index]);
    }
  }
  return remaining;
}

// ===== UI PIECES (PNG) =====

// PNG result row: bold name · muted brand·serving · bold kcal · 44² + (selected = nbFill).
function FoodResultRow({
  item,
  onToggle,
  selected = false,
  colors,
  query = '',
  showDivider = false
}) {
  const title = item.name || item.food_name || 'Food';
  const metaLine = rowMetaLine(item, query);
  const calorieLabel = Math.round(Number(item.calories) || 0);
  let rowBorderStyle;
  if (showDivider) {
    rowBorderStyle = {
      borderTopWidth: nb.borderWidthDivider,
      borderTopColor: colors.nbBorder
    };
  } else {
    rowBorderStyle = null;
  }
  let addButtonBackground;
  if (selected) {
    addButtonBackground = colors.nbFill;
  } else {
    addButtonBackground = colors.nbSurfaceChip;
  }
  let addIconColor;
  if (selected) {
    addIconColor = colors.nbOnFill;
  } else {
    addIconColor = colors.nbInk;
  }
  let accessibilityLabel;
  if (selected) {
    accessibilityLabel = `Remove ${title}`;
  } else {
    accessibilityLabel = `Add ${title}`;
  }
  return <View style={[rowStyles.row, rowBorderStyle]}>
      <View style={rowStyles.grow}>
        <Text style={[rowStyles.title, {
        color: colors.nbInk
      }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[rowStyles.meta, {
        color: colors.nbMuted
      }]} numberOfLines={1}>
          {metaLine}
        </Text>
      </View>
      <Text style={[rowStyles.kcal, {
      color: colors.nbInk
    }]}>{calorieLabel}</Text>
      {/* PNG: selected + = solid fill + onFill glyph; unselected = surface chip */}
      <TouchableOpacity onPress={() => onToggle(item)} accessibilityRole="button" accessibilityState={{
      selected
    }} accessibilityLabel={accessibilityLabel} style={[rowStyles.addSq, {
      borderColor: colors.nbBorder,
      backgroundColor: addButtonBackground
    }]} activeOpacity={0.88}>
        <Ionicons name="add" size={20} color={addIconColor} />
      </TouchableOpacity>
    </View>;
}
function SoftDisclaimer({
  colors
}) {
  return <View accessibilityRole="summary" accessibilityLabel="Nutrition data accuracy notice" style={[discStyles.box, {
    backgroundColor: colors.nbSoft,
    borderColor: colors.nbBorder
  }]}>
      <Text style={[discStyles.text, {
      color: colors.nbMuted
    }]}>{DISCLAIMER_COPY}</Text>
    </View>;
}
function EmptyState({
  query,
  onSuggestionPress,
  onQuickAdd,
  colors,
  hint
}) {
  const typedSomething = queryHasTypedText(query);
  let kickerText = 'START TYPING';
  let titleText = 'What are you eating?';
  let subtitleText = 'Search packaged foods, restaurants, and groceries.';
  if (typedSomething) {
    kickerText = 'NO MATCHES';
    titleText = `Nothing for "${query}"`;
    subtitleText = hint || 'Try a shorter name or a brand.';
  }
  const showQuickAddCta = typedSomething && typeof onQuickAdd === 'function';

  // Build quick-pick chips without .map in the layout recipe.
  const quickPickChips = [];
  for (let index = 0; index < QUICK_PICKS.length; index += 1) {
    const label = QUICK_PICKS[index];
    quickPickChips.push(
      <Pressable
        key={label}
        onPress={() => callIfFunction(onSuggestionPress, label)}
        accessibilityRole="button"
        accessibilityLabel={`Search ${label}`}
        style={[empty.chip, {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurfaceChip,
        }]}
      >
        <Ionicons name="add" size={18} color={colors.nbInk} />
        <Text style={[empty.chipLabel, { color: colors.nbInk }]} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>,
    );
  }

  return <View style={empty.wrap}>
      <View style={[empty.card, {
      borderColor: colors.nbBorder
    }]}>
        <Text style={[empty.kicker, {
        color: colors.nbMuted
      }]}>{kickerText}</Text>
        <Text style={[empty.title, {
        color: colors.nbInk
      }]}>{titleText}</Text>
        <Text style={[empty.subtitle, {
        color: colors.nbMuted
      }]}>{subtitleText}</Text>
        {showQuickAddCta ? <View style={empty.ctaWrap}>
            <NbButton variant="ghost" onPress={onQuickAdd}>
              Quick add instead
            </NbButton>
          </View> : null}
      </View>

      {/* Quick picks — PNG chips that seed the search field */}
      <Text style={[empty.sectionLabel, {
      color: colors.nbMuted
    }]}>QUICK PICKS</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={empty.chipRow}>
        {quickPickChips}
      </ScrollView>
    </View>;
}
function SearchFieldBlock({
  query,
  colors,
  onChangeText,
  onSubmitSearch,
  onClearSearch
}) {
  const showClearButton = query.length > 0;
  return <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbInput} style={styles.searchShadow}>
      <View style={[styles.searchInner, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        <TextInput style={[styles.searchInput, {
        color: colors.nbInk
      }]} placeholder="What are you eating?" placeholderTextColor={colors.nbMuted} value={query} onChangeText={onChangeText} autoFocus returnKeyType="search" onSubmitEditing={onSubmitSearch} accessibilityLabel="Search foods" accessibilityHint="Search by food name, brand, or restaurant" />
        {showClearButton ? <TouchableOpacity onPress={onClearSearch} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{
        top: 8,
        bottom: 8,
        left: 8,
        right: 8
      }}>
            <Ionicons name="close" size={18} color={colors.nbMuted} />
          </TouchableOpacity> : null}
      </View>
    </HardShadow>;
}
function ScanAndQuickAddRow({
  colors,
  onOpenBarcode,
  onOpenQuickAdd
}) {
  const barcodeEnabled = typeof onOpenBarcode === 'function';
  const quickAddEnabled = typeof onOpenQuickAdd === 'function';
  let barcodeOpacity;
  if (barcodeEnabled) {
    barcodeOpacity = 1;
  } else {
    barcodeOpacity = 0.45;
  }
  let quickAddOpacity;
  if (quickAddEnabled) {
    quickAddOpacity = 1;
  } else {
    quickAddOpacity = 0.45;
  }
  return <View style={styles.actionRow}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton} style={styles.actionHalf}>
        <TouchableOpacity onPress={() => callIfFunction(onOpenBarcode)} disabled={!barcodeEnabled} accessibilityRole="button" accessibilityLabel="Scan barcode" style={[styles.actionBtn, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSurface,
        opacity: barcodeOpacity
      }]} activeOpacity={0.88}>
          {/* Manipulate here: scales chip size — keep small; accentGradients only on this chip */}
          <NbIconChip source={SCALES_ICON} size={36} index={1} />
          <Text style={[styles.actionLabel, {
          color: colors.nbInk
        }]} numberOfLines={1}>
            Scan barcode
          </Text>
        </TouchableOpacity>
      </HardShadow>
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton} style={styles.actionHalf}>
        <TouchableOpacity onPress={() => callIfFunction(onOpenQuickAdd)} disabled={!quickAddEnabled} accessibilityRole="button" accessibilityLabel="Quick add" style={[styles.actionBtn, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSurface,
        opacity: quickAddOpacity
      }]} activeOpacity={0.88}>
          <Text style={[styles.actionLabel, {
          color: colors.nbInk
        }]} numberOfLines={1}>
            Quick add
          </Text>
        </TouchableOpacity>
      </HardShadow>
    </View>;
}
function FloatingBasketBar({
  basket,
  basketKcal,
  basketBottom,
  isDark,
  colors,
  mealSubtitle,
  onLogBasket
}) {
  const foodWord = basket.length === 1 ? 'food' : 'foods';
  let pillBackground;
  if (isDark) {
    pillBackground = colors.nbSoft;
  } else {
    pillBackground = colors.nbFill;
  }
  let countColor;
  if (isDark) {
    countColor = colors.nbInk;
  } else {
    countColor = colors.nbOnFill;
  }
  let kcalColor;
  if (isDark) {
    kcalColor = colors.nbMuted;
  } else {
    kcalColor = colors.nbOnFill;
  }
  let ctaBackground;
  if (isDark) {
    ctaBackground = colors.nbFill;
  } else {
    ctaBackground = colors.nbOnFill;
  }
  let ctaTextColor;
  if (isDark) {
    ctaTextColor = colors.nbOnFill;
  } else {
    ctaTextColor = colors.nbFill;
  }
  return <View style={[styles.basketWrap, {
    bottom: basketBottom
  }]} pointerEvents="box-none">
      {/* PNG 05 light = fill bar + onFill CTA; PNG 06 dark = soft bar + fill CTA */}
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View style={[styles.basketPill, {
        backgroundColor: pillBackground,
        borderColor: colors.nbBorder
      }]}>
          <View style={styles.basketGrow}>
            <Text style={[styles.basketCount, {
            color: countColor
          }]}>
              {basket.length} {foodWord}
            </Text>
            <Text style={[styles.basketKcal, {
            color: kcalColor
          }]}>
              {basketKcal.toLocaleString()} kcal
            </Text>
          </View>
          <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton}>
            <TouchableOpacity onPress={onLogBasket} style={[styles.basketCta, {
            backgroundColor: ctaBackground,
            borderColor: colors.nbBorder,
            borderWidth: nb.borderWidth
          }]} activeOpacity={0.9} accessibilityRole="button" accessibilityLabel={`Log to ${mealSubtitle}`}>
              <Text style={[styles.basketCtaText, {
              color: ctaTextColor
            }]}>
                Log to {mealSubtitle}
              </Text>
            </TouchableOpacity>
          </HardShadow>
        </View>
      </HardShadow>
    </View>;
}

// ===== MAIN FUNCTION =====

function FoodSearchScreen({
  mealType: mealTypeProp,
  defaultMeal,
  onFoodSelected,
  /** @deprecated use onFoodSelected — kept for LogTodaysMealsScreen alias */
  onSelectFood,
  onClose,
  onOpenBarcode,
  onOpenQuickAdd,
  userId,
  embedded = false,
  reserveShellBottomNav = false,
  initialQuery = ''
}) {
  // vocab: useTheme = Design Law light/dark tokens (nbBackground, nbInk, nbFill, …)
  const {
    isDark,
    colors
  } = useTheme();
  const insets = useSafeAreaInsets();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const mealType = useMemo(() => String(mealTypeProp || defaultMeal || 'breakfast').toLowerCase(), [mealTypeProp, defaultMeal]);
  const mealSubtitle = mealTypeAsTitle(mealType);
  const logFood = onFoodSelected || onSelectFood;
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [emptyHint, setEmptyHint] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [pendingFood, setPendingFood] = useState(null);
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  // vocab: basket = foods toggled with +; Log-to-Meal pill opens confirm for the first pick
  const [basket, setBasket] = useState([]);
  // vocab: browseTab = which NbSegmented cell is active (results | favorites | recent)
  const [browseTab, setBrowseTab] = useState(initialBrowseTab(initialQuery));
  const uid = resolveSignedInUid(userId);

  // Confirm sheet theme — nb tokens only (no pink/purple chrome)
  const confirmTheme = useMemo(() => ({
    screenBg: colors.nbBackground,
    cardBg: colors.nbSurface,
    cardBorder: colors.nbBorder,
    text: colors.nbInk,
    textMuted: colors.nbMuted,
    inputBg: colors.nbSurfaceChip,
    secondaryAction: colors.nbMuted,
    isDark
  }), [colors, isDark]);

  // Load recent + favorites once we know the uid (Firestore)
  useEffect(() => {
    if (!uid) return;
    const loadRecent = async () => {
      try {
        const recent = await getRecentFoods(uid, RECENT_FOODS_LIMIT);
        const normalizedRecent = [];
        const safeRecent = recent || [];
        for (let index = 0; index < safeRecent.length; index += 1) {
          normalizedRecent.push(normalizeFood(safeRecent[index]));
        }
        setRecentFoods(normalizedRecent);
      } catch (err) {
        console.log('Recent foods unavailable:', err.message);
        setRecentFoods([]);
      }
    };
    const loadFavorites = async () => {
      try {
        const favorites = await getFavoriteFoods(uid);
        const normalizedFavorites = [];
        const safeFavorites = favorites || [];
        for (let index = 0; index < safeFavorites.length; index += 1) {
          normalizedFavorites.push(normalizeFavoriteRow(safeFavorites[index]));
        }
        setFavoriteFoods(normalizedFavorites);
      } catch (err) {
        console.log('Favorite foods unavailable:', err.message);
        setFavoriteFoods([]);
      }
    };
    loadRecent();
    loadFavorites();
  }, [uid]);

  // vocab: searchRaceId = increments per typed search so a slow older response cannot overwrite newer results
  const searchRaceIdRef = useRef(0);
  const handleSearch = useCallback(async searchQuery => {
    // 1. Empty query clears results and cancels in-flight work.
    if (!searchQuery.trim()) {
      searchRaceIdRef.current += 1;
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    // 2. Stamp a race id so slower responses cannot overwrite newer keystrokes.
    const raceId = searchRaceIdRef.current + 1;
    searchRaceIdRef.current = raceId;
    setLoading(true);
    setSearchError(null);
    setEmptyHint(null);
    setHasSearched(true);
    setBrowseTab(BROWSE_TAB_RESULTS);
    try {
      // 3. Fetch, then drop junk web titles and normalize for the confirm sheet.
      const rawHits = await searchFoods(searchQuery, SEARCH_RESULT_LIMIT);
      if (raceId !== searchRaceIdRef.current) return;
      const trimmedQuery = searchQuery.trim();
      const cleanedHits = normalizeSearchHits(rawHits, trimmedQuery);
      if (__DEV__) {
        console.log('[FoodSearch]', {
          raceId,
          query: trimmedQuery,
          raw: Array.isArray(rawHits) ? rawHits.length : 0,
          afterJunkFilter: cleanedHits.length,
          hint: getFoodSearchHint()
        });
      }
      setResults(cleanedHits);
      setEmptyHint(getFoodSearchHint());
    } catch (err) {
      if (raceId !== searchRaceIdRef.current) return;
      console.error('Food search error:', err);
      setSearchError('Search failed. Make sure the server is running.');
      setResults([]);
    } finally {
      if (raceId === searchRaceIdRef.current) setLoading(false);
    }
  }, []);

  // Debounce auto-search once the query is long enough
  useEffect(() => {
    const trimmedQuery = String(query || '').trim();
    if (trimmedQuery.length === 0) {
      setResults([]);
      setHasSearched(false);
      if (browseTab === BROWSE_TAB_RESULTS) setBrowseTab(BROWSE_TAB_RECENT);
      return;
    }
    if (trimmedQuery.length < MIN_CHARS_AUTO_SEARCH) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(trimmedQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when query text changes
  }, [query, handleSearch]);
  const toggleBasket = food => {
    // 1. Read a stable id for this row (id / food_id / name).
    const foodId = foodRowId(food);

    // 2. Toggle: remove if already in the basket, otherwise append.
    setBasket(previousBasket => {
      if (foodIsInBasket(previousBasket, food)) {
        return removeFoodFromBasket(previousBasket, foodId);
      }
      return [...previousBasket, food];
    });
  };
  const inBasket = food => foodIsInBasket(basket, food);
  const handleLogBasket = () => {
    // 1. Nothing selected → do nothing.
    if (!basket.length) return;
    // 2. Open ConfirmFoodPopup for the first pick (rest follow after confirm).
    setPendingFood(basket[0]);
  };

  // Confirm sheet may pass a meal key (Breakfast→breakfast) as the second arg.
  // After one log, open the next basket item so multi-select still gets serving edit (PNG basket).
  const handleConfirmFood = async (confirmedFood, mealKeyFromSheet) => {
    // 1. Remove the food we just confirmed from the basket.
    const loggedId = foodRowId(pendingFood);
    const remaining = removeFoodFromBasket(basket, loggedId);
    setBasket(remaining);
    setPendingFood(null);

    // 2. Hand off to the parent logger (DailyLogContent).
    if (logFood && confirmedFood) {
      await logFood(confirmedFood, mealKeyFromSheet || mealType);
    }

    // 3. Queue the next basket item after the sheet dismisses.
    if (remaining.length > 0) {
      setTimeout(() => setPendingFood(remaining[0]), NEXT_BASKET_ITEM_DELAY_MS);
    }
  };
  const basketKcal = sumBasketCalories(basket);
  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setBrowseTab(BROWSE_TAB_RECENT);
  };
  const {
    listData,
    listKey
  } = browseListForTab(browseTab, favoriteFoods, recentFoods, results);
  const showEmpty = shouldShowEmptyBrowseState({
    loading,
    browseTab,
    hasSearched,
    results,
    recentFoods,
    favoriteFoods
  });

  // Clearance for absolute dock + floating basket so the last row stays readable
  const usesShellBottomPad = embedded || reserveShellBottomNav;
  let scrollBottomPad;
  if (usesShellBottomPad) {
    scrollBottomPad = shellBottomPad;
  } else {
    scrollBottomPad = Math.max(insets.bottom, MIN_SAFE_BOTTOM) + DEFAULT_LIST_BOTTOM_EXTRA;
  }
  if (basket.length) {
    scrollBottomPad += BASKET_CLEARANCE;
  }

  // Basket floats above the shell dock when the parent keeps BottomMenuBar mounted.
  // shellBottomPad = bar + safe + extra; drop the extra so the bar hugs the dock like PNG.
  let basketBottom = Math.max(insets.bottom, MIN_SAFE_BOTTOM) + BASKET_ABOVE_DOCK_GAP;
  if (reserveShellBottomNav || embedded) {
    basketBottom = shellBottomPad - SHELL_BOTTOM_INSET_EXTRA + BASKET_ABOVE_DOCK_GAP;
  }
  const onSuggestionPress = suggestion => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };
  const showResultsTab = browseTab === BROWSE_TAB_RESULTS;
  let emptyQueryForHero;
  if (hasSearched && showResultsTab) {
    emptyQueryForHero = query;
  } else {
    emptyQueryForHero = '';
  }
  let emptyHintForHero;
  if (hasSearched && showResultsTab) {
    emptyHintForHero = emptyHint;
  } else {
    emptyHintForHero = null;
  }
  let screenBg;
  if (embedded) {
    screenBg = 'transparent';
  } else {
    screenBg = colors.nbBackground;
  }
  let keyboardVerticalOffset;
  if (embedded) {
    keyboardVerticalOffset = 0;
  } else {
    keyboardVerticalOffset = Math.max(insets.top, MIN_SAFE_BOTTOM);
  }
  const keyboardAvoidBehavior = Platform.OS === 'ios' ? 'padding' : undefined;
  const backHandler = typeof onClose === 'function' ? onClose : undefined;
  const showConfirmModal = Boolean(pendingFood);
  const showListCard = !loading && listData.length > 0;
  const showSoftDisclaimer = !loading && listData.length > 0;
  const showBasket = basket.length > 0;

  // Build result rows with a for-loop (no .map in the screen recipe).
  const foodResultRows = [];
  for (let index = 0; index < listData.length; index += 1) {
    const item = listData[index];
    foodResultRows.push(
      <FoodResultRow
        key={rowKey(item, index, listKey)}
        item={item}
        onToggle={toggleBasket}
        selected={inBasket(item)}
        colors={colors}
        query={query}
        showDivider={index > 0}
      />,
    );
  }

  return <>
      <View style={[styles.root, {
      backgroundColor: screenBg
    }]}>
        {/* Header sits OUTSIDE the gutter scroll — NbPageHeader already owns its 16px side pad */}
        <NbPageHeader title="Add food" subtitle={mealSubtitle} onBack={backHandler} skipTopSafeInset={embedded} />

        <KeyboardAvoidingView behavior={keyboardAvoidBehavior} style={styles.flex} keyboardVerticalOffset={keyboardVerticalOffset}>
          <ScrollView style={styles.flex} contentContainerStyle={[styles.scrollBody, {
          paddingBottom: scrollBottomPad
        }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <SearchFieldBlock query={query} colors={colors} onChangeText={setQuery} onSubmitSearch={() => handleSearch(query)} onClearSearch={clearSearch} />

            <ScanAndQuickAddRow colors={colors} onOpenBarcode={onOpenBarcode} onOpenQuickAdd={onOpenQuickAdd} />

            {searchError ? <View style={[styles.errorBanner, {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSoft
          }]}>
                <Ionicons name="warning-outline" size={14} color={colors.nbInk} />
                <Text style={[styles.errorText, {
              color: colors.nbInk
            }]}>{searchError}</Text>
              </View> : null}

            {/* NbSegmented — active cell = SOLID nbFill + nbOnFill text (never pink pills) */}
            <NbSegmented segments={BROWSE_SEGMENTS} selected={browseTab} onSelect={setBrowseTab} style={styles.segment} />

            {loading ? <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.nbInk} size="large" />
                <Text style={[styles.loadingText, {
              color: colors.nbMuted
            }]}>
                  Searching foods...
                </Text>
              </View> : null}

            {showEmpty && !loading ? <EmptyState query={emptyQueryForHero} hint={emptyHintForHero} colors={colors} onSuggestionPress={onSuggestionPress} onQuickAdd={onOpenQuickAdd} /> : null}

            {/* ONE HardShadow white/surface card — rows join inside with 2px ink dividers */}
            {showListCard ? <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={styles.listCardShadow}>
                <View style={[styles.listCardShell, {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder
            }]}>
                  {foodResultRows}
                </View>
              </HardShadow> : null}

            {showSoftDisclaimer ? <SoftDisclaimer colors={colors} /> : null}
          </ScrollView>
        </KeyboardAvoidingView>

        {showBasket ? <FloatingBasketBar basket={basket} basketKcal={basketKcal} basketBottom={basketBottom} isDark={isDark} colors={colors} mealSubtitle={mealSubtitle} onLogBasket={handleLogBasket} /> : null}
      </View>

      <Modal visible={showConfirmModal} animationType="slide" presentationStyle="pageSheet">
        <FoodConfirmSheet food={pendingFood} mealType={mealType} theme={confirmTheme} showVerification={false} onConfirm={handleConfirmFood} onCancel={() => setPendingFood(null)} />
      </Modal>
    </>;
}

// ===== PLUMBING — skip unless debugging =====

const rowStyles = StyleSheet.create({
  // Manipulate here: row height / gap (Design Law list row ≈ 56–64)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 8
  },
  grow: {
    flex: 1,
    minWidth: 0
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2
  },
  kcal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right'
  },
  // Manipulate here: square + chip — PNG / mockup `.addb` is 44×44, radius 10
  addSq: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  }
});
const discStyles = StyleSheet.create({
  // Manipulate here: disc corner accent (mockup `2 14 14 14`) — soft note, not a HardShadow card
  box: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    padding: 12,
    marginTop: 4
  },
  text: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20
  }
});
const empty = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 12,
    width: '100%',
    gap: 12
  },
  // Manipulate here: dashed empty card — Design Law emp = dashed, transparent, NO shadow
  card: {
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    backgroundColor: 'transparent',
    padding: 16,
    gap: 8
  },
  kicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.3
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    letterSpacing: -0.3
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20
  },
  ctaWrap: {
    marginTop: 8
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.3
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8
  },
  // Manipulate here: quick-pick pill (mockup chip sm — 999 radius, 3px border)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.round,
    paddingHorizontal: 16,
    minHeight: 44
  },
  chipLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15
  }
});
const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0
  },
  flex: {
    flex: 1,
    minHeight: 0
  },
  // Manipulate here: side gutter 16 (Design Law screenGutter) — header is outside this pad
  scrollBody: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
    gap: 0
  },
  searchShadow: {
    marginBottom: spacing.sm
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    gap: 10
  },
  searchInput: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    paddingVertical: 10
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm
  },
  actionHalf: {
    flex: 1
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: nb.minTouchTarget,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    paddingHorizontal: 12
  },
  actionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    flexShrink: 1
  },
  segment: {
    marginBottom: spacing.sm
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  errorText: {
    fontSize: 12,
    flex: 1,
    fontFamily: 'Inter_500Medium'
  },
  loadingBlock: {
    paddingVertical: 40,
    alignItems: 'center'
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
    fontFamily: 'Inter_500Medium'
  },
  listCardShadow: {
    marginTop: 4,
    marginBottom: 12
  },
  // Manipulate here: card padding 14 matches Design Law / mockup `.card`
  listCardShell: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    paddingVertical: 4,
    overflow: 'hidden'
  },
  basketWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 4
  },
  // Manipulate here: basket radius — PNG floating pill (fat rounded bar), 3px border + HardShadow
  basketPill: {
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  basketGrow: {
    flex: 1,
    minWidth: 0
  },
  basketCount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15
  },
  basketKcal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    opacity: 0.85,
    marginTop: 1
  },
  basketCta: {
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center'
  },
  basketCtaText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14
  }
});
export default FoodSearchScreen;