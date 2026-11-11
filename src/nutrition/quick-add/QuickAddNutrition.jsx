// Type calories and macros without searching a food card.
// Flow: type a name → fill macros → log it onto today’s meal.
// Used by the daily log “Quick add” path.
//
// vocab: neobrutalist tokens (nb*) replace the old soft glass palette.

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { getRecentFoods } from '../daily-log/saveLoggedFood';
import { readableFoodTitle } from '../food-search/readableFoodTitle';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import { lightColors, darkColors, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const QUICK_ADD_BOTTOM_PAD = 24;

const initialMacros = {
  protein: '',
  carbs: '',
  fat: '',
  sodium: '',
  fiber: '',
  sugar: '',
  servingSize: '',
  servingUnit: '',
};

const defaultSuggestions = [
  'Almond milk', 'Banana', 'Chicken breast', 'Greek yogurt',
  'Oatmeal', 'Brown rice', 'Avocado', 'Eggs',
];

// ===== HELPER FUNCTIONS =====

// Map theme → neobrutalist surface/ink tokens for inputs and chips.
function quickAddPalette(isDark) {
  const colors = isDark ? darkColors : lightColors;
  return {
    cardBg: colors.nbSurface,
    cardBorder: colors.nbBorder,
    text: colors.nbInk,
    textMuted: colors.nbMuted,
    faint: colors.nbMuted,
    inputBg: colors.nbSurfaceChip,
    inputText: colors.nbInk,
    inputPlaceholder: colors.nbMuted,
    inputBorder: colors.nbBorder,
    chipBg: colors.nbSurfaceChip,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Quick-add a food by typing calories and macros.
 * @param {{ onLogFood: Function, suggestions?: string[], userId?: string, reserveShellBottomNav?: boolean }} props
 */
export function QuickAddNutrition({ onLogFood, suggestions = defaultSuggestions, userId, reserveShellBottomNav = false }) {
  const { isDark } = useTheme();
  const nbColors = isDark ? darkColors : lightColors;
  const shellBottomPad = useShellBottomNavInset(16);
  // Manipulate here: transparent when nested under a shell that already paints the background
  const screenBg = reserveShellBottomNav ? 'transparent' : nbColors.nbBackground;
  const palette = quickAddPalette(isDark);

  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [calories, setCalories] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [macros, setMacros] = useState(initialMacros);
  const [recentFoods, setRecentFoods] = useState([]);

  const loadRecentFoods = useCallback(async () => {
    if (!userId) return;
    try {
      const recent = await getRecentFoods(userId, 12);
      setRecentFoods(recent || []);
    } catch (_) {
      setRecentFoods([]);
    }
  }, [userId]);

  useEffect(() => {
    loadRecentFoods();
  }, [loadRecentFoods]);

  const applyRecentFood = (item) => {
    const name = item?.name || item?.food_name || '';
    setFoodName(name);
    setQuantity(Number(item?.servingSize) || Number(item?.serving_size) || 1);
    setCalories(String(Math.round(Number(item?.calories) || 0)));
    setMacros({
      protein: item?.protein ? String(item.protein) : '',
      carbs: item?.carbs ? String(item.carbs) : '',
      fat: item?.fat ? String(item.fat) : '',
      sodium: item?.sodium ? String(item.sodium) : '',
      fiber: item?.fiber ? String(item.fiber) : '',
      sugar: item?.sugar ? String(item.sugar) : '',
      servingSize: item?.servingGrams ? String(item.servingGrams) : '',
      servingUnit: item?.servingUnit || item?.serving_unit || '',
    });
    if (item?.protein || item?.carbs || item?.fat) setShowMacros(true);
  };

  const isValid = foodName.trim().length > 0 && Number(calories) > 0;

  const handleLog = () => {
    if (!isValid) return;
    const { name } = readableFoodTitle({ name: foodName.trim(), source: 'manual' });
    const entry = {
      name,
      quantity,
      calories: parseFloat(calories),
      ...macros,
    };
    onLogFood?.(entry);
    Alert.alert('Success', `${entry.name} · ${entry.calories} cal logged`);
    setFoodName('');
    setQuantity(1);
    setCalories('');
    setMacros(initialMacros);
    setShowMacros(false);
  };

  const updateMacro = (key, value) =>
    setMacros((m) => ({ ...m, [key]: value }));

  const updateQuantity = (delta) =>
    setQuantity((q) => Math.max(0, parseFloat((q + delta).toFixed(2))));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: screenBg, flex: 1 }]}
      contentContainerStyle={{ paddingBottom: reserveShellBottomNav ? shellBottomPad : QUICK_ADD_BOTTOM_PAD }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
        <NbCard style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.headerIcon, { borderColor: nbColors.nbBorder, backgroundColor: nbColors.nbSurfaceChip }]}>
              <Ionicons name="flame" size={20} color={nbColors.nbInk} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: palette.text }]}>Quick Add</Text>
              <Text style={[styles.headerSubtitle, { color: palette.textMuted }]}>Log your nutrition</Text>
            </View>
          </View>
        </View>

        {recentFoods.length > 0 ? (
          <View style={styles.recentSection}>
            <Text style={[styles.label, { color: palette.textMuted, marginBottom: 10 }]}>Your saved foods</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {recentFoods.map((item) => {
                const key = item.id || item.name || item.food_name;
                const label = item.name || item.food_name || 'Food';
                const cal = Math.round(Number(item.calories) || 0);
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.85}
                    onPress={() => applyRecentFood(item)}
                    style={[styles.recentChip, { backgroundColor: palette.chipBg, borderColor: palette.inputBorder }]}
                  >
                    <Text style={[styles.recentChipName, { color: palette.text }]} numberOfLines={2}>
                      {label}
                    </Text>
                    <Text style={[styles.recentChipMeta, { color: palette.textMuted }]}>
                      {cal > 0 ? `${cal} cal` : 'Tap to fill'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* Food Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.textMuted }]}>FOOD NAME</Text>
          <FieldInput
            placeholder="e.g. Almond milk"
            value={foodName}
            onChangeText={setFoodName}
            palette={palette}
          />
        </View>

        {/* Quantity */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.textMuted }]}>QUANTITY (SERVINGS)</Text>
          <View style={[styles.quantityContainer, { borderColor: palette.inputBorder, backgroundColor: palette.inputBg }]}>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: palette.chipBg }]}
              onPress={() => updateQuantity(-0.5)}
            >
              <Ionicons name="remove" size={18} color={palette.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={[styles.quantityInput, { color: palette.inputText }]}
              value={String(quantity)}
              onChangeText={(val) => setQuantity(parseFloat(val) || 0)}
              keyboardType="decimal-pad"
              placeholderTextColor={palette.inputPlaceholder}
            />
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: palette.chipBg }]}
              onPress={() => updateQuantity(0.5)}
            >
              <Ionicons name="add" size={18} color={palette.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calories */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.textMuted }]}>CALORIES</Text>
          <FieldInput
            placeholder="e.g. 60"
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            palette={palette}
          />
        </View>

        {/* Toggle Macros */}
        <TouchableOpacity
          style={styles.toggleMacros}
          onPress={() => setShowMacros(!showMacros)}
        >
          <Ionicons
            name={showMacros ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={palette.textMuted}
          />
          <Text style={[styles.toggleText, { color: palette.textMuted }]}>
            {showMacros ? 'Hide macros' : 'Add macros'}
          </Text>
        </TouchableOpacity>

        {/* Macros Grid */}
        {showMacros && (
          <View style={styles.macrosGrid}>
          <MacroField label="Protein (g)" value={macros.protein} onChange={(v) => updateMacro('protein', v)} palette={palette} />
          <MacroField label="Carbs (g)" value={macros.carbs} onChange={(v) => updateMacro('carbs', v)} palette={palette} />
          <MacroField label="Fat (g)" value={macros.fat} onChange={(v) => updateMacro('fat', v)} palette={palette} />
          <MacroField label="Sodium (mg)" value={macros.sodium} onChange={(v) => updateMacro('sodium', v)} palette={palette} />
          <MacroField label="Fiber (g)" value={macros.fiber} onChange={(v) => updateMacro('fiber', v)} palette={palette} />
          <MacroField label="Sugar (g)" value={macros.sugar} onChange={(v) => updateMacro('sugar', v)} palette={palette} />

            {/* Serving Size */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: palette.textMuted }]}>SERVING SIZE (G/SERVING)</Text>
              <FieldInput
                placeholder="0"
                value={macros.servingSize}
                onChangeText={(v) => updateMacro('servingSize', v)}
                keyboardType="number-pad"
                palette={palette}
              />
            </View>

            {/* Serving Unit */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: palette.textMuted }]}>SERVING UNIT</Text>
              <FieldInput
                placeholder="g, ml, cup..."
                value={macros.servingUnit}
                onChangeText={(v) => updateMacro('servingUnit', v)}
                palette={palette}
              />
            </View>
          </View>
        )}

        {/* Log Food Button — brand gradient via NbButton */}
        <NbButton variant="brand" onPress={handleLog} disabled={!isValid}>
          Log Food
        </NbButton>
        </NbCard>
    </ScrollView>
  );
}

