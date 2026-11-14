// Design Law Progress charts — Weight / Body fat / Lifts (screens/progress PNG 01–04).
// Flow: load dailyLogs series → range filter → line chart + stats → Log weight / empty shells.
// Used by client Go to → Progress. Photos stay on PhotoGallery; this is charts only.
//
// vocab: filterPointsByRange = trims history to 4W / 12W / 6M / All
// vocab: summarizeMetricSeries = start, change, goal progress for the stat row
// Manipulate here: DEFAULT_WEIGHT_GOAL_LB, RECENT_LOG_COUNT, chart padding

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSheet from '../../look-and-feel/NbSheet';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import HardShadow from '../../look-and-feel/HardShadow';
import { accentGradients, nb } from '../../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { auth, db } from '../../app-start/cloudConnection';
import {
  BODY_FAT_FIELD,
  WEIGHT_FIELD,
  fetchMetricHistory,
  filterPointsByRange,
  summarizeMetricSeries,
} from '../../daily-stats/progressMetricHistory';

// ===== NAMED CONSTANTS =====

const TABS = [
  { id: 'weight', label: 'Weight' },
  { id: 'bodyfat', label: 'Body fat' },
  { id: 'lifts', label: 'Lifts' },
];
const RANGES = ['4W', '12W', '6M', 'All'];
const CHART_HEIGHT = 168;
const CHART_PAD_X = 8;
const CHART_PAD_Y = 16;
const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const RECENT_LOG_COUNT = 8;
const SCROLL_BOTTOM_PADDING = 40;
const DELTA_PILL_TEXT_COLOR = '#0A0A0A';
// Manipulate here: default goal when profile has none — matches Progress PNG sample
const DEFAULT_WEIGHT_GOAL_LB = 165;
const Y_AXIS_PAD_FRACTION = 0.12;
const EMPTY_METRIC_PLACEHOLDER = '—';
const TAB_WEIGHT = 'weight';
const TAB_BODY_FAT = 'bodyfat';
const TAB_LIFTS = 'lifts';
const DEFAULT_RANGE_ID = '12W';
const UNIT_POUNDS = 'lb';
const UNIT_PERCENT = '%';

// ===== HELPER FUNCTIONS =====

function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeekdayDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatMetric(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return EMPTY_METRIC_PLACEHOLDER;
  return Number(value).toFixed(decimals);
}

function formatSigned(value, unit, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return EMPTY_METRIC_PLACEHOLDER;
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)} ${unit}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const monthPart = String(date.getMonth() + 1).padStart(2, '0');
  const dayPart = String(date.getDate()).padStart(2, '0');
  return `${year}-${monthPart}-${dayPart}`;
}

function emptyStateCopyForTab(tabId) {
  if (tabId === TAB_LIFTS) {
    return {
      title: 'No lifts logged yet',
      body: 'When you save workout sets with weight, personal records show up here.',
    };
  }
  if (tabId === TAB_BODY_FAT) {
    return {
      title: 'No body fat logs yet',
      body: 'Log a body fat reading and the trend chart fills in.',
    };
  }
  return {
    title: 'No weigh-ins yet',
    body: 'Log your weight and the chart, change, and recent list show up here.',
  };
}

function logButtonLabel(tabId) {
  if (tabId === TAB_BODY_FAT) return 'Log body fat';
  return 'Log weight';
}

function metricUnitForTab(tabId) {
  if (tabId === TAB_BODY_FAT) return UNIT_PERCENT;
  return UNIT_POUNDS;
}

function dailyLogFieldForTab(tabId) {
  if (tabId === TAB_BODY_FAT) return BODY_FAT_FIELD;
  return WEIGHT_FIELD;
}

function buildDeltaBadgeText(summary, unit) {
  if (summary.change == null || !summary.weeksSpan) return null;
  return `${formatSigned(summary.change, unit)} in ${summary.weeksSpan} wk`;
}

