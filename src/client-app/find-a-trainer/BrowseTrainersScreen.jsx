// Client marketplace list — Design Law header, HardShadow search, specialty chips, trainer cards (PNG 03 / 09).
// Flow: header (back + title + filter) → search → specialty chips → count/sort row → HardShadow TrainerCards.
// Used by SearchTrainersScreen. Filters and paging stay in the parent; this screen paints the list chrome.
//
// vocab: useShellTopPad = status-bar safe top inset so titles never sit under the Dynamic Island
// vocab: HardShadow = solid offset shadow (no blur); nbFill = selected chip fill

import React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TrainerCard from './TrainerCard';
import { FORM_SCROLL_PROPS, useShellTopPad } from '../../navigation/bottomMenuSpacing';
import { QUICK_SPECIALTIES, countActiveFilters, DEFAULT_FILTERS } from './trainerFilters';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DEFAULT_LIST_BOTTOM_PAD = 100;
const DEFAULT_QUICK_SPECIALTY = 'All';
const END_REACHED_THRESHOLD = 0.35;
const TITLE = 'Find a Trainer';
const SEARCH_PLACEHOLDER = 'Search trainers, cities…';
const EMPTY_TITLE = 'No coaches match';
const EMPTY_SUBTITLE = 'Try fewer filters or a wider price range. Remote trainers work from anywhere.';

// ===== HELPER FUNCTIONS =====

function trainerCountLabel(count) {
  return `${count} TRAINER${count === 1 ? '' : 'S'}`;
}

function filterChipLabel(activeCount) {
  if (activeCount > 0) return `Filter · ${activeCount}`;
  return 'Filter';
}

/**
 * 44×44 outlined square with HardShadow — back chevron or filter lines (PNG 03 header).
 */
function HeaderSquare({ onPress, accessibilityLabel, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.headerSq,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
      >
        {children}
      </Pressable>
    </HardShadow>
  );
}

/**
 * Back + title + filter square. Owns status-bar clearance via useShellTopPad.
 */
function MarketplaceHeader({ onBack, onOpenFilters, colors, topPad }) {
  return (
    <View style={[styles.headerRow, { paddingTop: topPad }]}>
      {typeof onBack === 'function' ? (
        <HeaderSquare onPress={onBack} accessibilityLabel="Go back" colors={colors}>
          <Ionicons name="chevron-back" size={22} color={colors.nbInk} />
        </HeaderSquare>
      ) : (
        <View style={styles.headerSqSpacer} />
      )}
      <Text style={[styles.headerTitle, { color: colors.nbInk }]} numberOfLines={1}>
        {TITLE}
      </Text>
      <HeaderSquare onPress={onOpenFilters} accessibilityLabel="Open filters" colors={colors}>
        <Ionicons name="options-outline" size={20} color={colors.nbInk} />
      </HeaderSquare>
    </View>
  );
}

/**
 * HardShadow search field — thick border, no nested Filter button (filter lives in the header square).
 */
function SearchBar({ colors, search, onSearchChange }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput} style={styles.searchWrap}>
      <View
        style={[
          styles.searchInner,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.nbMuted} />
        <TextInput
          value={search}
          onChangeText={onSearchChange}
          placeholder={SEARCH_PLACEHOLDER}
          placeholderTextColor={colors.nbMuted}
          style={[styles.searchInput, { color: colors.nbInk }]}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>
    </HardShadow>
  );
}

/**
 * Horizontal specialty quick chips — selected = solid nbFill (not gradient).
 */
