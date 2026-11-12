// Design Law report-options sheet — export / share / settings rows (progress PNG).
// Flow: NbSheet chrome → icon-chip rows → export closes sheet. Theme toggle kept for app mode.
// Used by WeeklyReportBody when the header “…” opens.

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import NbSheet from '../../look-and-feel/NbSheet';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const WORKOUT_ICON = require('../../assets/icons/handoff/muscle.png');
const PEOPLE_ICON = require('../../assets/icons/handoff/people.png');
const SETTINGS_ICON = require('../../assets/icons/handoff/settings.png');

// ===== HELPER FUNCTIONS =====

function playSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

function OptionRow({ icon, title, subtitle, index, onPress, colors, testID }) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        playSelectionHaptic();
        onPress?.();
      }}
      style={[
        styles.row,
        { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
      ]}
    >
      <NbIconChip source={icon} index={index} size={40} colors={accentGradients[index % accentGradients.length]} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onExport: Function,
 *   trainerName?: string,
 * }} props
 */
export function ReportOptionsPopup({ visible, onClose, onExport, trainerName = 'your trainer' }) {
  const { colors, mode, toggle } = useTheme();
  const themeLabel = mode === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <NbSheet visible={visible} onClose={onClose} title="Report options">
      <View style={styles.stack}>
        <OptionRow
          icon={WORKOUT_ICON}
          index={0}
          title="Export weekly report"
          subtitle="PDF for this week"
          colors={colors}
          testID="sheet-export"
          onPress={() => {
            onExport?.();
            onClose?.();
          }}
        />
        <OptionRow
          icon={PEOPLE_ICON}
          index={3}
          title="Share with your trainer"
          subtitle={trainerName}
          colors={colors}
          testID="sheet-digest"
          onPress={() => {
            onExport?.();
            onClose?.();
          }}
        />
        <OptionRow
          icon={SETTINGS_ICON}
          index={6}
          title="Report settings"
          subtitle={`Colors and what to show · ${themeLabel}`}
          colors={colors}
          testID="theme-toggle"
          onPress={() => toggle()}
        />
        <Pressable
          testID="sheet-close"
          onPress={onClose}
          style={[styles.done, { borderColor: colors.border, backgroundColor: colors.soft }]}
        >
          <Text style={[styles.doneText, { color: colors.textPrimary }]}>Done</Text>
        </Pressable>
      </View>
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.sm + 2,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.sm + 4,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    minHeight: nb.minTouchTarget + 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
  },
  done: {
    marginTop: spacing.sm,
    minHeight: nb.buttonMinHeight,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
