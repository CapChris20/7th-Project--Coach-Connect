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
 * Human title for the delete modal — nutrition can mean one food, all foods, or the latest entry.
 * @param {string} logType
 * @param {boolean} isDeleteAll
 * @param {string|undefined} foodName
 * @returns {string}
 */
function buildDeleteConfirmTitle(logType, isDeleteAll, foodName) {
  const isNutritionLog = logType === 'nutrition';
  if (!isNutritionLog) {
    const typeLabel = LOG_TYPE_LABELS[logType] || logType;
    return `Clear your ${typeLabel}?`;
  }
  if (isDeleteAll) return 'Delete all food logs for this day?';
  if (foodName) return `Delete "${foodName}" from your log?`;
  return 'Delete your most recent food entry?';
}

/**
 * @param {object|undefined} params
 * @returns {{ logType: string, logDate: string, foodName: string|undefined, isDeleteAll: boolean, title: string }}
 */
function readDeletePopupContext(params) {
  const logType = String(params?.logType || DEFAULT_LOG_TYPE).toLowerCase();
  const logDate = params?.date || DEFAULT_DATE_LABEL;
  const foodName = params?.foodName || params?.food;
  const isDeleteAll = Boolean(params?.deleteAll || params?.all);
  const title = buildDeleteConfirmTitle(logType, isDeleteAll, foodName);
  return { logType, logDate, foodName, isDeleteAll, title };
}

// ===== MAIN FUNCTION =====

/**
 * Modal before deleteLog runs — shows what row type and date will be cleared.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function ConfirmDeletePopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read what to delete (food name, whole day, or one log type).
  const deleteContext = readDeletePopupContext(params);
  const typeLabel = LOG_TYPE_LABELS[deleteContext.logType] || deleteContext.logType;
  const reasoningText = reasoning || DEFAULT_REASONING;
  let foodRow = null;
  if (deleteContext.foodName) {
    foodRow = <DetailRow label="Food" value={deleteContext.foodName} />;
  }

  // 2. Confirm deletes. onConfirm still gets the original params.

  const handleConfirmDelete = () => onConfirm(params);

  return (
    <ToolModalBody title={deleteContext.title} reasoning={reasoningText}>
      <DetailRow label="Type" value={typeLabel} />
      {foodRow}
      <DetailRow label="Date" value={deleteContext.logDate} />
      <ConfirmCancelRow
        onConfirm={handleConfirmDelete}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Delete"
      />
    </ToolModalBody>
  );
}
