// Premium weekly-report UI: theme, day-note parsers, hero, scroll body, and preview card.
// Flow: parse report text → build metric tiles / day cards → render scroll body or modal.
// Used by: WeeklyReportScreen, TrainerWeeklyReportSection, WeeklyReportBanner, StatIcon.
import React, { createContext, useContext, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Modal,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
  UIManager,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FORM_SCROLL_PROPS, SHELL_SAFE_AREA_EDGES, useModalScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import OutlinedColorText from '../../for-both/icons/OutlinedColorText';
import {
  HOME_STAT_ENERGY_GRADIENT,
  HOME_STAT_MOOD_GRADIENT,
  HOME_STAT_SLEEP_GRADIENT,
  HOME_STAT_SORENESS_GRADIENT,
  HOME_STAT_STRESS_GRADIENT,
  HOME_STAT_WATER_GRADIENT,
  HOME_STAT_WORKOUT_GRADIENT,
} from '../../look-and-feel/homeStatColors';

// ===== NAMED CONSTANTS =====

// Manipulate here: week length and step scaling for hero bars / short labels.
const DAYS_IN_WEEK = 7;
const STEPS_SHORT_THRESHOLD = 1000;
const STEPS_DAILY_GOAL = 10000;
const MODAL_SCROLL_BOTTOM_PAD = 56;
const MAX_HERO_HIGHLIGHTS = 3;
const MIN_HIGHLIGHTS_BEFORE_TRENDS = 2;
const NOON_HOUR_FOR_DATE_PARSE = 12;


/** Progress bar fill colors — first stop of each metric gradient. */
export const WR_STAT_BAR = {
  sleep: HOME_STAT_SLEEP_GRADIENT[0],
  water: HOME_STAT_WATER_GRADIENT[0],
  steps: HOME_STAT_MOOD_GRADIENT[0],
  energy: HOME_STAT_ENERGY_GRADIENT[0]
};

/** Dark purple → dark orange (matches Today card & Quick Actions). */
export const WR_BRAND_GRADIENT = ['#6D28D9', '#C2410C'];

/** Per-metric visuals — custom PNG + home-stat gradient rings (no flat purple/pink fills). */
export const WR_METRIC_VISUAL = {
  sleep: {
    source: require('../../assets/icons/sleeping.png'),
    gradient: HOME_STAT_SLEEP_GRADIENT
  },
  water: {
    source: require('../../assets/icons/hydration.png'),
    gradient: HOME_STAT_WATER_GRADIENT
  },
  steps: {
    source: require('../../assets/icons/journey.png'),
    gradient: HOME_STAT_MOOD_GRADIENT
  },
  energy: {
    source: require('../../assets/icons/energy.png'),
    gradient: HOME_STAT_ENERGY_GRADIENT
  },
  scale: {
    source: require('../../assets/icons/scales.png'),
    gradient: HOME_STAT_WORKOUT_GRADIENT
  },
  workout: {
    source: require('../../assets/icons/workout.png'),
    gradient: HOME_STAT_WORKOUT_GRADIENT
  },
  stress: {
    source: require('../../assets/icons/stress.png'),
    gradient: HOME_STAT_STRESS_GRADIENT
  },
  soreness: {
    source: require('../../assets/icons/injury.png'),
    gradient: HOME_STAT_SORENESS_GRADIENT
  },
  mood: {
    source: require('../../assets/icons/environment.png'),
    gradient: HOME_STAT_MOOD_GRADIENT
  },
  bodyfat: {
    source: require('../../assets/icons/Progress.png'),
    gradient: HOME_STAT_MOOD_GRADIENT
  }
};

// ===== HELPER FUNCTIONS =====

function pillKeyToMetricKey(key) {
  const map = {
    sleep: 'sleep',
    water: 'water',
    steps: 'steps',
    energy: 'energy',
    mood: 'mood',
    stress: 'stress',
    soreness: 'soreness',
    weight: 'scale',
    lift: 'workout',
    bodyfat: 'bodyfat',
    training: 'workout'
  };
  return map[key] || 'energy';
}

function wrIconToMetricKey(icon) {
  const map = {
    'moon-outline': 'sleep',
    'water-outline': 'water',
    'footsteps-outline': 'steps',
    'flash-outline': 'energy',
    'scale-outline': 'scale',
    'barbell-outline': 'workout',
    'pulse-outline': 'energy'
  };
  return map[icon] || 'energy';
}

function WRMetricIcon({ metricKey, size = 36, imageSize = 20 }) {
  const themeColors = useWRTheme();
  const visual = WR_METRIC_VISUAL[metricKey] || WR_METRIC_VISUAL.energy;
  const innerRadius = Math.max(8, size / 2 - 2);
  return (
    <LinearGradient
      colors={visual.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: innerRadius + 2, padding: 1.5 }}>
      
      <View
        style={{
          flex: 1,
          borderRadius: innerRadius,
          backgroundColor: themeColors.isDark ? 'rgba(12,10,20,0.98)' : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
        
        <Image source={visual.source} style={{ width: imageSize, height: imageSize }} resizeMode="contain" />
      </View>
    </LinearGradient>);

}

/** Legacy export — prefer getWRTheme(isDark). */
export const WR_COLORS = {
  bg: '#0A0A0F',
  card: '#1A1A2E',
  badge: '#1C1C2E',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.60)',
  textLabel: 'rgba(255,255,255,0.45)',
  metricLabel: 'rgba(255,255,255,0.50)',
  pink: '#FF6B9D',
  cyan: '#06B6D4',
  purple: '#C084FC',
  orange: '#F97316'
};

/**
 * Light/dark color tokens for every weekly-report surface in this file.
 * @param {boolean} [isDark=true]
 * @returns {object}
 */
export function getWRTheme(isDark = true) {
  if (isDark) {
    return {
      isDark: true,
      bg: '#0A0A0F',
      card: '#1A1A2E',
      badge: '#1C1C2E',
      border: 'rgba(255,255,255,0.08)',
      textPrimary: '#FFFFFF',
      textSecondary: 'rgba(255,255,255,0.60)',
      textLabel: 'rgba(255,255,255,0.45)',
      metricLabel: 'rgba(255,255,255,0.50)',
      barTrack: 'rgba(255,255,255,0.08)',
      coachNoteBg: 'rgba(6,182,212,0.08)',
      coachNoteBorder: 'rgba(6,182,212,0.18)',
      tagWorkoutBg: 'rgba(255,107,157,0.22)',
      tagRecoveryBg: 'rgba(6,182,212,0.22)',
      pink: '#FF6B9D',
      cyan: '#06B6D4',
      purple: '#C084FC',
      orange: '#F97316',
      statBar: WR_STAT_BAR,
      brandGradient: WR_BRAND_GRADIENT,
      grad: {
        pinkOrange: WR_BRAND_GRADIENT,
        purplePink: WR_BRAND_GRADIENT,
        orangePink: WR_BRAND_GRADIENT
      },
      heroTop: WR_BRAND_GRADIENT,
      heroBg: ['#1a0a2e', '#0f0a1a'],
      cta: WR_BRAND_GRADIENT,
      weekBarBg: 'rgba(255,255,255,0.02)',
      weekPillBg: 'rgba(255,255,255,0.08)',
      focusBadgeBg: 'rgba(109,40,217,0.28)',
      exerciseDot: '#C2410C'
    };
  }
  return {
    isDark: false,
    bg: '#F2F2F7',
    card: '#FFFFFF',
    badge: '#F1F5F9',
    border: 'rgba(15,23,42,0.10)',
    textPrimary: '#0F172A',
    textSecondary: 'rgba(15,23,42,0.62)',
    textLabel: 'rgba(15,23,42,0.45)',
    metricLabel: 'rgba(15,23,42,0.50)',
    barTrack: 'rgba(15,23,42,0.08)',
    coachNoteBg: 'rgba(6,182,212,0.08)',
    coachNoteBorder: 'rgba(6,182,212,0.22)',
    tagWorkoutBg: 'rgba(255,107,157,0.14)',
    tagRecoveryBg: 'rgba(6,182,212,0.14)',
    pink: '#DB2777',
    cyan: '#0891B2',
    purple: '#7C3AED',
    orange: '#EA580C',
    statBar: WR_STAT_BAR,
    brandGradient: WR_BRAND_GRADIENT,
    grad: {
      pinkOrange: WR_BRAND_GRADIENT,
      purplePink: WR_BRAND_GRADIENT,
      orangePink: WR_BRAND_GRADIENT
    },
    heroTop: WR_BRAND_GRADIENT,
    heroBg: ['#F8FAFF', '#FFFFFF'],
    cta: WR_BRAND_GRADIENT,
    weekBarBg: 'rgba(0,0,0,0.02)',
    weekPillBg: 'rgba(15,23,42,0.06)',
    focusBadgeBg: 'rgba(109,40,217,0.14)',
    exerciseDot: '#C2410C'
  };
}

const WRlightDarkMode = createContext(getWRTheme(true));
function useWRTheme() {
  return useContext(WRlightDarkMode);
}

const CTA_GRADIENT = WR_BRAND_GRADIENT;
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SPACE = {
  screen: 16,
  section: 32,
  cardGap: 16,
  listGap: 12,
  cardPad: 20
};

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
  if (raw == null || raw === '' || raw === 'N/A') return null;
  const parsedNumber = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(parsedNumber)) return String(raw);
  if (parsedNumber >= STEPS_SHORT_THRESHOLD) return `${(parsedNumber / STEPS_SHORT_THRESHOLD).toFixed(1).replace(/\.0$/, '')}k`;
  return String(Math.round(parsedNumber));
}

