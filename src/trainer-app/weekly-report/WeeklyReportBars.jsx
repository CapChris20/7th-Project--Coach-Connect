// Premium weekly-report UI: theme tokens, day-note parsers, hero, scroll body, preview + modal.
// Flow: parse report text → build metric tiles / day cards → scroll body or full-screen modal.
// Used by: WeeklyReportScreen, TrainerWeeklyReportSection, WeeklyReportBanner, StatIcon.
//
// vocab: NbCard / NbButton = neobrutalist shells (thick outline, hard shadow); parsers stay logic-only.
// vocab: createContext / useContext = theme hand-off so nested day cards share light/dark colors.
// vocab: LayoutAnimation = native expand/collapse animation when a day card opens.

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
import { lightColors, darkColors, gradients, nb, borderRadius } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';

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

/** Brand gradient stops — primary CTA / one gradient moment per screen. */
export const WR_BRAND_GRADIENT = gradients.brand.colors;

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

/**
 * Read one field from a report object, or undefined when report is missing.
 * @param {object|null|undefined} report
 * @param {string} fieldName
 * @returns {*}
 */
function fieldFromReport(report, fieldName) {
  if (report == null) return undefined;
  return report[fieldName];
}

/**
 * Map each entry in a list through a formatter (for-loop — no .map in recipes).
 * @param {Array} list
 * @param {Function} formatOne
 * @returns {Array}
 */
function formatEachEntry(list, formatOne) {
  const formatted = [];
  for (let index = 0; index < list.length; index += 1) {
    formatted.push(formatOne(list[index]));
  }
  return formatted;
}

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
          backgroundColor: themeColors.isDark ? 'rgba(12,10,20,0.98)' : lightColors.white,
          alignItems: 'center',
          justifyContent: 'center'
        }}>
        
        <Image source={visual.source} style={{ width: imageSize, height: imageSize }} resizeMode="contain" />
      </View>
    </LinearGradient>);

}

/** Legacy export — prefer getWRTheme(isDark). */
export const WR_COLORS = {
  bg: lightColors.nbInk,
  card: '#1A1A2E',
  badge: '#1C1C2E',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: lightColors.white,
  textSecondary: 'rgba(255,255,255,0.60)',
  textLabel: 'rgba(255,255,255,0.45)',
  metricLabel: 'rgba(255,255,255,0.50)',
  pink: lightColors.primary,
  cyan: '#06B6D4',
  purple: '#F97316',
  orange: '#F97316'
};

/**
 * Light/dark color tokens for every weekly-report surface in this file.
 * @param {boolean} [isDark=true]
 * @returns {object}
 */
