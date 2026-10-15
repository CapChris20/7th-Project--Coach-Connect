// Nutrition goals editor — calories + protein/carbs/fat lanes.
// Flow: load current goals → nudge or type numbers → Save writes targets → optional reset to onboarding.
// Used by: daily log (embedded) or as a standalone Goals screen.

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
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset, SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { NUT_MACRO_GRADIENTS } from '../nutritionColors';

// ===== NAMED CONSTANTS =====

const PINK = '#BE185D';
const PINK_SOFT = '#FF6B9D';
const ORANGE = '#C2410C';
const ORANGE_SOFT = '#F97316';
const CYAN = '#06B6D4';
const CTA_GRAD = [PINK, ORANGE];

const DEFAULT_CALORIES = 2000;
const DEFAULT_PROTEIN_GRAMS = 150;
const DEFAULT_CARBS_GRAMS = 200;
const DEFAULT_FAT_GRAMS = 65;
const MIN_DAILY_CALORIES = 500;
const MAX_DAILY_CALORIES = 5000;
const MAX_PROTEIN_GRAMS = 500;
const MAX_CARBS_GRAMS = 600;
const MAX_FAT_GRAMS = 200;
const CALORIE_NUDGE_STEP = 50;
const PROTEIN_SPLIT_FRACTION = 0.3;
const CARBS_SPLIT_FRACTION = 0.4;
const FAT_SPLIT_FRACTION = 0.3;
const KCAL_PER_GRAM_PROTEIN_OR_CARB = 4;
const KCAL_PER_GRAM_FAT = 9;
const SHELL_NAV_INSET = 24;
const STANDALONE_BOTTOM_SAFE_PAD = 16;
const STANDALONE_EXTRA_SCROLL_PAD = 32;
const BAR_FILL_PERCENT = 100;
const MIN_VISIBLE_BAR_PERCENT = 4;
const PROTEIN_BAR_MAX_GRAMS = 250;
const CARBS_BAR_MAX_GRAMS = 350;
const FAT_BAR_MAX_GRAMS = 120;
const MACRO_INPUT_MAX_LENGTH = 3;
const CALORIE_INPUT_MAX_LENGTH = 4;

const MACRO_LANES = [
  {
    key: 'protein',
    label: 'Protein',
    icon: require('../../assets/icons/Protein.png'),
    gradient: NUT_MACRO_GRADIENTS.protein,
    barMax: PROTEIN_BAR_MAX_GRAMS,
  },
  {
    key: 'carbs',
    label: 'Carbs',
    icon: require('../../assets/icons/Carbs.png'),
    gradient: NUT_MACRO_GRADIENTS.carbs,
    barMax: CARBS_BAR_MAX_GRAMS,
  },
  {
    key: 'fat',
    label: 'Fat',
    icon: require('../../assets/icons/Fats.png'),
    gradient: NUT_MACRO_GRADIENTS.fat,
    barMax: FAT_BAR_MAX_GRAMS,
  },
];

// ===== HELPER FUNCTIONS =====

/**
 * Light vs dark paint tokens for the goals editor.
 * @param {boolean} isDark
 * @returns {object}
 */
