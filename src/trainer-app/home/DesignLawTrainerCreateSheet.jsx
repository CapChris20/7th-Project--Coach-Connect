// Design Law “Create something” sheet — trainer home Tools launcher (PNG 09/10).
// Flow: Document maker / Spreadsheet creator tiles → sheet → parent opens editor with chosen starter.
// Used by TrainerHomeContent only. Copy and row order match mockups/trainer-home.html sheet `create`.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { nb, spacing } from '../../look-and-feel/colorPalette';
import { trainerHomeThemeColors } from './DesignLawTrainerHomeBlocks';

// ===== NAMED CONSTANTS =====

const ICON_CHECKIN = require('../../assets/icons/handoff/checkin.png');
const ICON_WEEK = require('../../assets/icons/handoff/week.png');
const ICON_WORKOUT = require('../../assets/icons/handoff/workout.png');

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

const SPREADSHEET_ROWS = [
  {
    id: 'blankGrid',
    title: 'Blank grid',
    subtitle: 'Start from empty cells',
    icon: ICON_WEEK,
    chipIndex: 9,
  },
  {
    id: 'customProgram',
    title: 'Custom program',
    subtitle: 'Weeks by days, with sets and reps',
    icon: ICON_WORKOUT,
    chipIndex: 0,
  },
];

/**
 * Starter grid for “Custom program” — one week row header + empty exercise rows.
 * vocab: rows = legacy 2D string array SpreadsheetEditor loads via firestoreToSheets({ rows }).
 * Manipulate here: column labels or blank row count.
 */
export function buildCustomProgramStarterRows() {
  return [
    ['Exercise', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sets', 'Reps'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
  ];
}

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   isDark: boolean,
 *   onRichText?: Function,
 *   onBlankGrid?: Function,
 *   onCustomProgram?: Function,
 * }} props
 */
export default function DesignLawTrainerCreateSheet({
  visible,
  onClose,
  isDark,
  onRichText,
  onBlankGrid,
  onCustomProgram,
}) {
  const themeColors = trainerHomeThemeColors(isDark);

  // Close sheet first, then run parent navigation so two modals never stack.
  const run = (id) => {
    onClose?.();
    setTimeout(() => {
      if (id === 'richText') onRichText?.();
      else if (id === 'blankGrid') onBlankGrid?.();
      else if (id === 'customProgram') onCustomProgram?.();
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
      {/* PNG 09/10: section eyebrows (`.eyb`) then list rows — no outer card frame */}
      <View style={styles.block}>
        <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>Document maker</Text>
        <View style={styles.list}>
          {DOCUMENT_ROWS.map((row, index) =>
            renderRow(row, index === DOCUMENT_ROWS.length - 1),
          )}
        </View>
      </View>

      <View
        style={[
          styles.block,
          styles.blockGap,
          { borderTopColor: themeColors.cardBorder },
        ]}
      >
        <Text style={[styles.eyebrow, { color: themeColors.textMuted }]}>Spreadsheet creator</Text>
        <View style={styles.list}>
          {SPREADSHEET_ROWS.map((row, index) =>
            renderRow(row, index === SPREADSHEET_ROWS.length - 1),
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
