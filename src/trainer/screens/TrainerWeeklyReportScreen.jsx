import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs } from 'firebase/firestore';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import { db } from '../../app/config';
import { WeeklyReportScrollBody, WR_COLORS } from '../../shared/components/WeeklyReportPremium';

const BG_GRADIENT_DARK = ['#0c0c0e', '#0f0f12', '#0c0c0e'];
const BG_GRADIENT_LIGHT = ['#f5f5f7', '#f0f0f2', '#ebebed'];

/** Same rim + checklist language as `MarketplaceHeroCard` (Find trainers). */
const ACCENT_BORDER_GRADIENT = ['#FF6B9D', '#E879C8', '#C084FC', '#A855F7', '#FF6B9D'];
const CHECK_COLORS = ['#FF6B9D', '#64D2FF', '#F97316', '#C084FC'];
const WEEKLY_CARD_BENEFITS = [
  'Averages for sleep, water, steps, and energy',
  'Day-by-day context after the weekly summary runs',
  'Trends, wins, and focus areas in one scrollable view',
  'Pick a week below to open the full breakdown',
];

function formatChipRange(weekStart, weekEnd) {
  const ws = String(weekStart || '').trim();
  const we = String(weekEnd || ws).trim();
  if (!ws) return '';
  const s = new Date(`${ws}T12:00:00`);
  const e = new Date(`${we}T12:00:00`);
  const a = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const b = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${a} – ${b}`;
}

/**
 * Full-screen weekly report for trainers: CoachConnect header, week pills, report body, bottom nav.
 */
export default function TrainerWeeklyReportScreen({
  clientId,
  clientName = '',
  /** When the signed-in client is viewing their own `weeklySummaries` (not a coach reviewing a client). */
  isClientSelfView = false,
  isDark = true,
  onClose,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onProfilePress,
  onSettingsPress,
}) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState([]);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [weekSearch, setWeekSearch] = useState('');

  const load = useCallback(async () => {
    if (!clientId || !db) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users', clientId, 'weeklySummaries'));
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.weekStart || r.weekId)
        .map((r) => ({
          ...r,
          weekStart: r.weekStart || r.weekId,
          weekEnd: r.weekEnd || r.weekEnd,
        }))
        .sort((a, b) => String(b.weekStart).localeCompare(String(a.weekStart)));
      setReports(rows);
      setSelectedDocId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows[0]?.id ?? null;
      });
    } catch (e) {
      console.warn('[TrainerWeeklyReportScreen] load failed', e?.message || e);
      setReports([]);
      setSelectedDocId(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredReports = useMemo(() => {
    const q = weekSearch.trim().toLowerCase();
    if (!q) return reports;
    return reports.filter((row) => {
      const label = formatChipRange(row.weekStart, row.weekEnd).toLowerCase();
      const ws = String(row.weekStart || '').toLowerCase();
      const we = String(row.weekEnd || row.weekStart || '').toLowerCase();
      return label.includes(q) || ws.includes(q) || we.includes(q);
    });
  }, [reports, weekSearch]);

  /** If the selected week is hidden by the search filter, jump to the first visible week. */
  useEffect(() => {
    if (filteredReports.length === 0) return;
    if (!filteredReports.some((r) => r.id === selectedDocId)) {
      setSelectedDocId(filteredReports[0].id);
    }
  }, [filteredReports, selectedDocId]);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedDocId) || reports[0] || null,
    [reports, selectedDocId]
  );

  const displayName = String(clientName || '').trim() || 'Client';

  const benefitLines = useMemo(() => {
    const lines = [...WEEKLY_CARD_BENEFITS];
    if (!loading && reports.length > 0) {
      lines[0] = `${reports.length} saved ${reports.length === 1 ? 'report' : 'reports'} · ${WEEKLY_CARD_BENEFITS[0]}`;
    }
    return lines;
  }, [loading, reports.length]);

  const heroDescription = loading
    ? 'Loading saved weekly summaries…'
    : reports.length === 0
      ? isClientSelfView
        ? 'No reports yet. Once you log check-ins and the weekly summary runs, your recaps will show up here.'
        : 'No reports yet. Once this client logs check-ins and the weekly summary runs, their recaps will show up here.'
      : isClientSelfView
        ? 'Below is every weekly report saved for you. Tap a week to open sleep, steps, trends, and coaching notes.'
        : 'Below is every weekly report we have for this client. Tap a week to open sleep, steps, trends, and coaching notes.';

  const scrollBottomPad = 100 + insets.bottom;

  const marketplaceHero = (
    <View
      style={styles.mpOuter}
      accessibilityRole="summary"
      accessibilityLabel={isClientSelfView ? 'Your weekly report' : 'Weekly report for client'}
    >
      <LinearGradient
        colors={ACCENT_BORDER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mpBorderRing, isDark ? styles.mpBorderRingShadowDark : styles.mpBorderRingShadowLight]}
      >
        <View style={[styles.mpInnerCard, { backgroundColor: isDark ? '#0A0A0F' : '#F8F9FC' }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.mpInnerWash,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent' },
            ]}
            pointerEvents="none"
          />
          <View style={styles.mpContent}>
            <Text style={[styles.mpLabel, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)' }]}>
              Weekly report
            </Text>
            <Text style={[styles.mpHeadline, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]} numberOfLines={2}>
              {displayName}
            </Text>
            <Text
              style={[styles.mpSubhead, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.62)' }]}
            >
              {heroDescription}
            </Text>
            <View style={styles.mpBenefits}>
              {benefitLines.map((line, i) => (
                <View key={`${i}-${line}`} style={styles.mpBenefitRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color={CHECK_COLORS[i % CHECK_COLORS.length]}
                    style={styles.mpCheckIcon}
                  />
                  <Text
                    style={[
                      styles.mpBenefitText,
                      { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.85)' },
                    ]}
                  >
                    {line}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const weekPickerStrip =
    reports.length > 0 ? (
      <View style={[styles.pillsStrip, { borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]}>
        <Text style={[styles.weekSectionTitle, { color: isDark ? WR_COLORS.textSecondary : '#475569' }]}>
          Select a week
        </Text>
        <View
          style={[
            styles.weekSearchRow,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <Ionicons name="search" size={18} color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.45)'} />
          <TextInput
            value={weekSearch}
            onChangeText={setWeekSearch}
            placeholder="Search weeks (e.g. Mar 23 or 2026-03)"
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(15,23,42,0.38)'}
            style={[styles.weekSearchInput, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            keyboardAppearance={isDark ? 'dark' : 'light'}
            accessibilityLabel="Search saved weeks by date"
          />
          {weekSearch.length > 0 && Platform.OS === 'android' ? (
            <TouchableOpacity onPress={() => setWeekSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={22} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.45)'} />
            </TouchableOpacity>
          ) : null}
        </View>
        {filteredReports.length === 0 ? (
          <Text style={[styles.weekSearchEmpty, { color: isDark ? WR_COLORS.textSecondary : '#64748b' }]}>
            No weeks match &quot;{weekSearch.trim()}&quot;. Try another date or clear the search.
          </Text>
        ) : (
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          keyboardShouldPersistTaps="handled"
        >
          {filteredReports.map((row) => {
            const sel = row.id === (selectedReport?.id || selectedDocId);
            const label = formatChipRange(row.weekStart, row.weekEnd);
            const mutedBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
            const mutedBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';

            return (
              <TouchableOpacity
                key={row.id}
                onPress={() => setSelectedDocId(row.id)}
                activeOpacity={0.88}
                style={[styles.weekPillWrap, !sel && styles.weekPillWrapMuted]}
              >
                {sel ? (
                  <>
                    <LinearGradient
                      colors={[WR_COLORS.cyan, WR_COLORS.purple]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.weekAccentBar}
                    />
                    <LinearGradient
                      colors={[WR_COLORS.cyan, WR_COLORS.purple]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.weekPillRing}
                    >
                      <View style={[styles.weekPillInner, { backgroundColor: isDark ? '#12121a' : '#f4f4f7' }]}>
                        <Text style={styles.weekPillTextSelected} numberOfLines={1}>
                          {label}
                        </Text>
                      </View>
                    </LinearGradient>
                  </>
                ) : (
                  <View
                    style={[
                      styles.weekPillMuted,
                      {
                        backgroundColor: mutedBg,
                        borderColor: mutedBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.weekPillTextMuted, { color: WR_COLORS.textSecondary }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        )}
      </View>
    ) : null;

  return (
    <LinearGradient colors={isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT} style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top', 'left', 'right']}>
        <CoachConnectHeader
          title="Weekly Report"
          isDark={isDark}
          onBack={onClose}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />

        {loading ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {marketplaceHero}
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={WR_COLORS.pink} size="large" />
              <Text style={[styles.loadingHint, { color: WR_COLORS.textTertiary }]}>Loading reports…</Text>
            </View>
          </ScrollView>
        ) : reports.length === 0 ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {marketplaceHero}
            <View style={styles.loadingWrap}>
              <Text style={[styles.emptyText, { color: isDark ? WR_COLORS.textSecondary : '#64748b' }]}>
                Saved weeks will list here once the first report exists.
              </Text>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.pageScrollContent, { paddingBottom: scrollBottomPad }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {marketplaceHero}
            {weekPickerStrip}
            {filteredReports.length === 0 && weekSearch.trim() ? (
              <View style={styles.reportBodyPad}>
                <Text style={[styles.filterEmptyBody, { color: isDark ? WR_COLORS.textSecondary : '#64748b' }]}>
                  No report to show for this search. Clear the field above to see all weeks again.
                </Text>
              </View>
            ) : (
              <View style={styles.reportBodyPad}>
                <WeeklyReportScrollBody report={selectedReport} />
              </View>
            )}
          </ScrollView>
        )}
        <BottomNavBar
          activeTabKey="home"
          onHomePress={onHomePress}
          onPlusPress={onPlusPress}
          onVoicePress={onVoicePress}
          onNutritionPress={onNutritionPress}
          onWorkoutPress={onWorkoutPress}
          onMessagesPress={onMessagesPress}
          onProfilePress={onProfilePress}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeTop: { flex: 1 },
  /** MarketplaceHeroCard-matched shell (no CTA). */
  mpOuter: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  mpBorderRing: {
    borderRadius: 24,
    padding: 2.5,
  },
  mpBorderRingShadowDark: {
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  mpBorderRingShadowLight: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  mpInnerCard: {
    borderRadius: 21,
    overflow: 'hidden',
  },
  mpInnerWash: {
    zIndex: 0,
  },
  mpContent: {
    padding: 20,
    gap: 14,
    zIndex: 1,
  },
  mpLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  mpHeadline: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  mpSubhead: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  mpBenefits: {
    gap: 8,
    marginTop: 2,
  },
  mpBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mpCheckIcon: {
    marginTop: 1,
  },
  mpBenefitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    minHeight: 220,
  },
  loadingHint: { marginTop: 12, fontSize: 13 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  pillsStrip: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginBottom: 10,
  },
  weekSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    marginBottom: 12,
  },
  weekSearchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    paddingVertical: Platform.OS === 'android' ? 4 : 0,
    minHeight: Platform.OS === 'android' ? 40 : 36,
  },
  weekSearchEmpty: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  pillsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8, paddingBottom: 2 },
  weekPillWrap: {
    marginRight: 4,
    maxWidth: 240,
    alignItems: 'center',
  },
  weekPillWrapMuted: {
    opacity: 0.78,
  },
  weekAccentBar: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    marginBottom: 8,
  },
  weekPillRing: {
    borderRadius: 22,
    padding: 3,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: WR_COLORS.purple,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  weekPillInner: {
    borderRadius: 20,
    paddingVertical: 11,
    paddingHorizontal: 16,
    minWidth: 120,
    alignItems: 'center',
  },
  weekPillTextSelected: {
    fontSize: 12,
    fontWeight: '800',
    color: WR_COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  weekPillMuted: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 120,
    alignItems: 'center',
  },
  weekPillTextMuted: {
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  /** One vertical scroll: hero + week chips + report scroll away together. */
  pageScrollContent: {
    flexGrow: 1,
    paddingTop: 2,
  },
  reportBodyPad: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  filterEmptyBody: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
