// Daily Nutrition Facts screen: calorie goal, macro mini-cards, fats/carbs lists, vitamins grid.
// Flow: enrich sparse logs from search API → total today's nutrients → paint summary + detail cards.
// Used by: the client nutrition tab / daily report when the user opens full facts.

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import TwoColumnGrid from '../../look-and-feel/TwoColumnGrid';
import { StatColorText } from '../../look-and-feel/homeStatColors';
import {
  NUT_ACTION_GRADIENT,
  NUT_CALORIES_GRADIENT,
  NUT_SECTION_GRADIENT,
} from '../nutritionColors';
import searchFoods from '../food-search/searchFoods';
import { updateFoodLog } from '../daily-log/saveLoggedFood';
import {
  buildDailyNutritionFactsCardData,
  buildLogEnrichmentPatch,
  calculateDailyNutrientTotals,
  cleanFoodDisplayName,
  logNeedsNutrientEnrichment,
} from './nutritionFactsData';

// ===== NAMED CONSTANTS =====

const SCROLL_BOTTOM_PAD_DEFAULT = 24;
const SHELL_BOTTOM_INSET_EXTRA = 16;
const EMPTY_CAL_FILL_PCT = 0;
const MIN_CAL_FILL_WHEN_LOGGED = 3;
const MIN_MACRO_FILL_WHEN_VALUE = 4;
const ZERO_VALUE_OPACITY = 0.35;
const HEADER_TITLE_OPACITY = 0.7;
const GOAL_LABEL_OPACITY = 0.5;
const GRADIENT_LEFT = { x: 0, y: 0 };
const GRADIENT_RIGHT = { x: 1, y: 0 };
const DEPTH_OVERLAY_COLOR = 'rgba(255,255,255,0.02)';
const EMPTY_ICON_NAME = 'nutrition-outline';
const EMPTY_ICON_SIZE = 28;

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
const LIGHT_PROGRESS_TRACK = 'rgba(0,0,0,0.08)';

// ===== HELPER FUNCTIONS =====

/**
 * Swap bright brand stops for the muted facts palette.
 * @param {string[]|*} gradientStops
 * @returns {string[]|*}
 */
function factsMutedGradient(gradientStops) {
  if (!Array.isArray(gradientStops)) return gradientStops;
  return gradientStops.map((stop) => FACTS_COLOR_MAP[stop] || stop);
}

/**
 * Section title color for FATS / CARBS / VITAMINS headers.
 * @param {string} title
 * @returns {string}
 */
function sectionHeaderColor(title) {
  const upperTitle = String(title || '').toUpperCase();
  if (upperTitle === 'FATS') return FACTS_MUTED.cyan;
  if (upperTitle.includes('CARBOHYDRATE')) return FACTS_MUTED.orange;
  if (upperTitle.includes('VITAMIN')) return FACTS_MUTED.pink;
  return FACTS_MUTED.purple;
}

/**
 * True when a display string or raw number means "nothing logged".
 * @param {*} display
 * @param {*} [raw]
 * @returns {boolean}
 */
function isZeroOrUnavailable(display, raw) {
  if (display === '—') return true;
  if (raw != null && Number(raw) <= 0) return true;
  if (typeof display === 'string' && /^0(\.0+)?(g|mg|mcg)$/.test(display)) return true;
  return false;
}

/**
 * Screen paint tokens for dark vs light.
 * @param {boolean} isDark
 * @returns {object}
 */
function getColors(isDark) {
  if (isDark) {
    return {
      screenBg: '#0A0A0F',
      cardBg: 'rgba(255,255,255,0.05)',
      cardBorder: 'rgba(255,255,255,0.1)',
      text: '#FFFFFF',
      textMuted: 'rgba(255,255,255,0.55)',
      textDim: 'rgba(255,255,255,0.38)',
      divider: 'rgba(255,255,255,0.08)',
      track: 'rgba(255,255,255,0.1)',
    };
  }
  return {
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

/**
 * Soft card shadow on light mode only.
 * @param {boolean} isDark
 * @returns {object}
 */
function cardShadow(isDark) {
  if (isDark) return {};
  return Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 10,
    },
    android: { elevation: 3 },
  });
}

/**
 * Gradient label using muted facts stops.
 */
function GradientLabel({ children, style, colors: gradientColors, align = 'center' }) {
  const mutedStops = factsMutedGradient(gradientColors);
  return (
    <View style={{ alignSelf: align }}>
      <StatColorText
        style={style}
        colors={mutedStops}
        start={GRADIENT_LEFT}
        end={GRADIENT_RIGHT}
      >
        {children}
      </StatColorText>
    </View>
  );
}

