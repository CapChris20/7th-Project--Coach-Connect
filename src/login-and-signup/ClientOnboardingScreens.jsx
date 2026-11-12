// Design Law client onboarding — eight screens that match screens/client-onboarding PNGs.
// Flow: Basics → Goal+level → Setup → Health → Trainer → Situation → AI → All set.
// Used by NewUserSetupScreen when role === 'client'. Data keys stay the same as before.
//
// Priority: PNG > DESIGN-SYSTEM > mockups/client-onboarding.html. Structure must match — not chrome-only.

import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import NbSlider from '../look-and-feel/NbSlider';
import NbCard from '../look-and-feel/NbCard';
import NbButton from '../look-and-feel/NbButton';
import NbSwitch from '../look-and-feel/NbSwitch';
import HardShadow from '../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../look-and-feel/colorPalette';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getOnboardingIconSource } from '../for-both/setup-icons/onboardingIconRegistry';
import { AIPermissionStep } from '../for-both/setup-steps/AIPermissionStep';

// ===== NAMED CONSTANTS =====

// Manipulate here: Design Law mockup ranges (onboarding.py stat() mins/maxes/defaults)
export const CLIENT_ONBOARDING_STEPS = 8;
export const CLIENT_QUESTION_COUNT = 7;
const WEIGHT_MIN = 90;
const WEIGHT_MAX = 400;
const WEIGHT_DEFAULT = 172;
const HEIGHT_IN_MIN = 48;
const HEIGHT_IN_MAX = 84;
const HEIGHT_IN_DEFAULT = 71; // 5'11"
const AGE_MIN = 13;
const AGE_MAX = 90;
const AGE_DEFAULT = 29;
const STORY_MAX = 600;
const DAYS_MIN = 1;
const DAYS_MAX = 7;
const DAYS_DEFAULT = 4;

const LOTTIE_PERSON = require('../assets/animations/app-flows/personal-info');
const LOTTIE_GOAL = require('../assets/animations/app-flows/fitness-goal');
const LOTTIE_INJ = require('../assets/animations/app-flows/injuries');
const LOTTIE_CODE = require('../assets/animations/app-flows/invite-code');
const LOTTIE_DIET = require('../assets/animations/app-flows/fitness-experience');

// Design Law goal tiles — single-select (mockup data-single). Values keep existing Firestore keys.
const GOAL_OPTIONS = [
  { value: 'lose_fat', label: 'Lose Fat', iconKey: 'scales' },
  { value: 'build_muscle', label: 'Build Muscle', iconKey: 'muscle' },
  { value: 'maintain_health', label: 'Maintain Health', iconKey: 'hydration' },
  { value: 'athletic_performance', label: 'Athletic Performance', iconKey: 'energy' },
  { value: 'improve_mental_health', label: 'Improve Mental Health', iconKey: 'stress' },
  { value: 'build_habits', label: 'Build Consistency & Habits', iconKey: 'schedule' },
];

const LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'New to working out', iconKey: 'beginner' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Work out regularly', iconKey: 'inter' },
  { value: 'advanced', label: 'Advanced', desc: 'Experienced athlete', iconKey: 'adv' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', label: 'Full Gym', iconKey: 'gym', span: false },
  { value: 'dumbbells', label: 'Dumbbells', iconKey: 'dumbbells', span: false },
  { value: 'resistance_bands', label: 'Resistance Bands', iconKey: 'bands', span: false },
  { value: 'pull_up_bar', label: 'Pull-up Bar', iconKey: 'pullup', span: false },
  { value: 'bodyweight', label: 'Bodyweight Only', iconKey: 'body', span: true },
];

const PLACE_OPTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'gym', label: 'Gym' },
  { id: 'both', label: 'Both' },
];

const TIME_OPTIONS = [
  { value: 'morning', label: 'Morning', desc: '5am – 12pm' },
  { value: 'afternoon', label: 'Afternoon', desc: '12pm – 5pm' },
  { value: 'evening', label: 'Evening', desc: '5pm – 10pm' },
  { value: 'no_preference', label: 'No preference', desc: 'Anytime works' },
];

const GENDER_OPTIONS = [
  { id: 'male', label: 'Male', iconKey: 'male' },
  { id: 'female', label: 'Female', iconKey: 'female' },
  { id: 'other', label: 'Other', iconKey: 'other' },
  { id: 'prefer_not_to_say', label: 'Prefer not to say', iconKey: 'prefer_not_to_say' },
];

// Manipulate here: Design Law skip chips (onboarding.py dis list)
const SKIP_EXERCISES = [
  'Burpees',
  'Running',
  'Lunges',
  'Deadlifts',
  'Pull-ups',
  'Jumping',
  'Planks',
  'Overhead press',
];