/* ============ COMPONENTS ============ */

function FieldInput({ palette, style, ...rest }) {
  return (
    <TextInput
      {...rest}
      style={[
        styles.fieldInput,
        {
          backgroundColor: palette.inputBg,
          color: palette.inputText,
          borderColor: palette.inputBorder,
        },
        style,
      ]}
      placeholderTextColor={palette.inputPlaceholder}
    />
  );
}

function MacroField({ label, value, onChange, palette }) {
  return (
    <View style={styles.macroField}>
      <Text style={[styles.macroLabelText, { color: palette.textMuted }]}>{label}</Text>
      <FieldInput palette={palette} value={value} onChangeText={onChange} placeholder="0" keyboardType="number-pad" />
    </View>
  );
}

/* ============ STYLES ============ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  // NbCard owns border/shadow — only pad content here
  card: {
    padding: spacing.md + 4,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
  },
  headerSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: spacing.md + 4,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    marginBottom: spacing.sm,
    letterSpacing: 0.8,
  },
  fieldInput: {
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: nb.chipPadding,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    borderWidth: nb.borderWidth,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  quantityButton: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbChip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  toggleMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: nb.minTouchTarget,
  },
  toggleText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  macrosGrid: {
    gap: 10,
    marginBottom: spacing.md + 4,
  },
  macroField: {
    gap: 4,
  },
  macroLabelText: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  recentSection: {
    marginBottom: spacing.md + 4,
  },
  recentScroll: {
    gap: 10,
    paddingRight: spacing.sm,
  },
  recentChip: {
    maxWidth: 140,
    minWidth: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
  recentChipName: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 4,
  },
  recentChipMeta: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
});

export default QuickAddNutrition;