/**
 * Thin gradient accent along the top edge of a card.
 */
function CardTopAccent({ gradient }) {
  return (
    <View style={styles.cardTopAccentWrap}>
      <LinearGradient
        colors={factsMutedGradient(gradient)}
        start={GRADIENT_LEFT}
        end={GRADIENT_RIGHT}
        style={styles.cardTopAccent}
      />
    </View>
  );
}

/**
 * Faint white wash on dark cards for depth.
 */
function CardDepthOverlay({ show }) {
  if (!show) return null;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { backgroundColor: DEPTH_OVERLAY_COLOR }]}
    />
  );
}

/**
 * Fats / carbs detail list card.
 */
function DetailListCard({ section, colors, isDark, depthLayer = false }) {
  if (!section?.rows?.length) return null;
  const mutedGradient = factsMutedGradient(section.gradient || NUT_SECTION_GRADIENT);
  const headerColor = sectionHeaderColor(section.title);
  const totalIsDim = isZeroOrUnavailable(section.total);

  return (
    <View
      style={[
        styles.detailCard,
        { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        cardShadow(isDark),
      ]}
    >
      <CardDepthOverlay show={depthLayer} />
      <CardTopAccent gradient={mutedGradient} />
      <View style={styles.detailHeader}>
        <Text style={[styles.detailTitle, { color: headerColor, opacity: HEADER_TITLE_OPACITY }]}>
          {section.title}
        </Text>
        <View style={totalIsDim ? { opacity: ZERO_VALUE_OPACITY } : undefined}>
          <GradientLabel style={styles.detailTotal} colors={mutedGradient}>
            {section.total}
          </GradientLabel>
        </View>
      </View>
      {section.rows.map((row, rowIndex) => {
        const valueIsDim = isZeroOrUnavailable(row.display, row.raw);
        return (
          <View key={row.label}>
            {rowIndex > 0 ? (
              <View style={[styles.detailDivider, { backgroundColor: colors.divider }]} />
            ) : null}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{row.label}</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: colors.text, opacity: valueIsDim ? ZERO_VALUE_OPACITY : 1 },
                ]}
              >
                {row.display}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/**
 * One macro mini-card (protein / carbs / fat) with a progress bar.
 */
function MacroMiniCard({ macro, colors, isDark, depthLayer = false }) {
  const trackColor = isDark ? FACTS_PROGRESS_TRACK : LIGHT_PROGRESS_TRACK;
  const mutedGradient = factsMutedGradient(macro.gradient || NUT_CALORIES_GRADIENT);
  const valueIsDim = isZeroOrUnavailable(macro.display, macro.value);
  const fillWidth = Math.max(
    macro.pct,
    macro.value > 0 ? MIN_MACRO_FILL_WHEN_VALUE : 0,
  );

  return (
    <View
      style={[
        styles.macroMini,
        { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
        cardShadow(isDark),
      ]}
    >
      <CardDepthOverlay show={depthLayer} />
      <CardTopAccent gradient={mutedGradient} />
      <GradientLabel style={styles.macroMiniTitle} colors={mutedGradient}>
        {macro.label}
      </GradientLabel>
      <Text
        style={[
          styles.macroMiniValue,
          { color: colors.text, opacity: valueIsDim ? ZERO_VALUE_OPACITY : 1 },
        ]}
      >
        {macro.display}
      </Text>
      <View style={[styles.macroMiniTrack, { backgroundColor: trackColor }]}>
        <LinearGradient
          colors={mutedGradient}
          start={GRADIENT_LEFT}
          end={GRADIENT_RIGHT}
          style={[styles.macroMiniFill, { width: `${fillWidth}%` }]}
        />
      </View>
      <Text style={[styles.macroMiniGoal, { color: colors.textDim, opacity: GOAL_LABEL_OPACITY }]}>
        {macro.goalLabel}
      </Text>
    </View>
  );
}

/**
 * Food-count subtitle under "Today's Nutrition".
 * @param {number} foodCount
 * @returns {string}
 */
function foodCountSubtitle(foodCount) {
  if (foodCount > 0) {
    const plural = foodCount === 1 ? '' : 's';
    return `${foodCount} food item${plural} logged`;
  }
  return 'No food logged yet';
}

/**
 * Enrich one log via searchFoods.fetchNutritionDetails; cache by cleaned name.
 * @param {object} log
 * @param {Map} cache
 * @param {object} nextEnrichment
 */
async function enrichOneLog(log, cache, nextEnrichment) {
  const foodName = cleanFoodDisplayName(log.food_name);
  if (!foodName) return;

  let nutrients = cache.get(foodName);
  if (nutrients === undefined) {
    try {
      nutrients = await searchFoods.fetchNutritionDetails(foodName);
    } catch (_fetchError) {
      nutrients = null;
    }
    cache.set(foodName, nutrients);
  }
  if (!nutrients) return;

  nextEnrichment[log.id] = nutrients;
  const patch = buildLogEnrichmentPatch(log, nutrients);
  if (patch) {
    updateFoodLog(log.id, patch).catch(() => {});
  }
}

/**
 * Which logs still need micronutrient enrichment.
 * @param {Array} logs
 * @returns {Array}
 */
function logsNeedingEnrichment(logs) {
  return logs.filter((log) => log?.id && logNeedsNutrientEnrichment(log));
}

/**
 * One mineral cell in the vitamins grid.
 */
function MineralCell({ item, colors }) {
  const valueIsDim = isZeroOrUnavailable(item.value, item.raw);
  return (
    <View style={styles.microCell}>
      <Text style={[styles.microName, { color: colors.textDim }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text
        style={[
          styles.microVal,
          { color: colors.text, opacity: valueIsDim ? ZERO_VALUE_OPACITY : 1 },
        ]}
      >
        {item.value}
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-day nutrition facts: summary, calorie bar, macros, fats, carbs, vitamins.
 * @param {{ logs?: Array, goals?: object, foodCount?: number, reserveShellBottomNav?: boolean }} props
 */
export default function NutritionFactsScreen({
  logs = [],
  goals = {},
  foodCount = 0,
  reserveShellBottomNav = false,
}) {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : SCROLL_BOTTOM_PAD_DEFAULT;
  const [enrichmentByLogId, setEnrichmentByLogId] = useState({});
  const [enriching, setEnriching] = useState(false);

  // vocab: useEffect = after paint, fetch missing micros for sparse logs; cancel on unmount.
  useEffect(() => {
    let cancelled = false;
    const cache = new Map();

    async function enrichLogs() {
      const targets = logsNeedingEnrichment(logs);
      if (!targets.length) {
        if (!cancelled) {
          setEnrichmentByLogId({});
          setEnriching(false);
        }
        return;
      }

      if (!cancelled) setEnriching(true);
      const nextEnrichment = {};
      await Promise.all(
        targets.map((log) => enrichOneLog(log, cache, nextEnrichment)),
      );

      if (!cancelled) {
        setEnrichmentByLogId(nextEnrichment);
        setEnriching(false);
      }
    }

    enrichLogs();
    return () => {
      cancelled = true;
    };
  }, [logs]);

  const nutrients = useMemo(
    () => calculateDailyNutrientTotals(logs, enrichmentByLogId),
    [logs, enrichmentByLogId],
  );
  const data = useMemo(() => {
    const cards = buildDailyNutritionFactsCardData(nutrients, goals);
    return { ...cards, foodCount: foodCount || logs.length };
  }, [nutrients, goals, foodCount, logs.length]);

  const isEmpty = data.calories <= 0 && logs.length === 0;
  const calorieGradient = factsMutedGradient(data.calorieGradient || NUT_CALORIES_GRADIENT);
  const mineralsGradient = factsMutedGradient(data.minerals?.gradient || NUT_SECTION_GRADIENT);
  const summaryAccentGradient = factsMutedGradient(NUT_ACTION_GRADIENT);
  const progressTrack = isDark ? FACTS_PROGRESS_TRACK : colors.track;
  const mineralsHeaderColor = sectionHeaderColor(data.minerals.title);
  const calorieFillPct = Math.max(
    data.caloriePct,
    isEmpty ? EMPTY_CAL_FILL_PCT : MIN_CAL_FILL_WHEN_LOGGED,
  );
  const foodSubtitle = foodCountSubtitle(data.foodCount);

  return (
    <View style={[styles.root, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            cardShadow(isDark),
          ]}
        >
          <CardTopAccent gradient={summaryAccentGradient} />
          <View style={styles.summaryTop}>
            <View style={styles.summaryLeft}>
              <Text style={[styles.summaryTitle, { color: colors.text }]}>
                Today's Nutrition
              </Text>
              <Text style={[styles.summarySub, { color: colors.textMuted }]}>
                {foodSubtitle}
              </Text>
            </View>
            <View style={styles.summaryCalSlot}>
              <Text style={[styles.summaryCal, { color: FACTS_MUTED.pink }]}>
                {String(data.calories)}
              </Text>
              <Text style={[styles.summaryCalUnit, { color: FACTS_MUTED.pink }]}>CAL</Text>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.calCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            cardShadow(isDark),
          ]}
        >
          <CardDepthOverlay show={isDark} />
          <CardTopAccent gradient={calorieGradient} />
          <View style={styles.calCardTop}>
            <Text style={[styles.calCardKicker, { color: colors.textDim }]}>
              DAILY CALORIES
            </Text>
            <Text style={[styles.calCardGoal, { color: colors.textMuted }]}>
              {data.calorieGoal.toLocaleString()} kcal goal
            </Text>
          </View>
          <View style={styles.calValueRow}>
            <GradientLabel style={styles.calCardValue} colors={calorieGradient}>
              {data.calories.toLocaleString()}
            </GradientLabel>
            <Text style={[styles.calCardUnit, { color: colors.textMuted }]}> kcal</Text>
          </View>
          <View style={[styles.calTrack, { backgroundColor: progressTrack }]}>
            <LinearGradient
              colors={calorieGradient}
              start={GRADIENT_LEFT}
              end={GRADIENT_RIGHT}
              style={[styles.calFill, { width: `${calorieFillPct}%` }]}
            />
          </View>
          <Text style={[styles.calPctLabel, { color: colors.textDim }]}>
            {data.caloriePct}% of daily goal
          </Text>
        </View>

        <View style={styles.macroRow}>
          {data.macros.map((macro, macroIndex) => (
            <MacroMiniCard
              key={macro.label}
              macro={macro}
              colors={colors}
              isDark={isDark}
              depthLayer={isDark && macroIndex % 2 === 1}
            />
          ))}
        </View>

        {enriching ? (
          <Text style={[styles.enrichingHint, { color: colors.textMuted }]}>
            Loading full nutrition facts from your food database…
          </Text>
        ) : null}

        <DetailListCard
          section={data.fats}
          colors={colors}
          isDark={isDark}
          depthLayer={isDark}
        />
        <DetailListCard
          section={data.carbs}
          colors={colors}
          isDark={isDark}
          depthLayer={false}
        />

        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
            cardShadow(isDark),
          ]}
        >
          <CardDepthOverlay show={isDark} />
          <CardTopAccent gradient={mineralsGradient} />
          <View style={{ marginBottom: 14 }}>
            <Text
              style={[
                styles.detailTitle,
                { color: mineralsHeaderColor, opacity: HEADER_TITLE_OPACITY },
              ]}
            >
              {data.minerals.title}
            </Text>
          </View>
          <TwoColumnGrid
            items={data.minerals.items}
            keyExtractor={(item) => item.key}
            gap={12}
            itemWidth="48%"
            renderItem={(item) => <MineralCell item={item} colors={colors} />}
          />
        </View>

        {isEmpty ? (
          <View style={styles.emptyHint}>
            <Ionicons name={EMPTY_ICON_NAME} size={EMPTY_ICON_SIZE} color={colors.textDim} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Log food today to see your full daily nutrition breakdown — sodium, fiber, and more.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  summaryTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  summaryLeft: { flex: 1, paddingRight: 12 },
  summaryTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  summarySub: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  summaryCalSlot: { alignItems: 'flex-end' },
  summaryCal: { fontSize: 32, fontWeight: '900', lineHeight: 36 },
  summaryCalUnit: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    opacity: 0.5,
    marginTop: 4,
  },
  calCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    paddingTop: 18,
    overflow: 'hidden',
  },
  calCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calCardKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  calCardGoal: { fontSize: 12, fontWeight: '600' },
  calValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  calCardValue: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  calCardUnit: { fontSize: 16, fontWeight: '700' },
  calTrack: { height: 5, borderRadius: 3, overflow: 'hidden' },
  calFill: { height: '100%', borderRadius: 3 },
  calPctLabel: { fontSize: 11, fontWeight: '600', marginTop: 8 },
  macroRow: { flexDirection: 'row', gap: 10 },
  enrichingHint: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  macroMini: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  macroMiniTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  macroMiniValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  macroMiniTrack: {
    height: 5,
    borderRadius: 3,
    width: '100%',
    marginTop: 10,
    overflow: 'hidden',
  },
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontSize: 14, fontWeight: '600' },
  detailValue: { fontSize: 14, fontWeight: '800' },
  microCell: { gap: 4, paddingVertical: 4 },
  microName: { fontSize: 11, fontWeight: '600' },
  microVal: { fontSize: 17, fontWeight: '800' },
  emptyHint: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    fontWeight: '500',
  },
});
