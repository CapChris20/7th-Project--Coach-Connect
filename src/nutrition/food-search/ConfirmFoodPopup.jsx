// Design Law Nutrition facts confirm (PNG 13/14) + Edit serving sheet (PNG 15/16).
// Flow: finalizeBarcodeFood → scale macros by grams → meal chip → Confirm and log.
// Used by FoodSearchScreen + BarcodeScannerScreen. Export name FoodConfirmSheet is FROZEN.
//
// vocab: macrosAtGrams = calories/P/C/F at a gram amount (barcode / per-100g aware)
// vocab: nbFill = selected meal chip + primary button fill (black light / white dark)
// KEEP Firestore-facing fields: servingSize, servingGrams, loggedUnit, dataBasis, etc.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  finalizeBarcodeFood,
  resolveServingGrams,
  parseServingQtyInput,
  totalGramsFromServing,
} from '../food-details/servingSizeMath';
import { macrosAtGrams } from '../barcode/scannedProductSummary';
import { normalizeFoodForLog } from '../food-search/cleanSearchText';
import { normalizeFoodRecordForStorage } from '../food-search/readableFoodTitle';
import { SHELL_SAFE_AREA_EDGES, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbPageHeader from '../../look-and-feel/NbPageHeader';
import NbButton from '../../look-and-feel/NbButton';
import NbSheet from '../../look-and-feel/NbSheet';
import HardShadow from '../../look-and-feel/HardShadow';
import NbIconChip from '../../look-and-feel/NbIconChip';
import ColorFieldFrame from '../food-cards/ColorFieldFrame';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const DEFAULT_SERVING_GRAMS = 100;
const MIN_SERVINGS_LOGGED = 0.01;
const HALF_SERVING = 0.5;
const AMOUNT_ROUND_FACTOR = 100;

const PROTEIN_ICON = require('../../assets/icons/handoff/protein.png');
const CARBS_ICON = require('../../assets/icons/handoff/carbs.png');
const FATS_ICON = require('../../assets/icons/handoff/fats.png');

// ===== HELPER FUNCTIONS =====

/**
 * Coerce to a finite number, or fallback when junk.
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
function numberOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
 * Display name for header subtitle + payload.
 * @param {object} food
 * @returns {string}
 */
function foodDisplayName(food) {
  return food?.name || food?.food_name || 'Food';
}

/**
 * Title-case a mealType prop into a MEALS chip label.
 * @param {string} mealType
 * @returns {string}
 */
function mealTitle(mealType) {
  const m = String(mealType || 'lunch');
  const titled = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
  if (titled === 'Snack') return 'Snacks';
  return MEALS.includes(titled) ? titled : 'Snacks';
}

/**
 * Package serving unit word (bowl, serving, cup…) for the SERVING SIZE row.
 * @param {object} food
 * @returns {string}
 */
function unitFromFood(food) {
  return (
    food?.servingUnit ||
    food?.serving_unit ||
    food?.portion_text ||
    food?.serving_label ||
    'serving'
  );
}

/**
 * Scale label micros (fat sub-rows, sodium, etc.) by grams ratio vs label serving.
 * Main P/C/F/kcal come from macrosAtGrams — this is only for the NUTRIENTS list extras.
 * @param {object} food
 * @param {number} totalGrams
 * @param {number} labelGrams
 * @returns {object}
 */
function scaledMicros(food, totalGrams, labelGrams) {
  const base = Math.max(1, labelGrams);
  const ratio = Math.max(0.01, totalGrams) / base;
  const read = (key, metaKey) =>
    numberOr(food?.[key] ?? food?.metadata?.[metaKey ?? key]);
  return {
    fiber: Math.round(read('fiber') * ratio * 10) / 10,
    sugar: Math.round(read('sugar') * ratio * 10) / 10,
    sodium: Math.round(read('sodium') * ratio * 10) / 10,
    cholesterol: Math.round(read('cholesterol') * ratio * 10) / 10,
    saturatedFat: Math.round(read('saturatedFat', 'saturatedFat') * ratio * 10) / 10,
    potassium: Math.round(read('potassium') * ratio * 10) / 10,
    vitaminD: Math.round(read('vitaminD') * ratio * 10) / 10,
  };
}

/**
 * Build the confirmed food payload for onConfirm — Firestore-facing field names frozen.
 * @param {object} options
 * @returns {object}
 */
function buildConfirmedFoodPayload({
  nutritionBase,
  macros,
  grams,
  servingsLogged,
  servingUnit,
  labelServingGrams,
  scannedBarcode,
}) {
  return {
    ...nutritionBase,
    name: foodDisplayName(nutritionBase),
    food_name: foodDisplayName(nutritionBase),
    calories: Math.round(numberOr(macros.calories)),
    protein: numberOr(macros.protein),
    carbs: numberOr(macros.carbs),
    fat: numberOr(macros.fat),
    // vocab: servingGrams here = TOTAL grams logged (saveLoggedFood expects logged total)
    servingGrams: grams,
    serving_grams: grams,
    servingAmount: grams,
    servingSize: servingsLogged,
    serving_size: servingsLogged,
    servingUnit,
    serving_unit: servingUnit,
    dataBasis: 'logged_total',
    loggedAmount: servingsLogged,
    loggedUnit: 'servings',
    preferredUnit: 'servings',
    originalUnit: 'servings',
    originalAmount: servingsLogged,
    labelServingGrams,
    userVerified: true,
    scannedBarcode: scannedBarcode || nutritionBase?.scannedBarcode || null,
  };
}

function NutrientRow({ label, value, nested, colors }) {
  return (
    <View style={[styles.nutrientRow, nested && styles.nutrientNested]}>
      <Text style={[styles.nutrientLabel, { color: nested ? colors.nbMuted : colors.nbInk }]}>
        {label}
      </Text>
      <Text style={[styles.nutrientValue, { color: nested ? colors.nbMuted : colors.nbInk }]}>
        {value}
      </Text>
    </View>
  );
}

function MacroTile({ icon, value, label, index, colors }) {
  return (
    <View style={[styles.tile, { borderColor: colors.nbBorder }]}>
      <NbIconChip source={icon} size={28} index={index} />
      <Text style={[styles.tileValue, { color: colors.nbInk }]}>{value}</Text>
      <Text style={[styles.tileLabel, { color: colors.nbMuted }]}>{label}</Text>
    </View>
  );
}

/**
 * HardShadow field for Edit serving sheet (PNG 15) — label caps + outlined input.
 */
function HardField({ label, value, onChangeText, colors, keyboardType = 'decimal-pad' }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>{label}</Text>
      <ColorFieldFrame radius={borderRadius.nbInput}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          style={[styles.fieldInput, { color: colors.nbInk }]}
          placeholderTextColor={colors.nbMuted}
        />
      </ColorFieldFrame>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ food: object, onConfirm: Function, onCancel: Function, mealType?: string, title?: string, theme?: object, showVerification?: boolean, reserveShellBottomNav?: boolean, scannedBarcode?: string, onWrongItem?: Function }} props
 */
