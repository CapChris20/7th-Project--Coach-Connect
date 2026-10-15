// Trainer dashboard Nutrition tab: rings for macros plus the foods the client logged today.
// Flow: nothing logged → empty state. Otherwise calories bar, then nutrient rings, micros, food chips.
// Used on the trainer's client view. Nutrient field names (protein, carbs, caloriesGoal, …) stay as the client writes them.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
  GlassCard,
  ColorText,
  PremiumTabEmptyState,
  SCREEN_WIDTH,
  LOTTIE_FOOD_AROUND_CITY,
  PINK,
  ORANGE,
} from '../home/trainerHomePieces';
import { gradientForNutrientLabel } from '../../nutrition/nutritionColors';

// ===== NAMED CONSTANTS =====

const NUT_TRACK = {
  dark: 'rgba(255,255,255,0.12)',
  light: 'rgba(0,0,0,0.08)',
};

const RING_STROKE_WIDTH = 7;
const RING_SIZE_NARROW = 84;
const RING_SIZE_WIDE = 92;
const NARROW_SCREEN_WIDTH = 380;
const MIN_VISIBLE_RING_PCT = 4;
const PROTEIN_GOAL_DEFAULT_G = 150;
const CARBS_GOAL_DEFAULT_G = 250;
const FAT_GOAL_DEFAULT_G = 70;
const FIBER_GOAL_G = 25;
const SUGAR_GOAL_G = 50;
const SODIUM_GOAL_MG = 2300;
const POTASSIUM_GOAL_MG = 3500;
const CALORIES_GOAL_DEFAULT = 2000;
const GRAMS_ROUND_AT = 100;
const GRAMS_TENTHS_AT = 10;

// ===== HELPER FUNCTIONS =====

/**
 * Grams show one decimal under 100. Milligrams are always whole numbers.
 * @param {*} value
 * @param {string} [unit]
 * @returns {string}
 */
function formatNutrientValue(value, unit = 'g') {
  const amount = Number(value) || 0;
  if (unit === 'mg') return `${Math.round(amount)}mg`;
  if (amount >= GRAMS_ROUND_AT) return `${Math.round(amount)}g`;
  if (amount >= GRAMS_TENTHS_AT) return `${Math.round(amount * 10) / 10}g`;
  return `${Math.round(amount * 10) / 10}g`;
}

/**
 * @param {*} goal
 * @param {string} unit
 * @returns {string}
 */
function formatGoalLabel(goal, unit) {
  if (unit === 'mg') return `${Math.round(goal)}mg`;
  return `${Math.round(goal)}g`;
}

