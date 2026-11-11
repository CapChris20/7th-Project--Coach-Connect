// Slim "Edit serving" dialog for a food log entry: quantity, amount, Cancel, Save.
// Flow: parent sets visible + field values → user edits → Save or Cancel (backdrop tap is Cancel).
// Used by: the food-details / daily-log serving editor.

import React from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ColorFieldFrame from '../food-cards/ColorFieldFrame';
import { lightColors, darkColors, nb, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Use neobrutalist gradients from tokens
const SAVE_GRADIENT = gradients.brand.colors;
const DEFAULT_QUANTITY_LABEL = 'Quantity (servings)';
const DEFAULT_AMOUNT_LABEL = 'Amount (oz)';
const GRADIENT_TOP_LEFT = { x: 0, y: 0 };
const GRADIENT_BOTTOM_RIGHT = { x: 1, y: 1 };
const GRADIENT_LEFT_CENTER = { x: 0, y: 0.5 };
const GRADIENT_RIGHT_CENTER = { x: 1, y: 0.5 };
const KEYBOARD_PAD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;

// ===== HELPER FUNCTIONS =====

/**
 * Dark vs light paint for the inner card, labels, and inputs.
 * @param {boolean} isDark
 */
function servingPopupColors(isDark) {
  const nbColors = isDark ? darkColors : lightColors;
  return {
    cardBackground: nbColors.nbSurface,
    text: nbColors.nbInk,
    muted: nbColors.nbMuted,
    dim: nbColors.nbMuted,
    inputFill: nbColors.nbSurfaceChip,
    cancelBorder: nbColors.nbBorder,
    cancelBackground: nbColors.nbSurfaceChip,
  };
}

/**
 * Outer ring uses neobrutalist ink gradient (purple→pink).
 * @param {boolean} isDark
 * @returns {string[]}
 */
function cardRingColors(isDark) {
  return gradients.ink.colors;
}

/**
 * One labeled number field inside a ColorFieldFrame.
 * Lives above the modal so the two fields share markup without duplicating the keyboard setup.
 */
function ServingNumberField({
  isDark,
  label,
  value,
  onChangeText,
  placeholder,
  mutedColor,
  dimColor,
  inputFill,
  textColor,
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <ColorFieldFrame isDark={isDark}>
        <TextInput
          style={[styles.input, { backgroundColor: inputFill, color: textColor }]}
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={dimColor}
        />
      </ColorFieldFrame>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Compact serving editor: servings + ounces, then Cancel / Save.
 * @param {{ visible: boolean, foodName: string, quantityLabel?: string, amountLabel?: string, quantityValue: string, amountValue: string, onQuantityChange: Function, onAmountChange: Function, quantityPlaceholder?: string, amountPlaceholder?: string, onCancel: Function, onSave: Function, isDark: boolean }} props
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
  isDark,
}) {
  const colors = servingPopupColors(isDark);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView behavior={KEYBOARD_PAD_BEHAVIOR} style={styles.flex}>
        <View style={styles.backdropWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
          <LinearGradient
            colors={cardRingColors(isDark)}
            start={GRADIENT_TOP_LEFT}
            end={GRADIENT_BOTTOM_RIGHT}
            style={styles.cardRing}
          >
            <View style={[styles.cardInner, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.title, { color: colors.text }]}>Edit serving</Text>
              <Text style={[styles.foodName, { color: colors.muted }]} numberOfLines={2}>
                {foodName}
              </Text>

              <ServingNumberField
                isDark={isDark}
                label={quantityLabel}
                value={quantityValue}
                onChangeText={onQuantityChange}
                placeholder={quantityPlaceholder}
                mutedColor={colors.muted}
                dimColor={colors.dim}
                inputFill={colors.inputFill}
                textColor={colors.text}
              />

              <ServingNumberField
                isDark={isDark}
                label={amountLabel}
                value={amountValue}
                onChangeText={onAmountChange}
                placeholder={amountPlaceholder}
                mutedColor={colors.muted}
                dimColor={colors.dim}
                inputFill={colors.inputFill}
                textColor={colors.text}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={onCancel}
                  activeOpacity={0.85}
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: colors.cancelBackground,
                      borderColor: colors.cancelBorder,
                    },
                  ]}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSave} activeOpacity={0.9} style={styles.saveWrap}>
                  <LinearGradient
                    colors={SAVE_GRADIENT}
                    start={GRADIENT_LEFT_CENTER}
                    end={GRADIENT_RIGHT_CENTER}
                    style={styles.saveBtn}
                  >
                    <Text style={styles.saveText}>Save</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdropWrap: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  cardRing: {
    borderRadius: 20,
    padding: nb.borderWidth,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  cardInner: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  foodName: {
    fontSize: 13,
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldBlock: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  input: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: nb.borderWidth,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
