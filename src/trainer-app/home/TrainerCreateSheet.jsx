// Design Law “Create something” sheet — trainer home Tools launcher (document maker only).
// Flow: sheet opens → trainer picks a row → sheet closes → parent opens DocumentEditor.
// Used by TrainerHomeContent only. SpreadsheetEditor retired (Google Sheets / upload).

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { spacing } from '../../look-and-feel/colorPalette';
import { trainerHomeThemeColors } from './TrainerHomeBlocks';

// ===== NAMED CONSTANTS =====

const ICON_CHECKIN = require('../../assets/icons/handoff/checkin.png');

// Manipulate here: ms to wait after NbSheet dismiss before opening the full-screen editor
// (stacking two modals flickers / traps focus on some phones)
const EDITOR_OPEN_DELAY_MS = 120;

const DOCUMENT_ROW_ID_RICH_TEXT = 'richText';

// Manipulate here: titles / subtitles shown in the Document maker block
const DOCUMENT_ROWS = [
  {
    id: DOCUMENT_ROW_ID_RICH_TEXT,
    title: 'Rich-text editor',
    subtitle: 'Meal guides, intake forms, handouts',
    icon: ICON_CHECKIN,
    chipIndex: 6,
  },
];

const SHEET_TITLE = 'Create something';
const BLOCK_EYEBROW = 'Document maker';

// ===== HELPER FUNCTIONS =====

/**
 * One tappable document-maker row inside the sheet list.
 * Why a separate piece: keeps the main sheet free of pressed-style math.
 */
function CreateSheetDocumentRow({ row, isLastInBlock, themeColors, onRowPress }) {
  // Decide border + pressed look before JSX (no nested ternaries in the tree).
  const bottomBorderWidth = isLastInBlock ? 0 : 2;
  const bottomBorderColor = themeColors.cardBorder;

  return (
    <Pressable
      onPress={() => onRowPress(row.id)}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomWidth: bottomBorderWidth,
          borderBottomColor: bottomBorderColor,
          // Manipulate here: pressed opacity for the row feedback
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
}

/**
 * Map DOCUMENT_ROWS into CreateSheetDocumentRow elements.
 * Kept as a helper so the main return stays a short checklist.
 */
function buildDocumentRowElements(themeColors, onRowPress) {
  const lastIndex = DOCUMENT_ROWS.length - 1;
  const rowElements = [];

  for (let index = 0; index < DOCUMENT_ROWS.length; index += 1) {
    const row = DOCUMENT_ROWS[index];
    const isLastInBlock = index === lastIndex;
    rowElements.push(
      <CreateSheetDocumentRow
        key={row.id}
        row={row}
        isLastInBlock={isLastInBlock}
        themeColors={themeColors}
        onRowPress={onRowPress}
      />,
    );
  }

  return rowElements;
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet that lists document-maker tools for the trainer home Tools grid.
 * Flow: 1. theme colors  2. dismiss then open tool  3. paint sheet
 *
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
  // vocab: trainerHomeThemeColors = B/W/gray token map shared with TrainerHomeBlocks
  const themeColors = trainerHomeThemeColors(isDark);

  /**
   * Close the sheet first, then open the chosen tool after a short delay.
   * Why delay: NbSheet must unmount before the parent pushes a full-screen editor.
   */
  const openToolAfterSheetCloses = (rowId) => {
    // 1. Dismiss sheet so we never stack two full-screen modals.
    onClose?.();

    // 2. Wait for NbSheet to finish unmounting, then call the parent navigation callback.
    setTimeout(() => {
      // 3. Only rich-text is live today; other ids are ignored on purpose.
      if (rowId === DOCUMENT_ROW_ID_RICH_TEXT) {
        onRichText?.();
      }
    }, EDITOR_OPEN_DELAY_MS);
  };

  // Named locals for JSX — name the decision before the tree.
  const documentRowElements = buildDocumentRowElements(themeColors, openToolAfterSheetCloses);
  const eyebrowStyle = [styles.eyebrow, { color: themeColors.textMuted }];

  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <View style={styles.block}>
        <Text style={eyebrowStyle}>{BLOCK_EYEBROW}</Text>
        <View style={styles.list}>{documentRowElements}</View>
      </View>
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
