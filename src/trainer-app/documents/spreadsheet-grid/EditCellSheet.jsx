// Edit cell bottom sheet modal for the spreadsheet editor.
// Flow: tap cell or "Edit cell" button → sheet opens with current value → edit value/type → save cell.
// Used by: SpreadsheetEditor.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { nb, borderRadius, spacing } from '../../../look-and-feel/colorPalette';
import { FORMAT_TYPE_NUMBER, FORMAT_TYPE_TEXT } from './cellFormatting';

// ===== NAMED CONSTANTS =====

const TITLE_EDIT_CELL = 'Edit cell';
const LABEL_VALUE = 'VALUE';
const BUTTON_CANCEL = 'Cancel';
const BUTTON_SAVE_CELL = 'Save cell';
const CHIP_NUMBER = 'Number';
const CHIP_TEXT = 'Text';

// ===== HELPER FUNCTIONS =====

/**
 * Format chip toggle button.
 */
function FormatTypeChip({ label, isSelected, themeColors, onSelectChip }) {
  const chipBgColor = isSelected ? themeColors.activePillBg : themeColors.surface;
  const chipTextColor = isSelected ? themeColors.activePillText : themeColors.text;
  const chipBorderColor = themeColors.border;

  return (
    <TouchableOpacity
      onPress={onSelectChip}
      activeOpacity={0.8}
      style={[
        styles.chipButton,
        {
          backgroundColor: chipBgColor,
          borderColor: chipBorderColor,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: chipTextColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Edit cell modal bottom sheet.
 * Flow: 1. read current cell info  2. sync local state  3. save and close handlers
 * @param {{
 *   visible: boolean,
 *   cellCoordinateLabel: string,
 *   currentValue: string,
 *   currentFormat: string,
 *   isDark: boolean,
 *   onClose: Function,
 *   onSaveCell: Function,
 * }} props
 */
export default function EditCellSheet({
  visible,
  cellCoordinateLabel,
  currentValue,
  currentFormat,
  isDark,
  onClose,
  onSaveCell,
}) {
  const [typedValue, setTypedValue] = useState('');
  const [selectedFormat, setSelectedFormat] = useState(FORMAT_TYPE_TEXT);

  // Sync state whenever sheet opens
  useEffect(() => {
    if (visible) {
      setTypedValue(String(currentValue || ''));
      setSelectedFormat(currentFormat || FORMAT_TYPE_TEXT);
    }
  }, [visible, currentValue, currentFormat]);

  // Color tokens based on dark/light mode
  const themeColors = {
    overlay: 'rgba(0, 0, 0, 0.55)',
    surface: isDark ? '#121212' : '#FFFFFF',
    text: isDark ? '#FFFFFF' : '#000000',
    textMuted: isDark ? '#9E9E9E' : '#666666',
    border: isDark ? '#FFFFFF' : '#000000',
    handle: isDark ? '#555555' : '#CCCCCC',
    inputBg: isDark ? '#1C1C1E' : '#FFFFFF',
    activePillBg: isDark ? '#FFFFFF' : '#000000',
    activePillText: isDark ? '#000000' : '#FFFFFF',
    saveButtonBg: isDark ? '#FFFFFF' : '#000000',
    saveButtonText: isDark ? '#000000' : '#FFFFFF',
  };

  const handleSavePressed = () => {
    // 1. Send updated value and format back to parent
    onSaveCell(typedValue, selectedFormat);
    // 2. Close sheet
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { backgroundColor: themeColors.overlay }]}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetContainer}
        >
          <View style={[styles.sheetCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            {/* Top drag handle indicator */}
            <View style={styles.handleWrapper}>
              <View style={[styles.handleBar, { backgroundColor: themeColors.handle }]} />
            </View>

            {/* Header info */}
            <View style={styles.headerBlock}>
              <Text style={[styles.titleText, { color: themeColors.text }]}>{TITLE_EDIT_CELL}</Text>
              {cellCoordinateLabel ? (
                <Text style={[styles.subtitleText, { color: themeColors.textMuted }]}>
                  {cellCoordinateLabel}
                </Text>
              ) : null}
            </View>

            {/* Value Section */}
            <View style={styles.contentBlock}>
              <Text style={[styles.eyebrowLabel, { color: themeColors.textMuted }]}>{LABEL_VALUE}</Text>
              <TextInput
                style={[
                  styles.valueInput,
                  {
                    backgroundColor: themeColors.inputBg,
                    color: themeColors.text,
                    borderColor: themeColors.border,
                  },
                ]}
                value={typedValue}
                onChangeText={setTypedValue}
                placeholder="e.g. 3×8 @ 140"
                placeholderTextColor={themeColors.textMuted}
                autoFocus={true}
                autoCorrect={false}
                autoCapitalize="none"
              />

              {/* Format selection chips */}
              <View style={styles.chipRow}>
                <FormatTypeChip
                  label={CHIP_NUMBER}
                  isSelected={selectedFormat === FORMAT_TYPE_NUMBER}
                  themeColors={themeColors}
                  onSelectChip={() => setSelectedFormat(FORMAT_TYPE_NUMBER)}
                />
                <FormatTypeChip
                  label={CHIP_TEXT}
                  isSelected={selectedFormat === FORMAT_TYPE_TEXT}
                  themeColors={themeColors}
                  onSelectChip={() => setSelectedFormat(FORMAT_TYPE_TEXT)}
                />
              </View>
            </View>

            {/* Action buttons at bottom */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={onClose}
                activeOpacity={0.8}
                style={[
                  styles.cancelButton,
                  {
                    backgroundColor: themeColors.surface,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.buttonLabel, { color: themeColors.text }]}>{BUTTON_CANCEL}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSavePressed}
                activeOpacity={0.8}
                style={[
                  styles.saveButton,
                  {
                    backgroundColor: themeColors.saveButtonBg,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                <Text style={[styles.buttonLabel, { color: themeColors.saveButtonText }]}>
                  {BUTTON_SAVE_CELL}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetContainer: {
    width: '100%',
  },
  sheetCard: {
    width: '100%',
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  handleBar: {
    width: 44,
    height: 5,
    borderRadius: 3,
  },
  headerBlock: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  subtitleText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  contentBlock: {
    marginBottom: spacing.lg,
  },
  eyebrowLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  valueInput: {
    borderWidth: 2,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
  },
  chipButton: {
    borderWidth: 2,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
});
