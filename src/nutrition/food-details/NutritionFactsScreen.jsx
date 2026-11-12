// Design Law daily Nutrition Facts report — HardShadow cards + nb tokens only.
// Flow: enrich sparse logs from search API → total today's nutrients → calorie / macros / nutrient cards.
// Used by DailyLogContent when the user opens full daily facts (not ConfirmFoodPopup per-food).
//
// vocab: HardShadow = solid offset shadow (no blur); enrichment = fill missing micros from search API

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import TwoColumnGrid from '../../look-and-feel/TwoColumnGrid';
import HardShadow from '../../look-and-feel/HardShadow';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import { accentGradients, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';
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
// Manipulate here: tiny fill so empty-looking bars still read as “started” once food is logged
const MIN_CAL_FILL_WHEN_LOGGED = 3;
const MIN_MACRO_FILL_WHEN_VALUE = 4;
const ZERO_VALUE_OPACITY = 0.35;
const EMPTY_ICON_NAME = 'nutrition-outline';
const EMPTY_ICON_SIZE = 28;
const MACRO_ICON_SIZE = 18;

const PROTEIN_ICON = require('../../assets/icons/handoff/protein.png');
const CARBS_ICON = require('../../assets/icons/handoff/carbs.png');
const FATS_ICON = require('../../assets/icons/handoff/fats.png');

// Manipulate here: progress fills only (PNG daily-log macros) — never card borders, never green
const CAL_BAR_COLORS = accentGradients[3];
const MACRO_BAR_COLORS = {
  protein: ['#60A5FA', '#818CF8'],
  carbs: ['#FDA4AF', '#FB923C'],
  fat: ['#FB7185', '#EF4444'],
};

// ===== HELPER FUNCTIONS =====

/**
 * Dim zero / dash values so missing micros don't look like real zeros.
 */
function isZeroOrUnavailable(display, raw) {
  if (display === '—') return true;
  if (raw != null && Number(raw) <= 0) return true;
  if (typeof display === 'string' && /^0(\.0+)?(g|mg|mcg)$/.test(display)) return true;
  return false;
}

function foodCountSubtitle(foodCount) {
  if (foodCount > 0) {
    const plural = foodCount === 1 ? '' : 's';
    return `${foodCount} food item${plural} logged`;
  }
  return 'No food logged yet';
}

/**
 * Fetch micros for one sparse log, cache by cleaned name, optionally patch Firestore.
 * Why: many logs only store calories/macros; the daily report needs fiber/sodium/etc.
 */
async function enrichOneLog(log, cache, nextEnrichment) {
  const foodName = cleanFoodDisplayName(log.food_name);
  if (!foodName) return;

  // vocab: Map cache = same food name → one API hit for many logs of that food
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
    // Fire-and-forget — UI already has enrichmentByLogId for this session
    updateFoodLog(log.id, patch).catch(() => {});
  }
}

function logsNeedingEnrichment(logs) {
  return logs.filter((log) => log?.id && logNeedsNutrientEnrichment(log));
}

function macroBarColorsForLabel(label) {
  const key = String(label || '').toLowerCase();
  if (key.includes('carb')) return MACRO_BAR_COLORS.carbs;
  if (key.includes('fat')) return MACRO_BAR_COLORS.fat;
  return MACRO_BAR_COLORS.protein;
}

function macroIconForLabel(label) {
  const key = String(label || '').toLowerCase();
  if (key.includes('carb')) return CARBS_ICON;
  if (key.includes('fat')) return FATS_ICON;
  return PROTEIN_ICON;
}

/**
 * HardShadow shell for every facts card — 3px ink border, surface fill, no gradient chrome.
 */