const VITAL_ROWS = [
  {
    key: 'currentStressLevel',
    label: 'Stress level',
    iconKey: 'stress',
    gradient: accentGradients[4],
    options: [
      { id: 'low', label: 'Low' },
      { id: 'moderate', label: 'Moderate' },
      { id: 'high', label: 'High' },
    ],
  },
  {
    key: 'sleepQuality',
    label: 'Sleep quality',
    iconKey: 'sleeping',
    gradient: accentGradients[2],
    options: [
      { id: 'poor', label: 'Poor' },
      { id: 'fair', label: 'Fair' },
      { id: 'good', label: 'Good' },
    ],
  },
  {
    key: 'energyLevels',
    label: 'Energy',
    iconKey: 'energy',
    gradient: accentGradients[0],
    options: [
      { id: 'low', label: 'Low' },
      { id: 'moderate', label: 'Moderate' },
      { id: 'high', label: 'High' },
    ],
  },
  {
    key: 'hydrationHabits',
    label: 'Water per day',
    iconKey: 'hydration',
    gradient: accentGradients[1],
    options: [
      { id: 'less_than_4', label: 'Under 4 cups' },
      { id: '4_8', label: '4–8' },
      { id: 'more_than_8', label: '8+' },
    ],
  },
];

// Chapter map: Design Law steps() frac values from onboarding.py
const CHAPTER_BY_STEP = {
  1: { chapter: 1, fraction: 0.4, label: 'YOU', n: 1 },
  2: { chapter: 1, fraction: 0.85, label: 'YOU', n: 2 },
  3: { chapter: 2, fraction: 0.4, label: 'HOW YOU TRAIN', n: 3 },
  4: { chapter: 2, fraction: 0.85, label: 'HOW YOU TRAIN', n: 4 },
  5: { chapter: 3, fraction: 0.25, label: 'SUPPORT', n: 5 },
  6: { chapter: 3, fraction: 0.6, label: 'SUPPORT', n: 6 },
  7: { chapter: 3, fraction: 0.95, label: 'SUPPORT', n: 7 },
  8: { chapter: 3, fraction: 1, label: 'SUPPORT', n: 7, done: true },
};

const SCREEN_TITLES = {
  1: 'About you',
  2: 'Your goal',
  3: 'Your setup',
  4: 'Health',
  5: 'Your trainer',
  6: 'Your situation',
  7: 'AI coach',
  8: 'All set',
};

const GOAL_LABELS = Object.fromEntries(GOAL_OPTIONS.map((g) => [g.value, g.label]));
const EQUIP_LABELS = Object.fromEntries(EQUIPMENT_OPTIONS.map((e) => [e.value, e.label]));
const TIME_LABELS = {
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
  no_preference: 'Anytime',
};
const PLACE_LABELS = { home: 'at home', gym: 'at the gym', both: 'at home and gym' };

// ===== HELPER FUNCTIONS =====

export function getClientScreenTitle(step) {
  return SCREEN_TITLES[step] || 'Setup';
}

/** Chapter bar + “N / 7” meta for the Design Law header. */
export function getClientChapterMeta(step) {
  const meta = CHAPTER_BY_STEP[step] || CHAPTER_BY_STEP[1];
  return {
    chapter: meta.chapter,
    of: 3,
    fraction: meta.fraction,
    label: meta.label,
    stepLabel: meta.done ? `${CLIENT_QUESTION_COUNT} / ${CLIENT_QUESTION_COUNT}` : `${meta.n} / ${CLIENT_QUESTION_COUNT}`,
    done: !!meta.done,
  };
}

export function heightObjectToInches(height) {
  if (height == null) return HEIGHT_IN_DEFAULT;
  if (typeof height === 'number' && Number.isFinite(height)) return Math.round(height);
  const feet = Number(height?.feet);
  const inches = Number(height?.inches);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return HEIGHT_IN_DEFAULT;
  return feet * 12 + inches;
}

export function inchesToHeightObject(totalInches) {
  const clamped = Math.min(HEIGHT_IN_MAX, Math.max(HEIGHT_IN_MIN, Math.round(totalInches)));
  return {
    feet: Math.floor(clamped / 12),
    inches: clamped % 12,
  };
}

export function formatHeightInches(totalInches) {
  const { feet, inches } = inchesToHeightObject(totalInches);
  return `${feet}'${inches}"`;
}

