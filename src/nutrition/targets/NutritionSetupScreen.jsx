// Design Law first-time nutrition onboarding (PNG 19/20 Set your numbers language).
// Flow: step 1 calories → step 2 macros → step 3 love/skip foods → save to users/{uid}.
// Used when getDailyGoals returns null. Firestore field letters stay frozen.
//
// vocab: HardShadow = solid offset shadow; NbSlider = gradient-fill track + ink knob

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

const CAL_SLIDER_GRAD = accentGradients[3];
const PROTEIN_SLIDER_GRAD = accentGradients[2];
const CARBS_SLIDER_GRAD = accentGradients[1];
const FAT_SLIDER_GRAD = accentGradients[4];

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

const PRESETS = {
  balanced: { id: 'balanced', label: 'Balanced', p: 0.3, c: 0.4, f: 0.3 },
  high_protein: { id: 'high_protein', label: 'High protein', p: 0.4, c: 0.3, f: 0.3 },
  low_carb: { id: 'low_carb', label: 'Low carb', p: 0.35, c: 0.2, f: 0.45 },
};

// ===== HELPER FUNCTIONS =====

function clampCalories(rawCalories) {
  return Math.min(MAX_DAILY_CALORIES, Math.max(MIN_DAILY_CALORIES, Math.round(Number(rawCalories) || 0)));
}

