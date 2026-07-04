/**
 * Trainer Nutrition Tab
 *
 * Purpose: UI screen or component: Trainer Nutrition Tab. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
/** Trainer dashboard — Nutrition tab */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
  GlassCard,
  GradientText,
  PremiumTabEmptyState,
  SCREEN_WIDTH,
  LOTTIE_FOOD_AROUND_CITY,
  PINK,
  ORANGE,
} from '../dashboard/trainerDashboardUi';
import { gradientForNutrientLabel } from '../../nutrition/nutritionTheme';

const NUT_TRACK = {
  dark: 'rgba(255,255,255,0.12)',
  light: 'rgba(0,0,0,0.08)',
};

function formatNutrientValue(value, unit = 'g') {
  const n = Number(value) || 0;
  if (unit === 'mg') return `${Math.round(n)}mg`;
  if (n >= 100) return `${Math.round(n)}g`;
  if (n >= 10) return `${Math.round(n * 10) / 10}g`;
  return `${Math.round(n * 10) / 10}g`;
}

function TrainerMacroRing({ value, goal, label, unit = 'g', isDark }) {
  const numericValue = Number(value) || 0;
  const numericGoal = Number(goal) > 0 ? Number(goal) : 1;
  const pct = Math.min((numericValue / numericGoal) * 100, 100);
  const displayPct = numericValue > 0 ? Math.max(pct, 4) : 0;

  const size = SCREEN_WIDTH < 380 ? 84 : 92;
  const stroke = 7;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (displayPct / 100) * circumference;
  const gradientColors = gradientForNutrientLabel(label);
  const gradId = `trainerNut-${String(label).replace(/\s+/g, '-')}`;
  const trackColor = isDark ? NUT_TRACK.dark : NUT_TRACK.light;
  const textColor = isDark ? '#FFFFFF' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.58)' : 'rgba(26,10,46,0.55)';

  return (
    <View style={styles.ringCard}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ transform: [{ rotate: '-90deg' }] }}>
          <Svg width={size} height={size}>
            <Defs>
              <SvgGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity={1} />
                <Stop offset="100%" stopColor={gradientColors[1]} stopOpacity={1} />
              </SvgGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
            {numericValue > 0 ? (
              <Circle
                cx={cx}
                cy={cy}
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
        </View>
        <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
          <Text style={[styles.ringValue, { color: textColor }]} numberOfLines={1}>
            {formatNutrientValue(numericValue, unit)}
          </Text>
          {numericGoal > 0 ? (
            <Text style={[styles.ringPct, { color: mutedColor }]}>{Math.round(pct)}%</Text>
          ) : null}
        </View>
      </View>
      <Text style={[styles.ringLabel, { color: mutedColor }]} numberOfLines={1}>
        {label}
      </Text>
      {numericGoal > 0 ? (
        <Text style={[styles.ringGoal, { color: textColor }]} numberOfLines={1}>
          of {unit === 'mg' ? `${Math.round(numericGoal)}mg` : `${Math.round(numericGoal)}g`}
        </Text>
      ) : null}
    </View>
  );
}

