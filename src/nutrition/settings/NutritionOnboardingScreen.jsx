/**
 * Nutrition Onboarding Screen
 *
 * Purpose: UI screen or component: Nutrition Onboarding Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE, NutritionOnboardingWizardScreen
 *
 * @file-header
 */
/**
 * ANATROX — Nutrition Onboarding Screen
 * Converted from Lovable web export (Nutrition_Onboarding.zip) to React Native / Expo
 * Single file — all components inlined, no navbar, no CoachConnect header
 *
 * WHAT WAS IN THE ZIP:
 *   src/pages/Index.tsx                        → NutritionOnboardingWizardScreen (orchestrator)
 *   src/components/CalorieGoalStep.tsx         → CalorieGoalStep (inlined)
 *   src/components/MacrosStep.tsx              → MacrosStep (inlined)
 *   src/components/FavoriteFoodsStep.tsx       → FavoriteFoodsStep (inlined)
 *   src/components/ProgressBar.tsx             → ProgressBar (inlined)
 *
 * REMOVED (web-only, not needed):
 *   - All shadcn/ui components
 *   - react-router-dom
 *   - Tailwind classes → StyleSheet
 *   - lucide-react → Ionicons
 *   - sonner toast → Alert
 *   - CSS pseudo-elements (::before for active border) → LinearGradient wrapper trick
 *   - framer-motion → not used in this file
 *
 * DEPENDENCIES — install if not already present:
 *   npx expo install expo-linear-gradient @expo/vector-icons
 *
 * Firebase is wired and configured in src/app-start/config.js
 *   On handleFinish, write to Firestore:
 *   setDoc(doc(db, 'nutrition_goals', currentUser.uid), {
 *     user_id: currentUser.uid,
 *     calorie_target: calories,
 *     protein_target: macros.protein,
 *     carbs_target: macros.carbs,
 *     fat_target: macros.fat,
 *     macro_split: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
 *     updated_at: serverTimestamp(),
 *   });
 *   Then navigate to main NutritionScreen.
 *
 * USAGE:
 *   Show this screen only when getDailyGoals(uid) returns null (no goals set yet).
 *   <Stack.Screen name="NutritionOnboarding" component={NutritionOnboardingWizardScreen} />
 */

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

// ─────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────

const T = {
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

// ─────────────────────────────────────────────────────────────
// PROGRESS BAR  (was: src/components/ProgressBar.tsx)
// ─────────────────────────────────────────────────────────────

const ProgressBar = ({ currentStep, totalSteps }) => (
  <View style={pb.row}>
    {Array.from({ length: totalSteps }).map((_, i) => (
      <View key={i} style={pb.track}>
        {i < currentStep && (
          <LinearGradient
            colors={T.progressFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        )}
      </View>
    ))}
  </View>
);

const pb = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, width: 200, alignSelf: 'center' },
  track: { flex: 1, height: 4, borderRadius: 99, backgroundColor: T.progressEmpty, overflow: 'hidden' },
});

// ─────────────────────────────────────────────────────────────
// GLASS CARD ACTIVE (gradient border wrapper)
// Replaces CSS ::before pseudo-element gradient border trick
// ─────────────────────────────────────────────────────────────

