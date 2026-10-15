// First-time nutrition onboarding: calories → macros → favorite / least-favorite foods.
// Flow: step 1 set calories → step 2 tweak macros → step 3 pick food prefs → save to users/{uid}.
// Used when getDailyGoals returns null. Firestore field letters stay frozen.

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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== NAMED CONSTANTS =====

const ONBOARDING_THEME = {
  bg: ['#0a0a1a', '#1a0a2e', '#0d1117'],
  solidBg: '#0d0d1f',
  cardBg: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.5)',
  textVeryMuted: 'rgba(255,255,255,0.4)',
  inputBg: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  hotPink: '#BE185D',
  brandCta: ['#BE185D', '#C2410C'],
  progressFill: ['#BE185D', '#C2410C'],
  progressEmpty: 'rgba(255,255,255,0.1)',
};

const MIN_DAILY_CALORIES = 500;
const MAX_DAILY_CALORIES = 5000;
const DEFAULT_CALORIES = 2000;
const DEFAULT_PROTEIN_GRAMS = 150;
const DEFAULT_CARBS_GRAMS = 200;
const DEFAULT_FAT_GRAMS = 65;
const CALORIE_STEP = 50;
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

const MACRO_FIELDS = [
  { key: 'protein', label: 'Protein' },
  { key: 'carbs', label: 'Carbohydrates' },
  { key: 'fat', label: 'Fat' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Keep daily calories inside the onboarding range.
 * @param {number|string} rawCalories
 * @returns {number}
 */
function clampCalories(rawCalories) {
  return Math.min(MAX_DAILY_CALORIES, Math.max(MIN_DAILY_CALORIES, Math.round(Number(rawCalories) || 0)));
}

/**
 * Suggest macros from a calorie target using a 30/40/30 split.
 * @param {number} calorieTarget
 * @returns {{ protein: number, carbs: number, fat: number }}
 */
function macrosFromCalorieTarget(calorieTarget) {
  const calories = clampCalories(calorieTarget);
  return {
    protein: Math.round((calories * PROTEIN_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    carbs: Math.round((calories * CARBS_SPLIT_FRACTION) / KCAL_PER_GRAM_PROTEIN_OR_CARB),
    fat: Math.round((calories * FAT_SPLIT_FRACTION) / KCAL_PER_GRAM_FAT),
  };
}

/**
 * Show empty string when grams are 0 so the input looks blank until typed.
 * @param {number} grams
 * @returns {string}
 */
function displayGrams(grams) {
  const value = Number(grams) || 0;
  return value ? String(value) : '';
}

/**
 * Parse a macro text field into a non-negative number.
 * @param {string} text
 * @returns {number}
 */
function parseMacroGramsText(text) {
  const cleaned = String(text || '').replace(/[^0-9.]/g, '');
  if (!cleaned) return 0;
  return parseFloat(cleaned) || 0;
}

/**
 * Toggle a food name in a list (add if missing, remove if present).
 * @param {string[]} previousList
 * @param {string} name
 * @returns {string[]}
 */
function toggleNameInList(previousList, name) {
  if (previousList.includes(name)) return previousList.filter((item) => item !== name);
  return [...previousList, name];
}

/**
 * Append a custom food name if it is not already in the list.
 * @param {string[]} previousList
 * @param {string} name
 * @returns {string[]}
 */
function appendUniqueName(previousList, name) {
  if (previousList.includes(name)) return previousList;
  return [...previousList, name];
}

/**
 * Footer padding under the last CTA so the home indicator / tab bar never cover it.
 * @param {number} safeBottom
 * @param {number} reservedBottomInset
 * @returns {number}
 */
function footerPadFromInsets(safeBottom, reservedBottomInset) {
  return Math.max(safeBottom, MIN_SAFE_BOTTOM_PAD) + Math.max(reservedBottomInset, 0) + EXTRA_FOOTER_PAD;
}

/**
 * Three-segment progress bar for the onboarding steps.
 * @param {{ currentStep: number, totalSteps: number }} props
 */
function ProgressBar({ currentStep, totalSteps }) {
  return (
    <View style={progressStyles.row}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <View key={index} style={progressStyles.track}>
          {index < currentStep ? (
            <LinearGradient
              colors={ONBOARDING_THEME.progressFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Active macro card with a pink rim (replaces the old CSS ::before border trick).
 * @param {{ children: *, style?: object }} props
 */
function GlassCardActive({ children, style }) {
  return (
    <View
      style={[
        {
          borderRadius: 20,
          backgroundColor: ONBOARDING_THEME.solidBg,
          borderWidth: 1,
          borderColor: 'rgba(190,24,93,0.45)',
          padding: 16,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Step 1 — pick a daily calorie target.
 * @param {{ onNext: Function, calories: number, setCalories: Function, footerPadBottom: number }} props
 */
function CalorieGoalStep({ onNext, calories, setCalories, footerPadBottom }) {
  const decrement = () => setCalories(clampCalories(calories - CALORIE_STEP));
  const increment = () => setCalories(clampCalories(calories + CALORIE_STEP));
  const clampedCalories = clampCalories(calories);
  const estMacros = macrosFromCalorieTarget(clampedCalories);

  const onCalorieTextChange = (text) => {
    const digits = String(text || '').replace(/\D/g, '');
    if (!digits) {
      setCalories(MIN_DAILY_CALORIES);
      return;
    }
    setCalories(clampCalories(parseInt(digits, 10)));
  };

  const keyboardBehavior = Platform.OS === PLATFORM_IOS ? 'padding' : undefined;

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
      <View style={[stepStyles.container, { paddingBottom: footerPadBottom }]}>
        <ProgressBar currentStep={STEP_CALORIES} totalSteps={TOTAL_ONBOARDING_STEPS} />
        <Text style={stepStyles.title}>Set Your Calorie Goal</Text>

        <View style={[stepStyles.heroCard, stepStyles.heroCardFlat]}>
          <Text style={stepStyles.heroKicker}>DAILY CALORIE TARGET</Text>

          <View style={stepStyles.counterRow}>
            <TouchableOpacity onPress={decrement} activeOpacity={0.8} style={stepStyles.counterBtn}>
              <Text style={stepStyles.counterBtnText}>−</Text>
            </TouchableOpacity>

            <View style={stepStyles.numberBlock}>
              <TextInput
                style={stepStyles.bigNumberInput}
                value={String(clampedCalories)}
                onChangeText={onCalorieTextChange}
                keyboardType="number-pad"
                maxLength={4}
                selectTextOnFocus
                accessibilityLabel="Daily calorie target"
              />
              <Text style={stepStyles.kcalLabel}>kcal / day</Text>
            </View>

            <TouchableOpacity onPress={increment} activeOpacity={0.8} style={stepStyles.counterBtn}>
              <Text style={stepStyles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => Alert.alert('Coming soon', 'Use +/− or tap the number to set your goal for now.')}
            activeOpacity={0.7}
            style={stepStyles.calculateLinkWrap}
          >
            <Text style={stepStyles.linkText}>Calculate for me</Text>
          </TouchableOpacity>
        </View>

        <View style={stepStyles.macroPreviewCard}>
          <Text style={stepStyles.estimatedMacrosLabel}>Estimated macros at this calorie target</Text>
          <View style={stepStyles.macroPillRow}>
            <View style={[stepStyles.macroPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[stepStyles.macroPillText, { color: ONBOARDING_THEME.text }]}>
                P {estMacros.protein}g
              </Text>
            </View>
            <View style={[stepStyles.macroPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[stepStyles.macroPillText, { color: ONBOARDING_THEME.text }]}>
                C {estMacros.carbs}g
              </Text>
            </View>
            <View style={[stepStyles.macroPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[stepStyles.macroPillText, { color: ONBOARDING_THEME.text }]}>
                F {estMacros.fat}g
              </Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 12 }} />

        <TouchableOpacity onPress={onNext} activeOpacity={0.85}>
          <LinearGradient
            colors={ONBOARDING_THEME.brandCta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={stepStyles.gradBtn}
          >
            <Text style={stepStyles.gradBtnText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * One macro row — pink rim while the field is focused.
 * @param {object} props
 */
function MacroFieldRow({ fieldKey, label, macros, setMacros, activeField, setActiveField }) {
  const isActive = activeField === fieldKey;
  const inner = (
    <View style={macroStyles.row}>
      <Text style={macroStyles.label}>{label}</Text>
      <View style={macroStyles.inputRow}>
        <TextInput
          style={macroStyles.input}
          value={displayGrams(macros[fieldKey])}
          onChangeText={(text) => {
            setMacros({ ...macros, [fieldKey]: parseMacroGramsText(text) });
          }}
          onFocus={() => setActiveField(fieldKey)}
          onBlur={() => setActiveField(null)}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text style={macroStyles.unit}>g</Text>
      </View>
    </View>
  );

  if (isActive) return <GlassCardActive key={fieldKey}>{inner}</GlassCardActive>;
  return (
    <View key={fieldKey} style={macroStyles.card}>
      {inner}
    </View>
  );
}

/**
 * Step 2 — edit protein / carbs / fat grams.
 * @param {{ onNext: Function, onBack: Function, macros: object, setMacros: Function, footerPadBottom: number }} props
 */
function MacrosStep({ onNext, onBack, macros, setMacros, footerPadBottom }) {
  const [activeField, setActiveField] = useState(null);
  const keyboardBehavior = Platform.OS === PLATFORM_IOS ? 'padding' : undefined;

  return (
    <KeyboardAvoidingView behavior={keyboardBehavior} style={{ flex: 1 }}>
      <View style={[stepStyles.container, { paddingBottom: footerPadBottom }]}>
        <View style={{ position: 'relative', marginBottom: 32 }}>
          <TouchableOpacity onPress={onBack} style={stepStyles.backBtn} activeOpacity={0.7}>
            <Text style={stepStyles.linkText}>← Back</Text>
          </TouchableOpacity>
          <ProgressBar currentStep={STEP_MACROS} totalSteps={TOTAL_ONBOARDING_STEPS} />
        </View>

        <Text style={stepStyles.title}>Set Your Macros</Text>

        <View style={{ gap: 12, flex: 1 }}>
          {MACRO_FIELDS.map(({ key, label }) => (
            <MacroFieldRow
              key={key}
              fieldKey={key}
              label={label}
              macros={macros}
              setMacros={setMacros}
              activeField={activeField}
              setActiveField={setActiveField}
            />
          ))}

          <Text style={[stepStyles.kcalLabel, { textAlign: 'center', marginTop: 16 }]}>
            Editable anytime
          </Text>
        </View>

        <TouchableOpacity onPress={onNext} activeOpacity={0.85} style={{ marginTop: 'auto' }}>
          <LinearGradient
            colors={ONBOARDING_THEME.brandCta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={stepStyles.gradBtn}
          >
            <Text style={stepStyles.gradBtnText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Chip list for favorite or least-favorite presets.
 * @param {object} props
 */
function FoodPresetChips({ presets, selectedNames, onToggle, selectedStyle, filledIcon, outlineIcon }) {
  return (
    <View style={favoriteStyles.chipsWrap}>
      {presets.map((name) => {
        const selected = selectedNames.includes(name);
        return (
          <TouchableOpacity
            key={name}
            onPress={() => onToggle(name)}
            activeOpacity={0.85}
            style={[favoriteStyles.pill, selected && selectedStyle]}
          >
            <Ionicons
              name={selected ? filledIcon : outlineIcon}
              size={14}
              color={selected ? '#fff' : ONBOARDING_THEME.text}
            />
            <Text style={[favoriteStyles.pillText, selected && { color: '#fff' }]}>{name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Step 3 — pick foods you love and foods to skip.
 * @param {{ onBack: Function, onFinish: Function, footerPadBottom: number }} props
 */
function FavoriteFoodsStep({ onBack, onFinish, footerPadBottom }) {
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
  const favoriteHeartColor = addMode === ADD_MODE_FAVORITE ? '#BE185D' : ONBOARDING_THEME.textMuted;
  const leastIconColor = addMode === ADD_MODE_LEAST ? '#ef4444' : ONBOARDING_THEME.textMuted;
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
      <View style={[stepStyles.container, { flex: 1, paddingBottom: 0 }]}>
        <View style={{ position: 'relative', marginBottom: 16 }}>
          <TouchableOpacity onPress={onBack} style={stepStyles.backBtn} activeOpacity={0.7}>
            <Text style={stepStyles.linkText}>← Back</Text>
          </TouchableOpacity>
          <ProgressBar currentStep={STEP_FOODS} totalSteps={TOTAL_ONBOARDING_STEPS} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <Text style={stepStyles.title}>Foods you love & skip</Text>
          <Text
            style={{
              color: ONBOARDING_THEME.textMuted,
              fontSize: 14,
              marginBottom: 16,
              lineHeight: 20,
            }}
          >
            Tap pills for favorites and least favorites — just like exercise prefs in client onboarding.
          </Text>

          <Text style={{ color: ONBOARDING_THEME.text, fontWeight: '700', marginBottom: 10 }}>
            Favorites
          </Text>
          <FoodPresetChips
            presets={FAVORITE_PRESETS}
            selectedNames={favorites}
            onToggle={(name) => setFavorites((previous) => toggleNameInList(previous, name))}
            selectedStyle={favoriteStyles.pillSelectedGood}
            filledIcon="heart"
            outlineIcon="heart-outline"
          />

          <Text
            style={{
              color: ONBOARDING_THEME.text,
              fontWeight: '700',
              marginTop: 22,
              marginBottom: 10,
            }}
          >
            Least favorites
          </Text>
          <FoodPresetChips
            presets={LEAST_FAVORITE_PRESETS}
            selectedNames={leastFavorites}
            onToggle={(name) => setLeastFavorites((previous) => toggleNameInList(previous, name))}
            selectedStyle={favoriteStyles.pillSelectedBad}
            filledIcon="close-circle"
            outlineIcon="close-circle-outline"
          />

          <View style={[favoriteStyles.inputCard, { marginTop: 20 }]}>
            <TouchableOpacity onPress={() => setAddMode(ADD_MODE_FAVORITE)} style={{ padding: 6 }}>
              <Ionicons name="heart" size={18} color={favoriteHeartColor} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddMode(ADD_MODE_LEAST)} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={18} color={leastIconColor} />
            </TouchableOpacity>
            <TextInput
              style={favoriteStyles.input}
              placeholder={customPlaceholder}
              placeholderTextColor={ONBOARDING_THEME.textMuted}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={addCustom}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addCustom} activeOpacity={0.85}>
              <LinearGradient colors={ONBOARDING_THEME.brandCta} style={favoriteStyles.addBtn}>
                <Ionicons name="add" size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={{ paddingTop: 8, paddingBottom: bottomPad }}>
          {hasAnySelection ? (
            <Text
              style={{
                color: ONBOARDING_THEME.textMuted,
                fontSize: 12,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              Selected: {favorites.length} favorites · {leastFavorites.length} least favorites
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={() => onFinish?.({ favorites, leastFavorites })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={ONBOARDING_THEME.brandCta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={stepStyles.gradBtn}
            >
              <Text style={stepStyles.gradBtnText}>Finish Setup</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * Persist food prefs + targets onto the signed-in user doc (merge).
 * Firestore path letters stay: users/{uid} fields listed below.
 * @param {string} userId
 * @param {*} firestoreDb
 * @param {object} payload
 * @returns {Promise<void>}
 */
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

/**
 * Clearance under the onboarding footer when the shell tab bar is visible.
 * Manipulate here: raise if the Finish button sits under the tab bar.
 */
export const NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE = TAB_BAR_CLEARANCE;

/**
 * Three-step nutrition onboarding for users with no daily goals yet.
 * @param {{ onComplete?: Function, reservedBottomInset?: number }} props
 */
export const NutritionNewUserSetupScreen = ({ onComplete, reservedBottomInset = 0 }) => {
  const insets = useSafeAreaInsets();
  // Shell edges omit bottom inset (tab bar owns it). When the tab bar is hidden during
  // onboarding, reserve the home-indicator + breathing room ourselves.
  const footerPadBottom = footerPadFromInsets(insets.bottom, reservedBottomInset);
  const [currentStep, setStep] = useState(STEP_CALORIES);
  const [calories, setCalories] = useState(DEFAULT_CALORIES);
  const [macros, setMacros] = useState({
    protein: DEFAULT_PROTEIN_GRAMS,
    carbs: DEFAULT_CARBS_GRAMS,
    fat: DEFAULT_FAT_GRAMS,
  });

  // 1. Write prefs to Firestore (best effort), then hand results to the parent.
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

  // 2. Leaving step 1 locks calories and seeds macros from the split.
  const goFromCaloriesToMacros = () => {
    const lockedCalories = clampCalories(calories);
    setCalories(lockedCalories);
    setMacros(macrosFromCalorieTarget(lockedCalories));
    setStep(STEP_MACROS);
  };

  return (
    <LinearGradient colors={ONBOARDING_THEME.bg} style={{ flex: 1 }}>
      {currentStep === STEP_CALORIES ? (
        <CalorieGoalStep
          onNext={goFromCaloriesToMacros}
          calories={calories}
          setCalories={setCalories}
          footerPadBottom={footerPadBottom}
        />
      ) : null}
      {currentStep === STEP_MACROS ? (
        <MacrosStep
          onNext={() => setStep(STEP_FOODS)}
          onBack={() => setStep(STEP_CALORIES)}
          macros={macros}
          setMacros={setMacros}
          footerPadBottom={footerPadBottom}
        />
      ) : null}
      {currentStep === STEP_FOODS ? (
        <FavoriteFoodsStep
          onBack={() => setStep(STEP_MACROS)}
          onFinish={handleFinish}
          footerPadBottom={footerPadBottom}
        />
      ) : null}
    </LinearGradient>
  );
};

export default NutritionNewUserSetupScreen;

const progressStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, width: 200, alignSelf: 'center' },
  track: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    backgroundColor: ONBOARDING_THEME.progressEmpty,
    overflow: 'hidden',
  },
});

const macroStyles = StyleSheet.create({
  card: {
    backgroundColor: ONBOARDING_THEME.cardBg,
    borderWidth: 1,
    borderColor: ONBOARDING_THEME.cardBorder,
    borderRadius: 20,
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: ONBOARDING_THEME.text, fontWeight: '600', fontSize: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    width: 64,
    textAlign: 'right',
    backgroundColor: 'transparent',
    color: ONBOARDING_THEME.text,
    fontWeight: '700',
    fontSize: 18,
  },
  unit: { color: ONBOARDING_THEME.textMuted, fontSize: 14 },
});

const favoriteStyles = StyleSheet.create({
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ONBOARDING_THEME.cardBg,
    borderWidth: 1,
    borderColor: ONBOARDING_THEME.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: { flex: 1, color: ONBOARDING_THEME.text, fontSize: 14 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ONBOARDING_THEME.cardBorder,
    backgroundColor: ONBOARDING_THEME.cardBg,
  },
  pillSelectedGood: {
    backgroundColor: '#BE185D',
    borderColor: '#BE185D',
  },
  pillSelectedBad: {
    backgroundColor: '#B91C1C',
    borderColor: '#B91C1C',
  },
  pillText: { color: ONBOARDING_THEME.text, fontSize: 13, fontWeight: '600' },
});

const stepStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    color: ONBOARDING_THEME.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  heroRim: {
    borderRadius: 22,
    padding: 1,
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 21,
    backgroundColor: ONBOARDING_THEME.solidBg,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  heroCardFlat: {
    borderWidth: 1,
    borderColor: ONBOARDING_THEME.cardBorder,
    marginBottom: 16,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: ONBOARDING_THEME.textMuted,
    marginBottom: 16,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  counterBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ONBOARDING_THEME.cardBg,
    borderWidth: 1,
    borderColor: ONBOARDING_THEME.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { color: ONBOARDING_THEME.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
  numberBlock: { flex: 1, alignItems: 'center', minWidth: 0 },
  bigNumberInput: {
    color: ONBOARDING_THEME.text,
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 62,
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: 0,
  },
  kcalLabel: { color: ONBOARDING_THEME.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  calculateLinkWrap: { marginTop: 16 },
  linkText: {
    color: ONBOARDING_THEME.hotPink,
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  macroPreviewCard: {
    backgroundColor: ONBOARDING_THEME.cardBg,
    borderWidth: 1,
    borderColor: ONBOARDING_THEME.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  estimatedMacrosLabel: {
    fontSize: 12,
    color: ONBOARDING_THEME.textVeryMuted,
    marginBottom: 10,
    textAlign: 'center',
  },
  macroPillRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  macroPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  macroPillText: { fontSize: 13, fontWeight: '700' },
  backBtn: { position: 'absolute', left: 0, zIndex: 10, paddingVertical: 4 },
  gradBtn: {
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
  },
  gradBtnText: { color: 'white', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
