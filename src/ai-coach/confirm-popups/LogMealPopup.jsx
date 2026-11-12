// Design Law meal confirm — editable food, meal chips, macro cards (screens/ai-coach-popups/01).
// Flow: prefill from tool → user can fix food / meal type → Log meal.
// Used by: ConfirmActionPopup when tool = logNutrition.

import React, { useMemo, useState } from 'react';
import {
  ToolModalBody,
  FieldLabel,
  PopupTextField,
  FillChipRow,
  MacroStatCards,
  ConfirmCancelRow,
} from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to log a meal';
const FOOD_LABEL = 'FOOD';
const CONFIRM_LABEL = 'Log meal';
const MEAL_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

// ===== HELPERS =====

function valueWasProvided(value) {
  return value !== undefined && value !== null;
}

function readFoodName(params) {
  return String(params?.name || params?.food || params?.foodName || 'Food item');
}

function readMealType(params) {
  const raw = String(params?.mealType || params?.meal || 'breakfast').toLowerCase();
  if (MEAL_OPTIONS.some((opt) => opt.id === raw)) return raw;
  return 'breakfast';
}

function macroGrams(params, keys) {
  for (const key of keys) {
    if (valueWasProvided(params?.[key])) return `${params[key]} g`;
  }
  return '—';
}

// ===== MAIN FUNCTION =====

export default function LogMealPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  const [foodName, setFoodName] = useState(() => readFoodName(params));
  const [mealType, setMealType] = useState(() => readMealType(params));

  const protein = macroGrams(params, ['protein']);
  const carbs = macroGrams(params, ['carbs']);
  const fats = macroGrams(params, ['fat', 'fats']);

  const draftParams = useMemo(
    () => ({
      ...(params || {}),
      name: foodName.trim() || readFoodName(params),
      food: foodName.trim() || readFoodName(params),
      mealType,
    }),
    [params, foodName, mealType],
  );

  return (
    <ToolModalBody title={foodName || 'Meal'} badge={BADGE} reasoning={reasoning}>
      <FieldLabel label={FOOD_LABEL} />
      <PopupTextField value={foodName} onChangeText={setFoodName} placeholder="Food name" />
      <FillChipRow options={MEAL_OPTIONS} value={mealType} onChange={setMealType} />
      <MacroStatCards protein={protein} carbs={carbs} fats={fats} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(draftParams)}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}
