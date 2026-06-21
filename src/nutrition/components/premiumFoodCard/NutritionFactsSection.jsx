import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Leaf, Droplets, Heart, Sparkles, Waves, Zap } from 'lucide-react-native';
import GradientText from './GradientText';
import {
  gradients,
  brandGradients,
  radii,
  fonts,
  pillBackgroundGradient,
  getNutritionPanelPalette,
} from './theme';

function microGradientForKey(key, np) {
  const cycle = np.microGradients || [
    brandGradients.gold,
    brandGradients.orange,
    brandGradients.pink,
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
  { key: 'carbs', label: 'Carbs', gradient: gradients.carbs },
  { key: 'protein', label: 'Protein', gradient: gradients.protein },
  { key: 'fat', label: 'Fat', gradient: gradients.fat },
];

function MacroLegendChip({ label, grams, pct, gradientStops, np }) {
  const bg = pillBackgroundGradient(gradientStops, { strong: true });

  return (
    <View style={[styles.legendChip, { borderColor: np.tileBorder, backgroundColor: np.tileBg }]}>
      <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.legendChipRow}>
        <LinearGradient colors={gradientStops} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.legendDot} />
        <Text style={[styles.legendLabel, { color: np.textMuted }]}>{label}</Text>
      </View>
      <GradientText colors={gradientStops} style={styles.legendGrams}>
        {Math.round(Number(grams) || 0)}g
      </GradientText>
      <Text style={[styles.legendPct, { color: np.textSubtle }]}>{Math.round(Number(pct) || 0)}% of cals</Text>
    </View>
  );
}

function CompositionBar({ percents, np }) {
  const { carbs = 0, protein = 0, fat = 0 } = percents || {};
  const total = carbs + protein + fat || 1;
  const segments = [
    { flex: carbs / total, colors: gradients.carbs },
    { flex: protein / total, colors: gradients.protein },
    { flex: fat / total, colors: gradients.fat },
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

  const gradient = microGradientForKey(config.key, np);
  const unit = data?.unit || 'g';
  const dvPct = config.dailyValue
    ? Math.min(999, Math.round((raw / config.dailyValue) * 100))
    : null;
  const barPct = dvPct != null ? Math.min(100, dvPct) : 0;

  return (
    <View style={[styles.microTile, { borderColor: np.tileBorder, backgroundColor: np.tileBg }]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.microIconRing}
      >
        <Icon size={14} color={np.iconOnGradient} strokeWidth={2.4} />
      </LinearGradient>

      <View style={styles.microTileBody}>
        <Text style={[styles.microTileLabel, { color: np.textMuted }]}>{config.label}</Text>
        <View style={styles.microValueRow}>
          <Text style={[styles.microTileValue, { color: np.text }]}>{data.value}</Text>
          <Text style={[styles.microTileUnit, { color: np.textMuted }]}>{unit}</Text>
        </View>
        {dvPct != null ? (
          <LinearGradient
            colors={pillBackgroundGradient(gradient, { strong: true })}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.dvBadge}
          >
            <GradientText colors={gradient} style={styles.dvBadgeText}>
              {dvPct}% DV
            </GradientText>
          </LinearGradient>
        ) : null}
        <View style={[styles.microBarTrack, { backgroundColor: np.trackBg }]}>
          <LinearGradient
            colors={gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.microBarFill, { width: `${Math.max(barPct, 8)}%` }]}
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
        <GradientText colors={np.breakdownGradient} style={styles.breakdownTitle}>
          Calorie breakdown
        </GradientText>
        {serving ? (
          <Text style={[styles.breakdownServing, { color: np.textSubtle }]} numberOfLines={1}>
            {serving}
          </Text>
        ) : null}
      </View>

      <CompositionBar percents={macroPercents} np={np} />

      <View style={styles.legendRow}>
        {MACRO_LEGEND.map(({ key, label, gradient }) => (
          <MacroLegendChip
            key={key}
            label={label}
            grams={key === 'carbs' ? carbs : key === 'protein' ? protein : fat}
            pct={macroPercents[key]}
            gradientStops={gradient}
            np={np}
          />
        ))}
      </View>

      <View style={styles.panelShell}>
        <LinearGradient
          colors={np.borderStops}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.panelBorder}
        />
        <View style={[styles.panelInner, { backgroundColor: np.panelBg }]}>
          <LinearGradient
            colors={[
              pillBackgroundGradient(brandGradients.gold, { strong: true })[0],
              pillBackgroundGradient(brandGradients.pink, { strong: true })[1],
              'transparent',
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.panelWash}
            pointerEvents="none"
          />

          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderText}>
              <GradientText colors={np.titleGradient} style={styles.panelTitle}>
                Nutrition Facts
              </GradientText>
              <Text style={[styles.panelSubtitle, { color: np.textMuted }]}>
                Per logged serving
              </Text>
            </View>
            <View style={[styles.panelBadge, { backgroundColor: np.badgeBg, borderColor: np.badgeBorder }]}>
              <Text style={[styles.panelBadgeText, { color: np.text }]}>
                {visibleMicros.length} tracked
              </Text>
            </View>
          </View>

          <LinearGradient
            colors={np.ruleGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.panelRule}
          />

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
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    gap: 3,
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
    overflow: 'hidden',
  },
  panelBorder: {
    ...StyleSheet.absoluteFillObject,
  },
  panelInner: {
    margin: 2,
    borderRadius: radii.chip + 4,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    overflow: 'hidden',
  },
  panelWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.45,
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
    height: 3,
    borderRadius: 2,
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