const NutritionTab = ({ isDark, clientData }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const chipBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.1)';

  const hasCalories = clientData?.nutrition?.calories > 0;
  const hasMacros = clientData?.nutrition?.protein > 0 || clientData?.nutrition?.carbs > 0 || clientData?.nutrition?.fat > 0;
  const hasAdditionalNutrients =
    clientData?.nutrition?.fiber > 0 ||
    clientData?.nutrition?.sugar > 0 ||
    clientData?.nutrition?.sodium > 0 ||
    clientData?.nutrition?.potassium > 0;
  const hasMicros = clientData?.nutrition?.micros?.length > 0;
  const hasFoods = clientData?.nutrition?.foods?.length > 0;
  const hasAnyNutrition = hasCalories || hasMacros || hasAdditionalNutrients;

  if (!hasAnyNutrition) {
    return (
      <PremiumTabEmptyState
        isDark={isDark}
        lottieSource={LOTTIE_FOOD_AROUND_CITY}
        title="No nutrition logged yet"
        subtitle="When your client tracks meals in the app, their daily intake shows up here automatically."
        hints={[
          'Calorie totals for the day',
          'Protein, carbs & fat breakdown',
          'Fiber, sodium & more when logged',
        ]}
      />
    );
  }

  const allNutrients = [];

  if (clientData?.nutrition?.protein > 0) {
    allNutrients.push({
      value: clientData.nutrition.protein,
      goal: clientData.nutrition.proteinGoal || 150,
      label: 'Protein',
      unit: 'g',
    });
  }
  if (clientData?.nutrition?.carbs > 0) {
    allNutrients.push({
      value: clientData.nutrition.carbs,
      goal: clientData.nutrition.carbsGoal || 250,
      label: 'Carbs',
      unit: 'g',
    });
  }
  if (clientData?.nutrition?.fat > 0) {
    allNutrients.push({
      value: clientData.nutrition.fat,
      goal: clientData.nutrition.fatGoal || 70,
      label: 'Fat',
      unit: 'g',
    });
  }
  if (clientData?.nutrition?.fiber > 0) {
    allNutrients.push({
      value: clientData.nutrition.fiber,
      goal: 25,
      label: 'Fiber',
      unit: 'g',
    });
  }
  if (clientData?.nutrition?.sugar > 0) {
    allNutrients.push({
      value: clientData.nutrition.sugar,
      goal: 50,
      label: 'Sugar',
      unit: 'g',
    });
  }
  if (clientData?.nutrition?.sodium > 0) {
    allNutrients.push({
      value: clientData.nutrition.sodium,
      goal: 2300,
      label: 'Sodium',
      unit: 'mg',
    });
  }
  if (clientData?.nutrition?.potassium > 0) {
    allNutrients.push({
      value: clientData.nutrition.potassium,
      goal: 3500,
      label: 'Potassium',
      unit: 'mg',
    });
  }

  const caloriesGoal = clientData?.nutrition?.caloriesGoal || 2000;
  const caloriePct = Math.min(Math.round(((clientData.nutrition.calories || 0) / caloriesGoal) * 100), 100);

  return (
    <View style={{ gap: 12 }}>
      <GlassCard isDark={isDark} style={{ padding: 18 }}>
        <Text style={styles.sectionLabel}>Daily Calories</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
          <GradientText colors={[PINK, ORANGE]} style={{ fontSize: 36, fontWeight: '900', lineHeight: 40 }}>
            {(clientData.nutrition.calories || 0).toLocaleString()}
          </GradientText>
          <Text style={{ color: mutedColor, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>kcal</Text>
          {caloriesGoal > 0 ? (
            <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 4, marginLeft: 4 }}>
              / {caloriesGoal.toLocaleString()} goal
            </Text>
          ) : null}
        </View>
        <View
          style={{
            height: 4,
            borderRadius: 2,
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          <LinearGradient
            colors={[PINK, ORANGE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: '100%', width: `${caloriePct}%`, borderRadius: 2 }}
          />
        </View>
      </GlassCard>

      {allNutrients.length > 0 ? (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>Macros & Nutrients</Text>
          <View style={styles.ringGrid}>
            {allNutrients.map((nutrient) => (
              <View key={nutrient.label} style={styles.ringCell}>
                <TrainerMacroRing
                  value={nutrient.value}
                  goal={nutrient.goal}
                  label={nutrient.label}
                  unit={nutrient.unit}
                  isDark={isDark}
                />
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {hasMicros ? (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>Micronutrients</Text>
          <View style={{ gap: 8 }}>
            {(clientData?.nutrition?.micros || []).map((m, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: mutedColor, fontSize: 13 }}>{m.name}</Text>
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}

      {hasFoods ? (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={[styles.sectionLabel, { color: mutedColor }]}>Foods Logged Today</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(clientData?.nutrition?.foods || []).map((food, i) => (
              <View key={i} style={{ backgroundColor: chipBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>{food}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  ringGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 14,
  },
  ringCell: {
    width: SCREEN_WIDTH < 380 ? '31%' : '32%',
    minWidth: 100,
    alignItems: 'center',
  },
  ringCard: {
    alignItems: 'center',
    width: '100%',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  ringValue: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ringPct: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  ringGoal: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    opacity: 0.82,
    textAlign: 'center',
  },
});

export default NutritionTab;