export function getWRTheme(isDark = true) {
  // Map weekly-report surfaces onto shared nb tokens so light/dark stay in sync with DESIGN.md.
  const palette = isDark ? darkColors : lightColors;
  if (isDark) {
    return {
      isDark: true,
      bg: palette.nbBackground,
      card: palette.nbSurface,
      badge: palette.nbSurfaceChip,
      border: palette.nbBorder,
      textPrimary: palette.nbInk,
      textSecondary: palette.nbMuted,
      textLabel: palette.nbMuted,
      metricLabel: palette.nbMuted,
      barTrack: 'rgba(243,238,255,0.12)',
      coachNoteBg: palette.nbSurfaceChip,
      coachNoteBorder: palette.nbBorder,
      tagWorkoutBg: palette.nbSurfaceChip,
      tagRecoveryBg: palette.nbSurfaceChip,
      pink: lightColors.primary,
      cyan: '#06B6D4',
      purple: '#F97316',
      orange: '#F97316',
      statBar: WR_STAT_BAR,
      brandGradient: WR_BRAND_GRADIENT,
      grad: {
        pinkOrange: WR_BRAND_GRADIENT,
        purplePink: WR_BRAND_GRADIENT,
        orangePink: WR_BRAND_GRADIENT
      },
      heroTop: WR_BRAND_GRADIENT,
      heroBg: [palette.nbSurface, palette.nbBackground],
      cta: WR_BRAND_GRADIENT,
      weekBarBg: palette.nbSurfaceChip,
      weekPillBg: palette.nbSurfaceChip,
      focusBadgeBg: palette.nbSurfaceChip,
      exerciseDot: '#C2410C'
    };
  }
  return {
    isDark: false,
    bg: palette.nbBackground,
    card: palette.nbSurface,
    badge: palette.nbSurfaceChip,
    border: palette.nbBorder,
    textPrimary: palette.nbInk,
    textSecondary: palette.nbMuted,
    textLabel: palette.nbMuted,
    metricLabel: palette.nbMuted,
    barTrack: 'rgba(10,10,15,0.08)',
    coachNoteBg: palette.nbSurfaceChip,
    coachNoteBorder: palette.nbBorder,
    tagWorkoutBg: palette.nbSurfaceChip,
    tagRecoveryBg: palette.nbSurfaceChip,
    pink: '#DB2777',
    cyan: '#0891B2',
    purple: '#FB923C',
    orange: '#EA580C',
    statBar: WR_STAT_BAR,
    brandGradient: WR_BRAND_GRADIENT,
    grad: {
      pinkOrange: WR_BRAND_GRADIENT,
      purplePink: WR_BRAND_GRADIENT,
      orangePink: WR_BRAND_GRADIENT
    },
    heroTop: WR_BRAND_GRADIENT,
    heroBg: [palette.nbSurface, palette.nbBackground],
    cta: WR_BRAND_GRADIENT,
    weekBarBg: palette.nbSurfaceChip,
    weekPillBg: palette.nbSurfaceChip,
    focusBadgeBg: palette.nbSurfaceChip,
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
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value !== 'object') {
    return String(value);
  }

  // Prefer known string fields from AI-free summary blobs before JSON fallback.
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

function formatStepsShort(rawSteps) {
  if (rawSteps == null || rawSteps === '' || rawSteps === 'N/A') {
    return null;
  }

  let parsedNumber = parseFloat(String(rawSteps).replace(/,/g, ''));
  if (typeof rawSteps === 'number') {
    parsedNumber = rawSteps;
  }
  if (!Number.isFinite(parsedNumber)) {
    return String(rawSteps);
  }
  if (parsedNumber >= STEPS_SHORT_THRESHOLD) {
    const thousandsLabel = (parsedNumber / STEPS_SHORT_THRESHOLD).toFixed(1).replace(/\.0$/, '');
    return `${thousandsLabel}k`;
  }
  return String(Math.round(parsedNumber));
}

function parseReportMetricNumber(rawValue) {
  let rawText = '';
  if (rawValue != null) {
    rawText = String(rawValue);
  }
  const parsedNumber = parseFloat(rawText.replace(/,/g, ''));
  if (!Number.isFinite(parsedNumber)) {
    return null;
  }
  return parsedNumber;
}

function metricProgressPct(key, report) {
  if (key === 'sleep') {
    const avgSleepHours = parseReportMetricNumber(fieldFromReport(report, 'avgSleep'));
    if (avgSleepHours == null) {
      return 0;
    }
    return Math.min(avgSleepHours / 8, 1);
  }
  if (key === 'water') {
    const avgWaterOunces = parseReportMetricNumber(fieldFromReport(report, 'avgWater'));
    if (avgWaterOunces == null) {
      return 0;
    }
    return Math.min(avgWaterOunces / 64, 1);
  }
  if (key === 'steps') {
    const avgSteps = parseReportMetricNumber(fieldFromReport(report, 'avgSteps'));
    if (avgSteps == null) {
      return 0;
    }
    return Math.min(avgSteps / STEPS_DAILY_GOAL, 1);
  }
  if (key === 'energy') {
    const avgEnergy = parseReportMetricNumber(fieldFromReport(report, 'avgEnergy'));
    if (avgEnergy == null) {
      return 0;
    }
    return Math.min(avgEnergy / 8, 1);
  }
  return 0;
}

/**
 * True when a report average is missing or the literal "N/A" string.
 * @param {unknown} rawValue
 * @returns {boolean}
 */
function reportAverageIsMissing(rawValue) {
  if (rawValue == null) {
    return true;
  }
  if (rawValue === 'N/A') {
    return true;
  }
  return false;
}

/**
 * Sleep cell text like "7.5h", or null when the report has no average.
 * @param {object} report
 * @returns {string|null}
 */
function sleepTileValue(report) {
  if (reportAverageIsMissing(fieldFromReport(report, 'avgSleep'))) {
    return null;
  }
  return `${report.avgSleep}h`;
}

/**
 * Water cell text like "64oz" (strip trailing .0), or null when missing.
 * @param {object} report
 * @returns {string|null}
 */
function waterTileValue(report) {
  if (reportAverageIsMissing(fieldFromReport(report, 'avgWater'))) {
    return null;
  }
  const waterWithoutTrailingDotZero = String(report.avgWater).replace(/\.0$/, '');
  return `${waterWithoutTrailingDotZero}oz`;
}

/**
 * Steps cell text (short form), or null when missing.
 * @param {object} report
 * @returns {string|null}
 */
function stepsTileValue(report) {
  if (reportAverageIsMissing(fieldFromReport(report, 'avgSteps'))) {
    return null;
  }
  return formatStepsShort(report.avgSteps);
}

/**
 * Energy cell text like "6/8", or null when missing.
 * @param {object} report
 * @returns {string|null}
 */
function energyTileValue(report) {
  if (reportAverageIsMissing(fieldFromReport(report, 'avgEnergy'))) {
    return null;
  }
  return `${report.avgEnergy}/8`;
}

/**
 * Shown tile value — em dash when the metric never logged that week.
 * @param {string|null} formattedValue
 * @returns {string}
 */
function tileValueOrEmDash(formattedValue) {
  if (formattedValue == null) {
    return '—';
  }
  return formattedValue;
}

function buildMetricTiles(report) {
  // 1. Format each average into display text (or null when missing).
  const sleepText = sleepTileValue(report);
  const waterText = waterTileValue(report);
  const stepsText = stepsTileValue(report);
  const energyText = energyTileValue(report);

  // 2. Build the four fixed tiles the hero grid always shows.
  const tiles = [
    {
      key: 'sleep',
      label: 'AVG SLEEP',
      value: tileValueOrEmDash(sleepText),
      accent: WR_STAT_BAR.sleep,
    },
    {
      key: 'water',
      label: 'AVG WATER',
      value: tileValueOrEmDash(waterText),
      accent: WR_STAT_BAR.water,
    },
    {
      key: 'steps',
      label: 'AVG STEPS',
      value: tileValueOrEmDash(stepsText),
      accent: WR_STAT_BAR.steps,
    },
    {
      key: 'energy',
      label: 'AVG ENERGY',
      value: tileValueOrEmDash(energyText),
      accent: WR_STAT_BAR.energy,
    },
  ];

  // 3. Attach progress fraction for the ink bars under each tile.
  const tilesWithProgress = [];
  for (let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1) {
    const tile = tiles[tileIndex];
    tilesWithProgress.push({
      ...tile,
      progress: metricProgressPct(tile.key, report),
    });
  }
  return tilesWithProgress;
}

/**
 * Compact and long date labels for the week chip / hero.
 * @param {object} report
 * @returns {{ compact: string, full: string }}
 */
export function formatDateRange(report) {
  const weekStart = fieldFromReport(report, 'weekStart');
  if (!weekStart) {
    return { compact: 'Week', full: '' };
  }

  // Manipulate here: noon local avoids DST flipping the calendar day on the chip.
  const weekStartDate = new Date(`${weekStart}T12:00:00`);
  let weekEndDate = weekStartDate;
  const weekEnd = fieldFromReport(report, 'weekEnd');
  if (weekEnd) {
    weekEndDate = new Date(`${weekEnd}T12:00:00`);
  }

  const startMonthShort = weekStartDate.toLocaleDateString('en-US', { month: 'short' });
  const endMonthShort = weekEndDate.toLocaleDateString('en-US', { month: 'short' });
  const startMonthLong = weekStartDate.toLocaleDateString('en-US', { month: 'long' });
  const endMonthLong = weekEndDate.toLocaleDateString('en-US', { month: 'long' });
  const startDayNumber = weekStartDate.getDate();
  const endDayNumber = weekEndDate.getDate();
  const endYear = weekEndDate.getFullYear();

  // Design Law week picker / trainer subtitle: "Nov 10 to 16" (same month drops second month)
  let compactLabel = `${startMonthShort} ${startDayNumber} to ${endMonthShort} ${endDayNumber}`;
  if (startMonthShort === endMonthShort) {
    compactLabel = `${startMonthShort} ${startDayNumber} to ${endDayNumber}`;
  }

  return {
    compact: compactLabel,
    full: `${startMonthLong} ${startDayNumber} – ${endMonthLong} ${endDayNumber}, ${endYear}`,
  };
}

function findFullNameInReport(report, clientName = '') {
  if (fieldFromReport(report, 'clientDisplayName')) return report.clientDisplayName;
  if (fieldFromReport(report, 'clientName')) return report.clientName;
  if (fieldFromReport(report, 'athleteName')) return report.athleteName;
  if (fieldFromReport(report, 'name')) return report.name;
  if (clientName) return clientName;
  return '';
}

function firstNameFromReport(report, clientName = '') {
  const fullDisplayName = String(findFullNameInReport(report, clientName)).trim();
  const nameParts = fullDisplayName.split(/\s+/).filter(Boolean);
  if (!nameParts.length) {
    return '';
  }
  return nameParts[0];
}

function countLoggedDays(report) {
  const dayBreakdown = fieldFromReport(report, 'dayBreakdown');
  const dayLines = Array.isArray(dayBreakdown) ? dayBreakdown : [];
  if (!dayLines.length) {
    const summaryText = textForReport(fieldFromReport(report, 'summary'));
    const loggedMatch = summaryText.match(/logged\s+(\d+)\s+of\s+7/i);
    if (loggedMatch) {
      return Number(loggedMatch[1]);
    }
    return null;
  }

  let loggedCount = 0;
  for (const dayLine of dayLines) {
    const { note } = parseDayNote(textForReport(dayLine));
    if (isEmptyCheckIn(note)) {
      continue;
    }
    loggedCount += 1;
  }
  return loggedCount;
}

function formatHeroMetricValue(key, report) {
  const avgFieldName = `avg${key.charAt(0).toUpperCase()}${key.slice(1)}`;
  const raw = fieldFromReport(report, avgFieldName);
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
  if (/sleep/i.test(line)) {
    return 'moon-outline';
  }
  if (/water|hydration/i.test(line)) {
    return 'water-outline';
  }
  if (/step|movement|walk/i.test(line)) {
    return 'footsteps-outline';
  }
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
function dayCountLabel(countText, singularLabel, pluralLabel) {
  if (countText === '1') {
    return singularLabel;
  }
  return pluralLabel;
}

/**
 * Fill remaining highlight slots from report.trends when summary was thin.
 * @param {object} report
 * @param {Array} highlights
 */
function appendTrendHighlights(report, highlights) {
  if (highlights.length >= MIN_HIGHLIGHTS_BEFORE_TRENDS) return;
  const trends = fieldFromReport(report, 'trends');
  if (!Array.isArray(trends)) return;

  for (const trendLine of trends) {
    const line = textForReport(trendLine);
    if (!line) continue;
    highlights.push({ icon: iconForTrendLine(line), text: line });
    if (highlights.length >= MAX_HERO_HIGHLIGHTS) break;
  }
}

function buildHeroHighlights(report) {
  const highlights = [];
  const summary = textForReport(fieldFromReport(report, 'summary'));

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
  const metricDefinitions = [
    { key: 'sleep', label: 'Sleep', icon: 'moon-outline', accent: WR_STAT_BAR.sleep },
    { key: 'water', label: 'Water', icon: 'water-outline', accent: WR_STAT_BAR.water },
    { key: 'steps', label: 'Steps', icon: 'footsteps-outline', accent: WR_STAT_BAR.steps },
    { key: 'energy', label: 'Energy', icon: 'flash-outline', accent: WR_STAT_BAR.energy },
  ];

  const metricsWithValues = [];
  for (const metricDefinition of metricDefinitions) {
    const formattedValue = formatHeroMetricValue(metricDefinition.key, report);
    if (!formattedValue) {
      continue;
    }
    metricsWithValues.push({
      ...metricDefinition,
      value: formattedValue,
      pct: metricProgressPct(metricDefinition.key, report),
    });
  }
  const metrics = metricsWithValues;

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

function clampProgressFraction(progressValue) {
  if (typeof progressValue !== 'number') {
    return 0;
  }
  const clampedLow = Math.max(progressValue, 0);
  return Math.min(clampedLow, 1);
}

function HeroMetricsList({ items }) {
  const themeColors = useWRTheme();
  if (!items.length) {
    return null;
  }

  let barTrackColor = 'rgba(0,0,0,0.08)';
  if (themeColors.isDark) {
    barTrackColor = 'rgba(255,255,255,0.08)';
  }

  const metricNodes = [];
  for (let index = 0; index < items.length; index += 1) {
    const metricItem = items[index];
    const progressFraction = clampProgressFraction(metricItem.pct);
    const progressPercentLabel = `${Math.round(progressFraction * 100)}%`;
    const fillWidthPercent = `${Math.round(progressFraction * 100)}%`;
    const fillColor = metricItem.accent || themeColors.pink;

    metricNodes.push(
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
          gap: 6,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 4,
          }}
        >
          <WRMetricIcon metricKey={metricItem.key} size={32} imageSize={18} />
          <Text
            style={{
              color: themeColors.textLabel,
              fontSize: 10,
              fontWeight: '700',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            {progressPercentLabel}
          </Text>
        </View>
        <OutlinedColorText
          fillColor={themeColors.textPrimary}
          fontSize={22}
          fontWeight="900"
          letterSpacing={-0.5}
          numberOfLines={1}
        >
          {metricItem.value}
        </OutlinedColorText>
        <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '600' }}>
          {metricItem.label}
        </Text>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: barTrackColor,
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          <View
            style={{
              height: '100%',
              width: fillWidthPercent,
              borderRadius: 2,
              backgroundColor: fillColor,
            }}
          />
        </View>
      </View>,
    );
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {metricNodes}
    </View>
  );
}

function HeroHighlightRow({ icon, text }) {
  const themeColors = useWRTheme();
  return (
    <View style={styles.heroHighlightRow}>
      <WRMetricIcon metricKey={wrIconToMetricKey(icon)} size={28} imageSize={16} />
      <Text style={[styles.heroHighlightText, { color: themeColors.textSecondary }]}>{text}</Text>
    </View>);

}

function formatDisplayDate(isoDateText) {
  const textValue = String(isoDateText || '').trim();
  if (!textValue) {
    return '';
  }
  const parsedDate = new Date(`${textValue}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return textValue;
  }
  return parsedDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Split a dayBreakdown line into day name, date, and note body.
 * @param {string} copy
 * @returns {{ day: string, date: string, note: string }}
 */
export function parseDayNote(copy) {
  const textValue = String(copy || '');
  const colonIndex = textValue.indexOf(': ');

  let heading = textValue;
  let noteBody = '';
  if (colonIndex >= 0) {
    heading = textValue.slice(0, colonIndex);
    noteBody = textValue.slice(colonIndex + 2);
  }

  const dateMatch = heading.match(/(.+)\s+\((.+)\)/);
  let dayName = heading.trim();
  let dateText = '';
  if (dateMatch) {
    if (dateMatch[1] != null) {
      dayName = dateMatch[1].trim();
    }
    if (dateMatch[2] != null) {
      dateText = dateMatch[2].trim();
    }
  }

  return {
    day: dayName,
    date: dateText,
    note: noteBody || textValue,
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
  const exerciseLines = [];
  for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
    const trimmedLine = pieces[pieceIndex].trim();
    if (!trimmedLine) {
      continue;
    }
    exerciseLines.push(trimmedLine);
  }
  return exerciseLines;
}

/**
 * Split sentence-like metric chunks on ". ".
 * @param {string} text
 * @returns {string[]}
 */
function splitMetricSentenceChunks(text) {
  const pieces = text.split(/\.\s+/);
  const sentenceChunks = [];
  for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
    const trimmedChunk = pieces[pieceIndex].trim();
    if (!trimmedChunk) {
      continue;
    }
    sentenceChunks.push(trimmedChunk);
  }
  return sentenceChunks;
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
  const lineText = String(line || '');
  const matchResult = lineText.match(/^(.+?)\s*\((\d+)\s*sets?:\s*(.+)\)\s*$/i);
  if (!matchResult) {
    return { name: lineText.trim(), setsCount: null, setsDetail: null };
  }
  return {
    name: matchResult[1].trim(),
    setsCount: matchResult[2],
    setsDetail: matchResult[3].trim(),
  };
}

function DayStatusChip({ recovery }) {
  const themeColors = useWRTheme();
  let statusLabel = 'Training';
  let statusGradient = HOME_STAT_MOOD_GRADIENT;
  if (recovery) {
    statusLabel = 'Recovery';
    statusGradient = HOME_STAT_WATER_GRADIENT;
  }
  const label = statusLabel;
  const gradient = statusGradient;
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

  const metricNodes = [];
  for (let index = 0; index < pills.length; index += 1) {
    const metricItem = pills[index];
    let dividerNode = null;
    if (index > 0) {
      dividerNode = (
        <View style={[styles.dayMetricDivider, { backgroundColor: themeColors.border }]} />
      );
    }
    metricNodes.push(
      <View key={metricItem.key}>
        {dividerNode}
        <View style={styles.dayMetricRow}>
          <WRMetricIcon metricKey={pillKeyToMetricKey(metricItem.key)} size={32} imageSize={16} />
          <Text style={[styles.dayMetricLabel, { color: themeColors.textSecondary }]}>
            {metricItem.label}
          </Text>
          <OutlinedColorText
            fillColor={themeColors.textPrimary}
            fontSize={15}
            fontWeight="800"
            letterSpacing={-0.2}
            numberOfLines={1}
            textAnchor="end"
            style={styles.dayMetricValue}
          >
            {metricItem.value}
          </OutlinedColorText>
        </View>
      </View>,
    );
  }

  return (
    <View
      style={[
        styles.dayMetricsCard,
        { backgroundColor: themeColors.badge, borderColor: themeColors.border },
      ]}
    >
      {metricNodes}
    </View>
  );
}

function DayPreviewStrip({ pills }) {
  const themeColors = useWRTheme();
  const preview = pills.slice(0, 3);
  if (!preview.length) return null;

  const previewNodes = [];
  for (let index = 0; index < preview.length; index += 1) {
    const metricItem = preview[index];
    previewNodes.push(
      <View key={metricItem.key} style={styles.dayPreviewChip}>
        <WRMetricIcon metricKey={pillKeyToMetricKey(metricItem.key)} size={24} imageSize={12} />
        <Text style={[styles.dayPreviewValue, { color: themeColors.textPrimary }]} numberOfLines={1}>
          {metricItem.value}
        </Text>
      </View>,
    );
  }

  return (
    <View style={[styles.dayPreviewRow, { borderTopColor: themeColors.border }]}>
      {previewNodes}
    </View>
  );
}
function DaySubsection({ label, children }) {
  const themeColors = useWRTheme();
  return (
    <View style={styles.daySubsection}>
      <Text style={[styles.daySubsectionLabel, { color: themeColors.textLabel }]}>{label}</Text>
      {children}
    </View>);

}

/**
 * One exercise row inside the day workout card (name + optional sets line).
 * @param {{ exerciseLine: string, isLastExercise: boolean, themeColors: object }} props
 */
function DayWorkoutExerciseRow({ exerciseLine, isLastExercise, themeColors }) {
  const parsedExercise = parseExerciseLine(exerciseLine);

  let rowBorderStyle = null;
  if (!isLastExercise) {
    rowBorderStyle = {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: themeColors.border,
    };
  }

  let setsDetailNode = null;
  if (parsedExercise.setsDetail) {
    let setsCountPrefix = '';
    if (parsedExercise.setsCount) {
      setsCountPrefix = `${parsedExercise.setsCount} sets · `;
    }
    setsDetailNode = (
      <Text style={[styles.exerciseSets, { color: themeColors.textSecondary }]}>
        {setsCountPrefix}
        {parsedExercise.setsDetail}
      </Text>
    );
  }

  return (
    <View style={[styles.exerciseRow, rowBorderStyle]}>
      <LinearGradient
        colors={HOME_STAT_WORKOUT_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.exerciseAccentBar}
      />
      <View style={styles.exerciseTextCol}>
        <Text style={[styles.exerciseName, { color: themeColors.textPrimary }]}>
          {parsedExercise.name}
        </Text>
        {setsDetailNode}
      </View>
    </View>
  );
}

/**
 * Workout subsection — list of DayWorkoutExerciseRow for every parsed exercise line.
 * @param {{ exerciseLines: string[], themeColors: object }} props
 */
function DayWorkoutSection({ exerciseLines, themeColors }) {
  const exerciseRows = [];
  for (let exerciseIndex = 0; exerciseIndex < exerciseLines.length; exerciseIndex += 1) {
    const exerciseLine = exerciseLines[exerciseIndex];
    const isLastExercise = exerciseIndex >= exerciseLines.length - 1;
    exerciseRows.push(
      <DayWorkoutExerciseRow
        key={`ex-${exerciseIndex}`}
        exerciseLine={exerciseLine}
        isLastExercise={isLastExercise}
        themeColors={themeColors}
      />,
    );
  }

  return (
    <DaySubsection label="Workout">
      <View
        style={[
          styles.workoutListCard,
          { borderColor: themeColors.border, backgroundColor: themeColors.badge },
        ]}
      >
        {exerciseRows}
      </View>
    </DaySubsection>
  );
}

/**
 * Personal note block under the day card.
 * @param {{ personalNote: string, themeColors: object }} props
 */
function DayPersonalNoteSection({ personalNote, themeColors }) {
  return (
    <DaySubsection label="Notes">
      <View
        style={[
          styles.dayNoteBlock,
          {
            borderLeftColor: HOME_STAT_WATER_GRADIENT[0],
            backgroundColor: themeColors.badge,
          },
        ]}
      >
        <Text style={[styles.dayNoteText, { color: themeColors.textPrimary }]}>
          {personalNote}
        </Text>
      </View>
    </DaySubsection>
  );
}

/**
 * Fallback free-text summary when structured pills did not parse.
 * @param {{ fallbackText: string, themeColors: object }} props
 */
function DayFallbackSummarySection({ fallbackText, themeColors }) {
  return (
    <DaySubsection label="Summary">
      <Text style={[styles.daySummaryText, { color: themeColors.textPrimary }]}>
        {fallbackText}
      </Text>
    </DaySubsection>
  );
}

/**
 * Pills for a recovery day with no other metrics logged.
 * @returns {{ key: string, label: string, value: string }[]}
 */
function recoveryOnlyTrainingPills() {
  return [{ key: 'training', label: 'Training', value: 'Rest' }];
}

/**
 * True when a recovery day has nothing else to show yet.
 * @param {boolean} isRecoveryDay
 * @param {{ pills: Array, personalNote: *, fallback: * }} detail
 * @returns {boolean}
 */
function recoveryDayHasNoDetailYet(isRecoveryDay, detail) {
  if (!isRecoveryDay) {
    return false;
  }
  if (detail.pills.length > 0) {
    return false;
  }
  if (detail.personalNote) {
    return false;
  }
  if (detail.fallback) {
    return false;
  }
  return true;
}

function DayDetailBody({ note, recovery }) {
  const themeColors = useWRTheme();
  // vocab: useMemo = cache parse result until the note string changes
  const detail = useMemo(() => parseStructuredDayNote(note), [note]);

  // 1. Empty recovery day — one calm line, no empty stacks.
  if (recoveryDayHasNoDetailYet(recovery, detail)) {
    return (
      <Text style={[styles.bodySecondary, { color: themeColors.textSecondary }]}>
        Rest / recovery day logged.
      </Text>
    );
  }

  // 2. Metric pills — parsed pills win; recovery with none gets a Rest chip.
  let pills = [];
  if (detail.pills.length > 0) {
    pills = detail.pills;
  } else if (recovery) {
    pills = recoveryOnlyTrainingPills();
  }

  let metricsListNode = null;
  if (pills.length > 0) {
    metricsListNode = <DayMetricsList pills={pills} />;
  }

  // 3. Workout / notes / fallback sections — each is its own small component.
  let workoutSectionNode = null;
  if (detail.workoutExercises.length > 0) {
    workoutSectionNode = (
      <DayWorkoutSection
        exerciseLines={detail.workoutExercises}
        themeColors={themeColors}
      />
    );
  }

  let personalNoteNode = null;
  if (detail.personalNote) {
    personalNoteNode = (
      <DayPersonalNoteSection
        personalNote={detail.personalNote}
        themeColors={themeColors}
      />
    );
  }

  let fallbackSummaryNode = null;
  if (detail.fallback) {
    fallbackSummaryNode = (
      <DayFallbackSummarySection
        fallbackText={detail.fallback}
        themeColors={themeColors}
      />
    );
  }

  return (
    <View style={styles.dayDetailStack}>
      {metricsListNode}
      {workoutSectionNode}
      {personalNoteNode}
      {fallbackSummaryNode}
    </View>
  );
}

function uniqueStrings(stringList) {
  const seenLowercase = new Set();
  const uniqueList = [];
  for (const rawEntry of stringList) {
    const textValue = String(rawEntry || '').trim();
    if (!textValue) {
      continue;
    }
    const lowercaseKey = textValue.toLowerCase();
    if (seenLowercase.has(lowercaseKey)) {
      continue;
    }
    seenLowercase.add(lowercaseKey);
    uniqueList.push(textValue);
  }
  return uniqueList;
}

function pullMatchingTrend(trendPool, matchPattern) {
  const matchIndex = trendPool.findIndex((trendItem) =>
    matchPattern.test(String(trendItem).toLowerCase()),
  );
  if (matchIndex < 0) {
    return '';
  }
  const matched = trendPool.splice(matchIndex, 1)[0];
  return matched;
}

function nextLeftoverTrend(trendPool) {
  if (!trendPool.length) {
    return '';
  }
  return trendPool.shift() || '';
}

function buildTrendCards(trends) {
  const trendPool = [...trends];

  const sleepText =
    pullMatchingTrend(trendPool, /sleep|hour|\bh\b|bed|rest/) || nextLeftoverTrend(trendPool);
  const hydrationText =
    pullMatchingTrend(trendPool, /water|hydration|oz|drink/) || nextLeftoverTrend(trendPool);
  const movementText =
    pullMatchingTrend(trendPool, /step|walk|movement|active/) || nextLeftoverTrend(trendPool);
  const coachingText =
    pullMatchingTrend(trendPool, /coach|signal|pattern|consistency|volume|training/) ||
    nextLeftoverTrend(trendPool);

  const cards = [
    { title: 'Sleep rhythm', text: sleepText },
    { title: 'Hydration', text: hydrationText },
    { title: 'Movement', text: movementText },
    { title: 'Coaching signal', text: coachingText },
  ];

  const cardsWithText = [];
  for (const trendCard of cards) {
    if (!trendCard.text) {
      continue;
    }
    cardsWithText.push(trendCard);
  }
  return cardsWithText;
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
  // vocab: NbCard = thick outline + hard offset shadow (no soft glow)
  return (
    <NbCard style={[styles.reportCard, padding != null ? { padding } : null, style]}>
      {children}
    </NbCard>
  );
}

function GradientReportCard({ children, style, padding }) {
  // No gradient borders (design rule) — same NbCard shell; brand CTA is the gradient moment elsewhere.
  return (
    <NbCard style={[styles.reportCard, padding != null ? { padding } : null, style]}>
      {children}
    </NbCard>
  );
}

function StatHeroCard({ label, value, accent, progress }) {
  const themeColors = useWRTheme();
  const hasValue = value !== '—';
  let fillPct = 0;
  if (hasValue) {
    fillPct = Math.round(clampProgressFraction(progress) * 100);
  }
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

/**
 * Highlight rows inside the hero card.
 * @param {object[]} highlights
 * @param {object} themeColors
 * @returns {Array}
 */
function buildHeroHighlightNodes(highlights, themeColors) {
  const nodes = [];
  for (let highlightIndex = 0; highlightIndex < highlights.length; highlightIndex += 1) {
    const highlightItem = highlights[highlightIndex];
    let dividerNode = null;
    if (highlightIndex > 0) {
      dividerNode = (
        <View style={[styles.heroHighlightDivider, { backgroundColor: themeColors.border }]} />
      );
    }
    nodes.push(
      <View key={`${highlightItem.icon}-${highlightIndex}`}>
        {dividerNode}
        <HeroHighlightRow icon={highlightItem.icon} text={highlightItem.text} />
      </View>,
    );
  }
  return nodes;
}

function WeeklyReportHero({ report, clientName = '' }) {
  const themeColors = useWRTheme();
  const dates = useMemo(() => formatDateRange(report), [report]);
  const snapshot = useMemo(() => buildHeroSnapshot(report), [report]);
  const firstName = firstNameFromReport(report, clientName);
  let headline = 'Your week in review';
  if (firstName) {
    headline = `${firstName}'s week in review`;
  }

  let checkInPct = null;
  if (snapshot.logged != null) {
    checkInPct = Math.round(clampProgressFraction(snapshot.logged / DAYS_IN_WEEK) * 100);
  }

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
                {buildHeroHighlightNodes(snapshot.highlights, themeColors)}
              </View>
            </View> :
          null}

          <Text style={[styles.heroFootnote, { color: themeColors.textLabel }]}>{snapshot.footnote}</Text>
        </LinearGradient>
      </View>
    </View>);

}

