import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Leaf, Droplets, Heart, Sparkles, Waves, Zap } from 'lucide-react-native';
import {
  gradients,
  gradientsSoft,
  radii,
  fonts,
  accentTint,
  getNutritionPanelPalette,
} from './theme';

function microGradientForKey(key, np) {
  const cycle = np.microGradients || [
    brandGradients.goldPink,
    brandGradients.orangePink,
    brandGradients.cyanPurple,
    brandGradients.orangePurple,
  ];
  const order = ['fiber', 'saturatedFat', 'cholesterol', 'sugar', 'sodium', 'potassium'];
  const idx = order.indexOf(key);
  return cycle[(idx >= 0 ? idx : 0) % cycle.length];
}

const MICRO_CONFIG = [
  { key: 'fiber', label: 'Fiber', icon: Leaf, dailyValue: 28 },
  { key: 'saturatedFat', label: 'Sat. fat', icon: Droplets, dailyValue: 20 },
  { key: 'cholesterol', label: 'Cholesterol', icon: Heart, dailyValue: 300 },
  { key: 'sugar', label: 'Sugar', icon: Sparkles, dailyValue: 50 },
  { key: 'sodium', label: 'Sodium', icon: Waves, dailyValue: 2300 },
  { key: 'potassium', label: 'Potassium', icon: Zap, dailyValue: 4700 },
];

const MACRO_LEGEND = [
  { key: 'carbs', label: 'Carbs', gradient: gradients.carbs, soft: gradientsSoft.carbs },
  { key: 'protein', label: 'Protein', gradient: gradients.protein, soft: gradientsSoft.protein },
  { key: 'fat', label: 'Fat', gradient: gradients.fat, soft: gradientsSoft.fat },
];

function MacroLegendChip({ label, grams, pct, softStops, np }) {
  return (
    <View style={[styles.legendChip, { borderColor: np.tileBorder, backgroundColor: np.tileBg }]}>
      <View style={styles.legendChipRow}>
        <LinearGradient colors={softStops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.legendDot} />
        <Text style={[styles.legendLabel, { color: np.textMuted }]}>{label}</Text>
      </View>
      <Text style={[styles.legendGrams, { color: np.text }]}>{Math.round(Number(grams) || 0)}g</Text>
      <Text style={[styles.legendPct, { color: np.textSubtle }]}>{Math.round(Number(pct) || 0)}% of cals</Text>
    </View>
  );
}

function CompositionBar({ percents, np }) {
  const { carbs = 0, protein = 0, fat = 0 } = percents || {};
  const total = carbs + protein + fat || 1;
  const segments = [
    { flex: carbs / total, colors: gradientsSoft.carbs },
    { flex: protein / total, colors: gradientsSoft.protein },
    { flex: fat / total, colors: gradientsSoft.fat },
  ].filter((s) => s.flex > 0.001);

  return (
    <View style={[styles.compositionWrap, { backgroundColor: np.trackBg }]}>
      <View style={styles.compositionTrack}>
        {segments.map((seg, i) => (
          <LinearGradient
            key={`macro-seg-${i}`}
            colors={seg.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.compositionSegment, { flex: seg.flex }]}
          />
        ))}
      </View>
    </View>
  );
}

