import React from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import TrainerCard from '../components/TrainerCard';
import {
  GlassCard,
  GlassPanel,
  Pill,
  FilterGradientButton,
} from '../components/MarketplaceUI';
import { BRAND, MP_FONT, QUICK_SPECIALTIES, getTheme } from '../utils/marketplaceFilters';

/** Matches ClientApp AI Coach `HeroWelcomeCard` / home hero banner shell (static border). */
const HERO_BORDER_DARK = ['#FF6B9D', '#E879C8', '#C084FC', '#A855F7', '#FF6B9D'];
const HERO_BORDER_LIGHT = ['#BE185D', '#C2410C'];

function WelcomeHero({ isDark }) {
  const innerBg = isDark ? '#0A0A0F' : '#FFFFFF';
  const kickerColor = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.55)';
  const taglineColor = isDark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.45)';

  return (
    <View style={[s.heroOuter, isDark ? s.heroOuterShadowDark : s.heroOuterShadowLight]}>
      <LinearGradient
        colors={isDark ? HERO_BORDER_DARK : HERO_BORDER_LIGHT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.heroBorderRing}
      >
        <View
          style={[
            s.heroInner,
            {
              backgroundColor: innerBg,
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <View style={s.heroKickerBlock}>
            <Text style={[s.heroKicker, { color: kickerColor }]}>WELCOME TO</Text>
            <LinearGradient
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.heroKickerLine}
            />
          </View>

          <Text style={s.heroTitle}>Trainer Marketplace</Text>

          <Text style={[s.heroTagline, { color: taglineColor }]}>
            FIND TRAINERS · COMPARE · CONNECT WITH YOUR COACH
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

export function FindTrainerScreen({
  trainers = [],
  loading = false,
  isDark = true,
  filters,
  search,
  onSearchChange,
  quickSpecialty = 'All',
  onQuickSpecialtyChange,
  onViewProfile,
  onMessage,
  onConnect,
  onOpenFilters,
}) {
  const t = getTheme(isDark);
  const screenGrad = isDark ? t.screenGradient || ['#1A0F2E', '#0C0814', '#050508'] : ['#FAFAFC', '#F5F5F8', '#FAFAFC'];

  if (loading) {
    return (
      <LinearGradient colors={screenGrad} style={s.flex}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color={BRAND.pink} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={screenGrad} style={s.flex}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={s.listScroll}
          showsVerticalScrollIndicator={false}
        >
          <WelcomeHero isDark={isDark} />

          <GlassPanel
            isDark={isDark}
            borderRadius={16}
            contentWrapperStyle={s.searchRow}
            contentStyle={s.searchInner}
          >
            <Ionicons name="search" size={18} color={t.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={onSearchChange}
              placeholder="Search trainers, cities…"
              placeholderTextColor={t.mutedForeground}
              style={[s.searchInput, { color: t.foreground }]}
            />
            <FilterGradientButton onPress={() => onOpenFilters?.()} />
          </GlassPanel>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickPills}>
            {QUICK_SPECIALTIES.map((spec) => (
              <Pill
                key={spec}
                label={spec}
                active={quickSpecialty === spec}
                onPress={() => onQuickSpecialtyChange?.(spec)}
                t={t}
                isDark={isDark}
              />
            ))}
          </ScrollView>

          <View style={s.listHeader}>
            <Text style={[s.listCount, { color: t.foreground }]}>
              {trainers.length} trainer{trainers.length === 1 ? '' : 's'}
            </Text>
            <Pressable onPress={() => onOpenFilters?.()} style={s.sortRow} hitSlop={8}>
              <Text style={{ color: t.mutedForeground, fontSize: 13, fontWeight: '600' }}>{filters.sort}</Text>
              <Ionicons name="chevron-down" size={14} color={t.mutedForeground} style={{ marginLeft: 2 }} />
            </Pressable>
          </View>

          {trainers.length === 0 ? (
            <GlassCard t={t} isDark={isDark} contentStyle={{ padding: 32, alignItems: 'center' }}>
              <Ionicons name="search-outline" size={40} color={t.mutedForeground} style={{ marginBottom: 12 }} />
              <Text style={{ color: t.foreground, fontWeight: '800', fontSize: 16 }}>
                No trainers match your filters.
              </Text>
              <Text style={{ color: t.mutedForeground, marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
                Try adjusting specialty or price range.
              </Text>
            </GlassCard>
          ) : (
            trainers.map((tr) => (
              <TrainerCard
                key={tr.id}
                trainer={tr}
                t={t}
                isDark={isDark}
                onMessage={onMessage}
                onConnect={onConnect}
                onViewProfile={onViewProfile}
              />
            ))
          )}
        </ScrollView>
    </LinearGradient>
  );
}

export default FindTrainerScreen;

const s = StyleSheet.create({
  flex: { flex: 1 },
  listScroll: { paddingHorizontal: 20, paddingBottom: 100, gap: 16, paddingTop: 8 },
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
