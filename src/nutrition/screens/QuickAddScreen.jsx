/**
 * Full-page Quick Add (manual food log).
 * Replaces the small modal with a long form: name, quantity, calories, protein, carbs, fat, sodium, fiber, sugar, serving.
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
        textMuted: 'rgba(255,255,255,0.5)',
        textVeryMuted: 'rgba(255,255,255,0.35)',
        inputBg: 'rgba(255,255,255,0.06)',
      }
    : {
        ...ACCENT,
        screenBg: '#F5F3FF',
        cardBg: 'rgba(255,255,255,0.9)',
        cardBorder: 'rgba(0,0,0,0.08)',
        text: '#1a0a2e',
        textMuted: 'rgba(26,10,46,0.6)',
        textVeryMuted: 'rgba(26,10,46,0.4)',
        inputBg: 'rgba(0,0,0,0.05)',
      };
}

export default function QuickAddScreen({ mealType = 'snacks', onSave, onBack }) {
  const { isDark } = useTheme();
  const colors = getColors(isDark);

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [sodium, setSodium] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [servingSize, setServingSize] = useState('3.5');
  const [servingUnit, setServingUnit] = useState('g');

  const num = (v) => (v === '' || v === null) ? 0 : Number(v) || 0;
  const qty = Math.max(0.001, num(quantity));
  const cal = num(calories);
  const isValid = name.trim() && cal > 0;

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

  const inputStyle = [s.input, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, color: colors.text }];
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
        <View style={{ marginHorizontal: 16, borderRadius: 18, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.hotPink + '40', marginBottom: 14, padding: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: colors.text, fontSize: 14, fontWeight: '800' }}>{mealLabel}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Manual entry • totals update instantly</Text>
            </View>
            <View style={[s.mealBadge, { backgroundColor: colors.inputBg, borderColor: colors.hotPink + '60', marginHorizontal: 0, marginBottom: 0 }]}>
              <Text style={[s.mealBadgeText, { color: colors.hotPink }]}>Quick</Text>
            </View>
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ borderRadius: 22, backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.cyan + '40', padding: 16 }}>
              <Text style={labelStyle}>Food name (required)</Text>
              <TextInput style={inputStyle} placeholder="e.g. Almond milk" placeholderTextColor={colors.textMuted} value={name} onChangeText={setName} />

              <Text style={labelStyle}>Quantity (servings)</Text>
              <TextInput style={inputStyle} placeholder="1" placeholderTextColor={colors.textMuted} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />

              <Text style={labelStyle}>Calories (required)</Text>
              <TextInput style={inputStyle} placeholder="e.g. 60" placeholderTextColor={colors.textMuted} value={calories} onChangeText={setCalories} keyboardType="numeric" />

              <View style={s.row}>
                <View style={s.half}>
                  <Text style={labelStyle}>Protein (oz)</Text>
                  <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted} value={protein} onChangeText={setProtein} keyboardType="decimal-pad" />
                </View>
                <View style={s.half}>
                  <Text style={labelStyle}>Carbs (oz)</Text>
                  <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted} value={carbs} onChangeText={setCarbs} keyboardType="decimal-pad" />
                </View>
              </View>

              <View style={s.row}>
                <View style={s.half}>
                  <Text style={labelStyle}>Fat (oz)</Text>
                  <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted} value={fat} onChangeText={setFat} keyboardType="decimal-pad" />
                </View>
                <View style={s.half}>
                  <Text style={labelStyle}>Sodium (mg)</Text>
                  <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted} value={sodium} onChangeText={setSodium} keyboardType="numeric" />
                </View>
              </View>

              <View style={s.row}>
                <View style={s.half}>
                  <Text style={labelStyle}>Fiber (oz)</Text>
                  <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted} value={fiber} onChangeText={setFiber} keyboardType="decimal-pad" />
                </View>
                <View style={s.half}>
                  <Text style={labelStyle}>Sugar (oz)</Text>
                  <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted} value={sugar} onChangeText={setSugar} keyboardType="decimal-pad" />
                </View>
              </View>

              <Text style={labelStyle}>Serving size (oz per serving)</Text>
              <TextInput style={inputStyle} placeholder="3.5" placeholderTextColor={colors.textMuted} value={servingSize} onChangeText={setServingSize} keyboardType="decimal-pad" />

              <Text style={labelStyle}>Serving unit (e.g. g, ml, cup)</Text>
              <TextInput style={inputStyle} placeholder="g" placeholderTextColor={colors.textMuted} value={servingUnit} onChangeText={setServingUnit} />
          </View>

          <TouchableOpacity onPress={handleSave} disabled={!isValid} activeOpacity={0.85} style={[s.saveWrap, !isValid && s.saveDisabled]}>
            <LinearGradient colors={isValid ? [colors.hotPink, colors.orange, colors.purple] : ['#444', '#333']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
              <Text style={s.saveText}>Save to {mealLabel}</Text>
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
  mealBadge: { alignSelf: 'flex-start', marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  mealBadgeText: { fontSize: 13, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, borderWidth: 1 },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  saveWrap: { marginTop: 28 },
  saveDisabled: { opacity: 0.6 },
  saveBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
