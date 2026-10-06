// Confirm popup before the coach deletes a log.
// Flow: name the kind of log → build a title that matches one item or the whole day → confirm or cancel.
// Used by: the coach conversation when a tool wants to delete something.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

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
const DEFAULT_REASONING = 'This removes the entry from your app — you can always log it again.';

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} logType
 * @param {boolean} isDeleteAll
 * @param {string|undefined} foodName
 * @returns {string}
 */
function deleteTitle(logType, isDeleteAll, foodName) {
  if (logType !== 'nutrition') {
    return `Clear your ${LOG_TYPE_LABELS[logType] || logType}?`;
  }
  if (isDeleteAll) return 'Delete all food logs for this day?';
  if (foodName) return `Delete "${foodName}" from your log?`;
  return 'Delete your most recent food entry?';
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function ConfirmDeletePopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const logType = String(params?.logType || DEFAULT_LOG_TYPE).toLowerCase();
  const logDate = params?.date || DEFAULT_DATE_LABEL;
  const foodName = params?.foodName || params?.food;
  const isDeleteAll = Boolean(params?.deleteAll || params?.all);
  const title = deleteTitle(logType, isDeleteAll, foodName);

  return (
    <ToolModalBody title={title} reasoning={reasoning || DEFAULT_REASONING}>
      <DetailRow label="Type" value={LOG_TYPE_LABELS[logType] || logType} />
      {foodName ? <DetailRow label="Food" value={foodName} /> : null}
      <DetailRow label="Date" value={logDate} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Delete"
      />
    </ToolModalBody>
  );
}
