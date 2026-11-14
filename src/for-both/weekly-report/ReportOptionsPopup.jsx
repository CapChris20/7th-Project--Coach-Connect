// Report-options bottom sheet — export / share / theme rows for the weekly report.
// Flow: NbSheet chrome → haptic rows → export closes sheet → theme toggle stays open.
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

// Manipulate here: accent slots for the three option rows (Design Law handoff cycle)
const EXPORT_GRADIENT_INDEX = 0;
const SHARE_GRADIENT_INDEX = 3;
const SETTINGS_GRADIENT_INDEX = 6;

const DARK_MODE_NAME = 'dark';
const CHEVRON_ICON_SIZE = 18;

// ===== MAIN FUNCTION =====

/**
 * Options sheet for one weekly report (export, share, theme).
 * Flow: 1. theme labels  2. export+close handler  3. theme toggle  4. sheet rows
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onExport: Function,
 *   trainerName?: string,
 * }} props
 */
export function ReportOptionsPopup({
  visible,
  onClose,
  onExport,
  trainerName = 'your trainer',
}) {
  // vocab: useTheme = { colors, mode, toggle } for in-app light/dark (not system auto alone)
  const { colors, mode, toggle } = useTheme();

  // 1. Labels that track the in-app light/dark toggle.
  let themeLabel = 'Light mode';
  if (mode === DARK_MODE_NAME) {
    themeLabel = 'Dark mode';
  }
  const settingsSubtitle = `Colors and what to show · ${themeLabel}`;

  // 2. Export and share both run export then dismiss — sheet must not sit over the PDF flow.
  const runExportAndClose = () => {
    if (typeof onExport === 'function') {
      onExport();
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  // 3. Settings row flips theme and leaves the sheet open so the user can see the change.
  const flipThemeAndStayOpen = () => {
    toggle();
  };

  // 4. Done button surface named before JSX.
  const doneButtonStyle = [
    styles.done,
    { borderColor: colors.border, backgroundColor: colors.soft },
  ];
  const doneLabelStyle = [styles.doneText, { color: colors.textPrimary }];

  return (
    <NbSheet visible={visible} onClose={onClose} title="Report options">
      <View style={styles.stack}>
        <ReportOptionRow
          icon={WORKOUT_ICON}
          gradientIndex={EXPORT_GRADIENT_INDEX}
          title="Export weekly report"
          subtitle="PDF for this week"
          colors={colors}
          testID="sheet-export"
          onPress={runExportAndClose}
        />
        <ReportOptionRow
          icon={PEOPLE_ICON}
          gradientIndex={SHARE_GRADIENT_INDEX}
          title="Share with your trainer"
          subtitle={trainerName}
          colors={colors}
          testID="sheet-digest"
          onPress={runExportAndClose}
        />
        <ReportOptionRow
          icon={SETTINGS_ICON}
          gradientIndex={SETTINGS_GRADIENT_INDEX}
          title="Report settings"
          subtitle={settingsSubtitle}
          colors={colors}
          testID="theme-toggle"
          onPress={flipThemeAndStayOpen}
        />
        <Pressable testID="sheet-close" onPress={onClose} style={doneButtonStyle}>
          <Text style={doneLabelStyle}>Done</Text>
        </Pressable>
      </View>
    </NbSheet>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * One tappable option row: accent chip + title/subtitle + chevron.
 */
function ReportOptionRow({
  icon,
  title,
  subtitle,
  gradientIndex,
  onPress,
  colors,
  testID,
}) {
  const gradientCount = accentGradients.length;
  const safeGradientIndex = gradientIndex % gradientCount;
  const gradientColors = accentGradients[safeGradientIndex];

  const rowSurfaceStyle = [
    styles.row,
    { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
  ];
  const titleStyle = [styles.rowTitle, { color: colors.textPrimary }];
  const subtitleStyle = [styles.rowSub, { color: colors.textMuted }];

  const handlePress = () => {
    fireSelectionHaptic();
    if (typeof onPress === 'function') {
      onPress();
    }
  };

  return (
    <Pressable testID={testID} onPress={handlePress} style={rowSurfaceStyle}>
      <NbIconChip
        source={icon}
        index={gradientIndex}
        size={40}
        colors={gradientColors}
      />
      <View style={styles.rowText}>
        <Text style={titleStyle}>{title}</Text>
        <Text style={subtitleStyle}>{subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={CHEVRON_ICON_SIZE}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Light tap feedback. Ignore errors when haptics are unavailable (simulator / web).
 * vocab: Haptics.selectionAsync = Expo soft “tick” for selection changes
 */
function fireSelectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
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
