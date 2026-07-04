import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WR_METRIC_VISUAL } from '../../../trainer-app/weekly-report/WeeklyReportPremium';
import {
  HOME_STAT_ENERGY_GRADIENT,
  HOME_STAT_MOOD_GRADIENT,
  HOME_STAT_STRESS_GRADIENT,
} from '../../../shared-ui/homeStatGradients';
import { useTheme } from '../theme/WeeklyReportThemeContext';

/** Extra metric visuals for nutrition macros (app PNG assets). */
const EXTRA_METRIC_VISUAL = {
  nutrition: {
    source: require('../../../assets/icons/burger.png'),
    gradient: HOME_STAT_STRESS_GRADIENT,
  },
  protein: {
    source: require('../../../assets/icons/Protein.png'),
    gradient: HOME_STAT_MOOD_GRADIENT,
  },
  carbs: {
    source: require('../../../assets/icons/Carbs.png'),
    gradient: HOME_STAT_ENERGY_GRADIENT,
  },
  fat: {
    source: require('../../../assets/icons/Fats.png'),
    gradient: HOME_STAT_STRESS_GRADIENT,
  },
};

export function getReportMetricVisual(metricKey) {
  return EXTRA_METRIC_VISUAL[metricKey] || WR_METRIC_VISUAL[metricKey] || WR_METRIC_VISUAL.energy;
}

/** Gradient ring + custom PNG — same treatment as home / premium report. */
export function ReportMetricIcon({ metricKey, size = 36, imageSize = 20 }) {
  const { mode } = useTheme();
  const visual = getReportMetricVisual(metricKey);
  const innerRadius = Math.max(8, size / 2 - 2);

  return (
    <LinearGradient
      colors={visual.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.ring, { width: size, height: size, borderRadius: innerRadius + 2 }]}
    >
      <View
        style={[
          styles.inner,
          {
            borderRadius: innerRadius,
            backgroundColor: mode === 'dark' ? 'rgba(12,10,20,0.98)' : '#FFFFFF',
          },
        ]}
      >
        <Image source={visual.source} style={{ width: imageSize, height: imageSize }} resizeMode="contain" />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  ring: {
    padding: 1.5,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
