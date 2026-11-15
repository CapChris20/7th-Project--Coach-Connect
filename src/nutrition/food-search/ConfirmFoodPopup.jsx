// Design Law Nutrition facts confirm (PNG 13/14) + Edit serving sheet (PNG 15/16).
// Flow: finalizeBarcodeFood → scale macros by grams → meal chip → Confirm and log.
// Used by FoodSearchScreen + BarcodeScannerScreen. Export name FoodConfirmSheet is FROZEN.
//
// vocab: macrosAtGrams = calories/P/C/F at a gram amount (barcode / per-100g aware)
// vocab: nbFill = selected meal chip + primary button fill (black light / white dark)
// KEEP Firestore-facing fields: servingSize, servingGrams, loggedUnit, dataBasis, etc.

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { finalizeBarcodeFood, resolveServingGrams, parseServingQtyInput, totalGramsFromServing } from '../food-details/servingSizeMath';
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

const MEAL_CHIP_LABELS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];
const DEFAULT_SERVING_GRAMS = 100;
const MIN_SERVINGS_LOGGED = 0.01;
const HALF_SERVING = 0.5;
const AMOUNT_ROUND_FACTOR = 100;
const SCROLL_FOOTER_EXTRA_WITH_NAV = 80;
const SCROLL_FOOTER_EXTRA_DEFAULT = 120;
const SHELL_BOTTOM_INSET_FALLBACK = 16;
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
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) return asNumber;
  return fallback;
}

/**
 * Parse typed amount: fractions via parseServingQtyInput, else Number with comma→dot.
 * @param {*} rawValue
 * @returns {number|null}
 */
function parseAmountNumber(rawValue) {
  const parsedFraction = parseServingQtyInput(rawValue);
  if (parsedFraction != null) return parsedFraction;
  if (rawValue === '' || rawValue == null) return null;
  const withDot = String(rawValue).replace(',', '.');
  return Number(withDot);
}

/**
 * Display name for header subtitle + payload.
 * Food-card keys name / food_name stay frozen.
 * @param {object} food
 * @returns {string}
 */
function foodDisplayName(food) {
  if (!food) return 'Food';
  if (food.name) return food.name;
  if (food.food_name) return food.food_name;
  return 'Food';
}

/**
 * Title-case a mealType prop into a meal-chip label.
 * @param {string} mealType
 * @returns {string}
 */
function mealTitle(mealType) {
  const mealRaw = String(mealType || 'lunch');
  const titled = mealRaw.charAt(0).toUpperCase() + mealRaw.slice(1).toLowerCase();
  if (titled === 'Snack') return 'Snacks';
  if (MEAL_CHIP_LABELS.includes(titled)) return titled;
  return 'Snacks';
}

/**
 * Package serving unit word (bowl, serving, cup…) for the SERVING SIZE row.
 * @param {object} food
 * @returns {string}
 */
function unitFromFood(food) {
  if (!food) return 'serving';
  if (food.servingUnit) return food.servingUnit;
  if (food.serving_unit) return food.serving_unit;
  if (food.portion_text) return food.portion_text;
  if (food.serving_label) return food.serving_label;
  return 'serving';
}

/**
 * Read one micro from the food card top-level or metadata.
 * Main P/C/F/kcal come from macrosAtGrams — micros are label extras only.
 * @param {object} food
 * @param {string} key
 * @param {string} [metaKey]
 * @returns {number}
 */
function readMicroFromFood(food, key, metaKey) {
  const metadataKey = metaKey != null ? metaKey : key;
  if (!food) return numberOr(undefined);
  const fromTop = food[key];
  if (fromTop != null) return numberOr(fromTop);
  const metadata = food.metadata;
  if (!metadata) return numberOr(undefined);
  return numberOr(metadata[metadataKey]);
}
function scaleMicroValue(rawValue, ratio) {
  return Math.round(rawValue * ratio * 10) / 10;
}

/**
 * Scale label micros (fat sub-rows, sodium, etc.) by grams ratio vs label serving.
 * @param {object} food
 * @param {number} totalGrams
 * @param {number} labelGrams
 * @returns {object}
 */
