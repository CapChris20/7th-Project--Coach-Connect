import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

export default function OpenWorkoutPlanModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const planId = params?.planId || 'current';

  return (
    <ToolModalBody
      title="Show workout plan details?"
      reasoning={reasoning || 'Your full plan stays in this chat — I will summarize it here without leaving the conversation.'}
    >
      <DetailRow label="Plan" value={planId === 'current' ? 'Current active plan' : planId} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Show in chat"
      />
    </ToolModalBody>
  );
}
