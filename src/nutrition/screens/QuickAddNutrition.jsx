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
  const { isDark } = useTheme();
  const t = isDark
    ? {
        cardGrad: ['rgba(30,28,48,0.85)', 'rgba(18,16,32,0.92)'],
        text: '#FFFFFF',
        textMuted: 'rgba(255,255,255,0.6)',
        faint: 'rgba(255,255,255,0.3)',
        inputBg: 'rgba(255,255,255,0.06)',
        inputText: '#FFFFFF',
        inputPlaceholder: 'rgba(255,255,255,0.35)',
        borderNeutral: 'rgba(255,255,255,0.12)',
      }
    : {
        cardGrad: ['rgba(255,255,255,0.95)', 'rgba(245,243,255,0.98)'],
        text: '#0A0A0F',
        textMuted: 'rgba(10,10,15,0.6)',
        faint: 'rgba(10,10,15,0.35)',
        inputBg: 'rgba(10,10,15,0.04)',
        inputText: '#0A0A0F',
        inputPlaceholder: 'rgba(10,10,15,0.4)',
        borderNeutral: 'rgba(0,0,0,0.10)',
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Card with gradient backdrop */}
      <LinearGradient
        colors={t.cardGrad}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={['#FF6B9D', '#F97316']}
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
          <AccentInput
            accent="cyan"
            placeholder="e.g. Almond milk"
            value={foodName}
            onChangeText={setFoodName}
            t={t}
          />
        </View>

        {/* Quantity */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: t.textMuted }]}>QUANTITY (SERVINGS)</Text>
          <View style={styles.quantityContainer}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(-0.5)}
            >
              <Ionicons name="remove" size={18} color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,15,0.7)'} />
            </TouchableOpacity>
            <TextInput
              style={[styles.quantityInput, { color: t.inputText }]}
              value={String(quantity)}
              onChangeText={(val) => setQuantity(parseFloat(val) || 0)}
              keyboardType="decimal-pad"
              placeholderTextColor={t.inputPlaceholder}
            />
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => updateQuantity(0.5)}
            >
              <Ionicons name="add" size={18} color={isDark ? 'rgba(255,255,255,0.85)' : 'rgba(10,10,15,0.7)'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Calories */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: t.textMuted }]}>CALORIES</Text>
          <AccentInput
            accent="orange"
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
              accent="#C084FC"
            />
            <MacroField
              label="Carbs (g)"
              value={macros.carbs}
              onChange={(v) => updateMacro('carbs', v)}
              accent="#FF6B9D"
            />
            <MacroField
              label="Fat (g)"
              value={macros.fat}
              onChange={(v) => updateMacro('fat', v)}
              accent="#7C1D6F"
            />
            <MacroField
              label="Sodium (mg)"
              value={macros.sodium}
              onChange={(v) => updateMacro('sodium', v)}
              accent="#C084FC"
            />
            <MacroField
              label="Fiber (g)"
              value={macros.fiber}
              onChange={(v) => updateMacro('fiber', v)}
              accent="#FF6B9D"
            />
            <MacroField
              label="Sugar (g)"
              value={macros.sugar}
              onChange={(v) => updateMacro('sugar', v)}
              accent="#7C1D6F"
            />

            {/* Serving Size */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.textMuted }]}>SERVING SIZE (G/SERVING)</Text>
              <ColorInput
                placeholder="0"
                value={macros.servingSize}
                onChangeText={(v) => updateMacro('servingSize', v)}
                neutral
                keyboardType="number-pad"
                t={t}
              />
            </View>

            {/* Serving Unit */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: t.textMuted }]}>SERVING UNIT</Text>
              <ColorInput
                placeholder="g, ml, cup..."
                value={macros.servingUnit}
                onChangeText={(v) => updateMacro('servingUnit', v)}
                neutral
                t={t}
              />
            </View>
          </View>
        )}

        {/* Log Food Button */}
        <LinearGradient
          colors={['#FF6B9D', '#C026D3', '#7C3AED']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
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
      </LinearGradient>
    </ScrollView>
  );
}

/* ============ COMPONENTS ============ */

function AccentInput({ accent, ...props }) {
  const { t, style, ...rest } = props;
  const accentMap = {
    // Updated to match CoachConnect palette request
    cyan: '#C084FC', // purple
    orange: '#FF6B9D', // pink
  };

  const color = accentMap[accent] || '#7C1D6F'; // dark magenta fallback

  return (
    <TextInput
      {...rest}
      style={[
        styles.accentInput,
        { borderColor: color, borderWidth: 1.5 },
        { backgroundColor: t?.inputBg, color: t?.inputText },
        style,
      ]}
      placeholderTextColor={t?.inputPlaceholder ?? 'rgba(255,255,255,0.35)'}
    />
  );
}

function ColorInput({ accent, neutral = false, ...props }) {
  const { t, style, ...rest } = props;
  const borderColor = neutral ? 'rgba(255,255,255,0.12)' : accent;
  return (
    <TextInput
      {...rest}
      style={[
        styles.colorInput,
        { borderColor: neutral ? (t?.borderNeutral ?? borderColor) : borderColor, borderWidth: 1.5 },
        { backgroundColor: t?.inputBg, color: t?.inputText },
        style,
      ]}
      placeholderTextColor={t?.inputPlaceholder ?? 'rgba(255,255,255,0.35)'}
    />
  );
}

function MacroField({ label, value, onChange, accent }) {
  return (
    <View style={styles.macroField}>
      <View style={styles.macroLabel}>
        <View
          style={[
            styles.macroDot,
            { backgroundColor: accent, shadowColor: accent },
          ]}
        />
        <Text style={styles.macroLabelText}>{label}</Text>
      </View>
      <ColorInput
        neutral
        value={value}
        onChangeText={onChange}
        placeholder="0"
        keyboardType="number-pad"
      />
    </View>
  );
}

/* ============ STYLES ============ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: '#0A0A0F',
  },
  card: {
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
    marginTop: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  accentInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: 'white',
  },
  colorInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '500',
    color: 'white',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#7C1D6F', // dark magenta
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
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
    color: 'rgba(255,255,255,0.6)',
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
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  macroLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.55)',
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

