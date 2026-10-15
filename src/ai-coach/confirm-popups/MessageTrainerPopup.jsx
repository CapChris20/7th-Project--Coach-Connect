// Confirm popup before the coach alerts the trainer.
// Flow: turn the issue type into words → show the message and severity → confirm or cancel.
// Used by: the coach conversation when a tool wants to message the trainer.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Alert your trainer?';
const TYPE_ROW_LABEL = 'Type';
const MESSAGE_ROW_LABEL = 'Message';
const SEVERITY_ROW_LABEL = 'Severity';
const CONFIRM_BUTTON_LABEL = 'Send';
const DEFAULT_ISSUE_LABEL = 'Check-in';
const DEFAULT_SEVERITY = 'medium';
const UNDERSCORE_PATTERN = /_/g;
const UNDERSCORE_REPLACEMENT = ' ';

// ===== HELPER FUNCTIONS =====

/**
 * Stored issue types use underscores. The popup shows spaces.
 * @param {object|undefined} params
 * @returns {string}
 */
function readIssueLabel(params) {
  if (!params || !params.issueType) return DEFAULT_ISSUE_LABEL;
  return String(params.issueType).replace(UNDERSCORE_PATTERN, UNDERSCORE_REPLACEMENT);
}

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readSeverityLabel(params) {
  if (!params || !params.severity) return DEFAULT_SEVERITY;
  return String(params.severity);
}

function readAlertMessage(params) {
  if (!params) return undefined;
  return params.message;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm sending a trainer alert drafted by the coach.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function MessageTrainerPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read the alert type and message the coach wants to send.
  const issueLabel = readIssueLabel(params);
  const severityLabel = readSeverityLabel(params);
  const alertMessage = readAlertMessage(params);

  // 2. Confirm sends the ping. onConfirm still gets the original params.
  function handleConfirmSendAlert() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={TYPE_ROW_LABEL} value={issueLabel} />
      <DetailRow label={MESSAGE_ROW_LABEL} value={alertMessage} />
      <DetailRow label={SEVERITY_ROW_LABEL} value={severityLabel} />
      <ConfirmCancelRow
        onConfirm={handleConfirmSendAlert}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
