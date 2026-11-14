// Design Law Edit serving sheet (PNG 15/16) — grams, quantity, and optional unit.
// Flow: parent opens sheet → edit fields → Done / Cancel. Prefer NbSheet over Alert.
// Used by DailyLogContent when editing a logged food amount.
// Read order: constants → field helpers → EditServingPopup numbered steps → styles.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== NAMED CONSTANTS =====

const SHEET_TITLE = 'Edit serving';
const DEFAULT_QUANTITY_LABEL = 'QUANTITY (SERVINGS)';
const DEFAULT_AMOUNT_LABEL = 'SERVING SIZE (G PER SERVING)';
const UNIT_FIELD_LABEL = 'SERVING UNIT';
const CANCEL_BUTTON_LABEL = 'Cancel';
const SAVE_BUTTON_LABEL = 'Done editing nutrition';
const HINT_WITHOUT_FOOD = 'Use this when the package says something different.';
const DEFAULT_KEYBOARD = 'decimal-pad';
const UNIT_KEYBOARD = 'default';
// Manipulate here: vertical gap between labeled fields
const FIELD_BOTTOM_GAP = 12;
// Manipulate here: space above Cancel / Done row
const ACTIONS_TOP_GAP = 16;
const ACTIONS_ROW_GAP = 10;

// ===== HELPER FUNCTIONS =====

/**
 * Hint line under the sheet title. Prefixed with the food name when we have one.
 * @param {string|undefined} foodName
 * @returns {string}
 */
function buildEditServingHintCopy(foodName) {
  const hasFoodName = Boolean(foodName);
  if (hasFoodName) return `${foodName}. ${HINT_WITHOUT_FOOD}`;
  return HINT_WITHOUT_FOOD;
}

/**
 * One labeled TextInput row — shared by grams, quantity, and optional unit.
 */
function ServingEditField({
  label,
  value,
  onChangeText,
  placeholder,
  colors,
  keyboardType = DEFAULT_KEYBOARD,
}) {
  const labelStyle = [styles.label, { color: colors.nbMuted }];
  const inputStyle = [
    styles.input,
    {
      borderColor: colors.nbBorder,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
    },
  ];

  return (
    <View style={{ marginBottom: FIELD_BOTTOM_GAP }}>
      <Text style={labelStyle}>{label}</Text>
      <TextInput
        style={inputStyle}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.nbMuted}
      />
    </View>
  );
}

function EditServingHint({ foodName, mutedColor }) {
  const hintCopy = buildEditServingHintCopy(foodName);
  return <Text style={[styles.hint, { color: mutedColor }]}>{hintCopy}</Text>;
}

function CancelAndDoneRow({ onCancel, onSave }) {
  return (
    <View style={{ flexDirection: 'row', gap: ACTIONS_ROW_GAP, marginTop: ACTIONS_TOP_GAP }}>
      <View style={{ flex: 1 }}>
        <NbButton variant="plain" onPress={onCancel}>
          {CANCEL_BUTTON_LABEL}
        </NbButton>
      </View>
      <View style={{ flex: 1 }}>
        <NbButton onPress={onSave}>{SAVE_BUTTON_LABEL}</NbButton>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet to edit grams / quantity / optional unit for a logged food.
 * @param {object} props - sheet visibility, field values, and Cancel / Done handlers
 */
export default function EditServingPopup({
  visible,
  foodName,
  quantityLabel = DEFAULT_QUANTITY_LABEL,
  amountLabel = DEFAULT_AMOUNT_LABEL,
  quantityValue,
  amountValue,
  onQuantityChange,
  onAmountChange,
  quantityPlaceholder,
  amountPlaceholder,
  onCancel,
  onSave,
  unitValue,
  onUnitChange,
}) {
  // 1. Pull theme tokens for inputs and helper copy.
  // vocab: useTheme = Design Law light/dark color bag (nbInk, nbMuted, nbBorder, …)
  const { colors } = useTheme();

  // 2. Parent may omit unit editing — only show the unit row when a handler exists.
  const parentHandlesUnit = typeof onUnitChange === 'function';
  const unitFieldValue = unitValue || '';

  // 3. Name the optional unit field element before JSX (no nested ternary in the tree).
  let unitFieldElement = null;
  if (parentHandlesUnit) {
    unitFieldElement = (
      <ServingEditField
        label={UNIT_FIELD_LABEL}
        value={unitFieldValue}
        onChangeText={onUnitChange}
        colors={colors}
        keyboardType={UNIT_KEYBOARD}
      />
    );
  }

  // 4. Sheet: hint → serving size → quantity → optional unit → Cancel / Done.
  return (
    <NbSheet visible={visible} onClose={onCancel} title={SHEET_TITLE}>
      <EditServingHint foodName={foodName} mutedColor={colors.nbMuted} />

      <ServingEditField
        label={amountLabel}
        value={amountValue}
        onChangeText={onAmountChange}
        placeholder={amountPlaceholder}
        colors={colors}
      />
      <ServingEditField
        label={quantityLabel}
        value={quantityValue}
        onChangeText={onQuantityChange}
        placeholder={quantityPlaceholder}
        colors={colors}
      />
      {unitFieldElement}

      <CancelAndDoneRow onCancel={onCancel} onSave={onSave} />
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '900', letterSpacing: 1.1, marginBottom: 6 },
  input: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    minHeight: 48,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '700',
  },
});
