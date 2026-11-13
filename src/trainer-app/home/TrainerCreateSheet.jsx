// Design Law “Create something” sheet — trainer home Tools launcher (document maker only).
// Flow: Document maker tile → sheet → parent opens DocumentEditor.
// Used by TrainerHomeContent only. In-app SpreadsheetEditor is retired (use Google Sheets / upload).

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { spacing } from '../../look-and-feel/colorPalette';
import { trainerHomeThemeColors } from './TrainerHomeBlocks';

// ===== NAMED CONSTANTS =====

const ICON_CHECKIN = require('../../assets/icons/handoff/checkin.png');

// Manipulate here: delay after sheet dismiss before opening full-screen editor (ms)
const EDITOR_OPEN_DELAY_MS = 120;

const DOCUMENT_ROWS = [
  {
    id: 'richText',
    title: 'Rich-text editor',
    subtitle: 'Meal guides, intake forms, handouts',
    icon: ICON_CHECKIN,
    chipIndex: 6,
  },
];

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   isDark: boolean,
 *   onRichText?: Function,
 * }} props
 */
export default function TrainerCreateSheet({
  visible,
  onClose,
  isDark,
  onRichText,
}) {
  const themeColors = trainerHomeThemeColors(isDark);

  // Close sheet first, then run parent navigation so two modals never stack.
  const run = (id) => {
    onClose?.();
    setTimeout(() => {
      if (id === 'richText') onRichText?.();
    }, EDITOR_OPEN_DELAY_MS);
  };

  const renderRow = (row, isLastInBlock) => (
    <Pressable
      key={row.id}
      onPress={() => run(row.id)}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomWidth: isLastInBlock ? 0 : 2,
          borderBottomColor: themeColors.cardBorder,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={row.title}
    >
      <NbIconChip source={row.icon} index={row.chipIndex} size={44} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: themeColors.text }]}>{row.title}</Text>
        <Text style={[styles.rowSub, { color: themeColors.textMuted }]}>{row.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
    </Pressable>
  );

  return (
    <NbSheet visible={visible} onClose={onClose} title="Create something">
      <View style={styles.block}>
        <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>Document maker</Text>
        <View style={styles.list}>
          {DOCUMENT_ROWS.map((row, index) =>
            renderRow(row, index === DOCUMENT_ROWS.length - 1),
          )}
        </View>
      </View>
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  block: {
    width: '100%',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  list: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 64,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  rowSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
});
