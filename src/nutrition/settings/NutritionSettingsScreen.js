/**
 * Nutrition Settings Screen
 *
 * Purpose: UI screen or component: Nutrition Settings Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: NutritionSettingsScreen
 *
 * @file-header
 */
/**
 * Nutrition goals editor — full redesign (May 2026).
 * Pink / orange palette, custom macro PNGs, no gradient-rim cards.
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared-ui/ThemeContext';

const PINK = '#BE185D';
const PINK_SOFT = '#FF6B9D';
const ORANGE = '#C2410C';
const ORANGE_SOFT = '#F97316';
const CYAN = '#06B6D4';
const CTA_GRAD = [PINK, ORANGE];

const MACRO_LANES = [
  {
    key: 'protein',
    label: 'Protein',
    icon: require('../../assets/icons/Protein.png'),
    accent: PINK_SOFT,
    barMax: 250,
  },
  {
    key: 'carbs',
    label: 'Carbs',
    icon: require('../../assets/icons/Carbs.png'),
    accent: ORANGE_SOFT,
    barMax: 350,
  },
  {
    key: 'fat',
    label: 'Fat',
    icon: require('../../assets/icons/Fats.png'),
    accent: CYAN,
    barMax: 120,
  },
];

function getPalette(isDark) {
  return isDark
    ? {
        bg: '#0A0A0F',
        panel: 'rgba(255,255,255,0.045)',
        cardSolid: '#12131A',
        panelBorder: 'rgba(255,255,255,0.10)',
        text: '#FFFFFF',
        textSoft: 'rgba(255,255,255,0.62)',
        textMuted: 'rgba(255,255,255,0.38)',
        inputBg: 'rgba(255,255,255,0.07)',
        stepBg: 'rgba(255,255,255,0.06)',
        stepBorder: 'rgba(255,255,255,0.12)',
        destructive: '#FCA5A5',
      }
    : {
        bg: '#F4F4F8',
        panel: '#FFFFFF',
        cardSolid: '#FFFFFF',
        panelBorder: 'rgba(10,10,15,0.08)',
        text: '#0A0A0F',
        textSoft: 'rgba(10,10,15,0.62)',
        textMuted: 'rgba(10,10,15,0.42)',
        inputBg: 'rgba(0,0,0,0.04)',
        stepBg: 'rgba(190,24,93,0.06)',
        stepBorder: 'rgba(190,24,93,0.22)',
        destructive: '#DC2626',
      };
}

function MacroLane({ row, value, onChange, palette }) {
  const n = Math.max(0, parseFloat(value) || 0);
  const fill = Math.min(1, n / row.barMax);

  return (
    <View style={[lane.wrap, { backgroundColor: palette.cardSolid, borderColor: palette.panelBorder }]}>
      <View style={lane.topRow}>
        <Image source={row.icon} style={lane.icon} resizeMode="contain" />
        <Text style={[lane.label, { color: palette.text }]}>{row.label}</Text>
        <View style={lane.inputWrap}>
          <TextInput
            style={[lane.input, { color: palette.text, backgroundColor: palette.inputBg }]}
            value={value}
            onChangeText={onChange}
            keyboardType="number-pad"
            maxLength={3}
            selectTextOnFocus
            accessibilityLabel={`${row.label} grams`}
          />
          <Text style={[lane.unit, { color: palette.textMuted }]}>g</Text>
        </View>
      </View>
      <View style={[lane.track, { backgroundColor: palette.inputBg }]}>
        <View style={[lane.fill, { width: `${fill * 100}%`, backgroundColor: row.accent }]} />
      </View>
    </View>
  );
}

export default function NutritionSettingsScreen({
  onClose,
  onGoalsUpdated,
  onResetOnboarding,
  currentGoals = {},
  /** Parent renders CoachConnectHeader + bottom nav (NutritionContainer). */
  embedded = false,
}) {
  const { isDark } = useTheme();
  const palette = useMemo(() => getPalette(isDark), [isDark]);
  const insets = useSafeAreaInsets();
  const scrollBottomPad = Math.max(insets.bottom, 16) + (embedded ? 12 : 32);

  const [calories, setCalories] = useState(String(currentGoals.calories ?? 2000));
  const [protein, setProtein] = useState(String(currentGoals.proteinTarget ?? 150));
  const [carbs, setCarbs] = useState(String(currentGoals.carbsTarget ?? 200));
  const [fat, setFat] = useState(String(currentGoals.fatTarget ?? 65));
  const [saving, setSaving] = useState(false);

  const macroValues = { protein, carbs, fat };
  const macroSetters = { protein: setProtein, carbs: setCarbs, fat: setFat };

  const estMacros = useMemo(() => {
    const cal = Number(calories) || 0;
    return {
      protein: Math.round((cal * 0.3) / 4),
      carbs: Math.round((cal * 0.4) / 4),
      fat: Math.round((cal * 0.3) / 9),
    };
  }, [calories]);

  const nudgeCalories = (delta) => {
    const next = Math.max(500, Math.min(5000, (parseInt(calories, 10) || 2000) + delta));
    setCalories(String(next));
  };

  const handleSave = () => {
    if (onGoalsUpdated) {
      const cal = Math.max(500, Math.min(5000, parseInt(calories, 10) || 2000));
      const pro = Math.round(Math.max(0, Math.min(500, parseFloat(protein) || 0)));
      const carb = Math.round(Math.max(0, Math.min(600, parseFloat(carbs) || 0)));
      const f = Math.round(Math.max(0, Math.min(200, parseFloat(fat) || 0)));
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
      'This clears your targets and shows onboarding again next time you open Nutrition.',
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

  const body = (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={[s.scrollContent, { paddingBottom: scrollBottomPad }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
          <Text style={[s.kicker, { color: palette.textMuted }]}>Daily targets</Text>
          <Text style={[s.headline, { color: palette.text }]}>Set your numbers</Text>
          <Text style={[s.subline, { color: palette.textSoft }]}>
            Tap values to edit. Use +/− for calories.
          </Text>

          <View style={[s.calPanel, { backgroundColor: palette.cardSolid, borderColor: palette.panelBorder }]}>
            <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.calStripe} />
            <Text style={[s.calLabel, { color: palette.textMuted }]}>CALORIES PER DAY</Text>

            <View style={s.calRow}>
              <TouchableOpacity
                onPress={() => nudgeCalories(-50)}
                style={[s.stepBtn, { backgroundColor: palette.stepBg, borderColor: palette.stepBorder }]}
                activeOpacity={0.75}
              >
                <Text style={[s.stepBtnText, { color: PINK_SOFT }]}>−50</Text>
              </TouchableOpacity>

              <View style={s.calCenter}>
                <TextInput
                  style={[s.calInput, { color: palette.text }]}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                  accessibilityLabel="Daily calories"
                />
                <Text style={[s.calUnit, { color: palette.textMuted }]}>kcal</Text>
              </View>

              <TouchableOpacity
                onPress={() => nudgeCalories(50)}
                style={[s.stepBtn, { backgroundColor: palette.stepBg, borderColor: palette.stepBorder }]}
                activeOpacity={0.75}
              >
                <Text style={[s.stepBtnText, { color: ORANGE_SOFT }]}>+50</Text>
              </TouchableOpacity>
            </View>

            <Text style={[s.splitHint, { color: palette.textMuted }]}>
              Balanced split at this level{' '}
              <Text style={{ color: PINK_SOFT }}>{estMacros.protein}g P</Text>
              {' · '}
              <Text style={{ color: ORANGE_SOFT }}>{estMacros.carbs}g C</Text>
              {' · '}
              <Text style={{ color: CYAN }}>{estMacros.fat}g F</Text>
            </Text>
          </View>

          <Text style={[s.sectionTitle, { color: palette.textMuted }]}>Macro targets</Text>

          {MACRO_LANES.map((row) => (
            <MacroLane
              key={row.key}
              row={row}
              value={macroValues[row.key]}
              onChange={macroSetters[row.key]}
              palette={palette}
            />
          ))}

          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.88}
            style={[
              s.saveBtn,
              { backgroundColor: palette.cardSolid, borderColor: palette.panelBorder },
            ]}
            disabled={saving}
          >
            <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveStripe} />
            <Text style={[s.saveText, { color: PINK_SOFT }]}>{saving ? 'Saving…' : 'Save goals'}</Text>
          </TouchableOpacity>

          <View style={[s.resetZone, { borderTopColor: palette.panelBorder }]}>
            <Text style={[s.resetHint, { color: palette.textSoft }]}>
              Want to start fresh? This clears targets and runs setup again.
            </Text>
            <TouchableOpacity onPress={handleResetOnboarding} activeOpacity={0.7} hitSlop={8}>
              <Text style={[s.resetLink, { color: palette.destructive }]}>Reset to onboarding</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
  );

  if (embedded) {
    return <View style={[s.root, { backgroundColor: palette.bg }]}>{body}</View>;
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: palette.bg }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[s.standaloneHeader, { borderBottomColor: palette.panelBorder }]}>
        <TouchableOpacity onPress={onClose} style={s.standaloneBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={palette.text} />
        </TouchableOpacity>
        <Text style={[s.standaloneTitle, { color: palette.text }]}>Goals</Text>
        <View style={s.standaloneBack} />
      </View>
      {body}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  standaloneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  standaloneBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  standaloneTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    marginBottom: 6,
  },
  subline: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 22,
  },
  calPanel: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingBottom: 18,
    marginBottom: 20,
    overflow: 'hidden',
  },
  calStripe: {
    height: 3,
    marginHorizontal: -18,
    marginBottom: 16,
  },
  calLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
  },
  calRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 14,
  },
  stepBtn: {
    minWidth: 52,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  calCenter: {
    flex: 1,
    alignItems: 'center',
  },
  calInput: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.5,
    padding: 0,
    minWidth: 120,
    textAlign: 'center',
  },
  calUnit: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  splitHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  saveBtn: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  resetZone: {
    marginTop: 28,
    paddingTop: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
  },
  resetHint: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 300,
  },
  resetLink: {
    fontSize: 15,
    fontWeight: '700',
  },
});

const lane = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  icon: {
    width: 40,
    height: 40,
  },
  label: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  unit: {
    fontSize: 14,
    fontWeight: '600',
    width: 14,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});
