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
import { GRADIENTS, useTheme } from '../theme/WeeklyReportThemeContext';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * @param {object} props
 * @param {object[]} props.days
 * @param {string} props.metricKey — day field to plot (e.g. sleepHours, steps, calories)
 * @param {string} props.title — chart header title
 * @param {string} props.legend — legend label
 * @param {string} props.valueSuffix — tooltip suffix (h, cal, etc.)
 * @param {number} [props.maxValue] — Y-axis max; auto if omitted
 */
export function WeeklyChart({
  days,
  metricKey = 'sleepHours',
  title = 'This week',
  legend = 'Sleep / h',
  valueSuffix = 'h',
  maxValue: maxValueProp,
}) {
  const { colors, mode } = useTheme();
  const [width, setWidth] = useState(0);
  const height = 200;
  const padX = 24;
  const padTop = 24;
  const padBottom = 32;
  const [activeIdx, setActiveIdx] = useState(null);

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [days, metricKey, progress]);

  const chartDays = useMemo(
    () =>
      days.map((d) => ({
        ...d,
        chartValue: Number(d[metricKey]) || 0,
      })),
    [days, metricKey],
  );

  const maxV = useMemo(() => {
    if (maxValueProp) return maxValueProp;
    const peak = Math.max(...chartDays.map((d) => d.chartValue), 0);
    if (metricKey === 'sleepHours') return Math.max(10, Math.ceil(peak));
    if (metricKey === 'calories') return Math.max(2500, Math.ceil(peak / 100) * 100);
    return Math.max(peak * 1.15, 1);
  }, [chartDays, maxValueProp, metricKey]);

  const points = useMemo(() => {
    if (!width) return [];
    const innerW = width - padX * 2;
    const innerH = height - padTop - padBottom;
    return chartDays.map((d, i) => {
      const x = padX + (innerW * i) / Math.max(1, chartDays.length - 1);
      const y = padTop + innerH - (d.chartValue / maxV) * innerH;
      return { x, y, day: d };
    });
  }, [chartDays, width, maxV]);

  const linePath = useMemo(() => {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i - 1] ?? points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] ?? p2;
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [points]);

  const fillPath = useMemo(() => {
    if (!linePath || points.length < 2) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${linePath} L ${last.x} ${height - padBottom} L ${first.x} ${height - padBottom} Z`;
  }, [linePath, points, height, padBottom]);

  const [pathLength, setPathLength] = useState(0);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - progress.value),
  }));

  const handlePointPress = (i) => {
    Haptics.selectionAsync().catch(() => {});
    setActiveIdx((prev) => (prev === i ? null : i));
  };

  const formatTooltipValue = (val) => {
    if (metricKey === 'steps' && val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return String(val);
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      testID="weekly-chart"
    >
      {width > 0 && (
        <Svg width={width} height={height}>
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
            onLayout={() => setPathLength((width - padX * 2) * 1.4)}
          />

          {activeIdx !== null && points[activeIdx] && (
            <Line
              x1={points[activeIdx].x}
              y1={padTop}
              x2={points[activeIdx].x}
              y2={height - padBottom}
              stroke={colors.textMuted}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.4}
            />
          )}

          {points.map((p, i) => {
            const active = activeIdx === i;
            return (
              <Circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={active ? 8 : 5}
                fill={mode === 'dark' ? '#12121c' : '#ffffff'}
                stroke={active ? GRADIENTS.g1[1] : GRADIENTS.g1[0]}
                strokeWidth={active ? 3 : 2}
              />
            );
          })}
        </Svg>
      )}

      <View style={[StyleSheet.absoluteFill, styles.pressLayer]} pointerEvents="box-none">
        {points.map((p, i) => (
          <Pressable
            key={i}
            testID={`chart-data-point-${i}`}
            onPress={() => handlePointPress(i)}
            style={{
              position: 'absolute',
              left: p.x - 22,
              top: p.y - 22,
              width: 44,
              height: 44,
            }}
          />
        ))}
      </View>

      {activeIdx !== null && points[activeIdx] && (
        <View
          style={[
            styles.tooltip,
            {
              left: Math.max(8, Math.min(width - 140, points[activeIdx].x - 70)),
              top: Math.max(0, points[activeIdx].y - 64),
              backgroundColor: mode === 'dark' ? 'rgba(30,30,45,0.95)' : 'rgba(255,255,255,0.98)',
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.tooltipDay, { color: colors.textMuted }]}>
            {points[activeIdx].day.dayName}
          </Text>
          <Text style={[styles.tooltipValue, { color: colors.textPrimary }]}>
            {formatTooltipValue(points[activeIdx].day.chartValue)}
            <Text style={{ color: colors.textMuted, fontSize: 12 }}> {valueSuffix}</Text>
          </Text>
        </View>
      )}

      <View style={styles.xAxis}>
        {chartDays.map((d, i) => (
          <Text
            key={i}
            style={[
              styles.xLabel,
              {
                color: activeIdx === i ? colors.textPrimary : colors.textMuted,
                fontWeight: activeIdx === i ? '700' : '500',
              },
            ]}
          >
            {d.shortLabel}
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