function resolveDayPills(detail, recovery, empty) {
  if (detail.pills.length > 0) {
    return detail.pills;
  }
  if (recovery && !empty) {
    return [{ key: 'training', label: 'Training', value: 'Rest' }];
  }
  return [];
}

function DayExpandedContent({ parsedNote, recovery, empty, themeColors }) {
  if (empty) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 12, gap: 8 }}>
        <Ionicons name="calendar-outline" size={28} color={themeColors.textLabel} />
        <Text
          style={[
            styles.bodySecondary,
            { color: themeColors.textSecondary, textAlign: 'center' },
          ]}
        >
          No check-in for this day yet.
        </Text>
      </View>
    );
  }
  return <DayDetailBody note={parsedNote} recovery={recovery} />;
}

function DayCard({ index, dayLine }) {
  const themeColors = useWRTheme();
  const parsed = parseDayNote(dayLine);
  const recovery = isRecoveryDay(parsed.note);
  const empty = isEmptyCheckIn(parsed.note);
  const dayTitle = DAY_LABELS[index] || parsed.day;
  const dateLabel = formatDisplayDate(parsed.date) || parsed.date;
  const detail = useMemo(() => parseStructuredDayNote(parsed.note), [parsed.note]);
  const pills = resolveDayPills(detail, recovery, empty);

  // Hook order frozen: expand state defaults open when the day has a check-in.
  const [open, setOpen] = useState(!empty);

  const toggleDayCardOpen = () => {
    // vocab: LayoutAnimation = native expand/collapse when the press flips open
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((wasExpanded) => !wasExpanded);
  };

  const chevronIconName = open ? 'chevron-up' : 'chevron-down';
  const showStatusChip = !empty;
  const showCollapsedPreview = !open && !empty && pills.length > 0;
  const showCollapsedEmptyHint = !open && empty;
  const showExpandedBody = open;

  let dateLabelNode = null;
  if (dateLabel) {
    dateLabelNode = (
      <Text style={[styles.dayDate, { color: themeColors.textSecondary }]}>{dateLabel}</Text>
    );
  }

  let statusChipNode = null;
  if (showStatusChip) {
    statusChipNode = <DayStatusChip recovery={recovery} />;
  }

  let collapsedPreviewNode = null;
  if (showCollapsedPreview) {
    collapsedPreviewNode = <DayPreviewStrip pills={pills} />;
  }

  let collapsedEmptyHintNode = null;
  if (showCollapsedEmptyHint) {
    collapsedEmptyHintNode = (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
        <Ionicons name="moon-outline" size={16} color={themeColors.textLabel} />
        <Text style={[styles.dayEmptyHint, { color: themeColors.textSecondary, marginTop: 0 }]}>
          No check-in logged — tap to add notes when you check in.
        </Text>
      </View>
    );
  }

  let expandedSectionNode = null;
  if (showExpandedBody) {
    expandedSectionNode = (
      <View style={styles.dayExpanded}>
        <DayExpandedContent
          parsedNote={parsed.note}
          recovery={recovery}
          empty={empty}
          themeColors={themeColors}
        />
      </View>
    );
  }

  return (
    <View style={[styles.dayCardOuter, { borderColor: themeColors.border }]}>
      <LinearGradient
        colors={themeColors.heroTop}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.dayCardAccent}
      />

      <View style={[styles.dayCardInner, { backgroundColor: themeColors.card }]}>
        <Pressable onPress={toggleDayCardOpen} accessibilityRole="button">
          <View style={styles.dayHeaderRow}>
            <LinearGradient
              colors={HOME_STAT_MOOD_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.dayIndexRing}
            >
              <View style={[styles.dayIndexInner, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.dayIndexText, { color: themeColors.textPrimary }]}>
                  {index + 1}
                </Text>
              </View>
            </LinearGradient>
            <View style={styles.dayTitleCol}>
              <Text style={[styles.dayTitle, { color: themeColors.textPrimary }]}>{dayTitle}</Text>
              {dateLabelNode}
            </View>
            {statusChipNode}
            <Ionicons name={chevronIconName} size={18} color={themeColors.textLabel} />
          </View>

          {collapsedPreviewNode}
          {collapsedEmptyHintNode}
          {expandedSectionNode}
        </Pressable>
      </View>
    </View>
  );
}

