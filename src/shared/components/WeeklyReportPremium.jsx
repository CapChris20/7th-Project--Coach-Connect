import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export const WR_COLORS = {
  bg: '#0A0A0F',
  cardBg: '#141419',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  textTertiary: 'rgba(255,255,255,0.4)',
  pink: '#FF6B9D',
  cyan: '#06B6D4',
  purple: '#C084FC',
  orange: '#F97316',
  green: '#10B981',
};

const DAY_TONES = ['#FF6B9D', '#06B6D4', '#C084FC', '#F97316', '#10B981', '#FF6B9D', '#06B6D4'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TREND_TITLES = ['Sleep Rhythm', 'Hydration', 'Movement', 'Coaching Signal'];
/** Per-trend accent: sleep sky, water cyan, movement green, coaching purple */
const TREND_THEME = [
  { accent: '#38BDF8', glow: 'rgba(56,189,248,0.12)', borderGrad: ['#38BDF8', '#06B6D4'] },
  { accent: '#06B6D4', glow: 'rgba(6,182,212,0.12)', borderGrad: ['#06B6D4', '#22D3EE'] },
  { accent: '#10B981', glow: 'rgba(16,185,129,0.12)', borderGrad: ['#10B981', '#34D399'] },
  { accent: '#C084FC', glow: 'rgba(192,132,252,0.14)', borderGrad: ['#C084FC', '#FF6B9D'] },
];

const SPACE = { xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40 };
const WIN_CHECK_COLORS = ['#22D3EE', '#FF6B9D', '#F97316', '#C084FC'];

/** Safe string for <Text> — avoids RN crash when Firestore has objects in arrays. */
function textForReport(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text;
    if (typeof value.body === 'string') return value.body;
    if (typeof value.summary === 'string') return value.summary;
    if (typeof value.note === 'string') return value.note;
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

function formatStepsShort(raw) {
  if (raw == null || raw === '' || raw === 'N/A') return '—';
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(n)) return String(raw);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 1 : 1).replace(/\.0$/, '')}k`;
  return String(Math.round(n));
}

function buildMetricTiles(report) {
  const sleep = report?.avgSleep != null && report.avgSleep !== 'N/A' ? `${report.avgSleep}h` : '—';
  const water = report?.avgWater != null && report.avgWater !== 'N/A' ? `${String(report.avgWater).replace(/\.0$/, '')}oz` : '—';
  const steps = report?.avgSteps != null && report.avgSteps !== 'N/A' ? `${formatStepsShort(report.avgSteps)}` : '—';
  const energy = report?.avgEnergy != null && report.avgEnergy !== 'N/A' ? `${report.avgEnergy}/5` : '—';
  return [
    { value: sleep, label: 'AVG SLEEP', color: WR_COLORS.pink },
    { value: water, label: 'AVG WATER', color: WR_COLORS.cyan },
    { value: steps === '—' ? '—' : steps, label: 'AVG STEPS', color: WR_COLORS.purple },
    { value: energy, label: 'AVG ENERGY', color: WR_COLORS.orange },
  ];
}

function formatDateRange(report) {
  if (!report?.weekStart) return { compact: 'Week', full: '' };
  const start = new Date(`${report.weekStart}T12:00:00`);
  const end = report.weekEnd ? new Date(`${report.weekEnd}T12:00:00`) : start;
  const ms = start.toLocaleDateString('en-US', { month: 'short' });
  const me = end.toLocaleDateString('en-US', { month: 'short' });
  const mLongS = start.toLocaleDateString('en-US', { month: 'long' });
  const mLongE = end.toLocaleDateString('en-US', { month: 'long' });
  return {
    compact: `WEEK OF ${ms.toUpperCase()} ${start.getDate()} – ${me.toUpperCase()} ${end.getDate()}`,
    full: `${mLongS} ${start.getDate()} – ${mLongE} ${end.getDate()}, ${end.getFullYear()}`,
  };
}

function firstNameFromReport(report) {
  const nm = String(
    report?.clientDisplayName || report?.clientName || report?.athleteName || report?.name || ''
  ).trim();
  return nm.split(/\s+/).filter(Boolean)[0] || '';
}

export function parseDayNote(copy) {
  const s = String(copy || '');
  const colonIdx = s.indexOf(': ');
  const heading = colonIdx >= 0 ? s.slice(0, colonIdx) : s;
  const rest = colonIdx >= 0 ? s.slice(colonIdx + 2) : '';
  const dateMatch = heading.match(/(.+)\s+\((.+)\)/);
  return {
    day: dateMatch?.[1]?.trim() ?? heading.trim(),
    date: dateMatch?.[2]?.trim() ?? '',
    note: rest || s,
  };
}

function isRecoveryDay(note) {
  const n = String(note || '').toLowerCase();
  return /\brest\b|recovery|no workout|skipped|rest day|take a rest/i.test(n);
}

function extractPills(note, recovery) {
  const n = String(note || '');
  let steps = '—';
  const stepsM = n.match(/([\d,]+)\s*steps/i);
  if (stepsM) steps = `${formatStepsShort(stepsM[1].replace(/,/g, ''))}`;
  let energy = '—';
  const enM = n.match(/energy\s+(\d+(?:\.\d+)?)\/5/i);
  if (enM) energy = `${enM[1]}/5`;
  let mood = '—';
  const moodM = n.match(/mood\s+(\d+(?:\.\d+)?)\/10/i);
  if (moodM) mood = `${moodM[1]}/10`;
  let lift = recovery ? 'Rest' : '—';
  const wrM = n.match(/workout rating\s+(\d+(?:\.\d+)?)\/10/i);
  if (wrM) lift = `${wrM[1]}/10`;
  return {
    stepsLabel: steps === '—' ? 'Steps —' : `Steps ${steps}`,
    energyLabel: energy === '—' ? 'Energy —' : `Energy ${energy}`,
    moodLabel: mood === '—' ? 'Mood —' : `Mood ${mood}`,
    liftLabel: `Lift ${lift}`,
  };
}

const styles = StyleSheet.create({
  wrap: { width: '100%', backgroundColor: 'transparent' },
  cardOuter: { borderRadius: 20, padding: 3, marginHorizontal: 0, marginBottom: 0 },
  cardInner: {
    backgroundColor: WR_COLORS.cardBg,
    borderRadius: 17,
    padding: 22,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  cardDateLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: WR_COLORS.textTertiary,
    letterSpacing: 1.2,
    flex: 1,
    paddingRight: 8,
  },
  readyBadge: {
    backgroundColor: 'rgba(192,132,252,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.45)',
  },
  readyBadgeText: { fontSize: 11, fontWeight: '800', color: WR_COLORS.textPrimary },
  metricGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18, gap: 8 },
  metricTile: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  metricValue: { fontSize: 22, fontWeight: '900', marginBottom: 6 },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: WR_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  summaryText: {
    fontSize: 14,
    color: WR_COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
    fontWeight: '600',
  },
  openButton: { alignSelf: 'stretch', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, marginTop: 4 },
  openButtonText: { fontSize: 15, fontWeight: '900', color: WR_COLORS.textPrimary, textAlign: 'center' },
  modalContent: { flex: 1, backgroundColor: WR_COLORS.bg },
  scrollContent: { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 64 },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 40,
    right: 16,
    width: 44,
    height: 44,
    zIndex: 100,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButtonText: { fontSize: 28, color: WR_COLORS.textSecondary, fontWeight: '300', lineHeight: 30 },
  heroRing: { borderRadius: 22, padding: 3, marginBottom: SPACE.lg },
  heroCard: { borderRadius: 19, paddingVertical: 28, paddingHorizontal: 24, alignItems: 'center' },
  heroLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: WR_COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 2,
    textAlign: 'center',
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '900',
    color: WR_COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  heroSubtitle: {
    fontSize: 14,
    color: WR_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '600',
    paddingHorizontal: 4,
  },
  metricsGridWrap: { marginBottom: SPACE.lg },
  modalMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalMetricOuter: {
    width: '47%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 16,
    padding: 3,
    alignSelf: 'stretch',
  },
  modalMetricBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: WR_COLORS.cardBg,
    flex: 1,
    minHeight: 108,
  },
  modalMetricValue: { fontSize: 28, fontWeight: '900', marginBottom: 10 },
  metricLabelTight: {
    fontSize: 11,
    fontWeight: '800',
    color: WR_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  sectionSpacer: { height: SPACE.lg },
  sectionBlock: { marginTop: SPACE.sm, marginBottom: SPACE.md },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: WR_COLORS.textTertiary,
    letterSpacing: 2.2,
    marginBottom: SPACE.sm,
    textTransform: 'uppercase',
  },
  sectionTitleRow: { marginBottom: SPACE.sm },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '900',
    color: WR_COLORS.textPrimary,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  sectionHeadingAccentWide: {
    height: 4,
    width: '100%',
    borderRadius: 3,
    marginTop: SPACE.sm,
  },
  dayCardOuter: { borderRadius: 18, padding: 3, marginBottom: SPACE.md },
  dayCardInner: {
    borderRadius: 15,
    backgroundColor: WR_COLORS.cardBg,
    paddingVertical: 18,
    paddingHorizontal: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  dayLeftAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  dayCardBody: { paddingLeft: 12 },
  dayIndexLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: WR_COLORS.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayTitleLarge: {
    fontSize: 22,
    fontWeight: '900',
    color: WR_COLORS.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  dayMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  dayDateMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: WR_COLORS.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  statusBadgeRecovery: {
    backgroundColor: 'rgba(6,182,212,0.15)',
    borderColor: 'rgba(6,182,212,0.35)',
  },
  statusBadgeWorkout: {
    backgroundColor: 'rgba(255,107,157,0.15)',
    borderColor: 'rgba(255,107,157,0.4)',
  },
  statusBadgeText: { fontSize: 12, fontWeight: '800', color: WR_COLORS.textPrimary },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  dayPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: WR_COLORS.textPrimary,
  },
  dayNote: {
    fontSize: 13,
    color: WR_COLORS.textSecondary,
    lineHeight: 20,
    fontWeight: '500',
  },
  trendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  trendCardWrap: { width: '47.5%', marginBottom: 4, minWidth: 150 },
  trendCardRing: { borderRadius: 18, padding: 3, flex: 1 },
  trendCardInner: {
    borderRadius: 15,
    padding: 18,
    flex: 1,
    minHeight: 132,
  },
  trendTitle: { fontSize: 17, fontWeight: '900', color: WR_COLORS.textPrimary, marginBottom: 10 },
  trendText: { fontSize: 13, color: WR_COLORS.textSecondary, lineHeight: 20, fontWeight: '500' },
  /** Stacked summary cards — full width, glass interior, gradient frame only (no solid color slabs). */
  summaryGrid: { flexDirection: 'column', gap: 14, marginBottom: SPACE.md },
  summaryGlowOuter: { width: '100%', borderRadius: 18, padding: 2 },
  winsInner: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: WR_COLORS.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    borderLeftColor: WR_COLORS.green,
  },
  focusInner: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: WR_COLORS.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 4,
    borderLeftColor: WR_COLORS.orange,
  },
  panelKicker: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    color: WR_COLORS.textTertiary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  panelTitle: { fontSize: 20, fontWeight: '900', marginBottom: 16, letterSpacing: -0.3 },
  panelTitleLarge: { fontSize: 20, fontWeight: '900', marginBottom: 16, letterSpacing: -0.3 },
  winsTitle: { color: WR_COLORS.green },
  focusTitle: { color: WR_COLORS.orange },
  winRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 14 },
  winIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  listItemWin: {
    flex: 1,
    fontSize: 14,
    color: WR_COLORS.textSecondary,
    lineHeight: 22,
    fontWeight: '600',
    paddingRight: 4,
  },
  focusRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 14 },
  focusIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(249,115,22,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  listItemFocus: {
    flex: 1,
    fontSize: 14,
    color: WR_COLORS.textSecondary,
    lineHeight: 22,
    fontWeight: '600',
    paddingRight: 4,
  },
  focusTrack: { paddingLeft: 2, paddingTop: 4 },
  focusItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16, position: 'relative' },
  focusConnector: {
    position: 'absolute',
    left: 19,
    top: 44,
    width: 2,
    height: 20,
    backgroundColor: 'rgba(255,107,157,0.45)',
    borderRadius: 1,
  },
  focusNumberOuter: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 3,
    marginRight: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: WR_COLORS.pink,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  focusNumberInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: WR_COLORS.pink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  focusNumberText: { fontWeight: '900', color: '#FFFFFF', fontSize: 16 },
  focusText: { flex: 1, fontSize: 14, color: WR_COLORS.textSecondary, lineHeight: 22, fontWeight: '600', paddingTop: 6 },
  /** Thin gradient frame + solid card interior (same language as day cards — not a full-bleed ad slab). */
  signoffRing: { borderRadius: 18, padding: 3, marginTop: SPACE.lg, marginBottom: SPACE.xxl },
  signoffInner: {
    borderRadius: 15,
    paddingVertical: 20,
    paddingHorizontal: 18,
    backgroundColor: WR_COLORS.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    position: 'relative',
  },
  signoffAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: WR_COLORS.purple,
    borderTopLeftRadius: 15,
    borderBottomLeftRadius: 15,
  },
  signoffBody: { paddingLeft: 10 },
  signoffKicker: {
    fontSize: 11,
    fontWeight: '800',
    color: WR_COLORS.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  signoffText: {
    fontSize: 14,
    color: WR_COLORS.textSecondary,
    textAlign: 'left',
    lineHeight: 22,
    fontStyle: 'normal',
    fontWeight: '500',
  },
  marketingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: WR_COLORS.textTertiary,
    marginHorizontal: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  marketingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: WR_COLORS.textPrimary,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  marketingSub: {
    fontSize: 13,
    color: WR_COLORS.textSecondary,
    marginHorizontal: 16,
    marginBottom: 22,
    lineHeight: 20,
  },
  loadingBox: { paddingVertical: 36, alignItems: 'center', justifyContent: 'center' },
  screenScrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 120 },
});

/** Report body only — hero through sign-off (no Modal). Used by modal and trainer full-screen page. */
export function WeeklyReportScrollBody({ report }) {
  const metricTiles = useMemo(() => buildMetricTiles(report), [report]);
  const dates = useMemo(() => formatDateRange(report), [report]);
  const trends = Array.isArray(report?.trends) ? report.trends.map(textForReport) : [];
  const wins = Array.isArray(report?.wins) ? report.wins.map(textForReport) : [];
  const cons = Array.isArray(report?.cons) ? report.cons.map(textForReport) : [];
  const focus = Array.isArray(report?.focus) ? report.focus.map(textForReport) : [];
  const days = Array.isArray(report?.dayBreakdown) ? report.dayBreakdown.map(textForReport) : [];

  const heroFirst = firstNameFromReport(report);
  const heroHeadline = heroFirst ? `${heroFirst}'s week in review` : 'Your week in review';

  if (!report) {
    return (
      <View style={{ paddingVertical: 24 }}>
        <Text style={{ color: WR_COLORS.textSecondary, textAlign: 'center' }}>No report data.</Text>
      </View>
    );
  }

  return (
    <>
      <LinearGradient
        colors={[WR_COLORS.pink, WR_COLORS.purple, WR_COLORS.cyan]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroRing}
      >
        <View style={[styles.heroCard, { backgroundColor: WR_COLORS.cardBg }]}>
          <Text style={styles.heroLabel}>Weekly report</Text>
          <Text style={styles.heroTitle}>{heroHeadline}</Text>
          <Text style={styles.heroSubtitle}>
            {dates.full || 'Week-at-a-glance averages, daily notes, trends, and coaching takeaways.'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.metricsGridWrap}>
        <View style={styles.modalMetricGrid}>
          {metricTiles.map((metric) => {
            const borderColors = [metric.color, WR_COLORS.purple];
            return (
              <LinearGradient
                key={`m-${metric.label}`}
                colors={borderColors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalMetricOuter}
              >
                <View style={styles.modalMetricBox}>
                  <Text style={[styles.modalMetricValue, { color: metric.color }]}>{metric.value}</Text>
                  <Text style={styles.metricLabelTight}>{metric.label}</Text>
                </View>
              </LinearGradient>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionSpacer} />

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>Check-ins</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>Daily breakdown</Text>
        </View>
        <LinearGradient
          colors={[WR_COLORS.cyan, WR_COLORS.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionHeadingAccentWide}
        />
      </View>
      {days.map((dayLine, index) => {
        const parsed = parseDayNote(dayLine);
        const recovery = isRecoveryDay(parsed.note);
        const pills = extractPills(parsed.note, recovery);
        const tone = DAY_TONES[index % DAY_TONES.length];
        const dayTitle = DAY_LABELS[index] || parsed.day;
        const pillLabels = [pills.stepsLabel, pills.energyLabel, pills.moodLabel, pills.liftLabel];

        return (
          <LinearGradient
            key={`day-${index}`}
            colors={[tone, WR_COLORS.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.dayCardOuter}
          >
            <View style={styles.dayCardInner}>
              <View style={[styles.dayLeftAccent, { backgroundColor: tone }]} />
              <View style={styles.dayCardBody}>
                <Text style={styles.dayIndexLabel}>Day {index + 1}</Text>
                <Text style={styles.dayTitleLarge}>{dayTitle}</Text>
                <View style={styles.dayMetaRow}>
                  <Text style={styles.dayDateMuted}>{parsed.date || '—'}</Text>
                  <View style={[styles.statusBadge, recovery ? styles.statusBadgeRecovery : styles.statusBadgeWorkout]}>
                    <Text style={styles.statusBadgeText}>{recovery ? 'Recovery' : 'Workout'}</Text>
                  </View>
                </View>
                <View style={styles.pillRow}>
                  {pillLabels.map((pl, pi) => (
                    <View key={`pill-${index}-${pi}`} style={styles.dayPill}>
                      <Text style={styles.dayPillText}>{pl}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.dayNote} numberOfLines={8}>
                  {parsed.note}
                </Text>
              </View>
            </View>
          </LinearGradient>
        );
      })}

      <View style={styles.sectionSpacer} />

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>Insights</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>Weekly trends</Text>
        </View>
        <LinearGradient
          colors={[WR_COLORS.purple, WR_COLORS.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionHeadingAccentWide}
        />
      </View>
      <View style={styles.trendGrid}>
        {trends.slice(0, 4).map((trend, index) => {
          const theme = TREND_THEME[index % TREND_THEME.length];
          const grad = theme.borderGrad || [theme.accent, WR_COLORS.purple];
          return (
            <View key={`t-${index}`} style={styles.trendCardWrap}>
              <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.trendCardRing}>
                <View style={[styles.trendCardInner, { backgroundColor: WR_COLORS.cardBg }]}>
                  <Text style={styles.trendTitle}>{TREND_TITLES[index] || `Trend ${index + 1}`}</Text>
                  <Text style={styles.trendText}>{trend}</Text>
                </View>
              </LinearGradient>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionSpacer} />

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>Performance</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>Summary</Text>
        </View>
        <LinearGradient
          colors={[WR_COLORS.orange, WR_COLORS.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionHeadingAccentWide}
        />
      </View>
      <View style={styles.summaryGrid}>
        <LinearGradient
          colors={[WR_COLORS.green, WR_COLORS.cyan]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryGlowOuter}
        >
          <View style={styles.winsInner}>
            <Text style={styles.panelKicker}>What went well</Text>
            <Text style={[styles.panelTitleLarge, styles.winsTitle]}>Wins</Text>
            {(wins.length ? wins : []).slice(0, 6).map((item, index) => (
              <View key={`w-${index}`} style={styles.winRow}>
                <View style={[styles.winIconWrap, { backgroundColor: WIN_CHECK_COLORS[index % WIN_CHECK_COLORS.length] }]}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.listItemWin}>{item}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
        <LinearGradient
          colors={[WR_COLORS.orange, WR_COLORS.pink]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryGlowOuter}
        >
          <View style={styles.focusInner}>
            <Text style={styles.panelKicker}>Coaching priorities</Text>
            <Text style={[styles.panelTitle, styles.focusTitle]}>Focus areas</Text>
            {(cons.length ? cons : []).slice(0, 6).map((item, index) => (
              <View key={`c-${index}`} style={styles.focusRow}>
                <View style={styles.focusIconWrap}>
                  <Ionicons name="alert" size={16} color={WR_COLORS.orange} />
                </View>
                <Text style={styles.listItemFocus}>{item}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      <View style={styles.sectionSpacer} />

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionEyebrow}>Next week</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>Your focus</Text>
        </View>
        <LinearGradient
          colors={[WR_COLORS.pink, WR_COLORS.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.sectionHeadingAccentWide}
        />
      </View>
      <View style={styles.focusTrack}>
        {focus.map((item, index) => (
          <View key={`f-${index}`} style={styles.focusItem}>
            {index < focus.length - 1 ? <View style={styles.focusConnector} /> : null}
            <LinearGradient
              colors={[WR_COLORS.pink, WR_COLORS.orange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.focusNumberOuter}
            >
              <View style={styles.focusNumberInner}>
                <Text style={styles.focusNumberText}>{index + 1}</Text>
              </View>
            </LinearGradient>
            <Text style={styles.focusText}>{item}</Text>
          </View>
        ))}
      </View>

      {report?.signOff ? (
        <LinearGradient
          colors={[WR_COLORS.pink, WR_COLORS.purple]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.signoffRing}
        >
          <View style={styles.signoffInner}>
            <View style={styles.signoffAccent} pointerEvents="none" />
            <View style={styles.signoffBody}>
              <Text style={styles.signoffKicker}>Coach sign-off</Text>
              <Text style={styles.signoffText}>{textForReport(report.signOff)}</Text>
            </View>
          </View>
        </LinearGradient>
      ) : null}
    </>
  );
}

function WeeklyReportCard({ report, metricTiles, onOpen }) {
  const dates = useMemo(() => formatDateRange(report), [report]);

  return (
    <LinearGradient
      colors={[WR_COLORS.cyan, WR_COLORS.purple, WR_COLORS.pink]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.cardOuter}
    >
      <View style={styles.cardInner}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardDateLabel} numberOfLines={2}>
            {dates.compact}
          </Text>
          <View style={styles.readyBadge}>
            <Text style={styles.readyBadgeText}>Ready</Text>
          </View>
        </View>

        <View style={styles.metricGrid}>
          {metricTiles.map((metric) => (
            <View key={metric.label} style={styles.metricTile}>
              <Text style={[styles.metricValue, { color: metric.color }]}>{metric.value}</Text>
              <Text style={styles.metricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.summaryText} numberOfLines={3}>
          {report.summary || 'No summary for this week.'}
        </Text>

        <TouchableOpacity activeOpacity={0.88} onPress={onOpen} style={{ alignSelf: 'stretch' }}>
          <LinearGradient
            colors={[WR_COLORS.pink, WR_COLORS.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.openButton}
          >
            <Text style={styles.openButtonText}>Open report</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

/** Full-screen weekly report (trainer or client). Builds metric tiles from `report`. */
export function WeeklyReportDetailModal({ report, visible, onClose }) {
  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalContent, { flex: 1 }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: WR_COLORS.bg }} edges={['top', 'left', 'right']}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>
            <WeeklyReportScrollBody report={report} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

/**
 * Premium weekly report card + full-screen modal. Uses Firestore weeklySummaries shape.
 */
export default function WeeklyReportPremium({ weeklySummary, loading, showMarketingHeader }) {
  const [modalVisible, setModalVisible] = useState(false);
  const metricTiles = useMemo(() => buildMetricTiles(weeklySummary), [weeklySummary]);

  if (loading) {
    return (
      <View style={styles.wrap}>
        {showMarketingHeader ? (
          <>
            <Text style={styles.marketingLabel}>Weekly Report</Text>
            <Text style={styles.marketingTitle}>CoachConnect</Text>
            <Text style={styles.marketingSub}>
              Premium client performance recap for trainers who need the whole week in one tap.
            </Text>
          </>
        ) : null}
        <View style={[styles.cardInner, { minHeight: 140 }]}>
          <View style={styles.loadingBox}>
            <ActivityIndicator color={WR_COLORS.pink} size="large" />
            <Text style={{ color: WR_COLORS.textTertiary, marginTop: 12, fontSize: 13 }}>Loading weekly report…</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!weeklySummary) return null;

  return (
    <View style={styles.wrap}>
      {showMarketingHeader ? (
        <>
          <Text style={styles.marketingLabel}>Weekly Report</Text>
          <Text style={styles.marketingTitle}>CoachConnect</Text>
          <Text style={styles.marketingSub}>
            Premium client performance recap for trainers who need the whole week in one tap.
          </Text>
        </>
      ) : null}

      <WeeklyReportCard report={weeklySummary} metricTiles={metricTiles} onOpen={() => setModalVisible(true)} />

      <WeeklyReportDetailModal
        report={weeklySummary}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}