function metricProgressPct(key, report) {
  const num = (vParam) => {
    const parsedNumber = parseFloat(String(vParam ?? '').replace(/,/g, ''));
    return Number.isFinite(parsedNumber) ? parsedNumber : null;
  };
  switch (key) {
    case 'sleep':{
        const numericValue1 = num(report?.avgSleep);
        return numericValue1 == null ? 0 : Math.min(numericValue1 / 8, 1);
      }
    case 'water':{
        const numericValue2 = num(report?.avgWater);
        return numericValue2 == null ? 0 : Math.min(numericValue2 / 64, 1);
      }
    case 'steps':{
        const numericValue3 = num(report?.avgSteps);
        return numericValue3 == null ? 0 : Math.min(numericValue3 / STEPS_DAILY_GOAL, 1);
      }
    case 'energy':{
        const numericValue4 = num(report?.avgEnergy);
        return numericValue4 == null ? 0 : Math.min(numericValue4 / 8, 1);
      }
    default:
      return 0;
  }
}

function buildMetricTiles(report) {
  const sleep = report?.avgSleep != null && report.avgSleep !== 'N/A' ? `${report.avgSleep}h` : null;
  const water =
  report?.avgWater != null && report.avgWater !== 'N/A' ? `${String(report.avgWater).replace(/\.0$/, '')}oz` : null;
  const steps =
  report?.avgSteps != null && report.avgSteps !== 'N/A' ? formatStepsShort(report.avgSteps) : null;
  const energy = report?.avgEnergy != null && report.avgEnergy !== 'N/A' ? `${report.avgEnergy}/8` : null;
  const tiles = [
  { key: 'sleep', label: 'AVG SLEEP', value: sleep ?? '—', accent: WR_STAT_BAR.sleep },
  { key: 'water', label: 'AVG WATER', value: water ?? '—', accent: WR_STAT_BAR.water },
  { key: 'steps', label: 'AVG STEPS', value: steps ?? '—', accent: WR_STAT_BAR.steps },
  { key: 'energy', label: 'AVG ENERGY', value: energy ?? '—', accent: WR_STAT_BAR.energy }];

  return tiles.map((trendItem) => ({ ...trendItem, progress: metricProgressPct(trendItem.key, report) }));
}

/**
 * Compact and long date labels for the week chip / hero.
 * @param {object} report
 * @returns {{ compact: string, full: string }}
 */
export function formatDateRange(report) {
  if (!report?.weekStart) return { compact: 'Week', full: '' };
  const start = new Date(`${report.weekStart}T12:00:00`);
  const end = report.weekEnd ? new Date(`${report.weekEnd}T12:00:00`) : start;
  const ms = start.toLocaleDateString('en-US', { month: 'short' });
  const me = end.toLocaleDateString('en-US', { month: 'short' });
  const mLongS = start.toLocaleDateString('en-US', { month: 'long' });
  const mLongE = end.toLocaleDateString('en-US', { month: 'long' });
  return {
    compact: `${ms} ${start.getDate()} – ${me} ${end.getDate()}`,
    full: `${mLongS} ${start.getDate()} – ${mLongE} ${end.getDate()}, ${end.getFullYear()}`
  };
}

function firstNameFromReport(report, clientName = '') {
  const nm = String(
    report?.clientDisplayName || report?.clientName || report?.athleteName || report?.name || clientName || ''
  ).trim();
  return nm.split(/\s+/).filter(Boolean)[0] || '';
}

function countLoggedDays(report) {
  const lines = Array.isArray(report?.dayBreakdown) ? report.dayBreakdown : [];
  if (!lines.length) {
    const summary = textForReport(report?.summary);
    const loggedMatch = summary.match(/logged\s+(\d+)\s+of\s+7/i);
    if (loggedMatch) return Number(loggedMatch[1]);
    return null;
  }
  return lines.filter((line) => {
    const { note } = parseDayNote(textForReport(line));
    return !isEmptyCheckIn(note);
  }).length;
}

function formatHeroMetricValue(key, report) {
  const raw = report?.[`avg${key.charAt(0).toUpperCase()}${key.slice(1)}`];
  if (raw == null || raw === '' || raw === 'N/A') return null;
  switch (key) {
    case 'sleep':
      return `${String(raw).replace(/\.0$/, '')}h`;
    case 'water':
      return `${String(raw).replace(/\.0$/, '')} oz`;
    case 'steps':
      return formatStepsShort(raw) || String(raw);
    case 'energy':
      return `${raw}/8`;
    case 'weight':
      return `${String(raw).replace(/\.0$/, '')} lbs`;
    default:
      return String(raw);
  }
}

/**
 * Pick an Ionicons name from free-text trend wording.
 * @param {string} line
 * @returns {string}
 */
function iconForTrendLine(line) {
  if (/sleep/i.test(line)) return 'moon-outline';
  if (/water|hydration/i.test(line)) return 'water-outline';
  if (/step|movement|walk/i.test(line)) return 'footsteps-outline';
  return 'pulse-outline';
}

/**
 * Sleep range or single-day sleep line from the AI-free summary paragraph.
 * @param {string} summary
 * @param {Array} highlights
 */
function pushSleepHighlightFromSummary(summary, highlights) {
  const sleepRange = summary.match(/Sleep ranged from ([\d.]+)\s*h[^.]*to ([\d.]+)\s*h/i);
  if (sleepRange) {
    highlights.push({
      icon: 'moon-outline',
      text: `Sleep ranged ${sleepRange[1]}–${sleepRange[2]} h across logged days`,
    });
    return;
  }
  const singleSleep = summary.match(/Sleep logged on [^:]+:\s*([\d.]+)\s*h/i);
  if (!singleSleep) return;
  highlights.push({ icon: 'moon-outline', text: `Sleep logged: ${singleSleep[1]} h on one day` });
}

/**
 * @param {string} countText
 * @param {string} singular
 * @param {string} plural
 * @returns {string}
 */
function dayCountLabel(countText, singular, plural) {
  if (countText === '1') return singular;
  return plural;
}

