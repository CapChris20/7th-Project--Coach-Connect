/**
 * COACHCONNECT — Food Search Screen (Full Rewrite)
 *
 * Search priority:
 *   1. Nutritionix  → best database, branded + restaurant foods
 *   2. USDA         → comprehensive free fallback
 *   3. Serper       → Google Search fallback for anything obscure
 *
 * All API keys live in server/.env — client never touches them.
 * Get your own free keys:
 *   Nutritionix: https://www.nutritionix.com/business/api
 *   USDA: https://fdc.nal.usda.gov/api-guide.html
 *   Serper: https://serper.dev (already have key)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { searchFoods, getRecentFoods, getFoodSearchHint } from '../services/nutritionService';
import { auth } from '../../app/config';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getColors(isDark) {
  const shared = {
    pink: '#FF6B9D',
    orange: '#F97316',
    cyan: '#64D2FF',
    purple: '#8B5CF6',
    hotPink: '#FF6B9D',
    /**
     * Border-only gradient: same family as the brand (cool violet → mauve → steel blue).
     * Less saturated than accent purple/orange/cyan so frames don’t read as a hard rainbow.
     */
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
        // Slightly lift border stops on light backgrounds so the edge stays visible but soft
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
  orange: '#F97316',
  hotPink: '#FF6B9D',
  purple: '#8B5CF6',
  cyan: '#64D2FF',
  inputBg: '#1A1A24',
  borderGradient: ['#6D62CE', '#9468A8', '#4F87BA'],
};

