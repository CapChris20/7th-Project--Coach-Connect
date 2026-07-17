/**
 * Food Confirm Sheet — Weber-style premium Confirm & log UI (barcode + search).
 */
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
import { finalizeBarcodeFood, resolveServingGrams, parseServingQtyInput } from '../food-details/calculateServingSize';
import { macrosAtGrams } from '../barcode/renderScannedBarcode';
import { normalizeFoodForLog } from '../food-search/normalizeFoodQuery';
import { normalizeFoodRecordForStorage } from '../food-search/makeReadableFoodTitle';
import GradientText from '../components/premiumFoodCard/GradientText';
import { SHELL_SAFE_AREA_EDGES, useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import { useTheme } from '../../shared-ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';

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

function unitToGrams(value, unit, servingGrams) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return servingGrams || 100;
  const sg = servingGrams || 100;
  switch (unit) {
    case 'oz':
      return n * 28.3495;
    case 'cups':
      return n * 240;
    case 'ml':
      return n;
    case 'servings':
      return n * sg;
    case 'tbsp':
      return n * 15;
    case 'tsp':
      return n * 5;
    case 'g':
    default:
      return n;
  }
}

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

function SectionLabel({ children, color }) {
  return (
    <Text style={[styles.sectionLabel, { color }]}>{children}</Text>
  );
}