/**
 * Fill remaining highlight slots from report.trends when summary was thin.
 * @param {object} report
 * @param {Array} highlights
 */
function appendTrendHighlights(report, highlights) {
  if (highlights.length >= MIN_HIGHLIGHTS_BEFORE_TRENDS) return;
  if (!Array.isArray(report?.trends)) return;

  for (const trendLine of report.trends) {
    const line = textForReport(trendLine);
    if (!line) continue;
    highlights.push({ icon: iconForTrendLine(line), text: line });
    if (highlights.length >= MAX_HERO_HIGHLIGHTS) break;
  }
}

function buildHeroHighlights(report) {
  const highlights = [];
  const summary = textForReport(report?.summary);

  // 1. Sleep range / single day from the summary sentence.
  pushSleepHighlightFromSummary(summary, highlights);

  // 2. Water goal days.
  const waterDays = summary.match(/(\d+)\s+day\(s\)\s+met or exceeded 64 oz water/i);
  if (waterDays) {
    const waterLabel = dayCountLabel(waterDays[1], '1 day at 64+ oz water', `${waterDays[1]} days at 64+ oz water`);
    highlights.push({ icon: 'water-outline', text: waterLabel });
  }

  // 3. Workout days.
  const workoutDays = summary.match(/(\d+)\s+day\(s\)\s+included a workout/i);
  if (workoutDays) {
    const workoutLabel = dayCountLabel(
      workoutDays[1],
      '1 training day recorded',
      `${workoutDays[1]} training days recorded`,
    );
    highlights.push({ icon: 'barbell-outline', text: workoutLabel });
  }

  // 4. Top up from trends if we still have fewer than two highlights.
  appendTrendHighlights(report, highlights);

  return highlights.slice(0, MAX_HERO_HIGHLIGHTS);
}

function buildHeroSnapshot(report) {
  const logged = countLoggedDays(report);
  const metrics = [
  { key: 'sleep', label: 'Sleep', icon: 'moon-outline', accent: WR_STAT_BAR.sleep },
  { key: 'water', label: 'Water', icon: 'water-outline', accent: WR_STAT_BAR.water },
  { key: 'steps', label: 'Steps', icon: 'footsteps-outline', accent: WR_STAT_BAR.steps },
  { key: 'energy', label: 'Energy', icon: 'flash-outline', accent: WR_STAT_BAR.energy }].

  map((metricItem) => ({ ...metricItem, value: formatHeroMetricValue(metricItem.key, report), pct: metricProgressPct(metricItem.key, report) })).
  filter((metricItem) => metricItem.value);

  const weight = formatHeroMetricValue('weight', report);
  const highlights = buildHeroHighlights(report);
  if (weight) {
    highlights.unshift({ icon: 'scale-outline', text: `Average weight ${weight}` });
  }

  return {
    logged,
    metrics: metrics.slice(0, 4),
    highlights: highlights.slice(0, 3),
    footnote:
    'Generated from logged check-ins (no AI). Keep logging daily for sharper trends next week.'
  };
}

function HeroMetricsList({ items }) {
  const themeColors = useWRTheme();
  if (!items.length) return null;
  const barTrack = themeColors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((metricItem) => {
        const pctNum = typeof metricItem.pct === 'number' ? Math.min(Math.max(metricItem.pct, 0), 1) : 0;
        const pctStr = `${Math.round(pctNum * 100)}%`;
        return (
          <View
            key={metricItem.key}
            style={{
              flex: 1,
              minWidth: '44%',
              backgroundColor: themeColors.badge,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: themeColors.border,
              padding: 14,
              gap: 6
            }}>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <WRMetricIcon metricKey={metricItem.key} size={32} imageSize={18} />
              <Text style={{ color: themeColors.textLabel, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
                {pctStr}
              </Text>
            </View>
            <OutlinedColorText
              fillColor={themeColors.textPrimary}
              fontSize={22}
              fontWeight="900"
              letterSpacing={-0.5}
              numberOfLines={1}>
              
              {metricItem.value}
            </OutlinedColorText>
            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>{metricItem.label}</Text>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: barTrack, overflow: 'hidden', marginTop: 2 }}>
              <View style={{ height: '100%', width: `${Math.round(pctNum * 100)}%`, borderRadius: 2, backgroundColor: metricItem.accent || themeColors.pink }} />
            </View>
          </View>);

      })}
    </View>);

}

function HeroHighlightRow({ icon, text }) {
  const themeColors = useWRTheme();
  return (
    <View style={styles.heroHighlightRow}>
      <WRMetricIcon metricKey={wrIconToMetricKey(icon)} size={28} imageSize={16} />
      <Text style={[styles.heroHighlightText, { color: themeColors.textSecondary }]}>{text}</Text>
    </View>);

}

