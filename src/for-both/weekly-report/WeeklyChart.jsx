// Sleep (or metric) bar chart for one week — solid bars, dashed empty days, goal line.
// Flow: measure width → normalize day slots → draw hour grid, goal line, then each day’s bar.
// Used inside WeeklyReportBody sleep-trend card. Parent passes days[].

import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const CHART_HEIGHT = 170;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const DEFAULT_AXIS_CEILING = 9;
const SLEEP_GOAL_HOURS = 8;
const BAR_CORNER_RADIUS = 2;
const EMPTY_DAY_BAR_HEIGHT = 18;
const FALLBACK_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Manipulate here: which hour labels appear on the left axis (filtered to axis max).
const HOUR_GRID_LABELS = [0, 3, 6, 9];

// Manipulate here: bar width as a fraction of each day column.
const BAR_WIDTH_FRACTION_OF_SLOT = 0.55;
const MIN_BAR_WIDTH = 12;

// ===== HELPER FUNCTIONS =====

/**
 * Read sleepHours from a day object. Missing / non-numeric becomes 0.
 * Exported alias `daySleepHours` is kept for older imports.
 * @param {object} day
 * @returns {number}
 */
function readSleepHoursFromDay(day) {
  if (!day) return 0;
  return Number(day.sleepHours) || 0;
}

/**
 * Map hours on the Y axis to an SVG y pixel (0 at top of the plot).
 * @param {number} hours
 * @param {number} axisMax
 * @param {number} plotTop
 * @param {number} plotHeight
 * @returns {number}
 */
function verticalPositionForHours(hours, axisMax, plotTop, plotHeight) {
  const clampedHours = Math.max(0, Math.min(axisMax, hours));
  const fractionFromBottom = clampedHours / axisMax;
  return plotTop + plotHeight - fractionFromBottom * plotHeight;
}

function hourLabelsWithinAxis(axisMax) {
  return HOUR_GRID_LABELS.filter((hourLabel) => hourLabel <= axisMax);
}

/**
 * Attach chartValue + shortLabel so the SVG loop never digs into raw day shape.
 * @param {object[]|null|undefined} rawDays
 * @param {string} metricKey
 * @returns {object[]}
 */
function enrichDaysForChart(rawDays, metricKey) {
  const dayList = rawDays || [];
  const enrichedDays = [];
  for (let dayIndex = 0; dayIndex < dayList.length; dayIndex += 1) {
    const day = dayList[dayIndex];
    const fallbackLabel = FALLBACK_DAY_LABELS[dayIndex] || '';
    enrichedDays.push({
      ...day,
      chartValue: Number(day[metricKey]) || 0,
      shortLabel: day.shortLabel || fallbackLabel,
    });
  }
  return enrichedDays;
}

/**
 * How tall the Y axis must be. Props override; otherwise max of ceiling, data, and goal.
 * @param {object[]} chartDays
 * @param {number|undefined} maxValueProp
 * @param {number} goalHours
 * @returns {number}
 */
function computeAxisMaximum(chartDays, maxValueProp, goalHours) {
  if (maxValueProp) return maxValueProp;
  let peakDayValue = 0;
  for (const day of chartDays) {
    if (day.chartValue > peakDayValue) peakDayValue = day.chartValue;
  }
  return Math.max(DEFAULT_AXIS_CEILING, peakDayValue, goalHours);
}

/**
 * Plot width, slot size, and bar width once onLayout has a real width.
 * @param {number} layoutWidth
 * @param {object[]} chartDays
 * @returns {{ plotWidth: number, plotHeight: number, plotBottom: number, slotWidth: number, barWidth: number }}
 */
function slotGeometry(layoutWidth, chartDays) {
  const plotWidth = Math.max(0, layoutWidth - PAD_LEFT - PAD_RIGHT);
  const plotHeight = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const plotBottom = PAD_TOP + plotHeight;
  const dayCount = Math.max(chartDays.length, 1);
  const slotWidth = plotWidth / dayCount;
  const barWidth = Math.max(MIN_BAR_WIDTH, slotWidth * BAR_WIDTH_FRACTION_OF_SLOT);
  return { plotWidth, plotHeight, plotBottom, slotWidth, barWidth };
}

