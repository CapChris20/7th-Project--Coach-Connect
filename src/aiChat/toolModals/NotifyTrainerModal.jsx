import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function NotifyTrainerModal({ params, reasoning, onConfirm, onCancel, loading }) {
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