function scaledMicros(food, totalGrams, labelGrams) {
  const baseGrams = Math.max(1, labelGrams);
  const safeTotalGrams = Math.max(0.01, totalGrams);
  const ratio = safeTotalGrams / baseGrams;
  return {
    fiber: scaleMicroValue(readMicroFromFood(food, 'fiber'), ratio),
    sugar: scaleMicroValue(readMicroFromFood(food, 'sugar'), ratio),
    sodium: scaleMicroValue(readMicroFromFood(food, 'sodium'), ratio),
    cholesterol: scaleMicroValue(readMicroFromFood(food, 'cholesterol'), ratio),
    saturatedFat: scaleMicroValue(readMicroFromFood(food, 'saturatedFat', 'saturatedFat'), ratio),
    potassium: scaleMicroValue(readMicroFromFood(food, 'potassium'), ratio),
    vitaminD: scaleMicroValue(readMicroFromFood(food, 'vitaminD'), ratio)
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
  scannedBarcode
}) {
  const displayName = foodDisplayName(nutritionBase);
  // vocab: servingGrams here = TOTAL grams logged (saveLoggedFood expects logged total)
  return {
    ...nutritionBase,
    name: displayName,
    food_name: displayName,
    calories: Math.round(numberOr(macros.calories)),
    protein: numberOr(macros.protein),
    carbs: numberOr(macros.carbs),
    fat: numberOr(macros.fat),
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
    scannedBarcode: pickScannedBarcode(scannedBarcode, nutritionBase),
  };
}

/**
 * Prefer the prop barcode; else the one already on the nutrition base card.
 * @param {*} scannedBarcode
 * @param {object|null|undefined} nutritionBase
 * @returns {*|null}
 */
function pickScannedBarcode(scannedBarcode, nutritionBase) {
  if (scannedBarcode) return scannedBarcode;
  if (!nutritionBase) return null;
  if (nutritionBase.scannedBarcode) return nutritionBase.scannedBarcode;
  return null;
}

function pickHeaderTitle(titleProp) {
  // PNG title is always "Nutrition facts" — ignore legacy "Confirm & log" callers
  if (!titleProp) return 'Nutrition facts';
  if (/confirm/i.test(String(titleProp))) return 'Nutrition facts';
  return String(titleProp);
}
function pickScreenBackground(colors, theme) {
  if (theme && theme.screenBg) return theme.screenBg;
  return colors.nbBackground;
}
function emptyMacros() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  };
}
function macrosForLoggedGrams(normalizedFood, totalGrams) {
  if (!normalizedFood) return emptyMacros();
  try {
    return macrosAtGrams(normalizedFood, totalGrams) || emptyMacros();
  } catch (_macroError) {
    return emptyMacros();
  }
}
function NutrientRow({
  label,
  value,
  nested,
  colors
}) {
  let labelColor;
  if (nested) {
    labelColor = colors.nbMuted;
  } else {
    labelColor = colors.nbInk;
  }
  let valueColor;
  if (nested) {
    valueColor = colors.nbMuted;
  } else {
    valueColor = colors.nbInk;
  }
  return <View style={[styles.nutrientRow, nested && styles.nutrientNested]}>
      <Text style={[styles.nutrientLabel, {
      color: labelColor
    }]}>{label}</Text>
      <Text style={[styles.nutrientValue, {
      color: valueColor
    }]}>{value}</Text>
    </View>;
}
function MacroTile({
  icon,
  value,
  label,
  index,
  colors
}) {
  return <View style={[styles.tile, {
    borderColor: colors.nbBorder
  }]}>
      <NbIconChip source={icon} size={28} index={index} />
      <Text style={[styles.tileValue, {
      color: colors.nbInk
    }]}>{value}</Text>
      <Text style={[styles.tileLabel, {
      color: colors.nbMuted
    }]}>{label}</Text>
    </View>;
}

/**
 * HardShadow field for Edit serving sheet (PNG 15) — label caps + outlined input.
 */
