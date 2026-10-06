// One week as a smooth line chart (sleep, steps, calories, or any numeric day field).
// Flow: measure the width → scale each day onto the chart → draw the curve → tap a point for the value.
// Used by the weekly report sleep card. The parent supplies the days and which field to plot.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Path,
  Circle,
  Line,
} from 'react-native-svg';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { GRADIENTS, useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const CHART_HEIGHT = 200;
const CHART_PAD_X = 24;
const CHART_PAD_TOP = 24;
const CHART_PAD_BOTTOM = 32;
// Manipulate here: how long the line takes to draw in when the week changes.
const CHART_DRAW_MS = 1100;
const SLEEP_AXIS_FLOOR = 10;
const CALORIE_AXIS_FLOOR = 2500;
const CALORIE_AXIS_STEP = 100;
const OTHER_METRIC_HEADROOM = 1.15;
// Manipulate here: smaller divisor = tighter curves. 6 is the Catmull-Rom-style tension used here.
const SMOOTH_CURVE_DIVISOR = 6;
const PATH_LENGTH_FUDGE = 1.4;
const STEPS_THOUSAND_CUTOFF = 1000;
const SLEEP_METRIC_KEY = 'sleepHours';
const CALORIE_METRIC_KEY = 'calories';
const STEPS_METRIC_KEY = 'steps';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ===== HELPER FUNCTIONS =====

function mapDaysToChartValues(days, metricKey) {
  return days.map((day) => ({
    ...day,
    chartValue: Number(day[metricKey]) || 0,
  }));
}

function resolveChartMaxValue(metricKey, chartDays, maxValueProp) {
  if (maxValueProp) return maxValueProp;
  const peak = Math.max(...chartDays.map((day) => day.chartValue), 0);
  if (metricKey === SLEEP_METRIC_KEY) return Math.max(SLEEP_AXIS_FLOOR, Math.ceil(peak));
  if (metricKey === CALORIE_METRIC_KEY) {
    return Math.max(CALORIE_AXIS_FLOOR, Math.ceil(peak / CALORIE_AXIS_STEP) * CALORIE_AXIS_STEP);
  }
  return Math.max(peak * OTHER_METRIC_HEADROOM, 1);
}

function mapChartPoints(chartDays, width, maxValue) {
  if (!width) return [];
  const innerWidth = width - CHART_PAD_X * 2;
  const innerHeight = CHART_HEIGHT - CHART_PAD_TOP - CHART_PAD_BOTTOM;
  const lastIndex = Math.max(1, chartDays.length - 1);
  return chartDays.map((day, index) => {
    const x = CHART_PAD_X + (innerWidth * index) / lastIndex;
    const y = CHART_PAD_TOP + innerHeight - (day.chartValue / maxValue) * innerHeight;
    return { x, y, day };
  });
}

// Smooth cubic segments between points. Endpoints reuse the nearest point when a neighbor is missing.
function buildSmoothLinePath(points) {
  if (points.length < 2) return '';
  let pathCommand = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index++) {
    const previousPoint = points[index - 1] ?? points[index];
    const currentPoint = points[index];
    const nextPoint = points[index + 1];
    const pointAfterNext = points[index + 2] ?? nextPoint;
    const firstControlX = currentPoint.x + (nextPoint.x - previousPoint.x) / SMOOTH_CURVE_DIVISOR;
    const firstControlY = currentPoint.y + (nextPoint.y - previousPoint.y) / SMOOTH_CURVE_DIVISOR;
    const secondControlX = nextPoint.x - (pointAfterNext.x - currentPoint.x) / SMOOTH_CURVE_DIVISOR;
    const secondControlY = nextPoint.y - (pointAfterNext.y - currentPoint.y) / SMOOTH_CURVE_DIVISOR;
    pathCommand += ` C ${firstControlX} ${firstControlY}, ${secondControlX} ${secondControlY}, ${nextPoint.x} ${nextPoint.y}`;
  }
  return pathCommand;
}

