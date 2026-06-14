import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';
import { formatOnboardingDisplay } from '../../shared/utils/formatOnboardingDisplay';

export default function UpdateGoalModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const goal = formatOnboardingDisplay(params?.newGoal, params?.newGoal || '—');

  return (
    <ToolModalBody title="Change goal?" reasoning={reasoning}>
      <DetailRow label="New goal" value={goal} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Update"
      />
    </ToolModalBody>
  );
}