function WinsCard({ items }) {
  const themeColors = useWRTheme();
  const list = items.length ? items : ['No wins logged for this week yet.'];

  const winNodes = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    winNodes.push(
      <View key={`w-${index}`} style={styles.winRow}>
        <Ionicons name="checkmark-circle" size={20} color={themeColors.cyan} />
        <Text style={[styles.bodyPrimary, { color: themeColors.textPrimary }]}>{item}</Text>
      </View>,
    );
  }

  return (
    <ReportCard style={{ marginBottom: SPACE.cardGap }} padding={SPACE.cardPad}>
      <CapsLabel style={styles.cardEyebrow}>WHAT WENT WELL</CapsLabel>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="trophy-outline" size={20} color={themeColors.cyan} />
        <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>Wins</Text>
      </View>
      <View style={styles.listGap}>{winNodes}</View>
    </ReportCard>
  );
}

function FocusCard({ items }) {
  const themeColors = useWRTheme();
  const list = items.length ? items : [{ title: 'No coaching priorities for this week.', desc: '' }];

  const focusNodes = [];
  for (let focusIndex = 0; focusIndex < list.length; focusIndex += 1) {
    const focusItem = list[focusIndex];
    let focusTitle = focusItem.title;
    let focusDescription = focusItem.desc;
    if (typeof focusItem === 'string') {
      focusTitle = focusItem;
      focusDescription = '';
    }
    let descriptionNode = null;
    if (focusDescription) {
      descriptionNode = (
        <Text style={[styles.bodySecondary, { color: themeColors.textSecondary }]}>
          {focusDescription}
        </Text>
      );
    }
    focusNodes.push(
      <View key={`p-${focusIndex}`} style={styles.focusRow}>
        <View style={[styles.focusBadge, { backgroundColor: themeColors.focusBadgeBg }]}>
          <Text style={[styles.focusBadgeText, { color: themeColors.textPrimary }]}>
            {focusIndex + 1}
          </Text>
        </View>
        <View style={styles.focusTextCol}>
          <Text style={[styles.bodyPrimary, { color: themeColors.textPrimary }]}>
            {focusTitle}
          </Text>
          {descriptionNode}
        </View>
        <Ionicons name="chevron-forward" size={18} color={themeColors.textLabel} />
      </View>,
    );
  }

  return (
    <GradientReportCard padding={SPACE.cardPad}>
      <CapsLabel style={styles.cardEyebrow}>COACHING PRIORITIES</CapsLabel>
      <View style={styles.cardHeaderRow}>
        <Ionicons name="bulb-outline" size={20} color="#C2410C" />
        <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>Focus This Week</Text>
      </View>
      <View style={styles.listGap}>{focusNodes}</View>
    </GradientReportCard>
  );
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
/**
 * Format report list fields (trends / wins / cons / focus) into plain strings.
 * @param {object|null|undefined} report
 * @param {string} fieldName
 * @returns {string[]}
 */
function formattedStringListFromReport(report, fieldName) {
  const rawList = fieldFromReport(report, fieldName);
  if (!Array.isArray(rawList)) {
    return [];
  }
  return formatEachEntry(rawList, textForReport);
}

/**
 * Build the seven day-breakdown lines shown in the scroll body.
 * @param {object|null|undefined} report
 * @returns {string[]}
 */
function sevenDayLinesFromReport(report) {
  const dayBreakdown = fieldFromReport(report, 'dayBreakdown');
  let rawDayLines = [];
  if (Array.isArray(dayBreakdown)) {
    rawDayLines = formatEachEntry(dayBreakdown, textForReport);
  }

  const sevenDayLines = [];
  for (let dayIndex = 0; dayIndex < DAYS_IN_WEEK; dayIndex += 1) {
    if (rawDayLines[dayIndex]) {
      sevenDayLines.push(rawDayLines[dayIndex]);
      continue;
    }
    const dayLabel = DAY_LABELS[dayIndex] || `Day ${dayIndex + 1}`;
    sevenDayLines.push(`${dayLabel} (): No check-in for this day.`);
  }
  return sevenDayLines;
}

/**
 * Stat hero cards for the glance grid.
 * @param {object[]} metricTiles
 * @returns {Array}
 */
function buildStatHeroCardNodes(metricTiles) {
  const nodes = [];
  for (let index = 0; index < metricTiles.length; index += 1) {
    const metricItem = metricTiles[index];
    nodes.push(
      <StatHeroCard
        key={metricItem.key}
        label={metricItem.label}
        value={metricItem.value}
        accent={metricItem.accent}
        progress={metricItem.progress}
      />,
    );
  }
  return nodes;
}

/**
 * Day cards for the daily breakdown list.
 * @param {string[]} days
 * @returns {Array}
 */
function buildDayCardNodes(days) {
  const nodes = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    nodes.push(
      <DayCard key={`day-${dayIndex}`} index={dayIndex} dayLine={days[dayIndex]} />,
    );
  }
  return nodes;
}

