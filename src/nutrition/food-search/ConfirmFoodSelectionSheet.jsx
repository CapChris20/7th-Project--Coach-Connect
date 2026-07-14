/**
 * Food Confirm Sheet — premium confirm & log flow (matches premiumFoodCard tokens).
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
import { ChevronLeft, Check, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { finalizeBarcodeFood, resolveServingGrams } from '../food-details/calculateServingSize';
import { macrosAtGrams, barcodeSourceLabel, barcodeConfidenceLabel } from '../barcode/renderScannedBarcode';
import { normalizeFoodForLog } from '../food-search/normalizeFoodQuery';
import { normalizeFoodRecordForStorage } from '../food-search/makeReadableFoodTitle';
import GradientText from '../components/premiumFoodCard/GradientText';
import { colors, gradients, radii, fonts, pillBackgroundGradient } from '../components/premiumFoodCard/theme';

function MacroStatPill({ label, value, suffix = 'g', gradientStops }) {
  const bg = pillBackgroundGradient(gradientStops);
  const display = Math.round(Number(value) || 0);

  return (
    <View style={styles.macroPillOuter}>
      <LinearGradient
        colors={gradientStops}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.macroPillTopAccent}
      />
      <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.macroPillBg}>
        <GradientText colors={gradientStops} style={styles.macroPillLabel} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
          {label}
        </GradientText>
        <View style={styles.macroPillValueRow}>
          <Text style={styles.macroPillValue}>{display}</Text>
          {suffix ? <Text style={styles.macroPillUnit}>{suffix}</Text> : null}
        </View>
      </LinearGradient>
    </View>
  );
}

function PresetChip({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.presetChip,
        selected && styles.presetChipSelected,
        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
      ]}
    >
      {selected ? (
        <LinearGradient
          colors={pillBackgroundGradient(gradients.protein)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <Text style={[styles.presetChipText, selected && styles.presetChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function SurfaceCard({ children, style }) {
  return (
    <View style={[styles.surfaceCard, style]}>
      <View style={styles.innerHighlight} pointerEvents="none" />
      {children}
    </View>
  );
}

export default function FoodConfirmSheet({
  food,
  onConfirm,
  onCancel,
  title = 'Confirm & log',
  theme,
}) {
  const [amountValue, setAmountValue] = useState('');
  const [preset, setPreset] = useState('full');
  const [selectedUnit, setSelectedUnit] = useState('g');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);

  const UNIT_OPTIONS = [
    { id: 'g', label: 'Grams (g)' },
    { id: 'oz', label: 'Ounces (oz)' },
    { id: 'cups', label: 'Cups' },
    { id: 'ml', label: 'Milliliters (ml)' },
    { id: 'servings', label: 'Servings' },
    { id: 'tbsp', label: 'Tablespoons (tbsp)' },
    { id: 'tsp', label: 'Teaspoons (tsp)' },
  ];

  const unitToGrams = (value, unit, servingGrams) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return servingGrams || 100;
    const sg = servingGrams || 100;
    switch (unit) {
      case 'oz':
        return n * 28.3495;
      case 'cups':
        return n * 240; // approx liquid/volume food
      case 'ml':
        return n * 1;
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
  };

  const normalized = food ? normalizeFoodForLog(finalizeBarcodeFood(food)) : null;
  const display = useMemo(() => {
    if (!normalized) return null;
    return normalizeFoodRecordForStorage(normalized);
  }, [normalized]);
  const defaultAmount = normalized ? resolveServingGrams(normalized) : 100;

  useEffect(() => {
    if (normalized) {
      setAmountValue(String(defaultAmount));
      setPreset('full');
      setSelectedUnit('g');
    }
  }, [food?.id, food?.name, defaultAmount, normalized]);

  const parseNum = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  const entered = parseNum(amountValue);
  const gramsRaw =
    entered != null && !Number.isNaN(entered) && entered > 0
      ? unitToGrams(entered, selectedUnit, defaultAmount)
      : defaultAmount;
  const grams = Math.min(10000, Math.max(1, Math.round(gramsRaw)));
  const unitLabel = selectedUnit;

  const macros = useMemo(
    () => (normalized ? macrosAtGrams(normalized, grams) : null),
    [normalized, grams],
  );

  if (!normalized || !macros) return null;

  const sourceLabel = barcodeSourceLabel(normalized.source);
  const confidenceLabel = barcodeConfidenceLabel(
    normalized.barcodeConfidence,
    normalized.needsVerification,
  );
  const warnVerify =
    normalized.needsVerification ||
    normalized.barcodeConfidence === 'low' ||
    normalized.nutrition_unverified;
  const verified = normalized.source === 'usda' || normalized.verified === true;

  const applyPreset = (fraction, key) => {
    setPreset(key);
    setAmountValue(String(Math.max(1, Math.round(defaultAmount * fraction))));
  };

  const handleAmountChange = (text) => {
    setPreset('custom');
    setAmountValue(text);
  };

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const adjusted = finalizeBarcodeFood({
      ...normalized,
      servingGrams: grams,
      servingAmount: grams,
      loggedAmount: entered != null && !Number.isNaN(entered) ? entered : grams,
      loggedUnit: selectedUnit,
      originalUnit: selectedUnit,
      originalAmount: entered != null && !Number.isNaN(entered) ? entered : grams,
    });
    onConfirm?.(normalizeFoodForLog(normalizeFoodRecordForStorage(adjusted)));
  };

  const bg = theme?.screenBg && theme.screenBg !== colors.background ? theme.screenBg : colors.background;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
        >
          <ChevronLeft size={20} color={colors.foreground} strokeWidth={2.5} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.heroBlock}>
            <View style={styles.titleRow}>
              <Text style={styles.productName} numberOfLines={3}>
                {display?.name || normalized.name}
              </Text>
              {verified ? <Check size={16} color={colors.subtle} strokeWidth={2.5} /> : null}
            </View>
            {(display?.brand || normalized.brand) ? (
              <Text style={styles.brandText} numberOfLines={1}>
                {display?.brand || normalized.brand}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              <View style={styles.sourceChip}>
                <LinearGradient
                  colors={gradients.protein}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.sourceDot}
                />
                <Text style={styles.sourceChipText}>{sourceLabel}</Text>
              </View>
              <View style={[styles.confidenceChip, warnVerify && styles.confidenceChipWarn]}>
                {warnVerify ? (
                  <AlertCircle size={12} color="#FFA552" strokeWidth={2} style={{ marginRight: 4 }} />
                ) : null}
                <Text style={[styles.confidenceText, warnVerify && styles.confidenceTextWarn]}>
                  {confidenceLabel}
                </Text>
              </View>
            </View>
          </View>

          <SurfaceCard style={styles.summaryCard}>
            <Text style={styles.sectionEyebrow}>NUTRITION SUMMARY</Text>
            <View style={styles.calHeroRow}>
              <View style={styles.calHeroLeft}>
                <Text style={styles.calHeroHint}>Total for this serving</Text>
                <Text style={styles.calHeroAmount}>
                  {grams} {unitLabel}
                </Text>
              </View>
              <View style={styles.calHeroRight}>
                <GradientText colors={gradients.calories} style={styles.calHeroValue}>
                  {macros.calories}
                </GradientText>
                <Text style={styles.calHeroSuffix}> KCAL</Text>
              </View>
            </View>
            <View style={styles.pillsRow}>
              <MacroStatPill label="CARBS" value={macros.carbs} gradientStops={gradients.carbs} />
              <MacroStatPill label="PROTEIN" value={macros.protein} gradientStops={gradients.protein} />
              <MacroStatPill label="FAT" value={macros.fat} gradientStops={gradients.fat} />
            </View>
          </SurfaceCard>

          <SurfaceCard style={styles.servingCard}>
            <Text style={styles.sectionEyebrow}>SERVING SIZE</Text>
            <Text style={styles.packageHint}>
              Package size: {defaultAmount} {unitLabel}
            </Text>

            <View style={styles.presetRow}>
              <PresetChip
                label="Full package"
                selected={preset === 'full'}
                onPress={() => applyPreset(1, 'full')}
              />
              <PresetChip
                label="Half"
                selected={preset === 'half'}
                onPress={() => applyPreset(0.5, 'half')}
              />
            </View>

            <Text style={styles.amountLabel}>Amount you had</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <TextInput
                style={[styles.amountInput, { flex: 1 }]}
                placeholder={String(defaultAmount)}
                placeholderTextColor={colors.subtle}
                value={amountValue}
                onChangeText={handleAmountChange}
                keyboardType="decimal-pad"
                selectionColor={gradients.carbs[1]}
              />
              <Pressable
                onPress={() => {
                  if (Platform.OS === 'ios') {
                    const { ActionSheetIOS } = require('react-native');
                    ActionSheetIOS.showActionSheetWithOptions(
                      {
                        options: [...UNIT_OPTIONS.map((u) => u.label), 'Cancel'],
                        cancelButtonIndex: UNIT_OPTIONS.length,
                      },
                      (idx) => {
                        if (idx == null || idx >= UNIT_OPTIONS.length) return;
                        setSelectedUnit(UNIT_OPTIONS[idx].id);
                        setPreset('custom');
                      },
                    );
                  } else {
                    setUnitPickerOpen((v) => !v);
                  }
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  minWidth: 88,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.foreground, fontWeight: '700' }}>{selectedUnit}</Text>
              </Pressable>
            </View>
            {unitPickerOpen && Platform.OS !== 'ios' ? (
              <View style={{ marginTop: 8, gap: 6 }}>
                {UNIT_OPTIONS.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => {
                      setSelectedUnit(u.id);
                      setUnitPickerOpen(false);
                      setPreset('custom');
                    }}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: selectedUnit === u.id ? 'rgba(190,24,93,0.15)' : 'transparent',
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: selectedUnit === u.id ? '700' : '500' }}>
                      {u.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <Text style={[styles.packageHint, { marginTop: 8 }]}>
              ≈ {grams} g stored · showing macros for this amount
            </Text>
          </SurfaceCard>

          <View style={styles.previewRow}>
            <Text style={styles.previewText}>
              Logging ≈ {macros.calories} cal · {macros.protein}P · {macros.carbs}C · {macros.fat}F
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={handleConfirm}
            style={({ pressed }) => [styles.logButtonWrap, pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] }]}
          >
            <LinearGradient
              colors={gradients.carbs}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.logButton}
            >
              <Text style={styles.logButtonText}>Log it</Text>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={onCancel} style={({ pressed }) => [styles.cancelButton, pressed && { opacity: 0.7 }]}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minWidth: 72,
    paddingVertical: 4,
  },
  backText: {
    fontSize: 16,
    fontFamily: fonts.semiBold,
    color: colors.foreground,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: fonts.bold,
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 72 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  heroBlock: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    flex: 1,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.foreground,
    letterSpacing: -0.3,
    lineHeight: 28,
  },
  brandText: {
    marginTop: 6,
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  sourceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceChipText: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  confidenceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confidenceChipWarn: {
    borderColor: 'rgba(255,165,82,0.35)',
    backgroundColor: 'rgba(255,165,82,0.08)',
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: fonts.medium,
    color: colors.mutedForeground,
  },
  confidenceTextWarn: {
    color: '#FFA552',
  },
  surfaceCard: {
    borderRadius: radii.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
      android: { elevation: 4 },
    }),
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontFamily: fonts.semiBold,
    color: colors.subtle,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  summaryCard: {},
  calHeroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calHeroLeft: {
    flex: 1,
    paddingRight: 12,
  },
  calHeroHint: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
  },
  calHeroAmount: {
    marginTop: 4,
    fontSize: 15,
    fontFamily: fonts.semiBold,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  calHeroRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  calHeroValue: {
    fontSize: 32,
    fontFamily: fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  calHeroSuffix: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.subtle,
    letterSpacing: 1,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroPillOuter: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
  },
  macroPillTopAccent: {
    height: 1,
    width: '100%',
  },
  macroPillBg: {
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  macroPillLabel: {
    fontSize: 9,
    fontFamily: fonts.bold,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  macroPillValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
  },
  macroPillValue: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  macroPillUnit: {
    fontSize: 11,
    fontFamily: fonts.semiBold,
    color: colors.mutedForeground,
    marginLeft: 1,
  },
  servingCard: {},
  packageHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: colors.mutedForeground,
    marginBottom: 12,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  presetChip: {
    flex: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 12,
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
  },
  presetChipSelected: {
    borderColor: colors.borderStrong,
  },
  presetChipText: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.mutedForeground,
  },
  presetChipTextSelected: {
    color: colors.foreground,
  },
  amountLabel: {
    fontSize: 13,
    fontFamily: fonts.semiBold,
    color: colors.foreground,
    marginBottom: 8,
  },
  amountInput: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    fontFamily: fonts.bold,
    color: colors.foreground,
    fontVariant: ['tabular-nums'],
  },
  previewRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.mutedForeground,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 8 : 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  logButtonWrap: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: 10,
  },
  logButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: 16,
    fontFamily: fonts.bold,
    color: colors.foreground,
    letterSpacing: 0.2,
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontFamily: fonts.semiBold,
    color: colors.subtle,
  },
});
