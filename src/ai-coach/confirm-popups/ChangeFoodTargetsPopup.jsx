// Confirm card when the coach wants to change daily calories and macros.
// Flow: load saved nutrition goals → fill any macro the coach left out →
// estimate calories when the coach's number isn't usable → show the card.
// Used by ConfirmActionPopup when the coach tool is a nutrition-target change.

import React, { useState, useEffect } from 'react';
import { ToolModalBody, DetailRow, ConfirmCancelRow } from './sharedPopupParts';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

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
 * @returns {{ protein: number, carbs: number, fat: number }}
 */
function macroTargetsFromFirestoreGoal(goalData) {
  return {
    protein: goalData.protein_target || goalData.protein || DEFAULT_PROTEIN_GRAMS,
    carbs: goalData.carbs_target || goalData.carbs || DEFAULT_CARBS_GRAMS,
    fat: goalData.fat_target || goalData.fat || DEFAULT_FAT_GRAMS,
  };
}

/**
 * Null means "no saved targets" — the card then uses the defaults above.
 * @param {object|null} currentUser
 * @returns {Promise<{ protein: number, carbs: number, fat: number }|null>}
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
 * @returns {{ proteinGrams: number, carbGrams: number, fatGrams: number, dailyCalories: number, mergedParams: object }}
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

  const mergedParams = {
    ...params,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    calories: dailyCalories,
  };

  return { proteinGrams, carbGrams, fatGrams, dailyCalories, mergedParams };
}

function ChangeFoodTargetsLayout({ reasoning, resolved, params, onConfirm, onCancel, loading }) {
  const handleConfirmSave = () => onConfirm(resolved.mergedParams);
  return (
    <ToolModalBody title="Update nutrition targets?" reasoning={reasoning}>
      <DetailRow label="Daily calories" value={`${resolved.dailyCalories} kcal`} />
      <DetailRow label="Protein" value={`${resolved.proteinGrams}g`} />
      <DetailRow label="Carbs" value={`${resolved.carbGrams}g`} />
      <DetailRow label="Fat" value={`${resolved.fatGrams}g`} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow
        onConfirm={handleConfirmSave}
        onCancel={onCancel}
        loading={loading}
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

  // 3. The layout shows those numbers. Confirm still sends the merged targets.
  return (
    <ChangeFoodTargetsLayout
      reasoning={reasoning}
      resolved={resolved}
      params={params}
      onConfirm={onConfirm}
      onCancel={onCancel}
      loading={loading}
    />
  );
}
