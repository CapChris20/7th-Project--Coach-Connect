// Client marketplace list — Design Law header, HardShadow search, specialty chips, trainer cards.
// Flow: header (back + title + filter) → search → specialty chips → count/sort row → TrainerCards.
// Used by SearchTrainersScreen. Filters and paging stay in the parent; this screen paints the list.

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
// Manipulate here: how early FlatList asks for the next page (0 = end, 1 = start)
const END_REACHED_THRESHOLD = 0.35;
const TITLE = 'Find a Trainer';
const SEARCH_PLACEHOLDER = 'Search trainers, cities…';
const EMPTY_TITLE = 'No coaches match';
const EMPTY_SUBTITLE =
  'Try fewer filters or a wider price range. Remote trainers work from anywhere.';
const SORT_FALLBACK_LABEL = 'Newest';
const FILTER_LABEL_ALONE = 'Filter';
const INITIAL_ROWS_TO_PAINT = 12;
const ROWS_PER_BATCH = 8;
const LIST_WINDOW_SIZE = 8;
const PRESSED_HEADER_OPACITY = 0.9;
const HEADER_ICON_BACK_SIZE = 22;
const HEADER_ICON_FILTER_SIZE = 20;
const SEARCH_ICON_SIZE = 18;
const EMPTY_ICON_SIZE = 22;

// ===== HELPER FUNCTIONS =====

function trainerCountLabel(trainerCount) {
  if (trainerCount === 1) {
    return '1 TRAINER';
  }
  return `${trainerCount} TRAINERS`;
}

function filterChipLabel(activeFilterCount) {
  if (activeFilterCount > 0) {
    return `Filter · ${activeFilterCount}`;
  }
  return FILTER_LABEL_ALONE;
}

function headerSquarePressStyle(colors, isPressed) {
  let pressOpacity = 1;
  if (isPressed) {
    pressOpacity = PRESSED_HEADER_OPACITY;
  }
  return {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    opacity: pressOpacity,
  };
}

function specialtyChipColors(colors, isSelected) {
  if (isSelected) {
    return {
      backgroundColor: colors.nbFill,
      textColor: colors.nbOnFill,
    };
  }
  return {
    backgroundColor: colors.nbSurface,
    textColor: colors.nbInk,
  };
}

function sortLabelFromFilters(filters) {
  if (!filters) {
    return undefined;
  }
  return filters.sort;
}

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}

function buildSpecialtyChipElements(quickSpecialty, onQuickSpecialtyChange, colors) {
  const chipElements = [];
  for (let index = 0; index < QUICK_SPECIALTIES.length; index += 1) {
    const specialtyName = QUICK_SPECIALTIES[index];
    const isSelected = quickSpecialty === specialtyName;
    chipElements.push(
      <SpecialtyChip
        key={specialtyName}
        specialtyName={specialtyName}
        isSelected={isSelected}
        onPress={() => callIfFunction(onQuickSpecialtyChange, specialtyName)}
        colors={colors}
      />,
    );
  }
  return chipElements;
}

function trainerRowKey(trainer) {
  return String(trainer.id);
}

// ===== SMALL UI PIECES =====

function HeaderSquare({ onPress, accessibilityLabel, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbIconChip}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed: isPressed }) => [
          styles.headerSq,
          headerSquarePressStyle(colors, isPressed),
        ]}
      >
        {children}
      </Pressable>
    </HardShadow>
  );
}