/**
 * Horizontal center and left edge of one day’s bar.
 * @param {number} dayIndex
 * @param {number} slotWidth
 * @param {number} barWidth
 * @returns {{ centerX: number, barX: number }}
 */
function barPositionInSlot(dayIndex, slotWidth, barWidth) {
  const centerX = PAD_LEFT + slotWidth * dayIndex + slotWidth / 2;
  const barX = centerX - barWidth / 2;
  return { centerX, barX };
}

// ===== SMALL SVG PIECES =====

/**
 * Dashed horizontal grid line plus left-axis number for one hour tick.
 */
function ChartHourGridRow({
  hourLabel,
  axisMax,
  plotTop,
  plotHeight,
  chartWidth,
  borderColor,
  mutedTextColor,
}) {
  const lineY = verticalPositionForHours(hourLabel, axisMax, plotTop, plotHeight);
  const labelX = PAD_LEFT - 6;
  const labelY = lineY + 4;
  const lineEndX = chartWidth - PAD_RIGHT;

  return (
    <React.Fragment>
      <Line
        x1={PAD_LEFT}
        x2={lineEndX}
        y1={lineY}
        y2={lineY}
        stroke={borderColor}
        strokeWidth={1}
        strokeDasharray="4 4"
        opacity={0.35}
      />
      <SvgText
        x={labelX}
        y={labelY}
        fill={mutedTextColor}
        fontSize="11"
        fontWeight="700"
        textAnchor="end"
      >
        {String(hourLabel)}
      </SvgText>
    </React.Fragment>
  );
}

/**
 * Weekday letter under a bar (shared by empty and filled days).
 */
function ChartDayLabel({ centerX, shortLabel, mutedTextColor }) {
  const labelY = CHART_HEIGHT - 8;
  return (
    <SvgText
      x={centerX}
      y={labelY}
      fill={mutedTextColor}
      fontSize="12"
      fontWeight="700"
      textAnchor="middle"
    >
      {shortLabel}
    </SvgText>
  );
}

/**
 * Rest day — short dashed hollow bar hugging the baseline.
 */
function ChartEmptyDayBar({
  day,
  barX,
  barWidth,
  plotBottom,
  centerX,
  borderColor,
  mutedTextColor,
}) {
  const barY = plotBottom - EMPTY_DAY_BAR_HEIGHT;

  return (
    <React.Fragment>
      <Rect
        x={barX}
        y={barY}
        width={barWidth}
        height={EMPTY_DAY_BAR_HEIGHT}
        rx={BAR_CORNER_RADIUS}
        fill="transparent"
        stroke={borderColor}
        strokeWidth={nb.borderWidthDivider}
        strokeDasharray="4 3"
      />
      <ChartDayLabel
        centerX={centerX}
        shortLabel={day.shortLabel}
        mutedTextColor={mutedTextColor}
      />
    </React.Fragment>
  );
}

/**
 * Logged value — solid fill from baseline up to the hour height.
 */
function ChartFilledDayBar({
  day,
  barX,
  barWidth,
  plotTop,
  plotBottom,
  plotHeight,
  axisMax,
  centerX,
  fillColor,
  mutedTextColor,
}) {
  const topY = verticalPositionForHours(day.chartValue, axisMax, plotTop, plotHeight);
  const barHeight = Math.max(2, plotBottom - topY);

  return (
    <React.Fragment>
      <Rect
        x={barX}
        y={topY}
        width={barWidth}
        height={barHeight}
        rx={BAR_CORNER_RADIUS}
        fill={fillColor}
      />
      <ChartDayLabel
        centerX={centerX}
        shortLabel={day.shortLabel}
        mutedTextColor={mutedTextColor}
      />
    </React.Fragment>
  );
}

/**
 * One day column: empty dashed stub or solid bar, based on chartValue.
 */
