import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import CenteredTwoColumnGrid from '../../shared/ui/layout/CenteredTwoColumnGrid';
import { StatGradientText } from '../../shared/ui/homeStatGradients';
import {
  NUT_ACTION_GRADIENT,
  NUT_CALORIES_GRADIENT,
  NUT_SECTION_GRADIENT,
} from '../nutritionTheme';
import foodSearchProvider from '../food-search/foodSearchProvider';
import { updateFoodLog } from '../daily-log/logFoodToFirestore';
import {
  buildDailyNutritionFactsCardData,
  buildLogEnrichmentPatch,
  calculateDailyNutrientTotals,
  cleanFoodDisplayName,
  logNeedsNutrientEnrichment,
} from './nutritionFactsModel';

/** Muted accents — Nutrition Facts screen only (do not change global theme). */
const FACTS_MUTED = {
  pink: '#E85D8A',
  orange: '#D4621A',
  cyan: '#4DB8E8',
  purple: '#A970E8',
};

const FACTS_COLOR_MAP = {
  '#FF6B9D': FACTS_MUTED.pink,
  '#F97316': FACTS_MUTED.orange,
  '#64D2FF': FACTS_MUTED.cyan,
  '#C084FC': FACTS_MUTED.purple,
  '#22D3EE': FACTS_MUTED.cyan,
  '#06B6D4': '#3A9BC4',
  '#DB2777': '#C44A75',
  '#FBBF24': '#D4A820',
  '#E94EAD': FACTS_MUTED.pink,
  '#A348D0': FACTS_MUTED.purple,
  '#6B3AD9': '#8B6AD4',
  '#BE185D': '#C44A6F',
  '#C2410C': FACTS_MUTED.orange,
};

const FACTS_PROGRESS_TRACK = 'rgba(255, 255, 255, 0.06)';

function factsMutedGradient(grad) {
  if (!Array.isArray(grad)) return grad;
  return grad.map((c) => FACTS_COLOR_MAP[c] || c);
}

function sectionHeaderColor(title) {
  const t = String(title || '').toUpperCase();
  if (t === 'FATS') return FACTS_MUTED.cyan;
  if (t.includes('CARBOHYDRATE')) return FACTS_MUTED.orange;
  if (t.includes('VITAMIN')) return FACTS_MUTED.pink;
  return FACTS_MUTED.purple;
}

function isZeroOrUnavailable(display, raw) {
  if (display === '—') return true;
  if (raw != null && Number(raw) <= 0) return true;
  if (typeof display === 'string' && /^0(\.0+)?(g|mg|mcg)$/.test(display)) return true;
  return false;
}

function getColors(isDark) {
  return isDark
    ? {
        screenBg: '#0A0A0F',
        cardBg: 'rgba(255,255,255,0.05)',
        cardBorder: 'rgba(255,255,255,0.1)',
        text: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.55)',
        textDim: 'rgba(255,255,255,0.38)',
        divider: 'rgba(255,255,255,0.08)',
        track: 'rgba(255,255,255,0.1)',
      }
    : {
        screenBg: '#F2F2F7',
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(0,0,0,0.08)',
        text: '#1C1C1E',
        textMuted: 'rgba(28,28,30,0.55)',
        textDim: 'rgba(28,28,30,0.4)',
        divider: 'rgba(0,0,0,0.08)',
        track: 'rgba(0,0,0,0.08)',
      };
}

function cardShadow(isDark) {
  if (isDark) return {};
  return Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
    android: { elevation: 3 },
  });
}

function GradientLabel({ children, style, colors: gradientColors, align = 'center' }) {
  const muted = factsMutedGradient(gradientColors);
  return (
    <View style={{ alignSelf: align }}>
      <StatGradientText style={style} colors={muted} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        {children}
      </StatGradientText>
    </View>
  );
}

function CardTopAccent({ gradient }) {
  return (
    <View style={s.cardTopAccentWrap}>
      <LinearGradient
        colors={factsMutedGradient(gradient)}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.cardTopAccent}
      />
    </View>
  );
}

function CardDepthOverlay({ show }) {
  if (!show) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,255,255,0.02)' }]}
    />
  );
}

