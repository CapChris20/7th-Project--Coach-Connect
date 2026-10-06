// Confirm popup before the coach alerts the trainer.
// Flow: turn the issue type into words → show the message and severity → confirm or cancel.
// Used by: the coach conversation when a tool wants to message the trainer.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const DEFAULT_ISSUE_LABEL = 'Check-in';
const DEFAULT_SEVERITY = 'medium';

// ===== HELPER FUNCTIONS =====

/**
 * Stored issue types use underscores. The popup shows spaces.
 * @param {object|undefined} params
 * @returns {string}
 */
function readIssueLabel(params) {
  if (!params?.issueType) return DEFAULT_ISSUE_LABEL;
  return String(params.issueType).replace(/_/g, ' ');
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function MessageTrainerPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const issueLabel = readIssueLabel(params);

  return (
    <ToolModalBody title="Alert your trainer?" reasoning={reasoning}>
      <DetailRow label="Type" value={issueLabel} />
      <DetailRow label="Message" value={params?.message} />
      <DetailRow label="Severity" value={params?.severity || DEFAULT_SEVERITY} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Send"
      />
    </ToolModalBody>
  );
}