function TrainerMacroRing({ value, goal, label, unit = 'g', isDark }) {
  const numericValue = Number(value) || 0;
  const numericGoal = Number(goal) > 0 ? Number(goal) : 1;
  const pct = Math.min((numericValue / numericGoal) * 100, 100);
  const displayPct = numericValue > 0 ? Math.max(pct, MIN_VISIBLE_RING_PCT) : 0;

  const size = SCREEN_WIDTH < NARROW_SCREEN_WIDTH ? RING_SIZE_NARROW : RING_SIZE_WIDE;
  const stroke = RING_STROKE_WIDTH;
  const center = size / 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
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
            <Circle cx={center} cy={center} r={radius} stroke={trackColor} strokeWidth={stroke} fill="none" />
            {numericValue > 0 ? (
              <Circle
                cx={center}
                cy={center}
                r={radius}
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
          of {formatGoalLabel(numericGoal, unit)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Empty rings stay off the dashboard so a 0g day does not look like missing data.
 * @param {object} nutrition
 * @returns {object[]}
 */
function ringsFromNutrition(nutrition) {
  const rings = [];
  pushRingIfLogged(rings, nutrition?.protein, nutrition?.proteinGoal || PROTEIN_GOAL_DEFAULT_G, 'Protein', 'g');
  pushRingIfLogged(rings, nutrition?.carbs, nutrition?.carbsGoal || CARBS_GOAL_DEFAULT_G, 'Carbs', 'g');
  pushRingIfLogged(rings, nutrition?.fat, nutrition?.fatGoal || FAT_GOAL_DEFAULT_G, 'Fat', 'g');
  pushRingIfLogged(rings, nutrition?.fiber, FIBER_GOAL_G, 'Fiber', 'g');
  pushRingIfLogged(rings, nutrition?.sugar, SUGAR_GOAL_G, 'Sugar', 'g');
  pushRingIfLogged(rings, nutrition?.sodium, SODIUM_GOAL_MG, 'Sodium', 'mg');
  pushRingIfLogged(rings, nutrition?.potassium, POTASSIUM_GOAL_MG, 'Potassium', 'mg');
  return rings;
}

/**
 * @param {object[]} rings
 * @param {*} value
 * @param {*} goal
 * @param {string} label
 * @param {string} unit
 */
function pushRingIfLogged(rings, value, goal, label, unit) {
  if (!(value > 0)) return;
  rings.push({ value, goal, label, unit });
}

/**
 * @param {object} clientData
 * @returns {boolean}
 */
function hasAnyNutritionLogged(clientData) {
  const nutrition = clientData?.nutrition;
  const hasCalories = nutrition?.calories > 0;
  const hasMacros = nutrition?.protein > 0 || nutrition?.carbs > 0 || nutrition?.fat > 0;
  const hasAdditionalNutrients =
    nutrition?.fiber > 0 ||
    nutrition?.sugar > 0 ||
    nutrition?.sodium > 0 ||
    nutrition?.potassium > 0;
  return hasCalories || hasMacros || hasAdditionalNutrients;
}

function CaloriesCard({ nutrition, caloriesGoal, caloriePct, mutedColor, isDark }) {
  return (
    <GlassCard isDark={isDark} style={{ padding: 18 }}>
      <Text style={styles.sectionLabel}>Daily Calories</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
        <ColorText colors={[PINK, ORANGE]} style={{ fontSize: 36, fontWeight: '900', lineHeight: 40 }}>
          {(nutrition.calories || 0).toLocaleString()}
        </ColorText>
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
  );
}

function NutrientRingsCard({ rings, mutedColor, isDark }) {
  return (
    <GlassCard isDark={isDark} style={{ padding: 16 }}>
      <Text style={[styles.sectionLabel, { color: mutedColor }]}>Macros & Nutrients</Text>
      <View style={styles.ringGrid}>
        {rings.map((nutrient) => (
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
  );
}

function MicrosCard({ micros, mutedColor, textColor, isDark }) {
  return (
    <GlassCard isDark={isDark} style={{ padding: 16 }}>
      <Text style={[styles.sectionLabel, { color: mutedColor }]}>Micronutrients</Text>
      <View style={{ gap: 8 }}>
        {(micros || []).map((micro, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: mutedColor, fontSize: 13 }}>{micro.name}</Text>
            <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{micro.value}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

function FoodsCard({ foods, chipBg, textColor, isDark, mutedColor }) {
  return (
    <GlassCard isDark={isDark} style={{ padding: 16 }}>
      <Text style={[styles.sectionLabel, { color: mutedColor }]}>Foods Logged Today</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {(foods || []).map((food, i) => (
          <View key={i} style={{ backgroundColor: chipBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
            <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>{food}</Text>
          </View>
        ))}
      </View>
    </GlassCard>
  );
}

// ===== MAIN FUNCTION =====

const NutritionTab = ({ isDark, clientData }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const chipBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.1)';

  const hasMicros = clientData?.nutrition?.micros?.length > 0;
  const hasFoods = clientData?.nutrition?.foods?.length > 0;

  if (!hasAnyNutritionLogged(clientData)) {
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

  const allNutrients = ringsFromNutrition(clientData?.nutrition);
  const caloriesGoal = clientData?.nutrition?.caloriesGoal || CALORIES_GOAL_DEFAULT;
  const caloriePct = Math.min(Math.round(((clientData.nutrition.calories || 0) / caloriesGoal) * 100), 100);

  return (
    <View style={{ gap: 12 }}>
      <CaloriesCard
        nutrition={clientData.nutrition}
        caloriesGoal={caloriesGoal}
        caloriePct={caloriePct}
        mutedColor={mutedColor}
        isDark={isDark}
      />

      {allNutrients.length > 0 ? (
        <NutrientRingsCard rings={allNutrients} mutedColor={mutedColor} isDark={isDark} />
      ) : null}

      {hasMicros ? (
        <MicrosCard
          micros={clientData?.nutrition?.micros}
          mutedColor={mutedColor}
          textColor={textColor}
          isDark={isDark}
        />
      ) : null}

      {hasFoods ? (
        <FoodsCard
          foods={clientData?.nutrition?.foods}
          chipBg={chipBg}
          textColor={textColor}
          isDark={isDark}
          mutedColor={mutedColor}
        />
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
