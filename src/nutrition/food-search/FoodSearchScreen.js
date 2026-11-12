// Design Law “Add food” search (PNG 05–08): header → field → Scan|Quick add → segment → card → basket.
// Flow: debounce search → normalize hits → Results/Favorites/Recent → toggle basket → ConfirmFoodPopup → logFood.
// Used by DailyLogContent (embedded + reserveShellBottomNav). Props wire barcode / quick-add into the parent shell.
//
// vocab: HardShadow = solid offset shadow (no blur); nbFill = selected / primary solid (black light, white dark)
// vocab: basket = foods toggled with +; Log-to-Meal opens ConfirmFoodPopup sequentially for each pick

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  searchFoods,
  getRecentFoods,
  getFoodSearchHint,
  getFavoriteFoods,
} from '../daily-log/saveLoggedFood';
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

const SCALES_ICON = require('../../assets/icons/handoff/scales.png');

// Manipulate here: quick-pick chip labels (PNG 07/08 empty state)
const QUICK_PICKS = [
  'Greek Yogurt',
  'Salmon',
  'Oatmeal',
  'Chicken Breast',
  'Brown Rice',
  'Avocado',
];

const BROWSE_SEGMENTS = [
  { id: 'results', label: 'Search results' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'recent', label: 'Recent' },
];

// Manipulate here: soft disc copy under the results card (PNG 05/06 `.disc`)
const DISCLAIMER_COPY =
  'Search packaged foods, restaurants, and groceries. Nutrition data comes from public databases and can be off. Check the label when it matters.';

// ===== HELPER FUNCTIONS =====

/**
 * Title-case meal key for header subtitle / “Log to {Meal}” copy.
 * @param {string} mealType
 * @returns {string}
 */
function mealLabel(mealType) {
  const raw = String(mealType || 'meal');
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * Household serving text when the API only gave a unit (not "serving"/"g").
 * @param {object} item
 * @returns {string|null}
 */
function portionTextFromServingUnit(item) {
  const servingUnit = String(item.serving_unit || item.servingUnit || '').trim();
  if (!servingUnit) return null;
  if (/^(serving|portion|each|g|gram|grams|ml)$/i.test(servingUnit)) return null;
  return servingUnit;
}

/**
 * Normalize a search / recent / favorite hit into the shape nutritionService.addFoodLog expects.
 * Keep both camelCase + snake_case keys — ConfirmFoodPopup and logFood still read both.
 * @param {object} item
 * @param {string} [searchQuery]
 * @returns {object}
 */
function normalizeFood(item, searchQuery = '') {
  const roundCalories = (rawValue) => Math.round(rawValue ?? 0);
  const meta = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};

  const portion_text =
    item.serving_label ||
    item.servingLabel ||
    item.householdServingFullText ||
    meta.serving_label ||
    meta.servingLabel ||
    meta.householdServingFullText ||
    portionTextFromServingUnit(item);

  const rawName = item.name || item.food_name || item.description || 'Unknown Food';
  // vocab: serper = web search source — titles are messy, so we tidy when the user typed a query
  const foodName =
    (item.source === 'serper' || item.source === 'mixed') && searchQuery
      ? cleanSerperFoodTitle(rawName, searchQuery)
      : rawName;
  const brandLabel = resolveFoodBrandLabel(
    foodName,
    item.brand || item.brand_name || item.brand_owner || item.brandOwner || '',
  );

  return {
    name: foodName,
    brand: brandLabel,
    servingSize: item.servingSize || item.serving_qty || item.serving_size || 1,
    servingUnit: item.servingUnit || item.serving_unit || item.servingSizeUnit || 'serving',
    servingGrams: item.servingGrams || item.serving_weight_grams || item.serving_grams || DEFAULT_SERVING_GRAMS,
    calories: roundCalories(item.calories ?? item.nf_calories),
    protein: roundCalories(item.protein ?? item.nf_protein),
    carbs: roundCalories(item.carbs ?? item.nf_total_carbohydrate),
    fat: roundCalories(item.fat ?? item.nf_total_fat),
    fiber: roundCalories(item.fiber ?? item.nf_dietary_fiber),
    sugar: roundCalories(item.sugar ?? item.nf_sugars),
    sodium: roundCalories(item.sodium ?? item.nf_sodium),
    source: item.source || 'server',
    nutrition_unverified: Boolean(item.nutrition_unverified),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier: item.servingMultiplier ?? null,

    food_name: foodName,
    brand_name: brandLabel,
    serving_size: item.serving_qty || item.servingSize || 1,
    serving_unit: item.serving_unit || item.servingUnit || 'serving',
    serving_grams: item.serving_weight_grams || item.servingGrams || DEFAULT_SERVING_GRAMS,
    serving_label: item.serving_label || item.servingLabel || item.householdServingFullText || null,
    portion_text,

    metadata: item,
  };
}

