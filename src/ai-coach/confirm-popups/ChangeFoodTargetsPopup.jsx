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

// Older goal docs stored `protein`. Newer ones store `protein_target`.
// Either spelling is a real saved number. 0 counts as missing, same as the old || chain.
function savedMacroTargetsFromGoalData(goalData) {
  return {
    protein: goalData.protein_target || goalData.protein || DEFAULT_PROTEIN_GRAMS,
    carbs: goalData.carbs_target || goalData.carbs || DEFAULT_CARBS_GRAMS,
    fat: goalData.fat_target || goalData.fat || DEFAULT_FAT_GRAMS,
  };
}

// Null means "no saved targets" — the card then uses the defaults above.
// A missing doc is normal for a new account, so that is not an error.
async function loadSavedMacroTargets(currentUser) {
  if (!currentUser) return null;
  try {
    // vocab: doc() points at one Firestore document. getDoc() reads it once.
    const goalsReference = doc(db, NUTRITION_GOALS_COLLECTION, currentUser.uid);
    const goalSnapshot = await getDoc(goalsReference);
    // vocab: exists() is false when that user has never saved nutrition goals.
    if (!goalSnapshot.exists()) return null;
    return savedMacroTargetsFromGoalData(goalSnapshot.data());
  } catch (error) {
    console.warn('Failed to load current macros:', error.message);
    return null;
  }
}

// The coach tool has shipped under more than one key. This is the check that
// used to be `Number(value) ?? fallback` plus a second finite test.
// Number(undefined) is NaN, and NaN ?? fallback does NOT use the fallback,
// because ?? only replaces null and undefined. The finite check is the real fallback.
function finiteGramsOrFallback(rawValue, fallbackGrams) {
  const parsedGrams = Number(rawValue);
  const withNullishFallback = parsedGrams ?? fallbackGrams;
  return Number.isFinite(withNullishFallback) ? withNullishFallback : fallbackGrams;
}

// Prefer the coach's calorie number only when it looks like a real daily target.
// Otherwise rebuild calories from the grams so the card can't show 0 kcal beside a normal split.
function resolveDailyCalories(params, proteinGrams, carbGrams, fatGrams) {
  const explicitCalories = Number(params?.calories ?? params?.newCals);
  const hasUsableExplicitCalories =
    Number.isFinite(explicitCalories) && explicitCalories >= MINIMUM_EXPLICIT_CALORIES;
  if (hasUsableExplicitCalories) return explicitCalories;
  return Math.round(
    proteinGrams * CALORIES_PER_GRAM_PROTEIN +
      carbGrams * CALORIES_PER_GRAM_CARBS +
      fatGrams * CALORIES_PER_GRAM_FAT
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
  const [currentMacros, setCurrentMacros] = useState(null);

  useEffect(() => {
    // Saved targets fill any macro the coach left blank. Read once on open —
    // reading again on each render would flicker the numbers on the card.
    // vocab: useEffect runs after paint. [] means only when this popup opens.
    async function loadAndStoreSavedTargets() {
      const savedTargets = await loadSavedMacroTargets(auth.currentUser);
      if (savedTargets) setCurrentMacros(savedTargets);
    }
    loadAndStoreSavedTargets();
  }, []);

  // vocab: ?? uses the right side only when the left is null or undefined. 0 would be kept.
  // vocab: ?. skips the property read while currentMacros is still null (the Firestore read hasn't finished).
  const defaultProteinGrams = currentMacros?.protein ?? DEFAULT_PROTEIN_GRAMS;
  const defaultCarbGrams = currentMacros?.carbs ?? DEFAULT_CARBS_GRAMS;
  const defaultFatGrams = currentMacros?.fat ?? DEFAULT_FAT_GRAMS;

  // First key that isn't null/undefined wins. 0 is a real suggestion and must not skip ahead.
  const proteinGrams = finiteGramsOrFallback(
    params?.newProtein ?? params?.protein,
    defaultProteinGrams
  );
  const carbGrams = finiteGramsOrFallback(params?.newCarbs ?? params?.carbs, defaultCarbGrams);
  const fatGrams = finiteGramsOrFallback(
    params?.newFats ?? params?.fats ?? params?.fat,
    defaultFatGrams
  );
  const dailyCalories = resolveDailyCalories(params, proteinGrams, carbGrams, fatGrams);

  // Spread first so reason and any extra tool fields survive, then overwrite the numbers
  // we just resolved. Confirm saves this object, so a blank macro can't land as 0.
  const mergedParams = {
    ...params,
    protein: proteinGrams,
    carbs: carbGrams,
    fat: fatGrams,
    calories: dailyCalories,
  };

  return (
    <ToolModalBody title="Update nutrition targets?" reasoning={reasoning}>
      <DetailRow label="Daily calories" value={`${dailyCalories} kcal`} />
      <DetailRow label="Protein" value={`${proteinGrams}g`} />
      <DetailRow label="Carbs" value={`${carbGrams}g`} />
      <DetailRow label="Fat" value={`${fatGrams}g`} />
      <DetailRow label="Reason" value={params?.reason} />
      <ConfirmCancelRow
        onConfirm={() => onConfirm(mergedParams)}
        onCancel={onCancel}
        loading={loading}
      />
    </ToolModalBody>
  );
}