function GlassCard({ isDark, children, style }) {
  const t = themeTokens(isDark);
  return (
    <View
      style={[
        styles.glassCard,
        {
          backgroundColor: t.glassBg,
          borderColor: t.glassBorder,
        },
        style,
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={isDark ? 28 : 40}
          tint={isDark ? 'dark' : 'light'}
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

function MacroTile({ label, value, gradientKey, onCycle, isDark }) {
  const g = MACRO_GRADIENTS[gradientKey] || MACRO_GRADIENTS.carbs;
  const t = themeTokens(isDark);
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onCycle?.();
      }}
      style={({ pressed }) => [
        styles.macroTile,
        {
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)',
          shadowColor: g.glow,
        },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
      ]}
    >
      <LinearGradient
        colors={g.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.macroTileBorder}
      />
      <View
        style={[
          styles.macroTileContent,
          { backgroundColor: isDark ? 'rgba(11,14,20,0.92)' : 'rgba(248,250,252,0.94)' },
        ]}
      >
        <Text style={[styles.macroTileLabel, { color: g.label }]}>{label}</Text>
        <View style={styles.macroTileValueRow}>
          <Text style={[styles.macroTileValue, { color: t.primary, fontFamily: DISPLAY }]}>
            {Math.round(Number(value) || 0)}
          </Text>
          <Text style={[styles.macroTileUnit, { color: t.secondary }]}>g</Text>
        </View>
      </View>
    </Pressable>
  );
}


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
  const t = themeTokens(isDark);
  const shellBottomPad = useShellBottomNavInset(16);

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
  const [grads, setGrads] = useState({ c: 0, p: 1, f: 2 });

  const cycleGrad = (key) => {
    setGrads((g) => ({ ...g, [key]: (g[key] + 1) % GRADIENT_KEYS.length }));
  };

  const normalized = useMemo(
    () => (food ? normalizeFoodForLog(finalizeBarcodeFood(food)) : null),
    [food],
  );
  const display = useMemo(() => {
    if (!normalized) return null;
    return normalizeFoodRecordForStorage(normalized);
  }, [normalized]);
  const defaultAmount = normalized ? resolveServingGrams(normalized) : 100;
  const packageServingLabel =
    String(
      normalized?.serving_label
      || normalized?.servingLabel
      || normalized?.portion_text
      || normalized?.serving_description
      || '',
    ).trim()
    || `${defaultAmount} g per serving`;

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

  const parseNum = (v) => {
    const parsed = parseServingQtyInput(v);
    if (parsed != null) return parsed;
    return v === '' || v == null ? null : Number(String(v).replace(',', '.'));
  };
  const entered = parseNum(amountValue);
  const hasValidAmount = entered != null && !Number.isNaN(entered) && entered > 0;
  const gramsRaw = hasValidAmount
    ? unitToGrams(entered, selectedUnit, defaultAmount)
    : defaultAmount;
  const grams = Math.min(10000, Math.max(1, Math.round(gramsRaw)));

  const labelServingMacros = useMemo(
    () => (normalized ? macrosAtGrams(normalized, defaultAmount) : null),
    [normalized, defaultAmount],
  );

  const nutritionBase = useMemo(() => {
    if (!normalized) return null;
    if (nutritionOverride) return nutritionOverride;
    if (!editNutritionOpen) return normalized;
    const cal = parseNum(editCal);
    const protein = parseNum(editProtein);
    const carbs = parseNum(editCarbs);
    const fat = parseNum(editFat);
    if (cal == null && protein == null && carbs == null && fat == null) return normalized;
    return {
      ...normalized,
      calories: cal ?? labelServingMacros?.calories ?? normalized.calories,
      protein: protein ?? labelServingMacros?.protein ?? normalized.protein,
      carbs: carbs ?? labelServingMacros?.carbs ?? normalized.carbs,
      fat: fat ?? labelServingMacros?.fat ?? normalized.fat,
      dataBasis: 'label_serving',
      servingGrams: defaultAmount,
      userEditedNutrition: true,
    };
  }, [normalized, nutritionOverride, editNutritionOpen, editCal, editProtein, editCarbs, editFat, defaultAmount, labelServingMacros]);

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
    const cal = parseNum(editCal);
    const protein = parseNum(editProtein);
    const carbs = parseNum(editCarbs);
    const fat = parseNum(editFat);
    if (cal != null || protein != null || carbs != null || fat != null) {
      setNutritionOverride({
        ...normalized,
        calories: cal ?? labelServingMacros?.calories ?? normalized.calories,
        protein: protein ?? labelServingMacros?.protein ?? normalized.protein,
        carbs: carbs ?? labelServingMacros?.carbs ?? normalized.carbs,
        fat: fat ?? labelServingMacros?.fat ?? normalized.fat,
        dataBasis: 'label_serving',
        servingGrams: defaultAmount,
        userEditedNutrition: true,
      });
    }
    setEditNutritionOpen(false);
  };

  const applyUnit = (unitId) => {
    const prevGrams = hasValidAmount
      ? unitToGrams(entered, selectedUnit, defaultAmount)
      : defaultAmount;
    setSelectedUnit(unitId);
    setPreset('custom');
    if (unitId === 'servings') {
      setAmountValue(String(Math.round((prevGrams / Math.max(1, defaultAmount)) * 100) / 100 || 1));
    } else if (unitId === 'g' || unitId === 'ml') {
      setAmountValue(String(Math.round(prevGrams) || defaultAmount));
    } else if (unitId === 'oz') {
      setAmountValue(String(Math.round((prevGrams / 28.3495) * 100) / 100));
    } else if (unitId === 'cups') {
      setAmountValue(String(Math.round((prevGrams / 240) * 100) / 100));
    } else if (unitId === 'tbsp') {
      setAmountValue(String(Math.round((prevGrams / 15) * 100) / 100));
    } else if (unitId === 'tsp') {
      setAmountValue(String(Math.round((prevGrams / 5) * 100) / 100));
    }
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

  const handleConfirm = () => {
    if (!hasValidAmount) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const servingsLogged =
      selectedUnit === 'servings'
        ? Math.max(0.01, entered)
        : Math.max(0.01, grams / Math.max(1, defaultAmount));
    const adjusted = {
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
    onConfirm?.(normalizeFoodForLog(normalizeFoodRecordForStorage(adjusted)));
  };

  const footerBottomPad = reserveShellBottomNav ? shellBottomPad : (Platform.OS === 'ios' ? 12 : 16);
  const screenBg = theme?.screenBg && theme.screenBg !== '#1A1B20' ? theme.screenBg : t.bg;

  const servingSummary =
    selectedUnit === 'servings' && hasValidAmount && entered === 1
      ? '1 serving'
      : selectedUnit === 'servings' && hasValidAmount && entered === 0.5
        ? '½ serving'
        : selectedUnit === 'servings' && hasValidAmount
          ? `${entered} servings`
          : hasValidAmount
            ? `${entered} ${selectedUnit}`
            : '1 serving';

  const inputLabel =
    selectedUnit === 'servings'
      ? 'Number of servings'
      : UNIT_OPTIONS.find((u) => u.id === selectedUnit)?.label || selectedUnit;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: screenBg }]}
      edges={reserveShellBottomNav ? SHELL_SAFE_AREA_EDGES : [...SHELL_SAFE_AREA_EDGES, 'bottom']}
    >
      <CoachConnectHeader title={title} skipTopSafeInset onBack={onCancel} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <Text style={[styles.screenTitle, { color: t.primary, fontFamily: DISPLAY_SEMI }]}>
            {title}
          </Text>

          {(showVerification || normalized?.nutrition_unverified || food?.nutrition_unverified) ? (
            <View
              style={[
                styles.verifyBanner,
                {
                  backgroundColor: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                  borderColor: isDark ? 'rgba(251, 191, 36, 0.35)' : 'rgba(245, 158, 11, 0.4)',
                },
              ]}
            >
              <Text style={[styles.verifyBannerTitle, { color: t.primary }]}>
                Double-check this item
              </Text>
              <Text style={[styles.verifyBannerBody, { color: t.muted }]}>
                {normalized?.nutrition_unverified || food?.nutrition_unverified
                  ? 'Macros may be crowdsourced or unverified. Confirm the serving matches what you ate.'
                  : 'Wrong item? Search by name below before logging.'}
              </Text>
            </View>
          ) : null}

          {/* Food header */}
          <View style={styles.foodHeader}>
            <Text style={[styles.foodName, { color: t.primary, fontFamily: DISPLAY }]} numberOfLines={3}>
              {display?.name || normalized.name}
            </Text>
            <View style={styles.foodMetaRow}>
              {(display?.brand || normalized.brand) ? (
                <>
                  <Text style={[styles.foodMeta, { color: t.muted }]} numberOfLines={1}>
                    {display?.brand || normalized.brand}
                  </Text>
                  <Text style={{ color: t.secondary }}> · </Text>
                </>
              ) : null}
              <GradientText colors={['#FF8C42', '#FF69B4', '#FF1493']} style={styles.foodMetaCal}>
                {labelServingMacros?.calories ?? '—'} cal
              </GradientText>
              <Text style={{ color: t.secondary }}> · </Text>
              <Text style={[styles.foodMeta, { color: t.muted }]}>{defaultAmount} g</Text>
            </View>
          </View>

          {/* Nutrition summary */}
          <GlassCard isDark={isDark} style={styles.cardGap}>
            <SectionLabel color={t.label}>Per serving on label</SectionLabel>
            <Text style={[styles.labelInfo, { color: t.primary }]}>
              {packageServingLabel} · {labelServingMacros?.calories ?? '—'} cal ·{' '}
              {labelServingMacros?.protein ?? '—'}g protein · {labelServingMacros?.fat ?? '—'}g fat
            </Text>

            <View style={styles.divider} />

            <SectionLabel color={t.label}>Nutrition summary</SectionLabel>
            <View style={styles.calHeroRow}>
              <View style={styles.calHeroLeft}>
                <Text style={[styles.calHeroHint, { color: t.secondary }]}>Total for this amount</Text>
                <Text style={[styles.calHeroAmount, { color: t.primary, fontFamily: DISPLAY_SEMI }]}>
                  {servingSummary} · {grams} g
                </Text>
              </View>
              <View style={styles.calHeroRight}>
                <GradientText colors={CAL_GRADIENT} style={[styles.calHeroValue, { fontFamily: DISPLAY }]}>
                  {macros.calories}
                </GradientText>
                <Text style={[styles.calHeroSuffix, { color: t.secondary }]}>KCAL</Text>
              </View>
            </View>

            <View style={styles.macroGrid}>
              <MacroTile
                label="Carbs"
                value={macros.carbs}
                gradientKey={GRADIENT_KEYS[grads.c]}
                onCycle={() => cycleGrad('c')}
                isDark={isDark}
              />
              <MacroTile
                label="Protein"
                value={macros.protein}
                gradientKey={GRADIENT_KEYS[grads.p]}
                onCycle={() => cycleGrad('p')}
                isDark={isDark}
              />
              <MacroTile
                label="Fat"
                value={macros.fat}
                gradientKey={GRADIENT_KEYS[grads.f]}
                onCycle={() => cycleGrad('f')}
                isDark={isDark}
              />
            </View>
          </GlassCard>

          {/* Serving size */}
          <GlassCard isDark={isDark} style={styles.cardGap}>
            <SectionLabel color={t.label}>Serving size</SectionLabel>
            <Text style={[styles.labelInfo, { color: t.muted, marginTop: 6 }]}>
              Label serving: {packageServingLabel} · {defaultAmount} g
            </Text>

            {/* Unit segmented switcher */}
            <View style={[styles.unitSwitcher, { backgroundColor: t.chipBg, borderColor: t.chipBorder }]}>
              {UNIT_OPTIONS.map((u) => {
                const active = selectedUnit === u.id;
                return (
                  <Pressable
                    key={u.id}
                    onPress={() => applyUnit(u.id)}
                    style={styles.unitTab}
                  >
                    {active ? (
                      <LinearGradient
                        colors={UNIT_ACTIVE_GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text
                      style={[
                        styles.unitTabText,
                        { color: active ? '#fff' : t.secondary },
                      ]}
                    >
                      {u.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.presetRow}>
              {[
                { label: '1 serving', key: 'full', fraction: 1 },
                { label: '½ serving', key: 'half', fraction: 0.5 },
              ].map((p) => {
                const active = preset === p.key;
                return (
                  <Pressable
                    key={p.key}
                    onPress={() => applyPreset(p.fraction, p.key)}
                    style={({ pressed }) => [
                      styles.presetPill,
                      {
                        backgroundColor: t.chipBg,
                        borderColor: active ? 'rgba(236,72,153,0.55)' : t.chipBorder,
                      },
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    {active ? (
                      <LinearGradient
                        colors={['rgba(249,115,22,0.35)', 'rgba(236,72,153,0.35)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <Text style={[styles.presetPillText, { color: active ? '#fff' : t.muted }]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.inputLabel, { color: t.primary }]}>{inputLabel}</Text>
            <TextInput
              style={[
                styles.amountInput,
                {
                  color: t.primary,
                  backgroundColor: t.inputBg,
                  borderColor: t.inputBorder,
                },
              ]}
              placeholder={selectedUnit === 'servings' ? '1' : String(defaultAmount)}
              placeholderTextColor={t.secondary}
              value={amountValue}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              editable
              selectTextOnFocus
              returnKeyType="done"
              blurOnSubmit
            />
            <Text style={[styles.helper, { color: t.secondary }]}>
              ≈ {grams} g · macros update as you type
              {!hasValidAmount ? ' · enter a number greater than 0' : ''}
            </Text>

            <Pressable
              onPress={() => (editNutritionOpen ? closeEditNutrition() : openEditNutrition())}
              style={({ pressed }) => [
                styles.editNutritionBtn,
                {
                  backgroundColor: t.chipBg,
                  borderColor: t.chipBorder,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Pencil size={14} color={t.muted} strokeWidth={2.2} />
              <Text style={[styles.editNutritionBtnText, { color: t.muted }]}>
                {editNutritionOpen ? 'Done editing nutrition' : 'Edit nutrition from package'}
              </Text>
            </Pressable>

            {editNutritionOpen ? (
              <View style={styles.editGrid}>
                {[
                  { label: 'Calories', value: editCal, set: setEditCal },
                  { label: 'Protein (g)', value: editProtein, set: setEditProtein },
                  { label: 'Carbs (g)', value: editCarbs, set: setEditCarbs },
                  { label: 'Fat (g)', value: editFat, set: setEditFat },
                ].map((row) => (
                  <View key={row.label} style={styles.editField}>
                    <Text style={[styles.editFieldLabel, { color: t.secondary }]}>{row.label}</Text>
                    <TextInput
                      style={[
                        styles.editFieldInput,
                        {
                          color: t.primary,
                          backgroundColor: t.inputBg,
                          borderColor: t.inputBorder,
                          fontFamily: DISPLAY_SEMI,
                        },
                      ]}
                      value={row.value}
                      onChangeText={row.set}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={t.secondary}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </GlassCard>

          {/* Notes */}
          <GlassCard isDark={isDark} style={[styles.cardGap, { padding: 6 }]}>
            <TextInput
              style={[styles.notesInput, { color: t.primary }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Notes (optional)"
              placeholderTextColor={t.secondary}
              multiline
              textAlignVertical="top"
            />
          </GlassCard>

          {/* Formula strip */}
          <View style={[styles.formulaStrip, { backgroundColor: t.chipBg, borderColor: t.chipBorder }]}>
            <Text style={[styles.formulaText, { color: t.muted }]}>
              Logging ≈ {macros.calories} cal · {macros.protein}P · {macros.carbs}C · {macros.fat}F
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: footerBottomPad, backgroundColor: screenBg }]}>
          {showVerification && onWrongItem ? (
            <Pressable
              onPress={onWrongItem}
              style={({ pressed }) => [
                styles.wrongItemButton,
                {
                  backgroundColor: t.glassBg,
                  borderColor: t.glassBorder,
                },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={[styles.wrongItemButtonText, { color: t.primary }]}>Wrong item</Text>
              <ArrowRight size={16} color={t.primary} strokeWidth={2.2} />
              <Text style={[styles.wrongItemButtonText, { color: t.primary }]}>search by name</Text>
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
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logButton}
            >
              <Text style={[styles.logButtonText, { fontFamily: DISPLAY_SEMI }]}>
                Log it · {macros.calories} cal
              </Text>
            </LinearGradient>
          </Pressable>

          <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}>
            <Text style={[styles.cancelButtonText, { color: t.secondary }]}>Cancel</Text>
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
