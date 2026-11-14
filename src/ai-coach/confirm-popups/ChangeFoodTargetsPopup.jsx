// Design Law nutrition-target confirm — DiffTable old→new + reason (screens/ai-coach-popups/23).
// Flow: load saved goals → fill blanks from coach → show strikethrough before → Update targets.
// Used by ConfirmActionPopup when the coach tool is adjustMacroTargets.
// Hook order frozen: savedMacroTargets → reasonDraft → useEffect([]) → then resolve + layout.

import React, { useState, useEffect, useMemo } from 'react';
import {
  ToolModalBody,
  FieldLabel,
  PopupTextField,
  DiffTable,
  ConfirmCancelRow,
} from './sharedPopupParts';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const BADGE = 'Coach wants to change your targets';
const TITLE = 'Update nutrition targets?';
const CONFIRM_LABEL = 'Update targets';
const REASON_LABEL = 'REASON';
const REASON_PLACEHOLDER = 'Why these targets…';

// vocab: Firestore collection — one nutrition-goals document per user id.
// Letters frozen — do not rename the collection string.
const NUTRITION_GOALS_COLLECTION = 'nutrition_goals';

// Manipulate here: used only when the account has no saved target AND the coach omitted that macro.
const DEFAULT_PROTEIN_GRAMS = 150;
const DEFAULT_CARBS_GRAMS = 200;
const DEFAULT_FAT_GRAMS = 65;

// A coach calorie number under this is treated as a bad guess (0, 1, leftovers).
// Manipulate here: raise it if tiny numbers keep getting saved as the daily target.
const MINIMUM_EXPLICIT_CALORIES = 800;

// Atwater factors: how many calories one gram of each macro is worth.
const CALORIES_PER_GRAM_PROTEIN = 4;
const CALORIES_PER_GRAM_CARBS = 4;
const CALORIES_PER_GRAM_FAT = 9;

// ===== HELPER FUNCTIONS =====

/**
 * Older goal docs stored `protein`. Newer ones store `protein_target`.
 * Field letters stay as Firestore already has them.
 * @param {object} goalData
 * @returns {{ protein: number, carbs: number, fat: number, calories: number|undefined }}
 */
function macroTargetsFromFirestoreGoal(goalData) {
  let proteinGrams = DEFAULT_PROTEIN_GRAMS;
  if (goalData.protein_target) {
    proteinGrams = goalData.protein_target;
  } else if (goalData.protein) {
    proteinGrams = goalData.protein;
  }

  let carbGrams = DEFAULT_CARBS_GRAMS;
  if (goalData.carbs_target) {
    carbGrams = goalData.carbs_target;
  } else if (goalData.carbs) {
    carbGrams = goalData.carbs;
  }

  let fatGrams = DEFAULT_FAT_GRAMS;
  if (goalData.fat_target) {
    fatGrams = goalData.fat_target;
  } else if (goalData.fat) {
    fatGrams = goalData.fat;
  }

  let savedCalories;
  if (goalData.calorie_target) {
    savedCalories = goalData.calorie_target;
  } else if (goalData.calories) {
    savedCalories = goalData.calories;
  }

  return {
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    calories: savedCalories,
  };
}

/**
 * Null means "no saved targets" — the card then uses the defaults above.
 * @param {object|null} currentUser
 * @returns {Promise<object|null>}
 */
async function fetchSavedMacroTargetsForUser(currentUser) {
  if (!currentUser) {
    return null;
  }

  try {
    // vocab: doc() points at one Firestore document. getDoc() reads it once.
    const goalsReference = doc(db, NUTRITION_GOALS_COLLECTION, currentUser.uid);
    const goalSnapshot = await getDoc(goalsReference);

    // vocab: exists() is false when that user has never saved nutrition goals.
    if (!goalSnapshot.exists()) {
      return null;
    }

    return macroTargetsFromFirestoreGoal(goalSnapshot.data());
  } catch (error) {
    console.warn('Failed to load current macros:', error.message);
    return null;
  }
}

/**
 * Number(undefined) is NaN, and NaN ?? fallback does NOT use the fallback.
 * The finite check is the real fallback path.
 * @param {*} rawValue
 * @param {number} fallbackGrams
 * @returns {number}
 */
function parseFiniteGramsOrUseDefault(rawValue, fallbackGrams) {
  const parsedGrams = Number(rawValue);

  // vocab: ?? only swaps null/undefined — NaN stays NaN, so we still need isFinite
  let withNullishFallback = parsedGrams;
  if (parsedGrams === null || parsedGrams === undefined) {
    withNullishFallback = fallbackGrams;
  }

  if (Number.isFinite(withNullishFallback)) {
    return withNullishFallback;
  }

  return fallbackGrams;
}

function multiplyGramsByCaloriesPerGram(grams, caloriesPerGram) {
  return grams * caloriesPerGram;
}

/**
 * Estimate daily calories from macro grams (Atwater).
 * @param {number} proteinGrams
 * @param {number} carbGrams
 * @param {number} fatGrams
 * @returns {number}
 */