function MarketplaceHeader({ onBack, onOpenFilters, colors, topPad }) {
  const hasBackHandler = typeof onBack === 'function';

  let leftControl = <View style={styles.headerSqSpacer} />;
  if (hasBackHandler) {
    leftControl = (
      <HeaderSquare onPress={onBack} accessibilityLabel="Go back" colors={colors}>
        <Ionicons name="chevron-back" size={HEADER_ICON_BACK_SIZE} color={colors.nbInk} />
      </HeaderSquare>
    );
  }

  return (
    <View style={[styles.headerRow, { paddingTop: topPad }]}>
      {leftControl}
      <Text style={[styles.headerTitle, { color: colors.nbInk }]} numberOfLines={1}>
        {TITLE}
      </Text>
      <HeaderSquare onPress={onOpenFilters} accessibilityLabel="Open filters" colors={colors}>
        <Ionicons name="options-outline" size={HEADER_ICON_FILTER_SIZE} color={colors.nbInk} />
      </HeaderSquare>
    </View>
  );
}

function SearchBar({ colors, search, onSearchChange }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput} style={styles.searchWrap}>
      <View
        style={[
          styles.searchInner,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <Ionicons name="search" size={SEARCH_ICON_SIZE} color={colors.nbMuted} />
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

function SpecialtyChip({ specialtyName, isSelected, onPress, colors }) {
  const chipColors = specialtyChipColors(colors, isSelected);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: chipColors.backgroundColor,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: chipColors.textColor }]}
        numberOfLines={1}
      >
        {specialtyName}
      </Text>
    </Pressable>
  );
}

function QuickSpecialtyChips({ quickSpecialty, onQuickSpecialtyChange, colors }) {
  const chipElements = buildSpecialtyChipElements(
    quickSpecialty,
    onQuickSpecialtyChange,
    colors,
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipScroll}
    >
      {chipElements}
    </ScrollView>
  );
}

function ResultsHeader({
  colors,
  trainerCount,
  sortLabel,
  activeFilterCount,
  onOpenFilters,
}) {
  const countText = trainerCountLabel(trainerCount);
  let sortPillText = SORT_FALLBACK_LABEL;
  if (sortLabel) {
    sortPillText = sortLabel;
  }
  const filterPillText = filterChipLabel(activeFilterCount);
  const miniPillChrome = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
  };

  return (
    <View style={styles.resultsRow}>
      <Text style={[styles.resultsCount, { color: colors.nbMuted }]}>{countText}</Text>
      <View style={styles.resultsPills}>
        <Pressable onPress={onOpenFilters} style={[styles.miniPill, miniPillChrome]}>
          <Text style={[styles.miniPillText, { color: colors.nbInk }]} numberOfLines={1}>
            {sortPillText}
          </Text>
        </Pressable>
        <Pressable onPress={onOpenFilters} style={[styles.miniPill, miniPillChrome]}>
          <Text style={[styles.miniPillText, { color: colors.nbInk }]} numberOfLines={1}>
            {filterPillText}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function EmptyTrainerResults({ colors, onClearFilters, onShowRemote }) {
  let emptyIconBackground = colors.nbSurfaceChip;
  if (colors.nbSoft) {
    emptyIconBackground = colors.nbSoft;
  }
  const hasShowRemoteHandler = typeof onShowRemote === 'function';

  let showRemoteButton = null;
  if (hasShowRemoteHandler) {
    showRemoteButton = (
      <NbButton variant="plain" onPress={onShowRemote}>
        Show remote trainers
      </NbButton>
    );
  }

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
      <View
        style={[
          styles.emptyIcon,
          { borderColor: colors.nbBorder, backgroundColor: emptyIconBackground },
        ]}
      >
        <Ionicons name="search-outline" size={EMPTY_ICON_SIZE} color={colors.nbInk} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{EMPTY_TITLE}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.nbMuted }]}>{EMPTY_SUBTITLE}</Text>
      <NbButton variant="fill" onPress={onClearFilters}>
        Clear filters
      </NbButton>
      {showRemoteButton}
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

function LoadMoreFooter({ colors, showSpinner }) {
  if (!showSpinner) {
    return null;
  }
  return (
    <View style={styles.footerLoader}>
      <ActivityIndicator size="small" color={colors.nbInk} />
    </View>
  );
}

