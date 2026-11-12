// Design Law delete confirm — names exactly what goes; Keep first (screens/ai-coach-popups/15).
// Flow: describe the entry → Keep (ghost) / Delete (fill).
// Used by: ConfirmActionPopup when tool = deleteLog.

import React from 'react';
import { Text } from 'react-native';
import { ToolModalBody, DetailRow, ConfirmCancelRow, usePopupColors } from './sharedPopupParts';
import { spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to delete an entry';
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
const WARNING = 'This cannot be undone.';

// ===== HELPERS =====

function buildDeleteConfirmTitle(logType, isDeleteAll, foodName) {
  if (logType !== 'nutrition') {
    const typeLabel = LOG_TYPE_LABELS[logType] || logType;
    return `Clear your ${typeLabel}?`;
  }
  if (isDeleteAll) return 'Delete all food logs for this day?';
  if (foodName) return `Delete "${foodName}" from your log?`;
  return 'Delete your most recent food entry?';
}

function readDeletePopupContext(params) {
  const logType = String(params?.logType || DEFAULT_LOG_TYPE).toLowerCase();
  const logDate = params?.date || DEFAULT_DATE_LABEL;
  const foodName = params?.foodName || params?.food;
  const isDeleteAll = Boolean(params?.deleteAll || params?.all);
  const title = buildDeleteConfirmTitle(logType, isDeleteAll, foodName);
  return { logType, logDate, foodName, isDeleteAll, title };
}

// ===== MAIN FUNCTION =====

export default function ConfirmDeletePopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const colors = usePopupColors();
  const deleteContext = readDeletePopupContext(params);
  const typeLabel = LOG_TYPE_LABELS[deleteContext.logType] || deleteContext.logType;

  return (
    <ToolModalBody title={deleteContext.title} badge={BADGE} reasoning={reasoning}>
      <DetailRow label="Type" value={typeLabel} />
      {deleteContext.foodName ? <DetailRow label="Food" value={deleteContext.foodName} /> : null}
      <DetailRow label="Date" value={deleteContext.logDate} />
      <Text
        style={{
          marginBottom: spacing.md,
          fontSize: 13,
          fontWeight: '800',
          color: colors.nbMuted,
        }}
      >
        {WARNING}
      </Text>
      {/* Design Law: Keep first on the left, Delete on the fill side */}
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        cancelLabel="Keep"
        confirmLabel="Delete"
      />
    </ToolModalBody>
  );
}
