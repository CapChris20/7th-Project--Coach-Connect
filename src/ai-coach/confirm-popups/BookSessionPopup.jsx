// Confirm popup before the coach books a session.
// Flow: read date, time, and duration → show notes → confirm or cancel.
// Used by: ConfirmActionPopup when the coach tool is bookSession.

import React from 'react';
import { ToolModalBody, InfoTable, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const MISSING_VALUE = '—';
const BADGE_COPY = 'Coach wants to book a session';
const TITLE_COPY = 'Book session?';
const CONFIRM_LABEL = 'Book';

// ===== HELPER FUNCTIONS =====

/**
 * First non-empty string among the listed param keys, or the missing dash.
 * @param {object} params
 * @param {string[]} keyNames
 * @returns {string}
 */
function firstStringFromParamKeys(params, keyNames) {
  if (!params) {
    return MISSING_VALUE;
  }

  for (let keyIndex = 0; keyIndex < keyNames.length; keyIndex += 1) {
    const keyName = keyNames[keyIndex];
    const rawValue = params[keyName];
    if (rawValue !== undefined && rawValue !== null && rawValue !== '') {
      return rawValue;
    }
  }

  return MISSING_VALUE;
}

/**
 * Duration minutes from several coach aliases. vocab: nullish checks keep a real 0.
 * @param {object} params
 * @returns {*|string}
 */
function readDurationRawFromParams(params) {
  if (!params) {
    return MISSING_VALUE;
  }

  if (params.durationMin !== undefined && params.durationMin !== null) {
    return params.durationMin;
  }
  if (params.durationMinutes !== undefined && params.durationMinutes !== null) {
    return params.durationMinutes;
  }
  if (params.duration !== undefined && params.duration !== null) {
    return params.duration;
  }

  return MISSING_VALUE;
}

/**
 * Pull date / time / duration / notes out of the coach tool params.
 * Prefer split sessionDate + sessionTime; fall back to a combined dateTime phrase.
 * @param {object} params
 * @returns {{ sessionDate: string, sessionTime: string, durationLabel: string, notes: *, combinedWhen: string|undefined }}
 */
function readSessionFieldsFromToolParams(params) {
  // 1. Split date and time (several key aliases the model has used).
  const sessionDate = firstStringFromParamKeys(params, ['sessionDate', 'date']);
  const sessionTime = firstStringFromParamKeys(params, ['sessionTime', 'time']);

  // 2. Duration — minutes number, or the missing dash.
  const durationRaw = readDurationRawFromParams(params);
  let durationLabel = MISSING_VALUE;
  if (durationRaw !== MISSING_VALUE) {
    durationLabel = `${durationRaw} min`;
  }

  let notes;
  if (params) {
    notes = params.notes;
  }

  // 3. Combined “When” when split Date/Time both missing but dateTime was sent.
  const splitDateAndTimeMissing =
    sessionDate === MISSING_VALUE && sessionTime === MISSING_VALUE;

  let combinedWhen;
  if (splitDateAndTimeMissing && params && params.dateTime) {
    combinedWhen = String(params.dateTime);
  }

  return { sessionDate, sessionTime, durationLabel, notes, combinedWhen };
}

/**
 * Rows for the bordered InfoTable — either “When” or Date + Time.
 * @param {object} displayFields
 * @returns {Array<{ label: string, value: * }>}
 */
function buildInfoTableRows(displayFields) {
  if (displayFields.combinedWhen) {
    return [
      { label: 'When', value: displayFields.combinedWhen },
      { label: 'Duration', value: displayFields.durationLabel },
      { label: 'Notes', value: displayFields.notes },
    ];
  }

  return [
    { label: 'Date', value: displayFields.sessionDate },
    { label: 'Time', value: displayFields.sessionTime },
    { label: 'Duration', value: displayFields.durationLabel },
    { label: 'Notes', value: displayFields.notes },
  ];
}

/**
 * Pure layout — no hooks. Confirm hands original params back.
 */
function BookSessionPopupLayout({
  displayFields,
  reasoning,
  onConfirm,
  onCancel,
  loading,
  originalParams,
}) {
  const infoRows = buildInfoTableRows(displayFields);

  function handleConfirmBook() {
    // 1. Hand the original tool params back — parent runs the book action as-is.
    onConfirm(originalParams);
  }

  return (
    <ToolModalBody badge={BADGE_COPY} title={TITLE_COPY} reasoning={reasoning}>
      {/* Design Law: one bordered InfoTable — combined “When” when split fields are blank */}
      <InfoTable rows={infoRows} />
      <ConfirmCancelRow
        onConfirm={handleConfirmBook}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Modal that asks the user to confirm booking a trainer session from a coach tool call.
 * No hooks — display only. Confirm still sends the original params object.
 * @param {{ params: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function BookSessionPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read date, time, duration, and notes for the session.
  const displayFields = readSessionFieldsFromToolParams(params);

  // 2. Render confirm / cancel; onConfirm still gets the original params object.
  return (
    <BookSessionPopupLayout
      displayFields={displayFields}
      reasoning={reasoning}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
      originalParams={params}
    />
  );
}