/**
 * Insight tiles for weekly trend cards.
 * @param {object[]} trendCards
 * @param {object} theme
 * @returns {Array}
 */
function buildTrendCardNodes(trendCards, theme) {
  const nodes = [];
  for (let index = 0; index < trendCards.length; index += 1) {
    const trendItem = trendCards[index];
    nodes.push(
      <ReportCard key={trendItem.title} style={styles.insightTile} padding={SPACE.cardPad}>
        <Text style={[styles.insightTitle, { color: theme.textPrimary }]}>{trendItem.title}</Text>
        <Text style={[styles.bodySecondary, { color: theme.textSecondary }]}>{trendItem.text}</Text>
      </ReportCard>,
    );
  }
  return nodes;
}

/**
 * Next-week focus rows (max four).
 * @param {string[]} nextWeek
 * @param {object} theme
 * @returns {Array}
 */
function buildNextWeekFocusNodes(nextWeek, theme) {
  const nodes = [];
  const maxFocusRows = Math.min(4, nextWeek.length);
  for (let index = 0; index < maxFocusRows; index += 1) {
    const item = nextWeek[index];
    let rowStyle = styles.nextRow;
    if (index > 0) {
      rowStyle = [styles.nextRow, { marginTop: SPACE.listGap }];
    }
    nodes.push(
      <View key={`n-${index}`} style={rowStyle}>
        <View style={[styles.nextDot, { backgroundColor: theme.badge }]}>
          <Text style={[styles.nextDotText, { color: theme.textPrimary }]}>{index + 1}</Text>
        </View>
        <Text style={[styles.bodyPrimary, { color: theme.textPrimary }]}>{item}</Text>
      </View>,
    );
  }
  return nodes;
}

