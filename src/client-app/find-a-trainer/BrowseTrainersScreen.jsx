// Client marketplace: search, specialty chips, and a scrollable list of trainer cards.
// Flow: loading spinner → welcome hero + search + chips → cards, with an empty state when nothing matches.
// Used by Find a Trainer. Filters and paging stay in the parent; this screen only paints the list.
//
// vocab: neobrutalist = thick borders, hard shadows, gradient only for primary moment per screen

import React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrainerCard from './TrainerCard';
import { FORM_SCROLL_PROPS } from '../../navigation/bottomMenuSpacing';
import { BRAND, QUICK_SPECIALTIES, getTheme } from './trainerFilters';
import NbHero from '../../look-and-feel/NbHero';
import NbCard from '../../look-and-feel/NbCard';
import NbChipRow from '../../look-and-feel/NbChipRow';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

/** Matches ClientAppStart AI Coach `HeroWelcomeCard` / home hero banner shell (static border). */
const HERO_BORDER_DARK = ['#FF6B9D', '#E879C8', '#C084FC', '#A855F7', '#FF6B9D'];
const HERO_BORDER_LIGHT = ['#BE185D', '#C2410C'];
const TITLE_GRADIENT = ['#FF6B9D', '#C084FC'];
const DEFAULT_LIST_BOTTOM_PAD = 100;
const DEFAULT_QUICK_SPECIALTY = 'All';
const LIGHT_SCREEN_GRADIENT = ['#FAFAFC', '#F5F5F8', '#FAFAFC'];
const END_REACHED_THRESHOLD = 0.35;

// ===== HELPER FUNCTIONS =====

function screenGradientColors(isDark, theme) {
  if (isDark) return theme.screenGradient || ['#1A0F2E', '#0C0814', '#050508'];
  return LIGHT_SCREEN_GRADIENT;
}

function trainerCountLabel(count) {
  const suffix = count === 1 ? '' : 's';
  return `${count} trainer${suffix}`;
}

/**
 * Welcome hero using NbHero component.
 * One gradient moment per screen: the hero title.
 */
function WelcomeHero() {
  return (
    <NbHero 
      title="Find a Trainer"
      subtitle="Browse coaches by specialty and price"
      style={styles.hero}
    />
  );
}

/**
 * Search bar with filter button using NbCard.
 * Manipulate here: search input styling, filter button
 */
function SearchAndFilterBar({ colors, search, onSearchChange, onOpenFilters }) {
  return (
    <NbCard style={styles.searchCard} noShadow>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.nbMuted} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder="Search trainers, cities…"
          placeholderTextColor={colors.nbMuted}
          style={[styles.searchInput, { color: colors.nbInk }]}
        />
        <NbButton variant="brand" sm onPress={onOpenFilters}>
          Filter
        </NbButton>
      </View>
    </NbCard>
  );
}

/**
 * Horizontal scrolling specialty filter chips using NbChipRow.
 */
function QuickSpecialtyChips({ quickSpecialty, onQuickSpecialtyChange }) {
  const chipItems = QUICK_SPECIALTIES.map((spec) => ({
    id: spec,
    label: spec,
  }));

  return (
    <NbChipRow
      items={chipItems}
      selected={quickSpecialty}
      onSelect={onQuickSpecialtyChange}
      style={styles.chipRow}
    />
  );
}

/**
 * List header: hero, search, specialty chips, and result count.
 */
function TrainerListHeader({
  colors,
  search,
  onSearchChange,
  onOpenFilters,
  quickSpecialty,
  onQuickSpecialtyChange,
  trainerCount,
  sortLabel,
}) {
  return (
    <>
      <WelcomeHero />
      <SearchAndFilterBar
        colors={colors}
        search={search}
        onSearchChange={onSearchChange}
        onOpenFilters={onOpenFilters}
      />
      <QuickSpecialtyChips
        quickSpecialty={quickSpecialty}
        onQuickSpecialtyChange={onQuickSpecialtyChange}
      />
      <View style={styles.listHeader}>
        <Text style={[styles.listCount, { color: colors.nbInk }]}>
          {trainerCountLabel(trainerCount)}
        </Text>
        <Pressable onPress={() => onOpenFilters?.()} style={styles.sortRow} hitSlop={8}>
          <Text style={[styles.sortLabel, { color: colors.nbMuted }]}>{sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.nbMuted} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>
    </>
  );
}

