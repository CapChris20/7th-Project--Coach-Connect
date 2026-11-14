// Design Law message-trainer confirm — editable draft before send (screens/ai-coach-popups/14).
// Flow: show issue type + severity → edit message body → Send merges trimmed text into params.
// Used by: ConfirmActionPopup when tool = notifyTrainer.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  InfoTable,
  FieldLabel,
  PopupTextField,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE_TEXT = 'Coach wants to message your trainer';
const HEADLINE = 'Send as you';
const CONFIRM_BUTTON_LABEL = 'Send';
const MESSAGE_FIELD_LABEL = 'MESSAGE';

// Manipulate here: InfoTable fallbacks when the coach tool omitted metadata
const ISSUE_TYPE_WHEN_COACH_OMITS = 'Check-in';
const SEVERITY_WHEN_COACH_OMITS = 'medium';
const TO_ROW_VALUE = 'Your linked trainer';

const MESSAGE_PLACEHOLDER = 'Message to your trainer…';

const INFO_ROW_LABEL_TYPE = 'Type';
const INFO_ROW_LABEL_SEVERITY = 'Severity';
const INFO_ROW_LABEL_TO = 'To';

// ===== HELPER FUNCTIONS =====

/**
 * Human-readable issue type for the Type row.
 * Underscores in the tool id become spaces (e.g. check_in → check in).
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function issueTypeLabelFromParams(coachParams) {
  if (!coachParams) {
    return ISSUE_TYPE_WHEN_COACH_OMITS;
  }

  if (!coachParams.issueType) {
    return ISSUE_TYPE_WHEN_COACH_OMITS;
  }

  // vocab/symbol: /_/g = replace every underscore with a space
  const issueTypeWords = String(coachParams.issueType).replace(/_/g, ' ');
  return issueTypeWords;
}

/**
 * Severity string for the Severity row (e.g. medium / high).
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function severityLabelFromParams(coachParams) {
  if (!coachParams) {
    return SEVERITY_WHEN_COACH_OMITS;
  }

  if (!coachParams.severity) {
    return SEVERITY_WHEN_COACH_OMITS;
  }

  return String(coachParams.severity);
}

/**
 * Starting text for the editable message field.
 * @param {object|undefined} coachParams
 * @returns {string}
 */
function startingMessageTextFromParams(coachParams) {
  if (!coachParams) {
    return '';
  }

  if (!coachParams.message) {
    return '';
  }

  return String(coachParams.message);
}

/**
 * Three read-only rows: Type, Severity, To.
 * @param {string} issueTypeLabel
 * @param {string} severityLabel
 * @returns {Array<{label: string, value: string}>}
 */
function buildTrainerInfoRows(issueTypeLabel, severityLabel) {
  return [
    { label: INFO_ROW_LABEL_TYPE, value: issueTypeLabel },
    { label: INFO_ROW_LABEL_SEVERITY, value: severityLabel },
    { label: INFO_ROW_LABEL_TO, value: TO_ROW_VALUE },
  ];
}

/**
 * Merge the trimmed message into the original tool params.
 * Key letter `message` stays frozen for the server.
 * @param {object|undefined} originalParams
 * @param {string} messageText
 * @returns {object}
 */
function buildTrainerMessagePayload(originalParams, messageText) {
  const baseParams = originalParams || {};
  const trimmedMessage = messageText.trim();

  return {
    ...baseParams,
    message: trimmedMessage,
  };
}

/**
 * Pure layout — no hooks. Parent owns message draft and Confirm.
 */
function MessageTrainerLayout({
  reasoning,
  infoRows,
  messageText,
  onMessageChange,
  onConfirm,
  onCancel,
  loading,
}) {
  return (
    <ToolModalBody title={HEADLINE} badge={BADGE_TEXT} reasoning={reasoning}>
      <InfoTable rows={infoRows} />
      <FieldLabel label={MESSAGE_FIELD_LABEL} />
      <PopupTextField
        value={messageText}
        onChangeText={onMessageChange}
        placeholder={MESSAGE_PLACEHOLDER}
        multiline
      />
      <ConfirmCancelRow
        onConfirm={onConfirm}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Confirm sending a trainer message after the coach drafts one.
 * Flow: 1. seed message  2. read-only table  3. Send merges trimmed text
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function MessageTrainerPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Editable message starts from what the coach drafted.
  const [messageText, setMessageText] = useState(() => startingMessageTextFromParams(params));

  // 2. Read-only Type / Severity / To rows stay fixed from the tool payload.
  const issueTypeLabel = issueTypeLabelFromParams(params);
  const severityLabel = severityLabelFromParams(params);
  const infoRows = buildTrainerInfoRows(issueTypeLabel, severityLabel);

  // 3. Confirm bag rebuilds when the typed message changes.
  const payloadForConfirm = useMemo(
    () => buildTrainerMessagePayload(params, messageText),
    [params, messageText],
  );

  function handleConfirmSend() {
    onConfirm(payloadForConfirm);
  }

  // 4. Show the Design Law message-trainer sheet.
  return (
    <MessageTrainerLayout
      reasoning={reasoning}
      infoRows={infoRows}
      messageText={messageText}
      onMessageChange={setMessageText}
      onConfirm={handleConfirmSend}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