function estimateCaloriesFromMacroGrams(proteinGrams, carbGrams, fatGrams) {
  const fromProtein = multiplyGramsByCaloriesPerGram(proteinGrams, CALORIES_PER_GRAM_PROTEIN);
  const fromCarbs = multiplyGramsByCaloriesPerGram(carbGrams, CALORIES_PER_GRAM_CARBS);
  const fromFat = multiplyGramsByCaloriesPerGram(fatGrams, CALORIES_PER_GRAM_FAT);
  const totalCalories = fromProtein + fromCarbs + fromFat;

  return Math.round(totalCalories);
}

/**
 * First defined coach calorie field among calories / newCals.
 * @param {object} params
 * @returns {*}
 */
function readExplicitCalorieCandidate(params) {
  if (!params) {
    return undefined;
  }
  if (params.calories !== undefined && params.calories !== null) {
    return params.calories;
  }
  if (params.newCals !== undefined && params.newCals !== null) {
    return params.newCals;
  }
  return undefined;
}

/**
 * Prefer the coach's calorie number only when it looks like a real daily target.
 * @param {object} params
 * @param {number} proteinGrams
 * @param {number} carbGrams
 * @param {number} fatGrams
 * @returns {number}
 */
function chooseDailyCalorieTarget(params, proteinGrams, carbGrams, fatGrams) {
  const explicitCalories = Number(readExplicitCalorieCandidate(params));
  const explicitLooksValid =
    Number.isFinite(explicitCalories) && explicitCalories >= MINIMUM_EXPLICIT_CALORIES;

  if (explicitLooksValid) {
    return explicitCalories;
  }

  return estimateCaloriesFromMacroGrams(proteinGrams, carbGrams, fatGrams);
}

/**
 * “Before” calories for the DiffTable — saved value, or estimate from saved macros.
 * @param {object|null} savedTargets
 * @param {number} defaultProteinGrams
 * @param {number} defaultCarbGrams
 * @param {number} defaultFatGrams
 * @returns {number}
 */
function readBeforeCalories(savedTargets, defaultProteinGrams, defaultCarbGrams, defaultFatGrams) {
  let savedCaloriesRaw;
  if (savedTargets) {
    savedCaloriesRaw = savedTargets.calories;
  }

  const savedCaloriesNumber = Number(savedCaloriesRaw);
  const savedCaloriesLookValid =
    Number.isFinite(savedCaloriesNumber) && savedCaloriesNumber > 0;

  if (savedCaloriesLookValid) {
    return savedCaloriesNumber;
  }

  return estimateCaloriesFromMacroGrams(defaultProteinGrams, defaultCarbGrams, defaultFatGrams);
}

/**
 * Grams fallback: saved macro when present (including 0), else hard-coded default.
 * vocab: ?? keeps a saved 0; || would turn 0 into the default.
 * @param {object|null} savedTargets
 * @param {string} fieldName
 * @param {number} hardDefault
 * @returns {number}
 */
function defaultGramsFromSavedOrConstant(savedTargets, fieldName, hardDefault) {
  if (!savedTargets) {
    return hardDefault;
  }
  const savedValue = savedTargets[fieldName];
  if (savedValue === undefined || savedValue === null) {
    return hardDefault;
  }
  return savedValue;
}

/**
 * First defined coach param among the listed aliases.
 * @param {object} params
 * @param {string[]} keyNames
 * @returns {*}
 */
function firstDefinedParamAlias(params, keyNames) {
  if (!params) {
    return undefined;
  }
  for (let keyIndex = 0; keyIndex < keyNames.length; keyIndex += 1) {
    const keyName = keyNames[keyIndex];
    const rawValue = params[keyName];
    if (rawValue !== undefined && rawValue !== null) {
      return rawValue;
    }
  }
  return undefined;
}

/**
 * Fill blank coach fields from saved targets (or the hard-coded defaults).
 * Returns both the “after” numbers and a before snapshot for DiffTable.
 * @param {object|null} savedTargets
 * @param {object} params
 * @returns {object}
 */
function mergeCoachParamsWithSavedTargets(savedTargets, params) {
  // 1. Fallbacks when the coach left a macro blank.
  const defaultProteinGrams = defaultGramsFromSavedOrConstant(
    savedTargets,
    'protein',
    DEFAULT_PROTEIN_GRAMS,
  );
  const defaultCarbGrams = defaultGramsFromSavedOrConstant(
    savedTargets,
    'carbs',
    DEFAULT_CARBS_GRAMS,
  );
  const defaultFatGrams = defaultGramsFromSavedOrConstant(
    savedTargets,
    'fat',
    DEFAULT_FAT_GRAMS,
  );

  // 2. Resolve each macro (coach aliases: newProtein / protein, newFats / fats / fat).
  const proteinGrams = parseFiniteGramsOrUseDefault(
    firstDefinedParamAlias(params, ['newProtein', 'protein']),
    defaultProteinGrams,
  );
  const carbGrams = parseFiniteGramsOrUseDefault(
    firstDefinedParamAlias(params, ['newCarbs', 'carbs']),
    defaultCarbGrams,
  );
  const fatGrams = parseFiniteGramsOrUseDefault(
    firstDefinedParamAlias(params, ['newFats', 'fats', 'fat']),
    defaultFatGrams,
  );

  // 3. Calories: trust a big enough coach number, else Atwater from the macros.
  const dailyCalories = chooseDailyCalorieTarget(params, proteinGrams, carbGrams, fatGrams);

  const beforeCalories = readBeforeCalories(
    savedTargets,
    defaultProteinGrams,
    defaultCarbGrams,
    defaultFatGrams,
  );

  const baseParams = params || {};
  const mergedParams = {
    ...baseParams,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    calories: dailyCalories,
  };

  const beforeSnapshot = {
    calories: beforeCalories,
    protein: defaultProteinGrams,
    carbs: defaultCarbGrams,
    fat: defaultFatGrams,
  };

  return {
    proteinGrams,
    carbGrams,
    fatGrams,
    dailyCalories,
    mergedParams,
    before: beforeSnapshot,
  };
}

