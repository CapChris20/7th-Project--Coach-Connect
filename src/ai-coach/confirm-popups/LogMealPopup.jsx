// Confirm popup before the coach logs a meal.
// Flow: read the food name, calories, and protein → show the meal type when it exists → confirm or cancel.
// Used by: the coach conversation when a tool wants to log food.

import React from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';

// ===== NAMED CONSTANTS =====

const POPUP_TITLE = 'Log this meal?';
const FOOD_ROW_LABEL = 'Food';
const CALORIES_ROW_LABEL = 'Calories';
const PROTEIN_ROW_LABEL = 'Protein';
const MEAL_ROW_LABEL = 'Meal';
const CONFIRM_BUTTON_LABEL = 'Log';
const DEFAULT_FOOD_NAME = 'Food item';
const MISSING_VALUE = '—';
const FOOD_NAME_KEYS = ['name', 'food', 'foodName'];

// ===== HELPER FUNCTIONS =====

/**
 * @param {object|undefined} params
 * @param {string[]} keyNames
 * @returns {string|undefined}
 */
function readOptionalString(params, keyNames) {
  if (!params) return undefined;
  for (let index = 0; index < keyNames.length; index += 1) {
    const keyName = keyNames[index];
    const candidate = params[keyName];
    if (candidate) return String(candidate);
  }
  return undefined;
}

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readFoodName(params) {
  const fromParams = readOptionalString(params, FOOD_NAME_KEYS);
  if (fromParams) return fromParams;
  return DEFAULT_FOOD_NAME;
}

function valueWasProvided(value) {
  if (value === undefined) return false;
  if (value === null) return false;
  return true;
}

/**
 * vocab: a missing calorie is not the same as 0. 0 stays on the card.
 * @param {object|undefined} params
 * @returns {string|number}
 */
function readCalorieLabel(params) {
  if (!params) return MISSING_VALUE;
  if (valueWasProvided(params.cals)) return params.cals;
  if (valueWasProvided(params.calories)) return params.calories;
  return MISSING_VALUE;
}

/**
 * @param {object|undefined} params
 * @returns {string}
 */
function readProteinLabel(params) {
  if (!params) return MISSING_VALUE;
  if (!valueWasProvided(params.protein)) return MISSING_VALUE;
  return `${params.protein}g`;
}

function readMealType(params) {
  if (!params) return undefined;
  return params.mealType;
}

/**
 * @param {object|undefined} params
 * @returns {{ foodName: string, calorieLabel: string|number, proteinLabel: string, mealType: string|undefined }}
 */
function readMealDetails(params) {
  return {
    foodName: readFoodName(params),
    calorieLabel: readCalorieLabel(params),
    proteinLabel: readProteinLabel(params),
    mealType: readMealType(params),
  };
}

function MealTypeRow({ mealType }) {
  if (!mealType) return null;
  return <DetailRow label={MEAL_ROW_LABEL} value={mealType} />;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging a meal the coach parsed from the conversation.
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogMealPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Read food name, calories, protein, and meal (Breakfast / Lunch / …).
  const mealDetails = readMealDetails(params);

  // 2. Confirm logs that food. onConfirm still gets the original params.
  function handleConfirmLogMeal() {
    onConfirm(params);
  }

  return (
    <ToolModalBody title={POPUP_TITLE} reasoning={reasoning}>
      <DetailRow label={FOOD_ROW_LABEL} value={mealDetails.foodName} />
      <DetailRow label={CALORIES_ROW_LABEL} value={mealDetails.calorieLabel} />
      <DetailRow label={PROTEIN_ROW_LABEL} value={mealDetails.proteinLabel} />
      <MealTypeRow mealType={mealDetails.mealType} />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogMeal}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
