// Small save-state badge (dot + label) in the document editor header.
// Flow: parent passes a status string → look up its label and dot → render the pill.
// Used by the document and spreadsheet editor headers so save state stays visible.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { EditorGradientDot } from './editorAccent';

// ===== NAMED CONSTANTS =====

const SAVE_STATUS_IDLE = 'idle';
const SAVE_STATUS_SAVED = 'saved';
const SAVE_STATUS_SAVING = 'saving';
const SAVE_STATUS_UNSAVED = 'unsaved';
const SAVE_STATUS_OFFLINE = 'offline';
// Amber stays fixed so "offline" reads as a warning in both light and dark themes.
const OFFLINE_DOT_COLOR = '#f59e0b';

// ===== HELPER FUNCTIONS =====

/**
 * Status to label, dot color, and whether the dot is the animated gradient.
 * Unknown statuses use Draft so a typo still renders a pill instead of crashing.
 * Theme colors are read here because idle, saved, and saving follow light and dark.
 * @param {string} status
 * @param {object} theme
 * @returns {{ label: string, color: string|null, shouldUseGradientDot: boolean }}
 */
function appearanceForSaveStatus(status, theme) {
  const appearanceByStatus = {
    [SAVE_STATUS_IDLE]: { label: 'Draft', color: theme.textMuted, shouldUseGradientDot: false },
    [SAVE_STATUS_SAVED]: { label: 'All changes saved', color: theme.success, shouldUseGradientDot: false },
    [SAVE_STATUS_SAVING]: { label: 'Saving…', color: theme.warning, shouldUseGradientDot: false },
    [SAVE_STATUS_UNSAVED]: { label: 'Edited', color: null, shouldUseGradientDot: true },
    [SAVE_STATUS_OFFLINE]: { label: 'Saved locally', color: OFFLINE_DOT_COLOR, shouldUseGradientDot: false },
  };
  return appearanceByStatus[status] || appearanceByStatus[SAVE_STATUS_IDLE];
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
  const { label, color, shouldUseGradientDot } = appearanceForSaveStatus(status, theme);
  return (
    <View style={styles.pill}>
      {/* Unsaved edits use the gradient dot. Every other state is a flat dot in the status color. */}
      {shouldUseGradientDot ? (
        <EditorGradientDot size={6} />
      ) : (
        <View style={[styles.dot, { backgroundColor: color }]} />
      )}
      {/* The dot carries the urgency. The words stay muted so the header does not shout. */}
      <Text style={[styles.text, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

// Manipulate here: gap is the dot-to-text space. height: 28 lines the pill up with the other header controls.
// The dot stays round only if borderRadius is half of width and height.
const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, height: 28 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
