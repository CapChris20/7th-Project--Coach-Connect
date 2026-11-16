// Design Law “Create something” sheet — trainer home Tools launcher.
// Flow: sheet opens → trainer picks document or spreadsheet option → sheet closes → parent opens editor.
// Used by TrainerHomeContent only.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { spacing } from '../../look-and-feel/colorPalette';
import { trainerHomeThemeColors } from './TrainerHomeBlocks';

// ===== NAMED CONSTANTS =====

const ICON_CHECKIN = require('../../assets/icons/handoff/checkin.png');
const ICON_MUSCLE = require('../../assets/icons/handoff/muscle.png');
const ICON_WORKOUT = require('../../assets/icons/handoff/workout.png');

const EDITOR_OPEN_DELAY_MS = 120;

const ROW_ID_RICH_TEXT = 'richText';
const ROW_ID_BLANK_GRID = 'blankGrid';
const ROW_ID_CUSTOM_PROGRAM = 'customProgram';

const DOCUMENT_ROWS = [
  {
    id: ROW_ID_RICH_TEXT,
    title: 'Rich-text editor',
    subtitle: 'Meal guides, intake forms, handouts',
    icon: ICON_CHECKIN,
    chipIndex: 6,
  },
];

const SPREADSHEET_ROWS = [
  {
    id: ROW_ID_BLANK_GRID,
    title: 'Blank grid',
    subtitle: 'Start from empty cells',
    icon: ICON_MUSCLE,
    chipIndex: 9,
  },
  {
    id: ROW_ID_CUSTOM_PROGRAM,
    title: 'Custom program',
    subtitle: 'Weeks by days, with sets and reps',
    icon: ICON_WORKOUT,
    chipIndex: 0,
  },
];

const SHEET_TITLE = 'Create something';
const EYEBROW_DOCUMENT_MAKER = 'DOCUMENT MAKER';
const EYEBROW_SPREADSHEET_CREATOR = 'SPREADSHEET CREATOR';

// ===== HELPER FUNCTIONS =====

/**
 * One tappable row inside the creator list.
 */
function CreateSheetOptionRow({ row, isLastInBlock, themeColors, onRowPress }) {
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
 * Build row elements for a given section.
 */
function buildSectionRowElements(rowsList, themeColors, onRowPress) {
  const lastIndex = rowsList.length - 1;
  const rowElements = [];

  for (let index = 0; index < rowsList.length; index += 1) {
    const row = rowsList[index];
    const isLastInBlock = index === lastIndex;
    rowElements.push(
      <CreateSheetOptionRow
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
 * Bottom sheet that lists document and spreadsheet tools for the trainer.
 * Flow: 1. theme colors  2. handle tool selection  3. paint sheet sections
 *
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   isDark: boolean,
 *   onRichText?: Function,
 *   onBlankGrid?: Function,
 *   onCustomProgram?: Function,
 * }} props
 */
export default function TrainerCreateSheet({
  visible,
  onClose,
  isDark,
  onRichText,
  onBlankGrid,
  onCustomProgram,
}) {
  const themeColors = trainerHomeThemeColors(isDark);

  const openToolAfterSheetCloses = (rowId) => {
    // 1. Dismiss sheet so we never stack two full-screen modals
    onClose?.();

    // 2. Wait for sheet unmount animation, then trigger tool launcher
    setTimeout(() => {
      if (rowId === ROW_ID_RICH_TEXT) {
        onRichText?.();
        return;
      }
      if (rowId === ROW_ID_BLANK_GRID) {
        onBlankGrid?.();
        return;
      }
      if (rowId === ROW_ID_CUSTOM_PROGRAM) {
        onCustomProgram?.();
      }
    }, EDITOR_OPEN_DELAY_MS);
  };

  const documentElements = buildSectionRowElements(DOCUMENT_ROWS, themeColors, openToolAfterSheetCloses);
  const spreadsheetElements = buildSectionRowElements(SPREADSHEET_ROWS, themeColors, openToolAfterSheetCloses);

  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      {/* 1. Document Maker Section */}
      <View style={styles.block}>
        <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>{EYEBROW_DOCUMENT_MAKER}</Text>
        <View style={styles.list}>{documentElements}</View>
      </View>

      {/* 2. Spreadsheet Creator Section */}
      <View style={[styles.block, styles.blockGap, { borderTopColor: themeColors.cardBorder }]}>
        <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>{EYEBROW_SPREADSHEET_CREATOR}</Text>
        <View style={styles.list}>{spreadsheetElements}</View>
      </View>
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  block: {
    width: '100%',
  },
  blockGap: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
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
