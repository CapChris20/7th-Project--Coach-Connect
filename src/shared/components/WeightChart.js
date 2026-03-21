// Weight Chart Component
// Displays weight trend over time
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../ui/ThemeContext';

const { width } = Dimensions.get('window');
const CHART_HEIGHT = 200;
const CHART_WIDTH = width - 64; // Account for padding

export default function WeightChart({ data = [] }) {
  const { colors, spacing, isDark } = useTheme();
  
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} selectable={true}>No weight data available</Text>
      </View>
    );
  }

  // Find min and max weight for scaling
  const weights = data.map(d => d.weight).filter(w => w > 0);
  if (weights.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText} selectable={true}>No valid weight data</Text>
      </View>
    );
  }

  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const weightRange = maxWeight - minWeight || 1; // Avoid division by zero

  // Sort data by date
  const sortedData = [...data].sort((a, b) => {
    const dateA = a.date instanceof Date ? a.date : new Date(a.date);
    const dateB = b.date instanceof Date ? b.date : new Date(b.date);
    return dateA - dateB;
  });

  // Calculate points for line chart
  const points = sortedData.map((entry, index) => {
    const x = (index / (sortedData.length - 1 || 1)) * CHART_WIDTH;
    const normalizedWeight = (entry.weight - minWeight) / weightRange;
    const y = CHART_HEIGHT - (normalizedWeight * (CHART_HEIGHT - 40)) - 20; // Leave space for labels
    return { x, y, weight: entry.weight, date: entry.date };
  });

  const styles = StyleSheet.create({
    container: {
      height: CHART_HEIGHT + 60,
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
    },
    chartContainer: {
      height: CHART_HEIGHT,
      position: 'relative',
    },
    axisLabel: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    yAxisLabels: {
      position: 'absolute',
      left: 0,
      top: 0,
      height: CHART_HEIGHT,
      justifyContent: 'space-between',
      width: 40,
    },
    xAxisLabels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: spacing.xs,
      paddingHorizontal: 20,
    },
    line: {
      position: 'absolute',
      top: 0,
      left: 20,
      height: CHART_HEIGHT,
    },
    emptyContainer: {
      height: CHART_HEIGHT,
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

  // Generate Y-axis labels
  const yLabels = [];
  for (let i = 0; i <= 4; i++) {
    const value = maxWeight - (i / 4) * weightRange;
    yLabels.push(value.toFixed(1));
  }

  // Format date for X-axis
  const formatDateShort = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Generate X-axis labels (show first, middle, last)
  const xLabels = [];
  if (sortedData.length > 0) {
    xLabels.push(formatDateShort(sortedData[0].date));
    if (sortedData.length > 2) {
      xLabels.push(formatDateShort(sortedData[Math.floor(sortedData.length / 2)].date));
    }
    if (sortedData.length > 1) {
      xLabels.push(formatDateShort(sortedData[sortedData.length - 1].date));
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} selectable={true}>Weight Trend</Text>
      <View style={styles.chartContainer}>
        {/* Y-axis labels */}
        <View style={styles.yAxisLabels}>
          {yLabels.map((label, index) => (
            <Text key={index} style={styles.axisLabel} selectable={true}>
              {label}
            </Text>
          ))}
        </View>

        {/* Line chart */}
        <View style={styles.line}>
          {points.map((point, index) => {
            if (index === 0) return null;
            const prevPoint = points[index - 1];
            const distance = Math.sqrt(
              Math.pow(point.x - prevPoint.x, 2) + Math.pow(point.y - prevPoint.y, 2)
            );
            const angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * (180 / Math.PI);

            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: prevPoint.x,
                  top: prevPoint.y,
                  width: distance,
                  height: 2,
                  backgroundColor: colors.primary,
                  transform: [{ rotate: `${angle}deg` }],
                  transformOrigin: 'left center',
                }}
              />
            );
          })}

          {/* Data points */}
          {points.map((point, index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: point.x - 4,
                top: point.y - 4,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.primary,
              }}
            />
          ))}
        </View>

        {/* X-axis labels */}
        <View style={styles.xAxisLabels}>
          {xLabels.map((label, index) => (
            <Text key={index} style={[styles.axisLabel, { flex: 1, textAlign: index === 0 ? 'left' : index === xLabels.length - 1 ? 'right' : 'center' }]} selectable={true}>
              {label}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}









