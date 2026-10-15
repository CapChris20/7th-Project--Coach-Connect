// Food search screen: type a query → merge server hits → confirm & log into a meal.
// Flow: debounce search → normalize hits → recent/favorites browse → open Confirm sheet → logFood.
// Used by: LogTodaysMealsScreen and standalone Add Food. Server keys stay in server/.env.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { searchFoods, getRecentFoods, getFoodSearchHint, getFavoriteFoods, toggleFavoriteFood } from '../daily-log/saveLoggedFood';
import { resolveFoodBrandLabel } from '../food-details/tidyBrandName';
import { cleanSerperFoodTitle, isJunkWebSearchTitle } from '../food-search/tidyFoodTitles';
import { formatServingDisplayLine } from '../food-search/guessServingLabel';
import OutlinedColorText from '../../for-both/icons/OutlinedColorText';
import FoodSearchAccuracyHeroCard from '../food-search/SearchDisclaimerCard';
import FoodConfirmSheet from '../food-search/ConfirmFoodPopup';
import { HOME_STAT_SLEEP_GRADIENT } from '../../look-and-feel/homeStatColors';
import FoodCard from '../food-cards/FoodCard';
import { gradients, brandColors } from '../food-cards/foodCardColors';
import { foodCardText } from '../food-cards/foodCardText';
import { auth } from '../../app-start/cloudConnection';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== NAMED CONSTANTS =====

const HERO_TOP_BORDER = ['#BE185D', '#C2410C'];
const HERO_BG_DARK = ['#1a0a2e', '#0f0a1a'];
const HERO_BG_LIGHT = ['#F8FAFF', '#FFFFFF'];
const HERO_CTA_GRADIENT = ['#BE185D', '#C2410C'];
const SEARCH_DEBOUNCE_MS = 550;
/** Auto-search from 2+ chars (6 was too high — short queries like "egg" never fired). */
const MIN_CHARS_AUTO_SEARCH = 2;
const RECENT_FOODS_LIMIT = 15;
const SEARCH_RESULT_LIMIT = 20;
const SHELL_BOTTOM_INSET_EXTRA = 16;
const DEFAULT_LIST_BOTTOM_EXTRA = 32;
const MIN_SAFE_BOTTOM = 12;
const DEFAULT_SERVING_GRAMS = 100;
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };
const GRADIENT_DIAGONAL_END = { x: 1, y: 1 };
const ACTIVE_TAB_BG = 'rgba(190,24,93,0.2)';
const ACTIVE_TAB_BORDER = '#BE185D';

const QUICK_PICKS = [
  { label: 'Chicken Breast', icon: 'barbell-outline', accentKey: 'pink' },
  { label: 'Brown Rice', icon: 'leaf-outline', accentKey: 'orange' },
  { label: 'Greek Yogurt', icon: 'cafe-outline', accentKey: 'cyan' },
  { label: 'Avocado', icon: 'nutrition-outline', accentKey: 'orange' },
  { label: 'Salmon', icon: 'fish-outline', accentKey: 'cyan' },
  { label: 'Oatmeal', icon: 'restaurant-outline', accentKey: 'purple' },
];

// Static fallback for StyleSheets
const DARK = {
  text: '#ffffff',
  textMuted: '#A6A6A6',
  pink: brandColors.orangePink[1],
  orange: brandColors.orangePink[0],
  purple: brandColors.orangePurple[1],
  cyan: brandColors.cyanPurple[0],
  proteinGradient: gradients.protein,
  carbsGradient: gradients.carbs,
  fatGradient: gradients.fat,
  calGradient: gradients.calories,
  inputBg: '#1A1A24',
  borderGradient: ['#6D62CE', '#9468A8', '#4F87BA'],
};

// ===== HELPER FUNCTIONS =====

/**
 * Theme paint for the search screen (dark vs light).
 * @param {boolean} isDark
 * @returns {object}
 */
