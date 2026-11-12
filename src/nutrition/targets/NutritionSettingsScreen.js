// Design Law Nutrition settings / goals editor (PNG 19–24).
// Flow: hub rows → Set your numbers (black cal card + macro sliders) → Save; Reset opens confirm sheet.
// Used by DailyLogContent (embedded) or standalone. Firestore goal keys stay frozen.
//
// vocab: HardShadow = solid offset shadow; NbSlider = gradient-fill track + ink knob

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { useShellBottomNavInset, SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS } from '../../navigation/bottomMenuSpacing';
import { accentGradients, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbSlider from '../../look-and-feel/NbSlider';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbSheet from '../../look-and-feel/NbSheet';

// ===== NAMED CONSTANTS =====

const DEFAULT_CALORIES = 2000;
const DEFAULT_PROTEIN_GRAMS = 150;
const DEFAULT_CARBS_GRAMS = 200;
const DEFAULT_FAT_GRAMS = 65;
const MIN_DAILY_CALORIES = 500;
const MAX_DAILY_CALORIES = 5000;
const MAX_PROTEIN_GRAMS = 500;
const MAX_CARBS_GRAMS = 600;
const MAX_FAT_GRAMS = 200;
const SHELL_NAV_INSET = 24;
const STANDALONE_BOTTOM_SAFE_PAD = 16;
const STANDALONE_EXTRA_SCROLL_PAD = 32;
const KCAL_PER_P = 4;
const KCAL_PER_C = 4;
const KCAL_PER_F = 9;

// Manipulate here: preset splits at the current calorie target (PNG macro chips)
const PRESETS = {
  balanced: { id: 'balanced', label: 'Balanced', p: 0.3, c: 0.4, f: 0.3 },
  high_protein: { id: 'high_protein', label: 'High protein', p: 0.4, c: 0.3, f: 0.3 },
  low_carb: { id: 'low_carb', label: 'Low carb', p: 0.35, c: 0.2, f: 0.45 },
};

// Slider accent fills only — never card borders (Design Law)
const CAL_SLIDER_GRAD = accentGradients[3]; // blue→purple
const PROTEIN_SLIDER_GRAD = accentGradients[2]; // purple→pink
const CARBS_SLIDER_GRAD = accentGradients[1]; // coral→red
const FAT_SLIDER_GRAD = accentGradients[4]; // peach→orange

const FOOD_ICON = require('../../assets/icons/handoff/apple.png');
const MUSCLE_ICON = require('../../assets/icons/handoff/muscle.png');
const HYDRATION_ICON = require('../../assets/icons/handoff/hydration.png');

// ===== HELPER FUNCTIONS =====

function clampCalories(raw) {
  const n = Math.round(Number(raw) || DEFAULT_CALORIES);
  return Math.max(MIN_DAILY_CALORIES, Math.min(MAX_DAILY_CALORIES, n));
}

function clampGrams(raw, max) {
  return Math.round(Math.max(0, Math.min(max, Number(raw) || 0)));
}

function macrosFromPreset(calories, preset) {
  const cal = clampCalories(calories);
  return {
    protein: Math.round((cal * preset.p) / KCAL_PER_P),
    carbs: Math.round((cal * preset.c) / KCAL_PER_C),
    fat: Math.round((cal * preset.f) / KCAL_PER_F),
  };
}

function macrosAddUpKcal(protein, carbs, fat) {
  return Math.round(
    clampGrams(protein, MAX_PROTEIN_GRAMS) * KCAL_PER_P
      + clampGrams(carbs, MAX_CARBS_GRAMS) * KCAL_PER_C
      + clampGrams(fat, MAX_FAT_GRAMS) * KCAL_PER_F,
  );
}

function scrollContentBottomPad(embedded, reserveShellBottomNav, shellBottomPad, safeBottom) {
  if (embedded || reserveShellBottomNav) return shellBottomPad;
  return Math.max(safeBottom, STANDALONE_BOTTOM_SAFE_PAD) + STANDALONE_EXTRA_SCROLL_PAD;
}

function goalsPayload(calories, protein, carbs, fat) {
  const cal = clampCalories(calories);
  const proteinGrams = clampGrams(protein, MAX_PROTEIN_GRAMS);
  const carbsGrams = clampGrams(carbs, MAX_CARBS_GRAMS);
  const fatGrams = clampGrams(fat, MAX_FAT_GRAMS);
  return {
    calories: cal,
    proteinTarget: proteinGrams,
    carbsTarget: carbsGrams,
    fatTarget: fatGrams,
    macroSplit: { protein: proteinGrams, carbs: carbsGrams, fat: fatGrams },
  };
}

/**
 * Ink-filled meal-style chip for macro presets (PNG 19 — HardShadow pills).
 */
function PresetChip({ label, selected, onPress, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={[
          styles.presetChip,
          {
            backgroundColor: selected ? colors.nbFill : colors.nbSurface,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <Text style={[styles.presetChipText, { color: selected ? colors.nbOnFill : colors.nbInk }]}>
          {label}
        </Text>
      </TouchableOpacity>
    </HardShadow>
  );
}

/**
 * One settings hub row (PNG 21) with gradient icon chip + chevron.
 */
function SettingsHubRow({ title, subtitle, icon, index, onPress, colors, showDivider }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.hubRow}>
      <NbIconChip source={icon} size={40} index={index} />
      <View style={styles.hubText}>
        <Text style={[styles.hubTitle, { color: colors.nbInk }]}>{title}</Text>
        <Text style={[styles.hubSub, { color: colors.nbMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.nbInk} />
      {showDivider ? (
        <View style={[styles.hubDivider, { backgroundColor: colors.nbBorder }]} />
      ) : null}
    </TouchableOpacity>
  );
}

/**
 * PNG 19 — Set your numbers editor body.
 */
function SetNumbersBody({
  scrollBottomPad,
  colors,
  calories,
  setCalories,
  protein,
  setProtein,
  carbs,
  setCarbs,
  fat,
  setFat,
  presetId,
  setPresetId,
  onSave,
  saving,
  onBackToHub,
}) {
  const applyPreset = (preset) => {
    setPresetId(preset.id);
    const next = macrosFromPreset(calories, preset);
    setProtein(next.protein);
    setCarbs(next.carbs);
    setFat(next.fat);
  };

  const addUp = macrosAddUpKcal(protein, carbs, fat);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
      {...FORM_SCROLL_PROPS}
    >
      {typeof onBackToHub === 'function' ? (
        <TouchableOpacity onPress={onBackToHub} style={styles.backLink} hitSlop={8}>
          <Text style={[styles.backLinkText, { color: colors.nbMuted }]}>← Nutrition settings</Text>
        </TouchableOpacity>
      ) : null}

      <Text style={[styles.kicker, { color: colors.nbMuted }]}>Daily targets</Text>
      <Text style={[styles.headline, { color: colors.nbInk }]}>Set your numbers</Text>

      {/* Black calories card */}
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
        <View
          style={[
            styles.calCard,
            {
              backgroundColor: colors.nbFill,
              borderColor: colors.nbOnFill,
            },
          ]}
        >
          <Text style={[styles.calLabel, { color: colors.nbMuted }]}>CALORIES PER DAY</Text>
          <Text style={[styles.calValue, { color: colors.nbOnFill }]}>
            {clampCalories(calories).toLocaleString()} kcal
          </Text>
          <NbSlider
            value={clampCalories(calories)}
            min={MIN_DAILY_CALORIES}
            max={MAX_DAILY_CALORIES}
            onChange={setCalories}
            colors={CAL_SLIDER_GRAD}
            style={{ marginTop: 12, marginBottom: 14 }}
          />
          <TouchableOpacity
            onPress={() => {
              // Placeholder — same as old “Calculate for me” alert path
              applyPreset(PRESETS.balanced);
            }}
            activeOpacity={0.88}
            style={[
              styles.calcBtn,
              { backgroundColor: colors.nbOnFill, borderColor: colors.nbFill },
            ]}
          >
            <Text style={[styles.calcBtnText, { color: colors.nbFill }]}>Calculate for me</Text>
          </TouchableOpacity>
        </View>
      </HardShadow>

      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>
        MACRO TARGETS AT THIS CALORIE TARGET
      </Text>
      <View style={styles.presetRow}>
        {Object.values(PRESETS).map((preset) => (
          <PresetChip
            key={preset.id}
            label={preset.label}
            selected={presetId === preset.id}
            onPress={() => applyPreset(preset)}
            colors={colors}
          />
        ))}
      </View>

      {/* White macro card with gradient sliders */}
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
        <View
          style={[
            styles.macroCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <NbSlider
            label="Protein"
            valueLabel={`${clampGrams(protein, MAX_PROTEIN_GRAMS)} g`}
            value={clampGrams(protein, MAX_PROTEIN_GRAMS)}
            min={0}
            max={MAX_PROTEIN_GRAMS}
            onChange={(n) => {
              setPresetId(null);
              setProtein(n);
            }}
            colors={PROTEIN_SLIDER_GRAD}
            style={styles.macroSlider}
          />
          <NbSlider
            label="Carbs"
            valueLabel={`${clampGrams(carbs, MAX_CARBS_GRAMS)} g`}
            value={clampGrams(carbs, MAX_CARBS_GRAMS)}
            min={0}
            max={MAX_CARBS_GRAMS}
            onChange={(n) => {
              setPresetId(null);
              setCarbs(n);
            }}
            colors={CARBS_SLIDER_GRAD}
            style={styles.macroSlider}
          />
          <NbSlider
            label="Fats"
            valueLabel={`${clampGrams(fat, MAX_FAT_GRAMS)} g`}
            value={clampGrams(fat, MAX_FAT_GRAMS)}
            min={0}
            max={MAX_FAT_GRAMS}
            onChange={(n) => {
              setPresetId(null);
              setFat(n);
            }}
            colors={FAT_SLIDER_GRAD}
            style={styles.macroSlider}
          />
          <View style={[styles.macroFooter, { borderTopColor: colors.nbBorder }]}>
            <Text style={[styles.macroFooterLabel, { color: colors.nbMuted }]}>
              MACROS ADD UP TO
            </Text>
            <Text style={[styles.macroFooterValue, { color: colors.nbInk }]}>
              {addUp.toLocaleString()} kcal
            </Text>
          </View>
        </View>
      </HardShadow>

      <NbButton variant="fill" onPress={onSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save goals'}
      </NbButton>
    </ScrollView>
  );
}

/**
 * PNG 21 — Nutrition settings hub (rows + loved/skip pills + reset).
 */
function SettingsHubBody({
  scrollBottomPad,
  colors,
  calories,
  protein,
  carbs,
  fat,
  lovedFoods,
  skipFoods,
  onOpenTargets,
  onResetPress,
}) {
  const calSub = `${clampCalories(calories).toLocaleString()} kcal`;
  const macroSub = `${clampGrams(protein, MAX_PROTEIN_GRAMS)} g protein · ${clampGrams(carbs, MAX_CARBS_GRAMS)} g carbs · ${clampGrams(fat, MAX_FAT_GRAMS)} g fat`;
  const loveSkipSub = `${lovedFoods.length} loved · ${skipFoods.length} skipped`;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
      {...FORM_SCROLL_PROPS}
    >
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
        <View
          style={[
            styles.hubCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <SettingsHubRow
            title="Daily targets"
            subtitle={calSub}
            icon={FOOD_ICON}
            index={0}
            onPress={onOpenTargets}
            colors={colors}
            showDivider
          />
          <SettingsHubRow
            title="Macro targets"
            subtitle={macroSub}
            icon={MUSCLE_ICON}
            index={2}
            onPress={onOpenTargets}
            colors={colors}
            showDivider
          />
          <SettingsHubRow
            title="Foods you love and skip"
            subtitle={loveSkipSub}
            icon={HYDRATION_ICON}
            index={6}
            onPress={onOpenTargets}
            colors={colors}
            showDivider={false}
          />
        </View>
      </HardShadow>

      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>FOODS YOU LOVE AND SKIP</Text>
      <View style={styles.pillWrap}>
        {lovedFoods.map((name) => (
          <HardShadow key={`love-${name}`} offset={nb.shadowOffsetSmall} radius={999}>
            <View
              style={[styles.pill, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}
            >
              <Text style={[styles.pillText, { color: colors.nbOnFill }]}>{name}</Text>
            </View>
          </HardShadow>
        ))}
        {skipFoods.map((name) => (
          <HardShadow key={`skip-${name}`} offset={nb.shadowOffsetSmall} radius={999}>
            <View
              style={[styles.pill, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}
            >
              <Text style={[styles.pillText, { color: colors.nbInk }]}>{name}</Text>
            </View>
          </HardShadow>
        ))}
        {lovedFoods.length === 0 && skipFoods.length === 0 ? (
          <Text style={[styles.emptyPills, { color: colors.nbMuted }]}>
            Add favorites during onboarding — they show up here for the coach and search.
          </Text>
        ) : null}
      </View>

      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton} style={{ marginTop: 8 }}>
        <TouchableOpacity
          onPress={onResetPress}
          activeOpacity={0.88}
          style={[
            styles.resetBtn,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.resetBtnText, { color: colors.nbInk }]}>Reset to onboarding</Text>
        </TouchableOpacity>
      </HardShadow>
      <Text style={[styles.resetHint, { color: colors.nbMuted }]}>
        Clears your targets and shows setup again next time you open Nutrition.
      </Text>
    </ScrollView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Nutrition settings hub + Set your numbers editor.
 * @param {{ onClose?: Function, onGoalsUpdated?: Function, onResetOnboarding?: Function, currentGoals?: object, embedded?: boolean, reserveShellBottomNav?: boolean, favoriteFoods?: string[], leastFavoriteFoods?: string[] }} props
 */
export default function NutritionSettingsScreen({
  onClose,
  onGoalsUpdated,
  onResetOnboarding,
  currentGoals = {},
  embedded = false,
  reserveShellBottomNav = false,
  favoriteFoods = [],
  leastFavoriteFoods = [],
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellBottomPad = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = scrollContentBottomPad(
    embedded,
    reserveShellBottomNav,
    shellBottomPad,
    insets.bottom,
  );

  // Hub first (PNG 21); tapping a row opens Set your numbers (PNG 19).
  const [view, setView] = useState('hub');
  const [showResetSheet, setShowResetSheet] = useState(false);

  const [calories, setCalories] = useState(
    clampCalories(currentGoals.calories ?? DEFAULT_CALORIES),
  );
  const [protein, setProtein] = useState(
    clampGrams(currentGoals.proteinTarget ?? DEFAULT_PROTEIN_GRAMS, MAX_PROTEIN_GRAMS),
  );
  const [carbs, setCarbs] = useState(
    clampGrams(currentGoals.carbsTarget ?? DEFAULT_CARBS_GRAMS, MAX_CARBS_GRAMS),
  );
  const [fat, setFat] = useState(
    clampGrams(currentGoals.fatTarget ?? DEFAULT_FAT_GRAMS, MAX_FAT_GRAMS),
  );
  const [presetId, setPresetId] = useState('high_protein');
  const [saving, setSaving] = useState(false);

  const lovedFoods = useMemo(
    () => (Array.isArray(favoriteFoods) ? favoriteFoods : []).filter(Boolean),
    [favoriteFoods],
  );
  const skipFoods = useMemo(
    () => (Array.isArray(leastFavoriteFoods) ? leastFavoriteFoods : []).filter(Boolean),
    [leastFavoriteFoods],
  );

  const handleSave = () => {
    if (!onGoalsUpdated) {
      onClose?.();
      return;
    }
    setSaving(true);
    onGoalsUpdated(goalsPayload(calories, protein, carbs, fat));
    setSaving(false);
    setView('hub');
    onClose?.();
  };

  const confirmReset = () => {
    setShowResetSheet(false);
    onResetOnboarding?.();
    onClose?.();
  };

  const body =
    view === 'targets' ? (
      <SetNumbersBody
        scrollBottomPad={scrollBottomPad}
        colors={colors}
        calories={calories}
        setCalories={setCalories}
        protein={protein}
        setProtein={setProtein}
        carbs={carbs}
        setCarbs={setCarbs}
        fat={fat}
        setFat={setFat}
        presetId={presetId}
        setPresetId={setPresetId}
        onSave={handleSave}
        saving={saving}
        onBackToHub={embedded ? () => setView('hub') : undefined}
      />
    ) : (
      <SettingsHubBody
        scrollBottomPad={scrollBottomPad}
        colors={colors}
        calories={calories}
        protein={protein}
        carbs={carbs}
        fat={fat}
        lovedFoods={lovedFoods}
        skipFoods={skipFoods}
        onOpenTargets={() => setView('targets')}
        onResetPress={() => setShowResetSheet(true)}
      />
    );

  const headerTitle = view === 'targets' ? 'Set your numbers' : 'Nutrition settings';
  const headerSub = view === 'targets' ? 'Daily targets' : null;

  const resetSheet = (
    <NbSheet
      visible={showResetSheet}
      onClose={() => setShowResetSheet(false)}
      title="Reset nutrition goals?"
    >
      <LinearGradient
        colors={accentGradients[1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.warnBadge}
      >
        <Text style={styles.warnBadgeText}>Clears your targets</Text>
      </LinearGradient>
      <Text style={[styles.resetSheetBody, { color: colors.nbMuted }]}>
        This clears your targets and shows onboarding again next time you open Nutrition. Your logged
        foods stay.
      </Text>
      <View style={styles.resetActions}>
        <View style={{ flex: 1 }}>
          <NbButton variant="plain" onPress={() => setShowResetSheet(false)}>
            Cancel
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton variant="fill" onPress={confirmReset}>
            Reset goals
          </NbButton>
        </View>
      </View>
    </NbSheet>
  );

  if (embedded) {
    return (
      <View style={[styles.root, styles.rootEmbedded]}>
        <NbPageHeader
          title={headerTitle}
          subtitle={headerSub}
          onBack={
            view === 'targets'
              ? () => setView('hub')
              : typeof onClose === 'function'
                ? onClose
                : undefined
          }
          skipTopSafeInset
        />
        {body}
        {resetSheet}
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.nbBackground }]} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NbPageHeader
        title={headerTitle}
        subtitle={headerSub}
        onBack={
          view === 'targets'
            ? () => setView('hub')
            : onClose
        }
        skipTopSafeInset
      />
      {body}
      {resetSheet}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  rootEmbedded: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: 4,
  },
  block: { marginBottom: 16 },
  kicker: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  backLink: { marginBottom: 8 },
  backLinkText: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  calCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
  },
  calLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  calValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    letterSpacing: -0.8,
  },
  calcBtn: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  calcBtnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  presetChipActive: {
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  presetChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  macroCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
  },
  macroSlider: { marginBottom: 14 },
  macroFooter: {
    borderTopWidth: nb.borderWidthDivider,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroFooterLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  macroFooterValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  hubCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  hubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 64,
    position: 'relative',
  },
  hubText: { flex: 1, minWidth: 0 },
  hubTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  hubSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginTop: 2,
  },
  hubDivider: {
    position: 'absolute',
    left: 66,
    right: 14,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  emptyPills: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 18,
  },
  resetBtn: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  resetBtnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  resetHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  warnBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    borderColor: '#0A0A0A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  warnBadgeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    color: '#0A0A0A',
  },
  resetSheetBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  resetActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
});
