// The round icon next to a weekly-report stat.
// Flow: look up the picture and gradient for that stat → paint a ring → put the picture in the middle.
// Used by: weekly report rows for food, protein, carbs, and fat, plus the shared workout stats.

import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WR_METRIC_VISUAL } from '../../trainer-app/weekly-report/WeeklyReportBars';
import {
  HOME_STAT_ENERGY_GRADIENT,
  HOME_STAT_MOOD_GRADIENT,
  HOME_STAT_STRESS_GRADIENT,
} from '../../look-and-feel/homeStatColors';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const DEFAULT_ICON_SIZE = 36;
const DEFAULT_IMAGE_SIZE = 20;
const RING_INSET = 2;
const MIN_INNER_RADIUS = 8;
const RING_PADDING = 1.5;
const DARK_MODE = 'dark';
const DARK_INNER_COLOR = 'rgba(12,10,20,0.98)';
const LIGHT_INNER_COLOR = '#FFFFFF';
const FALLBACK_METRIC_KEY = 'energy';

const EXTRA_METRIC_VISUAL = {
  nutrition: {
    source: require('../../assets/icons/burger.png'),
    gradient: HOME_STAT_STRESS_GRADIENT,
  },
  protein: {
    source: require('../../assets/icons/Protein.png'),
    gradient: HOME_STAT_MOOD_GRADIENT,
  },
  carbs: {
    source: require('../../assets/icons/Carbs.png'),
    gradient: HOME_STAT_ENERGY_GRADIENT,
  },
  fat: {
    source: require('../../assets/icons/Fats.png'),
    gradient: HOME_STAT_STRESS_GRADIENT,
  },
};

// ===== HELPER FUNCTIONS =====

/**
 * Food macros live here. Workout stats come from the weekly report bars.
 * @param {string} metricKey
 * @returns {{ source: number, gradient: string[] }}
 */
export function getReportMetricVisual(metricKey) {
  if (EXTRA_METRIC_VISUAL[metricKey]) return EXTRA_METRIC_VISUAL[metricKey];
  if (WR_METRIC_VISUAL[metricKey]) return WR_METRIC_VISUAL[metricKey];
  return WR_METRIC_VISUAL[FALLBACK_METRIC_KEY];
}

function innerCircleRadius(size) {
  return Math.max(MIN_INNER_RADIUS, size / 2 - RING_INSET);
}

function ringBackgroundColor(mode) {
  if (mode === DARK_MODE) return DARK_INNER_COLOR;
  return LIGHT_INNER_COLOR;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ metricKey: string, size?: number, imageSize?: number }} props
 */
export function StatIcon({ metricKey, size = DEFAULT_ICON_SIZE, imageSize = DEFAULT_IMAGE_SIZE }) {
  const { mode } = useTheme();
  const metricVisual = getReportMetricVisual(metricKey);
  const innerRadius = innerCircleRadius(size);
  const ringRadius = innerRadius + RING_INSET;
  const fillColor = ringBackgroundColor(mode);

  return (
    <LinearGradient
      colors={metricVisual.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: size, height: size, borderRadius: ringRadius }]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius: innerRadius,
            backgroundColor: fillColor,
          },
        ]}
      >
        <Image source={metricVisual.source} style={{ width: imageSize, height: imageSize }} resizeMode="contain" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    padding: RING_PADDING,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
