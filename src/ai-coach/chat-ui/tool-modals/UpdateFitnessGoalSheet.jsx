/**
 * Update Goal Modal
 *
 * Purpose: UI screen or component: Update Goal Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: UpdateFitnessGoalSheet
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';
import { formatOnboardingDisplay } from '../../../shared-utils/formatOnboardingDisplay';

export default function UpdateFitnessGoalSheet({ params, reasoning, onConfirm, onCancel, loading }) {
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