/**
 * Scrollable container rendering full weekly report tiles, trends, and daily breakdowns.
 * @param {object} props
 * @returns {React.ReactElement}
 */
export function WeeklyReportScrollBody({ report, isDark = true, clientName = '' }) {
  // 1. Build theme + derived lists (metrics, trends, wins, seven day lines).
  const theme = useMemo(() => getWRTheme(isDark), [isDark]);
  const metricTiles = useMemo(() => buildMetricTiles(report), [report]);
  const reportTrends = fieldFromReport(report, 'trends');
  const reportWins = fieldFromReport(report, 'wins');
  const reportCons = fieldFromReport(report, 'cons');
  const reportFocus = fieldFromReport(report, 'focus');
  const reportDayBreakdown = fieldFromReport(report, 'dayBreakdown');

  const trendCards = useMemo(
    () => buildTrendCards(formattedStringListFromReport(report, 'trends')),
    [reportTrends],
  );
  const wins = useMemo(
    () => uniqueStrings(formattedStringListFromReport(report, 'wins')),
    [reportWins],
  );
  const priorities = useMemo(
    () => uniqueStrings(formattedStringListFromReport(report, 'cons')),
    [reportCons],
  );
  const nextWeek = useMemo(
    () => uniqueStrings(formattedStringListFromReport(report, 'focus')),
    [reportFocus],
  );
  const days = useMemo(
    () => sevenDayLinesFromReport(report),
    [reportDayBreakdown],
  );

  // 2. Empty report → single placeholder (still wrap theme for child hooks).
  if (!report) {
    return (
      <WRlightDarkMode.Provider value={theme}>
        <View style={styles.emptyWrap}>
          <Text style={[styles.bodySecondary, { color: theme.textSecondary }]}>No report data.</Text>
        </View>
      </WRlightDarkMode.Provider>
    );
  }

  // 3. Name list nodes before JSX (no .map in the main).
  const statHeroCardNodes = buildStatHeroCardNodes(metricTiles);
  const dayCardNodes = buildDayCardNodes(days);
  const trendCardNodes = buildTrendCardNodes(trendCards, theme);
  const nextWeekFocusNodes = buildNextWeekFocusNodes(nextWeek, theme);

  let insightsSectionNode = null;
  if (trendCards.length > 0) {
    insightsSectionNode = (
      <SectionBlock capsLabel="INSIGHTS" title="Weekly trends" dividerColors={theme.grad.purplePink}>
        <View style={styles.statGrid}>{trendCardNodes}</View>
      </SectionBlock>
    );
  }

  let nextWeekSectionNode = null;
  if (nextWeek.length > 0) {
    nextWeekSectionNode = (
      <SectionBlock capsLabel="NEXT WEEK" title="Your focus">
        <ReportCard padding={SPACE.cardPad}>{nextWeekFocusNodes}</ReportCard>
      </SectionBlock>
    );
  }

  let coachSignOffNode = null;
  if (report.signOff) {
    coachSignOffNode = (
      <SectionBlock capsLabel="COACH" title="Sign-off" style={{ marginBottom: 24 }}>
        <ReportCard padding={SPACE.cardPad}>
          <Text style={[styles.bodySecondary, { color: theme.textSecondary }]}>
            {textForReport(report.signOff)}
          </Text>
        </ReportCard>
      </SectionBlock>
    );
  }

  // 4. Full scroll stack: hero → stats grid → days → trends → wins/focus → next week → coach sign-off.
  return (
    <WRlightDarkMode.Provider value={theme}>
      <View style={styles.scrollBody}>
        <View style={{ paddingHorizontal: SPACE.screen }}>
          <WeeklyReportHero report={report} clientName={clientName} />
        </View>

        <SectionBlock capsLabel="THIS WEEK AT A GLANCE">
          <View style={styles.statGrid}>{statHeroCardNodes}</View>
        </SectionBlock>

        <SectionBlock capsLabel="DAILY BREAKDOWN" dividerColors={theme.grad.pinkOrange}>
          <View style={styles.dayList}>{dayCardNodes}</View>
        </SectionBlock>

        {insightsSectionNode}

        <SectionBlock capsLabel="PERFORMANCE" title="Summary" dividerColors={theme.grad.orangePink}>
          <WinsCard items={wins} />
          <FocusCard items={priorities} />
        </SectionBlock>

        {nextWeekSectionNode}
        {coachSignOffNode}
      </View>
    </WRlightDarkMode.Provider>
  );
}

