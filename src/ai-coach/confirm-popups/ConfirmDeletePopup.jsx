// Design Law delete-entry confirm — InfoTable + Cannot-be-undone pill (screens/ai-coach-popups delete).
// Flow: name the entry → Keep it (ghost) / Delete (fill).
// Used by: ConfirmActionPopup when tool = deleteLog.

import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ToolModalBody,
  InfoTable,
  ConfirmCancelRow,
  usePopupColors,
} from './sharedPopupParts';
import { accentGradients, spacing, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to delete an entry';
const TITLE = 'Delete this entry?';
// Manipulate here: warn pill uses coral→red (same family as DeleteChatSheet)
const WARN_GRADIENT = accentGradients[1] || ['#FB7185', '#EF4444'];

const LOG_TYPE_LABELS = {
  nutrition: 'Food / nutrition entry',
  sleep: 'Sleep log',
  water: 'Water log',
  steps: 'Step count',
  energy: 'Energy rating',
  mood: 'Mood log',
  workout: 'Workout entry',
  restDay: 'Rest day entry',
};
const DEFAULT_LOG_TYPE = 'nutrition';
const DEFAULT_DATE_LABEL = 'Today';

// ===== HELPERS =====

function readDeletePopupContext(params) {
  const logType = String(params?.logType || DEFAULT_LOG_TYPE).toLowerCase();
  const logDate = params?.date || DEFAULT_DATE_LABEL;
  const foodName = params?.foodName || params?.food;
  const isDeleteAll = Boolean(params?.deleteAll || params?.all);
  return { logType, logDate, foodName, isDeleteAll };
}

// ===== MAIN FUNCTION =====

export default function ConfirmDeletePopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const colors = usePopupColors();
  const deleteContext = readDeletePopupContext(params);
  const typeLabel = LOG_TYPE_LABELS[deleteContext.logType] || deleteContext.logType;

  const rows = [
    deleteContext.foodName
      ? { label: 'Food', value: String(deleteContext.foodName) }
      : null,
    { label: 'Type', value: typeLabel },
    { label: 'Date', value: String(deleteContext.logDate) },
  ].filter(Boolean);

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <InfoTable rows={rows} />
      {/* Design Law: coral “Cannot be undone” pill before the actions */}
      <View style={[styles.warnPill, { borderColor: colors.nbBorder }]}>
        <LinearGradient
          colors={WARN_GRADIENT}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.warnFill}
        >
          <Text style={styles.warnText}>Cannot be undone</Text>
        </LinearGradient>
      </View>
      {/* Keep it first on the left — matches DeleteChatSheet + PNG delete entry */}
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        cancelLabel="Keep it"
        confirmLabel="Delete"
      />
    </ToolModalBody>
  );
}

const styles = StyleSheet.create({
  warnPill: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidthPill || nb.borderWidth,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  warnFill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  warnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0A0A0A',
  },
});