/**
 * Empty state when no trainers match the current filters.
 */
function EmptyTrainerResults({ colors }) {
  return (
    <NbCard style={styles.emptyCard}>
      <View style={styles.emptyContent}>
        <Ionicons name="search-outline" size={40} color={colors.nbMuted} style={{ marginBottom: 12 }} />
        <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>
          No trainers match your filters
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.nbMuted }]}>
          Try adjusting specialty or price range
        </Text>
      </View>
    </NbCard>
  );
}

/**
 * Loading spinner shown while initial trainer data loads.
 */
function MarketplaceLoading({ colors }) {
  return (
    <View style={[styles.flex, { backgroundColor: colors.nbBackground }]}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6B9D" />
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Find-a-trainer marketplace list. Parent owns filters, search text, and paging.
 * Neobrutalist redesign: uses Nb components, simpler layout.
 * @param {object} props
 */
export function BrowseTrainersScreen({
  trainers = [],
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  isDark = true,
  filters,
  search,
  onSearchChange,
  quickSpecialty = DEFAULT_QUICK_SPECIALTY,
  onQuickSpecialtyChange,
  onViewProfile,
  onMessage,
  onConnect,
  onOpenFilters,
  /** Bottom clearance for floating shell BottomMenuBar (defaults to legacy fixed pad). */
  listBottomPad = DEFAULT_LIST_BOTTOM_PAD,
}) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const theme = getTheme(isDark);

  if (loading) {
    return <MarketplaceLoading colors={colors} />;
  }

  const handleEndReached = () => {
    if (loading || loadingMore || !hasMore) return;
    onLoadMore?.();
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.nbBackground }]}>
      <FlatList
        style={styles.flex}
        contentContainerStyle={[styles.listScroll, { paddingBottom: listBottomPad }]}
        data={trainers}
        keyExtractor={(trainer) => String(trainer.id)}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        windowSize={8}
        onEndReached={handleEndReached}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        ListHeaderComponent={
          <TrainerListHeader
            colors={colors}
            search={search}
            onSearchChange={onSearchChange}
            onOpenFilters={onOpenFilters}
            quickSpecialty={quickSpecialty}
            onQuickSpecialtyChange={onQuickSpecialtyChange}
            trainerCount={trainers.length}
            sortLabel={filters.sort}
          />
        }
        ListEmptyComponent={!loading ? <EmptyTrainerResults colors={colors} /> : null}
        renderItem={({ item: trainer }) => (
          <TrainerCard
            trainer={trainer}
            t={theme}
            isDark={isDark}
            onMessage={onMessage}
            onConnect={onConnect}
            onViewProfile={onViewProfile}
          />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#FF6B9D" />
            </View>
          ) : null
        }
        {...FORM_SCROLL_PROPS}
      />
    </View>
  );
}

export default BrowseTrainersScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listScroll: { 
    paddingHorizontal: 20, 
    paddingBottom: 100, 
    gap: 16, 
    paddingTop: 16,
  },
  footerLoader: { 
    paddingVertical: 16, 
    alignItems: 'center',
  },
  centered: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  hero: {
    marginBottom: 16,
  },
  searchCard: {
    marginBottom: 12,
    padding: 0,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  searchInput: { 
    flex: 1, 
    fontSize: 14, 
    fontFamily: 'Inter_500Medium',
    paddingVertical: 8,
  },
  chipRow: {
    paddingVertical: 8,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  listCount: { 
    fontSize: 18, 
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  sortRow: { 
    flexDirection: 'row', 
    alignItems: 'center',
  },
  sortLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyCard: {
    marginTop: 24,
  },
  emptyContent: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
