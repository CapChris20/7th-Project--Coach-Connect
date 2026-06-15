/**
 * Open Workout Plan Modal
 *
 * Purpose: UI screen or component: Open Workout Plan Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: OpenWorkoutPlanModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function OpenWorkoutPlanModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const planId = params?.planId || 'current';

  return (
    <ToolModalBody
      title="Open workout plan?"
      reasoning={reasoning || 'Opens your Weekly Plan viewer and summarizes today\'s session here in chat.'}
    >
      <DetailRow label="Plan" value={planId === 'current' ? 'Current active plan' : planId} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Open plan"
      />
    </ToolModalBody>
  );
}
