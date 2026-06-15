/**
 * Food Confirm Sheet
 *
 * Purpose: UI screen or component: Food Confirm Sheet. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: FoodConfirmSheet
 *
 * @file-header
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { finalizeBarcodeFood, resolveServingGrams } from '../food-details/calculateServingSize';
import { macrosAtGrams, barcodeSourceLabel, barcodeConfidenceLabel } from '../barcode/renderScannedBarcode';
import { normalizeFoodForLog } from '../food-search/normalizeFoodQuery';

const ACCENT = {
  hotPink: '#FF6B9D',
  orange: '#F97316',
  green: '#22C55E',
};

export default function FoodConfirmSheet({
  food,
  onConfirm,
  onCancel,
  title = 'Confirm & log',
  theme,
}) {
  const t = theme;
  const [amountValue, setAmountValue] = useState('');

  const normalized = food ? normalizeFoodForLog(finalizeBarcodeFood(food)) : null;
  const defaultAmount = normalized ? resolveServingGrams(normalized) : 100;
  const unit = (normalized?.servingUnit || 'grams').toLowerCase();
  const unitLabel = unit === 'ml' ? 'ml' : 'g';

  useEffect(() => {
    if (normalized) setAmountValue(String(defaultAmount));
  }, [food?.id, food?.name, defaultAmount, normalized]);

  if (!normalized || !t) return null;

  const parseNum = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
  const entered = parseNum(amountValue);
  const grams =
    entered != null && !Number.isNaN(entered) && entered > 0
      ? Math.min(10000, Math.max(1, Math.round(entered)))
      : defaultAmount;
  const macros = macrosAtGrams(normalized, grams);
  const sourceLabel = barcodeSourceLabel(normalized.source);
  const confidenceLabel = barcodeConfidenceLabel(
    normalized.barcodeConfidence,
    normalized.needsVerification,
  );
  const warnVerify = normalized.needsVerification || normalized.barcodeConfidence === 'low'
    || normalized.nutrition_unverified;

  const applyPreset = (fraction) => {
    setAmountValue(String(Math.max(1, Math.round(defaultAmount * fraction))));
  };

  const handleConfirm = () => {
    const adjusted = finalizeBarcodeFood({
      ...normalized,
      servingGrams: grams,
      servingAmount: grams,
    });
    onConfirm?.(normalizeFoodForLog(adjusted));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.screenBg }]}>
      <View style={[styles.header, { backgroundColor: t.cardBg, borderBottomColor: t.cardBorder }]}>
        <TouchableOpacity onPress={onCancel} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: t.text }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.productName, { color: t.text }]} numberOfLines={2}>{normalized.name}</Text>
        {normalized.brand ? (
          <Text style={[styles.brandText, { color: t.textMuted }]}>{normalized.brand}</Text>
        ) : null}

        <View style={styles.sourceBadgeRow}>
          <View style={[styles.sourceBadge, normalized.source === 'usda' && styles.sourceBadgeUsda]}>
            <Text style={[styles.sourceBadgeText, { color: t.text }]}>{sourceLabel}</Text>
          </View>
          <Text style={[styles.confidenceText, { color: t.textMuted }, warnVerify && { color: t.orange }]}>
            {confidenceLabel}
          </Text>
        </View>

        <View style={[styles.macroCard, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: t.text }]}>{macros.calories}</Text>
            <Text style={[styles.macroLabel, { color: t.textMuted }]}>cal</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: t.text }]}>{macros.protein}g</Text>
            <Text style={[styles.macroLabel, { color: t.textMuted }]}>protein</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: t.text }]}>{macros.carbs}g</Text>
            <Text style={[styles.macroLabel, { color: t.textMuted }]}>carbs</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={[styles.macroValue, { color: t.text }]}>{macros.fat}g</Text>
            <Text style={[styles.macroLabel, { color: t.textMuted }]}>fat</Text>
          </View>
        </View>

        <Text style={[styles.defaultText, { color: t.textMuted }]}>
          Package size: {defaultAmount} {unitLabel}
        </Text>

        <View style={styles.presetRow}>
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}
            onPress={() => applyPreset(1)}
          >
            <Text style={[styles.presetChipText, { color: t.text }]}>Full package</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.presetChip, { backgroundColor: t.inputBg, borderColor: t.cardBorder }]}
            onPress={() => applyPreset(0.5)}
          >
            <Text style={[styles.presetChipText, { color: t.text }]}>Half</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.amountLabel, { color: t.text }]}>Amount you had ({unitLabel})</Text>
        <TextInput
          style={[styles.amountInput, { backgroundColor: t.inputBg, borderColor: t.cardBorder, color: t.text }]}
          placeholder={String(defaultAmount)}
          placeholderTextColor="#9CA3AF"
          value={amountValue}
          onChangeText={setAmountValue}
          keyboardType="decimal-pad"
        />
        <Text style={[styles.estimated, { color: t.textMuted }]}>
          Logging ≈ {macros.calories} cal · {macros.protein}P · {macros.carbs}C · {macros.fat}F
        </Text>

        <TouchableOpacity style={styles.logButton} onPress={handleConfirm} activeOpacity={0.9}>
          <LinearGradient
            colors={[ACCENT.hotPink, ACCENT.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logButtonInner}
          >
            <Text style={styles.logButtonText}>Log it</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
          <Text style={[styles.cancelButtonText, { color: t.secondaryAction }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  closeButton: { minWidth: 60, alignItems: 'flex-start', padding: 8 },
  closeText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800' },
  placeholder: { width: 60 },
  content: { flex: 1, padding: 20, paddingTop: 24 },
  productName: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  brandText: { fontSize: 14, marginBottom: 8 },
  sourceBadgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  sourceBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  sourceBadgeUsda: { borderColor: ACCENT.green },
  sourceBadgeText: { fontSize: 12, fontWeight: '700' },
  confidenceText: { fontSize: 12, fontWeight: '600' },
  macroCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  macroItem: { alignItems: 'center', flex: 1 },
  macroValue: { fontSize: 16, fontWeight: '800' },
  macroLabel: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  defaultText: { fontSize: 14, marginBottom: 8 },
  presetRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  presetChip: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  presetChipText: { fontSize: 13, fontWeight: '700' },
  amountLabel: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  amountInput: { borderRadius: 12, padding: 14, fontSize: 20, marginBottom: 8, borderWidth: 1 },
  estimated: { fontSize: 14, marginBottom: 20 },
  logButton: { borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  logButtonInner: { padding: 14, alignItems: 'center' },
  logButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  cancelButton: { padding: 12, alignItems: 'center' },
  cancelButtonText: { fontSize: 14, fontWeight: '600' },
});
