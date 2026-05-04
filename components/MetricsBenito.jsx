import React from 'react';
import { View, StyleSheet } from 'react-native';
import { WorkoutCard } from './WorkoutCard';
import { MetricCard } from './MetricCard';

export function MetricsBenito({ workoutStatus = 'awaiting', data = {} }) {
  return (
    <View style={styles.container}>
      {/* Featured Workout Card - Full Width */}
      <View style={styles.workoutWrapper}>
        <WorkoutCard
          status={workoutStatus}
          scheduledTime={data.scheduledTime || '6:00 PM'}
          workoutName={data.workoutName || 'Upper Body Strength'}
          duration={data.duration || '52 min'}
          focus={data.focus || 'Push / Chest'}
          intensity={data.intensity || 'High'}
        />
      </View>

      {/* Metrics Grid - Benito Layout */}
      <View style={styles.metricsGrid}>
        {/* Row 1: Energy, Stress, Steps (2x1) */}
        <View style={styles.row}>
          <View style={styles.metricCol1x1}>
            <MetricCard
              label="Energy / 5"
              value={data.energy ?? null}
              metricColor="#FCD34D"
              metricName="energy"
              hint="No data"
            />
          </View>
          <View style={styles.metricCol1x1}>
            <MetricCard
              label="Stress / 5"
              value={data.stress ?? null}
              metricColor="#FF6B9D"
              metricName="stress"
              hint="No data"
            />
          </View>
          <View style={styles.metricCol2x1}>
            <MetricCard
              label="Steps Today"
              value={data.steps ?? null}
              unit="steps"
              metricColor="#06B6D4"
              metricName="steps"
              size="lg"
              trend={data.steps && data.steps > 8000 ? 'up' : null}
              hint="Awaiting sync"
            />
          </View>
        </View>

        {/* Row 2: Soreness, Body Fat, Mood (2x1) */}
        <View style={styles.row}>
          <View style={styles.metricCol1x1}>
            <MetricCard
              label="Soreness / 5"
              value={data.soreness ?? null}
              metricColor="#FF6B9D"
              metricName="soreness"
              hint="No data"
            />
          </View>
          <View style={styles.metricCol1x1}>
            <MetricCard
              label="Body Fat %"
              value={data.bodyFat ?? null}
              unit="%"
              metricColor="#F97316"
              metricName="bodyFat"
              hint="No data"
            />
          </View>
          <View style={styles.metricCol2x1}>
            <MetricCard
              label="Mood Check-in"
              value={data.mood ?? null}
              unit="/ 5"
              metricColor="#10B981"
              metricName="mood"
              size="lg"
              trend={data.mood && data.mood >= 4 ? 'up' : null}
              hint="Awaiting check-in"
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  workoutWrapper: {
    width: '100%',
  },
  metricsGrid: {
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCol1x1: {
    flex: 1,
    minHeight: 140,
  },
  metricCol2x1: {
    flex: 1,
    minHeight: 140,
  },
});
