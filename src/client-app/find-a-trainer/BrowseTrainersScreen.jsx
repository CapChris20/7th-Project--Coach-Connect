// Client marketplace: search, specialty pills, and a scrollable list of trainer cards.
// Flow: loading spinner → welcome hero + search + pills → cards, with an empty state when nothing matches.
// Used by Find a Trainer. Filters and paging stay in the parent; this screen only paints the list.

import React from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import TrainerCard from './TrainerCard';
import { FORM_SCROLL_PROPS } from '../../navigation/bottomMenuSpacing';
import {
  GlassCard,
  GlassPanel,
  Pill,
  FilterColorButton,
} from './FindTrainerPieces';
import { BRAND, MP_FONT, QUICK_SPECIALTIES, getTheme } from './trainerFilters';

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

function WelcomeHero({ isDark }) {
  const innerBackground = isDark ? '#0A0A0F' : '#FFFFFF';
  const kickerColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)';
  const taglineColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.45)';
  const shadowStyle = isDark ? styles.heroOuterShadowDark : styles.heroOuterShadowLight;
  const borderColors = isDark ? HERO_BORDER_DARK : HERO_BORDER_LIGHT;
  const innerBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={[styles.heroOuter, shadowStyle]}>
      <LinearGradient
        colors={borderColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBorderRing}
      >
        <View
          style={[
            styles.heroInner,
            {
              backgroundColor: innerBackground,
              borderColor: innerBorder,
            },
          ]}
        >
          <View style={styles.heroKickerBlock}>
            <Text style={[styles.heroKicker, { color: kickerColor }]}>WELCOME TO</Text>
            <LinearGradient
              colors={TITLE_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroKickerLine}
            />
          </View>

          <Text style={styles.heroTitle}>Trainer Marketplace</Text>

          <Text style={[styles.heroTagline, { color: taglineColor }]}>
            FIND TRAINERS · COMPARE · CONNECT WITH YOUR COACH
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

function SearchAndFilterBar({ isDark, theme, search, onSearchChange, onOpenFilters }) {
  return (
    <GlassPanel
      isDark={isDark}
      borderRadius={16}
      contentWrapperStyle={styles.searchRow}
      contentStyle={styles.searchInner}
    >
      <Ionicons name="search" size={18} color={theme.mutedForeground} />
      <TextInput
        value={search}
        onChangeText={onSearchChange}
        placeholder="Search trainers, cities…"
        placeholderTextColor={theme.mutedForeground}
        style={[styles.searchInput, { color: theme.foreground }]}
      />
      <FilterColorButton onPress={() => onOpenFilters?.()} />
    </GlassPanel>
  );
}

function QuickSpecialtyPills({ theme, isDark, quickSpecialty, onQuickSpecialtyChange }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPills}>
      {QUICK_SPECIALTIES.map((spec) => (
        <Pill
          key={spec}
          label={spec}
          active={quickSpecialty === spec}
          onPress={() => onQuickSpecialtyChange?.(spec)}
          t={theme}
          isDark={isDark}
        />
      ))}
    </ScrollView>
  );
}

function TrainerListHeader({
  isDark,
  theme,
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
      <WelcomeHero isDark={isDark} />
      <SearchAndFilterBar
        isDark={isDark}
        theme={theme}
        search={search}
        onSearchChange={onSearchChange}
        onOpenFilters={onOpenFilters}
      />
      <QuickSpecialtyPills
        theme={theme}
        isDark={isDark}
        quickSpecialty={quickSpecialty}
        onQuickSpecialtyChange={onQuickSpecialtyChange}
      />
      <View style={styles.listHeader}>
        <Text style={[styles.listCount, { color: theme.foreground }]}>{trainerCountLabel(trainerCount)}</Text>
        <Pressable onPress={() => onOpenFilters?.()} style={styles.sortRow} hitSlop={8}>
          <Text style={{ color: theme.mutedForeground, fontSize: 13, fontWeight: '600' }}>{sortLabel}</Text>
          <Ionicons name="chevron-down" size={14} color={theme.mutedForeground} style={{ marginLeft: 2 }} />
        </Pressable>
      </View>
    </>
  );
}

function EmptyTrainerResults({ theme, isDark }) {
  return (
    <GlassCard t={theme} isDark={isDark} contentStyle={{ padding: 32, alignItems: 'center' }}>
      <Ionicons name="search-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
      <Text style={{ color: theme.foreground, fontWeight: '800', fontSize: 16 }}>
        No trainers match your filters.
      </Text>
      <Text style={{ color: theme.mutedForeground, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
        Try adjusting specialty or price range.
      </Text>
    </GlassCard>
  );
}

function MarketplaceLoading({ screenGrad }) {
  return (
    <LinearGradient colors={screenGrad} style={styles.flex}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={BRAND.pink} />
      </View>
    </LinearGradient>
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
  const theme = getTheme(isDark);
  const screenGrad = screenGradientColors(isDark, theme);

  if (loading) {
    return <MarketplaceLoading screenGrad={screenGrad} />;
  }

  const handleEndReached = () => {
    if (loading || loadingMore || !hasMore) return;
    onLoadMore?.();
  };

  return (
    <LinearGradient colors={screenGrad} style={styles.flex}>
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
            isDark={isDark}
            theme={theme}
            search={search}
            onSearchChange={onSearchChange}
            onOpenFilters={onOpenFilters}
            quickSpecialty={quickSpecialty}
            onQuickSpecialtyChange={onQuickSpecialtyChange}
            trainerCount={trainers.length}
            sortLabel={filters.sort}
          />
        }
        ListEmptyComponent={!loading ? <EmptyTrainerResults theme={theme} isDark={isDark} /> : null}
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
              <ActivityIndicator size="small" color={BRAND.pink} />
            </View>
          ) : null
        }
        {...FORM_SCROLL_PROPS}
      />
    </LinearGradient>
  );
}

export default BrowseTrainersScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listScroll: { paddingHorizontal: 20, paddingBottom: 100, gap: 16, paddingTop: 8 },
  footerLoader: { paddingVertical: 16, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroOuter: {
    marginBottom: 4,
    borderRadius: 28,
  },
  heroOuterShadowDark: {
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  heroOuterShadowLight: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  heroBorderRing: {
    borderRadius: 28,
    padding: 2,
  },
  heroInner: {
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroKickerBlock: {
    alignItems: 'center',
    marginBottom: 4,
  },
  heroKicker: {
    fontSize: 16,
    fontFamily: MP_FONT.bodyBold,
    letterSpacing: 3,
    textAlign: 'center',
  },
  heroKickerLine: {
    width: 86,
    height: 4,
    borderRadius: 999,
    marginTop: 10,
    opacity: 0.9,
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 36,
    fontFamily: MP_FONT.displayBold,
    fontWeight: '900',
    color: '#FF6B9D',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 42,
    paddingHorizontal: 4,
  },
  heroTagline: {
    marginTop: 10,
    fontSize: 12,
    fontFamily: MP_FONT.bodySemi,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 8,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: MP_FONT.bodyMedium, paddingVertical: 0 },
  quickPills: { gap: 8, paddingVertical: 4 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  listCount: { fontSize: 20, fontFamily: MP_FONT.displayBold },
  sortRow: { flexDirection: 'row', alignItems: 'center' },
});