function formatCaloriesWithCommas(calorieNumber) {
  return Number(calorieNumber).toLocaleString();
}

function formatMacroGramsLabel(gramNumber) {
  return `${gramNumber} g`;
}

/**
 * Four DiffTable rows: Calories, Protein, Carbs, Fats.
 * @param {object} resolved
 * @returns {Array<{ label: string, before: string, after: string }>}
 */
function buildMacroDiffRows(resolved) {
  return [
    {
      label: 'Calories',
      before: formatCaloriesWithCommas(resolved.before.calories),
      after: formatCaloriesWithCommas(resolved.dailyCalories),
    },
    {
      label: 'Protein',
      before: formatMacroGramsLabel(resolved.before.protein),
      after: formatMacroGramsLabel(resolved.proteinGrams),
    },
    {
      label: 'Carbs',
      before: formatMacroGramsLabel(resolved.before.carbs),
      after: formatMacroGramsLabel(resolved.carbGrams),
    },
    {
      label: 'Fats',
      before: formatMacroGramsLabel(resolved.before.fat),
      after: formatMacroGramsLabel(resolved.fatGrams),
    },
  ];
}

/**
 * Starting reason text from the coach tool params.
 * @param {object} params
 * @returns {string}
 */
function startingReasonDraftFromParams(params) {
  if (!params) {
    return '';
  }
  if (params.reason === undefined || params.reason === null) {
    return '';
  }
  return String(params.reason);
}

function ChangeFoodTargetsLayout({
  reasoning,
  resolved,
  reasonDraft,
  setReasonDraft,
  onConfirm,
  onCancel,
  loading,
}) {
  // 1. Build the old→new rows once resolved numbers stop changing.
  // vocab: useMemo = recompute only when `resolved` identity changes
  const diffRows = useMemo(() => buildMacroDiffRows(resolved), [resolved]);

  // 2. On confirm: trim reason, merge into the resolved targets, hand to parent.
  function handleConfirmSave() {
    const trimmedReason = String(reasonDraft || '').trim();
    let reasonOrUndefined;
    if (trimmedReason) {
      reasonOrUndefined = trimmedReason;
    }

    onConfirm({
      ...resolved.mergedParams,
      reason: reasonOrUndefined,
    });
  }

  // Design Law PNG 23: strikethrough current → bold next inside one bordered card.
  return (
    <ToolModalBody badge={BADGE} title={TITLE} reasoning={reasoning}>
      <DiffTable rows={diffRows} />
      <FieldLabel label={REASON_LABEL} />
      <PopupTextField
        value={reasonDraft}
        onChangeText={setReasonDraft}
        placeholder={REASON_PLACEHOLDER}
        multiline
      />
      <ConfirmCancelRow
        onConfirm={handleConfirmSave}
        onCancel={onCancel}
        loading={loading}
        confirmLabel={CONFIRM_LABEL}
      />
    </ToolModalBody>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Popup that shows the nutrition targets the coach wants to save.
 * Props: params (coach tool args), reasoning, onConfirm (merged targets), onCancel, loading.
 */
export default function ChangeFoodTargetsPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Load saved targets so a blank coach field can fall back to what is already on the profile.
  const [savedMacroTargets, setSavedMacroTargets] = useState(null);
  const [reasonDraft, setReasonDraft] = useState(() => startingReasonDraftFromParams(params));

  useEffect(() => {
    // Saved targets fill any macro the coach left blank. Read once on open —
    // reading again on each render would flicker the numbers on the card.
    // vocab: useEffect runs after paint. [] means only when this popup opens.
    async function loadTargetsOnce() {
      const loadedTargets = await fetchSavedMacroTargetsForUser(auth.currentUser);

      if (loadedTargets) {
        setSavedMacroTargets(loadedTargets);
      }
    }

    loadTargetsOnce();
  }, []);

  // 2. Fill blank coach fields from saved targets (or the defaults).
  const resolved = mergeCoachParamsWithSavedTargets(savedMacroTargets, params);

  // 3. DiffTable + editable reason. Confirm still sends the merged targets.
  return (
    <ChangeFoodTargetsLayout
      reasoning={reasoning}
      resolved={resolved}
      reasonDraft={reasonDraft}
      setReasonDraft={setReasonDraft}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
