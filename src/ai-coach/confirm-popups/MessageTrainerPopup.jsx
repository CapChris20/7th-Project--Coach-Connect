// Design Law message-trainer confirm — editable draft before send (screens/ai-coach-popups/14).
// Flow: show who receives it → edit message → Send.
// Used by: ConfirmActionPopup when tool = notifyTrainer.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  DetailRow,
  FieldLabel,
  PopupTextField,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to message your trainer';
const TITLE = 'Send as you';
const CONFIRM_LABEL = 'Send';
const MESSAGE_LABEL = 'MESSAGE';

// ===== HELPERS =====

function readIssueLabel(params) {
  if (!params?.issueType) return 'Check-in';
  return String(params.issueType).replace(/_/g, ' ');
}

function readSeverityLabel(params) {
  return String(params?.severity || 'medium');
}

function readAlertMessage(params) {
  return String(params?.message || '');
}

// ===== MAIN FUNCTION =====

export default function MessageTrainerPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const [message, setMessage] = useState(() => readAlertMessage(params));
  const issueLabel = readIssueLabel(params);
  const severityLabel = readSeverityLabel(params);

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      message: message.trim(),
    }),
    [params, message],
  );

  return (
    <ToolModalBody title={TITLE} badge={BADGE} reasoning={reasoning}>
      <DetailRow label="Type" value={issueLabel} />
      <DetailRow label="Severity" value={severityLabel} />
      <DetailRow label="To" value="Your linked trainer" />
      <FieldLabel label={MESSAGE_LABEL} />
      <PopupTextField
        value={message}
        onChangeText={setMessage}
        placeholder="Message to your trainer…"
        multiline
      />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