function formatDisplayDate(iso) {
  const textValue = String(iso || '').trim();
  if (!textValue) return '';
  const parsedDate = new Date(`${textValue}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return textValue;
  return parsedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Split a dayBreakdown line into day name, date, and note body.
 * @param {string} copy
 * @returns {{ day: string, date: string, note: string }}
 */
export function parseDayNote(copy) {
  const textValue = String(copy || '');
  const colonIdx = textValue.indexOf(': ');
  const heading = colonIdx >= 0 ? textValue.slice(0, colonIdx) : textValue;
  const rest = colonIdx >= 0 ? textValue.slice(colonIdx + 2) : '';
  const dateMatch = heading.match(/(.+)\s+\((.+)\)/);
  return {
    day: dateMatch?.[1]?.trim() ?? heading.trim(),
    date: dateMatch?.[2]?.trim() ?? '',
    note: rest || textValue
  };
}

function isRecoveryDay(note) {
  const noteLower = String(note || '').toLowerCase();
  return /\brest\b|recovery|no workout|skipped|rest day|take a rest/i.test(noteLower);
}

function isEmptyCheckIn(note) {
  const noteLower = String(note || '').toLowerCase().trim();
  return !noteLower || noteLower.includes('no check-in');
}

function normalizeMetricChunk(chunk) {
  return String(chunk || '').trim().replace(/[.,;\s]+$/g, '');
}

function humanizeSummaryText(raw) {
  const cleanedText = normalizeMetricChunk(raw);
  if (!cleanedText) return '';
  const sentence = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  if (/[.!?]$/.test(sentence)) return sentence;
  return `${sentence}.`;
}

// Manipulate here: add a regex when a new metric sentence shape shows up in day notes.
const DAY_NOTE_PILL_DEFS = [
  {
    key: 'sleep',
    label: 'Sleep',
    re: /^sleep\s+(\d+(?:\.\d+)?)\s*h$/i,
    fmt: (matchResult) => `${matchResult[1]}h`,
  },
  {
    key: 'water',
    label: 'Water',
    re: /^water\s+(\d+(?:\.\d+)?)\s*oz$/i,
    fmt: (matchResult) => `${String(matchResult[1]).replace(/\.0$/, '')}oz`,
  },
  {
    key: 'steps',
    label: 'Steps',
    re: /^([\d,]+)\s*steps$/i,
    fmt: (matchResult) => formatStepsShort(matchResult[1].replace(/,/g, '')),
  },
  {
    key: 'energy',
    label: 'Energy',
    re: /^energy\s+(\d+(?:\.\d+)?)\/8$/i,
    fmt: (matchResult) => `${matchResult[1]}/8`,
  },
  {
    key: 'mood',
    label: 'Mood',
    re: /^mood\s+(\d+(?:\.\d+)?)\/4$/i,
    fmt: (matchResult) => `${matchResult[1]}/4`,
  },
  {
    key: 'stress',
    label: 'Stress',
    re: /^stress\s+(\d+(?:\.\d+)?)\/8$/i,
    fmt: (matchResult) => `${matchResult[1]}/8`,
  },
  {
    key: 'soreness',
    label: 'Soreness',
    re: /^soreness\s+(\d+(?:\.\d+)?)\/8$/i,
    fmt: (matchResult) => `${matchResult[1]}/8`,
  },
  {
    key: 'weight',
    label: 'Weight',
    re: /^weight\s+(\d+(?:\.\d+)?)\s*lbs?$/i,
    fmt: (matchResult) => `${matchResult[1]} lbs`,
  },
  {
    key: 'lift',
    label: 'Workout rating',
    re: /^workout\s+rating\s+(\d+(?:\.\d+)?)\/10$/i,
    fmt: (matchResult) => `${matchResult[1]}/10`,
  },
  {
    key: 'bodyfat',
    label: 'Body fat',
    re: /^body\s+fat\s+(\d+(?:\.\d+)?)\s*%$/i,
    fmt: (matchResult) => `${matchResult[1]}%`,
  },
];

/**
 * Peel a trailing "Label: rest of sentence" off the day note body.
 * @param {string} text
 * @param {RegExp} pattern
 * @returns {{ value: string|null, remainingText: string }}
 */
function peelTrailingLabeledSection(text, pattern) {
  const matchResult = text.match(pattern);
  if (!matchResult) return { value: null, remainingText: text };
  const value = matchResult[1].trim().replace(/\.$/, '');
  const remainingText = text.slice(0, matchResult.index).trim().replace(/\.\s*$/, '');
  return { value, remainingText };
}

/**
 * Try one sentence chunk against every unused pill definition.
 * @param {string} chunk
 * @param {Set<string>} usedKeys
 * @param {Array} pills
 * @returns {boolean}
 */
function tryMatchPillDefinition(chunk, usedKeys, pills) {
  const normalized = normalizeMetricChunk(chunk);
  if (!normalized || normalized.length <= 2) return false;

  for (let i = 0; i < DAY_NOTE_PILL_DEFS.length; i += 1) {
    const pillDef = DAY_NOTE_PILL_DEFS[i];
    if (usedKeys.has(pillDef.key)) continue;
    const matchResult = normalized.match(pillDef.re);
    if (!matchResult) continue;
    pills.push({ key: pillDef.key, label: pillDef.label, value: pillDef.fmt(matchResult) });
    usedKeys.add(pillDef.key);
    return true;
  }
  return false;
}

/**
 * @param {string} existingFallback
 * @param {string} normalizedChunk
 * @returns {string}
 */
function joinFallbackChunks(existingFallback, normalizedChunk) {
  if (!existingFallback) return normalizedChunk;
  return `${existingFallback}. ${normalizedChunk}`;
}

/**
 * Walk sentence chunks; known metrics become pills, leftovers become fallback text.
 * @param {string[]} chunks
 * @param {Set<string>} usedKeys
 * @param {Array} pills
 * @returns {string|null}
 */
function collectPillsFromChunks(chunks, usedKeys, pills) {
  let fallbackText = null;
  for (let i = 0; i < chunks.length; i += 1) {
    const matched = tryMatchPillDefinition(chunks[i], usedKeys, pills);
    if (matched) continue;
    const normalized = normalizeMetricChunk(chunks[i]);
    if (normalized.length <= 2) continue;
    fallbackText = joinFallbackChunks(fallbackText, normalized);
  }
  return fallbackText;
}

/**
 * Second pass: leftover fallback may still hide a metric sentence.
 * @param {string|null} fallbackText
 * @param {Set<string>} usedKeys
 * @param {Array} pills
 * @returns {string|null}
 */
function reparseFallbackChunks(fallbackText, usedKeys, pills) {
  if (!fallbackText) return null;
  const leftoverPieces = [];
  const chunks = fallbackText.split(/\.\s+/);
  for (let i = 0; i < chunks.length; i += 1) {
    const matched = tryMatchPillDefinition(chunks[i], usedKeys, pills);
    if (matched) continue;
    const normalized = normalizeMetricChunk(chunks[i]);
    if (normalized.length <= 2) continue;
    leftoverPieces.push(normalized);
  }
  if (!leftoverPieces.length) return null;
  return humanizeSummaryText(leftoverPieces.join('. '));
}

/**
 * Split semicolon-separated workout exercise lines.
 * @param {string} rawWorkout
 * @returns {string[]}
 */
function splitWorkoutExerciseLines(rawWorkout) {
  const pieces = rawWorkout.split(';');
  const lines = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const trimmed = pieces[i].trim();
    if (trimmed) lines.push(trimmed);
  }
  return lines;
}

/**
 * Split sentence-like metric chunks on ". ".
 * @param {string} text
 * @returns {string[]}
 */
function splitMetricSentenceChunks(text) {
  const pieces = text.split(/\.\s+/);
  const chunks = [];
  for (let i = 0; i < pieces.length; i += 1) {
    const trimmed = pieces[i].trim();
    if (trimmed) chunks.push(trimmed);
  }
  return chunks;
}

/**
 * Split Firestore day line body into metrics, workout lines, and personal note.
 * @param {string} note
 * @returns {{ pills: Array, workoutExercises: Array, personalNote: string|null, fallback: string|null }}
 */
export function parseStructuredDayNote(note) {
  let text = String(note || '').trim().replace(/\s+/g, ' ');
  const result = {
    pills: [],
    workoutExercises: [],
    personalNote: null,
    fallback: null,
  };

  if (!text || isEmptyCheckIn(text)) return result;

  // 1. Peel trailing Note: / Workout: sections (order matters — note is last).
  const notePeel = peelTrailingLabeledSection(text, /\bNote:\s*(.+)$/i);
  result.personalNote = notePeel.value;
  text = notePeel.remainingText;

  const workoutPeel = peelTrailingLabeledSection(text, /\bWorkout:\s*(.+)$/i);
  if (workoutPeel.value) {
    result.workoutExercises = splitWorkoutExerciseLines(workoutPeel.value.replace(/\.\s*$/, ''));
  }
  text = workoutPeel.remainingText;

  // 2. Remaining sentences → metric pills + fallback prose.
  const chunks = splitMetricSentenceChunks(text);
  const usedKeys = new Set();
  const fallbackText = collectPillsFromChunks(chunks, usedKeys, result.pills);

  // 3. Re-scan fallback in case a metric was glued to prose.
  result.fallback = reparseFallbackChunks(fallbackText, usedKeys, result.pills);

  return result;
}

function parseExerciseLine(line) {
  const matchResult = String(line || '').match(/^(.+?)\s*\((\d+)\s*sets?:\s*(.+)\)\s*$/i);
  if (matchResult) {
    return {
      name: matchResult[1].trim(),
      setsCount: matchResult[2],
      setsDetail: matchResult[3].trim()
    };
  }
  return { name: String(line || '').trim(), setsCount: null, setsDetail: null };
}

function DayStatusChip({ recovery }) {
  const themeColors = useWRTheme();
  const label = recovery ? 'Recovery' : 'Training';
  const gradient = recovery ? HOME_STAT_WATER_GRADIENT : HOME_STAT_MOOD_GRADIENT;
  return (
    <LinearGradient
      colors={gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ padding: 1, borderRadius: 999 }}>
      
      <View
        style={{
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: themeColors.card
        }}>
        
        <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: themeColors.textSecondary }}>
          {label}
        </Text>
      </View>
    </LinearGradient>);

}

function DayMetricsList({ pills }) {
  const themeColors = useWRTheme();
  if (!pills.length) return null;
  return (
    <View style={[styles.dayMetricsCard, { backgroundColor: themeColors.badge, borderColor: themeColors.border }]}>
      {pills.map((metricItem, i) =>
      <View key={metricItem.key}>
          {i > 0 ? <View style={[styles.dayMetricDivider, { backgroundColor: themeColors.border }]} /> : null}
          <View style={styles.dayMetricRow}>
            <WRMetricIcon metricKey={pillKeyToMetricKey(metricItem.key)} size={32} imageSize={16} />
            <Text style={[styles.dayMetricLabel, { color: themeColors.textSecondary }]}>{metricItem.label}</Text>
            <OutlinedColorText
            fillColor={themeColors.textPrimary}
            fontSize={15}
            fontWeight="800"
            letterSpacing={-0.2}
            numberOfLines={1}
            textAnchor="end"
            style={styles.dayMetricValue}>
            
              {metricItem.value}
            </OutlinedColorText>
          </View>
        </View>
      )}
    </View>);

}

function DayPreviewStrip({ pills }) {
  const themeColors = useWRTheme();
  const preview = pills.slice(0, 3);
  if (!preview.length) return null;
  return (
    <View style={[styles.dayPreviewRow, { borderTopColor: themeColors.border }]}>
      {preview.map((metricItem, i) =>
      <View key={metricItem.key} style={styles.dayPreviewChip}>
          <WRMetricIcon metricKey={pillKeyToMetricKey(metricItem.key)} size={24} imageSize={12} />
          <Text style={[styles.dayPreviewValue, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {metricItem.value}
          </Text>
        </View>
      )}
    </View>);

}
function DaySubsection({ label, children }) {
  const themeColors = useWRTheme();
  return (
    <View style={styles.daySubsection}>
      <Text style={[styles.daySubsectionLabel, { color: themeColors.textLabel }]}>{label}</Text>
      {children}
    </View>);

}

function DayDetailBody({ note, recovery }) {
  const themeColors = useWRTheme();
  const detail = useMemo(() => parseStructuredDayNote(note), [note]);

  if (recovery && detail.pills.length === 0 && !detail.personalNote && !detail.fallback) {
    return <Text style={[styles.bodySecondary, { color: themeColors.textSecondary }]}>Rest / recovery day logged.</Text>;
  }

  const pills =
  detail.pills.length > 0 ?
  detail.pills :
  recovery ?
  [{ key: 'training', label: 'Training', value: 'Rest' }] :
  [];

  return (
    <View style={styles.dayDetailStack}>
      {pills.length > 0 ? <DayMetricsList pills={pills} /> : null}

      {detail.workoutExercises.length > 0 ?
      <DaySubsection label="Workout">
          <View style={[styles.workoutListCard, { borderColor: themeColors.border, backgroundColor: themeColors.badge }]}>
            {detail.workoutExercises.map((line, i) => {
            const ex = parseExerciseLine(line);
            return (
              <View
                key={`ex-${i}`}
                style={[
                styles.exerciseRow,
                i < detail.workoutExercises.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border }]
                }>
                
                  <LinearGradient
                  colors={HOME_STAT_WORKOUT_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0, y: 1 }}
                  style={styles.exerciseAccentBar} />
                
                  <View style={styles.exerciseTextCol}>
                    <Text style={[styles.exerciseName, { color: themeColors.textPrimary }]}>{ex.name}</Text>
                    {ex.setsDetail ?
                  <Text style={[styles.exerciseSets, { color: themeColors.textSecondary }]}>
                        {ex.setsCount ? `${ex.setsCount} sets · ` : ''}
                        {ex.setsDetail}
                      </Text> :
                  null}
                  </View>
                </View>);

          })}
          </View>
        </DaySubsection> :
      null}

      {detail.personalNote ?
      <DaySubsection label="Notes">
          <View style={[styles.dayNoteBlock, { borderLeftColor: HOME_STAT_WATER_GRADIENT[0], backgroundColor: themeColors.badge }]}>
            <Text style={[styles.dayNoteText, { color: themeColors.textPrimary }]}>{detail.personalNote}</Text>
          </View>
        </DaySubsection> :
      null}

      {detail.fallback ?
      <DaySubsection label="Summary">
          <Text style={[styles.daySummaryText, { color: themeColors.textPrimary }]}>{detail.fallback}</Text>
        </DaySubsection> :
      null}
    </View>);

}

function uniqueStrings(arr) {
  const seen = new Set();
  const out = [];
  for (const raw of arr) {
    const textValue = String(raw || '').trim();
    if (!textValue) continue;
    const key = textValue.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(textValue);
  }
  return out;
}

function buildTrendCards(trends) {
  const pool = [...trends];
  const take = (re) => {
    const idx = pool.findIndex((trendItem) => re.test(String(trendItem).toLowerCase()));
    if (idx < 0) return '';
    return pool.splice(idx, 1)[0];
  };

  return [
  { title: 'Sleep rhythm', text: take(/sleep|hour|\bh\b|bed|rest/) || pool.shift() || '' },
  { title: 'Hydration', text: take(/water|hydration|oz|drink/) || pool.shift() || '' },
  { title: 'Movement', text: take(/step|walk|movement|active/) || pool.shift() || '' },
  { title: 'Coaching signal', text: take(/coach|signal|pattern|consistency|volume|training/) || pool.shift() || '' }].
  filter((cParam) => cParam.text);
}

function SectionDivider({ colors: gradientColors }) {
  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.sectionDivider} />);


}

function CapsLabel({ children, style }) {
  const themeColors = useWRTheme();
  return <Text style={[styles.capsLabel, { color: themeColors.textLabel }, style]}>{children}</Text>;
}

function SectionBlock({ capsLabel, title, dividerColors, children, style }) {
  const themeColors = useWRTheme();
  return (
    <View style={[styles.sectionBlock, style]}>
      {dividerColors ? <SectionDivider colors={dividerColors} /> : null}
      <CapsLabel>{capsLabel}</CapsLabel>
      {title ? <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>{title}</Text> : null}
      {children}
    </View>);

}

function ReportCard({ children, style, padding }) {
  const themeColors = useWRTheme();
  return (
    <View
      style={[
      styles.reportCard,
      { backgroundColor: themeColors.card, borderColor: themeColors.border },
      padding != null ? { padding } : null,
      style]
      }>
      
      {children}
    </View>);

}

function GradientReportCard({ children, style, padding }) {
  const themeColors = useWRTheme();
  return (
    <LinearGradient
      colors={themeColors.brandGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.gradientReportBorder, style]}>
      
      <View
        style={[
        styles.gradientReportInner,
        { backgroundColor: themeColors.card, borderColor: themeColors.border },
        padding != null ? { padding } : null]
        }>
        
        {children}
      </View>
    </LinearGradient>);

}

function StatHeroCard({ label, value, accent, progress }) {
  const themeColors = useWRTheme();
  const hasValue = value !== '—';
  const fillPct = hasValue ? Math.round(Math.min(Math.max(progress, 0), 1) * 100) : 0;
  return (
    <ReportCard style={styles.statTile} padding={SPACE.cardPad}>
      <Text style={[styles.statLabel, { color: themeColors.metricLabel }]}>{label}</Text>
      <OutlinedColorText
        fillColor={hasValue ? themeColors.textPrimary : themeColors.textLabel}
        fontSize={44}
        fontWeight="900"
        letterSpacing={-1.2}
        strokeWidth={2.5}
        enabled={hasValue}
        style={styles.statValue}>
        
        {value}
      </OutlinedColorText>
      <View style={[styles.statBarTrack, { backgroundColor: themeColors.barTrack }]}>
        <View style={[styles.statBarFill, { width: `${fillPct}%`, backgroundColor: accent }]} />
      </View>
    </ReportCard>);

}

function WeeklyReportHero({ report, clientName = '' }) {
  const themeColors = useWRTheme();
  const dates = useMemo(() => formatDateRange(report), [report]);
  const snapshot = useMemo(() => buildHeroSnapshot(report), [report]);
  const first = firstNameFromReport(report, clientName);
  const headline = first ? `${first}'s week in review` : 'Your week in review';
  const checkInPct =
  snapshot.logged != null ? Math.round(Math.min(Math.max(snapshot.logged / DAYS_IN_WEEK, 0), 1) * 100) : null;

  return (
    <View style={[styles.heroOuter, { borderColor: themeColors.border, marginBottom: SPACE.section }]}>
      <View style={styles.heroClip}>
        <LinearGradient colors={themeColors.heroTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topAccent} />
        <LinearGradient colors={themeColors.heroBg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroInner}>
          <Text style={[styles.heroKicker, { color: themeColors.textLabel }]}>WEEKLY REPORT</Text>
          <Text style={[styles.heroTitle, { color: themeColors.textPrimary }]}>{headline}</Text>
          {dates.full ?
          <View style={[styles.heroDatePill, { backgroundColor: themeColors.badge, borderColor: themeColors.border }]}>
              <Ionicons name="calendar-outline" size={13} color={themeColors.textSecondary} />
              <Text style={[styles.heroDate, { color: themeColors.textSecondary }]}>{dates.full}</Text>
            </View> :
          null}

          {snapshot.logged != null ?
          <View style={styles.heroCheckInBlock}>
              <View style={styles.heroCheckInTop}>
                <Text style={[styles.heroCheckInLabel, { color: themeColors.textLabel }]}>CHECK-INS</Text>
                <Text style={[styles.heroCheckInValue, { color: themeColors.textPrimary }]}>
                  {snapshot.logged}
                  <Text style={[styles.heroCheckInDenom, { color: themeColors.textSecondary }]}>{` / ${DAYS_IN_WEEK} days`}</Text>
                </Text>
              </View>
              <View style={[styles.heroCheckInTrack, { backgroundColor: themeColors.barTrack }]}>
                <LinearGradient
                colors={themeColors.brandGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.heroCheckInFill, { width: `${checkInPct}%` }]} />
              
              </View>
            </View> :
          null}

          {snapshot.metrics.length > 0 ?
          <View style={styles.heroMetricsSection}>
              <Text style={[styles.heroSectionLabel, { color: themeColors.textLabel }]}>WEEK AVERAGES</Text>
              <HeroMetricsList items={snapshot.metrics} />
            </View> :
          null}

          {snapshot.highlights.length > 0 ?
          <View style={styles.heroHighlightsSection}>
              <Text style={[styles.heroSectionLabel, { color: themeColors.textLabel }]}>HIGHLIGHTS</Text>
              <View style={[styles.heroHighlightsCard, { backgroundColor: themeColors.badge, borderColor: themeColors.border }]}>
                {snapshot.highlights.map((hParam, i) =>
              <View key={`${hParam.icon}-${i}`}>
                    {i > 0 ? <View style={[styles.heroHighlightDivider, { backgroundColor: themeColors.border }]} /> : null}
                    <HeroHighlightRow icon={hParam.icon} text={hParam.text} />
                  </View>
              )}
              </View>
            </View> :
          null}

          <Text style={[styles.heroFootnote, { color: themeColors.textLabel }]}>{snapshot.footnote}</Text>
        </LinearGradient>
      </View>
    </View>);

}

