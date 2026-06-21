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
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassCard,
  GradientText,
  AuroraHeroBanner,
  Icon,
  ICON_ACCENT,
  SCREEN_WIDTH,
  TabPills,
  TABS,
  CategoryCard,
  ArcProgress,
  BorderedCard,
  TrainerNotesFilesHeroAndWorkspace,
  PremiumTabEmptyState,
  EmptyState,
  getTrainerDashboardLottieSource,
  getTrainerDashboardLottieCaption,
  LOTTIE_FOOD_AROUND_CITY,
  getClientInitials,
  getClientRosterStats,
  formatClientHeightDisplay,
  getClientSubtext,
  useTrainerTheme,
  PROGRESS_VALUE_WEIGHT,
  PROGRESS_VALUE_SLEEP,
  PROGRESS_VALUE_WATER,
  PROGRESS_VALUE_WORKOUT,
  PROGRESS_VALUE_ENERGY,
  PROGRESS_VALUE_STRESS,
  PROGRESS_VALUE_MOOD,
  PROGRESS_VALUE_SORENESS,
  CARD_BORDER_PROGRESS,
  CARD_BORDER_NUTRITION,
  CARD_BORDER_CALENDAR,
  GRADIENT_NUTRITION_PROTEIN,
  GRADIENT_NUTRITION_CARBS,
  GRADIENT_NUTRITION_FAT,
  GRADIENT_CALENDAR,
  PINK,
  ORANGE,
} from '../dashboard/trainerDashboardUi';


const NutritionTab = ({ isDark, clientData }) => {
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const chipBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.1)';

  const hasCalories = clientData?.nutrition?.calories > 0;
  const hasMacros = clientData?.nutrition?.protein > 0 || clientData?.nutrition?.carbs > 0 || clientData?.nutrition?.fat > 0;
  const hasAdditionalNutrients = (clientData?.nutrition?.fiber > 0 || clientData?.nutrition?.sugar > 0 || 
                                 clientData?.nutrition?.sodium > 0 || clientData?.nutrition?.potassium > 0);
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

  // Prepare all nutrients for arc progress display
  const allNutrients = [];
  
  // Main macros
  if (clientData?.nutrition?.protein > 0) {
    allNutrients.push({
      value: clientData.nutrition.protein,
      goal: clientData.nutrition.proteinGoal || 200,
      label: "Protein",
      color: GRADIENT_NUTRITION_PROTEIN[0],
      unit: "g",
    });
  }
  if (clientData?.nutrition?.carbs > 0) {
    allNutrients.push({
      value: clientData.nutrition.carbs,
      goal: clientData.nutrition.carbsGoal || 300,
      label: "Carbs",
      color: GRADIENT_NUTRITION_CARBS[0],
      unit: "g",
    });
  }
  if (clientData?.nutrition?.fat > 0) {
    allNutrients.push({
      value: clientData.nutrition.fat,
      goal: clientData.nutrition.fatGoal || 80,
      label: "Fat",
      color: GRADIENT_NUTRITION_FAT[0],
      unit: "g",
    });
  }
  if (clientData?.nutrition?.fiber > 0) {
    allNutrients.push({
      value: clientData.nutrition.fiber,
      goal: 25,
      label: "Fiber",
      color: '#22C55E',
      unit: "g",
    });
  }
  if (clientData?.nutrition?.sugar > 0) {
    allNutrients.push({
      value: clientData.nutrition.sugar,
      goal: 50,
      label: "Sugar",
      color: '#D4621A',
      unit: "g",
    });
  }
  if (clientData?.nutrition?.sodium > 0) {
    allNutrients.push({
      value: clientData.nutrition.sodium,
      goal: 2300,
      label: "Sodium",
      color: '#4DB8E8',
      unit: "mg",
    });
  }
  if (clientData?.nutrition?.potassium > 0) {
    allNutrients.push({
      value: clientData.nutrition.potassium,
      goal: 3500,
      label: "Potassium",
      color: '#A970E8',
      unit: "mg",
    });
  }

  const caloriesGoal = clientData?.nutrition?.caloriesGoal || 2000;
  const caloriePct = Math.min(Math.round(((clientData.nutrition.calories || 0) / caloriesGoal) * 100), 100);

  return (
    <View style={{ gap: 12 }}>

      {/* Calories Hero */}
      <GlassCard isDark={isDark} style={{ padding: 18 }}>
        <Text style={{ color: mutedColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>Daily Calories</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 10 }}>
          <GradientText colors={[PINK, ORANGE]} style={{ fontSize: 36, fontWeight: '900', lineHeight: 40 }}>
            {(clientData.nutrition.calories || 0).toLocaleString()}
          </GradientText>
          <Text style={{ color: mutedColor, fontSize: 13, fontWeight: '600', marginBottom: 4 }}>kcal</Text>
          {caloriesGoal > 0 && (
            <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 4, marginLeft: 4 }}>/ {caloriesGoal.toLocaleString()} goal</Text>
          )}
        </View>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${caloriePct}%`, borderRadius: 2, backgroundColor: PINK }} />
        </View>
      </GlassCard>

      {/* Macros & Nutrients as Arc Progress */}
      {allNutrients.length > 0 && (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={{ color: mutedColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>Macros & Nutrients</Text>
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'flex-start',
          }}>
            {allNutrients.map((nutrient) => (
              <View key={nutrient.label} style={{
                width: SCREEN_WIDTH < 380 ? '28%' : '30%',
                minWidth: 90,
                maxWidth: 110,
              }}>
                <ArcProgress
                  value={nutrient.value}
                  goal={nutrient.goal}
                  label={nutrient.label}
                  color={nutrient.color}
                  isDark={isDark}
                  unit={nutrient.unit}
                />
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* Micros */}
      {hasMicros && (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={{ color: mutedColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>
            Micronutrients
          </Text>
          <View style={{ gap: 8 }}>
            {(clientData?.nutrition?.micros || []).map((m, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: mutedColor, fontSize: 13 }}>{m.name}</Text>
                <Text style={{ color: textColor, fontSize: 13, fontWeight: '700' }}>{m.value}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}

      {/* Foods Today */}
      {hasFoods && (
        <GlassCard isDark={isDark} style={{ padding: 16 }}>
          <Text style={{ color: mutedColor, fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 12 }}>
            Foods Logged Today
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(clientData?.nutrition?.foods || []).map((food, i) => (
              <View key={i} style={{ backgroundColor: chipBg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>{food}</Text>
              </View>
            ))}
          </View>
        </GlassCard>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────
// CALENDAR TAB
// ─────────────────────────────────────────────

export default NutritionTab;
