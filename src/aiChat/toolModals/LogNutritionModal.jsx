import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './toolModalShared';

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