function getColors(isDark) {
  const shared = {
    pink: brandColors.orangePink[1],
    orange: brandColors.orangePink[0],
    purple: brandColors.orangePurple[1],
    cyan: brandColors.cyanPurple[0],
    gold: brandColors.goldPink[0],
    proteinGradient: gradients.protein,
    carbsGradient: gradients.carbs,
    fatGradient: gradients.fat,
    calGradient: gradients.calories,
    borderGradient: ['#6D62CE', '#9468A8', '#4F87BA'],
  };
  if (isDark) {
    return {
      ...shared,
      bg: '#0A0A0F',
      surface: '#1A1A24',
      border: '#2A2A35',
      text: '#FFFFFF',
      textMuted: '#A6A6A6',
      textDim: 'rgba(255,255,255,0.35)',
      inputBg: '#1A1A24',
      cardBg: '#1A1A24',
      cardBorder: '#2A2A35',
    };
  }
  return {
    ...shared,
    borderGradient: ['#7D72D4', '#9E72A4', '#5F92C4'],
    bg: '#FFFFFF',
    surface: '#F5F5F5',
    border: '#E5E5E5',
    text: '#0A0A0F',
    textMuted: '#666666',
    textDim: 'rgba(10,10,15,0.45)',
    inputBg: '#F5F5F5',
    cardBg: '#F5F5F5',
    cardBorder: '#E5E5E5',
  };
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
 * Serving line shown on the premium card.
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
 * Stable id string used for the favorites Set.
 * @param {object} item
 * @returns {string}
 */
function foodFavoriteId(item) {
  return String(item?.id || item?.food_id || item?.name || item?.food_name || '')
    .trim()
    .toLowerCase();
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
 * Which list the FlatList should show right now.
 * @param {object} options
 * @returns {Array}
 */
function pickListData({ showFavoritesBrowse, showRecent, showResults, favoriteFoods, recentFoods, results }) {
  if (showFavoritesBrowse) return favoriteFoods;
  if (showRecent) return recentFoods;
  if (showResults) return results;
  return [];
}

/**
 * List key prefix so FlatList remounts when the browse mode changes.
 * @param {boolean} showFavoritesBrowse
 * @param {boolean} showRecent
 * @returns {string}
 */
function listKeyForMode(showFavoritesBrowse, showRecent) {
  if (showFavoritesBrowse) return 'favorites';
  if (showRecent) return 'recent';
  return 'results';
}

/** Saved / recent history — same premium card as logged foods on DailyFoodLogScreen. */
function RecentHistoryFoodCard({ item, isDark, onAdd }) {
  const [expanded, setExpanded] = useState(false);
  const amount = formatServingLine(item);
  const food = useMemo(() => foodCardText(item, amount), [item, amount]);

  return (
    <View style={premiumSearchCardStyles.wrap}>
      <FoodCard
        food={food}
        expanded={expanded}
        embedded
        isDark={isDark}
        onToggle={() => setExpanded((wasExpanded) => !wasExpanded)}
        onAdd={() => onAdd(item)}
      />
    </View>
  );
}

/** Search hits — same logged-food card layout, plus to open confirm/log. */
function FoodResultRow({ item, onAdd, isDark = true, isFavorite = false, onToggleFavorite, query = '' }) {
  const [expanded, setExpanded] = useState(false);
  const amount = formatServingLine(item, query);
  const food = useMemo(() => foodCardText(item, amount), [item, amount]);

  return (
    <View style={premiumSearchCardStyles.wrap}>
      <FoodCard
        food={food}
        expanded={expanded}
        embedded
        isDark={isDark}
        onToggle={() => setExpanded((wasExpanded) => !wasExpanded)}
        onAdd={() => onAdd(item)}
        onFavorite={onToggleFavorite ? () => onToggleFavorite(item) : undefined}
        isFavorite={isFavorite}
      />
    </View>
  );
}

const premiumSearchCardStyles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
});

/**
 * Empty / quick-picks hero when there are no results or the user has not searched yet.
 */
