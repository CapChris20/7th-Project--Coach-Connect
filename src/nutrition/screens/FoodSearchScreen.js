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
import { searchFoods, getRecentFoods } from '../services/nutritionService';
import { auth } from '../../app/config';
import { useTheme } from '../../shared/ui/ThemeContext';

const ACCENT = {
  hotPink: '#FF6B9D', // Keep your hot pink
  orange: '#F97316', // Keep your orange
  purple: '#C084FC', // Keep your light purple
  cyan: '#06B6D4', // Keep your cyan
  green: '#22C55E', // Keep your green
};

function getColors(isDark) {
  return isDark
    ? {
        ...ACCENT,
        bg: '#0A0A0F',
        cardBg: 'rgba(255,255,255,0.08)',
        cardBorder: 'rgba(255,255,255,0.14)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.5)',
        textDim: 'rgba(255,255,255,0.35)',
        inputBg: 'rgba(255,255,255,0.07)',
      }
    : {
        ...ACCENT,
        bg: '#FFFFFF',
        cardBg: 'rgba(0,0,0,0.03)',
        cardBorder: 'rgba(0,0,0,0.08)',
        text: '#1a0a2e',
        textMuted: 'rgba(26,10,46,0.6)',
        textDim: 'rgba(26,10,46,0.45)',
        inputBg: 'rgba(0,0,0,0.05)',
      };
}

// Static fallback for StyleSheets (no C at module level to avoid ReferenceError in some runtimes)
const DARK = {
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  orange: '#F97316', // Keep your orange
  hotPink: '#FF6B9D', // Keep your hot pink
  purple: '#C084FC', // Keep your light purple
  cyan: '#06B6D4', // Keep your cyan
  inputBg: 'rgba(255,255,255,0.07)',
};

// Normalize into a "food" shape compatible with nutritionService.addFoodLog
const normalizeFood = (item) => {
  // Round to whole numbers for cleaner display
  const round = (val) => Math.round(val ?? 0);
  
  return {
    // Preferred addFoodLog fields
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

    // UI-friendly aliases
    food_name: item.food_name || item.description || item.name || 'Unknown Food',
    brand_name: item.brand_name || item.brand_owner || item.brand || '',
    serving_size: item.serving_qty || item.servingSize || 1,
    serving_unit: item.serving_unit || item.servingUnit || 'serving',
    serving_grams: item.serving_weight_grams || item.servingGrams || 100,

    metadata: item,
  };
};

const getMealColor = (mealType) => {
  switch (mealType?.toLowerCase()) {
    case 'breakfast': return ACCENT.orange;
    case 'lunch': return ACCENT.cyan;
    case 'dinner': return ACCENT.purple;
    case 'snacks': return ACCENT.hotPink;
    default: return ACCENT.hotPink;
  }
};

const FoodResultRow = ({ item, onAdd, mealType, colors }) => {
  const [adding, setAdding] = useState(false);
  const accentColor = getMealColor(mealType);

  const handleAdd = async () => {
    setAdding(true);
    await onAdd(item);
    setAdding(false);
  };

  const c = colors || DARK;
  return (
    <View style={[row.container, { borderBottomColor: c.inputBg || 'rgba(255,255,255,0.06)' }]}>
      <LinearGradient
        colors={[accentColor + '28', (c.purple || ACCENT.purple) + '20']}
        style={row.iconCircle}
      >
        <Text style={{ fontSize: 18 }}>🍽️</Text>
      </LinearGradient>

      <View style={{ flex: 1 }}>
        <Text style={[row.name, { color: c.text }]} numberOfLines={1}>{item.food_name}</Text>
        <Text style={[row.meta, { color: c.textMuted }]}>
          {item.brand ? `${item.brand} · ` : ''}{item.serving_size} {item.serving_unit} · {item.calories} cal
        </Text>
        <View style={row.macroPills}>
          <View style={[row.pill, { borderColor: (c.hotPink || ACCENT.hotPink) + '80' }]}>
            <Text style={[row.pillText, { color: c.hotPink || ACCENT.hotPink }]}>P {item.protein}g</Text>
          </View>
          <View style={[row.pill, { borderColor: (c.orange || ACCENT.orange) + '80' }]}>
            <Text style={[row.pillText, { color: c.orange || ACCENT.orange }]}>C {item.carbs}g</Text>
          </View>
          <View style={[row.pill, { borderColor: (c.cyan || ACCENT.cyan) + '80' }]}>
            <Text style={[row.pillText, { color: c.cyan || ACCENT.cyan }]}>F {item.fat}g</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity onPress={handleAdd} disabled={adding} activeOpacity={0.85}>
        <LinearGradient
          colors={adding ? [(c.inputBg || 'rgba(255,255,255,0.08)'), (c.inputBg || 'rgba(255,255,255,0.08)')] : [(c.hotPink || ACCENT.hotPink), (c.purple || ACCENT.purple)]}
          style={row.addBtn}
        >
          {adding
            ? <ActivityIndicator size={14} color="white" />
            : <Ionicons name="add" size={20} color="white" />
          }
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const row = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  iconCircle: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { color: DARK.text, fontSize: 14, fontWeight: '600' },
  meta: { color: DARK.textMuted, fontSize: 11, marginTop: 2 },
  macroPills: { flexDirection: 'row', gap: 6, marginTop: 6 },
  pill: { borderWidth: 1, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 10, fontWeight: '600' },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
});