function DayCard({ index, dayLine }) {
  const themeColors = useWRTheme();
  const parsed = parseDayNote(dayLine);
  const recovery = isRecoveryDay(parsed.note);
  const empty = isEmptyCheckIn(parsed.note);
  const dayTitle = DAY_LABELS[index] || parsed.day;
  const dateLabel = formatDisplayDate(parsed.date) || parsed.date;
  const detail = useMemo(() => parseStructuredDayNote(parsed.note), [parsed.note]);
  const pills = detail.pills.length > 0 ?
  detail.pills :
  recovery && !empty ?
  [{ key: 'training', label: 'Training', value: 'Rest' }] :
  [];
  const [open, setOpen] = useState(!empty);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((vParam) => !vParam);
  };

  return (
    <View style={[styles.dayCardOuter, { borderColor: themeColors.border }]}>
      <LinearGradient
        colors={themeColors.heroTop}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dayCardAccent} />
      
      <View style={[styles.dayCardInner, { backgroundColor: themeColors.card }]}>
        <Pressable onPress={toggle} accessibilityRole="button">
          <View style={styles.dayHeaderRow}>
            <LinearGradient
              colors={HOME_STAT_MOOD_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dayIndexRing}>
              
              <View style={[styles.dayIndexInner, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.dayIndexText, { color: themeColors.textPrimary }]}>{index + 1}</Text>
              </View>
            </LinearGradient>
            <View style={styles.dayTitleCol}>
              <Text style={[styles.dayTitle, { color: themeColors.textPrimary }]}>{dayTitle}</Text>
              {dateLabel ? <Text style={[styles.dayDate, { color: themeColors.textSecondary }]}>{dateLabel}</Text> : null}
            </View>
            {!empty ? <DayStatusChip recovery={recovery} /> : null}
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={themeColors.textLabel} />
          </View>

          {!open && !empty && pills.length > 0 ? <DayPreviewStrip pills={pills} /> : null}
          {!open && empty ?
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <Ionicons name="moon-outline" size={16} color={themeColors.textLabel} />
              <Text style={[styles.dayEmptyHint, { color: themeColors.textSecondary, marginTop: 0 }]}>
                No check-in logged — tap to add notes when you check in.
              </Text>
            </View> :
          null}

          {open ?
          <View style={styles.dayExpanded}>
              {empty ?
            <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
                  <Ionicons name="calendar-outline" size={28} color={themeColors.textLabel} />
                  <Text style={[styles.bodySecondary, { color: themeColors.textSecondary, textAlign: 'center' }]}>
                    No check-in for this day yet.
                  </Text>
                </View> :

            <DayDetailBody note={parsed.note} recovery={recovery} />
            }
            </View> :
          null}
        </Pressable>
      </View>
    </View>);

}

