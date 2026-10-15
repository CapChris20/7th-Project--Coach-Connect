// Expanded nutrition breakdown under a food card: calorie split bar + micronutrient tiles.
// Flow: build palette → show macro composition → list legend chips → paint micronutrient tiles (or empty state).
// Used by: FoodCard when the row is expanded.

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Leaf, Droplets, Heart, Sparkles, Waves, Zap } from 'lucide-react-native';
import ColorText from './ColorText';
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
const ICON_SIZE = 14;
const ICON_STROKE = 2.2;
const MIN_SEGMENT_FLEX = 0.001;
const MAX_DV_DISPLAY_PCT = 999;
const MAX_BAR_PCT = 100;
const MIN_BAR_WIDTH_PCT = 8;
const FALLBACK_MACRO_TOTAL = 1;
const DEFAULT_MICRO_UNIT = 'g';

// Manipulate here: FDA-style daily values used for the % DV badges on micro tiles.
const DAILY_VALUE_FIBER_G = 28;
const DAILY_VALUE_SAT_FAT_G = 20;
const DAILY_VALUE_CHOLESTEROL_MG = 300;
const DAILY_VALUE_SUGAR_G = 50;
const DAILY_VALUE_SODIUM_MG = 2300;
const DAILY_VALUE_POTASSIUM_MG = 4700;

const MICRO_GRADIENT_MAP = {
  fiber: brandColors.goldPink,
  saturatedFat: brandColors.orangePink,
  cholesterol: brandColors.orangePurple,
  sugar: brandColors.goldPink,
  sodium: brandColors.orangePink,
  potassium: brandColors.cyanPurple,
};

const MICRO_CONFIG = [
  { key: 'fiber', label: 'Fiber', icon: Leaf, dailyValue: DAILY_VALUE_FIBER_G },
  { key: 'saturatedFat', label: 'Sat. fat', icon: Droplets, dailyValue: DAILY_VALUE_SAT_FAT_G },
  { key: 'cholesterol', label: 'Cholesterol', icon: Heart, dailyValue: DAILY_VALUE_CHOLESTEROL_MG },
  { key: 'sugar', label: 'Sugar', icon: Sparkles, dailyValue: DAILY_VALUE_SUGAR_G },
  { key: 'sodium', label: 'Sodium', icon: Waves, dailyValue: DAILY_VALUE_SODIUM_MG },
  { key: 'potassium', label: 'Potassium', icon: Zap, dailyValue: DAILY_VALUE_POTASSIUM_MG },
];

const MACRO_LEGEND = [
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
function microGradientForKey(nutrientKey) {
  return MICRO_GRADIENT_MAP[nutrientKey] || brandColors.orangePink;
}

/**
 * True when a micronutrient entry has a positive numeric value.
 * @param {object|undefined} microEntry
 * @returns {boolean}
 */
function hasPositiveMicroValue(microEntry) {
  const numericValue = Number(microEntry?.value);
  return Number.isFinite(numericValue) && numericValue > 0;
}

/**
 * Which micronutrient rows to show for this food (only ones with data).
 * @param {object} micronutrients
 * @returns {object[]}
 */
function visibleMicroConfigs(micronutrients) {
  return MICRO_CONFIG.filter((config) => hasPositiveMicroValue(micronutrients?.[config.key]));
}

/**
 * Grams for a legend key from the three macro props.
 * @param {string} macroKey
 * @param {number} carbs
 * @param {number} protein
 * @param {number} fat
 * @returns {number}
 */
function gramsForMacroKey(macroKey, carbs, protein, fat) {
  if (macroKey === 'carbs') return carbs;
  if (macroKey === 'protein') return protein;
  return fat;
}

/**
 * Build composition-bar segments from calorie percents. Tiny slices are dropped.
 * @param {object} percents
 * @returns {Array<{ flex: number, colors: string[] }>}
 */
function compositionSegmentsFromPercents(percents) {
  const carbsPct = percents?.carbs || 0;
  const proteinPct = percents?.protein || 0;
  const fatPct = percents?.fat || 0;
  const total = carbsPct + proteinPct + fatPct || FALLBACK_MACRO_TOTAL;
  const rawSegments = [
    { flex: carbsPct / total, colors: gradients.carbs },
    { flex: proteinPct / total, colors: gradients.protein },
    { flex: fatPct / total, colors: gradients.fat },
  ];
  return rawSegments.filter((segment) => segment.flex > MIN_SEGMENT_FLEX);
}

/**
 * % DV for a micro value, capped so a bad number cannot blow the badge.
 * @param {number} rawValue
 * @param {number|undefined} dailyValue
 * @returns {number|null}
 */
function dailyValuePercent(rawValue, dailyValue) {
  if (!dailyValue) return null;
  return Math.min(MAX_DV_DISPLAY_PCT, Math.round((rawValue / dailyValue) * MAX_BAR_PCT));
}

/**
 * Bar fill width as a percent string, with a minimum so tiny DVs still show a nub.
 * @param {number|null} dvPct
 * @returns {string}
 */
function microBarWidthPercent(dvPct) {
  const barPct = dvPct != null ? Math.min(MAX_BAR_PCT, dvPct) : 0;
  return `${Math.max(barPct, MIN_BAR_WIDTH_PCT)}%`;
}

/**
 * One legend chip under the composition bar (label + grams + % of cals).
 */
function MacroLegendChip({ label, grams, pct, gradientStops, panelPalette }) {
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
      <Text style={[styles.legendGrams, { color: panelPalette.text }]}>
        {Math.round(Number(grams) || 0)}g
      </Text>
      <Text style={[styles.legendPct, { color: panelPalette.textSubtle }]}>
        {Math.round(Number(pct) || 0)}% of cals
      </Text>
    </View>
  );
}

