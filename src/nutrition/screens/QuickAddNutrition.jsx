/**
 * Quick Add Nutrition
 *
 * Purpose: UI screen or component: Quick Add Nutrition. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: QuickAddNutrition
 *
 * @file-header
 */
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';

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

export function QuickAddNutrition({ onLogFood, suggestions = defaultSuggestions }) {
  const { isDark, colors } = useTheme();
  const screenBg = isDark ? colors?.background ?? '#0A0A0F' : colors?.background ?? '#F2F2F7';
  const t = isDark
    ? {
        cardBg: '#14121A',
        cardBorder: 'rgba(255,255,255,0.10)',
        text: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.62)',
        faint: 'rgba(255,255,255,0.28)',
        inputBg: 'rgba(255,255,255,0.06)',
        inputText: '#FFFFFF',
        inputPlaceholder: 'rgba(255,255,255,0.38)',
        inputBorder: 'rgba(255,255,255,0.12)',
        chipBg: 'rgba(255,255,255,0.08)',
      }
    : {
        cardBg: '#FFFFFF',
        cardBorder: 'rgba(15,23,42,0.10)',
        text: '#0F172A',
        textMuted: 'rgba(15,23,42,0.55)',
        faint: 'rgba(15,23,42,0.28)',
        inputBg: 'rgba(15,23,42,0.04)',
        inputText: '#0F172A',
        inputPlaceholder: 'rgba(15,23,42,0.38)',
        inputBorder: 'rgba(15,23,42,0.12)',
        chipBg: 'rgba(15,23,42,0.06)',
      };

  const [foodName, setFoodName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [calories, setCalories] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [macros, setMacros] = useState(initialMacros);

  const isValid = foodName.trim().length > 0 && Number(calories) > 0;

  const handleLog = () => {
    if (!isValid) return;
    const entry = {
      name: foodName.trim(),
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
      style={[styles.container, { backgroundColor: screenBg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <LinearGradient
        colors={isDark ? ['#BE185D', '#EA580C'] : ['#BE185D', '#FB923C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cardRim}
      >
        <View style={[styles.card, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#9F1239', '#EA580C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.headerIcon}
            >
              <Ionicons name="flame" size={20} color="white" />
            </LinearGradient>
            <View>
              <Text style={[styles.headerTitle, { color: t.text }]}>Quick Add</Text>
              <Text style={[styles.headerSubtitle, { color: t.textMuted }]}>Log your nutrition</Text>
            </View>
          </View>
          <Ionicons name="sparkles" size={16} color={t.faint} />
        </View>

        {/* Food Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: t.textMuted }]}>FOOD NAME</Text>
          <FieldInput
            placeholder="e.g. Almond milk"
            value={foodName}
            onChangeText={setFoodName}
            t={t}
          />
        </View>

        {/* Quantity */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: t.textMuted }]}>QUANTITY (SERVINGS)</Text>
          <View style={[styles.quantityContainer, { borderColor: t.inputBorder, backgroundColor: t.inputBg }]}>
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: t.chipBg }]}
              onPress={() => updateQuantity(-0.5)}
            >
              <Ionicons name="remove" size={18} color={t.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={[styles.quantityInput, { color: t.inputText }]}
              value={String(quantity)}
              onChangeText={(val) => setQuantity(parseFloat(val) || 0)}
              keyboardType="decimal-pad"
              placeholderTextColor={t.inputPlaceholder}
            />
            <TouchableOpacity
              style={[styles.quantityButton, { backgroundColor: t.chipBg }]}
              onPress={() => updateQuantity(0.5)}
            >
              <Ionicons name="add" size={18} color={t.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calories */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: t.textMuted }]}>CALORIES</Text>
          <FieldInput
            placeholder="e.g. 60"
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            t={t}
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
            color={t.textMuted}
          />
          <Text style={[styles.toggleText, { color: t.textMuted }]}>
            {showMacros ? 'Hide macros' : 'Add macros'}
          </Text>
        </TouchableOpacity>

        {/* Macros Grid */}
        {showMacros && (
          <View style={styles.macrosGrid}>
            <MacroField
              label="Protein (g)"
              value={macros.protein}
              onChange={(v) => updateMacro('protein', v)}
              dot="#E8799A"
              t={t}
            />
            <MacroField
              label="Carbs (g)"
              value={macros.carbs}
              onChange={(v) => updateMacro('carbs', v)}
              dot="#FB923C"
              t={t}
            />
            <MacroField
              label="Fat (g)"
              value={macros.fat}
              onChange={(v) => updateMacro('fat', v)}
              dot="#A78BFA"
              t={t}
            />
            <MacroField
              label="Sodium (mg)"
              value={macros.sodium}
              onChange={(v) => updateMacro('sodium', v)}
              dot="#94A3B8"
              t={t}
            />
            <MacroField
              label="Fiber (g)"
              value={macros.fiber}
              onChange={(v) => updateMacro('fiber', v)}
              dot="#E8799A"
              t={t}
            />
            <MacroField
              label="Sugar (g)"
              value={macros.sugar}
              onChange={(v) => updateMacro('sugar', v)}
              dot="#FB923C"
              t={t}
            />

            {/* Serving Size */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.textMuted }]}>SERVING SIZE (G/SERVING)</Text>
              <FieldInput
                placeholder="0"
                value={macros.servingSize}
                onChangeText={(v) => updateMacro('servingSize', v)}
                keyboardType="number-pad"
                t={t}
              />
            </View>

            {/* Serving Unit */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.textMuted }]}>SERVING UNIT</Text>
              <FieldInput
                placeholder="g, ml, cup..."
                value={macros.servingUnit}
                onChangeText={(v) => updateMacro('servingUnit', v)}
                t={t}
              />
            </View>
          </View>
        )}

        {/* Log Food Button */}
        <LinearGradient
          colors={['#9F1239', '#EA580C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.logButton, !isValid && styles.logButtonDisabled]}
        >
          <TouchableOpacity
            onPress={handleLog}
            disabled={!isValid}
            style={styles.logButtonTouchable}
          >
            <Ionicons name="flame" size={16} color="white" />
            <Text style={styles.logButtonText}>Log Food</Text>
          </TouchableOpacity>
        </LinearGradient>
        </View>
      </LinearGradient>
    </ScrollView>
  );
}

