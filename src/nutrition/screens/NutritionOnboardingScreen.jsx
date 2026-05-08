/**
 * ANATROX — Nutrition Onboarding Screen
 * Converted from Lovable web export (Nutrition_Onboarding.zip) to React Native / Expo
 * Single file — all components inlined, no navbar, no CoachConnect header
 *
 * WHAT WAS IN THE ZIP:
 *   src/pages/Index.tsx                        → NutritionOnboardingScreen (orchestrator)
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
 * Firebase is wired and configured in src/app/config.js
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
 *   <Stack.Screen name="NutritionOnboarding" component={NutritionOnboardingScreen} />
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
  hotPink: '#ec4899',
  gradientBtn: ['#7c3aed', '#ec4899', '#f97316'],
  gradientAccent: ['#ec4899', '#f97316'],
  gradientPurplePink: ['#C084FC', '#FF6B9D'],
  progressFill: ['#ec4899', '#f97316'],
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
  <LinearGradient
    colors={T.gradientAccent}
    start={{ x: 0, y: 0 }}
    end={{ x: 1, y: 1 }}
    style={[{ borderRadius: 21, padding: 1 }, style]}
  >
    <View style={{ borderRadius: 20, backgroundColor: T.solidBg, padding: 16 }}>
      {children}
    </View>
  </LinearGradient>
);

// ─────────────────────────────────────────────────────────────
// CALORIE GOAL STEP  (was: src/components/CalorieGoalStep.tsx)
// ─────────────────────────────────────────────────────────────

const CalorieGoalStep = ({ onNext, calories, setCalories }) => {
  const decrement = () => setCalories(Math.max(calories - 50, 500));
  const increment = () => setCalories(Math.min(calories + 50, 5000));
  const cal = Number(calories) || 0;
  const estProtein = Math.round(cal * 0.3 / 4);
  const estCarbs = Math.round(cal * 0.4 / 4);
  const estFat = Math.round(cal * 0.3 / 9);

  return (
    <View style={step.container}>
      <ProgressBar currentStep={1} totalSteps={3} />

      <Text style={step.title}>Set Your Calorie Goal</Text>

      <View style={step.centerBlock}>
        <View style={step.counterRow}>
          <TouchableOpacity onPress={decrement} activeOpacity={0.8} style={step.counterBtn}>
            <Text style={step.counterBtnText}>−</Text>
          </TouchableOpacity>

          <View style={step.numberBlock}>
            <Text style={step.bigNumber}>{calories}</Text>
            <Text style={step.kcalLabel}>kcal / day</Text>
          </View>

          <TouchableOpacity onPress={increment} activeOpacity={0.8} style={step.counterBtn}>
            <Text style={step.counterBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={() => Alert.alert('Coming soon', 'Use +/− to set your goal manually for now.')}
          activeOpacity={0.7}
          style={{ marginTop: 32 }}
        >
          <Text style={step.linkText}>Calculate for me</Text>
        </TouchableOpacity>
      </View>

      <Text style={step.estimatedMacrosLabel}>Estimated macros at this calorie target</Text>
      <View style={step.macroPreviewRow}>
        <Text style={step.macroPreviewText}>
          Protein: {estProtein}g  ·  Carbs: {estCarbs}g  ·  Fat: {estFat}g
        </Text>
      </View>

      <TouchableOpacity onPress={onNext} activeOpacity={0.85} style={{ marginTop: 'auto' }}>
        <LinearGradient
          colors={T.gradientBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={step.gradBtn}
        >
          <Text style={step.gradBtnText}>Next</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
// MACROS STEP  (was: src/components/MacrosStep.tsx)
// ─────────────────────────────────────────────────────────────

const MacrosStep = ({ onNext, onBack, macros, setMacros }) => {
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
      <View style={step.container}>
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
            colors={T.gradientBtn}
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

const STATUS_CONFIG = {
  check:   { emoji: '✅', color: '#22c55e' },
  warning: { emoji: '⚠️', color: '#eab308' },
  bad:     { emoji: '❌', color: '#ef4444' },
};

const PRESET_FOODS = [
  { name: 'Chicken Breast', status: 'check' },
  { name: 'Brown Rice',     status: 'check' },
  { name: 'Avocado',        status: 'check' },
  { name: 'Pizza',          status: 'warning' },
  { name: 'Ice Cream',      status: 'bad' },
];

const FavoriteFoodsStep = ({ onBack, onFinish }) => {
  const [foods, setFoods] = useState(PRESET_FOODS);
  const [inputValue, setInputValue] = useState('');

  const addFood = () => {
    if (!inputValue.trim()) return;
    const statuses = ['check', 'warning', 'bad'];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    setFoods([...foods, { name: inputValue.trim(), status: randomStatus }]);
    setInputValue('');
  };

  return (
    <View style={step.container}>
      <View style={{ position: 'relative', marginBottom: 32 }}>
        <TouchableOpacity onPress={onBack} style={step.backBtn} activeOpacity={0.7}>
          <Text style={step.linkText}>← Back</Text>
        </TouchableOpacity>
        <ProgressBar currentStep={3} totalSteps={3} />
      </View>

      <Text style={step.title}>Your Favorite Foods</Text>

      <View style={favS.inputCard}>
        <TextInput
          style={favS.input}
          placeholder="Add a food..."
          placeholderTextColor={T.textMuted}
          value={inputValue}
          onChangeText={setInputValue}
          onSubmitEditing={addFood}
          returnKeyType="done"
        />
        <TouchableOpacity onPress={addFood} activeOpacity={0.85}>
          <LinearGradient colors={T.gradientAccent} style={favS.addBtn}>
            <Ionicons name="add" size={18} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={favS.chipsWrap}>
          {foods.map((food, i) => (
            <GlassCardActive key={i} style={{ marginBottom: 0 }}>
              <View style={favS.chip}>
                <Text style={favS.chipText}>{food.name}</Text>
                <Text style={{ fontSize: 14 }}>{STATUS_CONFIG[food.status].emoji}</Text>
              </View>
            </GlassCardActive>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity onPress={onFinish} activeOpacity={0.85} style={{ marginTop: 16 }}>
        <LinearGradient
          colors={T.gradientBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={step.gradBtn}
        >
          <Text style={step.gradBtnText}>Finish Setup</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const favS = StyleSheet.create({
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.cardBg,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  input: { flex: 1, color: T.text, fontSize: 14 },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chipText: { color: T.text, fontSize: 14, fontWeight: '500' },
});

const OZ_TO_G = 28.3495;

const step = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  title: {
    color: T.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 40,
    marginBottom: 32,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
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
  numberBlock: { alignItems: 'center' },
  bigNumber: { color: '#FF6B9D', fontSize: 72, fontWeight: '800', lineHeight: 80 },
  kcalLabel: { color: T.textMuted, fontSize: 13, marginTop: 8, textAlign: 'center' },
  linkText: { color: T.hotPink, fontSize: 14, fontWeight: '500', textDecorationLine: 'underline' },
  estimatedMacrosLabel: { fontSize: 12, color: T.textVeryMuted, marginBottom: 6 },
  macroPreviewRow: { marginBottom: 12 },
  macroPreviewText: { fontSize: 14, color: T.textMuted },
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

export const NutritionOnboardingScreen = ({ onComplete }) => {
  const [currentStep, setStep] = useState(1);
  const [calories, setCalories] = useState(2000);
  const [macros, setMacros] = useState({ protein: 150, carbs: 200, fat: 65 });

  const handleFinish = async () => {
    // Firebase wiring: configured in src/app/config.js
    // import { db } from '../../firebase/config';
    // import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
    // const { currentUser } = auth;
    // await setDoc(doc(db, 'nutrition_goals', currentUser.uid), {
    //   user_id: currentUser.uid,
    //   calorie_target: calories,
    //   protein_target: macros.protein,
    //   carbs_target: macros.carbs,
    //   fat_target: macros.fat,
    //   macro_split: { protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
    //   updated_at: serverTimestamp(),
    // });
    if (onComplete) onComplete({ calories, macros });
  };

  return (
    <LinearGradient colors={T.bg} style={{ flex: 1 }}>
      {currentStep === 1 && (
        <CalorieGoalStep
          onNext={() => setStep(2)}
          calories={calories}
          setCalories={setCalories}
        />
      )}
      {currentStep === 2 && (
        <MacrosStep
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          macros={macros}
          setMacros={setMacros}
        />
      )}
      {currentStep === 3 && (
        <FavoriteFoodsStep
          onBack={() => setStep(2)}
          onFinish={handleFinish}
        />
      )}
    </LinearGradient>
  );
};

export default NutritionOnboardingScreen;

