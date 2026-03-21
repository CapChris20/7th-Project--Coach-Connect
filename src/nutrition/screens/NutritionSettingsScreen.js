/**
 * COACHCONNECT — Nutrition Settings Screen
 * Edit daily goals (calories, protein, carbs, fat) and reset to onboarding.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';

const ACCENT = {
  hotPink: '#FF6B9D', // Keep your hot pink
  orange: '#F97316', // Keep your orange
  purple: '#C084FC', // Keep your light purple
  cyan: '#06B6D4', // Keep your cyan
  green: '#22C55E', // Keep your green
};

function getColors(isDark) {
  return isDark
    ? {
        ...ACCENT,
        cardBg: 'rgba(255,255,255,0.05)',
        cardBorder: 'rgba(255,255,255,0.09)',
        text: '#ffffff',
        textMuted: 'rgba(255,255,255,0.5)',
        inputBg: 'rgba(255,255,255,0.06)',
        screenBg: '#0A0A0F',
      }
    : {
        ...ACCENT,
        cardBg: 'rgba(0,0,0,0.04)',
        cardBorder: 'rgba(0,0,0,0.08)',
        text: '#1a0a2e',
        textMuted: 'rgba(26,10,46,0.6)',
        inputBg: 'rgba(0,0,0,0.06)',
        screenBg: '#F5F3F7',
      };
}

const OZ_TO_G = 28.3495;

export default function NutritionSettingsScreen({
  onClose,
  onGoalsUpdated,
  onResetOnboarding,
  currentGoals = {},
}) {
  const { isDark } = useTheme();
  const colors = useMemo(() => getColors(isDark), [isDark]);

  const [calories, setCalories] = useState(String(currentGoals.calories ?? 2000));
  const [protein, setProtein] = useState(String(((currentGoals.proteinTarget ?? 150) / OZ_TO_G).toFixed(1)));
  const [carbs, setCarbs] = useState(String(((currentGoals.carbsTarget ?? 200) / OZ_TO_G).toFixed(1)));
  const [fat, setFat] = useState(String(((currentGoals.fatTarget ?? 65) / OZ_TO_G).toFixed(1)));
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (onGoalsUpdated) {
      const cal = Math.max(500, Math.min(5000, parseInt(calories, 10) || 2000));
      const pro = Math.round(Math.max(0, Math.min(500, parseFloat(protein) || 0) * OZ_TO_G));
      const carb = Math.round(Math.max(0, Math.min(600, parseFloat(carbs) || 0) * OZ_TO_G));
      const f = Math.round(Math.max(0, Math.min(200, parseFloat(fat) || 0) * OZ_TO_G));
      setSaving(true);
      onGoalsUpdated({
        calories: cal,
        proteinTarget: pro,
        carbsTarget: carb,
        fatTarget: f,
        macroSplit: { protein: pro, carbs: carb, fat: f },
      });
      setSaving(false);
      onClose?.();
    } else {
      onClose?.();
    }
  };

  const handleResetOnboarding = () => {
    Alert.alert(
      'Reset nutrition goals?',
      'This will clear your calorie and macro goals. You’ll see the onboarding flow again next time you open Nutrition.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            onResetOnboarding?.();
            onClose?.();
          },
        },
      ]
    );
  };

  const numInput = (value, setValue, label, placeholder) => (
    <View style={[s.row, { borderBottomColor: colors.cardBorder }]}>
      <Text style={[s.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        style={[s.input, { color: colors.text, backgroundColor: colors.inputBg }]}
        value={value}
        onChangeText={setValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
      />
    </View>
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: colors.screenBg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <View style={[s.header, { borderBottomColor: colors.cardBorder }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[s.title, { color: colors.text }]}>Nutrition Settings</Text>
          <View style={s.placeholder} />
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Text style={[s.sectionTitle, { color: colors.textMuted }]}>Daily goals</Text>
            {numInput(calories, setCalories, 'Calories (kcal/day)', '2000')}
            {numInput(protein, setProtein, 'Protein (oz)', '5.3')}
            {numInput(carbs, setCarbs, 'Carbs (oz)', '7.1')}
            {numInput(fat, setFat, 'Fat (oz)', '2.3')}
          </View>

          <Text style={[s.estimatedMacrosLabel, { color: colors.textMuted }]}>
            Estimated macros at this calorie target
          </Text>
          <View style={s.macroPreviewRow}>
            <Text style={[s.macroPreviewText, { color: colors.textMuted }]}>
              Protein: {Math.round((Number(calories) || 0) * 0.3 / 4)}g  ·  Carbs: {Math.round((Number(calories) || 0) * 0.4 / 4)}g  ·  Fat: {Math.round((Number(calories) || 0) * 0.3 / 9)}g
            </Text>
          </View>

          <TouchableOpacity onPress={handleSave} activeOpacity={0.9} style={s.saveBtnWrap} disabled={saving}>
            <LinearGradient
              colors={[colors.hotPink, colors.orange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.saveBtn}
            >
              <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save goals'}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={[s.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginTop: 24 }]}>
            <Text style={[s.sectionTitle, { color: colors.textMuted }]}>Reset</Text>
            <Text style={[s.resetDesc, { color: colors.textMuted }]}>
              Clear your goals and see the onboarding flow again (calorie and macro setup).
            </Text>
            <TouchableOpacity
              onPress={handleResetOnboarding}
              style={[s.resetBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh-outline" size={20} color={colors.orange} />
              <Text style={[s.resetBtnText, { color: colors.text }]}>Reset to onboarding</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: '700' },
  placeholder: { width: 32 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  card: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  estimatedMacrosLabel: { fontSize: 12, marginBottom: 6 },
  macroPreviewRow: { marginBottom: 16 },
  macroPreviewText: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  label: { fontSize: 15, fontWeight: '500' },
  input: {
    width: 100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  saveBtnWrap: { marginTop: 20 },
  saveBtn: {
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resetDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  resetBtnText: { fontSize: 15, fontWeight: '600' },
});
