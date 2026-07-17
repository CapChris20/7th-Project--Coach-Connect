/**
 * Food Search Screen
 *
 * Purpose: UI screen or component: Food Search Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: (see file)
 *
 * @file-header
 */
/**
 * COACHCONNECT — Food Search Screen
 *
 * Server pipeline (keys in server/.env only):
 *   Branded / restaurant → FatSecret → Serper → USDA
 *   Packaged grocery     → USDA → FatSecret → OFF → Serper
 */

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
import { searchFoods, getRecentFoods, getFoodSearchHint, getFavoriteFoods, toggleFavoriteFood } from '../daily-log/logFoodToFirestore';
import { resolveFoodBrandLabel, shouldShowFoodBrandSubtitle } from '../food-details/cleanFoodBrandName';
import { cleanSerperFoodTitle, isJunkWebSearchTitle } from '../food-search/cleanFoodCardLabels';
import BrandGradientStrokeText from '../../shared/components/icons/BrandGradientStrokeText';
import FoodSearchAccuracyHeroCard from '../food-search/SearchQualityCard';
import FoodConfirmSheet from '../food-search/ConfirmFoodSelectionSheet';
import { HOME_STAT_SLEEP_GRADIENT } from '../../shared-ui/homeStatGradients';
import FoodCard from '../components/premiumFoodCard/FoodCard';
import GradientText from '../components/premiumFoodCard/GradientText';
import { gradients, brandGradients } from '../components/premiumFoodCard/theme';
import { formatLoggedFoodDisplay } from '../components/premiumFoodCard/formatLoggedFoodDisplay';
import { auth } from '../../app-start/config';
import { useTheme } from '../../shared-ui/ThemeContext';
import { useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HERO_TOP_BORDER = ['#BE185D', '#C2410C'];
const HERO_BG_DARK = ['#1a0a2e', '#0f0a1a'];
const HERO_BG_LIGHT = ['#F8FAFF', '#FFFFFF'];
const HERO_CTA_GRADIENT = ['#BE185D', '#C2410C'];

function getColors(isDark) {
  const shared = {
    pink: brandGradients.orangePink[1],
    orange: brandGradients.orangePink[0],
    purple: brandGradients.orangePurple[1],
    cyan: brandGradients.cyanPurple[0],
    gold: brandGradients.goldPink[0],
    proteinGradient: gradients.protein,
    carbsGradient: gradients.carbs,
    fatGradient: gradients.fat,
    calGradient: gradients.calories,
    borderGradient: ['#6D62CE', '#9468A8', '#4F87BA'],
  };
  return isDark
    ? {
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
      }
    : {
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

// Static fallback for StyleSheets
const DARK = {
  text: '#ffffff',
  textMuted: '#A6A6A6',
  pink: brandGradients.orangePink[1],
  orange: brandGradients.orangePink[0],
  purple: brandGradients.orangePurple[1],
  cyan: brandGradients.cyanPurple[0],
  proteinGradient: gradients.protein,
  carbsGradient: gradients.carbs,
  fatGradient: gradients.fat,
  calGradient: gradients.calories,
  inputBg: '#1A1A24',
  borderGradient: ['#6D62CE', '#9468A8', '#4F87BA'],
};

// Normalize into a "food" shape compatible with nutritionService.addFoodLog
const normalizeFood = (item, searchQuery = '') => {
  const roundMacro = (val) => {
    if (val == null || val === '') return 0;
    const n = Number(val);
    return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
  };
  const roundCal = (val) => Math.round(Number(val) || 0);
  const meta = item?.metadata && typeof item.metadata === 'object' ? item.metadata : {};

  const portion_text =
    item.serving_label ||
    item.servingLabel ||
    item.householdServingFullText ||
    meta.serving_label ||
    meta.servingLabel ||
    meta.householdServingFullText ||
    (() => {
      const u = String(item.serving_unit || item.servingUnit || '').trim();
      if (u && !/^(serving|portion|each|g|gram|grams|ml)$/i.test(u)) return u;
      return null;
    })();

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
    servingGrams: item.servingGrams || item.serving_weight_grams || item.serving_grams || 100,
    labelServingGrams: item.labelServingGrams || null,
    dataBasis: item.dataBasis || null,
    calories: roundCal(item.calories ?? item.nf_calories),
    protein: roundMacro(item.protein ?? item.nf_protein),
    carbs: roundMacro(item.carbs ?? item.nf_total_carbohydrate),
    fat: roundMacro(item.fat ?? item.nf_total_fat),
    fiber: roundMacro(item.fiber ?? item.nf_dietary_fiber),
    sugar: roundMacro(item.sugar ?? item.nf_sugars),
    sodium: roundCal(item.sodium ?? item.nf_sodium),
    source: item.source || 'server',
    nutrition_unverified: Boolean(item.nutrition_unverified),
    needsVerification: Boolean(item.needsVerification),
    multiServingFallback: Boolean(item.multiServingFallback),
    servingMultiplier: item.servingMultiplier ?? null,

    food_name: foodName,
    brand_name: brandLabel,
    serving_size: item.serving_qty || item.servingSize || 1,
    serving_unit: item.serving_unit || item.servingUnit || 'serving',
    serving_grams: item.serving_weight_grams || item.servingGrams || 100,
    serving_label: item.serving_label || item.servingLabel || item.householdServingFullText || null,
    portion_text,

    metadata: item,
  };
};

function formatServingLine(item) {
  if (item.portion_text) return item.portion_text;
  const qty = item.serving_size;
  const unit = (item.serving_unit || 'serving').trim();
  const g = item.serving_grams;
  const unitLower = unit.toLowerCase();
  if ((unitLower === 'grams' || unitLower === 'gram' || unitLower === 'g') && g) return `${Math.round(g)}g`;
  if (qty != null && unit && g && !/^(grams?|g|serving|portion|each|ml)$/i.test(unitLower)) {
    return `${qty} ${unit} (${Math.round(g)}g)`;
  }
  if (g) return `${Math.round(g)}g serving`;
  if (qty != null && unit) return `${qty} ${unit}`;
  if (item.source === 'serper' || item.source === 'mixed') {
    return 'Estimated serving — adjust after adding';
  }
  return '1 serving';
}

/** Saved / recent history — same premium card as logged foods on NutritionScreen. */
const RecentHistoryFoodCard = ({ item, isDark, onAdd }) => {
  const [expanded, setExpanded] = useState(false);
  const amount = formatServingLine(item);
  const food = useMemo(() => formatLoggedFoodDisplay(item, amount), [item, amount]);

  return (
    <View style={recentHistoryCardStyles.wrap}>
      <FoodCard
        food={food}
        expanded={expanded}
        embedded
        isDark={isDark}
        onToggle={() => setExpanded((v) => !v)}
        onEdit={() => onAdd(item)}
      />
    </View>
  );
};

const recentHistoryCardStyles = StyleSheet.create({
  wrap: {
    marginBottom: 10,
  },
});

const FoodResultRow = ({ item, onAdd, colors, isDark = true, isFavorite = false, onToggleFavorite }) => {
  const [adding, setAdding] = useState(false);
  const c = colors || DARK;
  const foodTitle = item.food_name || item.name || '';
  const brand = resolveFoodBrandLabel(foodTitle, item.brand_name || item.brand || '').trim();
  const showBrand = shouldShowFoodBrandSubtitle(foodTitle, brand);
  const bgGradient = isDark ? HERO_BG_DARK : HERO_BG_LIGHT;
  const labelMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const pillText = isDark ? '#FFFFFF' : '#0A0A0F';
  const titleFill = isDark ? '#FFFFFF' : '#0A0A0F';

  const handleAdd = async () => {
    setAdding(true);
    await onAdd(item);
    setAdding(false);
  };

  const MacroStat = ({ label, value }) => {
    const grams = Math.round(Number(value) || 0);
    return (
      <View style={foodCardStyles.macroItem}>
        <Text style={[foodCardStyles.macroLabel, { color: labelMuted }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[foodCardStyles.macroValue, { color: pillText }]}>{grams}g</Text>
      </View>
    );
  };

  return (
    <View
      style={[
        foodCardStyles.wrapper,
        Platform.select({
          ios: {
            shadowColor: '#BE185D',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isDark ? 0.28 : 0.12,
            shadowRadius: 10,
          },
          android: { elevation: 6 },
        }),
      ]}
    >
      <View style={foodCardStyles.clip}>
        <LinearGradient
          colors={HERO_TOP_BORDER}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={foodCardStyles.topBorder}
        />
        <LinearGradient colors={bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={foodCardStyles.inner}>
          <View style={foodCardStyles.mainRow}>
            <View style={foodCardStyles.iconWrap}>
              <Ionicons name="restaurant-outline" size={18} color={labelMuted} />
            </View>

            <View style={foodCardStyles.body}>
              <Text
                style={[foodCardStyles.title, { color: titleFill }]}
                numberOfLines={4}
                ellipsizeMode="tail"
              >
                {foodTitle}
              </Text>

              {showBrand ? (
                <Text style={[foodCardStyles.brand, { color: labelMuted }]} numberOfLines={1}>
                  {brand}
                </Text>
              ) : null}

              <Text style={[foodCardStyles.serving, { color: labelMuted }]} numberOfLines={2}>
                {formatServingLine(item)}
              </Text>

              {item.multiServingFallback ? (
                <Text style={foodCardStyles.warn}>
                  Multi-serving estimate{item.servingMultiplier ? ` (÷${item.servingMultiplier})` : ''} — confirm on menu
                </Text>
              ) : item.nutrition_unverified ? (
                <Text style={foodCardStyles.warn}>Unverified — confirm on menu before logging</Text>
              ) : null}

              <View style={foodCardStyles.macroRow}>
                <MacroStat label="Protein" value={item.protein} />
                <MacroStat label="Carbs" value={item.carbs} />
                <MacroStat label="Fat" value={item.fat} />
              </View>
            </View>

            <View style={foodCardStyles.sideCol}>
              <TouchableOpacity
                onPress={() => onToggleFavorite?.(item)}
                hitSlop={8}
                style={{ marginBottom: 6, alignSelf: 'flex-end' }}
                accessibilityRole="button"
                accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={22} color={isFavorite ? '#BE185D' : labelMuted} />
              </TouchableOpacity>
              <GradientText colors={c.calGradient} style={foodCardStyles.calValue} numberOfLines={1}>
                {item.calories}
              </GradientText>
              <Text style={[foodCardStyles.calLabel, { color: labelMuted }]}>CAL</Text>
              <TouchableOpacity
                onPress={handleAdd}
                disabled={adding}
                activeOpacity={0.88}
                style={foodCardStyles.addHit}
                accessibilityRole="button"
                accessibilityLabel="Add food to log"
              >
                <LinearGradient colors={HERO_CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={foodCardStyles.addBtn}>
                  {adding ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Ionicons name="add" size={22} color="#FFFFFF" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
};

const QUICK_PICKS = [
  { label: 'Chicken Breast', icon: 'barbell-outline', accentKey: 'pink' },
  { label: 'Brown Rice', icon: 'leaf-outline', accentKey: 'orange' },
  { label: 'Greek Yogurt', icon: 'cafe-outline', accentKey: 'cyan' },
  { label: 'Avocado', icon: 'nutrition-outline', accentKey: 'orange' },
  { label: 'Salmon', icon: 'fish-outline', accentKey: 'cyan' },
  { label: 'Oatmeal', icon: 'restaurant-outline', accentKey: 'purple' },
];

const EmptyState = ({ query, onSuggestionPress, colors, isDark, hint }) => {
  const c = colors || DARK;
  const bgGradient = isDark ? HERO_BG_DARK : HERO_BG_LIGHT;
  const labelMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const subColor = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.65)';
  const chipBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.92)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
  const isNoResults = Boolean(query?.trim());
  const titleFill = isDark ? '#FFFFFF' : '#0A0A0F';

  const accentColor = () => c.purple || brandGradients.orangePurple[1];

  return (
    <View style={empty.wrap}>
      <View
        style={[
          empty.glow,
          Platform.select({
            ios: {
              shadowColor: c.accent || '#C2410C',
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
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={empty.topBorder}
          />
          <LinearGradient colors={bgGradient} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={empty.inner}>
            <View style={empty.iconRow}>
              <LinearGradient
                colors={[c.accent || '#C2410C', c.accentSoft || '#FDBA74']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={empty.iconRing}
              >
                <View style={[empty.iconCore, { backgroundColor: isDark ? '#120818' : '#FFF5FA' }]}>
                  <Ionicons
                    name={isNoResults ? 'search-outline' : 'sparkles-outline'}
                    size={28}
                    color={c.accent || '#C2410C'}
                  />
                </View>
              </LinearGradient>
            </View>

            <Text style={[empty.kicker, { color: labelMuted }]}>
              {isNoResults ? 'NO MATCHES' : 'QUICK PICKS'}
            </Text>

            <BrandGradientStrokeText
              fontSize={isNoResults ? 18 : 22}
              fontWeight="800"
              fillColor={titleFill}
              numberOfLines={2}
              style={empty.title}
            >
              {isNoResults ? `Nothing for "${query}"` : 'What are you eating?'}
            </BrandGradientStrokeText>

            <Text style={[empty.subtitle, { color: subColor }]}>
              {isNoResults
                ? hint || 'Try a shorter name or a brand.'
                : 'Search packaged foods, restaurants, and groceries.'}
            </Text>

            {!isNoResults ? (
              <View style={empty.chipGrid}>
                {QUICK_PICKS.map(({ label, icon, accentKey }) => (
                  <Pressable
                    key={label}
                    style={empty.chipPressable}
                    onPress={() => onSuggestionPress?.(label)}
                    accessibilityRole="button"
                    accessibilityLabel={`Search ${label}`}
                  >
                    <View style={[empty.chipInner, { backgroundColor: chipBg, borderColor: chipBorder, borderWidth: 1 }]}>
                      <View style={[empty.chipIcon, { backgroundColor: `${accentColor()}22` }]}>
                        <Ionicons name={icon} size={16} color={accentColor()} />
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
};

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

const FoodSearchScreen = ({
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
}) => {
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const shellBottomPad = useShellBottomNavInset(16);
  const colors = useMemo(() => getColors(isDark), [isDark]);

  const mealType = useMemo(
    () => String(mealTypeProp || defaultMeal || 'breakfast').toLowerCase(),
    [mealTypeProp, defaultMeal]
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
  const [browseTab, setBrowseTab] = useState('recent'); // 'recent' | 'favorites'
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
        const recent = await getRecentFoods(uid, 15);
        setRecentFoods((recent || []).map(normalizeFood));
      } catch (err) {
        console.log('Recent foods unavailable:', err.message);
        setRecentFoods([]);
      }
    };
    const loadFavorites = async () => {
      try {
        const favs = await getFavoriteFoods(uid);
        const mapped = (favs || []).map((f) =>
          normalizeFood({
            id: f.foodId,
            name: f.foodName,
            food_name: f.foodName,
            calories: f.calories,
            protein: f.macros?.protein,
            carbs: f.macros?.carbs,
            fat: f.macros?.fat,
            brand: f.brand,
            servingGrams: f.servingGrams,
            servingSize: f.servingSize,
            servingUnit: f.servingUnit,
            dataBasis: f.dataBasis,
            source: f.source,
          }),
        );
        setFavoriteFoods(mapped);
        setFavoriteIds(new Set((favs || []).map((f) => String(f.foodId).toLowerCase())));
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
        const { favorited, favorites } = await toggleFavoriteFood(uid, food);
        setFavoriteIds(new Set((favorites || []).map((f) => String(f.foodId).toLowerCase())));
        setFavoriteFoods(
          (favorites || []).map((f) =>
            normalizeFood({
              id: f.foodId,
              name: f.foodName,
              food_name: f.foodName,
              calories: f.calories,
              protein: f.macros?.protein,
              carbs: f.macros?.carbs,
              fat: f.macros?.fat,
              brand: f.brand,
              servingGrams: f.servingGrams,
              servingSize: f.servingSize,
              servingUnit: f.servingUnit,
              dataBasis: f.dataBasis,
              source: f.source,
            }),
          ),
        );
      } catch (e) {
        console.warn('toggle favorite:', e?.message || e);
      }
    },
    [uid],
  );

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
      const raw = await searchFoods(searchQuery, 20);
      const q = searchQuery.trim();
      setResults(
        (raw || [])
          .filter((item) => {
            const title = item?.name || item?.food_name || '';
            return !isJunkWebSearchTitle(title);
          })
          .map((item) => normalizeFood(item, q)),
      );
      setEmptyHint(getFoodSearchHint());
    } catch (err) {
      console.error('Food search error:', err);
      setSearchError('Search failed. Make sure the server is running.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const SEARCH_DEBOUNCE_MS = 550;
  /** Auto-search from 2+ chars (6 was too high — short queries like "egg" never fired). */
  const MIN_CHARS_AUTO_SEARCH = 2;

  useEffect(() => {
    const q = String(query || '').trim();
    if (q.length === 0) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    if (q.length < MIN_CHARS_AUTO_SEARCH) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch(q);
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

  // Floating shell nav overlays when embedded; useShellBottomNavInset already includes safe area.
  const listBottomPad =
    embedded || reserveShellBottomNav
      ? shellBottomPad
      : Math.max(insets.bottom, 12) + 32;
  const listData = showFavoritesBrowse
    ? favoriteFoods
    : showRecent
      ? recentFoods
      : showResults
        ? results
        : [];
  const listKey = showFavoritesBrowse ? 'favorites' : showRecent ? 'recent' : 'results';

  const foodIsFavorite = (item) => {
    const id = String(item?.id || item?.food_id || item?.name || item?.food_name || '')
      .trim()
      .toLowerCase();
    return favoriteIds.has(id);
  };

  const renderHeaderBlock = () => (
    <>
      {!embedded && (
        <View
          style={[
            fs.topBar,
            { paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[fs.topTitle, { color: colors.text }]} accessibilityRole="header">
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

      <View style={[fs.searchOuter, embedded && fs.searchOuterEmbedded]}>
        <LinearGradient
          colors={HOME_STAT_SLEEP_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
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
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
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
        <View style={fs.errorBanner}>
          <Ionicons name="warning-outline" size={14} color={colors.orange} />
          <Text style={[fs.errorText, { color: colors.orange }]}>{searchError}</Text>
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
          {[
            { id: 'recent', label: 'Recent' },
            { id: 'favorites', label: 'Favorites' },
          ].map((tab) => {
            const active = browseTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                onPress={() => setBrowseTab(tab.id)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderRadius: 999,
                  backgroundColor: active ? 'rgba(190,24,93,0.2)' : colors.inputBg,
                  borderWidth: 1,
                  borderColor: active ? '#BE185D' : colors.cardBorder,
                }}
              >
                <Text style={{ color: active ? '#BE185D' : colors.textMuted, fontWeight: '700', fontSize: 13 }}>
                  {tab.id === 'favorites' ? `♥ ${tab.label}` : tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {showBrowseIdle && browseTab === 'recent' && hasRecentHistory && (
        <Pressable
          onPress={() => setRecentHistoryExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={
            recentHistoryExpanded ? 'Hide saved foods' : 'Show saved foods'
          }
          style={({ pressed }) => [
            fs.historyBtnWrap,
            pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
          ]}
        >
          <LinearGradient
            colors={HERO_CTA_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={fs.historyBtnGradient}
          >
            <Ionicons
              name={recentHistoryExpanded ? 'chevron-up' : 'time-outline'}
              size={16}
              color="#FFFFFF"
            />
            <Text style={fs.historyBtnText}>
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
        <View style={fs.sectionTitleRowCompact}>
          <Text style={[fs.sectionTitleCompact, { color: colors.textMuted }]}>
            {recentFoods.length} recent {recentFoods.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      );
    }
    if (showResults) {
      return (
        <View style={fs.sectionTitleRow}>
          <Text style={[fs.sectionTitleLeft, { color: colors.text }]}>Search results</Text>
          <Text style={[fs.sectionTitleRight, { color: colors.textMuted }]}>
            {results.length} {results.length === 1 ? 'item' : 'items'}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <>
    <View style={{ flex: 1, minHeight: 0, backgroundColor: embedded ? 'transparent' : colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, minHeight: 0 }}
        keyboardVerticalOffset={embedded ? 0 : Math.max(insets.top, 12)}
      >
        <FlatList
          style={{ flex: 1 }}
          data={loading ? [] : listData}
          keyExtractor={(_, i) => `${listKey}-${i}`}
          ListHeaderComponent={
            <View>
              {renderHeaderBlock()}
              {showEmpty && !loading ? (
                <EmptyState
                  query={hasSearched ? query : ''}
                  hint={hasSearched ? emptyHint : null}
                  isDark={isDark}
                  onSuggestionPress={(s) => {
                    setQuery(s);
                    handleSearch(s);
                  }}
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
                colors={colors}
                isDark={isDark}
                isFavorite={foodIsFavorite(item)}
                onToggleFavorite={handleToggleFavorite}
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
        onConfirm={handleConfirmFood}
        onCancel={() => setPendingFood(null)}
      />
    </Modal>
    </>
  );
};

const foodCardStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
    borderRadius: 18,
  },
  clip: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  topBorder: {
    height: 2,
    width: '100%',
  },
  inner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    overflow: 'hidden',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(100,210,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  brand: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  serving: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 16,
  },
  warn: {
    fontSize: 11,
    color: '#F59E0B',
    marginTop: 6,
    fontWeight: '600',
    lineHeight: 15,
  },
  macroRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  macroItem: {
    flex: 1,
    minWidth: 0,
  },
  macroLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  macroValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  sideCol: {
    alignItems: 'flex-end',
    flexShrink: 0,
    width: 64,
    paddingTop: 2,
  },
  calValue: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
    maxWidth: 64,
    textAlign: 'right',
  },
  calLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
    marginBottom: 8,
  },
  addHit: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

const fs = StyleSheet.create({
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
