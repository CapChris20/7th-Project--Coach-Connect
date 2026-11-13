// Design Law nutrition-target confirm — DiffTable old→new + reason (screens/ai-coach-popups/23).
// Flow: load saved goals → fill blanks from coach → show strikethrough before → Update targets.
// Used by ConfirmActionPopup when the coach tool is adjustMacroTargets.

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

// vocab: Firestore collection — one nutrition-goals document per user id.
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
 * @param {object} goalData
 * @returns {{ protein: number, carbs: number, fat: number, calories?: number }}
 */
function macroTargetsFromFirestoreGoal(goalData) {
  return {
    protein: goalData.protein_target || goalData.protein || DEFAULT_PROTEIN_GRAMS,
    carbs: goalData.carbs_target || goalData.carbs || DEFAULT_CARBS_GRAMS,
    fat: goalData.fat_target || goalData.fat || DEFAULT_FAT_GRAMS,
    calories: goalData.calorie_target || goalData.calories || undefined,
  };
}

/**
 * Null means "no saved targets" — the card then uses the defaults above.
 * @param {object|null} currentUser
 * @returns {Promise<{ protein: number, carbs: number, fat: number, calories?: number }|null>}
 */
async function fetchSavedMacroTargetsForUser(currentUser) {
  if (!currentUser) return null;
  try {
    // vocab: doc() points at one Firestore document. getDoc() reads it once.
    const goalsReference = doc(db, NUTRITION_GOALS_COLLECTION, currentUser.uid);
    const goalSnapshot = await getDoc(goalsReference);
    // vocab: exists() is false when that user has never saved nutrition goals.
    if (!goalSnapshot.exists()) return null;
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
  const withNullishFallback = parsedGrams ?? fallbackGrams;
  return Number.isFinite(withNullishFallback) ? withNullishFallback : fallbackGrams;
}

/**
 * @param {number} proteinGrams
 * @param {number} carbGrams
 * @param {number} fatGrams
 * @returns {number}
 */
function estimateCaloriesFromMacroGrams(proteinGrams, carbGrams, fatGrams) {
  return Math.round(
    proteinGrams * CALORIES_PER_GRAM_PROTEIN +
      carbGrams * CALORIES_PER_GRAM_CARBS +
      fatGrams * CALORIES_PER_GRAM_FAT,
  );
}

/**
 * Prefer the coach's calorie number only when it looks like a real daily target.
 * @param {object|undefined} params
 * @param {number} proteinGrams
 * @param {number} carbGrams
 * @param {number} fatGrams
 * @returns {number}
 */
function chooseDailyCalorieTarget(params, proteinGrams, carbGrams, fatGrams) {
  const explicitCalories = Number(params?.calories ?? params?.newCals);
  const explicitLooksValid =
    Number.isFinite(explicitCalories) && explicitCalories >= MINIMUM_EXPLICIT_CALORIES;
  if (explicitLooksValid) return explicitCalories;
  return estimateCaloriesFromMacroGrams(proteinGrams, carbGrams, fatGrams);
}

/**
 * @param {object|null} savedTargets
 * @param {object|undefined} params
 * @returns {{ proteinGrams: number, carbGrams: number, fatGrams: number, dailyCalories: number, mergedParams: object, before: object }}
 */
function mergeCoachParamsWithSavedTargets(savedTargets, params) {
  const defaultProteinGrams = savedTargets?.protein ?? DEFAULT_PROTEIN_GRAMS;
  const defaultCarbGrams = savedTargets?.carbs ?? DEFAULT_CARBS_GRAMS;
  const defaultFatGrams = savedTargets?.fat ?? DEFAULT_FAT_GRAMS;

  const proteinGrams = parseFiniteGramsOrUseDefault(
    params?.newProtein ?? params?.protein,
    defaultProteinGrams,
  );
  const carbGrams = parseFiniteGramsOrUseDefault(
    params?.newCarbs ?? params?.carbs,
    defaultCarbGrams,
  );
  const fatGrams = parseFiniteGramsOrUseDefault(
    params?.newFats ?? params?.fats ?? params?.fat,
    defaultFatGrams,
  );
  const dailyCalories = chooseDailyCalorieTarget(params, proteinGrams, carbGrams, fatGrams);

  const beforeCalories =
    Number.isFinite(Number(savedTargets?.calories)) && Number(savedTargets.calories) > 0
      ? Number(savedTargets.calories)
      : estimateCaloriesFromMacroGrams(defaultProteinGrams, defaultCarbGrams, defaultFatGrams);

  const mergedParams = {
    ...params,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    calories: dailyCalories,
  };

  return {
    proteinGrams,
    carbGrams,
    fatGrams,
    dailyCalories,
    mergedParams,
    before: {
      calories: beforeCalories,
      protein: defaultProteinGrams,
      carbs: defaultCarbGrams,
      fat: defaultFatGrams,
    },
  };
}

function formatKcal(n) {
  return Number(n).toLocaleString();
}

function formatGrams(n) {
  return `${n} g`;
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
  const handleConfirmSave = () => {
    const reason = String(reasonDraft || '').trim();
    onConfirm({
      ...resolved.mergedParams,
      reason: reason || undefined,
    });
  };

  // Design Law PNG 23: strikethrough current → bold next inside one bordered card
  const diffRows = useMemo(
    () => [
      {
        label: 'Calories',
        before: formatKcal(resolved.before.calories),
        after: formatKcal(resolved.dailyCalories),
      },
      {
        label: 'Protein',
        before: formatGrams(resolved.before.protein),
        after: formatGrams(resolved.proteinGrams),
      },
      {
        label: 'Carbs',
        before: formatGrams(resolved.before.carbs),
        after: formatGrams(resolved.carbGrams),
      },
      {
        label: 'Fats',
        before: formatGrams(resolved.before.fat),
        after: formatGrams(resolved.fatGrams),
      },
    ],
    [resolved],
  );

  return (
    <ToolModalBody badge={BADGE} title={TITLE} reasoning={reasoning}>
      <DiffTable rows={diffRows} />
      <FieldLabel label={REASON_LABEL} />
      <PopupTextField
        value={reasonDraft}
        onChangeText={setReasonDraft}
        placeholder="Why these targets…"
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
 * @param {object} props
 * @param {object} props.params Coach tool arguments (protein / newProtein, and the same for carbs, fats, calories).
 * @param {string} props.reasoning Why the coach suggested the change.
 * @param {function} props.onConfirm Called with the merged targets, not the raw tool args.
 * @param {function} props.onCancel
 * @param {boolean} props.loading True while the save is in flight. Disables the buttons.
 */
export default function ChangeFoodTargetsPopup({ params, reasoning, onConfirm, onCancel, loading }) {
  // 1. Load saved targets so a blank coach field can fall back to what is already on the profile.
  const [savedMacroTargets, setSavedMacroTargets] = useState(null);
  const [reasonDraft, setReasonDraft] = useState(() => String(params?.reason || ''));

  useEffect(() => {
    // Saved targets fill any macro the coach left blank. Read once on open —
    // reading again on each render would flicker the numbers on the card.
    // vocab: useEffect runs after paint. [] means only when this popup opens.
    async function loadTargetsOnce() {
      const loaded = await fetchSavedMacroTargetsForUser(auth.currentUser);
      if (loaded) setSavedMacroTargets(loaded);
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
