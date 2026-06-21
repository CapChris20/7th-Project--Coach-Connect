/**
 * Notify Trainer Modal
 *
 * Purpose: UI screen or component: Notify Trainer Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: SendTrainerMessageSheet
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function SendTrainerMessageSheet({ params, reasoning, onConfirm, onCancel, loading }) {
  const issue = params?.issueType ? String(params.issueType).replace(/_/g, ' ') : 'Check-in';

  return (
    <ToolModalBody title="Alert your trainer?" reasoning={reasoning}>
      <DetailRow label="Type" value={issue} />
      <DetailRow label="Message" value={params?.message} />
      <DetailRow label="Severity" value={params?.severity || 'medium'} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Send"
      />
    </ToolModalBody>
  );
}