function WeeklyReportCard({ report, metricTiles, onOpen, isDark = true }) {
  const theme = getWRTheme(isDark);
  const dates = useMemo(() => formatDateRange(report), [report]);

  const previewMetricNodes = [];
  for (let index = 0; index < metricTiles.length; index += 1) {
    const metricItem = metricTiles[index];
    let valueColor = theme.textPrimary;
    if (metricItem.value === '—') {
      valueColor = theme.textLabel;
    }
    previewMetricNodes.push(
      <View
        key={metricItem.key}
        style={[
          styles.statTile,
          {
            padding: 14,
            backgroundColor: theme.badge,
            borderColor: theme.border,
            borderWidth: 1,
            borderRadius: 16,
          },
        ]}
      >
        <Text style={[styles.statLabel, { color: theme.metricLabel }]}>{metricItem.label}</Text>
        <Text style={[styles.statValue, { fontSize: 28, color: valueColor }]}>
          {metricItem.value}
        </Text>
      </View>,
    );
  }

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
          <View style={styles.statGrid}>{previewMetricNodes}</View>
          <Text style={[styles.bodySecondary, { marginTop: 12, color: theme.textSecondary }]} numberOfLines={3}>
            {report.summary || 'Open for daily breakdown, trends, and coaching notes.'}
          </Text>
          <View style={{ marginTop: 14 }}>
            <NbButton variant="brand" onPress={onOpen}>
              Open report
            </NbButton>
          </View>
        </ReportCard>
      </View>
    </WRlightDarkMode.Provider>
  );
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
  // Hook order frozen: modal visibility, then derived tiles/theme.
  const [modalVisible, setModalVisible] = useState(false);
  const metricTiles = useMemo(() => buildMetricTiles(weeklySummary), [weeklySummary]);
  const theme = getWRTheme(isDark);

  const openReportModal = () => {
    setModalVisible(true);
  };
  const closeReportModal = () => {
    setModalVisible(false);
  };

  // 1. Loading shell with optional marketing kicker.
  if (loading) {
    let marketingHeaderNode = null;
    if (showMarketingHeader) {
      marketingHeaderNode = (
        <Text
          style={[
            styles.capsLabel,
            { marginHorizontal: SPACE.screen, marginBottom: 8, color: theme.textLabel },
          ]}
        >
          Weekly report
        </Text>
      );
    }

    return (
      <WRlightDarkMode.Provider value={theme}>
        <View style={{ width: '100%' }}>
          {marketingHeaderNode}
          <ReportCard style={{ marginHorizontal: SPACE.screen }} padding={SPACE.cardPad}>
            <View style={{ paddingVertical: 28, alignItems: 'center' }}>
              <ActivityIndicator color={theme.cyan} size="large" />
              <Text style={{ color: theme.textLabel, marginTop: 12, fontSize: 13 }}>
                Loading weekly report…
              </Text>
            </View>
          </ReportCard>
        </View>
      </WRlightDarkMode.Provider>
    );
  }

  // 2. No summary doc yet → render nothing (caller shows banner elsewhere).
  if (!weeklySummary) {
    return null;
  }

  // 3. Preview card + full-screen modal reader.
  return (
    <View style={{ width: '100%' }}>
      <WeeklyReportCard
        report={weeklySummary}
        metricTiles={metricTiles}
        onOpen={openReportModal}
        isDark={isDark}
      />
      <WeeklyReportDetailModal
        report={weeklySummary}
        visible={modalVisible}
        onClose={closeReportModal}
        isDark={isDark}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
    borderRadius: borderRadius.nbCard,
    padding: SPACE.cardPad,
    overflow: 'hidden'
  },
  gradientReportBorder: {
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  gradientReportInner: {
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden'
  },
  heroOuter: {
    borderRadius: borderRadius.nbHero,
    borderWidth: nb.borderWidth,
    overflow: 'hidden'
  },
  heroClip: { borderRadius: borderRadius.nbHero, overflow: 'hidden' },
  heroInner: { padding: 22 },
  heroKicker: {
    fontSize: 12,
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
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
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
  openButton: { borderRadius: borderRadius.nbChip, paddingVertical: 14, alignItems: 'center' },
  openButtonText: { fontSize: 15, fontWeight: '700', color: lightColors.nbInk }
});
