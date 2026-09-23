/**
 * Update Goal Modal
 *
 * Purpose: UI screen or component: Update Goal Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: UpdateGoalPopup
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';
import { showSetupAnswers } from '../../helpers/showSetupAnswers';

export default function UpdateGoalPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const goal = showSetupAnswers(params?.newGoal, params?.newGoal || '—');

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