const GlassCardActive = ({ children, style }) => (
  <View
    style={[
      {
        borderRadius: 20,
        backgroundColor: T.solidBg,
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

// ─────────────────────────────────────────────────────────────
// CALORIE GOAL STEP  (was: src/components/CalorieGoalStep.tsx)
// ─────────────────────────────────────────────────────────────

const clampCalories = (n) => Math.min(5000, Math.max(500, Math.round(Number(n) || 0)));

const CalorieGoalStep = ({ onNext, calories, setCalories, footerPadBottom }) => {
  const decrement = () => setCalories(clampCalories(calories - 50));
  const increment = () => setCalories(clampCalories(calories + 50));
  const cal = clampCalories(calories);
  const estProtein = Math.round(cal * 0.3 / 4);
  const estCarbs = Math.round(cal * 0.4 / 4);
  const estFat = Math.round(cal * 0.3 / 9);

  const onCalorieTextChange = (text) => {
    const digits = String(text || '').replace(/\D/g, '');
    if (!digits) {
      setCalories(500);
      return;
    }
    setCalories(clampCalories(parseInt(digits, 10)));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={[step.container, { paddingBottom: footerPadBottom }]}>
        <ProgressBar currentStep={1} totalSteps={3} />
        <Text style={step.title}>Set Your Calorie Goal</Text>

        <View style={[step.heroCard, step.heroCardFlat]}>
          <Text style={step.heroKicker}>DAILY CALORIE TARGET</Text>

          <View style={step.counterRow}>
              <TouchableOpacity onPress={decrement} activeOpacity={0.8} style={step.counterBtn}>
                <Text style={step.counterBtnText}>−</Text>
              </TouchableOpacity>

              <View style={step.numberBlock}>
                <TextInput
                  style={step.bigNumberInput}
                  value={String(cal)}
                  onChangeText={onCalorieTextChange}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                  accessibilityLabel="Daily calorie target"
                />
                <Text style={step.kcalLabel}>kcal / day</Text>
              </View>

              <TouchableOpacity onPress={increment} activeOpacity={0.8} style={step.counterBtn}>
                <Text style={step.counterBtnText}>+</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => Alert.alert('Coming soon', 'Use +/− or tap the number to set your goal for now.')}
              activeOpacity={0.7}
              style={step.calculateLinkWrap}
            >
              <Text style={step.linkText}>Calculate for me</Text>
            </TouchableOpacity>
        </View>

        <View style={step.macroPreviewCard}>
          <Text style={step.estimatedMacrosLabel}>Estimated macros at this calorie target</Text>
          <View style={step.macroPillRow}>
            <View style={[step.macroPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[step.macroPillText, { color: T.text }]}>P {estProtein}g</Text>
            </View>
            <View style={[step.macroPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[step.macroPillText, { color: T.text }]}>C {estCarbs}g</Text>
            </View>
            <View style={[step.macroPill, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
              <Text style={[step.macroPillText, { color: T.text }]}>F {estFat}g</Text>
            </View>
          </View>
        </View>

        <View style={{ flex: 1, minHeight: 12 }} />

        <TouchableOpacity onPress={onNext} activeOpacity={0.85}>
          <LinearGradient
            colors={T.brandCta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={step.gradBtn}
          >
            <Text style={step.gradBtnText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

// ─────────────────────────────────────────────────────────────
// MACROS STEP  (was: src/components/MacrosStep.tsx)
// ─────────────────────────────────────────────────────────────

const MacrosStep = ({ onNext, onBack, macros, setMacros, footerPadBottom }) => {
  const [activeField, setActiveField] = useState(null);

  const fields = [
    { key: 'protein', label: 'Protein' },
    { key: 'carbs', label: 'Carbohydrates' },
    { key: 'fat', label: 'Fat' },
  ];

  const displayGrams = (g) => {
    const val = Number(g) || 0;
    return val ? String(val) : '';
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={[step.container, { paddingBottom: footerPadBottom }]}>
        <View style={{ position: 'relative', marginBottom: 32 }}>
          <TouchableOpacity onPress={onBack} style={step.backBtn} activeOpacity={0.7}>
            <Text style={step.linkText}>← Back</Text>
          </TouchableOpacity>
          <ProgressBar currentStep={2} totalSteps={3} />
        </View>

        <Text style={step.title}>Set Your Macros</Text>

        <View style={{ gap: 12, flex: 1 }}>
          {fields.map(({ key, label }) => {
            const isActive = activeField === key;
            const inner = (
              <View style={macroS.row}>
                <Text style={macroS.label}>{label}</Text>
                <View style={macroS.inputRow}>
                  <TextInput
                    style={macroS.input}
                    value={displayGrams(macros[key])}
                    onChangeText={(v) => {
                      const cleaned = v.replace(/[^0-9.]/g, '');
                      const num = cleaned ? parseFloat(cleaned) : 0;
                      setMacros({ ...macros, [key]: num || 0 });
                    }}
                    onFocus={() => setActiveField(key)}
                    onBlur={() => setActiveField(null)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                  />
                  <Text style={macroS.unit}>g</Text>
                </View>
              </View>
            );

            return isActive ? (
              <GlassCardActive key={key}>{inner}</GlassCardActive>
            ) : (
              <View key={key} style={macroS.card}>{inner}</View>
            );
          })}

          <Text style={[step.kcalLabel, { textAlign: 'center', marginTop: 16 }]}>
            Editable anytime
          </Text>
        </View>

        <TouchableOpacity onPress={onNext} activeOpacity={0.85} style={{ marginTop: 'auto' }}>
          <LinearGradient
            colors={T.brandCta}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={step.gradBtn}
          >
            <Text style={step.gradBtnText}>Next</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const macroS = StyleSheet.create({
  card: {
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 20,
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: T.text, fontWeight: '600', fontSize: 15 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    width: 64,
    textAlign: 'right',
    backgroundColor: 'transparent',
    color: T.text,
    fontWeight: '700',
    fontSize: 18,
  },
  unit: { color: T.textMuted, fontSize: 14 },
});

// ─────────────────────────────────────────────────────────────
// FAVORITE FOODS STEP  (was: src/components/FavoriteFoodsStep.tsx)
// ─────────────────────────────────────────────────────────────

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

const FavoriteFoodsStep = ({ onBack, onFinish, footerPadBottom }) => {
  const insets = useSafeAreaInsets();
  const [favorites, setFavorites] = useState([]);
  const [leastFavorites, setLeastFavorites] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [addMode, setAddMode] = useState('favorite'); // favorite | least
  const bottomPad = Math.max(footerPadBottom || 0, Math.max(insets.bottom, 20) + 24);

  const togglePreset = (name, list, setList) => {
    setList((prev) => (prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]));
  };

  const addCustom = () => {
    const name = inputValue.trim();
    if (!name) return;
    if (addMode === 'favorite') {
      setFavorites((prev) => (prev.includes(name) ? prev : [...prev, name]));
    } else {
      setLeastFavorites((prev) => (prev.includes(name) ? prev : [...prev, name]));
    }
    setInputValue('');
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      <View style={[step.container, { flex: 1, paddingBottom: 0 }]}>
        <View style={{ position: 'relative', marginBottom: 16 }}>
          <TouchableOpacity onPress={onBack} style={step.backBtn} activeOpacity={0.7}>
            <Text style={step.linkText}>← Back</Text>
          </TouchableOpacity>
          <ProgressBar currentStep={3} totalSteps={3} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 20 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          <Text style={step.title}>Foods you love & skip</Text>
          <Text style={{ color: T.textMuted, fontSize: 14, marginBottom: 16, lineHeight: 20 }}>
            Tap pills for favorites and least favorites — just like exercise prefs in client onboarding.
          </Text>

          <Text style={{ color: T.text, fontWeight: '700', marginBottom: 10 }}>Favorites</Text>
          <View style={favS.chipsWrap}>
            {FAVORITE_PRESETS.map((name) => {
              const selected = favorites.includes(name);
              return (
                <TouchableOpacity
                  key={`fav-${name}`}
                  onPress={() => togglePreset(name, favorites, setFavorites)}
                  activeOpacity={0.85}
                  style={[favS.pill, selected && favS.pillSelectedGood]}
                >
                  <Ionicons name={selected ? 'heart' : 'heart-outline'} size={14} color={selected ? '#fff' : T.text} />
                  <Text style={[favS.pillText, selected && { color: '#fff' }]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={{ color: T.text, fontWeight: '700', marginTop: 22, marginBottom: 10 }}>Least favorites</Text>
          <View style={favS.chipsWrap}>
            {LEAST_FAVORITE_PRESETS.map((name) => {
              const selected = leastFavorites.includes(name);
              return (
                <TouchableOpacity
                  key={`least-${name}`}
                  onPress={() => togglePreset(name, leastFavorites, setLeastFavorites)}
                  activeOpacity={0.85}
                  style={[favS.pill, selected && favS.pillSelectedBad]}
                >
                  <Ionicons name={selected ? 'close-circle' : 'close-circle-outline'} size={14} color={selected ? '#fff' : T.text} />
                  <Text style={[favS.pillText, selected && { color: '#fff' }]}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[favS.inputCard, { marginTop: 20 }]}>
            <TouchableOpacity onPress={() => setAddMode('favorite')} style={{ padding: 6 }}>
              <Ionicons name="heart" size={18} color={addMode === 'favorite' ? '#BE185D' : T.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAddMode('least')} style={{ padding: 6 }}>
              <Ionicons name="close-circle" size={18} color={addMode === 'least' ? '#ef4444' : T.textMuted} />
            </TouchableOpacity>
            <TextInput
              style={favS.input}
              placeholder={addMode === 'favorite' ? 'Add a favorite…' : 'Add a least favorite…'}
              placeholderTextColor={T.textMuted}
              value={inputValue}
              onChangeText={setInputValue}
              onSubmitEditing={addCustom}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={addCustom} activeOpacity={0.85}>
              <LinearGradient colors={T.brandCta} style={favS.addBtn}>
                <Ionicons name="add" size={18} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={{ paddingTop: 8, paddingBottom: bottomPad }}>
          {(favorites.length > 0 || leastFavorites.length > 0) ? (
            <Text style={{ color: T.textMuted, fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
              Selected: {favorites.length} favorites · {leastFavorites.length} least favorites
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={() => onFinish?.({ favorites, leastFavorites })}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={T.brandCta}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={step.gradBtn}
            >
              <Text style={step.gradBtnText}>Finish Setup</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

const favS = StyleSheet.create({
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  input: { flex: 1, color: T.text, fontSize: 14 },
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
    borderColor: T.cardBorder,
    backgroundColor: T.cardBg,
  },
  pillSelectedGood: {
    backgroundColor: '#BE185D',
    borderColor: '#BE185D',
  },
  pillSelectedBad: {
    backgroundColor: '#B91C1C',
    borderColor: '#B91C1C',
  },
  pillText: { color: T.text, fontSize: 13, fontWeight: '600' },
});

const OZ_TO_G = 28.3495;

const step = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  title: {
    color: T.text,
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
    backgroundColor: T.solidBg,
    paddingHorizontal: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  heroCardFlat: {
    borderWidth: 1,
    borderColor: T.cardBorder,
    marginBottom: 16,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: T.textMuted,
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
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnText: { color: T.text, fontSize: 24, fontWeight: '700', lineHeight: 28 },
  numberBlock: { flex: 1, alignItems: 'center', minWidth: 0 },
  bigNumberInput: {
    color: T.text,
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 62,
    textAlign: 'center',
    minWidth: 120,
    paddingVertical: 0,
  },
  kcalLabel: { color: T.textMuted, fontSize: 13, marginTop: 4, textAlign: 'center' },
  calculateLinkWrap: { marginTop: 16 },
  linkText: { color: T.hotPink, fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },
  macroPreviewCard: {
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  estimatedMacrosLabel: {
    fontSize: 12,
    color: T.textVeryMuted,
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

// ─────────────────────────────────────────────────────────────
// NUTRITION ONBOARDING SCREEN
// ─────────────────────────────────────────────────────────────

/** Matches BottomNavBar minHeight when tab bar overlays this screen. */
export const NUTRITION_ONBOARDING_TAB_BAR_CLEARANCE = 88;

export const NutritionOnboardingWizardScreen = ({ onComplete, reservedBottomInset = 0 }) => {
  const insets = useSafeAreaInsets();
  // Shell edges omit bottom inset (tab bar owns it). When the tab bar is hidden during
  // onboarding, reserve the home-indicator + breathing room ourselves.
  const footerPadBottom =
    Math.max(insets.bottom, 20) + Math.max(reservedBottomInset, 0) + 28;
  const [currentStep, setStep] = useState(1);
  const [calories, setCalories] = useState(2000);
  const [macros, setMacros] = useState({ protein: 150, carbs: 200, fat: 65 });

  const handleFinish = async (foodPrefs = {}) => {
    const favorites = Array.isArray(foodPrefs.favorites) ? foodPrefs.favorites : [];
    const leastFavorites = Array.isArray(foodPrefs.leastFavorites) ? foodPrefs.leastFavorites : [];
    try {
      const { auth, db } = require('../../app-start/config');
      const { doc, setDoc, serverTimestamp } = require('firebase/firestore');
      const uid = auth?.currentUser?.uid;
      if (uid && db) {
        await setDoc(
          doc(db, 'users', uid),
          {
            nutritionFavoriteFoods: favorites,
            nutritionLeastFavoriteFoods: leastFavorites,
            calorieTarget: calories,
            macroTargets: macros,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    } catch (e) {
      console.warn('nutrition onboarding save:', e?.message || e);
    }
    if (onComplete) onComplete({ calories, macros, favorites, leastFavorites });
  };

  return (
    <LinearGradient colors={T.bg} style={{ flex: 1 }}>
      {currentStep === 1 && (
        <CalorieGoalStep
          onNext={() => {
            const cal = clampCalories(calories);
            setCalories(cal);
            setMacros({
              protein: Math.round(cal * 0.3 / 4),
              carbs: Math.round(cal * 0.4 / 4),
              fat: Math.round(cal * 0.3 / 9),
            });
            setStep(2);
          }}
          calories={calories}
          setCalories={setCalories}
          footerPadBottom={footerPadBottom}
        />
      )}
      {currentStep === 2 && (
        <MacrosStep
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          macros={macros}
          setMacros={setMacros}
          footerPadBottom={footerPadBottom}
        />
      )}
      {currentStep === 3 && (
        <FavoriteFoodsStep
          onBack={() => setStep(2)}
          onFinish={handleFinish}
          footerPadBottom={footerPadBottom}
        />
      )}
    </LinearGradient>
  );
};

export default NutritionOnboardingWizardScreen;