function WinsCard({ items }) {
  const themeColors = useWRTheme();
  const list = items.length ? items : ['No wins logged for this week yet.'];
  return (
    <ReportCard style={{ marginBottom: SPACE.cardGap }} padding={SPACE.cardPad}>
      <CapsLabel style={styles.cardEyebrow}>WHAT WENT WELL</CapsLabel>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="trophy-outline" size={20} color={themeColors.cyan} />
        <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>Wins</Text>
      </View>
      <View style={styles.listGap}>
        {list.map((item, i) =>
        <View key={`w-${i}`} style={styles.winRow}>
            <Ionicons name="checkmark-circle" size={20} color={themeColors.cyan} />
            <Text style={[styles.bodyPrimary, { color: themeColors.textPrimary }]}>{item}</Text>
          </View>
        )}
      </View>
    </ReportCard>);

}

function FocusCard({ items }) {
  const themeColors = useWRTheme();
  const list = items.length ? items : [{ title: 'No coaching priorities for this week.', desc: '' }];
  return (
    <GradientReportCard padding={SPACE.cardPad}>
      <CapsLabel style={styles.cardEyebrow}>COACHING PRIORITIES</CapsLabel>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="bulb-outline" size={20} color="#C2410C" />
        <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>Focus This Week</Text>
      </View>
      <View style={styles.listGap}>
        {list.map((item, i) => {
          const title = typeof item === 'string' ? item : item.title;
          const desc = typeof item === 'string' ? '' : item.desc;
          return (
            <View key={`p-${i}`} style={styles.focusRow}>
              <View style={[styles.focusBadge, { backgroundColor: themeColors.focusBadgeBg }]}>
                <Text style={[styles.focusBadgeText, { color: themeColors.textPrimary }]}>{i + 1}</Text>
              </View>
              <View style={styles.focusTextCol}>
                <Text style={[styles.bodyPrimary, { color: themeColors.textPrimary }]}>{title}</Text>
                {desc ? <Text style={[styles.bodySecondary, { color: themeColors.textSecondary }]}>{desc}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textLabel} />
            </View>);

        })}
      </View>
    </GradientReportCard>);

}