/**
 * Serving line shown under the food name (brand · portion).
 * @param {object} item
 * @param {string} [userQuery]
 * @returns {string}
 */
function formatServingLine(item, userQuery = '') {
  return formatServingDisplayLine(item, userQuery || item?.metadata?.matchedQuery || '');
}

/**
 * Map a favorite Firestore row into normalizeFood input.
 * @param {object} favorite
 * @returns {object}
 */
function normalizeFavoriteRow(favorite) {
  return normalizeFood({
    id: favorite.foodId,
    name: favorite.foodName,
    food_name: favorite.foodName,
    calories: favorite.calories,
    protein: favorite.macros?.protein,
    carbs: favorite.macros?.carbs,
    fat: favorite.macros?.fat,
    brand: favorite.brand,
  });
}

/**
 * Drop junk web titles, then normalize each hit with the active query.
 * @param {Array} rawHits
 * @param {string} trimmedQuery
 * @returns {Array}
 */
function normalizeSearchHits(rawHits, trimmedQuery) {
  return (rawHits || [])
    .filter((item) => {
      const title = item?.name || item?.food_name || '';
      return !isJunkWebSearchTitle(title);
    })
    .map((item) => normalizeFood(item, trimmedQuery));
}

/**
 * Meta line under the title: "Brand · serving" (PNG row subtext).
 * @param {object} item
 * @param {string} query
 * @returns {string}
 */
function rowMetaLine(item, query) {
  const brand = String(item.brand || item.brand_name || '').trim() || 'Generic';
  const serving = formatServingLine(item, query);
  return serving ? `${brand} · ${serving}` : brand;
}

/**
 * Stable React key for a list row.
 * @param {object} item
 * @param {number} index
 * @param {string} listKey
 * @returns {string}
 */
function rowKey(item, index, listKey) {
  const id = item?.id || item?.food_id || item?.name || item?.food_name || index;
  return `${listKey}-${id}-${index}`;
}

/**
 * Basket membership id — prefer a real food id, else name.
 * @param {object} item
 * @returns {string}
 */
function foodRowId(item) {
  return String(item?.id || item?.food_id || item?.name || item?.food_name || '')
    .trim()
    .toLowerCase();
}

// ===== UI PIECES (PNG) =====

/**
 * PNG result row: bold name · muted brand·serving · bold kcal · 44² + (selected = nbFill).
 * Dividers live on the parent card so the ink line spans the padded list width.
 */
