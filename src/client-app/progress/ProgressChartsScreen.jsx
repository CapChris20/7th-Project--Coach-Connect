// Design Law Progress charts — Weight / Body fat / Lifts (screens/progress PNG 01–04).
// Flow: load dailyLogs series → range filter → line chart + stats → Log weight / empty shells.
// Used by client Go to → Progress. Photos stay on PhotoGallery; this is charts only.

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
// Manipulate here: default goal when profile has none — matches Progress PNG sample
const DEFAULT_WEIGHT_GOAL_LB = 165;

// ===== HELPER FUNCTIONS =====

function formatShortDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWeekdayDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMetric(value, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  return Number(value).toFixed(decimals);
}

function formatSigned(value, unit, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)} ${unit}`;
}

function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildLinePoints(points, width, height) {
  if (!points?.length || width <= 0) return { poly: '', dots: [], yMin: 0, yMax: 1, labels: [] };
  const values = points.map((p) => p.value);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }
  const pad = (yMax - yMin) * 0.12;
  yMin -= pad;
  yMax += pad;
  const plotW = Math.max(1, width - CHART_PAD_X * 2);
  const plotH = Math.max(1, height - CHART_PAD_Y * 2);
  const dots = points.map((p, i) => {
    const x =
      points.length === 1
        ? CHART_PAD_X + plotW / 2
        : CHART_PAD_X + (i / (points.length - 1)) * plotW;
    const y = CHART_PAD_Y + plotH - ((p.value - yMin) / (yMax - yMin)) * plotH;
    return { x, y, ...p };
  });
  const poly = dots.map((d) => `${d.x},${d.y}`).join(' ');
  const labelIdx = [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  );
  const labels = labelIdx.map((i) => ({
    x: dots[i].x,
    text: formatShortDate(points[i].date),
  }));
  return { poly, dots, yMin, yMax, labels };
}

// ===== SMALL UI =====

function SegmentTabs({ tabId, onChange, colors }) {
  return (
    <View style={[styles.segRow, { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft }]}>
      {TABS.map((tab) => {
        const on = tab.id === tabId;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[
              styles.segChip,
              {
                backgroundColor: on ? colors.nbFill : 'transparent',
                borderColor: on ? colors.nbBorder : 'transparent',
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: on ? colors.nbOnFill : colors.nbInk }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function RangeChips({ rangeId, onChange, colors }) {
  return (
    <View style={styles.rangeRow}>
      {RANGES.map((id) => {
        const on = id === rangeId;
        const chip = (
          <TouchableOpacity
            onPress={() => onChange(id)}
            style={[
              styles.rangeChip,
              {
                backgroundColor: on ? colors.nbFill : colors.nbSurface,
                borderColor: colors.nbBorder,
              },
            ]}
          >
            <Text style={{ fontSize: 13, fontWeight: '900', color: on ? colors.nbOnFill : colors.nbInk }}>
              {id}
            </Text>
          </TouchableOpacity>
        );
        return on ? (
          <HardShadow key={id} offset={nb.shadowOffsetSmall} radius={999}>
            {chip}
          </HardShadow>
        ) : (
          <View key={id}>{chip}</View>
        );
      })}
    </View>
  );
}

function MetricLineChart({ points, colors, width }) {
  const { poly, dots, labels, yMin, yMax } = useMemo(
    () => buildLinePoints(points, width, CHART_HEIGHT),
    [points, width],
  );
  if (!points?.length || width <= 0) {
    return <View style={{ height: CHART_HEIGHT }} />;
  }
  const midY =
    CHART_PAD_Y +
    (CHART_HEIGHT - CHART_PAD_Y * 2) *
      (1 - ((points[points.length - 1].value - yMin) / (yMax - yMin) || 0));

  return (
    <View>
      <Svg width={width} height={CHART_HEIGHT}>
        <Line
          x1={CHART_PAD_X}
          x2={width - CHART_PAD_X}
          y1={midY}
          y2={midY}
          stroke={colors.nbBorder}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          opacity={0.55}
        />
        {poly ? (
          <Polyline
            points={poly}
            fill="none"
            stroke={colors.nbInk}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}
        {dots.length ? (
          <Circle
            cx={dots[dots.length - 1].x}
            cy={dots[dots.length - 1].y}
            r={6}
            fill={colors.nbInk}
            stroke={colors.nbSurface}
            strokeWidth={2}
          />
        ) : null}
      </Svg>
      <View style={styles.xLabels}>
        {labels.map((lab) => (
          <Text key={`${lab.text}-${lab.x}`} style={[styles.xLabel, { color: colors.nbMuted, left: lab.x - 28 }]}>
            {lab.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client Progress charts screen (Design Law).
 * @param {{ navigation?: { goBack?: Function }, onBack?: Function, userId?: string, weightGoal?: number|null }} props
 */
export default function ProgressChartsScreen({ navigation, onBack, userId: userIdProp, weightGoal = null }) {
  const { colors } = useTheme();
  const { width: winW } = useWindowDimensions();
  const userId = userIdProp || auth.currentUser?.uid;
  const [tabId, setTabId] = useState('weight');
  const [rangeId, setRangeId] = useState('12W');
  const [weightPoints, setWeightPoints] = useState([]);
  const [bodyFatPoints, setBodyFatPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [logDraft, setLogDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const chartWidth = Math.max(0, winW - nb.screenGutter * 2 - 28);

  const reload = useCallback(async () => {
    if (!userId) {
      setWeightPoints([]);
      setBodyFatPoints([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [w, bf] = await Promise.all([
        fetchMetricHistory(userId, WEIGHT_FIELD),
        fetchMetricHistory(userId, BODY_FAT_FIELD),
      ]);
      setWeightPoints(w);
      setBodyFatPoints(bf);
    } catch (caught) {
      setError(caught?.message || 'Could not load progress');
      setWeightPoints([]);
      setBodyFatPoints([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleBack = () => {
    if (typeof onBack === 'function') onBack();
    else navigation?.goBack?.();
  };

  const activePoints = tabId === 'bodyfat' ? bodyFatPoints : weightPoints;
  const ranged = useMemo(() => filterPointsByRange(activePoints, rangeId), [activePoints, rangeId]);
  const goal = tabId === 'weight' ? weightGoal ?? DEFAULT_WEIGHT_GOAL_LB : null;
  const summary = useMemo(() => summarizeMetricSeries(ranged, goal), [ranged, goal]);
  const unit = tabId === 'bodyfat' ? '%' : 'lb';
  const recent = useMemo(() => [...ranged].reverse().slice(0, 8), [ranged]);

  const deltaBadge =
    summary.change != null && summary.weeksSpan
      ? `${formatSigned(summary.change, unit)} in ${summary.weeksSpan} wk`
      : null;

  const saveLog = async () => {
    const n = Number(String(logDraft).replace(/,/g, ''));
    if (!userId || !Number.isFinite(n)) return;
    setSaving(true);
    try {
      const key = localDateKey();
      const field = tabId === 'bodyfat' ? BODY_FAT_FIELD : WEIGHT_FIELD;
      await setDoc(
        doc(db, USERS_COLLECTION, userId, DAILY_LOGS_COLLECTION, key),
        { [field]: n, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setLogOpen(false);
      setLogDraft('');
      await reload();
    } catch (caught) {
      setError(caught?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const emptyCopy =
    tabId === 'lifts'
      ? {
          title: 'No lifts logged yet',
          body: 'When you save workout sets with weight, personal records show up here.',
        }
      : tabId === 'bodyfat'
        ? {
            title: 'No body fat logs yet',
            body: 'Log a body fat reading and the trend chart fills in.',
          }
        : {
            title: 'No weigh-ins yet',
            body: 'Log your weight and the chart, change, and recent list show up here.',
          };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.nbBackground }]} edges={SHELL_SAFE_AREA_EDGES}>
      <NbPageHeader title="Progress" subtitle="Weight, body fat and lifts" onBack={handleBack} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: nb.screenGutter,
          paddingBottom: 40,
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

        {error && !loading ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={10}>
            <View style={[styles.emptyCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
              <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{error}</Text>
              <NbButton variant="fill" onPress={reload}>
                Retry
              </NbButton>
            </View>
          </HardShadow>
        ) : null}

        {!loading && !error && tabId === 'lifts' ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={10}>
            <View style={[styles.emptyCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
              <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{emptyCopy.title}</Text>
              <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>{emptyCopy.body}</Text>
            </View>
          </HardShadow>
        ) : null}

        {!loading && !error && tabId !== 'lifts' && ranged.length === 0 ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={10}>
            <View
              style={[
                styles.emptyCard,
                {
                  backgroundColor: colors.nbSurface,
                  borderColor: colors.nbBorder,
                  borderStyle: 'dashed',
                },
              ]}
            >
              <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>{emptyCopy.title}</Text>
              <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>{emptyCopy.body}</Text>
              <NbButton
                variant="fill"
                onPress={() => {
                  setLogDraft(summary.current != null ? String(summary.current) : '');
                  setLogOpen(true);
                }}
              >
                {tabId === 'bodyfat' ? 'Log body fat' : 'Log weight'}
              </NbButton>
            </View>
          </HardShadow>
        ) : null}

        {!loading && !error && tabId !== 'lifts' && ranged.length > 0 ? (
          <>
            <HardShadow offset={nb.shadowOffsetCard} radius={10}>
              <View style={[styles.chartCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
                <View style={styles.currentRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.currentEyebrow, { color: colors.nbMuted }]}>Current</Text>
                    <Text style={[styles.currentValue, { color: colors.nbInk }]}>
                      {`${formatMetric(summary.current)} ${unit}`}
                    </Text>
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
                <MetricLineChart points={ranged} colors={colors} width={chartWidth} />
                <RangeChips rangeId={rangeId} onChange={setRangeId} colors={colors} />
              </View>
            </HardShadow>

            <View style={styles.statRow}>
              {[
                { label: 'Start', value: formatMetric(summary.start) },
                { label: 'Change', value: formatSigned(summary.change, unit) },
                {
                  label: 'Goal',
                  value: summary.goal != null ? formatMetric(summary.goal) : '—',
                },
              ].map((stat) => (
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

            {summary.goal != null && summary.progressPct != null ? (
              <HardShadow offset={nb.shadowOffsetCard} radius={10}>
                <View style={[styles.goalCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
                  <View style={styles.goalHead}>
                    <Text style={[styles.goalTitle, { color: colors.nbInk }]}>
                      {`Toward ${formatMetric(summary.goal)} ${unit}`}
                    </Text>
                    <Text style={[styles.goalPct, { color: colors.nbMuted }]}>
                      {`${Math.round(summary.progressPct * 100)}%`}
                    </Text>
                  </View>
                  <NbProgressBar progress={summary.progressPct} index={0} />
                  <Text style={[styles.goalCaption, { color: colors.nbMuted }]}>
                    {summary.remaining != null
                      ? `${formatMetric(Math.abs(summary.remaining))} ${unit} to go`
                      : 'Keep logging to track the goal'}
                  </Text>
                </View>
              </HardShadow>
            ) : null}

            <Text style={[styles.sectionEyebrow, { color: colors.nbMuted }]}>
              {tabId === 'bodyfat' ? 'Recent logs' : 'Recent weigh-ins'}
            </Text>
            <HardShadow offset={nb.shadowOffsetCard} radius={10}>
              <View style={[styles.listCard, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}>
                {recent.map((row, idx) => (
                  <View
                    key={row.dateKey}
                    style={[
                      styles.listRow,
                      idx < recent.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.nbBorder,
                      },
                    ]}
                  >
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
                ))}
              </View>
            </HardShadow>

            <HardShadow offset={nb.shadowOffsetCard} radius={10}>
              <NbButton
                variant="fill"
                onPress={() => {
                  setLogDraft(summary.current != null ? String(summary.current) : '');
                  setLogOpen(true);
                }}
              >
                {tabId === 'bodyfat' ? 'Log body fat' : 'Log weight'}
              </NbButton>
            </HardShadow>
          </>
        ) : null}
      </ScrollView>

      <NbSheet
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        title={tabId === 'bodyfat' ? 'Log body fat' : 'Log weight'}
      >
        <Text style={{ color: colors.nbMuted, marginBottom: 10, fontWeight: '600' }}>
          {tabId === 'bodyfat' ? 'Body fat %' : 'Weight (lb)'}
        </Text>
        <TextInput
          value={logDraft}
          onChangeText={setLogDraft}
          keyboardType="decimal-pad"
          placeholder={tabId === 'bodyfat' ? '18.5' : '172.0'}
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
          <NbButton variant="ghost" onPress={() => setLogOpen(false)} style={{ flex: 1 }}>
            Cancel
          </NbButton>
          <NbButton variant="fill" onPress={saveLog} disabled={saving} style={{ flex: 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </NbButton>
        </View>
      </NbSheet>
    </SafeAreaView>
  );
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
  deltaText: { fontSize: 11, fontWeight: '900', color: '#0A0A0A' },
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
