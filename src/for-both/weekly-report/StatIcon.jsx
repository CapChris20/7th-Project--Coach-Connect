// Design Law metric icon — NbIconChip with owner handoff art (accent gradient only).
// Flow: map metricKey → handoff PNG → NbIconChip. Used by tips / legacy day expand rows.
// vocab: NbIconChip = 3px bordered gradient square; never a purple ring border

import React from 'react';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { accentGradients } from '../../look-and-feel/colorPalette';
import { WR_METRIC_VISUAL } from '../../trainer-app/weekly-report/WeeklyReportBars';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON_SIZE = 40;
const FALLBACK_METRIC_KEY = 'energy';

const EXTRA_METRIC_VISUAL = {
  nutrition: {
    source: require('../../assets/icons/handoff/apple.png'),
    index: 3,
  },
  protein: {
    source: require('../../assets/icons/handoff/protein.png'),
    index: 0,
  },
  carbs: {
    source: require('../../assets/icons/handoff/carbs.png'),
    index: 4,
  },
  fat: {
    source: require('../../assets/icons/handoff/fats.png'),
    index: 1,
  },
};

const HANDOFF_BY_KEY = {
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

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} metricKey
 * @returns {{ source: number, index: number }}
 */
export function getReportMetricVisual(metricKey) {
  if (EXTRA_METRIC_VISUAL[metricKey]) {
    return {
      source: EXTRA_METRIC_VISUAL[metricKey].source,
      index: EXTRA_METRIC_VISUAL[metricKey].index,
      gradient: accentGradients[EXTRA_METRIC_VISUAL[metricKey].index],
    };
  }
  if (HANDOFF_BY_KEY[metricKey]) {
    const index = Object.keys(HANDOFF_BY_KEY).indexOf(metricKey);
    return {
      source: HANDOFF_BY_KEY[metricKey],
      index,
      gradient: accentGradients[index % accentGradients.length],
    };
  }
  // Fall back to WeeklyReportBars visual when a rare key appears
  const legacy = WR_METRIC_VISUAL[metricKey] || WR_METRIC_VISUAL[FALLBACK_METRIC_KEY];
  return {
    source: legacy.source,
    index: 0,
    gradient: legacy.gradient || accentGradients[0],
  };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ metricKey: string, size?: number, imageSize?: number }} props
 */
export function StatIcon({ metricKey, size = DEFAULT_ICON_SIZE, imageSize: _imageSize }) {
  const visual = getReportMetricVisual(metricKey);
  return (
    <NbIconChip
      source={visual.source}
      index={visual.index}
      size={size}
      colors={visual.gradient}
    />
  );
}
