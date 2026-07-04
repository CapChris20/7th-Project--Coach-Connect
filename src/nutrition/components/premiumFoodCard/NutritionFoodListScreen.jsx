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
import { SHELL_SAFE_AREA_EDGES } from '../../../navigation/bottomNavMetrics';
import { Search } from 'lucide-react-native';
import FoodCard from './FoodCard';
import { colors, fonts } from './theme';
import { DEMO_YOGURT_BOWL } from './formatLoggedFoodDisplay';

function formatTodayHeader() {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short' });
  const month = now.toLocaleDateString('en-US', { month: 'short' });
  const date = now.getDate();
  return `Today · ${day} ${month} ${date}`;
}

/**
 * Premium nutrition list screen — FlatList of FoodCards with sticky-style header.
 */
export default function NutritionFoodListScreen({ foods, totalCalories }) {
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const base = foods?.length ? foods : [DEMO_YOGURT_BOWL];
    const q = query.trim().toLowerCase();
    if (!q) return base.map((f, i) => ({ ...f, id: f.id || `food-${i}` }));
    return base
      .filter((f) => String(f.name || '').toLowerCase().includes(q))
      .map((f, i) => ({ ...f, id: f.id || `food-${i}` }));
  }, [foods, query]);

  const totalKcal = useMemo(() => {
    if (totalCalories != null) return Math.round(totalCalories);
    return items.reduce((sum, f) => sum + (Number(f.calories) || 0), 0);
  }, [items, totalCalories]);

  const renderItem = useCallback(
    ({ item }) => (
      <FoodCard
        food={item}
        expanded={expandedId === item.id}
        onToggle={() => setExpandedId((cur) => (cur === item.id ? null : item.id))}
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
        <Search size={16} color={colors.subtle} strokeWidth={2} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search logged foods…"
          placeholderTextColor={colors.subtle}
          style={styles.searchInput}
          returnKeyType="search"
        />
      </View>

      <FlatList
        data={items}
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