function buildAreaFillPath(linePath, points) {
  if (!linePath || points.length < 2) return '';
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const baselineY = CHART_HEIGHT - CHART_PAD_BOTTOM;
  return `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;
}

function formatTooltipValue(metricKey, value) {
  if (metricKey === STEPS_METRIC_KEY && value >= STEPS_THOUSAND_CUTOFF) {
    return `${(value / STEPS_THOUSAND_CUTOFF).toFixed(1)}k`;
  }
  return String(value);
}

function estimatedPathLength(width) {
  return (width - CHART_PAD_X * 2) * PATH_LENGTH_FUDGE;
}

// ===== MAIN FUNCTION =====

/**
 * Smooth weekly line chart.
 * @param {object} props
 * @param {object[]} props.days
 * @param {string} [props.metricKey] day field to plot (sleepHours, steps, calories)
 * @param {string} [props.title] chart header title (kept for callers; the parent draws the title)
 * @param {string} [props.legend] legend label (kept for callers; the parent draws the legend)
 * @param {string} [props.valueSuffix] tooltip suffix (h, cal, and so on)
 * @param {number} [props.maxValue] Y-axis max; auto if omitted
 */
export function WeeklyChart({
  days,
  metricKey = 'sleepHours',
  title: _title = 'This week',
  legend: _legend = 'Sleep / h',
  valueSuffix = 'h',
  maxValue: maxValueProp,
}) {
  const { colors, mode } = useTheme();
  const [width, setWidth] = useState(0);
  const [activePointIndex, setActivePointIndex] = useState(null);
  const progress = useSharedValue(0);

  // Restart the draw animation when the week or the plotted field changes.
  // vocab: useSharedValue = a Reanimated value the UI thread can read without a React render.
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: CHART_DRAW_MS, easing: Easing.out(Easing.cubic) });
  }, [days, metricKey, progress]);

  const chartDays = useMemo(
    () => mapDaysToChartValues(days, metricKey),
    [days, metricKey],
  );

  const maxValue = useMemo(
    () => resolveChartMaxValue(metricKey, chartDays, maxValueProp),
    [chartDays, maxValueProp, metricKey],
  );

  const points = useMemo(
    () => mapChartPoints(chartDays, width, maxValue),
    [chartDays, width, maxValue],
  );

  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);

  const fillPath = useMemo(
    () => buildAreaFillPath(linePath, points),
    [linePath, points],
  );

  const [pathLength, setPathLength] = useState(0);
  // vocab: useAnimatedProps = drive an SVG prop from the shared progress value.
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - progress.value),
  }));

  const handlePointPress = (pointIndex) => {
    Haptics.selectionAsync().catch(() => {});
    setActivePointIndex((previousIndex) => (previousIndex === pointIndex ? null : pointIndex));
  };

  const activePoint = activePointIndex !== null ? points[activePointIndex] : null;

  return (
    <View
      style={styles.container}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      testID="weekly-chart"
    >
      {width > 0 && (
        <Svg width={width} height={CHART_HEIGHT}>
          <Defs>
            <SvgLinearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={GRADIENTS.g1[0]} />
              <Stop offset="1" stopColor={GRADIENTS.g1[1]} />
            </SvgLinearGradient>
            <SvgLinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={GRADIENTS.g1[1]} stopOpacity="0.35" />
              <Stop offset="1" stopColor={GRADIENTS.g1[0]} stopOpacity="0" />
            </SvgLinearGradient>
          </Defs>

          <Path d={fillPath} fill="url(#fillGrad)" />

          <AnimatedPath
            d={linePath}
            stroke="url(#lineGrad)"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={pathLength || 1}
            animatedProps={animatedProps}
            onLayout={() => setPathLength(estimatedPathLength(width))}
          />

          {activePoint && (
            <Line
              x1={activePoint.x}
              y1={CHART_PAD_TOP}
              x2={activePoint.x}
              y2={CHART_HEIGHT - CHART_PAD_BOTTOM}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.4}
            />
          )}

          {points.map((point, pointIndex) => {
            const isActivePoint = activePointIndex === pointIndex;
            return (
              <Circle
                key={pointIndex}
                cx={point.x}
                cy={point.y}
                r={isActivePoint ? 8 : 5}
                fill={mode === 'dark' ? '#12121c' : '#ffffff'}
                stroke={isActivePoint ? GRADIENTS.g1[1] : GRADIENTS.g1[0]}
                strokeWidth={isActivePoint ? 3 : 2}
              />
            );
          })}
        </Svg>
      )}

      <View style={[StyleSheet.absoluteFill, styles.pressLayer]} pointerEvents="box-none">
        {points.map((point, pointIndex) => (
          <Pressable
            key={pointIndex}
            testID={`chart-data-point-${pointIndex}`}
            onPress={() => handlePointPress(pointIndex)}
            style={{
              position: 'absolute',
              left: point.x - 22,
              top: point.y - 22,
              width: 44,
              height: 44,
            }}
          />
        ))}
      </View>

      {activePoint && (
        <View
          style={[
            styles.tooltip,
            {
              left: Math.max(8, Math.min(width - 140, activePoint.x - 70)),
              top: Math.max(0, activePoint.y - 64),
              backgroundColor: mode === 'dark' ? 'rgba(30,30,45,0.95)' : 'rgba(255,255,255,0.98)',
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.tooltipDay, { color: colors.textMuted }]}>
            {activePoint.day.dayName}
          </Text>
          <Text style={[styles.tooltipValue, { color: colors.textPrimary }]}>
            {formatTooltipValue(metricKey, activePoint.day.chartValue)}
            <Text style={{ color: colors.textMuted, fontSize: 12 }}> {valueSuffix}</Text>
          </Text>
        </View>
      )}

      <View style={styles.xAxis}>
        {chartDays.map((day, pointIndex) => (
          <Text
            key={pointIndex}
            style={[
              styles.xLabel,
              {
                color: activePointIndex === pointIndex ? colors.textPrimary : colors.textMuted,
                fontWeight: activePointIndex === pointIndex ? '700' : '500',
              },
            ]}
          >
            {day.shortLabel}
          </Text>
        ))}
      </View>
    </View>
  );
}

export { WeeklyChart as default };

const styles = StyleSheet.create({
  container: { height: 230, width: '100%' },
  pressLayer: {},
  tooltip: {
    position: 'absolute',
    width: 140,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  tooltipDay: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  tooltipValue: { fontSize: 16, fontWeight: '700', marginTop: 2 },
  xAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginTop: 4,
  },
  xLabel: { fontSize: 12, width: 24, textAlign: 'center' },
});