function MicroStatTile({ config, data, np }) {
  const Icon = config.icon;
  const raw = Number(data?.value);
  if (!Number.isFinite(raw) || raw <= 0) return null;

  const softGradient = microGradientForKey(config.key, np);
  const unit = data?.unit || 'g';
  const dvPct = config.dailyValue
    ? Math.min(999, Math.round((raw / config.dailyValue) * 100))
    : null;
  const barPct = dvPct != null ? Math.min(100, dvPct) : 0;

  return (
    <View style={[styles.microTile, { borderColor: np.tileBorder, backgroundColor: np.tileBg }]}>
      <View
        style={[
          styles.microIconRing,
          { backgroundColor: accentTint(softGradient[1], 0.14) },
        ]}
      >
        <Icon size={14} color={softGradient[1]} strokeWidth={2.2} />
      </View>

      <View style={styles.microTileBody}>
        <Text style={[styles.microTileLabel, { color: np.textMuted }]}>{config.label}</Text>
        <View style={styles.microValueRow}>
          <Text style={[styles.microTileValue, { color: np.text }]}>{data.value}</Text>
          <Text style={[styles.microTileUnit, { color: np.textMuted }]}>{unit}</Text>
        </View>
        {dvPct != null ? (
          <View style={[styles.dvBadge, { backgroundColor: accentTint(softGradient[1], 0.1), borderColor: accentTint(softGradient[1], 0.22) }]}>
            <Text style={[styles.dvBadgeText, { color: softGradient[1] }]}>
              {dvPct}% DV
            </Text>
          </View>
        ) : null}
        <View style={[styles.microBarTrack, { backgroundColor: np.trackBg }]}>
          <View
            style={[
              styles.microBarFill,
              {
                width: `${Math.max(barPct, 8)}%`,
                backgroundColor: accentTint(softGradient[1], 0.55),
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Premium expanded nutrition breakdown — macro split + stylized facts panel.
 */
export default function NutritionFactsSection({
  carbs = 0,
  protein = 0,
  fat = 0,
  macroPercents = {},
  micronutrients = {},
  serving,
  isDark = true,
  embedded = false,
}) {
  const np = useMemo(() => getNutritionPanelPalette(isDark, { embedded }), [isDark, embedded]);

  const visibleMicros = useMemo(
    () =>
      MICRO_CONFIG.filter((cfg) => {
        const v = Number(micronutrients?.[cfg.key]?.value);
        return Number.isFinite(v) && v > 0;
      }),
    [micronutrients],
  );

  return (
    <View style={styles.root}>
      <View style={styles.breakdownHeader}>
        <Text style={[styles.breakdownTitle, { color: np.text }]}>Calorie breakdown</Text>
        {serving ? (
          <Text style={[styles.breakdownServing, { color: np.textSubtle }]} numberOfLines={1}>
            {serving}
          </Text>
        ) : null}
      </View>

      <CompositionBar percents={macroPercents} np={np} />

      <View style={styles.legendRow}>
        {MACRO_LEGEND.map(({ key, label, gradient, soft }) => (
          <MacroLegendChip
            key={key}
            label={label}
            grams={key === 'carbs' ? carbs : key === 'protein' ? protein : fat}
            pct={macroPercents[key]}
            softStops={soft}
            np={np}
          />
        ))}
      </View>

      <View style={[styles.panelShell, { borderColor: np.panelBorder, backgroundColor: np.panelBg }]}>
        <View style={styles.panelInner}>
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderText}>
              <Text style={[styles.panelTitle, { color: np.text }]}>Nutrition Facts</Text>
              <Text style={[styles.panelSubtitle, { color: np.textMuted }]}>
                Per logged serving
              </Text>
            </View>
            <View style={[styles.panelBadge, { backgroundColor: np.badgeBg, borderColor: np.badgeBorder }]}>
              <Text style={[styles.panelBadgeText, { color: np.textMuted }]}>
                {visibleMicros.length} tracked
              </Text>
            </View>
          </View>

          <View style={[styles.panelRule, { backgroundColor: np.ruleColor }]} />

          {visibleMicros.length > 0 ? (
            <View style={styles.microGrid}>
              {MICRO_CONFIG.map((cfg) => (
                <MicroStatTile
                  key={cfg.key}
                  config={cfg}
                  data={micronutrients[cfg.key]}
                  np={np}
                />
              ))}
            </View>
          ) : (
            <View style={[styles.emptyMicros, { borderColor: np.tileBorder }]}>
              <Text style={[styles.emptyMicrosText, { color: np.textMuted }]}>
                No detailed micronutrients for this entry — macros above are still logged.
              </Text>
            </View>
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
    height: 1,
    borderRadius: 1,
    marginBottom: 14,
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
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 6,
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
