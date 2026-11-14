// Design Law first-time nutrition onboarding (PNG 19/20 Set your numbers language).
// Flow: step 1 calories → step 2 macros → step 3 love/skip foods → save to users/{uid}.
// Used when getDailyGoals returns null. Firestore field letters stay frozen.
//
// vocab: HardShadow = solid offset shadow; NbSlider = gradient-fill track + ink knob
// vocab: setDoc merge = write listed fields without wiping the rest of users/{uid}

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbSlider from '../../look-and-feel/NbSlider';
import NbProgressSteps from '../../look-and-feel/NbProgressSteps';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: calorie slider bounds + default daily targets
const MIN_DAILY_CALORIES = 500;
const MAX_DAILY_CALORIES = 5000;
const DEFAULT_CALORIES = 2000;
const DEFAULT_PROTEIN_GRAMS = 150;
const DEFAULT_CARBS_GRAMS = 200;
const DEFAULT_FAT_GRAMS = 65;

const PROTEIN_SPLIT_FRACTION = 0.3;
const CARBS_SPLIT_FRACTION = 0.4;
const FAT_SPLIT_FRACTION = 0.3;
const KCAL_PER_GRAM_PROTEIN_OR_CARB = 4;
const KCAL_PER_GRAM_FAT = 9;

const TOTAL_ONBOARDING_STEPS = 3;
const STEP_CALORIES = 1;
const STEP_MACROS = 2;
const STEP_FOODS = 3;

const MIN_SAFE_BOTTOM_PAD = 20;
const EXTRA_FOOTER_PAD = 28;
const FAVORITE_FOOTER_EXTRA = 24;
const KEYBOARD_OFFSET_IOS = 12;
/** Matches BottomMenuBar minHeight when tab bar overlays this screen. */
const TAB_BAR_CLEARANCE = 88;

const USERS_COLLECTION = 'users';
const ADD_MODE_FAVORITE = 'favorite';
const ADD_MODE_LEAST = 'least';
const PLATFORM_IOS = 'ios';

const PRESET_ID_BALANCED = 'balanced';
const PRESET_ID_HIGH_PROTEIN = 'high_protein';
const PRESET_ID_LOW_CARB = 'low_carb';

const PROTEIN_SLIDER_MAX = 500;
const CARBS_SLIDER_MAX = 600;
const FAT_SLIDER_MAX = 200;

const CAL_SLIDER_GRAD = accentGradients[3];
const PROTEIN_SLIDER_GRAD = accentGradients[2];
const CARBS_SLIDER_GRAD = accentGradients[1];
const FAT_SLIDER_GRAD = accentGradients[4];

// Manipulate here: preset chip food names shown on step 3
const FAVORITE_PRESETS = [
  'Chicken Breast',
  'Eggs',
  'Greek Yogurt',
  'Salmon',
  'Brown Rice',
  'Oats',
  'Avocado',
  'Broccoli',
  'Banana',
  'Sweet Potato',
];

const LEAST_FAVORITE_PRESETS = [
  'Liver',
  'Cottage Cheese',
  'Tuna',
  'Kale',
  'Protein Powder',
  'Celery',
  'Brussels Sprouts',
  'Plain Egg Whites',
];

// Macro split presets — ids stay frozen for any saved preference keys.
const MACRO_PRESETS = {
  balanced: {
    id: PRESET_ID_BALANCED,
    label: 'Balanced',
    proteinShare: 0.3,
    carbsShare: 0.4,
    fatShare: 0.3,
  },
  high_protein: {
    id: PRESET_ID_HIGH_PROTEIN,
    label: 'High protein',
    proteinShare: 0.4,
    carbsShare: 0.3,
    fatShare: 0.3,
  },
  low_carb: {
    id: PRESET_ID_LOW_CARB,
    label: 'Low carb',
    proteinShare: 0.35,
    carbsShare: 0.2,
    fatShare: 0.45,
  },
};

// ===== HELPER FUNCTIONS =====

/**
 * Coerce any value to a trimmed string (empty when missing).
 * @param {*} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return asTrimmedString(value);
}


/**
 * Clamp a calorie number into the slider bounds (rounded).
 * @param {*} rawCalories
 * @returns {number}
 */