function HardField({
  label,
  value,
  onChangeText,
  colors,
  keyboardType = 'decimal-pad'
}) {
  return <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, {
      color: colors.nbMuted
    }]}>{label}</Text>
      <ColorFieldFrame radius={borderRadius.nbInput}>
        <TextInput value={value} onChangeText={onChangeText} keyboardType={keyboardType} style={[styles.fieldInput, {
        color: colors.nbInk
      }]} placeholderTextColor={colors.nbMuted} />
      </ColorFieldFrame>
    </View>;
}
function MealChip({
  mealName,
  selected,
  onPress,
  colors
}) {
  // Active chip uses nbFill (not brand gradient) — Design Law meal chips
  let chipBackground = colors.nbSurface;
  let chipTextColor = colors.nbInk;
  if (selected) {
    chipBackground = colors.nbFill;
    chipTextColor = colors.nbOnFill;
  }
  return <HardShadow key={mealName} offset={nb.shadowOffsetSmall} radius={999}>
      <TouchableOpacity onPress={onPress} style={[styles.mealChip, {
      borderColor: colors.nbBorder,
      backgroundColor: chipBackground
    }]} accessibilityRole="button" accessibilityState={{
      selected
    }} activeOpacity={0.85}>
        <Text style={{
        color: chipTextColor,
        fontFamily: 'SpaceGrotesk_700Bold',
        fontSize: 13
      }}>
          {mealName}
        </Text>
      </TouchableOpacity>
    </HardShadow>;
}
function MacroSummaryCard({
  macros,
  colors
}) {
  const caloriesText = Math.round(macros.calories || 0);
  const proteinText = `${Math.round(macros.protein || 0)} g`;
  const carbsText = `${Math.round(macros.carbs || 0)} g`;
  const fatText = `${Math.round(macros.fat || 0)} g`;
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{
    marginBottom: 16
  }}>
      <View style={[styles.macroCard, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        <Text style={[styles.calNum, {
        color: colors.nbInk
      }]}>
          {caloriesText}
          <Text style={[styles.calUnit, {
          color: colors.nbMuted
        }]}> calories</Text>
        </Text>
        <View style={styles.macroTiles}>
          <MacroTile icon={PROTEIN_ICON} value={proteinText} label="Protein" index={3} colors={colors} />
          <MacroTile icon={CARBS_ICON} value={carbsText} label="Carbs" index={0} colors={colors} />
          <MacroTile icon={FATS_ICON} value={fatText} label="Fats" index={1} colors={colors} />
        </View>
      </View>
    </HardShadow>;
}
function ServingControlsCard({
  servings,
  servingUnit,
  servingGrams,
  onFewer,
  onMore,
  onOpenEdit,
  colors
}) {
  const servingSizeLine = `1 ${servingUnit} • ${Math.round(servingGrams)} g`;
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{
    marginBottom: 16
  }}>
      <View style={[styles.servingCard, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        <View style={styles.servingRow}>
          <Text style={[styles.servingLabel, {
          color: colors.nbMuted
        }]}>SERVINGS</Text>
          <View style={styles.stepper}>
            <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
              <TouchableOpacity onPress={onFewer} style={[styles.stepBtn, {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface
            }]} accessibilityLabel="Fewer servings" activeOpacity={0.85}>
                <Ionicons name="remove" size={20} color={colors.nbInk} />
              </TouchableOpacity>
            </HardShadow>
            <Text style={[styles.stepValue, {
            color: colors.nbInk
          }]}>{servings}</Text>
            <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
              <TouchableOpacity onPress={onMore} style={[styles.stepBtn, {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface
            }]} accessibilityLabel="More servings" activeOpacity={0.85}>
                <Ionicons name="add" size={20} color={colors.nbInk} />
              </TouchableOpacity>
            </HardShadow>
          </View>
        </View>

        <View style={[styles.servingDivider, {
        backgroundColor: colors.nbBorder
      }]} />

        <View style={styles.servingRow}>
          <View style={{
          flex: 1,
          minWidth: 0
        }}>
            <Text style={[styles.servingLabel, {
            color: colors.nbMuted
          }]}>SERVING SIZE</Text>
            <Text style={[styles.servingSizeText, {
            color: colors.nbInk
          }]} numberOfLines={1}>
              {servingSizeLine}
            </Text>
          </View>
          <HardShadow offset={nb.shadowOffsetSmall} radius={999}>
            <TouchableOpacity onPress={onOpenEdit} style={[styles.editServingPill, {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface
          }]} accessibilityRole="button" accessibilityLabel="Edit serving" activeOpacity={0.85}>
              <Text style={[styles.editServingText, {
              color: colors.nbInk
            }]}>
                Edit serving
              </Text>
            </TouchableOpacity>
          </HardShadow>
        </View>
      </View>
    </HardShadow>;
}
function NutrientsCard({
  macros,
  micros,
  colors
}) {
  const showSaturatedFat = Boolean(micros.saturatedFat);
  const showSugar = Boolean(micros.sugar);
  const showPotassium = Boolean(micros.potassium);
  const showVitaminD = Boolean(micros.vitaminD);
  return <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View style={[styles.nutrientCard, {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder
    }]}>
        <NutrientRow label="Total fat" value={`${macros.fat || 0} g`} colors={colors} />
        {showSaturatedFat ? <NutrientRow label="Sat. fat" value={`${micros.saturatedFat} g`} nested colors={colors} /> : null}
        <NutrientRow label="Cholesterol" value={`${micros.cholesterol || 0} mg`} colors={colors} />
        <NutrientRow label="Sodium" value={`${micros.sodium || 0} mg`} colors={colors} />
        <NutrientRow label="Carbohydrates" value={`${macros.carbs || 0} g`} colors={colors} />
        {showSugar ? <NutrientRow label="Sugars" value={`${micros.sugar} g`} nested colors={colors} /> : null}
        <NutrientRow label="Protein" value={`${macros.protein || 0} g`} colors={colors} />
        {showPotassium ? <NutrientRow label="Potassium" value={`${micros.potassium} mg`} colors={colors} /> : null}
        {showVitaminD ? <NutrientRow label="Vitamin D" value={`${micros.vitaminD} mcg`} colors={colors} /> : null}
      </View>
    </HardShadow>;
}

// ===== MAIN FUNCTION =====

/**
 * Nutrition facts confirm sheet — scale serving, pick meal, Confirm and log.
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
  onWrongItem
}) {
  // 1. Theme + chrome.
  const {
    colors
  } = useTheme();
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET_FALLBACK);
  const screenBg = pickScreenBackground(colors, theme);
  const headerTitle = pickHeaderTitle(title);

  // vocab: normalized = finalizeBarcodeFood then normalizeFoodForLog (per-100g sanitised)
  const normalized = useMemo(() => food ? normalizeFoodForLog(finalizeBarcodeFood(food)) : null, [food]);
  const labelGrams = useMemo(() => normalized ? resolveServingGrams(normalized) : DEFAULT_SERVING_GRAMS, [normalized]);
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
  const gramsFromServingMath = totalGramsFromServing(servings, servingGrams) || Math.round(servings * servingGrams);
  const totalGrams = Math.max(1, gramsFromServingMath);

  // Main macros at the logged gram amount (barcode-aware)
  const macros = useMemo(() => macrosForLoggedGrams(normalized, totalGrams), [normalized, totalGrams]);
  const micros = useMemo(() => scaledMicros(normalized || {}, totalGrams, servingGrams || labelGrams), [normalized, totalGrams, servingGrams, labelGrams]);
  const foodName = foodDisplayName(normalized || food);
  function bumpServings(delta) {
    // 1. Add or subtract a half-serving step.
    // 2. Round to two decimals so stepper values stay tidy.
    // 3. Never go below half a serving.
    setServings(currentServings => {
      const nextAmount = currentServings + delta;
      const rounded = Math.round(nextAmount * AMOUNT_ROUND_FACTOR) / AMOUNT_ROUND_FACTOR;
      return Math.max(HALF_SERVING, rounded);
    });
  }
  function openEdit() {
    // 1. Seed the edit sheet from the live serving state.
    // 2. Open the NbSheet.
    setEditGrams(String(servingGrams));
    setEditQty(String(servings));
    setEditUnit(String(servingUnit || 'serving'));
    setEditOpen(true);
  }
  function applyEdit() {
    // 1. Parse grams + quantity from the sheet fields.
    const gramsFromField = parseAmountNumber(editGrams);
    const qtyFromField = parseAmountNumber(editQty);

    // 2. Keep previous grams when the field is empty / junk.
    let nextGrams = servingGrams;
    if (gramsFromField != null) nextGrams = gramsFromField;
    setServingGrams(Math.max(1, nextGrams));

    // 3. Keep previous qty when the field is empty / junk.
    let nextQty = servings;
    if (qtyFromField != null) nextQty = qtyFromField;
    setServings(Math.max(MIN_SERVINGS_LOGGED, nextQty));

    // 4. Unit text falls back to "serving" when blank.
    const unitText = (editUnit || '').trim();
    if (unitText) {
      setServingUnit(unitText);
    } else {
      setServingUnit('serving');
    }
    setEditOpen(false);
  }

  /**
   * Confirm → normalize → onConfirm(food, mealKey). mealKey is lowercase chip name.
   */
  function handleConfirm() {
    // 1. Need a normalized food card.
    if (!normalized) return;

    // 2. Build the Firestore-facing payload.
    const mealKey = String(meal || 'snacks').toLowerCase();
    const servingsLogged = Math.max(MIN_SERVINGS_LOGGED, servings);
    let payload = buildConfirmedFoodPayload({
      nutritionBase: normalized,
      macros,
      grams: totalGrams,
      servingsLogged,
      servingUnit,
      labelServingGrams: servingGrams,
      scannedBarcode
    });

    // 3. Attach micros so the daily log can store them when present.
    payload = {
      ...payload,
      fiber: micros.fiber,
      sugar: micros.sugar,
      sodium: micros.sodium,
      cholesterol: micros.cholesterol,
      saturatedFat: micros.saturatedFat,
      potassium: micros.potassium,
      vitaminD: micros.vitaminD
    };

    // 4. Optional storage-title tidy — keep payload if the helper throws.
    try {
      if (typeof normalizeFoodRecordForStorage === 'function') {
        payload = normalizeFoodRecordForStorage(payload) || payload;
      }
    } catch (_storageError) {
      /* keep payload */
    }

    // 5. Hand the payload to the parent logger.
    if (typeof onConfirm === 'function') {
      onConfirm(payload, mealKey);
    }
  }
  if (!normalized) return null;

  // Named layout decisions — no nested ternaries in JSX
  let scrollBottomPad = SCROLL_FOOTER_EXTRA_DEFAULT;
  if (reserveShellBottomNav) {
    scrollBottomPad = shellBottomPad + SCROLL_FOOTER_EXTRA_WITH_NAV;
  }
  let footerPaddingBottom = spacing.md;
  if (reserveShellBottomNav) {
    footerPaddingBottom = Math.max(shellBottomPad, spacing.md);
  }
  const showWrongItem = showVerification && typeof onWrongItem === 'function';
  const keyboardBehavior = Platform.OS === 'ios' ? 'padding' : undefined;

  // Meal chips built with a for-loop (no .map in the screen recipe).
  const mealChips = [];
  for (let index = 0; index < MEAL_CHIP_LABELS.length; index += 1) {
    const mealName = MEAL_CHIP_LABELS[index];
    mealChips.push(
      <MealChip
        key={mealName}
        mealName={mealName}
        selected={meal === mealName}
        onPress={() => setMeal(mealName)}
        colors={colors}
      />,
    );
  }

  return <SafeAreaView style={{
    flex: 1,
    backgroundColor: screenBg
  }} edges={SHELL_SAFE_AREA_EDGES}>
      <NbPageHeader title={headerTitle} subtitle={foodName} onBack={onCancel} />
      <KeyboardAvoidingView style={{
      flex: 1
    }} behavior={keyboardBehavior}>
        <ScrollView contentContainerStyle={{
        paddingHorizontal: spacing.md,
        paddingBottom: scrollBottomPad
      }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <MacroSummaryCard macros={macros} colors={colors} />

          <ServingControlsCard servings={servings} servingUnit={servingUnit} servingGrams={servingGrams} onFewer={() => bumpServings(-HALF_SERVING)} onMore={() => bumpServings(HALF_SERVING)} onOpenEdit={openEdit} colors={colors} />

          <Text style={[styles.sectionLabel, {
          color: colors.nbMuted
        }]}>MEAL</Text>
          <View style={styles.mealRow}>
            {mealChips}
          </View>

          <View style={styles.nutrientHeader}>
            <Text style={[styles.sectionLabel, {
            color: colors.nbMuted,
            marginBottom: 0
          }]}>
              NUTRIENTS
            </Text>
            <Text style={[styles.sectionLabel, {
            color: colors.nbMuted,
            marginBottom: 0
          }]}>
              PER SERVING ON LABEL
            </Text>
          </View>
          <NutrientsCard macros={macros} micros={micros} colors={colors} />

          {showWrongItem ? <NbButton variant="plain" onPress={onWrongItem} style={{
          marginTop: 16
        }}>
              Wrong item — search instead
            </NbButton> : null}
        </ScrollView>

        {/* When the shell bottom nav is visible, lift Confirm above it — otherwise only
            “Wrong item” (in the scroll) is reachable and Confirm looks missing. */}
        <View style={[styles.footer, {
        backgroundColor: screenBg,
        paddingBottom: footerPaddingBottom
      }]}>
          <NbButton variant="fill" onPress={handleConfirm}>
            Confirm and log
          </NbButton>
        </View>
      </KeyboardAvoidingView>

      <NbSheet visible={editOpen} onClose={() => setEditOpen(false)} title="Edit serving">
        <Text style={[styles.editHint, {
        color: colors.nbMuted
      }]}>
          Use this when the package says something different.
        </Text>
        <HardField label="SERVING SIZE (G PER SERVING)" value={editGrams} onChangeText={setEditGrams} colors={colors} />
        <HardField label="QUANTITY (SERVINGS)" value={editQty} onChangeText={setEditQty} colors={colors} />
        <HardField label="SERVING UNIT" value={editUnit} onChangeText={setEditUnit} colors={colors} keyboardType="default" />
        <View style={{
        flexDirection: 'row',
        gap: 10,
        marginTop: 16
      }}>
          <View style={{
          flex: 1
        }}>
            <NbButton variant="plain" onPress={() => setEditOpen(false)}>
              Cancel
            </NbButton>
          </View>
          <View style={{
          flex: 2
        }}>
            <NbButton variant="fill" onPress={applyEdit}>
              Done editing nutrition
            </NbButton>
          </View>
        </View>
      </NbSheet>
    </SafeAreaView>;
}
const styles = StyleSheet.create({
  macroCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 16
  },
  calNum: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 40,
    letterSpacing: -1,
    marginBottom: 14
  },
  calUnit: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    fontWeight: '600'
  },
  macroTiles: {
    flexDirection: 'row',
    gap: 8
  },
  tile: {
    flex: 1,
    borderWidth: nb.borderWidthDivider,
    borderRadius: borderRadius.nbCard,
    padding: 10,
    alignItems: 'flex-start',
    gap: 6
  },
  tileValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    fontVariant: ['tabular-nums']
  },
  tileLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12
  },
  servingCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14
  },
  servingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  servingLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1
  },
  servingSizeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    marginTop: 4
  },
  servingDivider: {
    height: nb.borderWidthDivider,
    opacity: 0.35,
    marginVertical: 12
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 10
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stepValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    minWidth: 36,
    textAlign: 'center',
    fontVariant: ['tabular-nums']
  },
  editServingPill: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center'
  },
  editServingText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.2,
    marginBottom: 10
  },
  mealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18
  },
  mealChip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  nutrientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  nutrientCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 14
  },
  nutrientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: nb.borderWidthDivider,
    borderBottomColor: 'rgba(128,128,128,0.25)'
  },
  nutrientNested: {
    paddingLeft: 14
  },
  nutrientLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14
  },
  nutrientValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
    fontVariant: ['tabular-nums']
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: 8
  },
  editHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18
  },
  fieldBlock: {
    marginBottom: 12
  },
  fieldLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
    marginBottom: 6
  },
  fieldInput: {
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    fontFamily: 'SpaceGrotesk_700Bold'
  }
});