const EmptyState = ({ query, onSuggestionPress, colors }) => (
  <View style={empty.container}>
    <LinearGradient
      colors={['rgba(255,107,157,0.20)', 'rgba(192,132,252,0.20)']}
      style={empty.iconCircle}
    >
      <Text style={{ fontSize: 32 }}>🔍</Text>
    </LinearGradient>
    <Text style={[empty.title, { color: (colors || DARK).text }]}>
      {query ? `No results for "${query}"` : 'Search for food'}
    </Text>
    <Text style={[empty.subtitle, { color: (colors || DARK).textMuted }]}>
      {query
        ? 'Try a different name or check spelling'
        : 'Powered by USDA, Open Food Facts, and Google Search'
      }
    </Text>
    {!query && (
      <View style={empty.suggestionsRow}>
        {['Chicken Breast', 'Brown Rice', 'Greek Yogurt', 'Avocado', 'Salmon', 'Oatmeal'].map(s => (
          <TouchableOpacity key={s} style={empty.chip} onPress={() => onSuggestionPress(s)} activeOpacity={0.8}>
            <Text style={[empty.chipText, { color: (colors || DARK).hotPink }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )}
  </View>
);

const empty = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: 40 },
  iconCircle: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
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

const FoodSearchScreen = ({ mealType = 'breakfast', onFoodSelected, onClose, userId }) => {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const uid = userId || auth.currentUser?.uid;
  const accentColor = getMealColor(mealType);
  const mealLabel = mealType ? mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase() : 'Meal';

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
    setHasSearched(true);
    try {
      const raw = await searchFoods(searchQuery, 20);
      setResults((raw || []).map(normalizeFood));
    } catch (err) {
      console.error('Food search error:', err);
      setSearchError('Search failed. Make sure the server is running.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) handleSearch(query);
      else if (query.length === 0) { setResults([]); setHasSearched(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const handleAddFood = async (food) => {
    if (onFoodSelected) await onFoodSelected(food, mealType);
  };

  const showRecent = !hasSearched && recentFoods.length > 0;
  const showResults = hasSearched && results.length > 0 && !loading;
  const showEmpty = (!loading && ((!hasSearched && recentFoods.length === 0) || (hasSearched && results.length === 0)));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>

        {/* Header */}
        <View style={fs.header}>
          <View style={{ flex: 1 }}>
            <Text style={[fs.headerTitle, { color: colors.text }]}>Add Food</Text>
            <View style={fs.mealBadge}>
              <View style={[fs.mealDot, { backgroundColor: accentColor }]} />
              <Text style={[fs.mealBadgeText, { color: accentColor }]}>{mealLabel}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} activeOpacity={0.8} style={[fs.closeBtn, { backgroundColor: colors.inputBg }]}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={fs.searchWrap}>
          <LinearGradient
            colors={[accentColor + '55', colors.purple + '44']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={fs.searchGradBorder}
          >
            <View style={[fs.searchInner, { backgroundColor: colors.inputBg }]}>
              <Ionicons name="search-outline" size={18} color={accentColor} />
              <TextInput
                style={[fs.searchInput, { color: colors.text }]}
                placeholder="Search foods, brands, restaurants..."
                placeholderTextColor={colors.textDim}
                value={query}
                onChangeText={setQuery}
                autoFocus
                returnKeyType="search"
                onSubmitEditing={() => handleSearch(query)}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }}>
                  <Ionicons name="close-circle" size={18} color={colors.textDim} />
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Error banner */}
        {searchError && (
          <View style={fs.errorBanner}>
            <Ionicons name="warning-outline" size={14} color={colors.orange} />
            <Text style={[fs.errorText, { color: colors.orange }]}>{searchError}</Text>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <ActivityIndicator color={accentColor} size="large" />
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 12 }}>Searching foods...</Text>
          </View>
        )}

        {/* Recent foods */}
        {!loading && showRecent && (
          <>
            <View style={fs.sectionHeader}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={[fs.sectionTitle, { color: colors.textMuted }]}>Recently Logged</Text>
            </View>
            <FlatList
              data={recentFoods}
              keyExtractor={(_, i) => `recent-${i}`}
              renderItem={({ item }) => <FoodResultRow item={item} onAdd={handleAddFood} mealType={mealType} colors={colors} />}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </>
        )}

        {/* Search results */}
        {showResults && (
          <>
            <View style={fs.sectionHeader}>
              <Ionicons name="search-outline" size={14} color={colors.textMuted} />
              <Text style={[fs.sectionTitle, { color: colors.textMuted }]}>{results.length} results for "{query}"</Text>
            </View>
            <FlatList
              data={results}
              keyExtractor={(_, i) => `result-${i}`}
              renderItem={({ item }) => <FoodResultRow item={item} onAdd={handleAddFood} mealType={mealType} colors={colors} />}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </>
        )}

        {/* Empty state */}
        {showEmpty && (
          <EmptyState
            query={hasSearched ? query : ''}
            onSuggestionPress={(s) => { setQuery(s); handleSearch(s); }}
            colors={colors}
          />
        )}

      </KeyboardAvoidingView>
    </View>
  );
};

const fs = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingBottom: 16,
  },
  headerTitle: { color: DARK.text, fontSize: 24, fontWeight: '800' },
  mealBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  mealDot: { width: 6, height: 6, borderRadius: 3 },
  mealBadgeText: { fontSize: 12, fontWeight: '600' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  searchWrap: { paddingHorizontal: 16, marginBottom: 8 },
  searchGradBorder: { borderRadius: 18, padding: 1 },
  searchInner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 17, paddingHorizontal: 14, paddingVertical: 13 },
  searchInput: { flex: 1, color: DARK.text, fontSize: 14 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  errorText: { color: DARK.orange, fontSize: 12, flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  sectionTitle: { color: DARK.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
});

export default FoodSearchScreen;
