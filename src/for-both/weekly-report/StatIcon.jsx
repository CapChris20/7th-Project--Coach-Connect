// Metric icon chip for weekly report rows — owner handoff PNG inside NbIconChip.
// Flow: metricKey → macro table OR lifestyle table OR legacy bars → paint chip.
// Used on stat rows and legacy day expanders.
// vocab: NbIconChip = 3px outline square with a small accent gradient (never a purple ring).

import React from 'react';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { accentGradients } from '../../look-and-feel/colorPalette';
import { WR_METRIC_VISUAL } from '../../trainer-app/weekly-report/WeeklyReportBars';

// ===== NAMED CONSTANTS =====

// Manipulate here: default square size on report stat rows
const DEFAULT_CHIP_SIZE = 40;

// Fallback when an unknown metricKey hits the legacy bar table
const FALLBACK_METRIC_KEY = 'energy';

// Nutrition macros use fixed accent slots (Design Law handoff art).
const NUTRITION_AND_MACRO_ART = {
  nutrition: {
    source: require('../../assets/icons/handoff/apple.png'),
    gradientIndex: 3,
  },
  protein: {
    source: require('../../assets/icons/handoff/protein.png'),
    gradientIndex: 0,
  },
  carbs: {
    source: require('../../assets/icons/handoff/carbs.png'),
    gradientIndex: 4,
  },
  fat: {
    source: require('../../assets/icons/handoff/fats.png'),
    gradientIndex: 1,
  },
};

// Lifestyle metrics — key order here decides fallback gradient index when no fixed slot exists.
const LIFESTYLE_HANDOFF_BY_KEY = {
  sleep: require('../../assets/icons/handoff/sleeping.png'),
  water: require('../../assets/icons/handoff/hydration.png'),
  steps: require('../../assets/icons/handoff/journey.png'),
  energy: require('../../assets/icons/handoff/energy.png'),
  stress: require('../../assets/icons/handoff/stress.png'),
  soreness: require('../../assets/icons/handoff/injury.png'),
  scale: require('../../assets/icons/handoff/scales.png'),
  workout: require('../../assets/icons/handoff/workout.png'),
  mood: require('../../assets/icons/handoff/progress.png'),
  bodyfat: require('../../assets/icons/handoff/progress.png'),
};

// ===== MAIN FUNCTION =====

/**
 * Resolve handoff art + accent for a metric letter key.
 * Flow: 1. macros  2. lifestyle  3. legacy trainer bars
 * @param {string} metricKey
 * @returns {{ source: number, index: number, gradient: string[] }}
 */
export function getReportMetricVisual(metricKey) {
  // 1. Prefer macro/nutrition table (fixed gradient slots).
  const fromMacros = buildVisualFromMacroTable(metricKey);
  if (fromMacros) {
    return fromMacros;
  }

  // 2. Then lifestyle handoff table (gradient follows key order).
  const fromLifestyle = buildVisualFromLifestyleTable(metricKey);
  if (fromLifestyle) {
    return fromLifestyle;
  }

  // 3. Rare keys fall back to trainer weekly-report bar art.
  return buildVisualFromLegacyBars(metricKey);
}

/**
 * Design Law icon chip for one weekly-report metric key.
 * Flow: 1. resolve art  2. paint NbIconChip
 * @param {{ metricKey: string, size?: number, imageSize?: number }} props
 */
export function StatIcon({ metricKey, size = DEFAULT_CHIP_SIZE, imageSize: _imageSize }) {
  // 1. Resolve art + accent for this metric letter key.
  // `_imageSize` stays in the props signature for callers that still pass it (unused by NbIconChip).
  const metricVisual = getReportMetricVisual(metricKey);

  // 2. Paint the Design Law icon chip (outline + gradient only).
  return (
    <NbIconChip
      source={metricVisual.source}
      index={metricVisual.index}
      size={size}
      colors={metricVisual.gradient}
    />
  );
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging =====

/**
 * Macro/nutrition keys with fixed Design Law gradient slots.
 * @returns {{ source: number, index: number, gradient: string[] }|null}
 */
function buildVisualFromMacroTable(metricKey) {
  const macroRow = NUTRITION_AND_MACRO_ART[metricKey];
  if (!macroRow) {
    return null;
  }

  const gradientIndex = macroRow.gradientIndex;
  return {
    source: macroRow.source,
    index: gradientIndex,
    gradient: accentGradients[gradientIndex],
  };
}

/**
 * Lifestyle keys — gradient index = position in LIFESTYLE_HANDOFF_BY_KEY.
 * @returns {{ source: number, index: number, gradient: string[] }|null}
 */
function buildVisualFromLifestyleTable(metricKey) {
  const imageSource = LIFESTYLE_HANDOFF_BY_KEY[metricKey];
  if (!imageSource) {
    return null;
  }

  const keyOrder = Object.keys(LIFESTYLE_HANDOFF_BY_KEY);
  const gradientIndex = keyOrder.indexOf(metricKey);
  const gradientCount = accentGradients.length;

  return {
    source: imageSource,
    index: gradientIndex,
    gradient: accentGradients[gradientIndex % gradientCount],
  };
}

/**
 * Last resort: trainer WeeklyReportBars visual map (energy if key missing).
 * @returns {{ source: number, index: number, gradient: string[] }}
 */
function buildVisualFromLegacyBars(metricKey) {
  let legacyRow = WR_METRIC_VISUAL[metricKey];
  if (!legacyRow) {
    legacyRow = WR_METRIC_VISUAL[FALLBACK_METRIC_KEY];
  }

  let gradient = accentGradients[0];
  if (legacyRow.gradient) {
    gradient = legacyRow.gradient;
  }

  return {
    source: legacyRow.source,
    index: 0,
    gradient,
  };
}