export default function FoodConfirmSheet({
  food,
  onConfirm,
  onCancel,
  mealType: mealTypeProp = 'lunch',
  title = 'Nutrition facts',
  theme,
  showVerification = false,
  reserveShellBottomNav = false,
  scannedBarcode,
  onWrongItem,
}) {
  const { colors } = useTheme();
  const shellBottomPad = useShellBottomNavInset(16);
  const screenBg = theme?.screenBg || colors.nbBackground;

  // PNG title is always "Nutrition facts" — ignore legacy "Confirm & log" callers
  const headerTitle =
    !title || /confirm/i.test(String(title)) ? 'Nutrition facts' : String(title);

  // vocab: normalized = finalizeBarcodeFood then normalizeFoodForLog (per-100g sanitised)
  const normalized = useMemo(
    () => (food ? normalizeFoodForLog(finalizeBarcodeFood(food)) : null),
    [food],
  );

  const labelGrams = useMemo(
    () => (normalized ? resolveServingGrams(normalized) : DEFAULT_SERVING_GRAMS),
    [normalized],
  );

  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState(mealTitle(mealTypeProp));
  const [editOpen, setEditOpen] = useState(false);
  const [editGrams, setEditGrams] = useState('');
  const [editQty, setEditQty] = useState('1');
  const [editUnit, setEditUnit] = useState('serving');
  // Manipulate here: grams-per-serving the user can override in Edit serving
  const [servingGrams, setServingGrams] = useState(labelGrams);
  const [servingUnit, setServingUnit] = useState(unitFromFood(food));

  // Reset local edits when a different food lands in the sheet
  useEffect(() => {
    if (!normalized) return;
    setServings(1);
    setMeal(mealTitle(mealTypeProp));
    setServingGrams(resolveServingGrams(normalized) || DEFAULT_SERVING_GRAMS);
    setServingUnit(unitFromFood(normalized));
    setEditOpen(false);
  }, [normalized, mealTypeProp]);

  // Total grams for this log line = quantity × grams per serving
  const totalGrams = Math.max(
    1,
    totalGramsFromServing(servings, servingGrams) || Math.round(servings * servingGrams),
  );

  // Main macros at the logged gram amount (barcode-aware)
  const macros = useMemo(() => {
    if (!normalized) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    try {
      return macrosAtGrams(normalized, totalGrams) || {};
    } catch (_) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }
  }, [normalized, totalGrams]);

  const micros = useMemo(
    () => scaledMicros(normalized || {}, totalGrams, servingGrams || labelGrams),
    [normalized, totalGrams, servingGrams, labelGrams],
  );

  const foodName = foodDisplayName(normalized || food);

  const bumpServings = (delta) => {
    setServings((s) =>
      Math.max(HALF_SERVING, Math.round((s + delta) * AMOUNT_ROUND_FACTOR) / AMOUNT_ROUND_FACTOR),
    );
  };

  const openEdit = () => {
    setEditGrams(String(servingGrams));
    setEditQty(String(servings));
    setEditUnit(String(servingUnit || 'serving'));
    setEditOpen(true);
  };

  const applyEdit = () => {
    const g = parseAmountNumber(editGrams);
    const q = parseAmountNumber(editQty);
    setServingGrams(Math.max(1, g != null ? g : servingGrams));
    setServings(Math.max(MIN_SERVINGS_LOGGED, q != null ? q : servings));
    setServingUnit((editUnit || '').trim() || 'serving');
    setEditOpen(false);
  };

  /**
   * Confirm → normalize → onConfirm(food, mealKey). mealKey is lowercase chip name.
   */
  const handleConfirm = () => {
    if (!normalized) return;
    const mealKey = String(meal || 'snacks').toLowerCase();
    const servingsLogged = Math.max(MIN_SERVINGS_LOGGED, servings);
    let payload = buildConfirmedFoodPayload({
      nutritionBase: normalized,
      macros,
      grams: totalGrams,
      servingsLogged,
      servingUnit,
      labelServingGrams: servingGrams,
      scannedBarcode,
    });
    // Attach micros so the daily log can store them when present
    payload = {
      ...payload,
      fiber: micros.fiber,
      sugar: micros.sugar,
      sodium: micros.sodium,
      cholesterol: micros.cholesterol,
      saturatedFat: micros.saturatedFat,
      potassium: micros.potassium,
      vitaminD: micros.vitaminD,
    };
    try {
      if (typeof normalizeFoodRecordForStorage === 'function') {
        payload = normalizeFoodRecordForStorage(payload) || payload;
      }
    } catch (_) {
      /* keep payload */
    }
    onConfirm?.(payload, mealKey);
  };

  if (!normalized) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={SHELL_SAFE_AREA_EDGES}>
      <NbPageHeader title={headerTitle} subtitle={foodName} onBack={onCancel} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.md,
            paddingBottom: reserveShellBottomNav ? shellBottomPad + 80 : 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Calories + 3 macro boxes (PNG 13) */}
          <HardShadow
            radius={borderRadius.nbCard}
            offset={nb.shadowOffsetCard}
            style={{ marginBottom: 16 }}
          >
            <View
              style={[
                styles.macroCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <Text style={[styles.calNum, { color: colors.nbInk }]}>
                {Math.round(macros.calories || 0)}
                <Text style={[styles.calUnit, { color: colors.nbMuted }]}> calories</Text>
              </Text>
              <View style={styles.macroTiles}>
                <MacroTile
                  icon={PROTEIN_ICON}
                  value={`${Math.round(macros.protein || 0)} g`}
                  label="Protein"
                  index={3}
                  colors={colors}
                />
                <MacroTile
                  icon={CARBS_ICON}
                  value={`${Math.round(macros.carbs || 0)} g`}
                  label="Carbs"
                  index={0}
                  colors={colors}
                />
                <MacroTile
                  icon={FATS_ICON}
                  value={`${Math.round(macros.fat || 0)} g`}
                  label="Fats"
                  index={1}
                  colors={colors}
                />
              </View>
            </View>
          </HardShadow>

          {/* Servings stepper + SERVING SIZE + Edit serving pill */}
          <HardShadow
            radius={borderRadius.nbCard}
            offset={nb.shadowOffsetCard}
            style={{ marginBottom: 16 }}
          >
            <View
              style={[
                styles.servingCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <View style={styles.servingRow}>
                <Text style={[styles.servingLabel, { color: colors.nbMuted }]}>SERVINGS</Text>
                <View style={styles.stepper}>
                  <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
                    <TouchableOpacity
                      onPress={() => bumpServings(-HALF_SERVING)}
                      style={[
                        styles.stepBtn,
                        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                      ]}
                      accessibilityLabel="Fewer servings"
                      activeOpacity={0.85}
                    >
                      <Ionicons name="remove" size={20} color={colors.nbInk} />
                    </TouchableOpacity>
                  </HardShadow>
                  <Text style={[styles.stepValue, { color: colors.nbInk }]}>{servings}</Text>
                  <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
                    <TouchableOpacity
                      onPress={() => bumpServings(HALF_SERVING)}
                      style={[
                        styles.stepBtn,
                        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                      ]}
                      accessibilityLabel="More servings"
                      activeOpacity={0.85}
                    >
                      <Ionicons name="add" size={20} color={colors.nbInk} />
                    </TouchableOpacity>
                  </HardShadow>
                </View>
              </View>

              <View style={[styles.servingDivider, { backgroundColor: colors.nbBorder }]} />

              <View style={styles.servingRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.servingLabel, { color: colors.nbMuted }]}>SERVING SIZE</Text>
                  <Text style={[styles.servingSizeText, { color: colors.nbInk }]} numberOfLines={1}>
                    1 {servingUnit} • {Math.round(servingGrams)} g
                  </Text>
                </View>
                {/* NbPill-style ghost pill (pressable) — PNG "Edit serving" */}
                <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
                  <TouchableOpacity
                    onPress={openEdit}
                    style={[
                      styles.editServingPill,
                      { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Edit serving"
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.editServingText, { color: colors.nbInk }]}>
                      Edit serving
                    </Text>
                  </TouchableOpacity>
                </HardShadow>
              </View>
            </View>
          </HardShadow>

          {/* MEAL chips — active = nbFill (not brand gradient) */}
          <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>MEAL</Text>
          <View style={styles.mealRow}>
            {MEALS.map((m) => {
              const selected = meal === m;
              return (
                <HardShadow key={m} offset={nb.shadowOffsetSmall} radius={999}>
                  <TouchableOpacity
                    onPress={() => setMeal(m)}
                    style={[
                      styles.mealChip,
                      {
                        borderColor: colors.nbBorder,
                        backgroundColor: selected ? colors.nbFill : colors.nbSurface,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={{
                        color: selected ? colors.nbOnFill : colors.nbInk,
                        fontFamily: 'SpaceGrotesk_700Bold',
                        fontSize: 13,
                      }}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                </HardShadow>
              );
            })}
          </View>

          {/* NUTRIENTS list */}
          <View style={styles.nutrientHeader}>
            <Text style={[styles.sectionLabel, { color: colors.nbMuted, marginBottom: 0 }]}>
              NUTRIENTS
            </Text>
            <Text style={[styles.sectionLabel, { color: colors.nbMuted, marginBottom: 0 }]}>
              PER SERVING ON LABEL
            </Text>
          </View>
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
            <View
              style={[
                styles.nutrientCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <NutrientRow label="Total fat" value={`${macros.fat || 0} g`} colors={colors} />
              {micros.saturatedFat ? (
                <NutrientRow
                  label="Sat. fat"
                  value={`${micros.saturatedFat} g`}
                  nested
                  colors={colors}
                />
              ) : null}
              <NutrientRow
                label="Cholesterol"
                value={`${micros.cholesterol || 0} mg`}
                colors={colors}
              />
              <NutrientRow label="Sodium" value={`${micros.sodium || 0} mg`} colors={colors} />
              <NutrientRow
                label="Carbohydrates"
                value={`${macros.carbs || 0} g`}
                colors={colors}
              />
              {micros.sugar ? (
                <NutrientRow label="Sugars" value={`${micros.sugar} g`} nested colors={colors} />
              ) : null}
              <NutrientRow label="Protein" value={`${macros.protein || 0} g`} colors={colors} />
              {micros.potassium ? (
                <NutrientRow
                  label="Potassium"
                  value={`${micros.potassium} mg`}
                  colors={colors}
                />
              ) : null}
              {micros.vitaminD ? (
                <NutrientRow
                  label="Vitamin D"
                  value={`${micros.vitaminD} mcg`}
                  colors={colors}
                />
              ) : null}
            </View>
          </HardShadow>

          {showVerification && typeof onWrongItem === 'function' ? (
            <NbButton variant="plain" onPress={onWrongItem} style={{ marginTop: 16 }}>
              Wrong item — search instead
            </NbButton>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: screenBg, paddingBottom: spacing.md }]}>
          <NbButton variant="fill" onPress={handleConfirm}>
            Confirm and log
          </NbButton>
        </View>
      </KeyboardAvoidingView>

      {/* PNG 15/16 Edit serving — NbSheet + HardShadow fields */}
      <NbSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit serving">
        <Text style={[styles.editHint, { color: colors.nbMuted }]}>
          Use this when the package says something different.
        </Text>
        <HardField
          label="SERVING SIZE (G PER SERVING)"
          value={editGrams}
          onChangeText={setEditGrams}
          colors={colors}
        />
        <HardField
          label="QUANTITY (SERVINGS)"
          value={editQty}
          onChangeText={setEditQty}
          colors={colors}
        />
        <HardField
          label="SERVING UNIT"
          value={editUnit}
          onChangeText={setEditUnit}
          colors={colors}
          keyboardType="default"
        />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <NbButton variant="plain" onPress={() => setEditOpen(false)}>
              Cancel
            </NbButton>
          </View>
          <View style={{ flex: 2 }}>
            <NbButton variant="fill" onPress={applyEdit}>
              Done editing nutrition
            </NbButton>
          </View>
        </View>
      </NbSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  macroCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 16,
  },
  calNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    letterSpacing: -1,
    marginBottom: 14,
  },
  calUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
  },
  macroTiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    borderWidth: nb.borderWidthDivider,
    borderRadius: borderRadius.nbCard,
    padding: 10,
    alignItems: 'flex-start',
    gap: 6,
  },
  tileValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  tileLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  servingCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
  },
  servingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  servingLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
  },
  servingSizeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    marginTop: 4,
  },
  servingDivider: {
    height: nb.borderWidthDivider,
    opacity: 0.35,
    marginVertical: 12,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 10,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    minWidth: 36,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  editServingPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  editServingText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  mealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  mealChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutrientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nutrientCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 14,
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: nb.borderWidthDivider,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  nutrientNested: { paddingLeft: 14 },
  nutrientLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  nutrientValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  footer: { paddingHorizontal: spacing.md, paddingTop: 8 },
  editHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldBlock: { marginBottom: 12 },
  fieldLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