function getPalette(isDark) {
  if (isDark) {
    return {
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
    };
  }
  return {
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

/**
 * Clamp a typed calorie string into the allowed daily range.
 * @param {string|number} rawCalories
 * @returns {number}
 */
function clampDailyCalories(rawCalories) {
  const parsed = parseInt(rawCalories, 10) || DEFAULT_CALORIES;
  return Math.max(MIN_DAILY_CALORIES, Math.min(MAX_DAILY_CALORIES, parsed));
}

/**
 * Balanced macro grams suggested from a calorie target (30/40/30 split).
 * @param {number} calorieTarget
 * @returns {{ protein: number, carbs: number, fat: number }}
 */
function estimatedMacrosFromCalories(calorieTarget) {
  const calories = Number(calorieTarget) || 0;
  return {
    protein: Math.round((calories * PROTEIN_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    carbs: Math.round((calories * CARBS_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    fat: Math.round((calories * FAT_SPLIT_FRACTION) / KCAL_PER_GRAM_FAT),
  };
}

/**
 * Clamp a macro gram field to a sane max.
 * @param {string|number} rawGrams
 * @param {number} maxGrams
 * @returns {number}
 */
function clampMacroGrams(rawGrams, maxGrams) {
  return Math.round(Math.max(0, Math.min(maxGrams, parseFloat(rawGrams) || 0)));
}

/**
 * How full the lane bar should look (0–1), from the typed grams vs that lane’s visual max.
 * @param {string|number} value
 * @param {number} barMax
 * @returns {number}
 */
function laneFillFraction(value, barMax) {
  const grams = Math.max(0, parseFloat(value) || 0);
  return Math.min(1, grams / barMax);
}

/**
 * Width percent for the filled portion of a macro bar.
 * Manipulate here: MIN_VISIBLE_BAR_PERCENT keeps a tiny sliver visible when grams > 0.
 * @param {number} fillFraction
 * @returns {number}
 */
function laneFillWidthPercent(fillFraction) {
  if (fillFraction <= 0) return 0;
  return Math.max(fillFraction * BAR_FILL_PERCENT, MIN_VISIBLE_BAR_PERCENT);
}

/**
 * Bottom padding so the floating tab bar never covers Save / Reset.
 * @param {boolean} embedded
 * @param {boolean} reserveShellBottomNav
 * @param {number} shellBottomPad
 * @param {number} safeBottom
 * @returns {number}
 */
function scrollContentBottomPad(embedded, reserveShellBottomNav, shellBottomPad, safeBottom) {
  if (embedded || reserveShellBottomNav) return shellBottomPad;
  return Math.max(safeBottom, STANDALONE_BOTTOM_SAFE_PAD) + STANDALONE_EXTRA_SCROLL_PAD;
}

/**
 * Build the goals object the parent saves to Firestore / local state.
 * @param {string} caloriesText
 * @param {string} proteinText
 * @param {string} carbsText
 * @param {string} fatText
 * @returns {object}
 */
function goalsPayloadFromFields(caloriesText, proteinText, carbsText, fatText) {
  const calories = clampDailyCalories(caloriesText);
  const proteinGrams = clampMacroGrams(proteinText, MAX_PROTEIN_GRAMS);
  const carbsGrams = clampMacroGrams(carbsText, MAX_CARBS_GRAMS);
  const fatGrams = clampMacroGrams(fatText, MAX_FAT_GRAMS);
  return {
    calories,
    proteinTarget: proteinGrams,
    carbsTarget: carbsGrams,
    fatTarget: fatGrams,
    macroSplit: { protein: proteinGrams, carbs: carbsGrams, fat: fatGrams },
  };
}

/**
 * One macro row: icon, editable grams, gradient fill bar.
 * @param {{ row: object, value: string, onChange: Function, palette: object }} props
 */
function MacroLane({ row, value, onChange, palette }) {
  const fillFraction = laneFillFraction(value, row.barMax);
  const fillWidth = `${laneFillWidthPercent(fillFraction)}%`;

  return (
    <View style={[laneStyles.wrap, { backgroundColor: palette.cardSolid, borderColor: palette.panelBorder }]}>
      <View style={laneStyles.topRow}>
        <Image source={row.icon} style={laneStyles.icon} resizeMode="contain" />
        <Text style={[laneStyles.label, { color: palette.text }]}>{row.label}</Text>
        <View style={laneStyles.inputWrap}>
          <TextInput
            style={[laneStyles.input, { color: palette.text, backgroundColor: palette.inputBg }]}
            value={value}
            onChangeText={onChange}
            keyboardType="number-pad"
            maxLength={MACRO_INPUT_MAX_LENGTH}
            selectTextOnFocus
            accessibilityLabel={`${row.label} grams`}
          />
          <Text style={[laneStyles.unit, { color: palette.textMuted }]}>g</Text>
        </View>
      </View>
      <View style={[laneStyles.track, { backgroundColor: palette.inputBg }]}>
        <View style={[laneStyles.fill, { width: fillWidth }]}>
          <LinearGradient
            colors={row.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * Calorie panel with −50 / +50 and a balanced-split hint.
 * @param {object} props
 */
function CaloriePanel({ calories, setCalories, onNudge, estMacros, palette }) {
  return (
    <View style={[screenStyles.calPanel, { backgroundColor: palette.cardSolid, borderColor: palette.panelBorder }]}>
      <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={screenStyles.calStripe} />
      <Text style={[screenStyles.calLabel, { color: palette.textMuted }]}>CALORIES PER DAY</Text>

      <View style={screenStyles.calRow}>
        <TouchableOpacity
          onPress={() => onNudge(-CALORIE_NUDGE_STEP)}
          style={[screenStyles.stepBtn, { backgroundColor: palette.stepBg, borderColor: palette.stepBorder }]}
          activeOpacity={0.75}
        >
          <Text style={[screenStyles.stepBtnText, { color: PINK_SOFT }]}>−50</Text>
        </TouchableOpacity>

        <View style={screenStyles.calCenter}>
          <TextInput
            style={[screenStyles.calInput, { color: palette.text }]}
            value={calories}
            onChangeText={setCalories}
            keyboardType="number-pad"
            maxLength={CALORIE_INPUT_MAX_LENGTH}
            selectTextOnFocus
            accessibilityLabel="Daily calories"
          />
          <Text style={[screenStyles.calUnit, { color: palette.textMuted }]}>kcal</Text>
        </View>

        <TouchableOpacity
          onPress={() => onNudge(CALORIE_NUDGE_STEP)}
          style={[screenStyles.stepBtn, { backgroundColor: palette.stepBg, borderColor: palette.stepBorder }]}
          activeOpacity={0.75}
        >
          <Text style={[screenStyles.stepBtnText, { color: ORANGE_SOFT }]}>+50</Text>
        </TouchableOpacity>
      </View>

      <Text style={[screenStyles.splitHint, { color: palette.textMuted }]}>
        Balanced split at this level{' '}
        <Text style={{ color: PINK_SOFT }}>{estMacros.protein}g P</Text>
        {' · '}
        <Text style={{ color: ORANGE_SOFT }}>{estMacros.carbs}g C</Text>
        {' · '}
        <Text style={{ color: CYAN }}>{estMacros.fat}g F</Text>
      </Text>
    </View>
  );
}

/**
 * Scrollable goals form body shared by embedded and standalone shells.
 * @param {object} props
 */
function GoalsEditorBody({
  scrollBottomPad,
  palette,
  calories,
  setCalories,
  onNudgeCalories,
  estMacros,
  macroValues,
  macroSetters,
  onSave,
  saving,
  onResetOnboarding,
}) {
  return (
    <ScrollView
      style={screenStyles.scroll}
      contentContainerStyle={[screenStyles.scrollContent, { paddingBottom: scrollBottomPad }]}
      showsVerticalScrollIndicator
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <Text style={[screenStyles.kicker, { color: palette.textMuted }]}>Daily targets</Text>
      <Text style={[screenStyles.headline, { color: palette.text }]}>Set your numbers</Text>
      <Text style={[screenStyles.subline, { color: palette.textSoft }]}>
        Tap values to edit. Use +/− for calories.
      </Text>

      <CaloriePanel
        calories={calories}
        setCalories={setCalories}
        onNudge={onNudgeCalories}
        estMacros={estMacros}
        palette={palette}
      />

      <Text style={[screenStyles.sectionTitle, { color: palette.textMuted }]}>Macro targets</Text>

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
        onPress={onSave}
        activeOpacity={0.88}
        style={[
          screenStyles.saveBtn,
          { backgroundColor: palette.cardSolid, borderColor: palette.panelBorder },
        ]}
        disabled={saving}
      >
        <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={screenStyles.saveStripe} />
        <Text style={[screenStyles.saveText, { color: PINK_SOFT }]}>{saving ? 'Saving…' : 'Save goals'}</Text>
      </TouchableOpacity>

      <View style={[screenStyles.resetZone, { borderTopColor: palette.panelBorder }]}>
        <Text style={[screenStyles.resetHint, { color: palette.textSoft }]}>
          Want to start fresh? This clears targets and runs setup again.
        </Text>
        <TouchableOpacity onPress={onResetOnboarding} activeOpacity={0.7} hitSlop={8}>
          <Text style={[screenStyles.resetLink, { color: palette.destructive }]}>Reset to onboarding</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Edit daily calorie and macro targets. Embeds under the daily log or stands alone.
 * @param {{ onClose?: Function, onGoalsUpdated?: Function, onResetOnboarding?: Function, currentGoals?: object, embedded?: boolean, reserveShellBottomNav?: boolean }} props
 */
export default function NutritionSettingsScreen({
  onClose,
  onGoalsUpdated,
  onResetOnboarding,
  currentGoals = {},
  /** Parent renders TopHeader + bottom nav (DailyLogContent). */
  embedded = false,
  reserveShellBottomNav = false,
}) {
  const { isDark } = useTheme();
  const palette = useMemo(() => getPalette(isDark), [isDark]);
  const insets = useSafeAreaInsets();
  const shellBottomPad = useShellBottomNavInset(SHELL_NAV_INSET);
  // Floating BottomMenuBar always overlays when embedded in DailyLogContent
  // (either this container's nav or the parent shell's). Never stack insets twice.
  const scrollBottomPad = scrollContentBottomPad(
    embedded,
    reserveShellBottomNav,
    shellBottomPad,
    insets.bottom,
  );

  const [calories, setCalories] = useState(String(currentGoals.calories ?? DEFAULT_CALORIES));
  const [protein, setProtein] = useState(String(currentGoals.proteinTarget ?? DEFAULT_PROTEIN_GRAMS));
  const [carbs, setCarbs] = useState(String(currentGoals.carbsTarget ?? DEFAULT_CARBS_GRAMS));
  const [fat, setFat] = useState(String(currentGoals.fatTarget ?? DEFAULT_FAT_GRAMS));
  const [saving, setSaving] = useState(false);

  const macroValues = { protein, carbs, fat };
  const macroSetters = { protein: setProtein, carbs: setCarbs, fat: setFat };

  const estMacros = useMemo(
    () => estimatedMacrosFromCalories(Number(calories) || 0),
    [calories],
  );

  // 1. Nudge calories by ±50 within the allowed range.
  const nudgeCalories = (delta) => {
    const next = clampDailyCalories((parseInt(calories, 10) || DEFAULT_CALORIES) + delta);
    setCalories(String(next));
  };

  // 2. Save clamped targets to the parent, then close.
  const handleSave = () => {
    if (!onGoalsUpdated) {
      onClose?.();
      return;
    }
    setSaving(true);
    onGoalsUpdated(goalsPayloadFromFields(calories, protein, carbs, fat));
    setSaving(false);
    onClose?.();
  };

  // 3. Confirm before clearing goals and sending the user back through onboarding.
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
      ],
    );
  };

  const editorBody = (
    <GoalsEditorBody
      scrollBottomPad={scrollBottomPad}
      palette={palette}
      calories={calories}
      setCalories={setCalories}
      onNudgeCalories={nudgeCalories}
      estMacros={estMacros}
      macroValues={macroValues}
      macroSetters={macroSetters}
      onSave={handleSave}
      saving={saving}
      onResetOnboarding={handleResetOnboarding}
    />
  );

  if (embedded) {
    return <View style={[screenStyles.root, screenStyles.rootEmbedded]}>{editorBody}</View>;
  }

  return (
    <SafeAreaView style={[screenStyles.root, { backgroundColor: palette.bg }]} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={[screenStyles.standaloneHeader, { borderBottomColor: palette.panelBorder }]}>
        <TouchableOpacity onPress={onClose} style={screenStyles.standaloneBack} hitSlop={12}>
          <Ionicons name="chevron-back" size={28} color={palette.text} />
        </TouchableOpacity>
        <Text style={[screenStyles.standaloneTitle, { color: palette.text }]}>Goals</Text>
        <View style={screenStyles.standaloneBack} />
      </View>
      {editorBody}
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  root: { flex: 1 },
  rootEmbedded: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
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

const laneStyles = StyleSheet.create({
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
    height: 6,
    borderRadius: 99,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    overflow: 'hidden',
  },
});
