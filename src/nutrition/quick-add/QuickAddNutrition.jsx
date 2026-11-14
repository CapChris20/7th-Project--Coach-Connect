// Quick add — type food name + calories, optional macros, pick meal, Log to Meal.
// Flow: fill fields → optional macro estimate → build onLogFood entry → parent saves.
// Used by DailyLogContent. Entry shape stays name / calories / macros grams / mealType.

import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { readableFoodTitle } from '../food-search/readableFoodTitle';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSwitch from '../../look-and-feel/NbSwitch';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const MEAL_CHOICES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
// Manipulate here: Atwater factors — kcal per gram (protein / carb / fat)
const KCAL_PER_PROTEIN_GRAM = 4;
const KCAL_PER_CARB_GRAM = 4;
const KCAL_PER_FAT_GRAM = 9;
const DEFAULT_MEAL_FALLBACK = 'Dinner';
const SHELL_SCROLL_EXTRA_PAD = 24;
const SCROLL_PAD_WITHOUT_SHELL = 40;
const QUANTITY_ALWAYS_ONE = 1;

// ===== UI PIECES (no hooks) =====

/**
 * Title-case a mealType string; unknown values become Dinner.
 */
function titleCaseMeal(mealType) {
  const lower = String(mealType || 'dinner');
  const titled = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (MEAL_CHOICES.includes(titled)) {
    return titled;
  }
  return DEFAULT_MEAL_FALLBACK;
}

/**
 * Labeled text field used for food name and calories.
 */
function QuickAddField({
  label,
  value,
  onChangeText,
  colors,
  keyboardType = 'default',
  placeholder,
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.nbMuted}
        style={[
          styles.fieldInput,
          {
            borderColor: colors.nbBorder,
            color: colors.nbInk,
            backgroundColor: colors.nbSurface,
          },
        ]}
      />
    </View>
  );
}

/**
 * One of three macro gram inputs in the row under “Add macros”.
 */