function parseSkipList(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function serializeSkipList(list) {
  return list.join(', ');
}

function prettyGoal(value) {
  return GOAL_LABELS[value] || String(value || '').replace(/_/g, ' ');
}

function prettyEquip(list) {
  if (!Array.isArray(list) || !list.length) return 'Your gear';
  return list
    .map((v) => EQUIP_LABELS[v] || String(v).replace(/_/g, ' '))
    .join(', ');
}

function titleCase(value) {
  if (!value) return '';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

/** Seed Design Law slider defaults so step 1 is never empty (matches PNG numbers). */
export function withClientSliderDefaults(data) {
  return {
    ...data,
    weight: data.weight != null ? data.weight : WEIGHT_DEFAULT,
    age: data.age != null ? data.age : AGE_DEFAULT,
    height: data.height != null ? data.height : inchesToHeightObject(HEIGHT_IN_DEFAULT),
    daysPerWeek: data.daysPerWeek != null ? data.daysPerWeek : DAYS_DEFAULT,
  };
}

export function validateClientOnboardingStep(step, data, extras = {}) {
  const { trainerChoice, codeValid } = extras;
  switch (step) {
    case 1:
      return (
        data.weight != null &&
        data.age != null &&
        data.age >= AGE_MIN &&
        data.height != null &&
        !!data.gender
      );
    case 2:
      return (
        Array.isArray(data.goals) &&
        data.goals.length > 0 &&
        !!data.fitnessLevel
      );
    case 3:
      return (
        Array.isArray(data.equipmentAccess) &&
        data.equipmentAccess.length > 0 &&
        !!data.trainingEnvironment &&
        data.daysPerWeek != null &&
        !!data.preferredWorkoutTime
      );
    case 4:
      return true; // injuries / skips / supplements optional
    case 5:
      // Trainer link is optional — Continue is always available (matches Design Law).
      return true;
    case 6: {
      const story = String(data.situationDescription || '').trim();
      return story.length > 0 && story.length <= STORY_MAX;
    }
    case 7:
    case 8:
      return true;
    default:
      return false;
  }
}

function iconSource(key) {
  return (
    getOnboardingIconSource(key) ||
    getOnboardingIconSource(`${key}_png`)
  );
}

// ===== SMALL UI PIECES =====

function SectionLabel({ text, right, colors }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{text}</Text>
      {right || null}
    </View>
  );
}

function PillTag({ label, fill, colors }) {
  return (
    <View
      style={[
        styles.pillTag,
        {
          borderColor: colors.nbBorder,
          backgroundColor: fill ? colors.nbFill : colors.nbSurface,
        },
      ]}
    >
      {fill ? (
        <LinearGradient
          colors={accentGradients[0]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFillObject}
        />
      ) : null}
      <Text style={[styles.pillTagText, { color: fill ? colors.nbInk : colors.nbMuted }]}>{label}</Text>
    </View>
  );
}

/** Solid-fill segmented control — Design Law uses black/white, never purple gradients. */
function FillSegmented({ options, selected, onSelect, colors }) {
  return (
    <View style={[styles.seg, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      {options.map((opt, index) => {
        const on = selected === opt.id;
        return (
          <TouchableOpacity
            key={opt.id}
            activeOpacity={0.88}
            onPress={() => onSelect(opt.id)}
            style={[
              styles.segCell,
              on ? { backgroundColor: colors.nbFill } : null,
              index > 0 ? { borderLeftWidth: nb.borderWidth, borderLeftColor: colors.nbBorder } : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text
              style={[styles.segText, { color: on ? colors.nbOnFill : colors.nbInk }]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function IconWell({ iconKey, gradient, size = 40 }) {
  const { colors } = useTheme();
  const src = iconSource(iconKey);
  return (
    <View style={[styles.iconWell, { width: size, height: size, borderColor: colors.nbBorder }]}>
      <LinearGradient
        colors={gradient || accentGradients[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {src ? (
        <Image source={src} style={{ width: size * 0.55, height: size * 0.55 }} resizeMode="contain" />
      ) : null}
    </View>
  );
}

/** Design Law tile — selected = solid fill + check; icon stays colorful. */
function SelectTile({
  label,
  description,
  iconKey,
  selected,
  onPress,
  wide = false,
  span = false,
  colors,
  gradient,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.tile,
        span ? styles.tileSpan : null,
        wide ? styles.tileWide : null,
        {
          borderColor: colors.nbBorder,
          backgroundColor: selected ? colors.nbFill : colors.nbSurface,
          shadowColor: colors.nbShadow,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {selected ? (
        // Design Law: white check on the black tile — no white disc badge (PNG 03/05).
        <Ionicons
          name="checkmark"
          size={18}
          color={colors.nbOnFill}
          style={styles.tick}
        />
      ) : null}
      {iconKey ? <IconWell iconKey={iconKey} gradient={gradient} size={wide ? 36 : 40} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.tileLabel, { color: selected ? colors.nbOnFill : colors.nbInk }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.tileDesc, { color: selected ? colors.nbOnFill : colors.nbMuted, opacity: selected ? 0.78 : 1 }]}>
            {description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function GenderChip({ label, iconKey, selected, onPress, colors }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.genderChip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: selected ? colors.nbFill : colors.nbSurface,
          shadowColor: colors.nbShadow,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <IconWell iconKey={iconKey} gradient={accentGradients[selected ? 0 : 2]} size={28} />
      <Text style={[styles.genderLabel, { color: selected ? colors.nbOnFill : colors.nbInk }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SkipChip({ label, selected, onPress, colors }) {
  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.skipChip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: selected ? colors.nbFill : colors.nbSurface,
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color: selected ? colors.nbOnFill : colors.nbInk }}>
        {label}
      </Text>
      {selected ? <Ionicons name="checkmark" size={14} color={colors.nbOnFill} /> : null}
    </TouchableOpacity>
  );
}

/** Weight / height / age row — big value + NbSlider (Design Law “stat”). */
function StatSlider({
  iconKey,
  label,
  valueLabel,
  value,
  min,
  max,
  colors: ramp,
  onChange,
  themeColors,
}) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <IconWell iconKey={iconKey} gradient={ramp} size={36} />
        <Text style={[styles.statLabel, { color: themeColors.nbMuted }]}>{label}</Text>
        <Text style={[styles.statValue, { color: themeColors.nbInk }]}>{valueLabel}</Text>
      </View>
      <NbSlider value={value} min={min} max={max} colors={ramp} onChange={onChange} />
    </View>
  );
}

function HeroWithLottie({ title, subtitle, lottie, lottieSize = 96, colors }) {
  return (
    <View style={styles.heroRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.h1, { color: colors.nbInk }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: colors.nbMuted }]}>{subtitle}</Text> : null}
      </View>
      {lottie ? (
        <LottieView source={lottie} autoPlay loop style={{ width: lottieSize, height: lottieSize }} />
      ) : null}
    </View>
  );
}

function FieldShell({ label, children, colors }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>{label}</Text> : null}
      {children}
    </View>
  );
}

// ===== SCREENS =====

function BasicsScreen({ data, setData, colors }) {
  const weight = data.weight != null ? Number(data.weight) : WEIGHT_DEFAULT;
  const heightIn = heightObjectToInches(data.height);
  const age = data.age != null ? Number(data.age) : AGE_DEFAULT;

  return (
    <View>
      <HeroWithLottie
        title="Tell us about yourself"
        subtitle="This helps us personalize your experience"
        lottie={LOTTIE_PERSON}
        colors={colors}
      />
      <NbCard style={{ gap: 14, paddingVertical: 14 }}>
        <StatSlider
          iconKey="scales"
          label="WEIGHT"
          valueLabel={`${Math.round(weight)} lbs`}
          value={weight}
          min={WEIGHT_MIN}
          max={WEIGHT_MAX}
          colors={accentGradients[1]}
          themeColors={colors}
          onChange={(n) => setData((prev) => ({ ...prev, weight: n }))}
        />
        <View style={[styles.statDivider, { borderTopColor: colors.nbBorder }]} />
        <StatSlider
          iconKey="height"
          label="HEIGHT"
          valueLabel={formatHeightInches(heightIn)}
          value={heightIn}
          min={HEIGHT_IN_MIN}
          max={HEIGHT_IN_MAX}
          colors={accentGradients[0]}
          themeColors={colors}
          onChange={(n) => setData((prev) => ({ ...prev, height: inchesToHeightObject(n) }))}
        />
        <View style={[styles.statDivider, { borderTopColor: colors.nbBorder }]} />
        <StatSlider
          iconKey="age"
          label="AGE"
          valueLabel={`${Math.round(age)} yrs`}
          value={age}
          min={AGE_MIN}
          max={AGE_MAX}
          colors={accentGradients[4]}
          themeColors={colors}
          onChange={(n) => setData((prev) => ({ ...prev, age: n }))}
        />
      </NbCard>

      <SectionLabel text="GENDER" colors={colors} />
      <View style={styles.genderGrid}>
        {GENDER_OPTIONS.map((g) => (
          <GenderChip
            key={g.id}
            label={g.label}
            iconKey={g.iconKey}
            selected={data.gender === g.id}
            onPress={() => setData((prev) => ({ ...prev, gender: g.id }))}
            colors={colors}
          />
        ))}
      </View>
    </View>
  );
}

function GoalLevelScreen({ data, setData, colors }) {
  const selectedGoal = Array.isArray(data.goals) && data.goals.length ? data.goals[0] : null;

  return (
    <View>
      <HeroWithLottie title="What is your main goal?" lottie={LOTTIE_GOAL} lottieSize={84} colors={colors} />
      <View style={styles.tileGrid}>
        {GOAL_OPTIONS.map((g, i) => (
          <SelectTile
            key={g.value}
            label={g.label}
            iconKey={g.iconKey}
            selected={selectedGoal === g.value}
            colors={colors}
            gradient={accentGradients[i % accentGradients.length]}
            onPress={() =>
              setData((prev) => ({
                ...prev,
                goals: [g.value],
                primaryGoal: g.value,
              }))
            }
          />
        ))}
      </View>

      <SectionLabel text="FITNESS EXPERIENCE" colors={colors} />
      <View style={{ gap: 10 }}>
        {LEVEL_OPTIONS.map((l, i) => (
          <SelectTile
            key={l.value}
            wide
            label={l.label}
            description={l.desc}
            iconKey={l.iconKey}
            selected={data.fitnessLevel === l.value}
            colors={colors}
            gradient={accentGradients[i % accentGradients.length]}
            onPress={() => setData((prev) => ({ ...prev, fitnessLevel: l.value }))}
          />
        ))}
      </View>
    </View>
  );
}

function SetupScreen({ data, setData, colors }) {
  const days = data.daysPerWeek != null ? Number(data.daysPerWeek) : DAYS_DEFAULT;

  const bumpDays = (delta) => {
    setData((prev) => {
      const cur = prev.daysPerWeek != null ? Number(prev.daysPerWeek) : DAYS_DEFAULT;
      const next = Math.min(DAYS_MAX, Math.max(DAYS_MIN, cur + delta));
      return { ...prev, daysPerWeek: next };
    });
  };

  const toggleEquip = (value) => {
    setData((prev) => {
      const current = Array.isArray(prev.equipmentAccess) ? prev.equipmentAccess : [];
      const exists = current.includes(value);
      const next = exists ? current.filter((v) => v !== value) : [...current, value];
      return { ...prev, equipmentAccess: next };
    });
  };

  return (
    <View>
      <Text style={[styles.h1, { color: colors.nbInk, marginBottom: 12 }]}>What can you train with?</Text>
      <View style={styles.tileGrid}>
        {EQUIPMENT_OPTIONS.map((e, i) => (
          <SelectTile
            key={e.value}
            label={e.label}
            iconKey={e.iconKey}
            span={e.span}
            selected={(data.equipmentAccess || []).includes(e.value)}
            colors={colors}
            gradient={accentGradients[i % accentGradients.length]}
            onPress={() => toggleEquip(e.value)}
          />
        ))}
      </View>

      <SectionLabel text="WHERE DO YOU PREFER TO TRAIN?" colors={colors} />
      <FillSegmented
        options={PLACE_OPTIONS}
        selected={data.trainingEnvironment}
        onSelect={(id) => setData((prev) => ({ ...prev, trainingEnvironment: id }))}
        colors={colors}
      />

      <SectionLabel text="DAYS PER WEEK" colors={colors} />
      <NbCard style={{ gap: 12 }}>
        <View style={styles.daysHead}>
          <View style={styles.stepper}>
            <TouchableOpacity
              onPress={() => bumpDays(-1)}
              style={[styles.stepperBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, shadowColor: colors.nbShadow }]}
              accessibilityLabel="Fewer days"
            >
              <Ionicons name="remove" size={22} color={colors.nbInk} />
            </TouchableOpacity>
            <Text style={[styles.daysNum, { color: colors.nbInk }]}>{days}</Text>
            <TouchableOpacity
              onPress={() => bumpDays(1)}
              style={[styles.stepperBtn, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, shadowColor: colors.nbShadow }]}
              accessibilityLabel="More days"
            >
              <Ionicons name="add" size={22} color={colors.nbInk} />
            </TouchableOpacity>
          </View>
          <View style={[styles.sessionsPill, { borderColor: colors.nbBorder }]}>
            <LinearGradient
              colors={accentGradients[2]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={[styles.sessionsPillText, { color: colors.nbInk }]}>sessions</Text>
          </View>
        </View>
        <View style={styles.daysRow}>
          {Array.from({ length: 7 }).map((_, i) => {
            const on = i < days;
            return (
              <View
                key={`d-${i}`}
                style={[
                  styles.dayCell,
                  {
                    borderColor: colors.nbBorder,
                    backgroundColor: on ? colors.nbFill : colors.nbSurface,
                  },
                ]}
              />
            );
          })}
        </View>
      </NbCard>

      <SectionLabel text="BEST TIME OF DAY" colors={colors} />
      <View style={styles.tileGrid}>
        {TIME_OPTIONS.map((t) => (
          <SelectTile
            key={t.value}
            label={t.label}
            description={t.desc}
            selected={data.preferredWorkoutTime === t.value}
            colors={colors}
            onPress={() => setData((prev) => ({ ...prev, preferredWorkoutTime: t.value }))}
          />
        ))}
      </View>
    </View>
  );
}

function HealthScreen({ data, setData, colors }) {
  const noLimitations = data.injuries === null;
  const skips = useMemo(() => parseSkipList(data.exercisesDislike), [data.exercisesDislike]);

  const toggleSkip = (label) => {
    setData((prev) => {
      const cur = parseSkipList(prev.exercisesDislike);
      const next = cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label];
      return { ...prev, exercisesDislike: serializeSkipList(next) };
    });
  };

  return (
    <View>
      <HeroWithLottie
        title="Any injuries or limitations?"
        subtitle="We will help you work around them safely."
        lottie={LOTTIE_INJ}
        lottieSize={84}
        colors={colors}
      />

      <NbCard style={{ gap: 12 }}>
        <View style={styles.noLimRow}>
          <IconWell iconKey="injury" gradient={accentGradients[4]} size={36} />
          <Text style={[styles.noLimLabel, { color: colors.nbInk }]}>I have no limitations</Text>
          <NbSwitch
            value={noLimitations}
            onValueChange={(on) => setData((prev) => ({ ...prev, injuries: on ? null : '' }))}
          />
        </View>

        {noLimitations ? (
          <Text style={{ fontSize: 14, color: colors.nbMuted, fontWeight: '600' }}>
            Nothing noted. You can add limitations later from your profile.
          </Text>
        ) : (
          <FieldShell label="INJURIES OR PHYSICAL LIMITATIONS" colors={colors}>
            <TextInput
              value={data.injuries || ''}
              onChangeText={(text) => setData((prev) => ({ ...prev, injuries: text }))}
              placeholder="e.g., lower back pain, knee issues, shoulder injury..."
              placeholderTextColor={colors.nbMuted}
              multiline
              style={[
                styles.textArea,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, color: colors.nbInk },
              ]}
            />
            <Text style={{ fontSize: 12, color: colors.nbMuted, marginTop: 6, fontWeight: '600' }}>
              Be specific: area, movements that bother you, and whether it is recent or chronic.
            </Text>
          </FieldShell>
        )}
      </NbCard>

      <SectionLabel text="EXERCISES YOU WOULD RATHER SKIP" colors={colors} />
      <View style={styles.skipWrap}>
        {SKIP_EXERCISES.map((label) => (
          <SkipChip
            key={label}
            label={label}
            selected={skips.includes(label)}
            onPress={() => toggleSkip(label)}
            colors={colors}
          />
        ))}
      </View>

      <FieldShell label="SUPPLEMENTS YOU TAKE" colors={colors}>
        <TextInput
          value={data.supplementsCurrentlyTaking || ''}
          onChangeText={(text) => setData((prev) => ({ ...prev, supplementsCurrentlyTaking: text }))}
          placeholder="e.g., creatine, protein, multivitamin..."
          placeholderTextColor={colors.nbMuted}
          style={[
            styles.singleInput,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, color: colors.nbInk },
          ]}
        />
      </FieldShell>
    </View>
  );
}

function TrainerScreen({
  data,
  setData,
  colors,
  trainerChoice,
  setTrainerChoice,
  trainerCode,
  setTrainerCode,
  codeValid,
  setCodeValid,
  setCodeError,
  validateTrainerCode,
  shakeAnimation,
  matchedTrainer,
}) {
  const debounceTimer = useRef(null);

  const setYes = () => setTrainerChoice('yes');
  const setNo = () => {
    setTrainerChoice('no');
    setTrainerCode('');
    setCodeValid(null);
    setCodeError?.(null);
    setData((prev) => ({ ...prev, trainerId: null }));
  };

  return (
    <View>
      <Text style={[styles.h1, { color: colors.nbInk, marginBottom: 12 }]}>Do you have a trainer?</Text>
      <FillSegmented
        options={[
          { id: 'yes', label: 'Yes, I have a code' },
          { id: 'no', label: 'Not yet' },
        ]}
        selected={trainerChoice}
        onSelect={(id) => (id === 'yes' ? setYes() : setNo())}
        colors={colors}
      />

      {trainerChoice === 'yes' ? (
        <View style={{ marginTop: 16, gap: 14 }}>
          <View
            style={[
              styles.hintCard,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
          >
            <LottieView source={LOTTIE_CODE} autoPlay loop style={{ width: 72, height: 72 }} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: colors.nbMuted }}>
              Ask your trainer for their Coach Connect invite code. They approve you once it is entered.
            </Text>
          </View>

          <FieldShell label="TRAINER INVITE CODE" colors={colors}>
            <Animated.View style={{ transform: [{ translateX: shakeAnimation || 0 }] }}>
              <TextInput
                value={trainerCode}
                onChangeText={(text) => {
                  const next = text.toUpperCase();
                  setTrainerCode(next);
                  setCodeValid(null);
                  setCodeError?.(null);
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  if (next.trim().length > 0) {
                    debounceTimer.current = setTimeout(() => validateTrainerCode?.(next), 400);
                  }
                }}
                placeholder="ABC-123"
                placeholderTextColor={colors.nbMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={24}
                style={[
                  styles.codeInput,
                  {
                    borderColor: codeValid === false ? '#EF4444' : colors.nbBorder,
                    backgroundColor: colors.nbSurface,
                    color: colors.nbInk,
                  },
                ]}
              />
            </Animated.View>
          </FieldShell>

          {codeValid === true && matchedTrainer ? (
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
              <View
                style={[
                  styles.matchCard,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: accentGradients[1][0], borderColor: colors.nbBorder }]}>
                  <Text style={{ fontWeight: '900', color: colors.nbInk }}>
                    {String(matchedTrainer.initials || 'TR')}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbInk }}>
                    {matchedTrainer.name || 'Trainer'}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted }}>
                    {matchedTrainer.subtitle || 'Coach'}
                  </Text>
                </View>
                <View style={[styles.matchPill, { borderColor: colors.nbBorder }]}>
                  <LinearGradient
                    colors={accentGradients[2]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.nbInk }}>Code matched</Text>
                </View>
              </View>
            </HardShadow>
          ) : null}
          {codeValid === true ? (
            <Text style={{ fontSize: 12, color: colors.nbMuted, fontWeight: '600' }}>
              Sample match. Names here are demo data.
            </Text>
          ) : null}
          {codeValid === false ? (
            <Text style={{ fontSize: 13, color: '#EF4444', fontWeight: '700' }}>
              Invalid code — check and try again
            </Text>
          ) : null}
        </View>
      ) : (
        <NbCard style={{ marginTop: 16 }} noShadow>
          <Text style={{ fontSize: 16, fontWeight: '900', color: colors.nbInk, marginBottom: 6 }}>No problem.</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.nbMuted, lineHeight: 20 }}>
            You can browse trainers any time from Find a trainer. Until then the AI coach can guide your first weeks.
          </Text>
        </NbCard>
      )}
    </View>
  );
}

