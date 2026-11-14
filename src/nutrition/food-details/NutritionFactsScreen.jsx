// Design Law daily Nutrition Facts report — HardShadow cards + nb tokens only.
// Flow: enrich sparse logs from search API → total today's nutrients → calorie / macros / nutrient cards.
// Used by DailyLogContent when the user opens full daily facts (not ConfirmFoodPopup per-food).
// Read order: constants → card pieces → main screen → PLUMBING enrichment → styles.

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
import { buildDailyNutritionFactsCardData, buildLogEnrichmentPatch, calculateDailyNutrientTotals, cleanFoodDisplayName, logNeedsNutrientEnrichment } from './nutritionFactsData';

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
const MINERALS_GRID_GAP = 12;
const MINERALS_ITEM_WIDTH = '48%';
const ENRICHING_HINT = 'Loading full nutrition facts from your food database…';
const EMPTY_DAY_HINT = 'Log food today to see your full daily nutrition breakdown — sodium, fiber, and more.';
const ZERO_DISPLAY_PATTERN = /^0(\.0+)?(g|mg|mcg)$/;
const PROTEIN_ICON = require('../../assets/icons/handoff/protein.png');
const CARBS_ICON = require('../../assets/icons/handoff/carbs.png');
const FATS_ICON = require('../../assets/icons/handoff/fats.png');

// Manipulate here: progress fills only (PNG daily-log macros) — never card borders, never green
const CAL_BAR_COLORS = accentGradients[3];
const MACRO_BAR_COLORS = {
  protein: ['#60A5FA', '#818CF8'],
  carbs: ['#FDA4AF', '#FB923C'],
  fat: ['#FB7185', '#EF4444']
};

// ===== HELPER FUNCTIONS =====