function FactsCard({ colors, children, style }) {
  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={style}>
      <View
        style={[
          styles.cardInner,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        {children}
      </View>
    </HardShadow>
  );
}

/**
 * Fats / carbs detail list inside one HardShadow card.
 */
function DetailListCard({ section, colors }) {
  if (!section?.rows?.length) return null;
  const totalIsDim = isZeroOrUnavailable(section.total);

  return (
    <FactsCard colors={colors} style={styles.cardGap}>
      <View style={styles.detailHeader}>
        <Text style={[styles.detailTitle, { color: colors.nbMuted }]}>{section.title}</Text>
        <Text
          style={[
            styles.detailTotal,
            { color: colors.nbInk, opacity: totalIsDim ? ZERO_VALUE_OPACITY : 1 },
          ]}
        >
          {section.total}
        </Text>
      </View>
      {section.rows.map((row, rowIndex) => {
        const valueIsDim = isZeroOrUnavailable(row.display, row.raw);
        return (
          <View key={row.label}>
            {rowIndex > 0 ? (
              <View style={[styles.detailDivider, { backgroundColor: colors.nbBorder }]} />
            ) : null}
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.nbMuted }]}>{row.label}</Text>
              <Text
                style={[
                  styles.detailValue,
                  { color: colors.nbInk, opacity: valueIsDim ? ZERO_VALUE_OPACITY : 1 },
                ]}
              >
                {row.display}
              </Text>
            </View>
          </View>
        );
      })}
    </FactsCard>
  );
}

/**
 * One macro mini-card (protein / carbs / fat) with owner icon + NbProgressBar fill.
 */
function MacroMiniCard({ macro, colors }) {
  const valueIsDim = isZeroOrUnavailable(macro.display, macro.value);
  // Tiny minimum fill when value > 0 so thin bars stay visible
  const fillWidth = Math.max(
    macro.pct,
    macro.value > 0 ? MIN_MACRO_FILL_WHEN_VALUE : 0,
  );
  const barColors = macroBarColorsForLabel(macro.label);
  // vocab: NbProgressBar wants 0–1 fraction, card data stores 0–100 pct
  const progress = Math.min(1, Math.max(0, fillWidth / 100));

  return (
    <FactsCard colors={colors} style={styles.macroMiniOuter}>
      <Image
        source={macroIconForLabel(macro.label)}
        style={styles.macroIcon}
        resizeMode="contain"
      />
      <Text style={[styles.macroMiniTitle, { color: colors.nbMuted }]}>{macro.label}</Text>
      <Text
        style={[
          styles.macroMiniValue,
          { color: colors.nbInk, opacity: valueIsDim ? ZERO_VALUE_OPACITY : 1 },
        ]}
      >
        {macro.display}
      </Text>
      <NbProgressBar progress={progress} colors={barColors} style={{ marginTop: 10 }} />
      <Text style={[styles.macroMiniGoal, { color: colors.nbMuted }]}>{macro.goalLabel}</Text>
    </FactsCard>
  );
}