function buildStatCards(summary, unit) {
  const goalValue =
    summary.goal != null ? formatMetric(summary.goal) : EMPTY_METRIC_PLACEHOLDER;
  return [
    { label: 'Start', value: formatMetric(summary.start) },
    { label: 'Change', value: formatSigned(summary.change, unit) },
    { label: 'Goal', value: goalValue },
  ];
}

function uniqueLabelIndexes(pointCount) {
  if (pointCount <= 0) return [];
  const firstIndex = 0;
  const middleIndex = Math.floor((pointCount - 1) / 2);
  const lastIndex = pointCount - 1;
  const indexes = [firstIndex, middleIndex, lastIndex];
  const unique = [];
  for (const index of indexes) {
    if (!unique.includes(index)) unique.push(index);
  }
  return unique;
}

// ===== SMALL UI =====

function SegmentTabs({ tabId, onChange, colors }) {
  return (
    <View style={[styles.segRow, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}>
      {TABS.map((tab) => {
        const isSelected = tab.id === tabId;
        const chipBackground = isSelected ? colors.nbFill : 'transparent';
        const chipBorder = isSelected ? colors.nbBorder : 'transparent';
        const labelColor = isSelected ? colors.nbOnFill : colors.nbInk;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[
              styles.segChip,
              {
                backgroundColor: chipBackground,
                borderColor: chipBorder,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: labelColor }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RangeChipButton({ rangeId, isSelected, onChange, colors }) {
  const chipBackground = isSelected ? colors.nbFill : colors.nbSurface;
  const labelColor = isSelected ? colors.nbOnFill : colors.nbInk;

  const chip = (
    <TouchableOpacity
      onPress={() => onChange(rangeId)}
      style={[
        styles.rangeChip,
        {
          backgroundColor: chipBackground,
          borderColor: colors.nbBorder,
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '900', color: labelColor }}>{rangeId}</Text>
    </TouchableOpacity>
  );

  if (isSelected) {
    return (
      <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
        {chip}
      </HardShadow>
    );
  }
  return <View>{chip}</View>;
}

function RangeChips({ rangeId, onChange, colors }) {
  return (
    <View style={styles.rangeRow}>
      {RANGES.map((id) => (
        <RangeChipButton
          key={id}
          rangeId={id}
          isSelected={id === rangeId}
          onChange={onChange}
          colors={colors}
        />
      ))}
    </View>
  );
}

function dashedGuideYForLastValue(lastValue, yMin, yMax) {
  const rangeSpan = yMax - yMin;
  let valueRatio = 0;
  if (rangeSpan !== 0) {
    valueRatio = (lastValue - yMin) / rangeSpan;
  }
  const plotHeight = CHART_HEIGHT - CHART_PAD_Y * 2;
  const distanceFromTop = plotHeight * (1 - valueRatio);
  return CHART_PAD_Y + distanceFromTop;
}

function MetricLineChart({ points, colors, width }) {
  const chartGeometry = useMemo(
    () => buildLinePoints(points, width, CHART_HEIGHT),
    [points, width],
  );

  const hasNoPoints = !points?.length || width <= 0;
  if (hasNoPoints) {
    return <View style={{ height: CHART_HEIGHT }} />;
  }

  const { polylinePointsText, dots, dateLabels, yMin, yMax } = chartGeometry;
  const lastValue = points[points.length - 1].value;
  const guideLineY = dashedGuideYForLastValue(lastValue, yMin, yMax);
  const lastDot = dots.length ? dots[dots.length - 1] : null;
  const showPolyline = Boolean(polylinePointsText);
  const showLastDot = Boolean(lastDot);

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Line
          x1={CHART_PAD_X}
          x2={width - CHART_PAD_X}
          y1={guideLineY}
          y2={guideLineY}
          stroke={colors.nbBorder}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          opacity={0.55}
        />
        {showPolyline ? (
          <Polyline
            points={polylinePointsText}
            fill="none"
            stroke={colors.nbInk}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {showLastDot ? (
          <Circle
            cx={lastDot.x}
            cy={lastDot.y}
            r={6}
            fill={colors.nbInk}
            stroke={colors.nbSurface}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
      <View style={styles.xLabels}>
        {dateLabels.map((dateLabel) => (
          <Text
            key={`${dateLabel.text}-${dateLabel.x}`}
            style={[styles.xLabel, { color: colors.nbMuted, left: dateLabel.x - 28 }]}
          >
            {dateLabel.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

function EmptyProgressCard({ title, body, colors, dashed, actionLabel, onAction }) {
  const cardStyle = [
    styles.emptyCard,
    {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder,
    },
  ];
  if (dashed) {
    cardStyle.push({ borderStyle: 'dashed' });
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10}>
      <View style={cardStyle}>
        <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{title}</Text>
        {body ? (
          <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>{body}</Text>
        ) : null}
        {actionLabel && onAction ? (
          <NbButton variant="fill" onPress={onAction}>
            {actionLabel}
          </NbButton>
        ) : null}
      </View>
    </HardShadow>
  );
}

function CurrentValueHeader({ currentValueText, deltaBadge, colors }) {
  return (
    <View style={styles.currentRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.currentEyebrow, { color: colors.nbMuted }]}>Current</Text>
        <Text style={[styles.currentValue, { color: colors.nbInk }]}>{currentValueText}</Text>
      </View>
      {deltaBadge ? (
        <LinearGradient
          colors={accentGradients[0]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.deltaPill, { borderColor: colors.nbBorder }]}
        >
          <Text style={styles.deltaText}>{deltaBadge}</Text>
        </LinearGradient>
      ) : null}
    </View>
  );
}

function StatRowCards({ stats, colors }) {
  return (
    <View style={styles.statRow}>
      {stats.map((stat) => (
        <HardShadow key={stat.label} offset={nb.shadowOffsetSmall} radius={10} style={{ flex: 1 }}>
          <View style={[styles.statCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
            <Text style={[styles.statValue, { color: colors.nbInk }]} numberOfLines={1}>
              {stat.value}
            </Text>
            <Text style={[styles.statLabel, { color: colors.nbMuted }]}>{stat.label}</Text>
          </View>
        </HardShadow>
      ))}
    </View>
  );
}

function GoalProgressCard({ summary, unit, colors }) {
  const goalTitle = `Toward ${formatMetric(summary.goal)} ${unit}`;
  const progressPercentLabel = `${Math.round(summary.progressPct * 100)}%`;
  let caption = 'Keep logging to track the goal';
  if (summary.remaining != null) {
    caption = `${formatMetric(Math.abs(summary.remaining))} ${unit} to go`;
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10}>
      <View style={[styles.goalCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
        <View style={styles.goalHead}>
          <Text style={[styles.goalTitle, { color: colors.nbInk }]}>{goalTitle}</Text>
          <Text style={[styles.goalPct, { color: colors.nbMuted }]}>{progressPercentLabel}</Text>
        </View>
        <NbProgressBar progress={summary.progressPct} index={0} />
        <Text style={[styles.goalCaption, { color: colors.nbMuted }]}>{caption}</Text>
      </View>
    </HardShadow>
  );
}

function RecentLogsList({ recent, unit, sectionTitle, colors }) {
  return (
    <>
      <Text style={[styles.sectionEyebrow, { color: colors.nbMuted }]}>{sectionTitle}</Text>
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={[styles.listCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
          {recent.map((row, rowIndex) => {
            const isLastRow = rowIndex >= recent.length - 1;
            const rowBorderStyle = isLastRow
              ? null
              : {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.nbBorder,
                };
            return (
              <View key={row.dateKey} style={[styles.listRow, rowBorderStyle]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.listTitle, { color: colors.nbInk }]}>
                    {formatWeekdayDate(row.date)}
                  </Text>
                  <Text style={[styles.listSub, { color: colors.nbMuted }]}>Logged</Text>
                </View>
                <Text style={[styles.listValue, { color: colors.nbInk }]}>
                  {`${formatMetric(row.value)} ${unit}`}
                </Text>
              </View>
            );
          })}
        </View>
      </HardShadow>
    </>
  );
}

function LogMetricSheet({
  visible,
  onClose,
  tabId,
  logDraft,
  onChangeDraft,
  onSave,
  saving,
  colors,
}) {
  const sheetTitle = logButtonLabel(tabId);
  const fieldLabel = tabId === TAB_BODY_FAT ? 'Body fat %' : 'Weight (lb)';
  const placeholder = tabId === TAB_BODY_FAT ? '18.5' : '172.0';
  const saveLabel = saving ? 'Saving…' : 'Save';

  return (
    <NbSheet visible={visible} onClose={onClose} title={sheetTitle}>
      <Text style={{ color: colors.nbMuted, marginBottom: 10, fontWeight: '600' }}>
        {fieldLabel}
      </Text>
      <TextInput
        value={logDraft}
        onChangeText={onChangeDraft}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor={colors.nbMuted}
        style={[
          styles.logInput,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSoft,
            color: colors.nbInk,
          },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <NbButton variant="ghost" onPress={onClose} style={{ flex: 1 }}>
          Cancel
        </NbButton>
        <NbButton variant="fill" onPress={onSave} disabled={saving} style={{ flex: 1 }}>
          {saveLabel}
        </NbButton>
      </View>
    </NbSheet>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client Progress charts screen (Design Law).
 * @param {{ navigation?: { goBack?: Function }, onBack?: Function, userId?: string, weightGoal?: number|null }} props
 */
export default function ProgressChartsScreen({
  navigation,
  onBack,
  userId: userIdProp,
  weightGoal = null,
}) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const userId = userIdProp || auth.currentUser?.uid;
  const [tabId, setTabId] = useState(TAB_WEIGHT);
  const [rangeId, setRangeId] = useState(DEFAULT_RANGE_ID);
  const [weightPoints, setWeightPoints] = useState([]);
  const [bodyFatPoints, setBodyFatPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const chartWidth = Math.max(0, windowWidth - nb.screenGutter * 2 - 28);

  // 1. Load weight + body-fat series from dailyLogs (same fields as home progress).
  const reloadMetricHistory = useCallback(async () => {
    if (!userId) {
      setWeightPoints([]);
      setBodyFatPoints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const weightSeries = await fetchMetricHistory(userId, WEIGHT_FIELD);
      const bodyFatSeries = await fetchMetricHistory(userId, BODY_FAT_FIELD);
      setWeightPoints(weightSeries);
      setBodyFatPoints(bodyFatSeries);
    } catch (loadError) {
      setError(loadError?.message || 'Could not load progress');
      setWeightPoints([]);
      setBodyFatPoints([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reloadMetricHistory();
  }, [reloadMetricHistory]);

  const handleBack = () => {
    if (typeof onBack === 'function') {
      onBack();
      return;
    }
    navigation?.goBack?.();
  };

  const activePoints = tabId === TAB_BODY_FAT ? bodyFatPoints : weightPoints;
  const ranged = useMemo(
    () => filterPointsByRange(activePoints, rangeId),
    [activePoints, rangeId],
  );
  const goal = tabId === TAB_WEIGHT ? weightGoal ?? DEFAULT_WEIGHT_GOAL_LB : null;
  const summary = useMemo(() => summarizeMetricSeries(ranged, goal), [ranged, goal]);
  const unit = metricUnitForTab(tabId);
  const recent = useMemo(
    () => [...ranged].reverse().slice(0, RECENT_LOG_COUNT),
    [ranged],
  );

  const deltaBadge = buildDeltaBadgeText(summary, unit);
  const emptyCopy = emptyStateCopyForTab(tabId);
  const statCards = buildStatCards(summary, unit);

  // 2. Write today’s dailyLogs field, then refresh the chart series.
  const saveLogEntry = async () => {
    const typedText = String(logDraft).replace(/,/g, '');
    const parsedNumber = Number(typedText);
    const cannotSave = !userId || !Number.isFinite(parsedNumber);
    if (cannotSave) return;

    setSaving(true);
    try {
      const logDateKey = localDateKey();
      const dailyLogField = dailyLogFieldForTab(tabId);
      await setDoc(
        doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, logDateKey),
        { [dailyLogField]: parsedNumber, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setLogOpen(false);
      setLogDraft('');
      await reloadMetricHistory();
    } catch (saveError) {
      setError(saveError?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const openLogSheet = () => {
    let draftFromCurrent = '';
    if (summary.current != null) {
      draftFromCurrent = String(summary.current);
    }
    setLogDraft(draftFromCurrent);
    setLogOpen(true);
  };

  const closeLogSheet = () => {
    setLogOpen(false);
  };

  // Name every screen branch before JSX (no nested ternary tree).
  const finishedLoading = !loading;
  const noError = !error;
  const isLiftsTab = tabId === TAB_LIFTS;
  const isBodyFatTab = tabId === TAB_BODY_FAT;
  const hasRangedPoints = ranged.length > 0;
  const showLiftsPlaceholder = finishedLoading && noError && isLiftsTab;
  const showMetricEmpty =
    finishedLoading && noError && !isLiftsTab && !hasRangedPoints;
  const showMetricChart =
    finishedLoading && noError && !isLiftsTab && hasRangedPoints;
  const showErrorCard = Boolean(error) && finishedLoading;
  const showGoalCard = summary.goal != null && summary.progressPct != null;
  let recentSectionTitle = 'Recent weigh-ins';
  if (isBodyFatTab) {
    recentSectionTitle = 'Recent logs';
  }
  const currentValueText = `${formatMetric(summary.current)} ${unit}`;
  const logCtaLabel = logButtonLabel(tabId);

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader
        title="Progress"
        subtitle="Weight, body fat and lifts"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: nb.screenGutter,
          paddingBottom: SCROLL_BOTTOM_PADDING,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <SegmentTabs tabId={tabId} onChange={setTabId} colors={colors} />

        {loading ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="large" color={colors.nbInk} />
          </View>
        ) : null}

        {showErrorCard ? (
          <EmptyProgressCard
            title={error}
            colors={colors}
            actionLabel="Retry"
            onAction={reloadMetricHistory}
          />
        ) : null}

        {showLiftsPlaceholder ? (
          <EmptyProgressCard
            title={emptyCopy.title}
            body={emptyCopy.body}
            colors={colors}
          />
        ) : null}

        {showMetricEmpty ? (
          <EmptyProgressCard
            title={emptyCopy.title}
            body={emptyCopy.body}
            colors={colors}
            dashed
            actionLabel={logCtaLabel}
            onAction={openLogSheet}
          />
        ) : null}

        {showMetricChart ? (
          <>
            <HardShadow offset={nb.shadowOffsetCard} radius={10}>
              <View
                style={[
                  styles.chartCard,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <CurrentValueHeader
                  currentValueText={currentValueText}
                  deltaBadge={deltaBadge}
                  colors={colors}
                />
                <MetricLineChart points={ranged} colors={colors} width={chartWidth} />
                <RangeChips rangeId={rangeId} onChange={setRangeId} colors={colors} />
              </View>
            </HardShadow>

            <StatRowCards stats={statCards} colors={colors} />

            {showGoalCard ? (
              <GoalProgressCard summary={summary} unit={unit} colors={colors} />
            ) : null}

            <RecentLogsList
              recent={recent}
              unit={unit}
              sectionTitle={recentSectionTitle}
              colors={colors}
            />

            <HardShadow offset={nb.shadowOffsetCard} radius={10}>
              <NbButton variant="fill" onPress={openLogSheet}>
                {logCtaLabel}
              </NbButton>
            </HardShadow>
          </>
        ) : null}
      </ScrollView>

      <LogMetricSheet
        visible={logOpen}
        onClose={closeLogSheet}
        tabId={tabId}
        logDraft={logDraft}
        onChangeDraft={setLogDraft}
        onSave={saveLogEntry}
        saving={saving}
        colors={colors}
      />
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Map log points into SVG polyline / dots / x-axis date labels.
 * Why pad yMin/yMax: a flat series would collapse to one horizontal line.
 */
function emptyLineGeometry() {
  return { polylinePointsText: '', dots: [], yMin: 0, yMax: 1, dateLabels: [] };
}

function paddedYRangeFromValues(values) {
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const verticalPad = (yMax - yMin) * Y_AXIS_PAD_FRACTION;
  yMin -= verticalPad;
  yMax += verticalPad;
  return { yMin, yMax };
}

function chartDotForPoint(point, index, pointCount, plotWidth, plotHeight, yMin, yMax) {
  let xPosition = CHART_PAD_X + plotWidth / 2;
  if (pointCount > 1) {
    xPosition = CHART_PAD_X + (index / (pointCount - 1)) * plotWidth;
  }
  const valueSpan = yMax - yMin;
  const valueRatio = (point.value - yMin) / valueSpan;
  const yPosition = CHART_PAD_Y + plotHeight - valueRatio * plotHeight;
  return { x: xPosition, y: yPosition, ...point };
}

function buildLinePoints(points, width, height) {
  if (!points?.length || width <= 0) {
    return emptyLineGeometry();
  }

  const values = points.map((point) => point.value);
  const { yMin, yMax } = paddedYRangeFromValues(values);

  const plotWidth = Math.max(1, width - CHART_PAD_X * 2);
  const plotHeight = Math.max(1, height - CHART_PAD_Y * 2);
  const pointCount = points.length;

  const dots = points.map((point, index) =>
    chartDotForPoint(point, index, pointCount, plotWidth, plotHeight, yMin, yMax),
  );

  const polylinePointsText = dots.map((dot) => `${dot.x},${dot.y}`).join(' ');
  const labelIndexes = uniqueLabelIndexes(pointCount);
  const dateLabels = labelIndexes.map((index) => ({
    x: dots[index].x,
    text: formatShortDate(points[index].date),
  }));

  return { polylinePointsText, dots, yMin, yMax, dateLabels };
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  segRow: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBlock: { minHeight: 160, alignItems: 'center', justifyContent: 'center' },
  emptyCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 18,
    gap: 10,
    alignItems: 'stretch',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900' },
  emptyBody: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  chartCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  currentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  currentEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  currentValue: { fontSize: 34, fontWeight: '900', letterSpacing: -1, marginTop: 2 },
  deltaPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 148,
  },
  deltaText: { fontSize: 11, fontWeight: '900', color: DELTA_PILL_TEXT_COLOR },
  rangeRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  rangeChip: {
    minWidth: 52,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xLabels: { height: 18, position: 'relative', marginTop: 2 },
  xLabel: { position: 'absolute', width: 56, fontSize: 11, fontWeight: '700', textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    minHeight: 72,
    justifyContent: 'center',
  },
  statValue: { fontSize: 16, fontWeight: '900' },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  goalCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    gap: 10,
  },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  goalTitle: { fontSize: 15, fontWeight: '900' },
  goalPct: { fontSize: 14, fontWeight: '800' },
  goalCaption: { fontSize: 13, fontWeight: '600' },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  listCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    overflow: 'hidden',
  },
  listRow: {
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listTitle: { fontSize: 15, fontWeight: '800' },
  listSub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  listValue: { fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] },
  logInput: {
    minHeight: 50,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
  },
});
