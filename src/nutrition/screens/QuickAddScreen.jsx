/**
 * Full-page Quick Add (manual food log).
 * Essentials first; macros and serving details in an optional section.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';

const OZ_TO_G = 28.3495;
const ACCENT = { hotPink: '#FF6B9D', orange: '#F97316', purple: '#C084FC', cyan: '#06B6D4', green: '#22C55E' };

function getColors(isDark) {
  return isDark
    ? {
        ...ACCENT,
        screenBg: '#0A0A0F',
        cardBg: 'rgba(255,255,255,0.06)',
        cardBorder: 'rgba(255,255,255,0.1)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.55)',
        textVeryMuted: 'rgba(255,255,255,0.35)',
        inputFill: 'rgba(255,255,255,0.07)',
      }
    : {
        ...ACCENT,
        screenBg: '#F5F3FF',
        cardBg: 'rgba(255,255,255,0.9)',
        cardBorder: 'rgba(0,0,0,0.08)',
        text: '#1a0a2e',
        textMuted: 'rgba(26,10,46,0.6)',
        textVeryMuted: 'rgba(26,10,46,0.4)',
        inputFill: 'rgba(255,255,255,0.95)',
      };
}

function FieldShell({ leftColor, isDark, colors, children }) {
  return (
    <View
      style={[
        s.fieldShell,
        {
          backgroundColor: colors.inputFill,
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
          borderLeftColor: leftColor,
        },
      ]}
    >
      {children}
    </View>
  );
}

export default function QuickAddScreen({ mealType = 'snacks', onSave, onBack }) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [calories, setCalories] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [servingSize, setServingSize] = useState('3.5');
  const [servingUnit, setServingUnit] = useState('g');

  const num = (v) => (v === '' || v === null ? 0 : Number(v) || 0);
  const qty = Math.max(0.25, num(quantity));
  const cal = num(calories);
  const isValid = name.trim() && cal > 0;

  const bumpQty = (delta) => {
    const n = num(quantity);
    const next = Math.max(0.25, Math.round((n + delta) * 4) / 4);
    setQuantity(String(next));
  };

  const handleSave = () => {
    if (!isValid) return;
    const food = {
      name: name.trim(),
      brand: '',
      calories: cal,
      protein: Math.round(num(protein) * OZ_TO_G * 100) / 100,
      carbs: Math.round(num(carbs) * OZ_TO_G * 100) / 100,
      fat: Math.round(num(fat) * OZ_TO_G * 100) / 100,
      fiber: Math.round(num(fiber) * OZ_TO_G * 100) / 100,
      sugar: Math.round(num(sugar) * OZ_TO_G * 100) / 100,
      sodium: num(sodium),
      servingSize: qty,
      servingUnit: (servingUnit || 'g').trim() || 'g',
      servingGrams: Math.round(num(servingSize) * OZ_TO_G),
      source: 'manual',
    };
    onSave?.(food, mealType);
    onBack?.();
  };

  const mealLabel = mealType ? mealType.charAt(0).toUpperCase() + mealType.slice(1) : 'Meal';
  const labelStyle = [s.label, { color: colors.textMuted }];

  return (
    <View style={[s.container, { backgroundColor: colors.screenBg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.kav}>
        <View style={s.header}>
          <TouchableOpacity onPress={onBack} style={s.backBtn} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>Quick Add</Text>
          <View style={s.backBtn} />
        </View>

        <View
          style={{
            marginHorizontal: 16,
            borderRadius: 18,
            backgroundColor: colors.cardBg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            marginBottom: 12,
            padding: 14,
          }}
        >
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>{mealLabel}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>Manual entry • totals update instantly</Text>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ borderRadius: 22, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cardBorder, padding: 16 }}>
            <Text style={labelStyle}>Food name (required)</Text>
            <FieldShell leftColor={colors.cyan} isDark={isDark} colors={colors}>
              <TextInput
                style={[s.fieldInput, { color: colors.text }]}
                placeholder="Start typing a food name…"
                placeholderTextColor={colors.textVeryMuted}
                value={name}
                onChangeText={setName}
              />
            </FieldShell>

            <Text style={labelStyle}>Quantity (servings)</Text>
            <FieldShell leftColor={colors.hotPink} isDark={isDark} colors={colors}>
              <View style={s.qtyRow}>
                <TouchableOpacity onPress={() => bumpQty(-0.25)} style={s.qtyBtn} activeOpacity={0.75}>
                  <Ionicons name="remove" size={22} color={colors.text} />
                </TouchableOpacity>
                <TextInput
                  style={[s.fieldInput, s.qtyInput, { color: colors.text }]}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  textAlign="center"
                />
                <TouchableOpacity onPress={() => bumpQty(0.25)} style={s.qtyBtn} activeOpacity={0.75}>
                  <Ionicons name="add" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
            </FieldShell>

            <Text style={labelStyle}>Calories (required)</Text>
            <FieldShell leftColor={colors.orange} isDark={isDark} colors={colors}>
              <TextInput
                style={[s.fieldInput, { color: colors.text }]}
                placeholder="e.g. 320"
                placeholderTextColor={colors.textVeryMuted}
                value={calories}
                onChangeText={setCalories}
                keyboardType="numeric"
              />
            </FieldShell>

            <TouchableOpacity
              style={[s.macroToggle, { borderColor: colors.purple + '55' }]}
              onPress={() => setShowMacros((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>
                {showMacros ? 'Hide macros & serving' : 'Add macros'}
              </Text>
              <Ionicons name={showMacros ? 'chevron-up' : 'chevron-down'} size={20} color={colors.purple} />
            </TouchableOpacity>

            {showMacros ? (
              <View style={{ marginTop: 4 }}>
                <Text style={[labelStyle, { marginTop: 0 }]}>Protein (oz)</Text>
                <FieldShell leftColor={colors.purple} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="0" placeholderTextColor={colors.textVeryMuted} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
                </FieldShell>
                <Text style={labelStyle}>Carbs (oz)</Text>
                <FieldShell leftColor={colors.cyan} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="0" placeholderTextColor={colors.textVeryMuted} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
                </FieldShell>
                <Text style={labelStyle}>Fat (oz)</Text>
                <FieldShell leftColor={colors.orange} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="0" placeholderTextColor={colors.textVeryMuted} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
                </FieldShell>
                <Text style={labelStyle}>Sodium (mg)</Text>
                <FieldShell leftColor={colors.green} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="0" placeholderTextColor={colors.textVeryMuted} value={sodium} onChangeText={setSodium} keyboardType="numeric" />
                </FieldShell>
                <Text style={labelStyle}>Fiber (oz)</Text>
                <FieldShell leftColor={colors.green} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="0" placeholderTextColor={colors.textVeryMuted} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" />
                </FieldShell>
                <Text style={labelStyle}>Sugar (oz)</Text>
                <FieldShell leftColor={colors.hotPink} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="0" placeholderTextColor={colors.textVeryMuted} value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" />
                </FieldShell>
                <Text style={labelStyle}>Serving size (oz per serving)</Text>
                <FieldShell leftColor={colors.cyan} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="3.5" placeholderTextColor={colors.textVeryMuted} value={servingSize} onChangeText={setServingSize} keyboardType="decimal-pad" />
                </FieldShell>
                <Text style={labelStyle}>Serving unit (e.g. g, ml, cup)</Text>
                <FieldShell leftColor={colors.purple} isDark={isDark} colors={colors}>
                  <TextInput style={[s.fieldInput, { color: colors.text }]} placeholder="g" placeholderTextColor={colors.textVeryMuted} value={servingUnit} onChangeText={setServingUnit} />
                </FieldShell>
              </View>
            ) : null}
          </View>

          <TouchableOpacity onPress={handleSave} disabled={!isValid} activeOpacity={0.85} style={[s.saveWrap, !isValid && s.saveDisabled]}>
            <LinearGradient colors={isValid ? [colors.hotPink, '#EC4899'] : ['#444', '#333']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
              <Text style={s.saveText}>Log Food</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  kav: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  fieldShell: {
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  fieldInput: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  qtyRow: { flexDirection: 'row', alignItems: 'center' },
  qtyBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: { flex: 1, paddingVertical: 10 },
  macroToggle: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveWrap: { marginTop: 22 },
  saveDisabled: { opacity: 0.55 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