function FoodResultRow({ item, onToggle, selected = false, colors, query = '', showDivider = false }) {
  const title = item.name || item.food_name || 'Food';
  const meta = rowMetaLine(item, query);
  const kcal = Math.round(Number(item.calories) || 0);

  return (
    <View
      style={[
        rowStyles.row,
        showDivider && { borderTopWidth: nb.borderWidthDivider, borderTopColor: colors.nbBorder },
      ]}
    >
      <View style={rowStyles.grow}>
        <Text style={[rowStyles.title, { color: colors.nbInk }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[rowStyles.meta, { color: colors.nbMuted }]} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <Text style={[rowStyles.kcal, { color: colors.nbInk }]}>{kcal}</Text>
      {/* PNG: selected + = solid fill + onFill glyph; unselected = surface chip */}
      <TouchableOpacity
        onPress={() => onToggle(item)}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={selected ? `Remove ${title}` : `Add ${title}`}
        style={[
          rowStyles.addSq,
          {
            borderColor: colors.nbBorder,
            backgroundColor: selected ? colors.nbFill : colors.nbSurfaceChip,
          },
        ]}
        activeOpacity={0.88}
      >
        <Ionicons name="add" size={20} color={selected ? colors.nbOnFill : colors.nbInk} />
      </TouchableOpacity>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  // Manipulate here: row height / gap (Design Law list row ≈ 56–64)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingVertical: 8,
  },
  grow: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  kcal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'right',
  },
  // Manipulate here: square + chip — PNG / mockup `.addb` is 44×44, radius 10
  addSq: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

/**
 * Soft accuracy note under the results card (PNG `.disc` — soft fill, corner accent, NO HardShadow).
 */
function SoftDisclaimer({ colors }) {
  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel="Nutrition data accuracy notice"
      style={[
        discStyles.box,
        {
          backgroundColor: colors.nbSoft,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Text style={[discStyles.text, { color: colors.nbMuted }]}>{DISCLAIMER_COPY}</Text>
    </View>
  );
}

const discStyles = StyleSheet.create({
  // Manipulate here: disc corner accent (mockup `2 14 14 14`) — soft note, not a HardShadow card
  box: {
    borderWidth: nb.borderWidth,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  text: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
});

/**
 * PNG 07/08 empty / no-matches: dashed emp card (no shadow) + Quick add instead + quick-pick chips.
 */
function EmptyState({ query, onSuggestionPress, onQuickAdd, colors, hint }) {
  const isNoResults = Boolean(query?.trim());

  return (
    <View style={empty.wrap}>
      <View
        style={[
          empty.card,
          {
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <Text style={[empty.kicker, { color: colors.nbMuted }]}>
          {isNoResults ? 'NO MATCHES' : 'START TYPING'}
        </Text>
        <Text style={[empty.title, { color: colors.nbInk }]}>
          {isNoResults ? `Nothing for "${query}"` : 'What are you eating?'}
        </Text>
        <Text style={[empty.subtitle, { color: colors.nbMuted }]}>
          {isNoResults
            ? hint || 'Try a shorter name or a brand.'
            : 'Search packaged foods, restaurants, and groceries.'}
        </Text>
        {isNoResults && typeof onQuickAdd === 'function' ? (
          <View style={empty.ctaWrap}>
            <NbButton variant="ghost" onPress={onQuickAdd}>
              Quick add instead
            </NbButton>
          </View>
        ) : null}
      </View>

      {/* Quick picks — PNG chips that seed the search field */}
      <Text style={[empty.sectionLabel, { color: colors.nbMuted }]}>QUICK PICKS</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={empty.chipRow}
      >
        {QUICK_PICKS.map((label) => (
          <Pressable
            key={label}
            onPress={() => onSuggestionPress?.(label)}
            accessibilityRole="button"
            accessibilityLabel={`Search ${label}`}
            style={[
              empty.chip,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurfaceChip,
              },
            ]}
          >
            <Ionicons name="add" size={18} color={colors.nbInk} />
            <Text style={[empty.chipLabel, { color: colors.nbInk }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 12,
    width: '100%',
    gap: 12,
  },
  // Manipulate here: dashed empty card — Design Law emp = dashed, transparent, NO shadow
  card: {
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    backgroundColor: 'transparent',
    padding: 16,
    gap: 8,
  },
  kicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.3,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  ctaWrap: { marginTop: 8 },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.3,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8,
  },
  // Manipulate here: quick-pick pill (mockup chip sm — 999 radius, 3px border)
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.round,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  chipLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
});

// ===== MAIN FUNCTION =====

/**
 * Search foods, browse recent/favorites, then confirm & log into the active meal.
 * @param {{ mealType?: string, defaultMeal?: string, onFoodSelected?: Function, onSelectFood?: Function, onClose?: Function, onOpenBarcode?: Function, onOpenQuickAdd?: Function, userId?: string, embedded?: boolean, reserveShellBottomNav?: boolean, initialQuery?: string }} props
 */
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
  initialQuery = '',
}) {
  const { isDark, colors } = useTheme();
  const insets = useSafeAreaInsets();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);

  const mealType = useMemo(
    () => String(mealTypeProp || defaultMeal || 'breakfast').toLowerCase(),
    [mealTypeProp, defaultMeal],
  );
  const mealSubtitle = mealLabel(mealType);
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
  const [browseTab, setBrowseTab] = useState(initialQuery?.trim() ? 'results' : 'recent');
  const uid = userId || auth.currentUser?.uid;

  // Confirm sheet theme — nb tokens only (no pink/purple chrome)
  const confirmTheme = useMemo(
    () => ({
      screenBg: colors.nbBackground,
      cardBg: colors.nbSurface,
      cardBorder: colors.nbBorder,
      text: colors.nbInk,
      textMuted: colors.nbMuted,
      inputBg: colors.nbSurfaceChip,
      secondaryAction: colors.nbMuted,
      isDark,
    }),
    [colors, isDark],
  );

  // Load recent + favorites once we know the uid (Firestore)
  useEffect(() => {
    if (!uid) return;

    const loadRecent = async () => {
      try {
        const recent = await getRecentFoods(uid, RECENT_FOODS_LIMIT);
        setRecentFoods((recent || []).map(normalizeFood));
      } catch (err) {
        console.log('Recent foods unavailable:', err.message);
        setRecentFoods([]);
      }
    };

    const loadFavorites = async () => {
      try {
        const favs = await getFavoriteFoods(uid);
        setFavoriteFoods((favs || []).map(normalizeFavoriteRow));
      } catch (err) {
        console.log('Favorite foods unavailable:', err.message);
        setFavoriteFoods([]);
      }
    };

    loadRecent();
    loadFavorites();
  }, [uid]);

  // Ask the server, drop junk titles, normalize for the confirm sheet
  const handleSearch = useCallback(async (searchQuery) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setLoading(true);
    setSearchError(null);
    setEmptyHint(null);
    setHasSearched(true);
    setBrowseTab('results');
    try {
      const rawHits = await searchFoods(searchQuery, SEARCH_RESULT_LIMIT);
      const trimmedQuery = searchQuery.trim();
      setResults(normalizeSearchHits(rawHits, trimmedQuery));
      setEmptyHint(getFoodSearchHint());
    } catch (err) {
      console.error('Food search error:', err);
      setSearchError('Search failed. Make sure the server is running.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce auto-search once the query is long enough
  useEffect(() => {
    const trimmedQuery = String(query || '').trim();
    if (trimmedQuery.length === 0) {
      setResults([]);
      setHasSearched(false);
      if (browseTab === 'results') setBrowseTab('recent');
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

  const toggleBasket = (food) => {
    const id = foodRowId(food);
    setBasket((prev) => {
      const exists = prev.some((f) => foodRowId(f) === id);
      if (exists) return prev.filter((f) => foodRowId(f) !== id);
      return [...prev, food];
    });
  };

  const inBasket = (food) => basket.some((f) => foodRowId(f) === foodRowId(food));

  const handleLogBasket = () => {
    if (!basket.length) return;
    setPendingFood(basket[0]);
  };

  // Confirm sheet may pass a meal key (Breakfast→breakfast) as the second arg.
  // After one log, open the next basket item so multi-select still gets serving edit (PNG basket).
  const handleConfirmFood = async (confirmedFood, mealKeyFromSheet) => {
    const loggedId = foodRowId(pendingFood);
    const remaining = basket.filter((f) => foodRowId(f) !== loggedId);
    setBasket(remaining);
    setPendingFood(null);
    if (logFood && confirmedFood) {
      await logFood(confirmedFood, mealKeyFromSheet || mealType);
    }
    if (remaining.length > 0) {
      // Brief defer so the modal can dismiss then reopen for the next food
      setTimeout(() => setPendingFood(remaining[0]), 180);
    }
  };

  const basketKcal = basket.reduce((sum, f) => sum + (Number(f.calories) || 0), 0);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setBrowseTab('recent');
  };

  const showFavorites = browseTab === 'favorites';
  const showRecent = browseTab === 'recent';
  const showResults = browseTab === 'results';

  const listData = showFavorites
    ? favoriteFoods
    : showRecent
      ? recentFoods
      : showResults
        ? results
        : [];
  const listKey = showFavorites ? 'favorites' : showRecent ? 'recent' : 'results';

  const showEmpty =
    !loading &&
    ((showResults && hasSearched && results.length === 0) ||
      (showRecent && recentFoods.length === 0 && !hasSearched) ||
      (showFavorites && favoriteFoods.length === 0) ||
      (showResults && !hasSearched && results.length === 0 && recentFoods.length === 0));

  // Clearance for absolute dock + floating basket so the last row stays readable
  const scrollBottomPad =
    (embedded || reserveShellBottomNav
      ? shellBottomPad
      : Math.max(insets.bottom, MIN_SAFE_BOTTOM) + DEFAULT_LIST_BOTTOM_EXTRA) +
    (basket.length ? BASKET_CLEARANCE : 0);

  // Basket floats above the shell dock when the parent keeps BottomMenuBar mounted.
  // shellBottomPad = bar + safe + extra; drop the extra so the bar hugs the dock like PNG.
  const basketBottom =
    reserveShellBottomNav || embedded
      ? shellBottomPad - SHELL_BOTTOM_INSET_EXTRA + BASKET_ABOVE_DOCK_GAP
      : Math.max(insets.bottom, MIN_SAFE_BOTTOM) + BASKET_ABOVE_DOCK_GAP;

  const onSuggestionPress = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const emptyQueryForHero = hasSearched && showResults ? query : '';
  const emptyHintForHero = hasSearched && showResults ? emptyHint : null;

  const screenBg = embedded ? 'transparent' : colors.nbBackground;

  return (
    <>
      <View style={[styles.root, { backgroundColor: screenBg }]}>
        {/* Header sits OUTSIDE the gutter scroll — NbPageHeader already owns its 16px side pad */}
        <NbPageHeader
          title="Add food"
          subtitle={mealSubtitle}
          onBack={typeof onClose === 'function' ? onClose : undefined}
          skipTopSafeInset={embedded}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
          keyboardVerticalOffset={embedded ? 0 : Math.max(insets.top, MIN_SAFE_BOTTOM)}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              styles.scrollBody,
              { paddingBottom: scrollBottomPad },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* HardShadow search field — PNG 05/06 full-width 3px bordered input */}
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbInput} style={styles.searchShadow}>
              <View
                style={[
                  styles.searchInner,
                  {
                    backgroundColor: colors.nbSurface,
                    borderColor: colors.nbBorder,
                  },
                ]}
              >
                <TextInput
                  style={[styles.searchInput, { color: colors.nbInk }]}
                  placeholder="What are you eating?"
                  placeholderTextColor={colors.nbMuted}
                  value={query}
                  onChangeText={setQuery}
                  autoFocus
                  returnKeyType="search"
                  onSubmitEditing={() => handleSearch(query)}
                  accessibilityLabel="Search foods"
                  accessibilityHint="Search by food name, brand, or restaurant"
                />
                {query.length > 0 ? (
                  <TouchableOpacity
                    onPress={clearSearch}
                    accessibilityRole="button"
                    accessibilityLabel="Clear search"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={18} color={colors.nbMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </HardShadow>

            {/* Scan barcode | Quick add — equal HardShadow ghost buttons; scales chip = accentGradients only */}
            <View style={styles.actionRow}>
              <HardShadow
                offset={nb.shadowOffsetSmall}
                radius={borderRadius.nbButton}
                style={styles.actionHalf}
              >
                <TouchableOpacity
                  onPress={() => onOpenBarcode?.()}
                  disabled={typeof onOpenBarcode !== 'function'}
                  accessibilityRole="button"
                  accessibilityLabel="Scan barcode"
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: colors.nbBorder,
                      backgroundColor: colors.nbSurface,
                      opacity: typeof onOpenBarcode === 'function' ? 1 : 0.45,
                    },
                  ]}
                  activeOpacity={0.88}
                >
                  {/* Manipulate here: scales chip size — keep small; accentGradients only on this chip */}
                  <NbIconChip source={SCALES_ICON} size={36} index={1} />
                  <Text style={[styles.actionLabel, { color: colors.nbInk }]} numberOfLines={1}>
                    Scan barcode
                  </Text>
                </TouchableOpacity>
              </HardShadow>
              <HardShadow
                offset={nb.shadowOffsetSmall}
                radius={borderRadius.nbButton}
                style={styles.actionHalf}
              >
                <TouchableOpacity
                  onPress={() => onOpenQuickAdd?.()}
                  disabled={typeof onOpenQuickAdd !== 'function'}
                  accessibilityRole="button"
                  accessibilityLabel="Quick add"
                  style={[
                    styles.actionBtn,
                    {
                      borderColor: colors.nbBorder,
                      backgroundColor: colors.nbSurface,
                      opacity: typeof onOpenQuickAdd === 'function' ? 1 : 0.45,
                    },
                  ]}
                  activeOpacity={0.88}
                >
                  <Text style={[styles.actionLabel, { color: colors.nbInk }]} numberOfLines={1}>
                    Quick add
                  </Text>
                </TouchableOpacity>
              </HardShadow>
            </View>

            {searchError ? (
              <View
                style={[
                  styles.errorBanner,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft },
                ]}
              >
                <Ionicons name="warning-outline" size={14} color={colors.nbInk} />
                <Text style={[styles.errorText, { color: colors.nbInk }]}>{searchError}</Text>
              </View>
            ) : null}

            {/* NbSegmented — active cell = SOLID nbFill + nbOnFill text (never pink pills) */}
            <NbSegmented
              segments={BROWSE_SEGMENTS}
              selected={browseTab}
              onSelect={setBrowseTab}
              style={styles.segment}
            />

            {loading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator color={colors.nbInk} size="large" />
                <Text style={[styles.loadingText, { color: colors.nbMuted }]}>Searching foods...</Text>
              </View>
            ) : null}

            {showEmpty && !loading ? (
              <EmptyState
                query={emptyQueryForHero}
                hint={emptyHintForHero}
                colors={colors}
                onSuggestionPress={onSuggestionPress}
                onQuickAdd={onOpenQuickAdd}
              />
            ) : null}

            {/* ONE HardShadow white/surface card — rows join inside with 2px ink dividers */}
            {!loading && listData.length > 0 ? (
              <HardShadow
                offset={nb.shadowOffsetCard}
                radius={borderRadius.nbCard}
                style={styles.listCardShadow}
              >
                <View
                  style={[
                    styles.listCardShell,
                    {
                      backgroundColor: colors.nbSurface,
                      borderColor: colors.nbBorder,
                    },
                  ]}
                >
                  {listData.map((item, index) => (
                    <FoodResultRow
                      key={rowKey(item, index, listKey)}
                      item={item}
                      onToggle={toggleBasket}
                      selected={inBasket(item)}
                      colors={colors}
                      query={query}
                      showDivider={index > 0}
                    />
                  ))}
                </View>
              </HardShadow>
            ) : null}

            {!loading && listData.length > 0 ? <SoftDisclaimer colors={colors} /> : null}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Floating basket — fill block + onFill CTA, HardShadow, sits above shell dock */}
        {basket.length > 0 ? (
          <View
            style={[styles.basketWrap, { bottom: basketBottom }]}
            pointerEvents="box-none"
          >
            {/* PNG 05 light = fill bar + onFill CTA; PNG 06 dark = soft bar + fill CTA */}
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
              <View
                style={[
                  styles.basketPill,
                  {
                    backgroundColor: isDark ? colors.nbSoft : colors.nbFill,
                    borderColor: colors.nbBorder,
                  },
                ]}
              >
                <View style={styles.basketGrow}>
                  <Text
                    style={[
                      styles.basketCount,
                      { color: isDark ? colors.nbInk : colors.nbOnFill },
                    ]}
                  >
                    {basket.length} {basket.length === 1 ? 'food' : 'foods'}
                  </Text>
                  <Text
                    style={[
                      styles.basketKcal,
                      { color: isDark ? colors.nbMuted : colors.nbOnFill },
                    ]}
                  >
                    {basketKcal.toLocaleString()} kcal
                  </Text>
                </View>
                <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton}>
                  <TouchableOpacity
                    onPress={handleLogBasket}
                    style={[
                      styles.basketCta,
                      {
                        backgroundColor: isDark ? colors.nbFill : colors.nbOnFill,
                        borderColor: colors.nbBorder,
                        borderWidth: nb.borderWidth,
                      },
                    ]}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel={`Log to ${mealSubtitle}`}
                  >
                    <Text
                      style={[
                        styles.basketCtaText,
                        { color: isDark ? colors.nbOnFill : colors.nbFill },
                      ]}
                    >
                      Log to {mealSubtitle}
                    </Text>
                  </TouchableOpacity>
                </HardShadow>
              </View>
            </HardShadow>
          </View>
        ) : null}
      </View>

      <Modal visible={!!pendingFood} animationType="slide" presentationStyle="pageSheet">
        <FoodConfirmSheet
          food={pendingFood}
          mealType={mealType}
          theme={confirmTheme}
          showVerification={false}
          onConfirm={handleConfirmFood}
          onCancel={() => setPendingFood(null)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  flex: { flex: 1, minHeight: 0 },
  // Manipulate here: side gutter 16 (Design Law screenGutter) — header is outside this pad
  scrollBody: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.sm,
    gap: 0,
  },
  searchShadow: {
    marginBottom: spacing.sm,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: spacing.sm,
  },
  actionHalf: { flex: 1 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: nb.minTouchTarget,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    paddingHorizontal: 12,
  },
  actionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    flexShrink: 1,
  },
  segment: {
    marginBottom: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { fontSize: 12, flex: 1, fontFamily: 'Inter_500Medium' },
  loadingBlock: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    marginTop: 12,
    fontFamily: 'Inter_500Medium',
  },
  listCardShadow: {
    marginTop: 4,
    marginBottom: 12,
  },
  // Manipulate here: card padding 14 matches Design Law / mockup `.card`
  listCardShell: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  basketWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 4,
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
    gap: 12,
  },
  basketGrow: { flex: 1, minWidth: 0 },
  basketCount: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  basketKcal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    opacity: 0.85,
    marginTop: 1,
  },
  basketCta: {
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  basketCtaText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
});

export default FoodSearchScreen;