function nutrientValueLooksEmpty(display, raw) {
  if (display === '—') return true;
  if (raw != null && Number(raw) <= 0) return true;
  if (typeof display === 'string' && ZERO_DISPLAY_PATTERN.test(display)) return true;
  return false;
}
function buildFoodCountSubtitle(foodCount) {
  if (foodCount <= 0) return 'No food logged yet';
  const pluralSuffix = foodCount === 1 ? '' : 's';
  return `${foodCount} food item${pluralSuffix} logged`;
}
function macroBarGradientForLabel(label) {
  const labelLower = String(label || '').toLowerCase();
  if (labelLower.includes('carb')) return MACRO_BAR_COLORS.carbs;
  if (labelLower.includes('fat')) return MACRO_BAR_COLORS.fat;
  return MACRO_BAR_COLORS.protein;
}
function macroHandoffIconForLabel(label) {
  const labelLower = String(label || '').toLowerCase();
  if (labelLower.includes('carb')) return CARBS_ICON;
  if (labelLower.includes('fat')) return FATS_ICON;
  return PROTEIN_ICON;
}
function FactsCard({
  colors,
  children,
  style
}) {
  // vocab: HardShadow = solid offset shadow (no blur) — Design Law card chrome
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={style}>
      <View style={[styles.cardInner, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        {children}
      </View>
    </HardShadow>;
}
function DetailNutrientRow({
  row,
  colors,
  showDividerAbove
}) {
  const rowLooksEmpty = nutrientValueLooksEmpty(row.display, row.raw);
  let valueOpacity;
  if (rowLooksEmpty) {
    valueOpacity = ZERO_VALUE_OPACITY;
  } else {
    valueOpacity = 1;
  }
  return <View>
      {showDividerAbove ? <View style={[styles.detailDivider, {
      backgroundColor: colors.nbBorder
    }]} /> : null}
      <View style={styles.detailRow}>
        <Text style={[styles.detailLabel, {
        color: colors.nbMuted
      }]}>{row.label}</Text>
        <Text style={[styles.detailValue, {
        color: colors.nbInk,
        opacity: valueOpacity
      }]}>
          {row.display}
        </Text>
      </View>
    </View>;
}
function DetailListCard({
  section,
  colors
}) {
  if (!section?.rows?.length) return null;
  const totalLooksEmpty = nutrientValueLooksEmpty(section.total);
  let totalOpacity;
  if (totalLooksEmpty) {
    totalOpacity = ZERO_VALUE_OPACITY;
  } else {
    totalOpacity = 1;
  }
  return <FactsCard colors={colors} style={styles.cardGap}>
      <View style={styles.detailHeader}>
        <Text style={[styles.detailTitle, {
        color: colors.nbMuted
      }]}>{section.title}</Text>
        <Text style={[styles.detailTotal, {
        color: colors.nbInk,
        opacity: totalOpacity
      }]}>
          {section.total}
        </Text>
      </View>
      {section.rows.map((row, rowIndex) => <DetailNutrientRow key={row.label} row={row} colors={colors} showDividerAbove={rowIndex > 0} />)}
    </FactsCard>;
}
function MacroMiniCard({
  macro,
  colors
}) {
  const valueLooksEmpty = nutrientValueLooksEmpty(macro.display, macro.value);
  let valueOpacity;
  if (valueLooksEmpty) {
    valueOpacity = ZERO_VALUE_OPACITY;
  } else {
    valueOpacity = 1;
  }
  const minimumFillWhenLogged = macro.value > 0 ? MIN_MACRO_FILL_WHEN_VALUE : 0;
  const fillWidth = Math.max(macro.pct, minimumFillWhenLogged);
  const barColors = macroBarGradientForLabel(macro.label);
  const progressFraction = Math.min(1, Math.max(0, fillWidth / 100));
  const handoffIcon = macroHandoffIconForLabel(macro.label);
  return <FactsCard colors={colors} style={styles.macroMiniOuter}>
      <Image source={handoffIcon} style={styles.macroIcon} resizeMode="contain" />
      <Text style={[styles.macroMiniTitle, {
      color: colors.nbMuted
    }]}>{macro.label}</Text>
      <Text style={[styles.macroMiniValue, {
      color: colors.nbInk,
      opacity: valueOpacity
    }]}>
        {macro.display}
      </Text>
      <NbProgressBar progress={progressFraction} colors={barColors} style={{
      marginTop: 10
    }} />
      <Text style={[styles.macroMiniGoal, {
      color: colors.nbMuted
    }]}>{macro.goalLabel}</Text>
    </FactsCard>;
}
function MineralCell({
  item,
  colors
}) {
  const valueLooksEmpty = nutrientValueLooksEmpty(item.value, item.raw);
  let valueOpacity;
  if (valueLooksEmpty) {
    valueOpacity = ZERO_VALUE_OPACITY;
  } else {
    valueOpacity = 1;
  }
  return <View style={styles.microCell}>
      <Text style={[styles.microName, {
      color: colors.nbMuted
    }]} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={[styles.microVal, {
      color: colors.nbInk,
      opacity: valueOpacity
    }]}>
        {item.value}
      </Text>
    </View>;
}
function DailyCaloriesCard({
  screenData,
  calorieProgress,
  colors
}) {
  const goalLabel = `${screenData.calorieGoal.toLocaleString()} kcal goal`;
  const caloriesLabel = screenData.calories.toLocaleString();
  const percentLabel = `${screenData.caloriePct}% of daily goal`;
  return <FactsCard colors={colors} style={styles.cardGap}>
      <View style={styles.calCardTop}>
        <Text style={[styles.calCardKicker, {
        color: colors.nbMuted
      }]}>DAILY CALORIES</Text>
        <Text style={[styles.calCardGoal, {
        color: colors.nbMuted
      }]}>{goalLabel}</Text>
      </View>
      <View style={styles.calValueRow}>
        <Text style={[styles.calCardValue, {
        color: colors.nbInk
      }]}>{caloriesLabel}</Text>
        <Text style={[styles.calCardUnit, {
        color: colors.nbMuted
      }]}> kcal</Text>
      </View>
      <NbProgressBar progress={calorieProgress} colors={CAL_BAR_COLORS} />
      <Text style={[styles.calPctLabel, {
      color: colors.nbMuted
    }]}>{percentLabel}</Text>
    </FactsCard>;
}
function MineralsCard({
  minerals,
  colors
}) {
  return <FactsCard colors={colors} style={styles.cardGap}>
      <Text style={[styles.detailTitle, {
      color: colors.nbMuted,
      marginBottom: 14
    }]}>
        {minerals.title}
      </Text>
      <TwoColumnGrid items={minerals.items} keyExtractor={item => item.key} gap={MINERALS_GRID_GAP} itemWidth={MINERALS_ITEM_WIDTH} renderItem={item => <MineralCell item={item} colors={colors} />} />
    </FactsCard>;
}
function InlineFactsHeader({
  title,
  subtitle,
  colors
}) {
  return <View style={styles.inlineHeader}>
      <Text style={[styles.summaryTitle, {
      color: colors.nbInk
    }]}>{title}</Text>
      <Text style={[styles.summarySub, {
      color: colors.nbMuted
    }]}>{subtitle}</Text>
    </View>;
}
function EmptyDayHint({
  colors
}) {
  return <View style={styles.emptyHint}>
      <Ionicons name={EMPTY_ICON_NAME} size={EMPTY_ICON_SIZE} color={colors.nbMuted} />
      <Text style={[styles.emptyText, {
      color: colors.nbMuted
    }]}>{EMPTY_DAY_HINT}</Text>
    </View>;
}

// ===== MAIN FUNCTION =====

/**
 * Full-day Nutrition Facts scroll — calorie card, macro minis, fat/carb lists, minerals.
 * Hook order frozen: theme → shell inset → enrichment state → enrich effect → totals memos.
 */
export default function NutritionFactsScreen({
  logs = [],
  goals = {},
  foodCount = 0,
  reserveShellBottomNav = false,
  onBack
}) {
  // 1. Theme + scroll padding when the shell bottom nav is visible.
  // vocab: useTheme / useShellBottomNavInset — Design Law colors + safe pad above tab bar
  const {
    colors
  } = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);
  let scrollBottomPad;
  if (reserveShellBottomNav) {
    scrollBottomPad = shellBottomPad;
  } else {
    scrollBottomPad = SCROLL_BOTTOM_PAD_DEFAULT;
  } // 2. Session cache: log id → API micros fetched this visit.
  // vocab: useState = React local state; enrichmentByLogId keys are Firestore log ids
  const [enrichmentByLogId, setEnrichmentByLogId] = useState({});
  const [enriching, setEnriching] = useState(false);

  // 3. After paint, back-fill sparse logs; cancel when logs change or screen unmounts.
  // vocab: useEffect = run after paint; cleanup sets effectCancelled so late API results are ignored
  useEffect(() => {
    let effectCancelled = false;
    const nutrientsByFoodName = new Map();
    async function runEnrichmentPass() {
      const targetLogs = pickLogsThatNeedEnrichment(logs);
      if (!targetLogs.length) {
        // Read effectCancelled from this closure (not a copied boolean) after awaits.
        if (!effectCancelled) {
          setEnrichmentByLogId({});
          setEnriching(false);
        }
        return;
      }
      if (!effectCancelled) setEnriching(true);
      const nextEnrichment = {};
      await askServerForAllSparseLogs(targetLogs, nutrientsByFoodName, nextEnrichment);
      if (!effectCancelled) {
        setEnrichmentByLogId(nextEnrichment);
        setEnriching(false);
      }
    }
    runEnrichmentPass();
    return () => {
      effectCancelled = true;
    };
  }, [logs]);

  // 4. Sum nutrients for the day, then shape HardShadow card view-models.
  // vocab: useMemo = recompute only when deps change (logs / enrichment / goals)
  const nutrients = useMemo(() => calculateDailyNutrientTotals(logs, enrichmentByLogId), [logs, enrichmentByLogId]);
  const screenData = useMemo(() => {
    const cardBundle = buildDailyNutritionFactsCardData(nutrients, goals);
    return {
      ...cardBundle,
      foodCount: foodCount || logs.length
    };
  }, [nutrients, goals, foodCount, logs.length]);

  // 5. Calorie bar fill, subtitle, and empty-state flag for the scroll body.
  const dayLooksEmpty = screenData.calories <= 0 && logs.length === 0;
  let minimumCalFill;
  if (dayLooksEmpty) {
    minimumCalFill = EMPTY_CAL_FILL_PCT;
  } else {
    minimumCalFill = MIN_CAL_FILL_WHEN_LOGGED;
  }
  const calorieFillPct = Math.max(screenData.caloriePct, minimumCalFill);
  const calorieProgress = Math.min(1, Math.max(0, calorieFillPct / 100));
  const headerSubtitle = buildFoodCountSubtitle(screenData.foodCount);
  const parentSuppliesBack = typeof onBack === 'function';

  // 6. Scroll: calorie card → macro minis → fat/carb detail → minerals → empty hint.
  return <View style={[styles.root, {
    backgroundColor: colors.nbBackground
  }]}>
      {parentSuppliesBack ? <NbPageHeader title="Nutrition facts" subtitle={headerSubtitle} onBack={onBack} skipTopSafeInset /> : null}

      <ScrollView contentContainerStyle={[styles.scroll, {
      paddingBottom: scrollBottomPad
    }]} showsVerticalScrollIndicator={false}>
        {!parentSuppliesBack ? <InlineFactsHeader title="Nutrition facts" subtitle={headerSubtitle} colors={colors} /> : null}

        <DailyCaloriesCard screenData={screenData} calorieProgress={calorieProgress} colors={colors} />

        <View style={styles.macroRow}>
          {screenData.macros.map(macro => <MacroMiniCard key={macro.label} macro={macro} colors={colors} />)}
        </View>

        {enriching ? <Text style={[styles.enrichingHint, {
        color: colors.nbMuted
      }]}>{ENRICHING_HINT}</Text> : null}

        <DetailListCard section={screenData.fats} colors={colors} />
        <DetailListCard section={screenData.carbs} colors={colors} />

        <MineralsCard minerals={screenData.minerals} colors={colors} />

        {dayLooksEmpty ? <EmptyDayHint colors={colors} /> : null}
      </ScrollView>
    </View>;
}

// PLUMBING — enrichment + StyleSheet. Skip unless debugging sparse-log API fill.

function pickLogsThatNeedEnrichment(logs) {
  const sparseLogs = [];
  for (let index = 0; index < logs.length; index += 1) {
    const log = logs[index];
    if (log?.id && logNeedsNutrientEnrichment(log)) sparseLogs.push(log);
  }
  return sparseLogs;
}
async function enrichOneSparseLog(log, nameCache, enrichmentByLogId) {
  const cleanedName = cleanFoodDisplayName(log.food_name);
  if (!cleanedName) return;
  let nutrientsFromApi = nameCache.get(cleanedName);
  if (nutrientsFromApi === undefined) {
    try {
      nutrientsFromApi = await searchFoods.fetchNutritionDetails(cleanedName);
    } catch (_fetchError) {
      nutrientsFromApi = null;
    }
    nameCache.set(cleanedName, nutrientsFromApi);
  }
  if (!nutrientsFromApi) return;
  enrichmentByLogId[log.id] = nutrientsFromApi;
  const firestorePatch = buildLogEnrichmentPatch(log, nutrientsFromApi);
  if (firestorePatch) {
    // Fire-and-forget — screen still paints from enrichmentByLogId even if write fails
    updateFoodLog(log.id, firestorePatch).catch(() => {});
  }
}
async function askServerForAllSparseLogs(targetLogs, nutrientsByFoodName, nextEnrichment) {
  const waitList = [];
  for (let index = 0; index < targetLogs.length; index += 1) {
    waitList.push(enrichOneSparseLog(targetLogs[index], nutrientsByFoodName, nextEnrichment));
  }
  await Promise.all(waitList);
}
const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    gap: 12
  },
  inlineHeader: {
    marginBottom: 4
  },
  summaryTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.3
  },
  summarySub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 4
  },
  cardInner: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
    overflow: 'hidden'
  },
  cardGap: {
    marginBottom: 0
  },
  calCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  calCardKicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 1.2
  },
  calCardGoal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12
  },
  calValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12
  },
  calCardValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 36,
    letterSpacing: -0.8,
    fontVariant: ['tabular-nums']
  },
  calCardUnit: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16
  },
  calPctLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 8
  },
  macroRow: {
    flexDirection: 'row',
    gap: 10
  },
  macroMiniOuter: {
    flex: 1
  },
  macroIcon: {
    width: MACRO_ICON_SIZE,
    height: MACRO_ICON_SIZE,
    alignSelf: 'center',
    marginBottom: 4
  },
  macroMiniTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
    marginBottom: 6,
    textAlign: 'center'
  },
  macroMiniValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.5,
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  macroMiniGoal: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center'
  },
  enrichingHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 4
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  detailTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.5
  },
  detailTotal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums']
  },
  detailDivider: {
    height: StyleSheet.hairlineWidth * 2,
    opacity: 0.35,
    marginVertical: 10
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  detailLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14
  },
  detailValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums']
  },
  microCell: {
    gap: 4,
    paddingVertical: 4
  },
  microName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11
  },
  microVal: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 17,
    fontVariant: ['tabular-nums']
  },
  emptyHint: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center'
  }
});