function macrosFromCalorieTarget(calorieTarget) {
  const calories = clampCalories(calorieTarget);
  return {
    protein: Math.round((calories * PROTEIN_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    carbs: Math.round((calories * CARBS_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    fat: Math.round((calories * FAT_SPLIT_FRACTION) / KCAL_PER_GRAM_FAT),
  };
}

function macrosFromPreset(calories, preset) {
  const cal = clampCalories(calories);
  return {
    protein: Math.round((cal * preset.p) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    carbs: Math.round((cal * preset.c) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    fat: Math.round((cal * preset.f) / KCAL_PER_GRAM_FAT),
  };
}

function toggleNameInList(previousList, name) {
  if (previousList.includes(name)) return previousList.filter((item) => item !== name);
  return [...previousList, name];
}

function appendUniqueName(previousList, name) {
  if (previousList.includes(name)) return previousList;
  return [...previousList, name];
}

function footerPadFromInsets(safeBottom, reservedBottomInset) {
  return Math.max(safeBottom, MIN_SAFE_BOTTOM_PAD) + Math.max(reservedBottomInset, 0) + EXTRA_FOOTER_PAD;
}

function macrosAddUpKcal(macros) {
  return Math.round(
    (Number(macros.protein) || 0) * KCAL_PER_GRAM_PROTEIN_OR_CARB
      + (Number(macros.carbs) || 0) * KCAL_PER_GRAM_PROTEIN_OR_CARB
      + (Number(macros.fat) || 0) * KCAL_PER_GRAM_FAT,
  );
}

/**
 * Step 1 — PNG 19 black calories card + preset chips preview.
 */
function CalorieGoalStep({ onNext, calories, setCalories, footerPadBottom, colors }) {
  const clamped = clampCalories(calories);
  const est = macrosFromCalorieTarget(clamped);
  const keyboardBehavior = Platform.OS === PLATFORM_IOS ? 'padding' : undefined;

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: footerPadBottom }]}
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
            <Text style={[styles.calValue, { color: colors.nbOnFill }]}>
              {clamped.toLocaleString()} kcal
            </Text>
            <NbSlider
              value={clamped}
              min={MIN_DAILY_CALORIES}
              max={MAX_DAILY_CALORIES}
              onChange={setCalories}
              colors={CAL_SLIDER_GRAD}
              style={{ marginTop: 12, marginBottom: 14 }}
            />
            <TouchableOpacity
              onPress={() =>
                Alert.alert('Coming soon', 'Use the slider to set your goal for now.')
              }
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
              {`P ${est.protein}g · C ${est.carbs}g · F ${est.fat}g`}
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
function MacrosStep({ onNext, onBack, macros, setMacros, calories, footerPadBottom, colors }) {
  const [presetId, setPresetId] = useState('balanced');
  const keyboardBehavior = Platform.OS === PLATFORM_IOS ? 'padding' : undefined;
  const addUp = macrosAddUpKcal(macros);

  const applyPreset = (preset) => {
    setPresetId(preset.id);
    setMacros(macrosFromPreset(calories, preset));
  };

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: footerPadBottom }]}
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
          {Object.values(PRESETS).map((preset) => {
            const selected = presetId === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                onPress={() => applyPreset(preset)}
                activeOpacity={0.88}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: selected ? colors.nbFill : colors.nbSurface,
                    borderColor: colors.nbBorder,
                    shadowColor: colors.nbShadow,
                  },
                  selected && styles.presetChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: selected ? colors.nbOnFill : colors.nbInk },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
              max={500}
              onChange={(n) => {
                setPresetId(null);
                setMacros({ ...macros, protein: n });
              }}
              colors={PROTEIN_SLIDER_GRAD}
              style={styles.macroSlider}
            />
            <NbSlider
              label="Carbs"
              valueLabel={`${macros.carbs} g`}
              value={macros.carbs}
              min={0}
              max={600}
              onChange={(n) => {
                setPresetId(null);
                setMacros({ ...macros, carbs: n });
              }}
              colors={CARBS_SLIDER_GRAD}
              style={styles.macroSlider}
            />
            <NbSlider
              label="Fats"
              valueLabel={`${macros.fat} g`}
              value={macros.fat}
              min={0}
              max={200}
              onChange={(n) => {
                setPresetId(null);
                setMacros({ ...macros, fat: n });
              }}
              colors={FAT_SLIDER_GRAD}
              style={styles.macroSlider}
            />
            <View style={[styles.macroFooter, { borderTopColor: colors.nbBorder }]}>
              <Text style={[styles.macroFooterLabel, { color: colors.nbMuted }]}>
                MACROS ADD UP TO
              </Text>
              <Text style={[styles.macroFooterValue, { color: colors.nbInk }]}>
                {addUp.toLocaleString()} kcal
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
 * Chip list for favorite or least-favorite presets — ink fill when selected.
 */
function FoodPresetChips({ presets, selectedNames, onToggle, colors, selectedFill }) {
  return (
    <View style={styles.chipsWrap}>
      {presets.map((name) => {
        const selected = selectedNames.includes(name);
        return (
          <TouchableOpacity
            key={name}
            onPress={() => onToggle(name)}
            activeOpacity={0.85}
            style={[
              styles.pill,
              {
                borderColor: colors.nbBorder,
                backgroundColor: selected
                  ? selectedFill || colors.nbFill
                  : colors.nbSurface,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: selected ? colors.nbOnFill : colors.nbInk },
              ]}
            >
              {name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Step 3 — foods you love and skip.
 */
function FavoriteFoodsStep({ onBack, onFinish, footerPadBottom, colors }) {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState([]);
  const [leastFavorites, setLeastFavorites] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [addMode, setAddMode] = useState(ADD_MODE_FAVORITE);
  const bottomPad = Math.max(
    footerPadBottom || 0,
    Math.max(insets.bottom, MIN_SAFE_BOTTOM_PAD) + FAVORITE_FOOTER_EXTRA,
  );
  const keyboardBehavior = Platform.OS === PLATFORM_IOS ? 'padding' : undefined;
  const keyboardOffset = Platform.OS === PLATFORM_IOS ? KEYBOARD_OFFSET_IOS : 0;
  const hasAnySelection = favorites.length > 0 || leastFavorites.length > 0;
  const customPlaceholder =
    addMode === ADD_MODE_FAVORITE ? 'Add a favorite…' : 'Add a least favorite…';

  const addCustom = () => {
    const name = inputValue.trim();
    if (!name) return;
    if (addMode === ADD_MODE_FAVORITE) {
      setFavorites((previous) => appendUniqueName(previous, name));
    } else {
      setLeastFavorites((previous) => appendUniqueName(previous, name));
    }
    setInputValue('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={keyboardBehavior}
      keyboardVerticalOffset={keyboardOffset}
    >
      <View style={[styles.container, { flex: 1, paddingBottom: 0 }]}>
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
            onToggle={(name) => setFavorites((previous) => toggleNameInList(previous, name))}
            colors={colors}
          />

          <Text style={[styles.groupTitle, { color: colors.nbInk, marginTop: 22 }]}>
            Least favorites
          </Text>
          <FoodPresetChips
            presets={LEAST_FAVORITE_PRESETS}
            selectedNames={leastFavorites}
            onToggle={(name) => setLeastFavorites((previous) => toggleNameInList(previous, name))}
            colors={colors}
          />

          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall} style={{ marginTop: 20 }}>
            <View
              style={[
                styles.inputCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <TouchableOpacity onPress={() => setAddMode(ADD_MODE_FAVORITE)} style={{ padding: 6 }}>
                <Ionicons
                  name="heart"
                  size={18}
                  color={addMode === ADD_MODE_FAVORITE ? colors.nbInk : colors.nbMuted}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAddMode(ADD_MODE_LEAST)} style={{ padding: 6 }}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={addMode === ADD_MODE_LEAST ? colors.nbInk : colors.nbMuted}
                />
              </TouchableOpacity>
              <TextInput
                style={[styles.customInput, { color: colors.nbInk }]}
                placeholder={customPlaceholder}
                placeholderTextColor={colors.nbMuted}
                value={inputValue}
                onChangeText={setInputValue}
                onSubmitEditing={addCustom}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={addCustom}
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
              Selected: {favorites.length} favorites · {leastFavorites.length} least favorites
            </Text>
          ) : null}
          <NbButton
            variant="fill"
            onPress={() => onFinish?.({ favorites, leastFavorites })}
          >
            Finish Setup
          </NbButton>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

async function saveOnboardingToUserDoc(userId, firestoreDb, payload) {
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

// ===== MAIN FUNCTION =====

export const NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE = TAB_BAR_CLEARANCE;

/**
 * Three-step nutrition onboarding for users with no daily goals yet.
 * @param {{ onComplete?: Function, reservedBottomInset?: number }} props
 */
export const NutritionNewUserSetupScreen = ({ onComplete, reservedBottomInset = 0 }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const footerPadBottom = footerPadFromInsets(insets.bottom, reservedBottomInset);
  const [currentStep, setStep] = useState(STEP_CALORIES);
  const [calories, setCalories] = useState(DEFAULT_CALORIES);
  const [macros, setMacros] = useState({
    protein: DEFAULT_PROTEIN_GRAMS,
    carbs: DEFAULT_CARBS_GRAMS,
    fat: DEFAULT_FAT_GRAMS,
  });

  const handleFinish = async (foodPrefs = {}) => {
    const favorites = Array.isArray(foodPrefs.favorites) ? foodPrefs.favorites : [];
    const leastFavorites = Array.isArray(foodPrefs.leastFavorites) ? foodPrefs.leastFavorites : [];
    try {
      const { auth, db } = require('../../app-start/cloudConnection');
      const userId = auth?.currentUser?.uid;
      if (userId && db) {
        await saveOnboardingToUserDoc(userId, db, { favorites, leastFavorites, calories, macros });
      }
    } catch (error) {
      console.warn('nutrition onboarding save:', error?.message || error);
    }
    if (onComplete) onComplete({ calories, macros, favorites, leastFavorites });
  };

  const goFromCaloriesToMacros = () => {
    const lockedCalories = clampCalories(calories);
    setCalories(lockedCalories);
    setMacros(macrosFromCalorieTarget(lockedCalories));
    setStep(STEP_MACROS);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>
      {currentStep === STEP_CALORIES ? (
        <CalorieGoalStep
          onNext={goFromCaloriesToMacros}
          calories={calories}
          setCalories={setCalories}
          footerPadBottom={footerPadBottom}
          colors={colors}
        />
      ) : null}
      {currentStep === STEP_MACROS ? (
        <MacrosStep
          onNext={() => setStep(STEP_FOODS)}
          onBack={() => setStep(STEP_CALORIES)}
          macros={macros}
          setMacros={setMacros}
          calories={calories}
          footerPadBottom={footerPadBottom}
          colors={colors}
        />
      ) : null}
      {currentStep === STEP_FOODS ? (
        <FavoriteFoodsStep
          onBack={() => setStep(STEP_MACROS)}
          onFinish={handleFinish}
          footerPadBottom={footerPadBottom}
          colors={colors}
        />
      ) : null}
    </View>
  );
};

export default NutritionNewUserSetupScreen;

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
