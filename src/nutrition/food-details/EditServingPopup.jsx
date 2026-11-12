// Design Law Edit serving sheet (PNG 15/16) — grams, quantity, unit.
// Flow: parent opens sheet → edit fields → Done / Cancel. Prefer NbSheet over Alert.
// Used by DailyLogContent when editing a logged food amount.

import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { borderRadius, nb } from '../../look-and-feel/colorPalette';
import { useTheme } from '../../look-and-feel/lightDarkMode';

// ===== MAIN FUNCTION =====

/**
 * @param {{ visible: boolean, foodName: string, quantityLabel?: string, amountLabel?: string, quantityValue: string, amountValue: string, onQuantityChange: Function, onAmountChange: Function, quantityPlaceholder?: string, amountPlaceholder?: string, onCancel: Function, onSave: Function, isDark?: boolean, unitValue?: string, onUnitChange?: Function }} props
 */
export default function EditServingPopup({
  visible,
  foodName,
  quantityLabel = 'QUANTITY (SERVINGS)',
  amountLabel = 'SERVING SIZE (G PER SERVING)',
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
  const { colors } = useTheme();

  return (
    <NbSheet visible={visible} onClose={onCancel} title="Edit serving">
      {foodName ? (
        <Text style={[styles.hint, { color: colors.nbMuted }]}>
          {foodName}. Use this when the package says something different.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.nbMuted }]}>
          Use this when the package says something different.
        </Text>
      )}

      <Field
        label={amountLabel}
        value={amountValue}
        onChangeText={onAmountChange}
        placeholder={amountPlaceholder}
        colors={colors}
      />
      <Field
        label={quantityLabel}
        value={quantityValue}
        onChangeText={onQuantityChange}
        placeholder={quantityPlaceholder}
        colors={colors}
      />
      {typeof onUnitChange === 'function' ? (
        <Field
          label="SERVING UNIT"
          value={unitValue || ''}
          onChangeText={onUnitChange}
          colors={colors}
          keyboardType="default"
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <NbButton variant="plain" onPress={onCancel}>
            Cancel
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton onPress={onSave}>Done editing nutrition</NbButton>
        </View>
      </View>
    </NbSheet>
  );
}

function Field({ label, value, onChangeText, placeholder, colors, keyboardType = 'decimal-pad' }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[styles.label, { color: colors.nbMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { borderColor: colors.nbBorder, color: colors.nbInk, backgroundColor: colors.nbSurface },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.nbMuted}
      />
    </View>
  );
}

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
