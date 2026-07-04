/**
 * Edit Serving Modal
 *
 * Purpose: UI screen or component: Edit Serving Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: EditServingModal
 *
 * @file-header
 */
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
import GradientFieldFrame from '../components/GradientFieldFrame';

const ACCENT_PINK = '#FF6B9D';
const ACCENT_PURPLE = '#8B5CF6';

function theme(isDark) {
  return {
    cardBg: isDark ? '#1A1A24' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#0A0A0F',
    muted: isDark ? '#A6A6A6' : '#666666',
    dim: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)',
    inputFill: isDark ? '#12121A' : '#F5F5F5',
    cancelBorder: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(10,10,15,0.12)',
    cancelBg: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  };
}

/**
 * Slim “Edit serving” dialog for a food log — gradient accents, compact fields.
 */
export default function EditServingModal({
  visible,
  foodName,
  quantityLabel = 'Quantity (servings)',
  amountLabel = 'Amount (oz)',
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
  const t = theme(isDark);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.backdropWrap}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
          <LinearGradient
            colors={isDark ? ['#6D62CE', '#9468A8', '#4F87BA'] : ['#7D72D4', '#9E72A4', '#5F92C4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            locations={[0, 0.5, 1]}
            style={styles.cardRing}
          >
            <View style={[styles.cardInner, { backgroundColor: t.cardBg }]}>
              <Text style={[styles.title, { color: t.text }]}>Edit serving</Text>
              <Text style={[styles.foodName, { color: t.muted }]} numberOfLines={2}>
                {foodName}
              </Text>

              <View style={styles.fieldBlock}>
                <Text style={[styles.label, { color: t.muted }]}>{quantityLabel}</Text>
                <GradientFieldFrame isDark={isDark}>
                  <TextInput
                    style={[styles.input, { backgroundColor: t.inputFill, color: t.text }]}
                    value={quantityValue}
                    onChangeText={onQuantityChange}
                    keyboardType="decimal-pad"
                    placeholder={quantityPlaceholder}
                    placeholderTextColor={t.dim}
                  />
                </GradientFieldFrame>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.label, { color: t.muted }]}>{amountLabel}</Text>
                <GradientFieldFrame isDark={isDark}>
                  <TextInput
                    style={[styles.input, { backgroundColor: t.inputFill, color: t.text }]}
                    value={amountValue}
                    onChangeText={onAmountChange}
                    keyboardType="decimal-pad"
                    placeholder={amountPlaceholder}
                    placeholderTextColor={t.dim}
                  />
                </GradientFieldFrame>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={onCancel}
                  activeOpacity={0.85}
                  style={[
                    styles.cancelBtn,
                    {
                      backgroundColor: t.cancelBg,
                      borderColor: t.cancelBorder,
                    },
                  ]}
                >
                  <Text style={[styles.cancelText, { color: t.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onSave} activeOpacity={0.9} style={styles.saveWrap}>
                  <LinearGradient
                    colors={[ACCENT_PINK, ACCENT_PURPLE]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
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
    padding: 1.5,
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
    borderWidth: 1,
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
