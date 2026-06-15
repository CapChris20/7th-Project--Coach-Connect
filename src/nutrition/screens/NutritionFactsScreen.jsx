/**
 * Nutrition Facts Screen
 *
 * Purpose: UI screen or component: Nutrition Facts Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: NutritionFactsScreen
 *
 * @file-header
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../../shared/ui/ThemeContext';
import { useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import CenteredTwoColumnGrid from '../../shared/layout/CenteredTwoColumnGrid';
import {
  NUT_CALORIES_GRADIENT,
  NUT_SECTION_GRADIENT,
} from '../nutritionTheme';
import foodSearchProvider from '../services/foodSearchProvider';
import {
  buildNutritionFactsCardData,
  cleanFoodDisplayName,
  countKnownMicros,
  extractNutrientsFromLog,
  getServingLabel,
  mergeEnrichedNutrients,
} from '../food-details/parseNutritionLabel';

const NUT_NEUTRAL_TRACK = { dark: 'rgba(255,255,255,0.12)', light: 'rgba(0,0,0,0.08)' };

function getColors(isDark) {
  return isDark
    ? {
        screenBg: '#0A0A0F',
        cardBg: '#0A0A0F',
        cardBorder: 'rgba(255,255,255,0.08)',
        mealOuterBg: 'rgba(124,58,237,0.22)',
        innerBg: 'rgba(255,255,255,0.05)',
        innerBorder: 'rgba(255,255,255,0.14)',
        text: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.55)',
        textVeryMuted: 'rgba(255,255,255,0.38)',
        inputBg: 'rgba(255,255,255,0.08)',
        hotPink: '#FF6B9D',
      }
    : {
        screenBg: '#F2F2F7',
        cardBg: '#FFFFFF',
        cardBorder: '#E5E5EA',
        mealOuterBg: '#EDE9FE',
        innerBg: 'rgba(0,0,0,0.03)',
        innerBorder: 'rgba(0,0,0,0.08)',
        text: '#1C1C1E',
        textMuted: 'rgba(28,28,30,0.55)',
        textVeryMuted: 'rgba(28,28,30,0.4)',
        inputBg: '#F2F2F7',
        hotPink: '#E11D48',
      };
}

function cardShadow(isDark) {
  if (isDark) return {};
  return Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 },
    android: { elevation: 3 },
  });
}

function SectionHead({ label, colors, isDark }) {
  return (
    <View style={s.sectionHead}>
      <Text style={[s.sectionKicker, { color: colors.textVeryMuted }]}>{label}</Text>
      <LinearGradient colors={NUT_SECTION_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.sectionLine} />
    </View>
  );
}

function ArcRing({ size, stroke, progress, gradientColors, trackColor, isDark, centerLabel, subLabel }) {
  const cx = size / 2;
  const r = (size - stroke) / 2;
  const circumference = Math.PI * 2 * r;
  const offset = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;
  const gradId = `factsArc-${size}-${gradientColors.join('-')}`;
  const innerDiscR = Math.max(r - stroke / 2 - 8, size * 0.2);
  const innerFill = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const innerStroke = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)';

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Defs>
          <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors[0]} />
            <Stop offset="100%" stopColor={gradientColors[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx={cx} cy={cx} r={innerDiscR} fill={innerFill} stroke={innerStroke} strokeWidth={1} />
        <Circle cx={cx} cy={cx} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        {progress > 0 ? (
          <Circle
            cx={cx}
            cy={cx}
            r={r}
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, s.arcCenter]}>
        <Text style={[s.arcCenterMain, { color: isDark ? '#fff' : '#1C1C1E' }]}>{centerLabel}</Text>
        {subLabel ? (
          <Text style={[s.arcCenterSub, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(28,28,30,0.55)' }]}>
            {subLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function MacroBarRow({ row, colors, isDark, isFirst }) {
  const track = isDark ? NUT_NEUTRAL_TRACK.dark : NUT_NEUTRAL_TRACK.light;
  return (
    <View style={[s.barRow, !isFirst && s.barRowGap]}>
      <View style={s.barRowTop}>
        <Text style={[s.barLabel, { color: colors.textMuted }]}>{row.label}</Text>
        <Text style={[s.barValue, { color: colors.text }]}>{row.display}</Text>
      </View>
      <View style={[s.barTrack, { backgroundColor: track }]}>
        <View style={[s.barFill, { width: `${Math.max(row.fillPct, row.value > 0 ? 6 : 0)}%`, backgroundColor: row.color }]} />
      </View>
    </View>
  );
}

function NutrientSectionCard({ title, rows, colors, isDark }) {
  if (!rows?.length) return null;
  return (
    <View style={[s.sectionCard, { backgroundColor: colors.mealOuterBg }, cardShadow(isDark)]}>
      <SectionHead label={title} colors={colors} isDark={isDark} />
      <View style={[s.sectionInner, { backgroundColor: colors.innerBg, borderColor: colors.innerBorder }]}>
        {rows.map((row, idx) => (
          <MacroBarRow key={row.label} row={row} colors={colors} isDark={isDark} isFirst={idx === 0} />
        ))}
      </View>
    </View>
  );
}

export default function NutritionFactsScreen({ log, logs, goals, foodCount = 0, reserveShellBottomNav = false }) {
  const { isDark } = useTheme();
  const effectiveLog = useMemo(() => {
    if (log) return log;
    if (!Array.isArray(logs) || !logs.length) return null;
    if (logs.length === 1) return logs[0];
    const sum = logs.reduce(
      (acc, item) => ({
        calories: acc.calories + (Number(item.calories) || 0),
        protein: acc.protein + (Number(item.protein) || 0),
        carbs: acc.carbs + (Number(item.carbs) || 0),
        fat: acc.fat + (Number(item.fat) || 0),
        fiber: acc.fiber + (Number(item.fiber) || 0),
        sugar: acc.sugar + (Number(item.sugar) || 0),
        sodium: acc.sodium + (Number(item.sodium) || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
    );
    return {
      food_name: `Today's intake (${foodCount || logs.length} items)`,
      ...sum,
      metadata: { source: 'daily_aggregate' },
    };
  }, [log, logs, foodCount]);

  const colors = useMemo(() => getColors(isDark), [isDark]);
  const shellBottomPad = useShellBottomNavInset(16);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : 24;
  const trackColor = isDark ? NUT_NEUTRAL_TRACK.dark : NUT_NEUTRAL_TRACK.light;

  const [enriched, setEnriched] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const baseNutrients = useMemo(() => extractNutrientsFromLog(effectiveLog), [effectiveLog]);
  const nutrients = useMemo(
    () => mergeEnrichedNutrients(baseNutrients, enriched, effectiveLog),
    [baseNutrients, enriched, effectiveLog],
  );
  const cards = useMemo(() => buildNutritionFactsCardData(nutrients), [nutrients]);

  const foodName = cleanFoodDisplayName(effectiveLog?.food_name);
  const brand = effectiveLog?.brand || effectiveLog?.metadata?.brand || '';
  const serving = getServingLabel(effectiveLog);
  const microCount = countKnownMicros(nutrients);

  useEffect(() => {
    let cancelled = false;
    if (countKnownMicros(baseNutrients) >= 3 || !effectiveLog?.food_name) return undefined;

    (async () => {
      setLoadingDetails(true);
      try {
        const searchQ = cleanFoodDisplayName(effectiveLog.food_name) || effectiveLog.food_name;
        const data = await foodSearchProvider.fetchNutritionDetails(searchQ);
        if (!cancelled && data?.nutrients) setEnriched(data.nutrients);
      } finally {
        if (!cancelled) setLoadingDetails(false);
      }
    })();

    return () => { cancelled = true; };
  }, [effectiveLog?.food_name, baseNutrients]);

  if (!effectiveLog) {
    return (
      <View style={[s.root, { backgroundColor: colors.screenBg, padding: 24 }]}>
        <Text style={{ color: colors.textMuted, textAlign: 'center' }}>No nutrition data for this day yet.</Text>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.screenBg }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Food header — matches meal / food item cards */}
        <View style={[s.mealOuter, { backgroundColor: colors.mealOuterBg }, cardShadow(isDark)]}>
          <View style={s.foodHeader}>
            <View style={[s.iconBox, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
              <Ionicons name="restaurant-outline" size={22} color={colors.textVeryMuted} />
            </View>
            <View style={s.foodTitleBlock}>
              <Text style={[s.foodTitle, { color: colors.text }]} numberOfLines={2}>{foodName}</Text>
              {brand ? (
                <Text style={[s.foodBrand, { color: colors.textMuted }]} numberOfLines={1}>{brand}</Text>
              ) : null}
              <Text style={[s.servingText, { color: colors.textMuted }]}>{serving}</Text>
            </View>
            <View style={s.calSlot}>
              <Text style={[s.calValue, { color: colors.hotPink }]}>{cards.calories}</Text>
              <Text style={[s.calUnit, { color: colors.hotPink }]}>cal</Text>
            </View>
          </View>
          <LinearGradient
            colors={[colors.hotPink, '#F97316']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.accentBar}
          />
        </View>

        {/* Calories hero — matches nutrition ring card */}
        <View style={[s.heroCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}>
          <LinearGradient colors={NUT_CALORIES_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.heroAccent} />
          <Text style={[s.heroKicker, { color: colors.textMuted }]}>THIS SERVING</Text>
          <Text style={[s.heroCalories, { color: colors.text }]}>{cards.calories}</Text>
          <Text style={[s.heroUnit, { color: colors.textMuted }]}>calories</Text>
        </View>

        {/* Macro donuts — matches Nutrition tab macro row */}
        <View style={s.macroRow}>
          {cards.macros.map((m) => (
            <View
              key={m.label}
              style={[s.macroCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }, cardShadow(isDark)]}
            >
              <ArcRing
                size={92}
                stroke={8}
                progress={m.pct}
                gradientColors={m.gradient}
                trackColor={trackColor}
                isDark={isDark}
                centerLabel={`${m.pct}%`}
                subLabel="DV"
              />
              <Text style={[s.macroLabel, { color: colors.textMuted }]}>{m.label}</Text>
              <Text style={[s.macroAmount, { color: colors.text }]}>{m.display}</Text>
              <View style={[s.macroBarTrack, { backgroundColor: trackColor }]}>
                <View style={[s.macroBarFill, { width: `${m.pct}%`, backgroundColor: m.barColor }]} />
              </View>
            </View>
          ))}
        </View>

        <NutrientSectionCard title="FATS" rows={cards.fats} colors={colors} isDark={isDark} />
        <NutrientSectionCard title="CARBOHYDRATES" rows={cards.carbs} colors={colors} isDark={isDark} />

        {/* Micronutrients — matches trainer nutrition tab grid */}
        <View style={[s.sectionCard, { backgroundColor: colors.mealOuterBg }, cardShadow(isDark)]}>
          <SectionHead label="VITAMINS & MINERALS" colors={colors} isDark={isDark} />
          <View style={[s.microPanel, { backgroundColor: colors.innerBg, borderColor: colors.innerBorder }]}>
            <CenteredTwoColumnGrid
              items={cards.minerals}
              keyExtractor={(m) => m.key}
              gap={10}
              itemWidth="48%"
              renderItem={(m) => (
                <View style={s.microRow}>
                  <Text style={[s.microName, { color: colors.textMuted }]} numberOfLines={1}>{m.name}</Text>
                  <Text style={[s.microVal, { color: m.raw > 0 ? colors.text : colors.textVeryMuted }]}>
                    {m.raw > 0 ? m.value : '—'}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>

        {loadingDetails ? (
          <View style={s.loadingRow}>
            <ActivityIndicator size="small" color={colors.hotPink} />
            <Text style={[s.loadingText, { color: colors.textMuted }]}>Loading full label…</Text>
          </View>
        ) : null}

        {!loadingDetails && microCount === 0 ? (
          <Text style={[s.hint, { color: colors.textVeryMuted }]}>
            Scan a barcode for the most complete nutrition label.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  mealOuter: {
    borderRadius: 28,
    padding: 16,
    overflow: 'hidden',
  },
  foodHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodTitleBlock: { flex: 1, minWidth: 0 },
  foodTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  foodBrand: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  servingText: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  calSlot: { alignItems: 'flex-end', minWidth: 56 },
  calValue: { fontSize: 26, fontWeight: '900', lineHeight: 30 },
  calUnit: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  accentBar: { height: 4, borderRadius: 2, marginTop: 12, width: 44 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 24,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  heroAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 4 },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 6 },
  heroCalories: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, lineHeight: 50 },
  heroUnit: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  macroRow: { flexDirection: 'row', gap: 10 },
  macroCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  arcCenter: { alignItems: 'center', justifyContent: 'center' },
  arcCenterMain: { fontSize: 15, fontWeight: '900' },
  arcCenterSub: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  macroLabel: { fontSize: 11, fontWeight: '700', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  macroAmount: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  macroBarTrack: { height: 4, borderRadius: 2, width: '100%', marginTop: 8, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 2 },
  sectionCard: {
    borderRadius: 28,
    padding: 16,
    gap: 10,
  },
  sectionHead: { gap: 8 },
  sectionKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  sectionLine: { height: 2, borderRadius: 1, width: '100%' },
  sectionInner: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  barRow: {},
  barRowGap: { marginTop: 12 },
  barRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  barLabel: { fontSize: 13, fontWeight: '600' },
  barValue: { fontSize: 14, fontWeight: '800' },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  microPanel: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  microRow: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 4,
  },
  microName: { fontSize: 12, fontWeight: '600' },
  microVal: { fontSize: 16, fontWeight: '800' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 },
  loadingText: { fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 11, textAlign: 'center', lineHeight: 16, paddingHorizontal: 12 },
});
