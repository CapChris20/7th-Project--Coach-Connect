// Confirm popup before the coach logs a meal.
// Flow: read the food name, calories, and protein → show the meal type when it exists → confirm or cancel.
// Used by: the coach conversation when a tool wants to log food.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const DEFAULT_FOOD_NAME = 'Food item';
const MISSING_VALUE = '—';

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @returns {{ foodName: string, calorieLabel: string|number, proteinLabel: string|number, mealType: string|undefined }}
 */
function readMealDetails(params) {
  const foodName = params?.name || params?.food || params?.foodName || DEFAULT_FOOD_NAME;
  const calorieLabel = params?.cals ?? params?.calories ?? MISSING_VALUE;
  const protein = params?.protein ?? MISSING_VALUE;
  const proteinLabel = protein !== MISSING_VALUE ? `${protein}g` : MISSING_VALUE;
  return { foodName, calorieLabel, proteinLabel, mealType: params?.mealType };
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogMealPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const mealDetails = readMealDetails(params);

  return (
    <ToolModalBody title="Log this meal?" reasoning={reasoning}>
      <DetailRow label="Food" value={mealDetails.foodName} />
      <DetailRow label="Calories" value={mealDetails.calorieLabel} />
      <DetailRow label="Protein" value={mealDetails.proteinLabel} />
      {mealDetails.mealType ? <DetailRow label="Meal" value={mealDetails.mealType} /> : null}
      <ConfirmCancelRow
        onConfirm={() => onConfirm(params)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel="Log"
      />
    </ToolModalBody>
  );
}