function clampCaloriesInsideBounds(rawCalories) {
  const asNumber = Math.round(Number(rawCalories) || 0);
  const atLeastMin = Math.max(MIN_DAILY_CALORIES, asNumber);
  return Math.min(MAX_DAILY_CALORIES, atLeastMin);
}

/**
 * Balanced P/C/F grams from a calorie target (default split fractions).
 * @param {number} calorieTarget
 * @returns {{ protein: number, carbs: number, fat: number }}
 */
function estimateMacrosFromCalorieTarget(calorieTarget) {
  const calories = clampCaloriesInsideBounds(calorieTarget);
  return {
    protein: Math.round((calories * PROTEIN_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    carbs: Math.round((calories * CARBS_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    fat: Math.round((calories * FAT_SPLIT_FRACTION) / KCAL_PER_GRAM_FAT),
  };
}

/**
 * P/C/F grams from a named macro preset + calorie target.
 * @param {number} calories
 * @param {{ proteinShare: number, carbsShare: number, fatShare: number }} preset
 * @returns {{ protein: number, carbs: number, fat: number }}
 */
function estimateMacrosFromPresetAndCalories(calories, preset) {
  const clampedCalories = clampCaloriesInsideBounds(calories);
  return {
    protein: Math.round(
      (clampedCalories * preset.proteinShare) / KCAL_PER_GRAM_PROTEIN_OR_CARB,
    ),
    carbs: Math.round(
      (clampedCalories * preset.carbsShare) / KCAL_PER_GRAM_PROTEIN_OR_CARB,
    ),
    fat: Math.round((clampedCalories * preset.fatShare) / KCAL_PER_GRAM_FAT),
  };
}

/**
 * Toggle a food name in / out of a list (immutably).
 * @param {string[]} previousList
 * @param {string} foodName
 * @returns {string[]}
 */
function toggleFoodNameInList(previousList, foodName) {
  if (previousList.includes(foodName)) {
    return previousList.filter((item) => item !== foodName);
  }
  return [...previousList, foodName];
}

/**
 * Append a food name when it is not already in the list.
 * @param {string[]} previousList
 * @param {string} foodName
 * @returns {string[]}
 */
function appendFoodNameIfMissing(previousList, foodName) {
  if (previousList.includes(foodName)) return previousList;
  return [...previousList, foodName];
}

/**
 * Scroll footer pad from safe-area + reserved tab-bar inset.
 * @param {number} safeBottom
 * @param {number} reservedBottomInset
 * @returns {number}
 */
function footerScrollPaddingFromInsets(safeBottom, reservedBottomInset) {
  const safePad = Math.max(safeBottom, MIN_SAFE_BOTTOM_PAD);
  const reserved = Math.max(reservedBottomInset, 0);
  return safePad + reserved + EXTRA_FOOTER_PAD;
}

/**
 * Convert macro grams to total kilocalories (P/C = 4, fat = 9).
 * @param {{ protein: number, carbs: number, fat: number }} macros
 * @returns {number}
 */
function sumMacroGramsAsKilocalories(macros) {
  const proteinKcal = (Number(macros.protein) || 0) * KCAL_PER_GRAM_PROTEIN_OR_CARB;
  const carbsKcal = (Number(macros.carbs) || 0) * KCAL_PER_GRAM_PROTEIN_OR_CARB;
  const fatKcal = (Number(macros.fat) || 0) * KCAL_PER_GRAM_FAT;
  return Math.round(proteinKcal + carbsKcal + fatKcal);
}

/**
 * Merge onboarding targets + food prefs onto users/{uid}.
 * Field letters: nutritionFavoriteFoods, nutritionLeastFavoriteFoods,
 * calorieTarget, macroTargets, updatedAt — frozen.
 * @param {string} userId
 * @param {*} firestoreDb
 * @param {object} payload
 */
async function writeNutritionOnboardingToUserDoc(userId, firestoreDb, payload) {
  const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
  await setDoc(
    doc(firestoreDb, USERS_COLLECTION, userId),
    {
      nutritionFavoriteFoods: payload.favorites,
      nutritionLeastFavoriteFoods: payload.leastFavorites,
      calorieTarget: payload.calories,
      macroTargets: payload.macros,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * KeyboardAvoidingView behavior — padding on iOS, undefined elsewhere.
 * @returns {string|undefined}
 */
function keyboardBehaviorForPlatform() {
  if (Platform.OS === PLATFORM_IOS) return 'padding';
  return undefined;
}

/**
 * Chip list for favorite or least-favorite presets — ink fill when selected.
 */
function FoodPresetChips({ presets, selectedNames, onToggle, colors, selectedFill }) {
  return (
    <View style={styles.chipsWrap}>
      {presets.map((foodName) => {
        const isSelected = selectedNames.includes(foodName);
        const chipFill = isSelected
          ? selectedFill || colors.nbFill
          : colors.nbSurface;
        let chipTextColor = colors.nbInk;
  if (isSelected) {
    chipTextColor = colors.nbOnFill;
  }

        return (
          <TouchableOpacity
            key={foodName}
            onPress={() => onToggle(foodName)}
            activeOpacity={0.85}
            style={[
              styles.pill,
              {
                borderColor: colors.nbBorder,
                backgroundColor: chipFill,
              },
            ]}
          >
            <Text style={[styles.pillText, { color: chipTextColor }]}>{foodName}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * One macro preset chip (Balanced / High protein / Low carb).
 */
function MacroPresetChip({ preset, isSelected, onPick, colors }) {
  let chipBackgroundColor = colors.nbSurface;
  if (isSelected) {
    chipBackgroundColor = colors.nbFill;
  }
  let chipTextColor = colors.nbInk;
  if (isSelected) {
    chipTextColor = colors.nbOnFill;
  }
  let activeShadowStyle = null;
  if (isSelected) {
    activeShadowStyle = styles.presetChipActive;
  }

  return (
    <TouchableOpacity
      onPress={() => onPick(preset)}
      activeOpacity={0.88}
      style={[
        styles.presetChip,
        {
          backgroundColor: chipBackgroundColor,
          borderColor: colors.nbBorder,
          shadowColor: colors.nbShadow,
        },
        activeShadowStyle,
      ]}
    >
      <Text style={[styles.presetChipText, { color: chipTextColor }]}>{preset.label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Step 1 — PNG 19 black calories card + estimated macros preview.
 */
function CalorieGoalStep({
  onNext,
  calories,
  setCalories,
  footerPadBottom,
  topPad = 0,
  colors,
}) {
  const clampedCalories = clampCaloriesInsideBounds(calories);
  const estimatedMacros = estimateMacrosFromCalorieTarget(clampedCalories);
  const keyboardBehavior = keyboardBehaviorForPlatform();
  const estimatedMacrosLine = `P ${estimatedMacros.protein}g · C ${estimatedMacros.carbs}g · F ${estimatedMacros.fat}g`;
  const caloriesDisplay = `${clampedCalories.toLocaleString()} kcal`;

  function showComingSoonCalculateAlert() {
    Alert.alert('Coming soon', 'Use the slider to set your goal for now.');
  }

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: footerPadBottom, paddingTop: topPad },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <NbProgressSteps current={STEP_CALORIES} total={TOTAL_ONBOARDING_STEPS} />
        <Text style={[styles.title, { color: colors.nbInk }]}>Set your numbers</Text>
        <Text style={[styles.subtitle, { color: colors.nbMuted }]}>Daily targets</Text>

        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
          <View
            style={[
              styles.calCard,
              { backgroundColor: colors.nbFill, borderColor: colors.nbOnFill },
            ]}
          >
            <Text style={[styles.calLabel, { color: colors.nbMuted }]}>CALORIES PER DAY</Text>
            <Text style={[styles.calValue, { color: colors.nbOnFill }]}>{caloriesDisplay}</Text>
            <NbSlider
              value={clampedCalories}
              min={MIN_DAILY_CALORIES}
              max={MAX_DAILY_CALORIES}
              onChange={setCalories}
              colors={CAL_SLIDER_GRAD}
              style={{ marginTop: 12, marginBottom: 14 }}
            />
            <TouchableOpacity
              onPress={showComingSoonCalculateAlert}
              activeOpacity={0.88}
              style={[
                styles.calcBtn,
                { backgroundColor: colors.nbOnFill, borderColor: colors.nbFill },
              ]}
            >
              <Text style={[styles.calcBtnText, { color: colors.nbFill }]}>Calculate for me</Text>
            </TouchableOpacity>
          </View>
        </HardShadow>

        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
          <View
            style={[
              styles.previewCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <Text style={[styles.previewLabel, { color: colors.nbMuted }]}>
              Estimated macros at this calorie target
            </Text>
            <Text style={[styles.previewVals, { color: colors.nbInk }]}>
              {estimatedMacrosLine}
            </Text>
          </View>
        </HardShadow>

        <NbButton variant="fill" onPress={onNext}>
          Next
        </NbButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Step 2 — macro preset chips + HardShadow slider card (PNG 19).
 */
function MacrosStep({
  onNext,
  onBack,
  macros,
  setMacros,
  calories,
  footerPadBottom,
  topPad = 0,
  colors,
}) {
  const [presetId, setPresetId] = useState(PRESET_ID_BALANCED);
  const keyboardBehavior = keyboardBehaviorForPlatform();
  const macrosTotalKcal = sumMacroGramsAsKilocalories(macros);
  const macrosTotalDisplay = `${macrosTotalKcal.toLocaleString()} kcal`;
  const presetList = Object.values(MACRO_PRESETS);

  function pickMacroPreset(preset) {
    setPresetId(preset.id);
    setMacros(estimateMacrosFromPresetAndCalories(calories, preset));
  }

  function changeProteinGrams(grams) {
    setPresetId(null);
    setMacros({ ...macros, protein: grams });
  }

  function changeCarbsGrams(grams) {
    setPresetId(null);
    setMacros({ ...macros, carbs: grams });
  }

  function changeFatGrams(grams) {
    setPresetId(null);
    setMacros({ ...macros, fat: grams });
  }

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: footerPadBottom, paddingTop: topPad },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: colors.nbMuted }]}>← Back</Text>
        </TouchableOpacity>
        <NbProgressSteps current={STEP_MACROS} total={TOTAL_ONBOARDING_STEPS} />
        <Text style={[styles.title, { color: colors.nbInk }]}>Set your macros</Text>

        <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>
          MACRO TARGETS AT THIS CALORIE TARGET
        </Text>
        <View style={styles.presetRow}>
          {presetList.map((preset) => (
            <MacroPresetChip
              key={preset.id}
              preset={preset}
              isSelected={presetId === preset.id}
              onPick={pickMacroPreset}
              colors={colors}
            />
          ))}
        </View>

        <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={styles.block}>
          <View
            style={[
              styles.macroCard,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            <NbSlider
              label="Protein"
              valueLabel={`${macros.protein} g`}
              value={macros.protein}
              min={0}
              max={PROTEIN_SLIDER_MAX}
              onChange={changeProteinGrams}
              colors={PROTEIN_SLIDER_GRAD}
              style={styles.macroSlider}
            />
            <NbSlider
              label="Carbs"
              valueLabel={`${macros.carbs} g`}
              value={macros.carbs}
              min={0}
              max={CARBS_SLIDER_MAX}
              onChange={changeCarbsGrams}
              colors={CARBS_SLIDER_GRAD}
              style={styles.macroSlider}
            />
            <NbSlider
              label="Fats"
              valueLabel={`${macros.fat} g`}
              value={macros.fat}
              min={0}
              max={FAT_SLIDER_MAX}
              onChange={changeFatGrams}
              colors={FAT_SLIDER_GRAD}
              style={styles.macroSlider}
            />
            <View style={[styles.macroFooter, { borderTopColor: colors.nbBorder }]}>
              <Text style={[styles.macroFooterLabel, { color: colors.nbMuted }]}>
                MACROS ADD UP TO
              </Text>
              <Text style={[styles.macroFooterValue, { color: colors.nbInk }]}>
                {macrosTotalDisplay}
              </Text>
            </View>
          </View>
        </HardShadow>

        <NbButton variant="fill" onPress={onNext}>
          Next
        </NbButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * Step 3 — foods you love and skip (favorites + least favorites).
 */
function FavoriteFoodsStep({ onBack, onFinish, footerPadBottom, topPad = 0, colors }) {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState([]);
  const [leastFavorites, setLeastFavorites] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [addMode, setAddMode] = useState(ADD_MODE_FAVORITE);

  const bottomPad = Math.max(
    footerPadBottom || 0,
    Math.max(insets.bottom, MIN_SAFE_BOTTOM_PAD) + FAVORITE_FOOTER_EXTRA,
  );
  const keyboardBehavior = keyboardBehaviorForPlatform();
  let keyboardOffset = 0;
  if (Platform.OS === PLATFORM_IOS) {
    keyboardOffset = KEYBOARD_OFFSET_IOS;
  }
  const hasAnySelection = favorites.length > 0 || leastFavorites.length > 0;
  const customPlaceholder =
    addMode === ADD_MODE_FAVORITE ? 'Add a favorite…' : 'Add a least favorite…';
  const favoriteHeartColor =
    addMode === ADD_MODE_FAVORITE ? colors.nbInk : colors.nbMuted;
  const leastFavoriteIconColor =
    addMode === ADD_MODE_LEAST ? colors.nbInk : colors.nbMuted;
  const selectedHintText = `Selected: ${favorites.length} favorites · ${leastFavorites.length} least favorites`;

  function addCustomFoodFromInput() {
    const foodName = inputValue.trim();
    if (!foodName) return;

    if (addMode === ADD_MODE_FAVORITE) {
      setFavorites((previous) => appendFoodNameIfMissing(previous, foodName));
    } else {
      setLeastFavorites((previous) => appendFoodNameIfMissing(previous, foodName));
    }
    setInputValue('');
  }

  function toggleFavoriteName(foodName) {
    setFavorites((previous) => toggleFoodNameInList(previous, foodName));
  }

  function toggleLeastFavoriteName(foodName) {
    setLeastFavorites((previous) => toggleFoodNameInList(previous, foodName));
  }

  function finishWithCurrentFoodPrefs() {
    onFinish?.({ favorites, leastFavorites });
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={[styles.container, { flex: 1, paddingBottom: 0, paddingTop: topPad }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={[styles.backText, { color: colors.nbMuted }]}>← Back</Text>
        </TouchableOpacity>
        <NbProgressSteps current={STEP_FOODS} total={TOTAL_ONBOARDING_STEPS} />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <Text style={[styles.title, { color: colors.nbInk }]}>Foods you love & skip</Text>
          <Text style={[styles.subtitle, { color: colors.nbMuted, marginBottom: 16 }]}>
            Tap pills for favorites and least favorites — the coach and search use these.
          </Text>

          <Text style={[styles.groupTitle, { color: colors.nbInk }]}>Favorites</Text>
          <FoodPresetChips
            presets={FAVORITE_PRESETS}
            selectedNames={favorites}
            onToggle={toggleFavoriteName}
            colors={colors}
          />

          <Text style={[styles.groupTitle, { color: colors.nbInk, marginTop: 22 }]}>
            Least favorites
          </Text>
          <FoodPresetChips
            presets={LEAST_FAVORITE_PRESETS}
            selectedNames={leastFavorites}
            onToggle={toggleLeastFavoriteName}
            colors={colors}
          />

          <HardShadow
            radius={borderRadius.nbCard}
            offset={nb.shadowOffsetSmall}
            style={{ marginTop: 20 }}
          >
            <View
              style={[
                styles.inputCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <TouchableOpacity
                onPress={() => setAddMode(ADD_MODE_FAVORITE)}
                style={{ padding: 6 }}
              >
                <Ionicons name="heart" size={18} color={favoriteHeartColor} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setAddMode(ADD_MODE_LEAST)}
                style={{ padding: 6 }}
              >
                <Ionicons name="close-circle" size={18} color={leastFavoriteIconColor} />
              </TouchableOpacity>
              <TextInput
                style={[styles.customInput, { color: colors.nbInk }]}
                placeholder={customPlaceholder}
                placeholderTextColor={colors.nbMuted}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={addCustomFoodFromInput}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={addCustomFoodFromInput}
                activeOpacity={0.85}
                style={[
                  styles.addBtn,
                  { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.nbOnFill} />
              </TouchableOpacity>
            </View>
          </HardShadow>
        </ScrollView>

        <View style={{ paddingTop: 8, paddingBottom: bottomPad }}>
          {hasAnySelection ? (
            <Text style={[styles.selectedHint, { color: colors.nbMuted }]}>
              {selectedHintText}
            </Text>
          ) : null}
          <NbButton variant="fill" onPress={finishWithCurrentFoodPrefs}>
            Finish Setup
          </NbButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ===== MAIN FUNCTION =====

export const NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE = TAB_BAR_CLEARANCE;

/**
 * Three-step nutrition onboarding when getDailyGoals is still empty.
 */
export const NutritionNewUserSetupScreen = ({ onComplete, reservedBottomInset = 0 }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const footerPadBottom = footerScrollPaddingFromInsets(insets.bottom, reservedBottomInset);
  // Manipulate here: top gap under Dynamic Island — shell does not pad top
  const topPad = Math.max(insets.top, 0) + spacing.md;
  const [currentStep, setStep] = useState(STEP_CALORIES);
  const [calories, setCalories] = useState(DEFAULT_CALORIES);
  const [macros, setMacros] = useState({
    protein: DEFAULT_PROTEIN_GRAMS,
    carbs: DEFAULT_CARBS_GRAMS,
    fat: DEFAULT_FAT_GRAMS,
  });

  async function finishOnboardingWithFoodPrefs(foodPrefs = {}) {
    let favorites = [];
  if (Array.isArray(foodPrefs.favorites)) {
    favorites = foodPrefs.favorites;
  }
    const leastFavorites = Array.isArray(foodPrefs.leastFavorites)
      ? foodPrefs.leastFavorites
      : [];

    // 1. Merge targets + food prefs onto users/{uid} when signed in (field letters frozen).
    try {
      const { auth, db } = require('../../app-start/cloudConnection');
      const userId = auth?.currentUser?.uid;
      if (userId && db) {
        await writeNutritionOnboardingToUserDoc(userId, db, {
          favorites,
          leastFavorites,
          calories,
          macros,
        });
      }
    } catch (error) {
      console.warn('nutrition onboarding save:', error?.message || error);
    }

    // 2. Tell the parent screen to continue either way — local state already has the numbers.
    if (onComplete) onComplete({ calories, macros, favorites, leastFavorites });
  }

  function advanceFromCaloriesStepToMacros() {
    const lockedCalories = clampCaloriesInsideBounds(calories);
    setCalories(lockedCalories);
    setMacros(estimateMacrosFromCalorieTarget(lockedCalories));
    setStep(STEP_MACROS);
  }

  function goToFoodsStep() {
    setStep(STEP_FOODS);
  }

  function goBackToCaloriesStep() {
    setStep(STEP_CALORIES);
  }

  function goBackToMacrosStep() {
    setStep(STEP_MACROS);
  }

  const showCaloriesStep = currentStep === STEP_CALORIES;
  const showMacrosStep = currentStep === STEP_MACROS;
  const showFoodsStep = currentStep === STEP_FOODS;

  return (
    <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>
      {showCaloriesStep ? (
        <CalorieGoalStep
          onNext={advanceFromCaloriesStepToMacros}
          calories={calories}
          setCalories={setCalories}
          footerPadBottom={footerPadBottom}
          topPad={topPad}
          colors={colors}
        />
      ) : null}
      {showMacrosStep ? (
        <MacrosStep
          onNext={goToFoodsStep}
          onBack={goBackToCaloriesStep}
          macros={macros}
          setMacros={setMacros}
          calories={calories}
          footerPadBottom={footerPadBottom}
          topPad={topPad}
          colors={colors}
        />
      ) : null}
      {showFoodsStep ? (
        <FavoriteFoodsStep
          onBack={goBackToMacrosStep}
          onFinish={finishOnboardingWithFoodPrefs}
          footerPadBottom={footerPadBottom}
          topPad={topPad}
          colors={colors}
        />
      ) : null}
    </View>
  );
};

export default NutritionNewUserSetupScreen;

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
    marginTop: 16,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 18,
  },
  block: { marginBottom: 16 },
  calCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
  },
  calLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 8,
  },
  calValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 32,
    letterSpacing: -0.8,
  },
  calcBtn: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    paddingVertical: 12,
    alignItems: 'center',
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  calcBtnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 14,
  },
  previewCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
  },
  previewLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  previewVals: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    textAlign: 'center',
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    minHeight: nb.minTouchTarget,
    justifyContent: 'center',
  },
  presetChipActive: {
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  presetChipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  macroCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 16,
  },
  macroSlider: { marginBottom: 14 },
  macroFooter: {
    borderTopWidth: nb.borderWidthDivider,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  macroFooterLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 0.8,
  },
  macroFooterValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  },
  backBtn: { marginBottom: 8, paddingVertical: 4 },
  backText: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  groupTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    marginBottom: 10,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
  },
  pillText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  customInput: { flex: 1, fontSize: 14, fontFamily: 'Inter_400Regular' },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedHint: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
    textAlign: 'center',
  },
});