// Normalize into a "food" shape compatible with nutritionService.addFoodLog
const normalizeFood = (item) => {
  const round = (val) => Math.round(val ?? 0);
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

  return {
    name: item.name || item.food_name || item.description || 'Unknown Food',
    brand: item.brand || item.brand_name || item.brand_owner || item.brandOwner || '',
    servingSize: item.servingSize || item.serving_qty || item.serving_size || 1,
    servingUnit: item.servingUnit || item.serving_unit || item.servingSizeUnit || 'serving',
    servingGrams: item.servingGrams || item.serving_weight_grams || item.serving_grams || 100,
    calories: round(item.calories ?? item.nf_calories),
    protein: round(item.protein ?? item.nf_protein),
    carbs: round(item.carbs ?? item.nf_total_carbohydrate),
    fat: round(item.fat ?? item.nf_total_fat),
    fiber: round(item.fiber ?? item.nf_dietary_fiber),
    sugar: round(item.sugar ?? item.nf_sugars),
    sodium: round(item.sodium ?? item.nf_sodium),
    source: item.source || 'server',

    food_name: item.food_name || item.description || item.name || 'Unknown Food',
    brand_name: item.brand_name || item.brand_owner || item.brand || '',
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
  if (qty != null && unit && g) return `${qty} ${unit} (${Math.round(g)}g)`;
  if (qty != null && unit) return `${qty} ${unit}`;
  if (item.source === 'serper' || item.source === 'mixed') {
    return 'Portion: not specified in web snippet — edit after adding';
  }
  return '1 serving';
}

const FoodResultRow = ({ item, onAdd, colors }) => {
  const [adding, setAdding] = useState(false);
  const c = colors || DARK;
  const brand = (item.brand_name || item.brand || '').trim();

  const handleAdd = async () => {
    setAdding(true);
    await onAdd(item);
    setAdding(false);
  };

  return (
    <LinearGradient
      colors={c.borderGradient || DARK.borderGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      locations={[0, 0.5, 1]}
      style={{ borderRadius: 16, padding: 1.5, marginBottom: 12 }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          backgroundColor: c.surface,
          borderRadius: 15,
          padding: 16,
        }}
      >
        <View
          style={{
            height: 48,
            width: 48,
            borderRadius: 12,
            backgroundColor: c.border,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Ionicons name="restaurant" size={20} color={c.text} style={{ opacity: 0.85 }} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }} numberOfLines={1}>
                {item.food_name}
              </Text>
              {!!brand && (
                <Text style={{ fontSize: 12, color: c.textMuted, marginTop: 4 }} numberOfLines={1}>
                  {brand}
                </Text>
              )}
              <Text
                style={{ fontSize: 12, color: c.textMuted, marginTop: 4, opacity: 0.9 }}
                numberOfLines={2}
              >
                {formatServingLine(item)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: c.pink }}>{item.calories}</Text>
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: c.textMuted,
                  marginTop: 4,
                  letterSpacing: 0.5,
                }}
              >
                CAL
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.pink }}>Protein</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{item.protein}g</Text>
            </View>
            <Text style={{ fontSize: 12, color: c.textMuted, opacity: 0.4 }}>|</Text>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.orange }}>Carbs</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{item.carbs}g</Text>
            </View>
            <Text style={{ fontSize: 12, color: c.textMuted, opacity: 0.4 }}>|</Text>
            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.cyan }}>Fat</Text>
              <Text style={{ fontSize: 12, fontWeight: '600', color: c.text }}>{item.fat}g</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleAdd}
          disabled={adding}
          activeOpacity={0.85}
          style={{
            height: 40,
            width: 40,
            borderRadius: 20,
            backgroundColor: c.pink,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: c.pink,
            shadowOpacity: 0.4,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          {adding ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="add" size={22} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
};

const EmptyState = ({ query, onSuggestionPress, colors, hint }) => (
  <View style={empty.container}>
    <View
      style={[
        empty.iconCircle,
        { backgroundColor: (colors || DARK).surface || 'rgba(255,255,255,0.08)' },
      ]}
    >
      <Ionicons name="search" size={36} color={(colors || DARK).pink} />
    </View>
    <Text style={[empty.title, { color: (colors || DARK).text }]}>
      {query ? `No results for "${query}"` : 'Search for food'}
    </Text>
    <Text style={[empty.subtitle, { color: (colors || DARK).textMuted }]}>
      {query ? hint || 'Try a different name or check spelling' : 'Powered by USDA, Open Food Facts, and Google Search'}
    </Text>
    {!query && (
      <View style={empty.suggestionsRow}>
        {['Chicken Breast', 'Brown Rice', 'Greek Yogurt', 'Avocado', 'Salmon', 'Oatmeal'].map((s) => (
          <TouchableOpacity key={s} style={empty.chip} onPress={() => onSuggestionPress(s)} activeOpacity={0.8}>
            <Text style={[empty.chipText, { color: (colors || DARK).pink }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
);

const empty = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 40 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: { color: DARK.text, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: DARK.textMuted, fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  suggestionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20, justifyContent: 'center' },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.35)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255,107,157,0.08)',
  },
  chipText: { color: DARK.hotPink, fontSize: 12, fontWeight: '600' },
});

const FoodSearchScreen = ({
  mealType: mealTypeProp,
  defaultMeal,
  onFoodSelected,
  /** @deprecated use onFoodSelected — kept for MealPlanHomeScreen */
  onSelectFood,
  onClose,
  userId,
  embedded = false,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = useMemo(() => getColors(isDark), [isDark]);

  const mealType = useMemo(
    () => String(mealTypeProp || defaultMeal || 'breakfast').toLowerCase(),
    [mealTypeProp, defaultMeal]
  );

  const logFood = onFoodSelected || onSelectFood;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [emptyHint, setEmptyHint] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const uid = userId || auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const loadRecent = async () => {
      try {
        const recent = await getRecentFoods(uid, 10);
        setRecentFoods((recent || []).map(normalizeFood));
      } catch (err) {
        console.log('Recent foods unavailable:', err.message);
        setRecentFoods([]);
      }
    };
    loadRecent();
  }, [uid]);

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
      setResults((raw || []).map(normalizeFood));
      setEmptyHint(getFoodSearchHint());
    } catch (err) {
      console.error('Food search error:', err);
      setSearchError('Search failed. Make sure the server is running.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const SEARCH_DEBOUNCE_MS = 700;
  const MIN_CHARS_AUTO_SEARCH = 6;

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

  const handleAddFood = async (food) => {
    if (logFood) await logFood(food, mealType);
  };

  const onThemePress = () => {
    toggleTheme(isDark ? 'light' : 'dark');
  };

  const showRecent = !hasSearched && recentFoods.length > 0;
  const showResults = hasSearched && results.length > 0 && !loading;
  const showEmpty = !loading && ((!hasSearched && recentFoods.length === 0) || (hasSearched && results.length === 0));

  const listBottomPad = embedded ? 12 : 24;
  const listData = showRecent ? recentFoods : showResults ? results : [];
  const listKey = showRecent ? 'recent' : 'results';

  const renderHeaderBlock = () => (
    <>
      {!embedded && (
        <View
          style={[
            fs.topBar,
            { paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[fs.topTitle, { color: colors.text }]}>Add Food</Text>
          <TouchableOpacity onPress={onThemePress} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name={isDark ? 'sunny' : 'moon'} size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}

      <View style={[fs.searchOuter, embedded && fs.searchOuterEmbedded]}>
        <LinearGradient
          colors={colors.borderGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          locations={[0, 0.5, 1]}
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
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textDim} />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>

      {searchError && (
        <View style={[fs.errorBanner, { marginHorizontal: 20 }]}>
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
    </>
  );

  const renderSectionTitle = () => {
    if (loading) return null;
    if (showRecent) {
      return (
        <View style={fs.sectionTitleRow}>
          <Text style={[fs.sectionTitleLeft, { color: colors.text }]}>Recently Logged</Text>
          <Text style={[fs.sectionTitleRight, { color: colors.textMuted }]}>
            {recentFoods.length} {recentFoods.length === 1 ? 'item' : 'items'}
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <FlatList
          data={loading ? [] : listData}
          keyExtractor={(_, i) => `${listKey}-${i}`}
          ListHeaderComponent={
            <View>
              {renderHeaderBlock()}
              {renderSectionTitle()}
            </View>
          }
          renderItem={({ item }) => (
            <FoodResultRow item={item} onAdd={handleAddFood} colors={colors} />
          )}
          ListEmptyComponent={
            showEmpty && !loading ? (
              <EmptyState
                query={hasSearched ? query : ''}
                hint={hasSearched ? emptyHint : null}
                onSuggestionPress={(s) => {
                  setQuery(s);
                  handleSearch(s);
                }}
                colors={colors}
              />
            ) : null
          }
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: listBottomPad,
            flexGrow: 1,
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      </KeyboardAvoidingView>
    </View>
  );
};

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
});

export default FoodSearchScreen;
