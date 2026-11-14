// Expanded macro split + micronutrient tiles under an open FoodCard.
// Flow: panel palette → calorie bar → legend chips → HardShadow “Nutrition Facts” grid.
// Used by FoodCard when the row is expanded.
// vocab: HardShadow = solid offset shadow (no blur). Design Law ink divider only — no purple rule chrome.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Leaf, Droplets, Heart, Sparkles, Waves, Zap } from 'lucide-react-native';
import ColorText from './ColorText';
import HardShadow from '../../look-and-feel/HardShadow';
import { nb, borderRadius, lightColors } from '../../look-and-feel/colorPalette';
import {
  brandColors,
  gradients,
  radii,
  fonts,
  pillBackgroundGradient,
  getNutritionPanelPalette,
} from './foodCardColors';

// ===== NAMED CONSTANTS =====

const GRADIENT_LEFT_TO_RIGHT = { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
const GRADIENT_DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
const ICON_COLOR_ON_GRADIENT = '#FFFFFF';
const ICON_SIZE_PX = 14;
const ICON_STROKE_WIDTH = 2.2;
const MIN_SEGMENT_FLEX = 0.001;
const MAX_DAILY_VALUE_DISPLAY_PERCENT = 999;
const MAX_PROGRESS_BAR_PERCENT = 100;
const MIN_PROGRESS_BAR_WIDTH_PERCENT = 8;
const FALLBACK_MACRO_PERCENT_TOTAL = 1;
const DEFAULT_MICRO_UNIT = 'g';

// Manipulate here: FDA-style daily values for % DV badges on micro tiles.
const DAILY_VALUE_FIBER_GRAMS = 28;
const DAILY_VALUE_SATURATED_FAT_GRAMS = 20;
const DAILY_VALUE_CHOLESTEROL_MG = 300;
const DAILY_VALUE_SUGAR_GRAMS = 50;
const DAILY_VALUE_SODIUM_MG = 2300;
const DAILY_VALUE_POTASSIUM_MG = 4700;

const GRADIENT_STOPS_BY_MICRO_KEY = {
  fiber: brandColors.goldPink,
  saturatedFat: brandColors.orangePink,
  cholesterol: brandColors.orangePurple,
  sugar: brandColors.goldPink,
  sodium: brandColors.orangePink,
  potassium: brandColors.cyanPurple,
};

const MICRO_TILE_CONFIG_ROWS = [
  { key: 'fiber', label: 'Fiber', icon: Leaf, dailyValue: DAILY_VALUE_FIBER_GRAMS },
  { key: 'saturatedFat', label: 'Sat. fat', icon: Droplets, dailyValue: DAILY_VALUE_SATURATED_FAT_GRAMS },
  { key: 'cholesterol', label: 'Cholesterol', icon: Heart, dailyValue: DAILY_VALUE_CHOLESTEROL_MG },
  { key: 'sugar', label: 'Sugar', icon: Sparkles, dailyValue: DAILY_VALUE_SUGAR_GRAMS },
  { key: 'sodium', label: 'Sodium', icon: Waves, dailyValue: DAILY_VALUE_SODIUM_MG },
  { key: 'potassium', label: 'Potassium', icon: Zap, dailyValue: DAILY_VALUE_POTASSIUM_MG },
];

const MACRO_LEGEND_CHIP_ROWS = [
  { key: 'carbs', label: 'Carbs', gradient: gradients.carbs },
  { key: 'protein', label: 'Protein', gradient: gradients.protein },
  { key: 'fat', label: 'Fat', gradient: gradients.fat },
];

// ===== HELPER FUNCTIONS =====

/**
 * Gradient stops for one micronutrient key. Unknown keys fall back to orange→pink.
 * @param {string} nutrientKey
 * @returns {string[]}
 */
function gradientStopsForMicroKey(nutrientKey) {
  const knownStops = GRADIENT_STOPS_BY_MICRO_KEY[nutrientKey];
  if (knownStops) return knownStops;
  return brandColors.orangePink;
}

/**
 * True when a micronutrient entry has a positive numeric value.
 * @param {{ value?: * }|null|undefined} microEntry
 * @returns {boolean}
 */
function microEntryHasPositiveNumber(microEntry) {
  const numericValue = Number(microEntry?.value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

/**
 * Only the micro tile configs that have real numbers on this food.
 * @param {object} micronutrients
 * @returns {typeof MICRO_TILE_CONFIG_ROWS}
 */
function microTileConfigsWithData(micronutrients) {
  const configsWithData = [];
  for (let index = 0; index < MICRO_TILE_CONFIG_ROWS.length; index += 1) {
    const tileConfig = MICRO_TILE_CONFIG_ROWS[index];
    if (microEntryHasPositiveNumber(micronutrients?.[tileConfig.key])) {
      configsWithData.push(tileConfig);
    }
  }
  return configsWithData;
}

/**
 * Grams for one legend chip key from the three macro props.
 * @param {string} macroKey
 * @param {number} carbsGrams
 * @param {number} proteinGrams
 * @param {number} fatGrams
 * @returns {number}
 */
function gramsForLegendMacroKey(macroKey, carbsGrams, proteinGrams, fatGrams) {
  if (macroKey === 'carbs') return carbsGrams;
  if (macroKey === 'protein') return proteinGrams;
  // Legend only has carbs / protein / fat — anything else is treated as fat grams.
  return fatGrams;
}

/**
 * Safe number for bar math — missing / NaN becomes 0.
 * @param {unknown} value
 * @returns {number}
 */
function percentOrZero(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) return numericValue;
  return 0;
}

/**
 * Flex segments for the calorie composition bar (skip near-zero slices).
 * @param {{ carbs?: number, protein?: number, fat?: number }} macroPercents
 * @returns {{ flex: number, colors: string[] }[]}
 */
function compositionBarSegmentsFromPercents(macroPercents) {
  const carbsPercent = percentOrZero(macroPercents?.carbs);
  const proteinPercent = percentOrZero(macroPercents?.protein);
  const fatPercent = percentOrZero(macroPercents?.fat);
  const rawPercentTotal = carbsPercent + proteinPercent + fatPercent;
  let percentTotal = rawPercentTotal;
  if (!percentTotal) {
    percentTotal = FALLBACK_MACRO_PERCENT_TOTAL;
  }

  const allSegments = [
    { flex: carbsPercent / percentTotal, colors: gradients.carbs },
    { flex: proteinPercent / percentTotal, colors: gradients.protein },
    { flex: fatPercent / percentTotal, colors: gradients.fat },
  ];

  const visibleSegments = [];
  for (let index = 0; index < allSegments.length; index += 1) {
    const segment = allSegments[index];
    const segmentIsVisible = segment.flex > MIN_SEGMENT_FLEX;
    if (segmentIsVisible) visibleSegments.push(segment);
  }
  return visibleSegments;
}

/**
 * Cap and round a raw amount into a % Daily Value for the badge.
 * @param {number} rawValue
 * @param {number} dailyValue
 * @returns {number|null}
 */
function dailyValuePercentForAmount(rawValue, dailyValue) {
  if (!dailyValue) return null;
  const rawPercent = Math.round((rawValue / dailyValue) * MAX_PROGRESS_BAR_PERCENT);
  return Math.min(MAX_DAILY_VALUE_DISPLAY_PERCENT, rawPercent);
}

/**
 * CSS width string for the micro progress fill (never thinner than the min).
 * @param {number|null} dailyValuePercent
 * @returns {string}
 */
function microProgressBarWidthPercent(dailyValuePercent) {
  let barPercent = 0;
  if (dailyValuePercent != null) {
    barPercent = Math.min(MAX_PROGRESS_BAR_PERCENT, dailyValuePercent);
  }
  const widthPercent = Math.max(barPercent, MIN_PROGRESS_BAR_WIDTH_PERCENT);
  return `${widthPercent}%`;
}

function MacroLegendChip({ label, grams, percentOfCalories, gradientStops, panelPalette }) {
  const roundedGrams = Math.round(Number(grams) || 0);
  const roundedPercent = Math.round(Number(percentOfCalories) || 0);

  return (
    <View
      style={[
        styles.legendChip,
        { borderColor: panelPalette.tileBorder, backgroundColor: panelPalette.tileBg },
      ]}
    >
      <View style={styles.legendChipRow}>
        <LinearGradient
          colors={gradientStops}
          start={GRADIENT_LEFT_TO_RIGHT.start}
          end={GRADIENT_LEFT_TO_RIGHT.end}
          style={styles.legendDot}
        />
        <Text style={[styles.legendLabel, { color: panelPalette.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.legendGrams, { color: panelPalette.text }]}>{roundedGrams}g</Text>
      <Text style={[styles.legendPct, { color: panelPalette.textSubtle }]}>
        {roundedPercent}% of cals
      </Text>
    </View>
  );
}

function MacroCompositionBar({ macroPercents, panelPalette }) {
  const barSegments = compositionBarSegmentsFromPercents(macroPercents);

  return (
    <View style={[styles.compositionWrap, { backgroundColor: panelPalette.trackBg }]}>
      <View style={styles.compositionTrack}>
        {barSegments.map((segment, segmentIndex) => (
          <LinearGradient
            key={`macro-seg-${segmentIndex}`}
            colors={segment.colors}
            start={GRADIENT_LEFT_TO_RIGHT.start}
            end={GRADIENT_LEFT_TO_RIGHT.end}
            style={[styles.compositionSegment, { flex: segment.flex }]}
          />
        ))}
      </View>
    </View>
  );
}

function DailyValueBadge({ dailyValuePercent, gradientStops }) {
  if (dailyValuePercent == null) return null;

  return (
    <LinearGradient
      colors={pillBackgroundGradient(gradientStops, { strong: true })}
      start={GRADIENT_LEFT_TO_RIGHT.start}
      end={GRADIENT_LEFT_TO_RIGHT.end}
      style={styles.dvBadge}
    >
      <ColorText colors={gradientStops} style={styles.dvBadgeText}>
        {dailyValuePercent}% DV
      </ColorText>
    </LinearGradient>
  );
}

function MicroNutrientTile({ tileConfig, microData, panelPalette }) {
  const IconComponent = tileConfig.icon;
  const rawValue = Number(microData?.value);
  if (!Number.isFinite(rawValue) || rawValue <= 0) return null;

  const gradientStops = gradientStopsForMicroKey(tileConfig.key);
  const displayUnit = microData?.unit || DEFAULT_MICRO_UNIT;
  const dailyValuePercent = dailyValuePercentForAmount(rawValue, tileConfig.dailyValue);
  const barWidth = microProgressBarWidthPercent(dailyValuePercent);

  return (
    <View
      style={[
        styles.microTile,
        { borderColor: panelPalette.tileBorder, backgroundColor: panelPalette.tileBg },
      ]}
    >
      <LinearGradient
        colors={gradientStops}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={styles.microIconRing}
      >
        <IconComponent
          size={ICON_SIZE_PX}
          color={ICON_COLOR_ON_GRADIENT}
          strokeWidth={ICON_STROKE_WIDTH}
        />
      </LinearGradient>

      <View style={styles.microTileBody}>
        <Text style={[styles.microTileLabel, { color: panelPalette.textMuted }]}>
          {tileConfig.label}
        </Text>
        <View style={styles.microValueRow}>
          <Text style={[styles.microTileValue, { color: panelPalette.text }]}>
            {microData.value}
          </Text>
          <Text style={[styles.microTileUnit, { color: panelPalette.textMuted }]}>
            {displayUnit}
          </Text>
        </View>
        <DailyValueBadge dailyValuePercent={dailyValuePercent} gradientStops={gradientStops} />
        <View style={[styles.microBarTrack, { backgroundColor: panelPalette.trackBg }]}>
          <LinearGradient
            colors={gradientStops}
            start={GRADIENT_LEFT_TO_RIGHT.start}
            end={GRADIENT_LEFT_TO_RIGHT.end}
            style={[styles.microBarFill, { width: barWidth }]}
          />
        </View>
      </View>
    </View>
  );
}

function NoMicronutrientsMessage({ panelPalette }) {
  return (
    <View style={[styles.emptyMicros, { borderColor: panelPalette.tileBorder }]}>
      <Text style={[styles.emptyMicrosText, { color: panelPalette.textMuted }]}>
        No detailed micronutrients for this entry — macros above are still logged.
      </Text>
    </View>
  );
}

function CalorieBreakdownHeader({ servingLabel, panelPalette }) {
  return (
    <View style={styles.breakdownHeader}>
      <Text style={[styles.breakdownTitle, { color: panelPalette.text }]}>Calorie breakdown</Text>
      {servingLabel ? (
        <Text
          style={[styles.breakdownServing, { color: panelPalette.textSubtle }]}
          numberOfLines={1}
        >
          {servingLabel}
        </Text>
      ) : null}
    </View>
  );
}

function NutritionFactsHardShadowPanel({
  panelPalette,
  trackedCountLabel,
  showMicroGrid,
  micronutrients,
}) {
  const panelShellStyle = {
    backgroundColor: panelPalette.panelBg,
    borderWidth: nb.borderWidth,
    borderColor: lightColors.nbBorder,
    borderRadius: borderRadius.nbCard,
  };
  const ruleInkColor = panelPalette.textMuted || lightColors.nbBorder;

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View style={panelShellStyle}>
        <View style={styles.panelInner}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderText}>
              <ColorText colors={panelPalette.titleGradient} style={styles.panelTitle}>
                Nutrition Facts
              </ColorText>
              <Text style={[styles.panelSubtitle, { color: panelPalette.textMuted }]}>
                Per logged serving
              </Text>
            </View>
            <View
              style={[
                styles.panelBadge,
                {
                  backgroundColor: panelPalette.badgeBg,
                  borderColor: panelPalette.badgeBorder,
                },
              ]}
            >
              <Text style={[styles.panelBadgeText, { color: panelPalette.textMuted }]}>
                {trackedCountLabel}
              </Text>
            </View>
          </View>

          {/* Design Law — ink divider only (no purple gradient rule chrome) */}
          <View style={[styles.panelRule, { backgroundColor: ruleInkColor }]} />

          {showMicroGrid ? (
            <View style={styles.microGrid}>
              {MICRO_TILE_CONFIG_ROWS.map((tileConfig) => (
                <MicroNutrientTile
                  key={tileConfig.key}
                  tileConfig={tileConfig}
                  microData={micronutrients[tileConfig.key]}
                  panelPalette={panelPalette}
                />
              ))}
            </View>
          ) : (
            <NoMicronutrientsMessage panelPalette={panelPalette} />
          )}
        </View>
      </View>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Expanded nutrition panel under a FoodCard: calorie bar, legend, micronutrient tiles.
 * @param {object} props
 * @param {number} [props.carbs]
 * @param {number} [props.protein]
 * @param {number} [props.fat]
 * @param {object} [props.macroPercents]
 * @param {object} [props.micronutrients]
 * @param {string} [props.serving]
 * @param {boolean} [props.isDark]
 * @param {boolean} [props.embedded]
 */
export default function NutritionFactsPanel({
  carbs = 0,
  protein = 0,
  fat = 0,
  macroPercents = {},
  micronutrients = {},
  serving,
  isDark = true,
  embedded = false,
}) {
  // 1. Dark vs light + embedded meal section vs standalone card.
  // vocab: useMemo = React hook that caches a value until deps change
  const panelPalette = useMemo(
    () => getNutritionPanelPalette(isDark, { embedded }),
    [isDark, embedded],
  );

  // 2. Count micros with real numbers (badge label + empty state).
  const microRowsWithData = useMemo(
    () => microTileConfigsWithData(micronutrients),
    [micronutrients],
  );

  const trackedCountLabel = `${microRowsWithData.length} tracked`;
  const showMicroGrid = microRowsWithData.length > 0;

  return (
    <View style={styles.root}>
      <CalorieBreakdownHeader servingLabel={serving} panelPalette={panelPalette} />

      <MacroCompositionBar macroPercents={macroPercents} panelPalette={panelPalette} />

      <View style={styles.legendRow}>
        {MACRO_LEGEND_CHIP_ROWS.map(({ key: macroKey, label, gradient }) => (
          <MacroLegendChip
            key={macroKey}
            label={label}
            grams={gramsForLegendMacroKey(macroKey, carbs, protein, fat)}
            percentOfCalories={macroPercents[macroKey]}
            gradientStops={gradient}
            panelPalette={panelPalette}
          />
        ))}
      </View>

      <NutritionFactsHardShadowPanel
        panelPalette={panelPalette}
        trackedCountLabel={trackedCountLabel}
        showMicroGrid={showMicroGrid}
        micronutrients={micronutrients}
      />
    </View>
  );
}

// PLUMBING — layout tokens (StyleSheet numbers stay inline per Design Law / CODING_STYLE).

const styles = StyleSheet.create({
  root: {
    gap: 0,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  breakdownTitle: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    letterSpacing: 0.2,
  },
  breakdownServing: {
    flex: 1,
    fontSize: 12,
    fontFamily: fonts.medium,
    textAlign: 'right',
  },
  compositionWrap: {
    borderRadius: 999,
    padding: 4,
  },
  compositionTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 2,
  },
  compositionSegment: {
    height: '100%',
    borderRadius: 999,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 18,
  },
  legendChip: {
    flex: 1,
    borderRadius: radii.chip,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  legendChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  legendGrams: {
    marginTop: 6,
    fontSize: 17,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  legendPct: {
    marginTop: 3,
    fontSize: 10,
    fontFamily: fonts.medium,
  },
  panelInner: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  panelHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    letterSpacing: 0.1,
  },
  panelSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontFamily: fonts.medium,
  },
  panelBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  panelBadgeText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
  },
  panelRule: {
    height: 2,
    borderRadius: 1,
    marginBottom: 14,
    opacity: 0.85,
  },
  microGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  microTile: {
    width: '47%',
    flexGrow: 1,
    flexShrink: 0,
    borderRadius: radii.chip + 2,
    borderWidth: nb.borderWidth,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  microIconRing: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  microTileBody: {
    flex: 1,
    minWidth: 0,
  },
  microTileLabel: {
    fontSize: 10,
    fontFamily: fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  microValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 4,
  },
  microTileValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  microTileUnit: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
  },
  dvBadge: {
    alignSelf: 'flex-start',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
    overflow: 'hidden',
  },
  dvBadgeText: {
    fontSize: 10,
    fontFamily: fonts.bold,
  },
  microBarTrack: {
    height: 5,
    borderRadius: 999,
    marginTop: 10,
    overflow: 'hidden',
  },
  microBarFill: {
    height: '100%',
    borderRadius: 999,
    minWidth: 6,
  },
  emptyMicros: {
    borderRadius: radii.chip,
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  emptyMicrosText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    lineHeight: 18,
    textAlign: 'center',
  },
});
