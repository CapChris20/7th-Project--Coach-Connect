// Small save-state badge (dot + label) in the document editor header.
// Flow: parent passes a status string → look up label + dot treatment → paint the pill.
// Used by document and spreadsheet editor headers so save state stays visible.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EditorGradientDot } from './editorAccent';

// ===== NAMED CONSTANTS =====

const SAVE_STATUS_IDLE = 'idle';
const SAVE_STATUS_SAVED = 'saved';
const SAVE_STATUS_SAVING = 'saving';
const SAVE_STATUS_UNSAVED = 'unsaved';
const SAVE_STATUS_OFFLINE = 'offline';

const LABEL_DRAFT = 'Draft';
const LABEL_SAVED = 'All changes saved';
const LABEL_SAVING = 'Saving…';
const LABEL_EDITED = 'Edited';
const LABEL_SAVED_LOCALLY = 'Saved locally';

// Amber stays fixed so "offline" reads as a warning in both light and dark themes.
const OFFLINE_DOT_COLOR = '#f59e0b';
// Manipulate here: gradient-dot size when the doc has unsaved edits.
const UNSAVED_GRADIENT_DOT_SIZE = 6;

// ===== HELPER FUNCTIONS =====

/**
 * Build the status → appearance table for the current theme.
 * Theme colors are read here because idle / saved / saving follow light and dark.
 * @param {object} theme
 * @returns {Record<string, { label: string, color: string|null, shouldUseGradientDot: boolean }>}
 */
function appearanceTableForTheme(theme) {
  return {
    [SAVE_STATUS_IDLE]: {
      label: LABEL_DRAFT,
      color: theme.textMuted,
      shouldUseGradientDot: false,
    },
    [SAVE_STATUS_SAVED]: {
      label: LABEL_SAVED,
      color: theme.success,
      shouldUseGradientDot: false,
    },
    [SAVE_STATUS_SAVING]: {
      label: LABEL_SAVING,
      color: theme.warning,
      shouldUseGradientDot: false,
    },
    [SAVE_STATUS_UNSAVED]: {
      label: LABEL_EDITED,
      color: null,
      shouldUseGradientDot: true,
    },
    [SAVE_STATUS_OFFLINE]: {
      label: LABEL_SAVED_LOCALLY,
      color: OFFLINE_DOT_COLOR,
      shouldUseGradientDot: false,
    },
  };
}

/**
 * Map one save-status string to the words and dot style the pill shows.
 * Unknown statuses fall back to Draft so a typo still renders instead of crashing.
 * @param {string} status
 * @param {object} theme
 * @returns {{ label: string, color: string|null, shouldUseGradientDot: boolean }}
 */
function appearanceForSaveStatus(status, theme) {
  const appearanceByStatus = appearanceTableForTheme(theme);
  const matchedAppearance = appearanceByStatus[status];
  if (!matchedAppearance) {
    return appearanceByStatus[SAVE_STATUS_IDLE];
  }
  return matchedAppearance;
}

/**
 * Flat colored circle for quiet states (draft / saved / saving / offline).
 * @param {string|null} dotColor
 * @returns {JSX.Element}
 */
function flatStatusDot(dotColor) {
  return <View style={[styles.dot, { backgroundColor: dotColor }]} />;
}

/**
 * Pick the animated gradient dot for unsaved, otherwise the flat colored circle.
 * @param {{ shouldUseGradientDot: boolean, color: string|null }} appearance
 * @returns {JSX.Element}
 */
function statusDotForAppearance(appearance) {
  if (appearance.shouldUseGradientDot) {
    return <EditorGradientDot size={UNSAVED_GRADIENT_DOT_SIZE} />;
  }
  return flatStatusDot(appearance.color);
}

// ===== MAIN FUNCTION =====

/**
 * Dot-and-label pill for the editor's current save state.
 * @param {object} props
 * @param {string} props.status One of idle, saved, saving, unsaved, offline.
 * @param {object} props.theme Theme colors for the quiet states.
 * @returns {JSX.Element}
 */
export default function SaveStatusLabel({ status, theme }) {
  // 1. Resolve label + which kind of dot this status uses.
  const appearance = appearanceForSaveStatus(status, theme);
  const statusDot = statusDotForAppearance(appearance);

  // 2. Paint the pill — muted words so the header does not shout.
  return (
    <View style={styles.pill}>
      {statusDot}
      <Text style={[styles.text, { color: theme.textMuted }]}>{appearance.label}</Text>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

// Manipulate here: gap = space between dot and words; height 28 lines up with sibling header controls.
// The dot stays round only if borderRadius is half of width and height.
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