function ChartDayColumn({
  day,
  dayIndex,
  slotWidth,
  barWidth,
  plotTop,
  plotBottom,
  plotHeight,
  axisMax,
  borderColor,
  fillColor,
  mutedTextColor,
}) {
  const { centerX, barX } = barPositionInSlot(dayIndex, slotWidth, barWidth);
  const hasLoggedValue = day.chartValue > 0;

  if (!hasLoggedValue) {
    return (
      <ChartEmptyDayBar
        day={day}
        barX={barX}
        barWidth={barWidth}
        plotBottom={plotBottom}
        centerX={centerX}
        borderColor={borderColor}
        mutedTextColor={mutedTextColor}
      />
    );
  }

  return (
    <ChartFilledDayBar
      day={day}
      barX={barX}
      barWidth={barWidth}
      plotTop={plotTop}
      plotBottom={plotBottom}
      plotHeight={plotHeight}
      axisMax={axisMax}
      centerX={centerX}
      fillColor={fillColor}
      mutedTextColor={mutedTextColor}
    />
  );
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
  // vocab: useTheme = report color tokens (border / fill / muted text) for light + dark
  const { colors } = useTheme();
  // vocab: useState + onLayout = measure the View width before we draw SVG at that size
  const [layoutWidth, setLayoutWidth] = useState(0);

  // 1. Normalize each day for the active metric and weekday label.
  // vocab: useMemo = recompute only when days or metricKey change
  const chartDays = useMemo(
    () => enrichDaysForChart(days, metricKey),
    [days, metricKey],
  );

  // 2. Decide how tall the Y axis must be (props override, else data-driven).
  const axisMax = computeAxisMaximum(chartDays, maxValue, goalHours);

  // 3. Geometry only matters after onLayout gives us a real width.
  const hasMeasuredWidth = layoutWidth > 0;
  const { plotHeight, plotBottom, slotWidth, barWidth } = slotGeometry(
    layoutWidth,
    chartDays,
  );
  const plotTop = PAD_TOP;
  const goalLineY = verticalPositionForHours(goalHours, axisMax, plotTop, plotHeight);
  const hourTicks = hourLabelsWithinAxis(axisMax);
  const goalLineEndX = layoutWidth - PAD_RIGHT;

  const borderColor = colors.border;
  const fillColor = colors.fill;
  const mutedTextColor = colors.textMuted;

  // 4. Remember width from layout so the next paint can draw SVG.
  function rememberLayoutWidth(event) {
    setLayoutWidth(event.nativeEvent.layout.width);
  }

  // 5. Shell: measure width, then paint SVG when we know it.
  return (
    <View
      style={styles.container}
      onLayout={rememberLayoutWidth}
      testID="weekly-chart"
    >
      {hasMeasuredWidth ? (
        <Svg width={layoutWidth} height={CHART_HEIGHT}>
          {hourTicks.map((hourLabel) => (
            <ChartHourGridRow
              key={`grid-${hourLabel}`}
              hourLabel={hourLabel}
              axisMax={axisMax}
              plotTop={plotTop}
              plotHeight={plotHeight}
              chartWidth={layoutWidth}
              borderColor={borderColor}
              mutedTextColor={mutedTextColor}
            />
          ))}

          <Line
            x1={PAD_LEFT}
            x2={goalLineEndX}
            y1={goalLineY}
            y2={goalLineY}
            stroke={borderColor}
            strokeWidth={nb.borderWidthDivider}
            strokeDasharray="6 5"
          />

          {chartDays.map((day, dayIndex) => (
            <ChartDayColumn
              key={`day-${dayIndex}`}
              day={day}
              dayIndex={dayIndex}
              slotWidth={slotWidth}
              barWidth={barWidth}
              plotTop={plotTop}
              plotBottom={plotBottom}
              plotHeight={plotHeight}
              axisMax={axisMax}
              borderColor={borderColor}
              fillColor={fillColor}
              mutedTextColor={mutedTextColor}
            />
          ))}
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

// PLUMBING — skip unless debugging: legacy imports still expect these names.
export { readSleepHoursFromDay as daySleepHours, SLEEP_GOAL_HOURS };