/* ============ COMPONENTS ============ */

function FieldInput({ t, style, ...rest }) {
  return (
    <TextInput
      {...rest}
      style={[
        styles.fieldInput,
        {
          backgroundColor: t.inputBg,
          color: t.inputText,
          borderColor: t.inputBorder,
        },
        style,
      ]}
      placeholderTextColor={t.inputPlaceholder}
    />
  );
}

function MacroField({ label, value, onChange, dot, t }) {
  return (
    <View style={styles.macroField}>
      <View style={styles.macroLabel}>
        <View style={[styles.macroDot, { backgroundColor: dot }]} />
        <Text style={[styles.macroLabelText, { color: t.textMuted }]}>{label}</Text>
      </View>
      <FieldInput t={t} value={value} onChangeText={onChange} placeholder="0" keyboardType="number-pad" />
    </View>
  );
}

/* ============ STYLES ============ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  cardRim: {
    borderRadius: 28,
    padding: 1,
    marginBottom: 8,
  },
  card: {
    borderRadius: 27,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  fieldInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    borderWidth: 1,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleMacros: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  macrosGrid: {
    gap: 12,
    marginBottom: 20,
  },
  macroField: {
    gap: 6,
  },
  macroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  macroLabelText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  logButton: {
    borderRadius: 16,
    marginTop: 20,
    overflow: 'hidden',
  },
  logButtonDisabled: {
    opacity: 0.4,
  },
  logButtonTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
  },
  logButtonText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: 'white',
    letterSpacing: 0.5,
  },
});

export default QuickAddNutrition;