function SituationScreen({ data, setData, colors }) {
  const story = data.situationDescription || '';
  const count = story.length;

  return (
    <View>
      <Text style={[styles.h1, { color: colors.nbInk }]}>Describe your situation</Text>
      <Text style={[styles.sub, { color: colors.nbMuted, marginBottom: 12 }]}>
        Vitals are optional. Your story is required.
      </Text>

      <SectionLabel
        text="OPTIONAL VITALS"
        colors={colors}
        right={<PillTag label="OPTIONAL" colors={colors} />}
      />
      <NbCard style={{ gap: 16 }}>
        {VITAL_ROWS.map((row) => (
          <View key={row.key} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconWell iconKey={row.iconKey} gradient={row.gradient} size={36} />
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.nbInk }}>{row.label}</Text>
            </View>
            <FillSegmented
              options={row.options}
              selected={data[row.key]}
              onSelect={(id) => setData((prev) => ({ ...prev, [row.key]: id }))}
              colors={colors}
            />
          </View>
        ))}
      </NbCard>

      <SectionLabel
        text="YOUR STORY"
        colors={colors}
        right={<PillTag label="REQUIRED" fill colors={colors} />}
      />
      <TextInput
        value={story}
        onChangeText={(text) =>
          setData((prev) => ({
            ...prev,
            situationDescription: text.slice(0, STORY_MAX),
          }))
        }
        multiline
        placeholder="Desk job, two kids, and I have dropped training twice this year…"
        placeholderTextColor={colors.nbMuted}
        style={[
          styles.storyArea,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface, color: colors.nbInk },
        ]}
      />
      <Text style={[styles.counter, { color: colors.nbMuted }]}>
        {count} / {STORY_MAX}
      </Text>
    </View>
  );
}