/**
 * Horizontal calorie-split bar (carbs / protein / fat).
 */
function CompositionBar({ percents, panelPalette }) {
  const segments = compositionSegmentsFromPercents(percents);

  return (
    <View style={[styles.compositionWrap, { backgroundColor: panelPalette.trackBg }]}>
      <View style={styles.compositionTrack}>
        {segments.map((segment, segmentIndex) => (
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

/**
 * One micronutrient tile with icon, value, optional % DV badge, and progress bar.
 * Returns null when the value is missing or zero.
 */
function MicroStatTile({ config, data, panelPalette }) {
  const Icon = config.icon;
  const rawValue = Number(data?.value);
  if (!Number.isFinite(rawValue) || rawValue <= 0) return null;

  const gradient = microGradientForKey(config.key);
  const unit = data?.unit || DEFAULT_MICRO_UNIT;
  const dvPct = dailyValuePercent(rawValue, config.dailyValue);
  const barWidth = microBarWidthPercent(dvPct);

  return (
    <View
      style={[
        styles.microTile,
        { borderColor: panelPalette.tileBorder, backgroundColor: panelPalette.tileBg },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={styles.microIconRing}
      >
        <Icon size={ICON_SIZE} color={ICON_COLOR_ON_GRADIENT} strokeWidth={ICON_STROKE} />
      </LinearGradient>

      <View style={styles.microTileBody}>
        <Text style={[styles.microTileLabel, { color: panelPalette.textMuted }]}>
          {config.label}
        </Text>
        <View style={styles.microValueRow}>
          <Text style={[styles.microTileValue, { color: panelPalette.text }]}>{data.value}</Text>
          <Text style={[styles.microTileUnit, { color: panelPalette.textMuted }]}>{unit}</Text>
        </View>
        {dvPct != null ? (
          <LinearGradient
            colors={pillBackgroundGradient(gradient, { strong: true })}
            start={GRADIENT_LEFT_TO_RIGHT.start}
            end={GRADIENT_LEFT_TO_RIGHT.end}
            style={styles.dvBadge}
          >
            <ColorText colors={gradient} style={styles.dvBadgeText}>
              {dvPct}% DV
            </ColorText>
          </LinearGradient>
        ) : null}
        <View style={[styles.microBarTrack, { backgroundColor: panelPalette.trackBg }]}>
          <LinearGradient
            colors={gradient}
            start={GRADIENT_LEFT_TO_RIGHT.start}
            end={GRADIENT_LEFT_TO_RIGHT.end}
            style={[styles.microBarFill, { width: barWidth }]}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Empty state when no micronutrients are present for this entry.
 */
function EmptyMicrosMessage({ panelPalette }) {
  return (
    <View style={[styles.emptyMicros, { borderColor: panelPalette.tileBorder }]}>
      <Text style={[styles.emptyMicrosText, { color: panelPalette.textMuted }]}>
        No detailed micronutrients for this entry — macros above are still logged.
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Premium expanded nutrition breakdown — macro split + stylized facts panel.
 * @param {{ carbs?: number, protein?: number, fat?: number, macroPercents?: object, micronutrients?: object, serving?: string, isDark?: boolean, embedded?: boolean }} props
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
  // 1. Palette for dark / light and embedded vs standalone.
  const panelPalette = useMemo(
    () => getNutritionPanelPalette(isDark, { embedded }),
    [isDark, embedded],
  );

  // 2. Only show micro tiles that have real numbers.
  const visibleMicros = useMemo(
    () => visibleMicroConfigs(micronutrients),
    [micronutrients],
  );

  const trackedCountLabel = `${visibleMicros.length} tracked`;
  const hasVisibleMicros = visibleMicros.length > 0;

  return (
    <View style={styles.root}>
      <View style={styles.breakdownHeader}>
        <Text style={[styles.breakdownTitle, { color: panelPalette.text }]}>
          Calorie breakdown
        </Text>
        {serving ? (
          <Text
            style={[styles.breakdownServing, { color: panelPalette.textSubtle }]}
            numberOfLines={1}
          >
            {serving}
          </Text>
        ) : null}
      </View>

      <CompositionBar percents={macroPercents} panelPalette={panelPalette} />

      <View style={styles.legendRow}>
        {MACRO_LEGEND.map(({ key: macroKey, label, gradient }) => (
          <MacroLegendChip
            key={macroKey}
            label={label}
            grams={gramsForMacroKey(macroKey, carbs, protein, fat)}
            pct={macroPercents[macroKey]}
            gradientStops={gradient}
            panelPalette={panelPalette}
          />
        ))}
      </View>

      <View
        style={[
          styles.panelShell,
          { borderColor: panelPalette.panelBorder, backgroundColor: panelPalette.panelBg },
        ]}
      >
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

          <LinearGradient
            colors={brandColors.orangePurple}
            start={GRADIENT_LEFT_TO_RIGHT.start}
            end={GRADIENT_LEFT_TO_RIGHT.end}
            style={styles.panelRule}
          />

          {hasVisibleMicros ? (
            <View style={styles.microGrid}>
              {MICRO_CONFIG.map((config) => (
                <MicroStatTile
                  key={config.key}
                  config={config}
                  data={micronutrients[config.key]}
                  panelPalette={panelPalette}
                />
              ))}
            </View>
          ) : (
            <EmptyMicrosMessage panelPalette={panelPalette} />
          )}
        </View>
      </View>
    </View>
  );
}

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
    borderWidth: 1,
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
  panelShell: {
    borderRadius: radii.chip + 6,
    borderWidth: 1,
    overflow: 'hidden',
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
    borderWidth: 1,
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
    borderWidth: 1,
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
