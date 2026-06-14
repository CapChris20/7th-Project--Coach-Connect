import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  SafeAreaView, FlatList, TextInput, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import TrainerCard from './TrainerCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40 - 8) / 2; // 2 columns with 16px margins + 8px gap

const C = {
  bg: '#0A0A0F',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.60)',
  textMuted: 'rgba(255,255,255,0.40)',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#06B6D4',
  orange: '#F97316',
  emerald: '#10B981',
  divider: 'rgba(255,255,255,0.08)',
  card: 'rgba(255,255,255,0.05)',
};

// Sort options
const SORT_OPTIONS = [
  { id: 'popular', label: 'Popular', icon: 'star' },
  { id: 'price-low', label: 'Price: Low-High', icon: 'arrow-down' },
  { id: 'price-high', label: 'Price: High-Low', icon: 'arrow-up' },
  { id: 'rating', label: 'Top Rated', icon: 'thumbs-up' },
  { id: 'newest', label: 'Newest', icon: 'time' },
];

// Filter categories
const FILTER_CATEGORIES = [
  { id: 'strength', label: 'Strength Training', icon: 'barbell' },
  { id: 'cardio', label: 'Cardio & Endurance', icon: 'run' },
  { id: 'flexibility', label: 'Flexibility', icon: 'body' },
  { id: 'nutrition', label: 'Nutrition', icon: 'restaurant' },
  { id: 'wellness', label: 'Wellness', icon: 'heart' },
];

const MarketplaceScreen = ({
  trainers = [],
  onTrainerPress,
  onFilterChange,
  onSortChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState('popular');
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  // Apply search, filters, and sorting
  const filteredAndSortedTrainers = useMemo(() => {
    let result = trainers;

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t =>
        (t.displayName || t.name || '').toLowerCase().includes(query) ||
        (t.specialty || '').toLowerCase().includes(query) ||
        (t.specialties || []).some(s => s.toLowerCase().includes(query))
      );
    }

    // Filters
    if (selectedFilters.length > 0) {
      result = result.filter(t => {
        const trainerSpecs = (t.specialties || []).map(s => s.toLowerCase());
        return selectedFilters.some(f => trainerSpecs.includes(f.toLowerCase()));
      });
    }

    // Sort
    switch (selectedSort) {
      case 'price-low':
        return result.sort((a, b) => {
          const priceA = a.price ?? a.pricing?.perMonth ?? a.rate ?? 999;
          const priceB = b.price ?? b.pricing?.perMonth ?? b.rate ?? 999;
          return priceA - priceB;
        });
      case 'price-high':
        return result.sort((a, b) => {
          const priceA = a.price ?? a.pricing?.perMonth ?? a.rate ?? 0;
          const priceB = b.price ?? b.pricing?.perMonth ?? b.rate ?? 0;
          return priceB - priceA;
        });
      case 'rating':
        return result.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      case 'newest':
        return result.sort((a, b) => (b.joinedAt ?? 0) - (a.joinedAt ?? 0));
      case 'popular':
      default:
        return result.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    }
  }, [trainers, searchQuery, selectedFilters, selectedSort]);

  const toggleFilter = (filterId) => {
    setSelectedFilters(prev => 
      prev.includes(filterId)
        ? prev.filter(f => f !== filterId)
        : [...prev, filterId]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Find Your Coach</Text>
        <Text style={s.headerSubtitle}>{filteredAndSortedTrainers.length} trainers available</Text>
      </View>

      {/* Search Bar */}
      <View style={s.searchContainer}>
        <Ionicons name="search" size={18} color={C.textMuted} />
        <TextInput
          style={s.searchInput}
          placeholder="Search trainers or specialties..."
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={C.pink} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Filters & Sort Toolbar */}
        <View style={s.toolbar}>
          <TouchableOpacity
            style={[s.toolbarButton, showFilters && s.toolbarButtonActive]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons name="funnel" size={16} color={showFilters ? C.pink : C.textMuted} />
            <Text style={[s.toolbarButtonText, showFilters && s.toolbarButtonTextActive]}>
              Filters {selectedFilters.length > 0 && `(${selectedFilters.length})`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.toolbarButton}>
            <Ionicons name="swap-vertical" size={16} color={C.textMuted} />
            <Text style={s.toolbarButtonText}>
              Sort: {SORT_OPTIONS.find(o => o.id === selectedSort)?.label}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filters Panel */}
        {showFilters && (
          <View style={s.filtersPanel}>
            <Text style={s.filtersPanelTitle}>Filter by Specialty</Text>
            <View style={s.filterChips}>
              {FILTER_CATEGORIES.map(category => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => toggleFilter(category.id)}
                  style={[
                    s.filterChip,
                    selectedFilters.includes(category.id) && s.filterChipActive,
                  ]}
                >
                  <Ionicons 
                    name={category.icon} 
                    size={14} 
                    color={selectedFilters.includes(category.id) ? '#fff' : C.textMuted}
                  />
                  <Text
                    style={[
                      s.filterChipText,
                      selectedFilters.includes(category.id) && s.filterChipTextActive,
                    ]}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Sort Pills */}
        <View style={s.sortPills}>
          {SORT_OPTIONS.map(option => (
            <TouchableOpacity
              key={option.id}
              onPress={() => setSelectedSort(option.id)}
              style={[
                s.sortPill,
                selectedSort === option.id && s.sortPillActive,
              ]}
            >
              <Ionicons 
                name={option.icon} 
                size={12}
                color={selectedSort === option.id ? '#fff' : C.textMuted}
              />
              <Text
                style={[
                  s.sortPillText,
                  selectedSort === option.id && s.sortPillTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Trainer Cards Grid */}
        {filteredAndSortedTrainers.length > 0 ? (
          <View style={s.cardsContainer}>
            {filteredAndSortedTrainers.map((trainer, idx) => (
              <View key={trainer.id || idx} style={{ width: CARD_WIDTH }}>
                <TrainerCard
                  trainer={trainer}
                  index={idx}
                  onPress={() => onTrainerPress?.(trainer)}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyState}>
            <Ionicons name="search-outline" size={48} color={C.textMuted} />
            <Text style={s.emptyStateTitle}>No trainers found</Text>
            <Text style={s.emptyStateSubtitle}>Try adjusting your search or filters</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: C.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: C.textMuted,
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.divider,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
  },

  toolbar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.divider,
  },
  toolbarButtonActive: {
    backgroundColor: 'rgba(255,107,157,0.15)',
    borderColor: 'rgba(255,107,157,0.3)',
  },
  toolbarButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textMuted,
  },
  toolbarButtonTextActive: {
    color: C.pink,
  },

  filtersPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.divider,
  },
  filtersPanelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: C.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  filterChipActive: {
    backgroundColor: C.pink,
    borderColor: C.pink,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '500',
    color: C.textMuted,
  },
  filterChipTextActive: {
    color: '#fff',
  },

  sortPills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.divider,
  },
  sortPillActive: {
    backgroundColor: C.cyan,
    borderColor: C.cyan,
  },
  sortPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
  },
  sortPillTextActive: {
    color: C.bg,
  },

  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    justifyContent: 'space-between',
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.text,
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: C.textMuted,
  },
});

export default MarketplaceScreen;
