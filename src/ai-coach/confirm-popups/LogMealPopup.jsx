// Design Law meal confirm — editable food name, meal chips, read-only macro cards.
// Flow: prefill from coach tool → trainee can fix food / meal type → Log meal merges draft.
// Used by: ConfirmActionPopup when the coach tool is logNutrition.

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

const BADGE_TEXT = 'Coach wants to log a meal';
const FOOD_FIELD_LABEL = 'FOOD';
const CONFIRM_BUTTON_LABEL = 'Log meal';
const FOOD_NAME_PLACEHOLDER = 'Food name';
const FOOD_NAME_WHEN_COACH_OMITS = 'Food item';
const TITLE_WHEN_FOOD_EMPTY = 'Meal';
const MISSING_MACRO_MARK = '—';

// Manipulate here: meal chip ids must match what carryOutAction / server accept
const MEAL_CHIP_OPTIONS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snack', label: 'Snack' },
];

const DEFAULT_MEAL_TYPE_ID = 'breakfast';

// ===== HELPER FUNCTIONS =====

function coachDidSendThisValue(value) {
  if (value === undefined) {
    return false;
  }
  if (value === null) {
    return false;
  }
  return true;
}

function foodNameFromCoachParams(coachParams) {
  if (!coachParams) {
    return '';
  }

  if (coachParams.name) {
    return String(coachParams.name);
  }
  if (coachParams.food) {
    return String(coachParams.food);
  }
  if (coachParams.foodName) {
    return String(coachParams.foodName);
  }

  return '';
}

function startingFoodNameFromCoachParams(coachParams) {
  const nameFromTool = foodNameFromCoachParams(coachParams);
  if (nameFromTool) {
    return nameFromTool;
  }
  return FOOD_NAME_WHEN_COACH_OMITS;
}

function mealTypeIdIsKnown(mealId) {
  for (let index = 0; index < MEAL_CHIP_OPTIONS.length; index += 1) {
    const option = MEAL_CHIP_OPTIONS[index];
    if (option.id === mealId) {
      return true;
    }
  }
  return false;
}

function rawMealTypeFromCoachParams(coachParams) {
  if (!coachParams) {
    return DEFAULT_MEAL_TYPE_ID;
  }

  if (coachParams.mealType) {
    return String(coachParams.mealType).toLowerCase();
  }
  if (coachParams.meal) {
    return String(coachParams.meal).toLowerCase();
  }

  return DEFAULT_MEAL_TYPE_ID;
}

function startingMealTypeFromCoachParams(coachParams) {
  const rawMeal = rawMealTypeFromCoachParams(coachParams);

  if (mealTypeIdIsKnown(rawMeal)) {
    return rawMeal;
  }
  return DEFAULT_MEAL_TYPE_ID;
}

function firstMacroValueFromParams(coachParams, keyList) {
  if (!coachParams) {
    return undefined;
  }

  for (let index = 0; index < keyList.length; index += 1) {
    const keyName = keyList[index];
    const macroValue = coachParams[keyName];
    if (coachDidSendThisValue(macroValue)) {
      return macroValue;
    }
  }

  return undefined;
}

function macroGramsDisplayFromParams(coachParams, keyList) {
  const macroValue = firstMacroValueFromParams(coachParams, keyList);
  if (!coachDidSendThisValue(macroValue)) {
    return MISSING_MACRO_MARK;
  }
  return `${macroValue} g`;
}

function cleanedFoodNameForConfirm(baseParams, foodNameDraft) {
  const trimmedFoodName = foodNameDraft.trim();
  if (trimmedFoodName) {
    return trimmedFoodName;
  }
  return startingFoodNameFromCoachParams(baseParams);
}

function baseParamsOrEmptyObject(baseParams) {
  if (baseParams) {
    return baseParams;
  }
  return {};
}

function buildMealDraftForConfirm(baseParams, foodNameDraft, mealTypeId) {
  const cleanedFoodName = cleanedFoodNameForConfirm(baseParams, foodNameDraft);
  const safeBaseParams = baseParamsOrEmptyObject(baseParams);

  return {
    ...safeBaseParams,
    name: cleanedFoodName,
    food: cleanedFoodName,
    mealType: mealTypeId,
  };
}

function modalTitleFromFoodName(foodNameDraft) {
  if (foodNameDraft) {
    return foodNameDraft;
  }
  return TITLE_WHEN_FOOD_EMPTY;
}

// ===== MAIN FUNCTION =====

/**
 * Confirm logging a meal the coach proposed (trainee can edit food + meal chip).
 * @param {{ params?: object, reasoning?: string, onConfirm: Function, onCancel: Function, loading?: boolean }} props
 */
export default function LogMealPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Editable food name and meal chip — seeded once from the coach tool args.
  const [foodNameDraft, setFoodNameDraft] = useState(() => startingFoodNameFromCoachParams(params));
  const [mealTypeId, setMealTypeId] = useState(() => startingMealTypeFromCoachParams(params));

  // 2. Macro cards are read-only displays from the tool (not edited in this popup).
  const proteinDisplay = macroGramsDisplayFromParams(params, ['protein']);
  const carbsDisplay = macroGramsDisplayFromParams(params, ['carbs']);
  const fatsDisplay = macroGramsDisplayFromParams(params, ['fat', 'fats']);

  // 3. Keep confirm payload in sync with the form.
  const draftParams = useMemo(
    () => buildMealDraftForConfirm(params, foodNameDraft, mealTypeId),
    [params, foodNameDraft, mealTypeId],
  );

  function handleConfirmLogMeal() {
    onConfirm(draftParams);
  }

  // 4. Name the title before JSX so the return stays a flat recipe.
  const modalTitle = modalTitleFromFoodName(foodNameDraft);

  return (
    <ToolModalBody title={modalTitle} badge={BADGE_TEXT} reasoning={reasoning}>
      <FieldLabel label={FOOD_FIELD_LABEL} />
      <PopupTextField
        value={foodNameDraft}
        onChangeText={setFoodNameDraft}
        placeholder={FOOD_NAME_PLACEHOLDER}
      />
      <FillChipRow
        options={MEAL_CHIP_OPTIONS}
        value={mealTypeId}
        onChange={setMealTypeId}
      />
      <MacroStatCards
        protein={proteinDisplay}
        carbs={carbsDisplay}
        fats={fatsDisplay}
      />
      <ConfirmCancelRow
        onConfirm={handleConfirmLogMeal}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_BUTTON_LABEL}
      />
    </ToolModalBody>
  );
}
