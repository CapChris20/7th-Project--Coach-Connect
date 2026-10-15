// Confirm & log sheet for barcode + search: amount, unit, macros, optional nutrition edit.
// Flow: normalize food → pick unit/amount → scale macros → confirm writes a logged portion.
// Used by: FoodSearchScreen and barcode scan verify. Export name FoodConfirmSheet is frozen.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Pencil,
  ArrowRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { finalizeBarcodeFood, resolveServingGrams, parseServingQtyInput } from '../food-details/servingSizeMath';
import { macrosAtGrams } from '../barcode/scannedProductSummary';
import { normalizeFoodForLog } from '../food-search/cleanSearchText';
import { normalizeFoodRecordForStorage } from '../food-search/readableFoodTitle';
import ColorText from '../food-cards/ColorText';
import { SHELL_SAFE_AREA_EDGES, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import TopHeader from '../../for-both/loading-and-header/TopHeader';

// ===== NAMED CONSTANTS =====

const UNIT_OPTIONS = [
  { id: 'servings', label: 'Servings' },
  { id: 'g', label: 'Grams' },
  { id: 'oz', label: 'Oz' },
  { id: 'cups', label: 'Cups' },
  { id: 'tbsp', label: 'Tbsp' },
  { id: 'tsp', label: 'Tsp' },
  { id: 'ml', label: 'Ml' },
];

const MACRO_GRADIENTS = {
  carbs: {
    colors: ['#FF6B35', '#FF8C42', '#FF69B4', '#FF1493'],
    label: '#ffb37a',
    glow: 'rgba(255,105,180,0.35)',
  },
  protein: {
    colors: ['#FF8C00', '#FF6B9D', '#BB86FC', '#9D4EDD'],
    label: '#f472b6',
    glow: 'rgba(157,78,221,0.35)',
  },
  fat: {
    colors: ['#00D9FF', '#00CED1', '#20B2AA'],
    label: '#67e8f9',
    glow: 'rgba(0,217,255,0.35)',
  },
  bonus: {
    colors: ['#FFD700', '#FFED4E', '#FFA500'],
    label: '#fde68a',
    glow: 'rgba(255,215,0,0.35)',
  },
};

const GRADIENT_KEYS = ['carbs', 'protein', 'fat', 'bonus'];
const CAL_GRADIENT = ['#FF6B35', '#FF8C42', '#FF69B4', '#FF1493'];
const LOG_GRADIENT = ['#F59E0B', '#F97316', '#EF4444', '#EC4899'];
const UNIT_ACTIVE_GRADIENT = ['#F97316', '#EC4899'];
const DISPLAY = Platform.select({
  ios: 'SpaceGrotesk_700Bold',
  default: 'SpaceGrotesk_700Bold',
});
const DISPLAY_SEMI = 'SpaceGrotesk_600SemiBold';

const GRAMS_PER_OUNCE = 28.3495;
const GRAMS_PER_CUP = 240;
const GRAMS_PER_TBSP = 15;
const GRAMS_PER_TSP = 5;
const DEFAULT_SERVING_GRAMS = 100;
const MAX_SERVING_GRAMS = 10000;
const MIN_SERVING_GRAMS = 1;
const SHELL_BOTTOM_INSET_EXTRA = 16;
const FOOTER_PAD_IOS = 12;
const FOOTER_PAD_ANDROID = 16;
const AMOUNT_ROUND_FACTOR = 100;
const MIN_SERVINGS_LOGGED = 0.01;
const HALF_SERVING = 0.5;
const BLUR_INTENSITY_DARK = 28;
const BLUR_INTENSITY_LIGHT = 40;
const THEME_FALLBACK_BG = '#1A1B20';
const GRADIENT_DIAGONAL_START = { x: 0, y: 0 };
const GRADIENT_DIAGONAL_END = { x: 1, y: 1 };
const KEYBOARD_OFFSET = 8;
const SCROLL_BOTTOM_PAD = 28;

const UNIT_TO_GRAMS = {
  oz: (amount) => amount * GRAMS_PER_OUNCE,
  cups: (amount) => amount * GRAMS_PER_CUP,
  ml: (amount) => amount,
  servings: (amount, servingGrams) => amount * servingGrams,
  tbsp: (amount) => amount * GRAMS_PER_TBSP,
  tsp: (amount) => amount * GRAMS_PER_TSP,
  g: (amount) => amount,
};

const GRAMS_TO_UNIT_DIVISOR = {
  oz: GRAMS_PER_OUNCE,
  cups: GRAMS_PER_CUP,
  tbsp: GRAMS_PER_TBSP,
  tsp: GRAMS_PER_TSP,
};

// ===== HELPER FUNCTIONS =====

/**
 * Convert a typed amount + unit into grams for macro scaling.
 * @param {*} value
 * @param {string} unit
 * @param {number} servingGrams
 * @returns {number}
 */
function unitToGrams(value, unit, servingGrams) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return servingGrams || DEFAULT_SERVING_GRAMS;
  }
  const gramsPerServing = servingGrams || DEFAULT_SERVING_GRAMS;
  const convert = UNIT_TO_GRAMS[unit] || UNIT_TO_GRAMS.g;
  return convert(amount, gramsPerServing);
}