function DetailListCard({ section, colors, isDark, depthLayer = false }) {
  if (!section?.rows?.length) return null;
  const grad = factsMutedGradient(section.gradient || NUT_SECTION_GRADIENT);
  const headerColor = sectionHeaderColor(section.title);
  const totalDim = isZeroOrUnavailable(section.total);
  return (
    <View style={[s.detailCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}>
      <CardDepthOverlay show={depthLayer} />
      <CardTopAccent gradient={grad} />
      <View style={s.detailHeader}>
        <Text style={[s.detailTitle, { color: headerColor, opacity: 0.7 }]}>{section.title}</Text>
        <View style={totalDim ? { opacity: 0.35 } : undefined}>
          <GradientLabel style={s.detailTotal} colors={grad}>{section.total}</GradientLabel>
        </View>
      </View>
      {section.rows.map((row, idx) => {
        const dimValue = isZeroOrUnavailable(row.display, row.raw);
        return (
          <View key={row.label}>
            {idx > 0 ? <View style={[s.detailDivider, { backgroundColor: colors.divider }]} /> : null}
            <View style={s.detailRow}>
              <Text style={[s.detailLabel, { color: colors.textMuted }]}>{row.label}</Text>
              <Text style={[s.detailValue, { color: colors.text, opacity: dimValue ? 0.35 : 1 }]}>
                {row.display}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function MacroMiniCard({ macro, colors, isDark, depthLayer = false }) {
  const track = isDark ? FACTS_PROGRESS_TRACK : 'rgba(0,0,0,0.08)';
  const grad = factsMutedGradient(macro.gradient || NUT_CALORIES_GRADIENT);
  const valueDim = isZeroOrUnavailable(macro.display, macro.value);
  return (
    <View style={[s.macroMini, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}>
      <CardDepthOverlay show={depthLayer} />
      <CardTopAccent gradient={grad} />
      <GradientLabel style={s.macroMiniTitle} colors={grad}>{macro.label}</GradientLabel>
      <Text style={[s.macroMiniValue, { color: colors.text, opacity: valueDim ? 0.35 : 1 }]}>
        {macro.display}
      </Text>
      <View style={[s.macroMiniTrack, { backgroundColor: track }]}>
        <LinearGradient
          colors={grad}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.macroMiniFill, { width: `${Math.max(macro.pct, macro.value > 0 ? 4 : 0)}%` }]}
        />
      </View>
      <Text style={[s.macroMiniGoal, { color: colors.textDim, opacity: 0.5 }]}>{macro.goalLabel}</Text>
    </View>
  );
}

export default function NutritionFactsScreen({
  logs = [],
  goals = {},
  foodCount = 0,
  reserveShellBottomNav = false,
}) {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const shellBottomPad = useShellBottomNavInset(16);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : 24;
  const [enrichmentByLogId, setEnrichmentByLogId] = useState({});
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cache = new Map();

    async function enrichLogs() {
      const targets = logs.filter((log) => log?.id && logNeedsNutrientEnrichment(log));
      if (!targets.length) {
        if (!cancelled) {
          setEnrichmentByLogId({});
          setEnriching(false);
        }
        return;
      }

      if (!cancelled) setEnriching(true);
      const next = {};
      await Promise.all(
        targets.map(async (log) => {
          const name = cleanFoodDisplayName(log.food_name);
          if (!name) return;
          let nutrients = cache.get(name);
          if (nutrients === undefined) {
            try {
              nutrients = await foodSearchProvider.fetchNutritionDetails(name);
            } catch (_) {
              nutrients = null;
            }
            cache.set(name, nutrients);
          }
          if (!nutrients) return;
          next[log.id] = nutrients;
          const patch = buildLogEnrichmentPatch(log, nutrients);
          if (patch) {
            updateFoodLog(log.id, patch).catch(() => {});
          }
        }),
      );

      if (!cancelled) {
        setEnrichmentByLogId(next);
        setEnriching(false);
      }
    }

    enrichLogs();
    return () => { cancelled = true; };
  }, [logs]);

  const nutrients = useMemo(
    () => calculateDailyNutrientTotals(logs, enrichmentByLogId),
    [logs, enrichmentByLogId],
  );
  const data = useMemo(
    () => {
      const cards = buildDailyNutritionFactsCardData(nutrients, goals);
      return { ...cards, foodCount: foodCount || logs.length };
    },
    [nutrients, goals, foodCount, logs.length],
  );

  const isEmpty = data.calories <= 0 && logs.length === 0;
  const calGrad = factsMutedGradient(data.calorieGradient || NUT_CALORIES_GRADIENT);
  const mineralsGrad = factsMutedGradient(data.minerals?.gradient || NUT_SECTION_GRADIENT);
  const summaryAccentGrad = factsMutedGradient(NUT_ACTION_GRADIENT);
  const progressTrack = isDark ? FACTS_PROGRESS_TRACK : colors.track;
  const mineralsHeaderColor = sectionHeaderColor(data.minerals.title);

  return (
    <View style={[s.root, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}>
          <CardTopAccent gradient={summaryAccentGrad} />
          <View style={s.summaryTop}>
            <View style={s.summaryLeft}>
              <Text style={[s.summaryTitle, { color: colors.text }]}>Today's Nutrition</Text>
              <Text style={[s.summarySub, { color: colors.textMuted }]}>
                {data.foodCount > 0
                  ? `${data.foodCount} food item${data.foodCount === 1 ? '' : 's'} logged`
                  : 'No food logged yet'}
              </Text>
            </View>
            <View style={s.summaryCalSlot}>
              <Text style={[s.summaryCal, { color: FACTS_MUTED.pink }]}>{String(data.calories)}</Text>
              <Text style={[s.summaryCalUnit, { color: FACTS_MUTED.pink }]}>CAL</Text>
            </View>
          </View>
        </View>

        <View style={[s.calCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}>
          <CardDepthOverlay show={isDark} />
          <CardTopAccent gradient={calGrad} />
          <View style={s.calCardTop}>
            <Text style={[s.calCardKicker, { color: colors.textDim }]}>DAILY CALORIES</Text>
            <Text style={[s.calCardGoal, { color: colors.textMuted }]}>
              {data.calorieGoal.toLocaleString()} kcal goal
            </Text>
          </View>
          <View style={s.calValueRow}>
            <GradientLabel style={s.calCardValue} colors={calGrad}>
              {data.calories.toLocaleString()}
            </GradientLabel>
            <Text style={[s.calCardUnit, { color: colors.textMuted }]}> kcal</Text>
          </View>
          <View style={[s.calTrack, { backgroundColor: progressTrack }]}>
            <LinearGradient
              colors={calGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.calFill, { width: `${Math.max(data.caloriePct, isEmpty ? 0 : 3)}%` }]}
            />
          </View>
          <Text style={[s.calPctLabel, { color: colors.textDim }]}>
            {data.caloriePct}% of daily goal
          </Text>
        </View>

        <View style={s.macroRow}>
          {data.macros.map((m, idx) => (
            <MacroMiniCard
              key={m.label}
              macro={m}
              colors={colors}
              isDark={isDark}
              depthLayer={isDark && idx % 2 === 1}
            />
          ))}
        </View>

        {enriching ? (
          <Text style={[s.enrichingHint, { color: colors.textMuted }]}>
            Loading full nutrition facts from your food database…
          </Text>
        ) : null}

        <DetailListCard section={data.fats} colors={colors} isDark={isDark} depthLayer={isDark} />
        <DetailListCard section={data.carbs} colors={colors} isDark={isDark} depthLayer={false} />

        <View style={[s.detailCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}>
          <CardDepthOverlay show={isDark} />
          <CardTopAccent gradient={mineralsGrad} />
          <View style={{ marginBottom: 14 }}>
            <Text style={[s.detailTitle, { color: mineralsHeaderColor, opacity: 0.7 }]}>
              {data.minerals.title}
            </Text>
          </View>
          <CenteredTwoColumnGrid
            items={data.minerals.items}
            keyExtractor={(m) => m.key}
            gap={12}
            itemWidth="48%"
            renderItem={(m) => {
              const dimValue = isZeroOrUnavailable(m.value, m.raw);
              return (
                <View style={s.microCell}>
                  <Text style={[s.microName, { color: colors.textDim }]} numberOfLines={1}>{m.name}</Text>
                  <Text
                    style={[
                      s.microVal,
                      { color: colors.text, opacity: dimValue ? 0.35 : 1 },
                    ]}
                  >
                    {m.value}
                  </Text>
                </View>
              );
            }}
          />
        </View>

        {isEmpty ? (
          <View style={s.emptyHint}>
            <Ionicons name="nutrition-outline" size={28} color={colors.textDim} />
            <Text style={[s.emptyText, { color: colors.textMuted }]}>
              Log food today to see your full daily nutrition breakdown — sodium, fiber, and more.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  cardTopAccentWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    opacity: 0.6,
    zIndex: 1,
  },
  cardTopAccent: { flex: 1, height: 1 },
  summaryCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 16,
    paddingTop: 18,
  },
  summaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  summaryLeft: { flex: 1, paddingRight: 12 },
  summaryTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  summarySub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  summaryCalSlot: { alignItems: 'flex-end' },
  summaryCal: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  summaryCalUnit: { fontSize: 11, fontWeight: '800', letterSpacing: 1, opacity: 0.5, marginTop: 4 },
  calCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    paddingTop: 18,
    overflow: 'hidden',
  },
  calCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  calCardKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  calCardGoal: { fontSize: 12, fontWeight: '600' },
  calValueRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  calCardValue: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  calCardUnit: { fontSize: 16, fontWeight: '700' },
  calTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 3 },
  calPctLabel: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  macroRow: { flexDirection: 'row', gap: 10 },
  enrichingHint: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  macroMini: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  macroMiniTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  macroMiniValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  macroMiniTrack: { height: 5, borderRadius: 3, width: '100%', marginTop: 10, overflow: 'hidden' },
  macroMiniFill: { height: '100%', borderRadius: 3 },
  macroMiniGoal: { fontSize: 10, fontWeight: '600', marginTop: 6 },
  detailCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    paddingTop: 18,
    overflow: 'hidden',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  detailTotal: { fontSize: 14, fontWeight: '800' },
  detailDivider: { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailLabel: { fontSize: 14, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '800' },
  microCell: { gap: 4, paddingVertical: 4 },
  microName: { fontSize: 11, fontWeight: '600' },
  microVal: { fontSize: 17, fontWeight: '800' },
  emptyHint: { alignItems: 'center', gap: 10, paddingVertical: 24, paddingHorizontal: 16 },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '500' },
});