/**
 * Legacy dashboard card shell with theme provider.
 * @param {{ children: *, style?: object, padding?: number, isDark?: boolean }} props
 */
export function WRPremiumCard({ children, style, padding = SPACE.cardPad, isDark = true }) {
  const theme = getWRTheme(isDark);
  return (
    <WRlightDarkMode.Provider value={theme}>
      <ReportCard style={style} padding={padding}>
        {children}
      </ReportCard>
    </WRlightDarkMode.Provider>);

}
export const WRGlassCard = WRPremiumCard;
/**
 * Gradient hero chrome used by external report screens.
 * @param {{ children: *, style?: object }} props
 */
export function WRHeroShell({ children, style }) {
  const themeColors = useWRTheme();
  return (
    <View style={[styles.heroOuter, { borderColor: themeColors.border, marginBottom: SPACE.section }, style]}>
      <View style={styles.heroClip}>
        <LinearGradient colors={themeColors.heroTop} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topAccent} />
        <LinearGradient colors={themeColors.heroBg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.heroInner}>
          {children}
        </LinearGradient>
      </View>
    </View>);

}

// ===== MAIN FUNCTION =====

/**
 * Full scrollable weekly report body (hero, stats, days, wins, focus).
 * @param {{ report: object, isDark?: boolean, clientName?: string }} props
 */
export function WeeklyReportScrollBody({ report, isDark = true, clientName = '' }) {
  const theme = useMemo(() => getWRTheme(isDark), [isDark]);
  const metricTiles = useMemo(() => buildMetricTiles(report), [report]);
  const trendCards = useMemo(
    () => buildTrendCards(Array.isArray(report?.trends) ? report.trends.map(textForReport) : []),
    [report?.trends]
  );
  const wins = useMemo(
    () => uniqueStrings(Array.isArray(report?.wins) ? report.wins.map(textForReport) : []),
    [report?.wins]
  );
  const priorities = useMemo(
    () => uniqueStrings(Array.isArray(report?.cons) ? report.cons.map(textForReport) : []),
    [report?.cons]
  );
  const nextWeek = useMemo(
    () => uniqueStrings(Array.isArray(report?.focus) ? report.focus.map(textForReport) : []),
    [report?.focus]
  );
  const days = useMemo(() => {
    const raw = Array.isArray(report?.dayBreakdown) ? report.dayBreakdown.map(textForReport) : [];
    return Array.from({ length: DAYS_IN_WEEK }, (_Param, i) => {
      if (raw[i]) return raw[i];
      const label = DAY_LABELS[i] || `Day ${i + 1}`;
      return `${label} (): No check-in for this day.`;
    });
  }, [report?.dayBreakdown]);

  if (!report) {
    return (
      <WRlightDarkMode.Provider value={theme}>
        <View style={styles.emptyWrap}>
          <Text style={[styles.bodySecondary, { color: theme.textSecondary }]}>No report data.</Text>
        </View>
      </WRlightDarkMode.Provider>);

  }

  return (
    <WRlightDarkMode.Provider value={theme}>
      <View style={styles.scrollBody}>
        <View style={{ paddingHorizontal: SPACE.screen }}>
          <WeeklyReportHero report={report} clientName={clientName} />
        </View>

      <SectionBlock capsLabel="THIS WEEK AT A GLANCE">
        <View style={styles.statGrid}>
          {metricTiles.map((metricItem) =>
            <StatHeroCard
              key={metricItem.key}
              label={metricItem.label}
              value={metricItem.value}
              accent={metricItem.accent}
              progress={metricItem.progress} />

            )}
        </View>
      </SectionBlock>

      <SectionBlock capsLabel="DAILY BREAKDOWN" dividerColors={theme.grad.pinkOrange}>
        <View style={styles.dayList}>
          {days.map((line, i) =>
            <DayCard key={`day-${i}`} index={i} dayLine={line} />
            )}
        </View>
      </SectionBlock>

      {trendCards.length > 0 ?
        <SectionBlock capsLabel="INSIGHTS" title="Weekly trends" dividerColors={theme.grad.purplePink}>
          <View style={styles.statGrid}>
            {trendCards.map((trendItem) =>
            <ReportCard key={trendItem.title} style={styles.insightTile} padding={SPACE.cardPad}>
                <Text style={[styles.insightTitle, { color: theme.textPrimary }]}>{trendItem.title}</Text>
                <Text style={[styles.bodySecondary, { color: theme.textSecondary }]}>{trendItem.text}</Text>
              </ReportCard>
            )}
          </View>
        </SectionBlock> :
        null}

      <SectionBlock capsLabel="PERFORMANCE" title="Summary" dividerColors={theme.grad.orangePink}>
        <WinsCard items={wins} />
        <FocusCard items={priorities} />
      </SectionBlock>

      {nextWeek.length > 0 ?
        <SectionBlock capsLabel="NEXT WEEK" title="Your focus">
          <ReportCard padding={SPACE.cardPad}>
            {nextWeek.slice(0, 4).map((item, i) =>
            <View key={`n-${i}`} style={[styles.nextRow, i > 0 && { marginTop: SPACE.listGap }]}>
                <View style={[styles.nextDot, { backgroundColor: theme.badge }]}>
                  <Text style={[styles.nextDotText, { color: theme.textPrimary }]}>{i + 1}</Text>
                </View>
                <Text style={[styles.bodyPrimary, { color: theme.textPrimary }]}>{item}</Text>
              </View>
            )}
          </ReportCard>
        </SectionBlock> :
        null}

      {report.signOff ?
        <SectionBlock capsLabel="COACH" title="Sign-off" style={{ marginBottom: 24 }}>
          <ReportCard padding={SPACE.cardPad}>
            <Text style={[styles.bodySecondary, { color: theme.textSecondary }]}>
              {textForReport(report.signOff)}
            </Text>
          </ReportCard>
        </SectionBlock> :
        null}
      </View>
    </WRlightDarkMode.Provider>);

}

function WeeklyReportCard({ report, metricTiles, onOpen, isDark = true }) {
  const theme = getWRTheme(isDark);
  const dates = useMemo(() => formatDateRange(report), [report]);

  return (
    <WRlightDarkMode.Provider value={theme}>
      <View style={{ marginHorizontal: SPACE.screen }}>
        <ReportCard style={{ marginBottom: 12 }} padding={SPACE.cardPad}>
          <View style={styles.previewHeader}>
            <Text style={[styles.capsLabel, { color: theme.textLabel }]}>{dates.compact}</Text>
            <View style={[styles.readyBadge, { backgroundColor: theme.badge }]}>
              <Text style={[styles.readyBadgeText, { color: theme.textSecondary }]}>Ready</Text>
            </View>
          </View>
          <View style={styles.statGrid}>
            {metricTiles.map((metricItem) =>
            <View key={metricItem.key} style={[styles.statTile, { padding: 14, backgroundColor: theme.badge, borderColor: theme.border, borderWidth: 1, borderRadius: 16 }]}>
                <Text style={[styles.statLabel, { color: theme.metricLabel }]}>{metricItem.label}</Text>
                <Text style={[styles.statValue, { fontSize: 28, color: metricItem.value === '—' ? theme.textLabel : theme.textPrimary }]}>
                  {metricItem.value}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.bodySecondary, { marginTop: 12, color: theme.textSecondary }]} numberOfLines={3}>
            {report.summary || 'Open for daily breakdown, trends, and coaching notes.'}
          </Text>
          <TouchableOpacity activeOpacity={0.88} onPress={onOpen} style={{ marginTop: 14 }}>
            <LinearGradient colors={theme.cta} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.openButton}>
              <Text style={styles.openButtonText}>Open report</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ReportCard>
      </View>
    </WRlightDarkMode.Provider>);

}