function AllSetScreen({ data, colors, matchedTrainerName }) {
  const days = data.daysPerWeek != null ? data.daysPerWeek : '—';
  const goal = prettyGoal(Array.isArray(data.goals) ? data.goals[0] : data.primaryGoal);
  const level = titleCase(data.fitnessLevel) || 'Ready';
  const equip = prettyEquip(data.equipmentAccess);
  const place = PLACE_LABELS[data.trainingEnvironment] || 'ready to train';
  const time = TIME_LABELS[data.preferredWorkoutTime] || 'flexible timing';
  const skips = parseSkipList(data.exercisesDislike);
  const injuryTitle =
    data.injuries === null
      ? 'No limitations flagged'
      : data.injuries
        ? String(data.injuries).slice(0, 42)
        : 'Limits noted';
  const injurySub = skips.length
    ? `${skips.slice(0, 2).join(' and ')} skipped`
    : 'Ready to train';
  const trainerTitle = matchedTrainerName
    ? `Trainer: ${matchedTrainerName}`
    : data.trainerId
      ? 'Trainer linked'
      : 'Solo for now';
  const trainerSub = matchedTrainerName || data.trainerId ? 'Waiting for approval' : 'You can add a code later';

  return (
    <View>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbHero} style={{ marginBottom: 16 }}>
        <View style={[styles.heroSlab, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
          <Text style={[styles.heroEyebrow, { color: colors.nbOnFill }]}>YOUR PLAN STARTS WITH</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <Text style={[styles.heroNum, { color: colors.nbOnFill }]}>{days}</Text>
            <Text style={[styles.heroUnit, { color: colors.nbOnFill }]}>days a week</Text>
          </View>
          <Text style={[styles.heroSub, { color: colors.nbOnFill }]}>
            {`${time}, ${place}, for ${goal || 'your goal'}.`}
          </Text>
        </View>
      </HardShadow>

      <NbCard style={{ paddingHorizontal: 4, marginBottom: 16 }}>
        {[
          { iconKey: 'muscle', title: level, sub: `Goal: ${goal || '—'}` },
          { iconKey: 'dumbbells', title: equip, sub: `Training ${place}` },
          { iconKey: 'injury', title: injuryTitle, sub: injurySub },
          { iconKey: 'people', title: trainerTitle, sub: trainerSub },
        ].map((row, index, arr) => (
          <View key={row.title}>
            <View style={styles.summaryRow}>
              <IconWell iconKey={row.iconKey} gradient={accentGradients[index % accentGradients.length]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: colors.nbInk }} numberOfLines={1}>
                  {row.title}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted }} numberOfLines={2}>
                  {row.sub}
                </Text>
              </View>
            </View>
            {index < arr.length - 1 ? (
              <View style={{ height: 2, backgroundColor: colors.nbBorder, marginHorizontal: 10 }} />
            ) : null}
          </View>
        ))}
      </NbCard>

      <LottieView source={LOTTIE_DIET} autoPlay loop style={{ width: '100%', height: 120 }} />
    </View>
  );
}

