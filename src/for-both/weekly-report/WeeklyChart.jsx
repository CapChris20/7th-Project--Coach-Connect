// Design Law sleep-trend bar chart — solid fill bars, dashed empty day, goal line (progress PNG).
// Flow: measure width → scale each day’s sleepHours → draw bars + Goal 8 h line.
// Used by WeeklyReportBody sleep-trend card. Parent supplies days[].

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const CHART_HEIGHT = 170;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const SLEEP_AXIS_MAX = 9;
const SLEEP_GOAL_HOURS = 8;
const BAR_RX = 2;
const EMPTY_BAR_HEIGHT = 18;
const SHORT_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// ===== HELPER FUNCTIONS =====

function daySleepHours(day) {
  return Number(day?.sleepHours) || 0;
}

function yForHours(hours, maxHours, plotTop, plotHeight) {
  const clamped = Math.max(0, Math.min(maxHours, hours));
  return plotTop + plotHeight - (clamped / maxHours) * plotHeight;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   days: object[],
 *   metricKey?: string,
 *   valueSuffix?: string,
 *   maxValue?: number,
 *   goalHours?: number,
 * }} props
 */
export function WeeklyChart({
  days,
  metricKey = 'sleepHours',
  valueSuffix: _valueSuffix = 'h',
  maxValue,
  goalHours = SLEEP_GOAL_HOURS,
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);

  const chartDays = useMemo(
    () =>
      (days || []).map((day, index) => ({
        ...day,
        chartValue: Number(day[metricKey]) || 0,
        shortLabel: day.shortLabel || SHORT_LABELS[index] || '',
      })),
    [days, metricKey],
  );

  const axisMax = maxValue || Math.max(SLEEP_AXIS_MAX, ...chartDays.map((d) => d.chartValue), goalHours);

  const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const plotBottom = PAD_TOP + plotHeight;
  const barCount = Math.max(chartDays.length, 1);
  const slot = plotWidth / barCount;
  // Manipulate here: bar width relative to day slot
  const barWidth = Math.max(12, slot * 0.55);

  const goalY = yForHours(goalHours, axisMax, PAD_TOP, plotHeight);
  const ticks = [0, 3, 6, 9].filter((t) => t <= axisMax);

  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID="weekly-chart"
    >
      {width > 0 ? (
        <Svg width={width} height={CHART_HEIGHT}>
          {ticks.map((tick) => {
            const y = yForHours(tick, axisMax, PAD_TOP, plotHeight);
            return (
              <React.Fragment key={`tick-${tick}`}>
                <Line
                  x1={PAD_LEFT}
                  x2={width - PAD_RIGHT}
                  y1={y}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.35}
                />
                <SvgText
                  x={PAD_LEFT - 6}
                  y={y + 4}
                  fill={colors.textMuted}
                  fontSize="11"
                  fontWeight="700"
                  textAnchor="end"
                >
                  {String(tick)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Goal line — dashed, Design Law “Goal 8 h” */}
          <Line
            x1={PAD_LEFT}
            x2={width - PAD_RIGHT}
            y1={goalY}
            y2={goalY}
            stroke={colors.border}
            strokeWidth={nb.borderWidthDivider}
            strokeDasharray="6 5"
          />

          {chartDays.map((day, index) => {
            const cx = PAD_LEFT + slot * index + slot / 2;
            const x = cx - barWidth / 2;
            const hasValue = day.chartValue > 0;
            if (!hasValue) {
              // Empty / rest day — dashed hollow box near baseline
              const y = plotBottom - EMPTY_BAR_HEIGHT;
              return (
                <React.Fragment key={`bar-${index}`}>
                  <Rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={EMPTY_BAR_HEIGHT}
                    rx={BAR_RX}
                    fill="transparent"
                    stroke={colors.border}
                    strokeWidth={nb.borderWidthDivider}
                    strokeDasharray="4 3"
                  />
                  <SvgText
                    x={cx}
                    y={CHART_HEIGHT - 8}
                    fill={colors.textMuted}
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {day.shortLabel}
                  </SvgText>
                </React.Fragment>
              );
            }
            const y = yForHours(day.chartValue, axisMax, PAD_TOP, plotHeight);
            const height = Math.max(2, plotBottom - y);
            return (
              <React.Fragment key={`bar-${index}`}>
                <Rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={height}
                  rx={BAR_RX}
                  fill={colors.fill}
                />
                <SvgText
                  x={cx}
                  y={CHART_HEIGHT - 8}
                  fill={colors.textMuted}
                  fontSize="12"
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {day.shortLabel}
                </SvgText>
              </React.Fragment>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}

export { WeeklyChart as default };

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: CHART_HEIGHT,
    marginTop: spacing.xs,
  },
});

// Keep helper export for callers that still import daySleepHours indirectly
export { daySleepHours, SLEEP_GOAL_HOURS };