function MineralCell({ item, colors }) {
  const valueIsDim = isZeroOrUnavailable(item.value, item.raw);
  return (
    <View style={styles.microCell}>
      <Text style={[styles.microName, { color: colors.nbMuted }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text
        style={[
          styles.microVal,
          { color: colors.nbInk, opacity: valueIsDim ? ZERO_VALUE_OPACITY : 1 },
        ]}
      >
        {item.value}
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-day nutrition facts: calorie bar, macros, fats, carbs, vitamins.
 * @param {{ logs?: Array, goals?: object, foodCount?: number, reserveShellBottomNav?: boolean, onBack?: Function }} props
 */
export default function NutritionFactsScreen({
  logs = [],
  goals = {},
  foodCount = 0,
  reserveShellBottomNav = false,
  onBack,
}) {
  const { colors } = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : SCROLL_BOTTOM_PAD_DEFAULT;
  const [enrichmentByLogId, setEnrichmentByLogId] = useState({});
  const [enriching, setEnriching] = useState(false);

  // After paint: fill missing micros for sparse logs; cancel if logs change / unmount.
  // vocab: cancelled flag = ignore late API results after cleanup (stale closure guard)
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
      // Parallel fetches; cache above keeps same-name foods to one request
      await Promise.all(targets.map((log) => enrichOneLog(log, cache, nextEnrichment)));

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

  // Sum scaled nutrients across every log, merging session enrichment map
  const nutrients = useMemo(
    () => calculateDailyNutrientTotals(logs, enrichmentByLogId),
    [logs, enrichmentByLogId],
  );
  const data = useMemo(() => {
    const cards = buildDailyNutritionFactsCardData(nutrients, goals);
    return { ...cards, foodCount: foodCount || logs.length };
  }, [nutrients, goals, foodCount, logs.length]);

  const isEmpty = data.calories <= 0 && logs.length === 0;
  const calorieFillPct = Math.max(
    data.caloriePct,
    isEmpty ? EMPTY_CAL_FILL_PCT : MIN_CAL_FILL_WHEN_LOGGED,
  );
  const calorieProgress = Math.min(1, Math.max(0, calorieFillPct / 100));
  const foodSubtitle = foodCountSubtitle(data.foodCount);

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      {/* NbPageHeader owns back + title when DailyLogContent passes onBack */}
      {typeof onBack === 'function' ? (
        <NbPageHeader
          title="Nutrition facts"
          subtitle={foodSubtitle}
          onBack={onBack}
          skipTopSafeInset
        />
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Inline title only when embedded without a header (rare / tests) */}
        {!onBack ? (
          <View style={styles.inlineHeader}>
            <Text style={[styles.summaryTitle, { color: colors.nbInk }]}>Nutrition facts</Text>
            <Text style={[styles.summarySub, { color: colors.nbMuted }]}>{foodSubtitle}</Text>
          </View>
        ) : null}

        {/* HardShadow calorie summary — goal % bar uses accentGradients only */}
        <FactsCard colors={colors} style={styles.cardGap}>
          <View style={styles.calCardTop}>
            <Text style={[styles.calCardKicker, { color: colors.nbMuted }]}>DAILY CALORIES</Text>
            <Text style={[styles.calCardGoal, { color: colors.nbMuted }]}>
              {data.calorieGoal.toLocaleString()} kcal goal
            </Text>
          </View>
          <View style={styles.calValueRow}>
            <Text style={[styles.calCardValue, { color: colors.nbInk }]}>
              {data.calories.toLocaleString()}
            </Text>
            <Text style={[styles.calCardUnit, { color: colors.nbMuted }]}> kcal</Text>
          </View>
          <NbProgressBar progress={calorieProgress} colors={CAL_BAR_COLORS} />
          <Text style={[styles.calPctLabel, { color: colors.nbMuted }]}>
            {data.caloriePct}% of daily goal
          </Text>
        </FactsCard>

        {/* HardShadow macro minis — one card per macro */}
        <View style={styles.macroRow}>
          {data.macros.map((macro) => (
            <MacroMiniCard key={macro.label} macro={macro} colors={colors} />
          ))}
        </View>

        {enriching ? (
          <Text style={[styles.enrichingHint, { color: colors.nbMuted }]}>
            Loading full nutrition facts from your food database…
          </Text>
        ) : null}

        {/* HardShadow nutrient sections */}
        <DetailListCard section={data.fats} colors={colors} />
        <DetailListCard section={data.carbs} colors={colors} />

        <FactsCard colors={colors} style={styles.cardGap}>
          <Text style={[styles.detailTitle, { color: colors.nbMuted, marginBottom: 14 }]}>
            {data.minerals.title}
          </Text>
          <TwoColumnGrid
            items={data.minerals.items}
            keyExtractor={(item) => item.key}
            gap={12}
            itemWidth="48%"
            renderItem={(item) => <MineralCell item={item} colors={colors} />}
          />
        </FactsCard>

        {isEmpty ? (
          <View style={styles.emptyHint}>
            <Ionicons name={EMPTY_ICON_NAME} size={EMPTY_ICON_SIZE} color={colors.nbMuted} />
            <Text style={[styles.emptyText, { color: colors.nbMuted }]}>
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
  scroll: { paddingHorizontal: spacing.md, paddingTop: 8, gap: 12 },
  inlineHeader: { marginBottom: 4 },
  summaryTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.3,
  },
  summarySub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 4,
  },
  cardInner: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    overflow: 'hidden',
  },
  cardGap: { marginBottom: 0 },
  calCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  calCardKicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 1.2,
  },
  calCardGoal: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  calValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  calCardValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 36,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums'],
  },
  calCardUnit: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 },
  calPctLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 8,
  },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroMiniOuter: { flex: 1 },
  macroIcon: {
    width: MACRO_ICON_SIZE,
    height: MACRO_ICON_SIZE,
    alignSelf: 'center',
    marginBottom: 4,
  },
  macroMiniTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center',
  },
  macroMiniValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  macroMiniGoal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
  enrichingHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.5,
  },
  detailTotal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  detailDivider: { height: StyleSheet.hairlineWidth * 2, opacity: 0.35, marginVertical: 10 },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  detailValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  microCell: { gap: 4, paddingVertical: 4 },
  microName: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  microVal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  emptyHint: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});