/**
 * Theme paint tokens for dark vs light confirm sheet.
 * @param {boolean} isDark
 * @returns {object}
 */
function themeTokens(isDark) {
  return {
    bg: isDark ? '#0B0E14' : '#F8FAFC',
    primary: isDark ? '#FFFFFF' : '#0F172A',
    secondary: isDark ? 'rgba(255,255,255,0.55)' : '#64748B',
    muted: isDark ? 'rgba(255,255,255,0.70)' : '#475569',
    label: isDark ? 'rgba(255,255,255,0.45)' : '#64748B',
    glassBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
    glassBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
    chipBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
    chipBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    inputBg: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)',
    inputBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)',
  };
}

/**
 * Uppercase section eyebrow above a glass card block.
 */
function SectionLabel({ children, color }) {
  return (
    <Text style={[styles.sectionLabel, { color }]}>{children}</Text>
  );
}

/**
 * Frosted card shell. Blur only on iOS; Android uses the translucent fill alone.
 */
function ConfirmGlassCard({ isDark, children, style }) {
  const tokens = themeTokens(isDark);
  const blurIntensity = isDark ? BLUR_INTENSITY_DARK : BLUR_INTENSITY_LIGHT;
  const blurTint = isDark ? 'dark' : 'light';

  return (
    <View
      style={[
        styles.glassCard,
        {
          backgroundColor: tokens.glassBg,
          borderColor: tokens.glassBorder,
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={blurIntensity}
          tint={blurTint}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
      <View style={styles.glassInner} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}

/**
 * Tappable macro tile. Tap cycles the gradient palette for that macro.
 */
function MacroTile({ label, value, gradientKey, onCycle, isDark }) {
  const gradientStyle = MACRO_GRADIENTS[gradientKey] || MACRO_GRADIENTS.carbs;
  const tokens = themeTokens(isDark);
  const tileBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)';
  const contentBg = isDark ? 'rgba(11,14,20,0.92)' : 'rgba(248,250,252,0.94)';

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onCycle?.();
      }}
      style={({ pressed }) => [
        styles.macroTile,
        {
          backgroundColor: tileBg,
          shadowColor: gradientStyle.glow,
        },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
      ]}
    >
      <LinearGradient
        colors={gradientStyle.colors}
        start={GRADIENT_DIAGONAL_START}
        end={GRADIENT_DIAGONAL_END}
        style={styles.macroTileBorder}
      />
      <View style={[styles.macroTileContent, { backgroundColor: contentBg }]}>
        <Text style={[styles.macroTileLabel, { color: gradientStyle.label }]}>{label}</Text>
        <View style={styles.macroTileValueRow}>
          <Text style={[styles.macroTileValue, { color: tokens.primary, fontFamily: DISPLAY }]}>
            {Math.round(Number(value) || 0)}
          </Text>
          <Text style={[styles.macroTileUnit, { color: tokens.secondary }]}>g</Text>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Parse typed amount: fractions via parseServingQtyInput, else Number with comma→dot.
 * @param {*} rawValue
 * @returns {number|null}
 */
function parseAmountNumber(rawValue) {
  const parsed = parseServingQtyInput(rawValue);
  if (parsed != null) return parsed;
  if (rawValue === '' || rawValue == null) return null;
  return Number(String(rawValue).replace(',', '.'));
}

/**
 * Clamp gram amount into the sane 1–10000 range.
 * @param {number} gramsRaw
 * @returns {number}
 */
function clampGrams(gramsRaw) {
  return Math.min(MAX_SERVING_GRAMS, Math.max(MIN_SERVING_GRAMS, Math.round(gramsRaw)));
}

/**
 * Convert previous grams into the display string for a newly selected unit.
 * @param {number} prevGrams
 * @param {string} unitId
 * @param {number} defaultAmount
 * @returns {string}
 */
function amountStringForUnit(prevGrams, unitId, defaultAmount) {
  if (unitId === 'servings') {
    const servings =
      Math.round((prevGrams / Math.max(1, defaultAmount)) * AMOUNT_ROUND_FACTOR) /
      AMOUNT_ROUND_FACTOR;
    return String(servings || 1);
  }
  if (unitId === 'g' || unitId === 'ml') {
    return String(Math.round(prevGrams) || defaultAmount);
  }
  const divisor = GRAMS_TO_UNIT_DIVISOR[unitId];
  if (divisor) {
    return String(
      Math.round((prevGrams / divisor) * AMOUNT_ROUND_FACTOR) / AMOUNT_ROUND_FACTOR,
    );
  }
  return String(prevGrams);
}

/**
 * Human serving summary under the calorie hero.
 * @param {string} selectedUnit
 * @param {boolean} hasValidAmount
 * @param {number|null} entered
 * @returns {string}
 */
function servingSummaryLabel(selectedUnit, hasValidAmount, entered) {
  if (selectedUnit === 'servings' && hasValidAmount && entered === 1) return '1 serving';
  if (selectedUnit === 'servings' && hasValidAmount && entered === HALF_SERVING) {
    return '½ serving';
  }
  if (selectedUnit === 'servings' && hasValidAmount) return `${entered} servings`;
  if (hasValidAmount) return `${entered} ${selectedUnit}`;
  return '1 serving';
}

/**
 * Label above the amount field for the active unit.
 * @param {string} selectedUnit
 * @returns {string}
 */
function amountInputLabel(selectedUnit) {
  if (selectedUnit === 'servings') return 'Number of servings';
  const match = UNIT_OPTIONS.find((option) => option.id === selectedUnit);
  return match?.label || selectedUnit;
}

/**
 * Package serving line shown under the food name.
 * @param {object} normalized
 * @param {number} defaultAmount
 * @returns {string}
 */
function packageServingLabelFromFood(normalized, defaultAmount) {
  const fromFields = String(
    normalized?.serving_label
      || normalized?.servingLabel
      || normalized?.portion_text
      || normalized?.serving_description
      || '',
  ).trim();
  return fromFields || `${defaultAmount} g per serving`;
}

/**
 * Build the nutrition override object when the user edits package macros.
 * @param {object} normalized
 * @param {object} labelServingMacros
 * @param {number|null} calories
 * @param {number|null} protein
 * @param {number|null} carbs
 * @param {number|null} fat
 * @param {number} defaultAmount
 * @returns {object}
 */
function nutritionOverrideFromEdits(
  normalized,
  labelServingMacros,
  calories,
  protein,
  carbs,
  fat,
  defaultAmount,
) {
  return {
    ...normalized,
    calories: calories ?? labelServingMacros?.calories ?? normalized.calories,
    protein: protein ?? labelServingMacros?.protein ?? normalized.protein,
    carbs: carbs ?? labelServingMacros?.carbs ?? normalized.carbs,
    fat: fat ?? labelServingMacros?.fat ?? normalized.fat,
    dataBasis: 'label_serving',
    servingGrams: defaultAmount,
    userEditedNutrition: true,
  };
}

/**
 * Build the confirmed food payload for onConfirm.
 * @param {object} options
 * @returns {object}
 */
function buildConfirmedFoodPayload({
  nutritionBase,
  macros,
  grams,
  servingsLogged,
  entered,
  selectedUnit,
  defaultAmount,
  packageServingLabel,
  notes,
  nutritionOverride,
  scannedBarcode,
}) {
  return {
    ...nutritionBase,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
    servingGrams: grams,
    servingAmount: grams,
    servingSize: servingsLogged,
    dataBasis: 'logged_total',
    loggedAmount: entered,
    loggedUnit: selectedUnit,
    preferredUnit: selectedUnit,
    originalUnit: selectedUnit,
    originalAmount: entered,
    labelServingGrams: defaultAmount,
    serving_label: packageServingLabel,
    userVerified: true,
    notes: notes.trim() || undefined,
    userEditedNutrition: Boolean(nutritionOverride || nutritionBase?.userEditedNutrition),
    scannedBarcode: scannedBarcode || nutritionBase?.scannedBarcode || null,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Premium Confirm & log UI for barcode + search hits.
 * @param {{ food: object, onConfirm?: Function, onCancel?: Function, onWrongItem?: Function, title?: string, theme?: object, showVerification?: boolean, scannedBarcode?: string|null, reserveShellBottomNav?: boolean }} props
 */
export default function FoodConfirmSheet({
  food,
  onConfirm,
  onCancel,
  onWrongItem,
  title = 'Confirm & log',
  theme,
  showVerification = false,
  scannedBarcode = null,
  reserveShellBottomNav = false,
}) {
  const { isDark: appIsDark } = useTheme();
  const isDark = theme?.isDark != null ? theme.isDark : appIsDark;
  const tokens = themeTokens(isDark);
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_EXTRA);

  const [amountValue, setAmountValue] = useState('1');
  const [preset, setPreset] = useState('full');
  const [selectedUnit, setSelectedUnit] = useState('servings');
  const [notes, setNotes] = useState('');
  const [editNutritionOpen, setEditNutritionOpen] = useState(false);
  const [editCal, setEditCal] = useState('');
  const [editProtein, setEditProtein] = useState('');
  const [editCarbs, setEditCarbs] = useState('');
  const [editFat, setEditFat] = useState('');
  const [nutritionOverride, setNutritionOverride] = useState(null);
  const [macroGradients, setMacroGradients] = useState({
    carbs: 0,
    protein: 1,
    fat: 2,
  });

  const cycleMacroGradient = (macroKey) => {
    setMacroGradients((previous) => ({
      ...previous,
      [macroKey]: (previous[macroKey] + 1) % GRADIENT_KEYS.length,
    }));
  };

  const normalized = useMemo(
    () => (food ? normalizeFoodForLog(finalizeBarcodeFood(food)) : null),
    [food],
  );
  const display = useMemo(() => {
    if (!normalized) return null;
    return normalizeFoodRecordForStorage(normalized);
  }, [normalized]);
  const defaultAmount = normalized ? resolveServingGrams(normalized) : DEFAULT_SERVING_GRAMS;
  const packageServingLabel = packageServingLabelFromFood(normalized, defaultAmount);

  const foodKey = `${food?.id || ''}|${food?.scannedBarcode || scannedBarcode || ''}|${food?.name || ''}|${defaultAmount}`;

  useEffect(() => {
    if (!food) return;
    setAmountValue('1');
    setPreset('full');
    setSelectedUnit('servings');
    setNutritionOverride(null);
    setEditNutritionOpen(false);
    setNotes('');
  }, [foodKey, food]);

  const entered = parseAmountNumber(amountValue);
  const hasValidAmount = entered != null && !Number.isNaN(entered) && entered > 0;
  const gramsRaw = hasValidAmount
    ? unitToGrams(entered, selectedUnit, defaultAmount)
    : defaultAmount;
  const grams = clampGrams(gramsRaw);

  const labelServingMacros = useMemo(
    () => (normalized ? macrosAtGrams(normalized, defaultAmount) : null),
    [normalized, defaultAmount],
  );

  const nutritionBase = useMemo(() => {
    if (!normalized) return null;
    if (nutritionOverride) return nutritionOverride;
    if (!editNutritionOpen) return normalized;
    const calories = parseAmountNumber(editCal);
    const protein = parseAmountNumber(editProtein);
    const carbs = parseAmountNumber(editCarbs);
    const fat = parseAmountNumber(editFat);
    if (calories == null && protein == null && carbs == null && fat == null) {
      return normalized;
    }
    return nutritionOverrideFromEdits(
      normalized,
      labelServingMacros,
      calories,
      protein,
      carbs,
      fat,
      defaultAmount,
    );
  }, [
    normalized,
    nutritionOverride,
    editNutritionOpen,
    editCal,
    editProtein,
    editCarbs,
    editFat,
    defaultAmount,
    labelServingMacros,
  ]);

  const macros = useMemo(
    () => (nutritionBase ? macrosAtGrams(nutritionBase, grams) : null),
    [nutritionBase, grams],
  );

  if (!normalized || !macros) return null;

  const openEditNutrition = () => {
    const base = nutritionOverride
      ? macrosAtGrams(nutritionOverride, defaultAmount)
      : (labelServingMacros || macros);
    setEditCal(String(base?.calories ?? ''));
    setEditProtein(String(base?.protein ?? ''));
    setEditCarbs(String(base?.carbs ?? ''));
    setEditFat(String(base?.fat ?? ''));
    setEditNutritionOpen(true);
  };

  const closeEditNutrition = () => {
    const calories = parseAmountNumber(editCal);
    const protein = parseAmountNumber(editProtein);
    const carbs = parseAmountNumber(editCarbs);
    const fat = parseAmountNumber(editFat);
    if (calories != null || protein != null || carbs != null || fat != null) {
      setNutritionOverride(
        nutritionOverrideFromEdits(
          normalized,
          labelServingMacros,
          calories,
          protein,
          carbs,
          fat,
          defaultAmount,
        ),
      );
    }
    setEditNutritionOpen(false);
  };

  // 1. Keep grams constant when switching units — rewrite the amount field for the new unit.
  const applyUnit = (unitId) => {
    const prevGrams = hasValidAmount
      ? unitToGrams(entered, selectedUnit, defaultAmount)
      : defaultAmount;
    setSelectedUnit(unitId);
    setPreset('custom');
    setAmountValue(amountStringForUnit(prevGrams, unitId, defaultAmount));
  };

  const applyPreset = (fraction, key) => {
    setPreset(key);
    setSelectedUnit('servings');
    setAmountValue(String(fraction));
  };

  const handleAmountChange = (text) => {
    setPreset('custom');
    // Allow empty while typing; keep digits, one decimal, and simple fractions (1/2).
    const cleaned = String(text).replace(/[^0-9./]/g, '');
    setAmountValue(cleaned);
  };

  // 2. Fail loud if amount is empty; otherwise hand a normalized logged portion up.
  const handleConfirm = () => {
    if (!hasValidAmount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const servingsLogged =
      selectedUnit === 'servings'
        ? Math.max(MIN_SERVINGS_LOGGED, entered)
        : Math.max(MIN_SERVINGS_LOGGED, grams / Math.max(1, defaultAmount));
    const adjusted = buildConfirmedFoodPayload({
      nutritionBase,
      macros,
      grams,
      servingsLogged,
      entered,
      selectedUnit,
      defaultAmount,
      packageServingLabel,
      notes,
      nutritionOverride,
      scannedBarcode,
    });
    onConfirm?.(normalizeFoodForLog(normalizeFoodRecordForStorage(adjusted)));
  };

  const footerBottomPad = reserveShellBottomNav
    ? shellBottomPad
    : Platform.OS === 'ios'
      ? FOOTER_PAD_IOS
      : FOOTER_PAD_ANDROID;
  const screenBg =
    theme?.screenBg && theme.screenBg !== THEME_FALLBACK_BG ? theme.screenBg : tokens.bg;

  const servingSummary = servingSummaryLabel(selectedUnit, hasValidAmount, entered);
  const inputLabel = amountInputLabel(selectedUnit);
  const amountPlaceholder =
    selectedUnit === 'servings' ? '1' : String(defaultAmount);
  const helperExtra = !hasValidAmount ? ' · enter a number greater than 0' : '';
  const editNutritionLabel = editNutritionOpen
    ? 'Done editing nutrition'
    : 'Edit nutrition from package';
  const foodDisplayName = display?.name || normalized.name;
  const foodBrand = display?.brand || normalized.brand;
  const calHeroAmountLine =
    servingSummary && servingSummary !== packageServingLabel
      ? `${packageServingLabel} · ${servingSummary}`
      : packageServingLabel;

  const presetButtons = [
    { label: '1 serving', key: 'full', fraction: 1 },
    { label: '½ serving', key: 'half', fraction: HALF_SERVING },
  ];

  const editFields = [
    { label: 'Calories', value: editCal, set: setEditCal },
    { label: 'Protein (g)', value: editProtein, set: setEditProtein },
    { label: 'Carbs (g)', value: editCarbs, set: setEditCarbs },
    { label: 'Fat (g)', value: editFat, set: setEditFat },
  ];

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: screenBg }]}
      edges={
        reserveShellBottomNav
          ? SHELL_SAFE_AREA_EDGES
          : [...SHELL_SAFE_AREA_EDGES, 'bottom']
      }
    >
      <TopHeader title={title} skipTopSafeInset onBack={onCancel} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={KEYBOARD_OFFSET}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: SCROLL_BOTTOM_PAD }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={[styles.screenTitle, { color: tokens.primary, fontFamily: DISPLAY_SEMI }]}>
            {title}
          </Text>

          <View style={styles.foodHeader}>
            <Text
              style={[styles.foodName, { color: tokens.primary, fontFamily: DISPLAY }]}
              numberOfLines={3}
            >
              {foodDisplayName}
            </Text>
            <View style={styles.foodMetaRow}>
              {foodBrand ? (
                <>
                  <Text style={[styles.foodMeta, { color: tokens.muted }]} numberOfLines={1}>
                    {foodBrand}
                  </Text>
                  <Text style={{ color: tokens.secondary }}> · </Text>
                </>
              ) : null}
              <Text style={[styles.foodMeta, { color: tokens.muted }]} numberOfLines={1}>
                {packageServingLabel}
              </Text>
              <Text style={{ color: tokens.secondary }}> · </Text>
              <ColorText colors={['#FF8C42', '#FF69B4', '#FF1493']} style={styles.foodMetaCal}>
                {labelServingMacros?.calories ?? '—'} cal
              </ColorText>
            </View>
          </View>

          <ConfirmGlassCard isDark={isDark} style={styles.cardGap}>
            <SectionLabel color={tokens.label}>Per serving on label</SectionLabel>
            <Text style={[styles.labelInfo, { color: tokens.primary }]}>
              {packageServingLabel} · {labelServingMacros?.calories ?? '—'} cal ·{' '}
              {labelServingMacros?.protein ?? '—'}g protein · {labelServingMacros?.fat ?? '—'}g fat
            </Text>

            <View style={styles.divider} />

            <SectionLabel color={tokens.label}>Nutrition summary</SectionLabel>
            <View style={styles.calHeroRow}>
              <View style={styles.calHeroLeft}>
                <Text style={[styles.calHeroHint, { color: tokens.secondary }]}>
                  Total for this amount
                </Text>
                <Text
                  style={[
                    styles.calHeroAmount,
                    { color: tokens.primary, fontFamily: DISPLAY_SEMI },
                  ]}
                >
                  {calHeroAmountLine}
                </Text>
              </View>
              <View style={styles.calHeroRight}>
                <ColorText
                  colors={CAL_GRADIENT}
                  style={[styles.calHeroValue, { fontFamily: DISPLAY }]}
                >
                  {macros.calories}
                </ColorText>
                <Text style={[styles.calHeroSuffix, { color: tokens.secondary }]}>KCAL</Text>
              </View>
            </View>

            <View style={styles.macroGrid}>
              <MacroTile
                label="Carbs"
                value={macros.carbs}
                gradientKey={GRADIENT_KEYS[macroGradients.carbs]}
                onCycle={() => cycleMacroGradient('carbs')}
                isDark={isDark}
              />
              <MacroTile
                label="Protein"
                value={macros.protein}
                gradientKey={GRADIENT_KEYS[macroGradients.protein]}
                onCycle={() => cycleMacroGradient('protein')}
                isDark={isDark}
              />
              <MacroTile
                label="Fat"
                value={macros.fat}
                gradientKey={GRADIENT_KEYS[macroGradients.fat]}
                onCycle={() => cycleMacroGradient('fat')}
                isDark={isDark}
              />
            </View>
          </ConfirmGlassCard>

          <ConfirmGlassCard isDark={isDark} style={styles.cardGap}>
            <SectionLabel color={tokens.label}>Serving size</SectionLabel>
            <Text style={[styles.labelInfo, { color: tokens.muted, marginTop: 6 }]}>
              Real serving on label: {packageServingLabel}
              {defaultAmount ? ` (≈${defaultAmount} g)` : ''}
            </Text>

            <View
              style={[
                styles.unitSwitcher,
                { backgroundColor: tokens.chipBg, borderColor: tokens.chipBorder },
              ]}
            >
              {UNIT_OPTIONS.map((unitOption) => {
                const isActive = selectedUnit === unitOption.id;
                return (
                  <Pressable
                    key={unitOption.id}
                    onPress={() => applyUnit(unitOption.id)}
                    style={styles.unitTab}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={UNIT_ACTIVE_GRADIENT}
                        start={GRADIENT_DIAGONAL_START}
                        end={GRADIENT_DIAGONAL_END}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.unitTabText,
                        { color: isActive ? '#fff' : tokens.secondary },
                      ]}
                    >
                      {unitOption.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.presetRow}>
              {presetButtons.map((presetButton) => {
                const isActive = preset === presetButton.key;
                return (
                  <Pressable
                    key={presetButton.key}
                    onPress={() => applyPreset(presetButton.fraction, presetButton.key)}
                    style={({ pressed }) => [
                      styles.presetPill,
                      {
                        backgroundColor: tokens.chipBg,
                        borderColor: isActive ? 'rgba(236,72,153,0.55)' : tokens.chipBorder,
                      },
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={['rgba(249,115,22,0.35)', 'rgba(236,72,153,0.35)']}
                        start={GRADIENT_DIAGONAL_START}
                        end={GRADIENT_DIAGONAL_END}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.presetPillText,
                        { color: isActive ? '#fff' : tokens.muted },
                      ]}
                    >
                      {presetButton.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { color: tokens.primary }]}>{inputLabel}</Text>
            <TextInput
              style={[
                styles.amountInput,
                {
                  color: tokens.primary,
                  backgroundColor: tokens.inputBg,
                  borderColor: tokens.inputBorder,
                },
              ]}
              placeholder={amountPlaceholder}
              placeholderTextColor={tokens.secondary}
              value={amountValue}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              editable
              selectTextOnFocus
              returnKeyType="done"
              blurOnSubmit
            />
            <Text style={[styles.helper, { color: tokens.secondary }]}>
              ≈ {grams} g · macros update as you type
              {helperExtra}
            </Text>

            <Pressable
              onPress={() => (editNutritionOpen ? closeEditNutrition() : openEditNutrition())}
              style={({ pressed }) => [
                styles.editNutritionBtn,
                {
                  backgroundColor: tokens.chipBg,
                  borderColor: tokens.chipBorder,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Pencil size={14} color={tokens.muted} strokeWidth={2.2} />
              <Text style={[styles.editNutritionBtnText, { color: tokens.muted }]}>
                {editNutritionLabel}
              </Text>
            </Pressable>

            {editNutritionOpen ? (
              <View style={styles.editGrid}>
                {editFields.map((field) => (
                  <View key={field.label} style={styles.editField}>
                    <Text style={[styles.editFieldLabel, { color: tokens.secondary }]}>
                      {field.label}
                    </Text>
                    <TextInput
                      style={[
                        styles.editFieldInput,
                        {
                          color: tokens.primary,
                          backgroundColor: tokens.inputBg,
                          borderColor: tokens.inputBorder,
                          fontFamily: DISPLAY_SEMI,
                        },
                      ]}
                      value={field.value}
                      onChangeText={field.set}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={tokens.secondary}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </ConfirmGlassCard>

          <ConfirmGlassCard isDark={isDark} style={[styles.cardGap, { padding: 6 }]}>
            <TextInput
              style={[styles.notesInput, { color: tokens.primary }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={tokens.secondary}
              multiline
              textAlignVertical="top"
            />
          </ConfirmGlassCard>

          <View
            style={[
              styles.formulaStrip,
              { backgroundColor: tokens.chipBg, borderColor: tokens.chipBorder },
            ]}
          >
            <Text style={[styles.formulaText, { color: tokens.muted }]}>
              Logging ≈ {macros.calories} cal · {macros.protein}P · {macros.carbs}C · {macros.fat}F
            </Text>
          </View>
        </ScrollView>

        <View
          style={[styles.footer, { paddingBottom: footerBottomPad, backgroundColor: screenBg }]}
        >
          {showVerification && onWrongItem ? (
            <Pressable
              onPress={onWrongItem}
              style={({ pressed }) => [
                styles.wrongItemButton,
                {
                  backgroundColor: tokens.glassBg,
                  borderColor: tokens.glassBorder,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.wrongItemButtonText, { color: tokens.primary }]}>
                Wrong item
              </Text>
              <ArrowRight size={16} color={tokens.primary} strokeWidth={2.2} />
              <Text style={[styles.wrongItemButtonText, { color: tokens.primary }]}>
                search by name
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={handleConfirm}
            disabled={!hasValidAmount}
            style={({ pressed }) => [
              styles.logButtonWrap,
              pressed && hasValidAmount && { transform: [{ scale: 0.985 }] },
              !hasValidAmount && { opacity: 0.5 },
            ]}
          >
            <LinearGradient
              colors={LOG_GRADIENT}
              start={GRADIENT_DIAGONAL_START}
              end={GRADIENT_DIAGONAL_END}
              style={styles.logButton}
            >
              <Text style={[styles.logButtonText, { fontFamily: DISPLAY_SEMI }]}>
                Log it · {macros.calories} cal
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={onCancel}
            style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}
          >
            <Text style={[styles.cancelButtonText, { color: tokens.secondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  screenTitle: {
    fontSize: 22,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
  verifyBanner: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  verifyBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  verifyBannerBody: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  foodHeader: {
    marginBottom: 18,
  },
  foodName: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  foodMetaRow: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  foodMeta: {
    fontSize: 14,
    fontWeight: '500',
  },
  foodMetaCal: {
    fontSize: 14,
    fontWeight: '700',
  },
  glassCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.28,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  glassInner: {
    padding: 20,
    zIndex: 1,
  },
  cardGap: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  labelInfo: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 21,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 18,
  },
  calHeroRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  calHeroLeft: { flex: 1 },
  calHeroHint: { fontSize: 13 },
  calHeroAmount: {
    marginTop: 2,
    fontSize: 16,
  },
  calHeroRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  calHeroValue: {
    fontSize: 52,
    letterSpacing: -1.5,
    lineHeight: 56,
  },
  calHeroSuffix: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
  },
  macroGrid: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
  },
  macroTile: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    padding: 1.5,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
    }),
  },
  macroTileBorder: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.9,
  },
  macroTileContent: {
    borderRadius: 14.5,
    backgroundColor: 'rgba(11,14,20,0.88)',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  macroTileLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  macroTileValueRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  macroTileValue: {
    fontSize: 24,
    letterSpacing: -0.5,
  },
  macroTileUnit: {
    fontSize: 13,
    fontWeight: '500',
  },
  unitSwitcher: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitTab: {
    width: '23.5%',
    minWidth: 72,
    flexGrow: 1,
    borderRadius: 12,
    overflow: 'hidden',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitTabText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  presetRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  presetPill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 14,
    alignItems: 'center',
  },
  presetPillText: {
    fontSize: 15,
    fontWeight: '600',
  },
  inputLabel: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: '700',
  },
  amountInput: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    fontWeight: '600',
    minHeight: 52,
  },
  helper: {
    marginTop: 8,
    fontSize: 13,
  },
  editNutritionBtn: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  editNutritionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editGrid: {
    marginTop: 12,
    gap: 10,
  },
  editField: { gap: 4 },
  editFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  editFieldInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  formulaStrip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  formulaText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  wrongItemButton: {
    marginBottom: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  wrongItemButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logButtonWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 6,
  },
  logButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