function QuickSpecialtyChips({ quickSpecialty, onQuickSpecialtyChange, colors }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScroll}
    >
      {QUICK_SPECIALTIES.map((spec) => {
        const selected = quickSpecialty === spec;
        return (
          <Pressable
            key={spec}
            onPress={() => onQuickSpecialtyChange?.(spec)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              {
                borderColor: colors.nbBorder,
                backgroundColor: selected ? colors.nbFill : colors.nbSurface,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selected ? colors.nbOnFill : colors.nbInk },
              ]}
              numberOfLines={1}
            >
              {spec}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * "N TRAINERS" + Newest + Filter · N pills (PNG 03 count row).
 */
function ResultsHeader({
  colors,
  trainerCount,
  sortLabel,
  activeFilterCount,
  onOpenFilters,
}) {
  return (
    <View style={styles.resultsRow}>
      <Text style={[styles.resultsCount, { color: colors.nbMuted }]}>
        {trainerCountLabel(trainerCount)}
      </Text>
      <View style={styles.resultsPills}>
        <Pressable
          onPress={onOpenFilters}
          style={[styles.miniPill, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
        >
          <Text style={[styles.miniPillText, { color: colors.nbInk }]} numberOfLines={1}>
            {sortLabel || 'Newest'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onOpenFilters}
          style={[styles.miniPill, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}
        >
          <Text style={[styles.miniPillText, { color: colors.nbInk }]} numberOfLines={1}>
            {filterChipLabel(activeFilterCount)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Empty state — dashed HardShadow box + Clear filters / Show remote (PNG 09).
 */
function EmptyTrainerResults({ colors, onClearFilters, onShowRemote }) {
  return (
    <View
      style={[
        styles.emptyCard,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
        },
      ]}
    >
      <View style={[styles.emptyIcon, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft || colors.nbSurfaceChip }]}>
        <Ionicons name="search-outline" size={22} color={colors.nbInk} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{EMPTY_TITLE}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.nbMuted }]}>{EMPTY_SUBTITLE}</Text>
      <NbButton variant="fill" onPress={onClearFilters}>
        Clear filters
      </NbButton>
      {typeof onShowRemote === 'function' ? (
        <NbButton variant="plain" onPress={onShowRemote}>
          Show remote trainers
        </NbButton>
      ) : null}
    </View>
  );
}

function MarketplaceLoading({ colors }) {
  return (
    <View style={[styles.flex, { backgroundColor: colors.nbBackground }]}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.nbInk} />
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Find-a-trainer marketplace list. Parent owns filters, search text, and paging.
 * @param {object} props
 */
export function BrowseTrainersScreen({
  trainers = [],
  loading = false,
  loadingMore = false,
  hasMore = false,
  onLoadMore,
  filters = DEFAULT_FILTERS,
  search,
  onSearchChange,
  quickSpecialty = DEFAULT_QUICK_SPECIALTY,
  onQuickSpecialtyChange,
  onViewProfile,
  onOpenFilters,
  onBack,
  onClearFilters,
  onShowRemote,
  /** Bottom clearance for floating shell BottomMenuBar (defaults to legacy fixed pad). */
  listBottomPad = DEFAULT_LIST_BOTTOM_PAD,
}) {
  const { colors } = useTheme();
  // Manipulate here: extra gap under status bar after the safe inset
  const topPad = useShellTopPad(spacing.sm);
  const activeFilterCount = countActiveFilters(filters);

  if (loading) {
    return <MarketplaceLoading colors={colors} />;
  }

  const handleEndReached = () => {
    if (loading || loadingMore || !hasMore) return;
    onLoadMore?.();
  };

  const listHeader = (
    <>
      <MarketplaceHeader
        onBack={onBack}
        onOpenFilters={onOpenFilters}
        colors={colors}
        topPad={topPad}
      />
      <SearchBar colors={colors} search={search} onSearchChange={onSearchChange} />
      <QuickSpecialtyChips
        quickSpecialty={quickSpecialty}
        onQuickSpecialtyChange={onQuickSpecialtyChange}
        colors={colors}
      />
      <ResultsHeader
        colors={colors}
        trainerCount={trainers.length}
        sortLabel={filters?.sort}
        activeFilterCount={activeFilterCount}
        onOpenFilters={onOpenFilters}
      />
    </>
  );

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
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          !loading ? (
            <EmptyTrainerResults
              colors={colors}
              onClearFilters={onClearFilters || onOpenFilters}
              onShowRemote={onShowRemote}
            />
          ) : null
        }
        renderItem={({ item: trainer }) => (
          <TrainerCard trainer={trainer} onViewProfile={onViewProfile} />
        )}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.nbInk} />
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
    paddingHorizontal: nb.screenGutter,
    gap: 0,
  },
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  headerSq: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.nbIconChip,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSqSpacer: { width: 44, height: 44 },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 22,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
  },
  searchWrap: {
    marginBottom: spacing.sm + 4,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: nb.minTouchTarget,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    paddingVertical: 10,
  },
  chipScroll: {
    gap: 8,
    paddingBottom: spacing.sm + 4,
    paddingRight: spacing.md,
  },
  chip: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm + 2,
    gap: spacing.sm,
  },
  resultsCount: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
  },
  resultsPills: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
  },
  miniPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
  },
  miniPillText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  emptyCard: {
    marginTop: spacing.lg,
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: 'SpaceGrotesk_700Bold',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
