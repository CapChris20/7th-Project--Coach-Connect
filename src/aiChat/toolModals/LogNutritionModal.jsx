/**
 * Log Nutrition Modal
 *
 * Purpose: UI screen or component: Log Nutrition Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: LogNutritionModal
 *
 * @file-header
 */
import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from '../tool-modals/toolModalHelpers';

export default function LogNutritionModal({ params, reasoning, onConfirm, onCancel, loading }) {
  const food = params?.food || params?.foodName || 'Food';
  const cals = params?.cals ?? params?.calories ?? '—';
  const protein = params?.protein ?? '—';

  return (
    <ToolModalBody title="Log this meal?" reasoning={reasoning}>
      <DetailRow label="Food" value={food} />
      <DetailRow label="Calories" value={cals} />
      <DetailRow label="Protein" value={protein !== '—' ? `${protein}g` : '—'} />
      {params?.mealType ? <DetailRow label="Meal" value={params.mealType} /> : null}
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Log"
      />
    </ToolModalBody>
  );
}