/**
 * Full-screen modal wrapping WeeklyReportScrollBody.
 * @param {{ report: object, visible: boolean, onClose: Function, isDark?: boolean, clientName?: string }} props
 */
export function WeeklyReportDetailModal({ report, visible, onClose, isDark = true, clientName = '' }) {
  const theme = getWRTheme(isDark);
  const scrollBottomPad = useModalScrollBottomPad(MODAL_SCROLL_BOTTOM_PAD);
  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={[styles.modalContent, { backgroundColor: theme.bg }]}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={SHELL_SAFE_AREA_EDGES}>
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: theme.badge, borderColor: theme.border }]}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            
            <Text style={[styles.closeButtonText, { color: theme.textSecondary }]}>×</Text>
          </TouchableOpacity>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
            {...FORM_SCROLL_PROPS}>
            
            <WeeklyReportScrollBody report={report} isDark={isDark} clientName={clientName} />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>);

}

export default function WeeklyReportBars({ weeklySummary, loading, showMarketingHeader, isDark = true }) {
  const [modalVisible, setModalVisible] = useState(false);
  const metricTiles = useMemo(() => buildMetricTiles(weeklySummary), [weeklySummary]);

  const theme = getWRTheme(isDark);

  if (loading) {
    return (
      <WRlightDarkMode.Provider value={theme}>
        <View style={{ width: '100%' }}>
          {showMarketingHeader ?
          <Text style={[styles.capsLabel, { marginHorizontal: SPACE.screen, marginBottom: 8, color: theme.textLabel }]}>
              Weekly report
            </Text> :
          null}
          <ReportCard style={{ marginHorizontal: SPACE.screen }} padding={SPACE.cardPad}>
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <ActivityIndicator color={theme.cyan} size="large" />
              <Text style={{ color: theme.textLabel, marginTop: 12, fontSize: 13 }}>Loading weekly report…</Text>
            </View>
          </ReportCard>
        </View>
      </WRlightDarkMode.Provider>);

  }

  if (!weeklySummary) return null;

  return (
    <View style={{ width: '100%' }}>
      <WeeklyReportCard report={weeklySummary} metricTiles={metricTiles} onOpen={() => setModalVisible(true)} isDark={isDark} />
      <WeeklyReportDetailModal
        report={weeklySummary}
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        isDark={isDark} />
      
    </View>);

}

const styles = StyleSheet.create({
  scrollBody: {
    paddingTop: 8,
    paddingBottom: 32
  },
  scrollPad: { paddingHorizontal: SPACE.screen },
  scrollContent: { paddingTop: 56 },
  modalContent: { flex: 1 },
  emptyWrap: { paddingVertical: 32, paddingHorizontal: SPACE.screen },
  sectionBlock: {
    marginBottom: SPACE.section,
    paddingHorizontal: SPACE.screen
  },
  sectionDivider: {
    height: 4,
    width: '100%',
    borderRadius: 2,
    marginBottom: 12
  },
  capsLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 16
  },
  reportCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: SPACE.cardPad,
    overflow: 'hidden'
  },
  gradientReportBorder: {
    borderRadius: 24,
    padding: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' && {
      shadowColor: '#9333EA',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 12
    }),
    elevation: 4
  },
  gradientReportInner: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden'
  },
  heroOuter: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden'
  },
  heroClip: { borderRadius: 24, overflow: 'hidden' },
  heroInner: { padding: 22 },
  heroKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 32
  },
  heroDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1
  },
  heroDate: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18
  },
  heroCheckInBlock: {
    marginTop: 18,
    gap: 8
  },
  heroCheckInTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between'
  },
  heroCheckInLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2
  },
  heroCheckInValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4
  },
  heroCheckInDenom: {
    fontSize: 14,
    fontWeight: '600'
  },
  heroCheckInTrack: {
    height: 6,
    borderRadius: 99,
    overflow: 'hidden'
  },
  heroCheckInFill: {
    height: '100%',
    borderRadius: 99,
    minWidth: 6
  },
  heroMetricsSection: {
    marginTop: 22,
    gap: 10
  },
  heroSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2
  },
  heroMetricsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden'
  },
  heroMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12
  },
  heroMetricDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 52
  },
  heroMetricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroMetricLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1
  },
  heroMetricValue: {
    minWidth: 72,
    maxWidth: '42%'
  },
  heroHighlightsSection: {
    marginTop: 18,
    gap: 10
  },
  heroHighlightsCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4
  },
  heroHighlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10
  },
  heroHighlightIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1
  },
  heroHighlightText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20
  },
  heroHighlightDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 38
  },
  heroFootnote: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
    letterSpacing: 0.1
  },
  topAccent: { height: 3, width: '100%' },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACE.cardGap
  },
  statTile: {
    width: '47%',
    flexGrow: 1,
    minWidth: 150,
    marginBottom: 0
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8
  },
  statValue: {
    marginVertical: 4,
    minHeight: 52,
    justifyContent: 'center'
  },
  statBarTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 14,
    width: '100%',
    overflow: 'hidden'
  },
  statBarFill: {
    height: 4,
    borderRadius: 2
  },
  dayList: {
    gap: SPACE.listGap
  },
  dayCardOuter: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 0
  },
  dayCardAccent: {
    height: 2,
    width: '100%'
  },
  dayCardInner: {
    padding: SPACE.cardPad
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  dayIndexRing: {
    width: 38,
    height: 38,
    borderRadius: 12,
    padding: 1.5
  },
  dayIndexInner: {
    flex: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  dayIndexText: {
    fontSize: 15,
    fontWeight: '800'
  },
  dayTitleCol: { flex: 1, minWidth: 0 },
  dayTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2
  },
  dayDate: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2
  },
  dayPreviewRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  dayPreviewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4
  },
  dayPreviewValue: {
    fontSize: 13,
    fontWeight: '700'
  },
  dayEmptyHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600'
  },
  dayExpanded: { marginTop: 16 },
  dayDetailStack: { gap: 18 },
  dayMetricsCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden'
  },
  dayMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10
  },
  dayMetricDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 54
  },
  dayMetricLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600'
  },
  dayMetricValue: {
    minWidth: 64,
    maxWidth: '38%'
  },
  daySubsection: { gap: 8 },
  daySubsectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1
  },
  workoutListCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden'
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 12,
    paddingRight: 12
  },
  exerciseAccentBar: {
    width: 3,
    borderRadius: 2,
    marginLeft: 12,
    marginRight: 12,
    alignSelf: 'stretch'
  },
  exerciseTextCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  exerciseName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20
  },
  exerciseSets: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18
  },
  dayNoteBlock: {
    borderLeftWidth: 3,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  dayNoteText: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22
  },
  daySummaryText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22
  },
  bodyPrimary: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22
  },
  bodySecondary: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21
  },
  insightTile: { width: '47%', flexGrow: 1, minWidth: 150 },
  insightTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8
  },
  cardEyebrow: { marginBottom: 8 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16
  },
  cardHeaderTitle: {
    fontSize: 20,
    fontWeight: '800'
  },
  listGap: { gap: 8 },
  winRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  focusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  focusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  focusBadgeText: {
    fontSize: 14,
    fontWeight: '700'
  },
  focusTextCol: { flex: 1, minWidth: 0, gap: 4 },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  nextDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: WR_COLORS.badge,
    alignItems: 'center',
    justifyContent: 'center'
  },
  nextDotText: {
    fontSize: 13,
    fontWeight: '700',
    color: WR_COLORS.textPrimary
  },
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
    borderColor: WR_COLORS.border
  },
  closeButtonText: {
    fontSize: 28,
    color: WR_COLORS.textSecondary,
    fontWeight: '300',
    lineHeight: 30
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12
  },
  readyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)'
  },
  readyBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: WR_COLORS.textSecondary
  },
  openButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  openButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' }
});