// ===== MAIN EXPORT =====

/**
 * Renders one Design Law client onboarding body (steps 1–8).
 * Footer / header chrome stay in NewUserSetupScreen so trainer flow is untouched.
 */
export default function ClientOnboardingStep({
  step,
  data,
  setData,
  trainerChoice,
  setTrainerChoice,
  trainerCode,
  setTrainerCode,
  codeValid,
  setCodeValid,
  setCodeError,
  validateTrainerCode,
  shakeAnimation,
  matchedTrainer,
  onEnableAI,
  onSkipAI,
}) {
  const { colors } = useTheme();

  switch (step) {
    case 1:
      return <BasicsScreen data={data} setData={setData} colors={colors} />;
    case 2:
      return <GoalLevelScreen data={data} setData={setData} colors={colors} />;
    case 3:
      return <SetupScreen data={data} setData={setData} colors={colors} />;
    case 4:
      return <HealthScreen data={data} setData={setData} colors={colors} />;
    case 5:
      return (
        <TrainerScreen
          data={data}
          setData={setData}
          colors={colors}
          trainerChoice={trainerChoice}
          setTrainerChoice={setTrainerChoice}
          trainerCode={trainerCode}
          setTrainerCode={setTrainerCode}
          codeValid={codeValid}
          setCodeValid={setCodeValid}
          setCodeError={setCodeError}
          validateTrainerCode={validateTrainerCode}
          shakeAnimation={shakeAnimation}
          matchedTrainer={matchedTrainer}
        />
      );
    case 6:
      return <SituationScreen data={data} setData={setData} colors={colors} />;
    case 7:
      // Actions live in the Design Law bottom bar (Not now | Turn on side-by-side).
      return (
        <AIPermissionStep
          hideActions
          onEnableAI={onEnableAI}
          onSkipAI={onSkipAI}
        />
      );
    case 8:
      return (
        <AllSetScreen
          data={data}
          colors={colors}
          matchedTrainerName={matchedTrainer?.name}
        />
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  h1: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 20,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  pillTag: {
    overflow: 'hidden',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillTagText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  stat: {
    gap: 8,
  },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  statValue: {
    // Manipulate here: Design Law mockup uses ~34px live values beside each slider label
    fontSize: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  statDivider: {
    borderTopWidth: 2,
    marginVertical: 4,
  },
  iconWell: {
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  genderChip: {
    width: '47%',
    flexGrow: 1,
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  genderLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 96,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    gap: 10,
    position: 'relative',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  tileSpan: {
    width: '100%',
  },
  tileWide: {
    width: '100%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
  },
  tileDesc: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
    lineHeight: 17,
  },
  tick: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
  },
  seg: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 44,
  },
  segCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  segText: {
    fontSize: 13,
    fontWeight: '800',
  },
  daysHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  daysNum: {
    fontSize: 34,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    minWidth: 36,
    textAlign: 'center',
  },
  sessionsPill: {
    overflow: 'hidden',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sessionsPillText: {
    fontSize: 12,
    fontWeight: '900',
  },
  daysRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    height: 34,
    borderWidth: nb.borderWidth,
    borderRadius: 6,
  },
  noLimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noLimLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  textArea: {
    minHeight: 96,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  singleInput: {
    minHeight: 52,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
  },
  skipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  skipChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 10,
  },
  codeInput: {
    minHeight: 64,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 4,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matchPill: {
    overflow: 'hidden',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  storyArea: {
    minHeight: 140,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    fontWeight: '600',
    textAlignVertical: 'top',
  },
  counter: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    marginTop: 6,
    fontVariant: ['tabular-nums'],
  },
  heroSlab: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbHero,
    padding: 20,
    gap: 4,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    opacity: 0.7,
  },
  heroNum: {
    fontSize: 72,
    fontWeight: '900',
    lineHeight: 76,
    letterSpacing: -2,
  },
  heroUnit: {
    fontSize: 20,
    fontWeight: '800',
  },
  heroSub: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.85,
    marginTop: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
});