function MacroGramField({ label, value, onChangeText, colors }) {
  return (
    <View
      style={[
        styles.macroLane,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        style={[
          styles.macroInput,
          {
            borderColor: colors.nbBorder,
            color: colors.nbInk,
            backgroundColor: colors.nbSoft,
          },
        ]}
      />
    </View>
  );
}

/**
 * Breakfast / Lunch / Dinner / Snacks chips — selected uses nbFill.
 */
function MealChipRow({ meal, onPickMeal, colors }) {
  return (
    <View style={styles.mealRow}>
      {MEAL_CHOICES.map((mealLabel) => {
        const isSelected = meal === mealLabel;
        let chipTextColor = colors.nbInk;
        let chipBackground = colors.nbSurface;
        if (isSelected) {
          chipTextColor = colors.nbOnFill;
          chipBackground = colors.nbFill;
        }

        return (
          <TouchableOpacity
            key={mealLabel}
            onPress={() => onPickMeal(mealLabel)}
            style={[
              styles.mealChip,
              { borderColor: colors.nbBorder, backgroundColor: chipBackground },
            ]}
          >
            <Text style={[styles.mealChipText, { color: chipTextColor }]}>{mealLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * 4×P + 4×C + 9×F rounded to whole kcal. Empty strings count as 0.
 */
function estimateCaloriesFromMacroGrams(proteinText, carbsText, fatText) {
  const proteinGrams = Number(proteinText) || 0;
  const carbGrams = Number(carbsText) || 0;
  const fatGrams = Number(fatText) || 0;
  const total =
    KCAL_PER_PROTEIN_GRAM * proteinGrams
    + KCAL_PER_CARB_GRAM * carbGrams
    + KCAL_PER_FAT_GRAM * fatGrams;
  return Math.round(total);
}

const styles = StyleSheet.create({
  screenRoot: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
  },
  fieldBlock: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6 },
  fieldInput: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    minHeight: 52,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
  },
  macroToggle: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  macroToggleCopy: { flex: 1 },
  toggleTitle: { fontSize: 16, fontWeight: '900' },
  toggleSub: { fontSize: 13, marginTop: 2 },
  macroGrid: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  macroLane: {
    flex: 1,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 10,
  },
  macroInput: {
    borderWidth: nb.borderWidthDivider,
    borderRadius: 8,
    minHeight: 44,
    paddingHorizontal: 8,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  estimateBox: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    marginBottom: 10,
  },
  estimateText: { fontSize: 13, lineHeight: 18 },
  estimateKcal: { fontWeight: '900' },
  fillShadow: { marginBottom: 16 },
  fillBtn: {
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fillBtnText: { fontSize: 15, fontWeight: '900' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  mealRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  mealChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealChipText: { fontWeight: '800', fontSize: 13 },
});

export default QuickAddNutrition;

// ===== MAIN FUNCTION =====

/**
 * Quick-add form for logging one homemade / known food into a meal slot.
 * @param {{ onLogFood: Function, userId?: string, reserveShellBottomNav?: boolean, mealType?: string, onBack?: Function }} props
 */
export function QuickAddNutrition({
  onLogFood,
  reserveShellBottomNav = false,
  mealType = 'dinner',
  onBack,
}) {
  // vocab: useTheme = Design Law light/dark color tokens
  const { colors } = useTheme();
  // vocab: useShellBottomNavInset = extra bottom pad so content clears the tab bar
  const shellBottomPad = useShellBottomNavInset(16);
  const screenBackground = colors.nbBackground;

  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [showMacros, setShowMacros] = useState(true);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [meal, setMeal] = useState(() => titleCaseMeal(mealType));

  // vocab: useMemo = recompute estimate only when P/C/F strings change
  const estimatedKcalFromMacros = useMemo(
    () => estimateCaloriesFromMacroGrams(protein, carbs, fat),
    [protein, carbs, fat],
  );

  const nameIsFilled = foodName.trim().length > 0;
  const caloriesArePositive = Number(calories) > 0;
  const canLog = nameIsFilled && caloriesArePositive;

  const showHeader = typeof onBack === 'function';
  let scrollBottomPad = SCROLL_PAD_WITHOUT_SHELL;
  if (reserveShellBottomNav) {
    scrollBottomPad = shellBottomPad + SHELL_SCROLL_EXTRA_PAD;
  }

  const logButtonLabel = `Log to ${meal}`;

  /**
   * Build the onLogFood entry the daily log already expects.
   * Flow: 1. guard  2. readable title  3. grams only if macros on  4. call parent
   */
  const handleLogToMeal = () => {
    // 1. Need a name and positive calories before we write anything.
    if (!canLog) {
      return;
    }

    // 2. Clean display name the same way search cards do (source: manual).
    const trimmedName = foodName.trim();
    const { name: displayName } = readableFoodTitle({ name: trimmedName, source: 'manual' });

    // 3. Macro grams stay empty strings when the switch is off (parent reads those keys).
    let proteinForLog = '';
    let carbsForLog = '';
    let fatForLog = '';
    if (showMacros) {
      proteinForLog = protein;
      carbsForLog = carbs;
      fatForLog = fat;
    }

    // 4. Hand the row to DailyLogContent — mealType letter stays lowercase.
    onLogFood?.({
      name: displayName,
      quantity: QUANTITY_ALWAYS_ONE,
      calories: parseFloat(calories),
      protein: proteinForLog,
      carbs: carbsForLog,
      fat: fatForLog,
      mealType: String(meal).toLowerCase(),
    });
  };

  const handleFillCaloriesFromEstimate = () => {
    setCalories(String(estimatedKcalFromMacros));
  };

  const proteinDisplay = protein || 0;
  const carbsDisplay = carbs || 0;
  const fatDisplay = fat || 0;

  return (
    <View style={[styles.screenRoot, { backgroundColor: screenBackground }]}>
      {showHeader ? (
        <NbPageHeader
          title="Quick add"
          subtitle="Log your nutrition"
          onBack={onBack}
          skipTopSafeInset
        />
      ) : null}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        keyboardShouldPersistTaps="handled"
      >
        <QuickAddField
          label="FOOD NAME"
          value={foodName}
          onChangeText={setFoodName}
          colors={colors}
          placeholder="Homemade chili"
        />
        <QuickAddField
          label="CALORIES"
          value={calories}
          onChangeText={setCalories}
          colors={colors}
          keyboardType="number-pad"
          placeholder="520"
        />

        <View
          style={[
            styles.macroToggle,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          <View style={styles.macroToggleCopy}>
            <Text style={[styles.toggleTitle, { color: colors.nbInk }]}>Add macros</Text>
            <Text style={[styles.toggleSub, { color: colors.nbMuted }]}>
              Protein, carbs and fat
            </Text>
          </View>
          <NbSwitch value={showMacros} onValueChange={setShowMacros} />
        </View>

        {showMacros ? (
          <>
            <View style={styles.macroGrid}>
              <MacroGramField
                label="PROTEIN (G)"
                value={protein}
                onChangeText={setProtein}
                colors={colors}
              />
              <MacroGramField
                label="CARBS (G)"
                value={carbs}
                onChangeText={setCarbs}
                colors={colors}
              />
              <MacroGramField
                label="FAT (G)"
                value={fat}
                onChangeText={setFat}
                colors={colors}
              />
            </View>

            <View
              style={[
                styles.estimateBox,
                { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
              ]}
            >
              <Text style={[styles.estimateText, { color: colors.nbMuted }]}>
                Estimated from macros: 4 × {proteinDisplay} + 4 × {carbsDisplay} + 9 ×{' '}
                {fatDisplay} ={' '}
                <Text style={[styles.estimateKcal, { color: colors.nbInk }]}>
                  {estimatedKcalFromMacros}
                </Text>{' '}
                kcal. Tap to fill sets calories to this.
              </Text>
            </View>
            <HardShadow
              offset={nb.shadowOffsetSmall}
              radius={borderRadius.nbButton}
              style={styles.fillShadow}
            >
              <TouchableOpacity
                onPress={handleFillCaloriesFromEstimate}
                style={[
                  styles.fillBtn,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                ]}
              >
                <Text style={[styles.fillBtnText, { color: colors.nbInk }]}>
                  Tap to fill calories
                </Text>
              </TouchableOpacity>
            </HardShadow>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>MEAL</Text>
        <MealChipRow meal={meal} onPickMeal={setMeal} colors={colors} />

        <NbButton onPress={handleLogToMeal} disabled={!canLog}>
          {logButtonLabel}
        </NbButton>
      </ScrollView>
    </View>
  );
}