function EmptyState({ query, onSuggestionPress, colors, isDark, hint }) {
  const palette = colors || DARK;
  const bgGradient = isDark ? HERO_BG_DARK : HERO_BG_LIGHT;
  const labelMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const subColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.65)';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const isNoResults = Boolean(query?.trim());
  const titleFill = isDark ? '#FFFFFF' : '#0A0A0F';
  const accentColor = palette.purple || brandColors.orangePurple[1];
  const accentSoft = palette.accentSoft || '#FDBA74';
  const accentMain = palette.accent || '#C2410C';

  return (
    <View style={empty.wrap}>
      <View
        style={[
          empty.glow,
          Platform.select({
            ios: {
              shadowColor: accentMain,
              shadowOpacity: isDark ? 0.35 : 0.15,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 4 },
          }),
        ]}
      >
        <View style={empty.cardClip}>
          <LinearGradient
            colors={HERO_TOP_BORDER}
            start={GRADIENT_LEFT}
            end={GRADIENT_RIGHT}
            style={empty.topBorder}
          />
          <LinearGradient colors={bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={empty.inner}>
            <View style={empty.iconRow}>
              <LinearGradient
                colors={[accentMain, accentSoft]}
                start={GRADIENT_LEFT}
                end={GRADIENT_DIAGONAL_END}
                style={empty.iconRing}
              >
                <View style={[empty.iconCore, { backgroundColor: isDark ? '#120818' : '#FFF5FA' }]}>
                  <Ionicons
                    name={isNoResults ? 'search-outline' : 'sparkles-outline'}
                    size={28}
                    color={accentMain}
                  />
                </View>
              </LinearGradient>
            </View>

            <Text style={[empty.kicker, { color: labelMuted }]}>
              {isNoResults ? 'NO MATCHES' : 'QUICK PICKS'}
            </Text>

            <OutlinedColorText
              fontSize={isNoResults ? 18 : 22}
              fontWeight="800"
              fillColor={titleFill}
              numberOfLines={2}
              style={empty.title}
            >
              {isNoResults ? `Nothing for "${query}"` : 'What are you eating?'}
            </OutlinedColorText>

            <Text style={[empty.subtitle, { color: subColor }]}>
              {isNoResults
                ? hint || 'Try a shorter name or a brand.'
                : 'Search packaged foods, restaurants, and groceries.'}
            </Text>

            {!isNoResults ? (
              <View style={empty.chipGrid}>
                {QUICK_PICKS.map(({ label, icon }) => (
                  <Pressable
                    key={label}
                    style={empty.chipPressable}
                    onPress={() => onSuggestionPress?.(label)}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${label}`}
                  >
                    <View style={[empty.chipInner, { backgroundColor: chipBg, borderColor: chipBorder, borderWidth: 1 }]}>
                      <View style={[empty.chipIcon, { backgroundColor: `${accentColor}22` }]}>
                        <Ionicons name={icon} size={16} color={accentColor} />
                      </View>
                      <Text style={[empty.chipLabel, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]} numberOfLines={1}>
                        {label}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {!isNoResults ? (
              <View style={[empty.tipRow, { borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                <Ionicons name="keypad-outline" size={14} color={labelMuted} />
                <Text style={[empty.tipText, { color: labelMuted }]}>
                  Type at least 2 characters — we search as you type
                </Text>
              </View>
            ) : null}
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap: {
    paddingTop: 8,
    paddingBottom: 12,
    width: '100%',
  },
  glow: {
    borderRadius: 22,
    width: '100%',
  },
  cardClip: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  topBorder: {
    height: 2,
    width: '100%',
  },
  inner: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: 16,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 22,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCore: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  title: {
    width: '100%',
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 8,
    maxWidth: 320,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    width: '100%',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  chipPressable: {
    width: '48%',
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  chipIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  tipText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
});

// ===== MAIN FUNCTION =====

/**
 * Search foods, browse recent/favorites, then confirm & log into the active meal.
 * @param {{ mealType?: string, defaultMeal?: string, onFoodSelected?: Function, onSelectFood?: Function, onClose?: Function, userId?: string, embedded?: boolean, reserveShellBottomNav?: boolean, initialQuery?: string }} props
 */
function FoodSearchScreen({
  mealType: mealTypeProp,
  defaultMeal,
  onFoodSelected,
  /** @deprecated use onFoodSelected — kept for LogTodaysMealsScreen */
  onSelectFood,
  onClose,
  userId,
  embedded = false,
  reserveShellBottomNav = false,
  initialQuery = '',
}) {
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const colors = useMemo(() => getColors(isDark), [isDark]);

  const mealType = useMemo(
    () => String(mealTypeProp || defaultMeal || 'breakfast').toLowerCase(),
    [mealTypeProp, defaultMeal],
  );

  const logFood = onFoodSelected || onSelectFood;

  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [emptyHint, setEmptyHint] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentHistoryExpanded, setRecentHistoryExpanded] = useState(true);
  const [pendingFood, setPendingFood] = useState(null);
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [browseTab, setBrowseTab] = useState('recent');
  const uid = userId || auth.currentUser?.uid;

  const confirmTheme = useMemo(
    () => ({
      screenBg: colors.bg,
      cardBg: colors.cardBg,
      cardBorder: colors.cardBorder,
      text: colors.text,
      textMuted: colors.textMuted,
      inputBg: colors.inputBg,
      orange: colors.orange,
      secondaryAction: colors.textMuted,
    }),
    [colors],
  );

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
        setFavoriteIds(new Set((favs || []).map((favorite) => String(favorite.foodId).toLowerCase())));
      } catch (err) {
        console.log('Favorite foods unavailable:', err.message);
        setFavoriteFoods([]);
      }
    };

    loadRecent();
    loadFavorites();
  }, [uid]);

  const handleToggleFavorite = useCallback(
    async (food) => {
      if (!uid || !food) return;
      try {
        const { favorites } = await toggleFavoriteFood(uid, food);
        setFavoriteIds(new Set((favorites || []).map((favorite) => String(favorite.foodId).toLowerCase())));
        setFavoriteFoods((favorites || []).map(normalizeFavoriteRow));
      } catch (err) {
        console.warn('toggle favorite:', err?.message || err);
      }
    },
    [uid],
  );

  // 1. Ask the server, drop junk titles, normalize for the confirm sheet.
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

  // 2. Debounce auto-search once the query is long enough.
  useEffect(() => {
    const trimmedQuery = String(query || '').trim();
    if (trimmedQuery.length === 0) {
      setResults([]);
      setHasSearched(false);
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
  }, [query, handleSearch]);

  const handleAddFood = (food) => {
    setPendingFood(food);
  };

  const handleConfirmFood = async (confirmedFood) => {
    setPendingFood(null);
    if (logFood && confirmedFood) await logFood(confirmedFood, mealType);
  };

  const onThemePress = () => {
    toggleTheme(isDark ? 'light' : 'dark');
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  const hasRecentHistory = recentFoods.length > 0;
  const hasFavorites = favoriteFoods.length > 0;
  const showFavoritesBrowse = !hasSearched && browseTab === 'favorites';
  const showRecent = !hasSearched && browseTab === 'recent' && hasRecentHistory && recentHistoryExpanded;
  const showResults = hasSearched && results.length > 0 && !loading;
  const showBrowseIdle = !hasSearched && !loading;
  const showEmpty =
    !loading &&
    ((hasSearched && results.length === 0) ||
      (showBrowseIdle && browseTab === 'recent' && !hasRecentHistory) ||
      (showFavoritesBrowse && !hasFavorites));

  const listBottomPad = embedded || reserveShellBottomNav
    ? shellBottomPad
    : Math.max(insets.bottom, MIN_SAFE_BOTTOM) + DEFAULT_LIST_BOTTOM_EXTRA;

  const listData = pickListData({
    showFavoritesBrowse,
    showRecent,
    showResults,
    favoriteFoods,
    recentFoods,
    results,
  });
  const listKey = listKeyForMode(showFavoritesBrowse, showRecent);

  const foodIsFavorite = (item) => favoriteIds.has(foodFavoriteId(item));

  const browseTabs = [
    { id: 'recent', label: 'Recent' },
    { id: 'favorites', label: 'Favorites' },
  ];

  const renderHeaderBlock = () => (
    <>
      {!embedded && (
        <View style={[screenStyles.topBar, { paddingTop: Math.max(insets.top, MIN_SAFE_BOTTOM) }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[screenStyles.topTitle, { color: colors.text }]} accessibilityRole="header">
            Add Food
          </Text>
          <TouchableOpacity
            onPress={onThemePress}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[screenStyles.searchOuter, embedded && screenStyles.searchOuterEmbedded]}>
        <LinearGradient
          colors={HOME_STAT_SLEEP_GRADIENT}
          start={GRADIENT_LEFT}
          end={GRADIENT_RIGHT}
          style={{ borderRadius: 16, padding: 1.5 }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.inputBg,
              borderRadius: 15,
              paddingHorizontal: 16,
              paddingVertical: 12,
              gap: 12,
            }}
          >
            <Ionicons name="search" size={20} color={colors.textMuted} />
            <TextInput
              style={{ flex: 1, fontSize: 16, color: colors.text }}
              placeholder="Search foods, brands, restaurants..."
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => handleSearch(query)}
              accessibilityLabel="Search foods"
              accessibilityHint="Search by food name, brand, or restaurant"
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={clearSearch}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      {searchError && (
        <View style={screenStyles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color={colors.orange} />
          <Text style={[screenStyles.errorText, { color: colors.orange }]}>{searchError}</Text>
        </View>
      )}

      {loading && (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.pink} size="large" />
          <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 12 }}>Searching foods...</Text>
        </View>
      )}

      {showBrowseIdle && <FoodSearchAccuracyHeroCard isDark={isDark} />}

      {showBrowseIdle ? (
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 0 }}>
          {browseTabs.map((tab) => {
            const isActive = browseTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setBrowseTab(tab.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: isActive ? ACTIVE_TAB_BG : colors.inputBg,
                  borderWidth: 1,
                  borderColor: isActive ? ACTIVE_TAB_BORDER : colors.cardBorder,
                }}
              >
                <Text
                  style={{
                    color: isActive ? ACTIVE_TAB_BORDER : colors.textMuted,
                    fontWeight: '700',
                    fontSize: 13,
                  }}
                >
                  {tab.id === 'favorites' ? `♥ ${tab.label}` : tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {showBrowseIdle && browseTab === 'recent' && hasRecentHistory && (
        <Pressable
          onPress={() => setRecentHistoryExpanded((wasExpanded) => !wasExpanded)}
          accessibilityRole="button"
          accessibilityLabel={
            recentHistoryExpanded ? 'Hide saved foods' : 'Show saved foods'
          }
          style={({ pressed }) => [
            screenStyles.historyBtnWrap,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={HERO_CTA_GRADIENT}
            start={GRADIENT_LEFT}
            end={GRADIENT_RIGHT}
            style={screenStyles.historyBtnGradient}
          >
            <Ionicons
              name={recentHistoryExpanded ? 'chevron-up' : 'time-outline'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={screenStyles.historyBtnText}>
              {recentHistoryExpanded ? 'Hide saved foods' : 'Show saved foods'}
            </Text>
          </LinearGradient>
        </Pressable>
      )}
    </>
  );

  const renderSectionTitle = () => {
    if (loading) return null;
    if (showRecent) {
      return (
        <View style={screenStyles.sectionTitleRowCompact}>
          <Text style={[screenStyles.sectionTitleCompact, { color: colors.textMuted }]}>
            {recentFoods.length} recent {recentFoods.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      );
    }
    if (showResults) {
      return (
        <View style={screenStyles.sectionTitleRow}>
          <Text style={[screenStyles.sectionTitleLeft, { color: colors.text }]}>Search results</Text>
          <Text style={[screenStyles.sectionTitleRight, { color: colors.textMuted }]}>
            {results.length} {results.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      );
    }
    return null;
  };

  const onSuggestionPress = (suggestion) => {
    setQuery(suggestion);
    handleSearch(suggestion);
  };

  const emptyQueryForHero = hasSearched ? query : '';
  const emptyHintForHero = hasSearched ? emptyHint : null;

  return (
    <>
      <View style={{ flex: 1, minHeight: 0, backgroundColor: embedded ? 'transparent' : colors.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, minHeight: 0 }}
          keyboardVerticalOffset={embedded ? 0 : Math.max(insets.top, MIN_SAFE_BOTTOM)}
        >
          <FlatList
            style={{ flex: 1 }}
            data={loading ? [] : listData}
            keyExtractor={(_, index) => `${listKey}-${index}`}
            ListHeaderComponent={
              <View>
                {renderHeaderBlock()}
                {showEmpty && !loading ? (
                  <EmptyState
                    query={emptyQueryForHero}
                    hint={emptyHintForHero}
                    isDark={isDark}
                    onSuggestionPress={onSuggestionPress}
                    colors={colors}
                  />
                ) : null}
                {renderSectionTitle()}
              </View>
            }
            renderItem={({ item }) =>
              showRecent ? (
                <RecentHistoryFoodCard item={item} isDark={isDark} onAdd={handleAddFood} />
              ) : (
                <FoodResultRow
                  item={item}
                  onAdd={handleAddFood}
                  isDark={isDark}
                  isFavorite={foodIsFavorite(item)}
                  onToggleFavorite={handleToggleFavorite}
                  query={query}
                />
              )
            }
            ListEmptyComponent={null}
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: listBottomPad,
              flexGrow: showEmpty && !loading ? 0 : 1,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            scrollEventThrottle={16}
            nestedScrollEnabled
            alwaysBounceVertical
          />
        </KeyboardAvoidingView>
      </View>
      <Modal visible={!!pendingFood} animationType="slide" presentationStyle="pageSheet">
        <FoodConfirmSheet
          food={pendingFood}
          theme={confirmTheme}
          showVerification={false}
          onConfirm={handleConfirmFood}
          onCancel={() => setPendingFood(null)}
        />
      </Modal>
    </>
  );
}

const screenStyles = StyleSheet.create({
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topTitle: { fontSize: 18, fontWeight: '700' },
  searchOuter: {
    marginTop: 16,
    marginBottom: 8,
  },
  searchOuterEmbedded: {
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(249,115,22,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { fontSize: 12, flex: 1 },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleLeft: { fontSize: 18, fontWeight: '700' },
  sectionTitleRight: { fontSize: 12, fontWeight: '500' },
  sectionTitleRowCompact: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitleCompact: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyBtnWrap: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  historyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  historyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});


export default FoodSearchScreen;