function MarketplaceListHeader({
  colors,
  topPad,
  search,
  onSearchChange,
  quickSpecialty,
  onQuickSpecialtyChange,
  trainerCount,
  sortLabel,
  activeFilterCount,
  onOpenFilters,
  onBack,
}) {
  return (
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
        trainerCount={trainerCount}
        sortLabel={sortLabel}
        activeFilterCount={activeFilterCount}
        onOpenFilters={onOpenFilters}
      />
    </>
  );
}

function renderTrainerRow(trainer, onViewProfile) {
  return <TrainerCard trainer={trainer} onViewProfile={onViewProfile} />;
}

function pickClearFiltersHandler(onClearFilters, onOpenFilters) {
  if (onClearFilters) {
    return onClearFilters;
  }
  return onOpenFilters;
}

function buildEmptyListNode(showEmptyResults, colors, clearFiltersHandler, onShowRemote) {
  if (!showEmptyResults) {
    return null;
  }
  return (
    <EmptyTrainerResults
      colors={colors}
      onClearFilters={clearFiltersHandler}
      onShowRemote={onShowRemote}
    />
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
  listBottomPad = DEFAULT_LIST_BOTTOM_PAD,
}) {
  // 1. Theme + status-bar pad. Count how many filters are "on" for the mini pill.
  const { colors } = useTheme();
  // Manipulate here: extra gap under status bar after the safe inset
  const topPad = useShellTopPad(spacing.sm);
  const activeFilterCount = countActiveFilters(filters);
  const sortLabel = sortLabelFromFilters(filters);
  const showEmptyResults = !loading;

  // 2. First paint: full-screen spinner until the parent has the first page.
  if (loading) {
    return <MarketplaceLoading colors={colors} />;
  }

  // 3. Ask parent for the next page only when idle and more rows exist.
  function tryLoadNextPage() {
    if (loading) {
      return;
    }
    if (loadingMore) {
      return;
    }
    if (!hasMore) {
      return;
    }
    callIfFunction(onLoadMore);
  }

  // 4. Header / empty locals named before JSX.
  const listHeader = (
    <MarketplaceListHeader
      colors={colors}
      topPad={topPad}
      search={search}
      onSearchChange={onSearchChange}
      quickSpecialty={quickSpecialty}
      onQuickSpecialtyChange={onQuickSpecialtyChange}
      trainerCount={trainers.length}
      sortLabel={sortLabel}
      activeFilterCount={activeFilterCount}
      onOpenFilters={onOpenFilters}
      onBack={onBack}
    />
  );

  const clearFiltersHandler = pickClearFiltersHandler(onClearFilters, onOpenFilters);
  const emptyList = buildEmptyListNode(
    showEmptyResults,
    colors,
    clearFiltersHandler,
    onShowRemote,
  );
  const listBottomStyle = [styles.listScroll, { paddingBottom: listBottomPad }];
  const screenBackground = { backgroundColor: colors.nbBackground };
  const loadMoreFooter = (
    <LoadMoreFooter colors={colors} showSpinner={loadingMore} />
  );

  // 5. Virtualized list of HardShadow TrainerCards.
  return (
    <View style={[styles.flex, screenBackground]}>
      <FlatList
        style={styles.flex}
        contentContainerStyle={listBottomStyle}
        data={trainers}
        keyExtractor={trainerRowKey}
        initialNumToRender={INITIAL_ROWS_TO_PAINT}
        maxToRenderPerBatch={ROWS_PER_BATCH}
        windowSize={LIST_WINDOW_SIZE}
        onEndReached={tryLoadNextPage}
        onEndReachedThreshold={END_REACHED_THRESHOLD}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyList}
        renderItem={({ item: trainer }) => renderTrainerRow(trainer, onViewProfile)}
        ListFooterComponent={loadMoreFooter}
        {...FORM_SCROLL_PROPS}
      />
    </View>
  );
}

export default BrowseTrainersScreen;

// ===== PLUMBING — skip unless debugging =====

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
