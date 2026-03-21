// Progress Chart Component
// Displays progress metrics (weight, body fat, measurements)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ui/ThemeContext';

export default function ProgressChart({ data = [], metric = 'weight' }) {
  const { colors, spacing, isDark } = useTheme();

  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} selectable={true}>No progress data available</Text>
      </View>
    );
  }

  // Filter and sort data
  const filteredData = data
    .filter(entry => {
      if (metric === 'weight') return entry.weight != null;
      if (metric === 'bodyFat') return entry.bodyFat != null;
      if (metric === 'chest') return entry.chest != null;
      if (metric === 'arms') return entry.arms != null;
      if (metric === 'waist') return entry.waist != null;
      return false;
    })
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || a.createdAt || new Date(0);
      const dateB = b.createdAt?.toDate?.() || b.createdAt || new Date(0);
      return dateA - dateB;
    });

  if (filteredData.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} selectable={true}>No {metric} data available</Text>
      </View>
    );
  }

  // Get values for selected metric
  const values = filteredData.map(entry => {
    if (metric === 'weight') return entry.weight;
    if (metric === 'bodyFat') return entry.bodyFat;
    if (metric === 'chest') return entry.chest;
    if (metric === 'arms') return entry.arms;
    if (metric === 'waist') return entry.waist;
    return 0;
  });

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const styles = StyleSheet.create({
    container: {
      backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)',
      borderRadius: 16,
      padding: spacing.md,
      marginVertical: spacing.sm,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
      textTransform: 'capitalize',
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginTop: spacing.md,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    barsContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: 150,
      marginTop: spacing.md,
      paddingHorizontal: spacing.xs,
    },
    bar: {
      flex: 1,
      marginHorizontal: 2,
      borderRadius: 4,
      backgroundColor: colors.primary,
      minHeight: 4,
    },
    emptyContainer: {
      height: 100,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(30, 27, 46, 0.3)' : 'rgba(255, 255, 255, 0.3)',
      borderRadius: 16,
      padding: spacing.md,
    },
    emptyText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
  });

  // Get latest and previous values
  const latestValue = values[values.length - 1];
  const previousValue = values.length > 1 ? values[values.length - 2] : latestValue;
  const change = latestValue - previousValue;
  const changePercent = previousValue !== 0 ? ((change / previousValue) * 100).toFixed(1) : 0;

  // Get unit for metric
  const getUnit = () => {
    if (metric === 'weight') return 'lbs';
    if (metric === 'bodyFat') return '%';
    return 'in';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} selectable={true}>{metric.replace(/([A-Z])/g, ' $1').trim()}</Text>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue} selectable={true}>{latestValue.toFixed(1)}</Text>
          <Text style={styles.statLabel} selectable={true}>Current</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: change >= 0 ? '#10B981' : '#EF4444' }]} selectable={true}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}
          </Text>
          <Text style={styles.statLabel} selectable={true}>Change</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue} selectable={true}>{filteredData.length}</Text>
          <Text style={styles.statLabel} selectable={true}>Entries</Text>
        </View>
      </View>

      {/* Simple bar chart */}
      <View style={styles.barsContainer}>
        {values.map((value, index) => {
          const normalizedHeight = ((value - minValue) / valueRange) * 100;
          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: `${Math.max(normalizedHeight, 5)}%`,
                  opacity: index === values.length - 1 ? 1 : 0.6,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}









