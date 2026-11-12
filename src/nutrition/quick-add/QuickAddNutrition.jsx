// Design Law Quick add (PNG 17/18): name, calories, macros switch, meal chips, Log to Meal.
// Flow: type fields → optional macro estimate → log into selected meal.
// Used by DailyLogContent. Keeps onLogFood entry shape (name/calories/macros grams).

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

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const KCAL_P = 4;
const KCAL_C = 4;
const KCAL_F = 9;

// ===== HELPER FUNCTIONS =====

function mealTitle(mealType) {
  const m = String(mealType || 'dinner');
  const titled = m.charAt(0).toUpperCase() + m.slice(1);
  return MEALS.includes(titled) ? titled : 'Dinner';
}

function Field({ label, value, onChangeText, colors, keyboardType = 'default', placeholder }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.nbMuted}
        style={[
          styles.fieldInput,
          { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
        ]}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ onLogFood: Function, userId?: string, reserveShellBottomNav?: boolean, mealType?: string, onBack?: Function }} props
 */
export function QuickAddNutrition({
  onLogFood,
  reserveShellBottomNav = false,
  mealType = 'dinner',
  onBack,
}) {
  const { colors } = useTheme();
  const shellBottomPad = useShellBottomNavInset(16);
  const screenBg = colors.nbBackground;

  const [foodName, setFoodName] = useState('');
  const [calories, setCalories] = useState('');
  const [showMacros, setShowMacros] = useState(true);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [meal, setMeal] = useState(mealTitle(mealType));

  const estimatedKcal = useMemo(() => {
    const p = Number(protein) || 0;
    const c = Number(carbs) || 0;
    const f = Number(fat) || 0;
    return Math.round(KCAL_P * p + KCAL_C * c + KCAL_F * f);
  }, [protein, carbs, fat]);

  const isValid = foodName.trim().length > 0 && Number(calories) > 0;

  const handleLog = () => {
    if (!isValid) return;
    const { name } = readableFoodTitle({ name: foodName.trim(), source: 'manual' });
    onLogFood?.({
      name,
      quantity: 1,
      calories: parseFloat(calories),
      protein: showMacros ? protein : '',
      carbs: showMacros ? carbs : '',
      fat: showMacros ? fat : '',
      mealType: String(meal).toLowerCase(),
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: screenBg }}>
      {typeof onBack === 'function' ? (
        <NbPageHeader title="Quick add" subtitle="Log your nutrition" onBack={onBack} skipTopSafeInset />
      ) : null}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: reserveShellBottomNav ? shellBottomPad + 24 : 40,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="FOOD NAME"
          value={foodName}
          onChangeText={setFoodName}
          colors={colors}
          placeholder="Homemade chili"
        />
        <Field
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.toggleTitle, { color: colors.nbInk }]}>Add macros</Text>
            <Text style={[styles.toggleSub, { color: colors.nbMuted }]}>Protein, carbs and fat</Text>
          </View>
          <NbSwitch value={showMacros} onValueChange={setShowMacros} />
        </View>

        {showMacros ? (
          <>
            <View style={styles.macroGrid}>
              {[
                { label: 'PROTEIN (G)', value: protein, set: setProtein },
                { label: 'CARBS (G)', value: carbs, set: setCarbs },
                { label: 'FAT (G)', value: fat, set: setFat },
              ].map((lane) => (
                <View
                  key={lane.label}
                  style={[
                    styles.macroLane,
                    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                  ]}
                >
                  <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>{lane.label}</Text>
                  <TextInput
                    value={lane.value}
                    onChangeText={lane.set}
                    keyboardType="decimal-pad"
                    style={[
                      styles.macroInput,
                      { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSoft },
                    ]}
                  />
                </View>
              ))}
            </View>

            <View style={[styles.estimateBox, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}>
              <Text style={[styles.estimateText, { color: colors.nbMuted }]}>
                Estimated from macros: 4 × {protein || 0} + 4 × {carbs || 0} + 9 × {fat || 0} ={' '}
                <Text style={{ color: colors.nbInk, fontWeight: '900' }}>{estimatedKcal}</Text> kcal. Tap
                to fill sets calories to this.
              </Text>
            </View>
            <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton} style={{ marginBottom: 16 }}>
              <TouchableOpacity
                onPress={() => setCalories(String(estimatedKcal))}
                style={[
                  styles.fillBtn,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                ]}
              >
                <Text style={[styles.fillBtnText, { color: colors.nbInk }]}>Tap to fill calories</Text>
              </TouchableOpacity>
            </HardShadow>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>MEAL</Text>
        <View style={styles.mealRow}>
          {MEALS.map((m) => {
            const selected = meal === m;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => setMeal(m)}
                style={[
                  styles.mealChip,
                  {
                    borderColor: colors.nbBorder,
                    backgroundColor: selected ? colors.nbFill : colors.nbSurface,
                  },
                ]}
              >
                <Text style={{ color: selected ? colors.nbOnFill : colors.nbInk, fontWeight: '800', fontSize: 13 }}>
                  {m}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <NbButton onPress={handleLog} disabled={!isValid}>
          {`Log to ${meal}`}
        </NbButton>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
});

export default QuickAddNutrition;
