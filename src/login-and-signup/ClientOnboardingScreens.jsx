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
// vocab: LottieView = JSON animation player (Design Law handoff lotties)
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
const DAYS_IN_WEEK = 7;
const TRAINER_CODE_DEBOUNCE_MS = 400;
const TRAINER_CODE_MAX_LENGTH = 24;
const INJURY_SNIPPET_MAX_CHARS = 36;
const INCHES_PER_FOOT = 12;
const CHAPTER_COUNT = 3;
const ONBOARDING_STEP_ABOUT = 1;
const ONBOARDING_STEP_GOAL = 2;
const ONBOARDING_STEP_SETUP = 3;
const ONBOARDING_STEP_HEALTH = 4;
const ONBOARDING_STEP_TRAINER = 5;
const ONBOARDING_STEP_SITUATION = 6;
const ONBOARDING_STEP_AI = 7;
const ONBOARDING_STEP_ALL_SET = 8;
const SUMMARY_SKIP_PREVIEW_COUNT = 2;

const LOTTIE_PERSON = require('../assets/animations/app-flows/personal-info');
const LOTTIE_GOAL = require('../assets/animations/app-flows/fitness-goal');
const LOTTIE_INJURIES = require('../assets/animations/app-flows/injuries');
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

// Manipulate here: Design Law skip chips — keep growing so clients can refuse what they hate
const SKIP_EXERCISES = [
  'Burpees',
  'Running',
  'Lunges',
  'Deadlifts',
  'Pull-ups',
  'Jumping',
  'Planks',
  'Overhead press',
  'Squats',
  'Bench press',
  'Box jumps',
  'Kettlebell swings',
  'Rowing',
  'Cycling',
  'Sit-ups',
  'Push-ups',
  'Hip thrusts',
  'Crunches',
  'Mountain climbers',
  'Turkish get-ups',
  'Sled pushes',
  'Farmer carries',
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
  [ONBOARDING_STEP_ABOUT]: { chapter: 1, fraction: 0.4, label: 'YOU', n: 1 },
  [ONBOARDING_STEP_GOAL]: { chapter: 1, fraction: 0.85, label: 'YOU', n: 2 },
  [ONBOARDING_STEP_SETUP]: { chapter: 2, fraction: 0.4, label: 'HOW YOU TRAIN', n: 3 },
  [ONBOARDING_STEP_HEALTH]: { chapter: 2, fraction: 0.85, label: 'HOW YOU TRAIN', n: 4 },
  [ONBOARDING_STEP_TRAINER]: { chapter: 3, fraction: 0.25, label: 'SUPPORT', n: 5 },
  [ONBOARDING_STEP_SITUATION]: { chapter: 3, fraction: 0.6, label: 'SUPPORT', n: 6 },
  [ONBOARDING_STEP_AI]: {
    chapter: 3,
    fraction: 0.95,
    label: 'SUPPORT',
    n: CLIENT_QUESTION_COUNT,
  },
  [ONBOARDING_STEP_ALL_SET]: {
    chapter: 3,
    fraction: 1,
    label: 'SUPPORT',
    n: CLIENT_QUESTION_COUNT,
    done: true,
  },
};

const SCREEN_TITLES = {
  [ONBOARDING_STEP_ABOUT]: 'About you',
  [ONBOARDING_STEP_GOAL]: 'Your goal',
  [ONBOARDING_STEP_SETUP]: 'Your setup',
  [ONBOARDING_STEP_HEALTH]: 'Health',
  [ONBOARDING_STEP_TRAINER]: 'Your trainer',
  [ONBOARDING_STEP_SITUATION]: 'Your situation',
  [ONBOARDING_STEP_AI]: 'AI coach',
  [ONBOARDING_STEP_ALL_SET]: 'All set',
};

const GOAL_LABELS = Object.fromEntries(GOAL_OPTIONS.map((goalOption) => [goalOption.value, goalOption.label]));
const EQUIP_LABELS = Object.fromEntries(
  EQUIPMENT_OPTIONS.map((equipmentOption) => [equipmentOption.value, equipmentOption.label]),
);
const TIME_LABELS = {
  morning: 'Mornings',
  afternoon: 'Afternoons',
  evening: 'Evenings',
  no_preference: 'Anytime',
};
const PLACE_LABELS = { home: 'at home', gym: 'at the gym', both: 'at home and gym' };
// All set hero meta (PNG 15): “Evenings, at home, for building muscle.”
const GOAL_PHRASE = {
  lose_fat: 'losing fat',
  build_muscle: 'building muscle',
  maintain_health: 'maintaining health',
  athletic_performance: 'athletic performance',
  improve_mental_health: 'mental health',
  build_habits: 'building habits',
};

// ===== MAIN FUNCTION =====

/** Title string for the Design Law onboarding header for this step index. */
export function getClientScreenTitle(step) {
  return SCREEN_TITLES[step] || 'Setup';
}

/** Chapter bar + “N / 7” meta for the Design Law header. */
export function getClientChapterMeta(step) {
  const chapterRow = CHAPTER_BY_STEP[step] || CHAPTER_BY_STEP[ONBOARDING_STEP_ABOUT];
  // Done screens show 7/7; otherwise “current question / 7”
  let stepLabel = `${chapterRow.n} / ${CLIENT_QUESTION_COUNT}`;
  if (chapterRow.done) {
    stepLabel = `${CLIENT_QUESTION_COUNT} / ${CLIENT_QUESTION_COUNT}`;
  }
  return {
    chapter: chapterRow.chapter,
    of: CHAPTER_COUNT,
    fraction: chapterRow.fraction,
    label: chapterRow.label,
    stepLabel,
    done: !!chapterRow.done,
  };
}

/** Height from Firestore object or plain inches — defaults when missing. */
export function heightObjectToInches(height) {
  if (height == null) return HEIGHT_IN_DEFAULT;
  if (typeof height === 'number' && Number.isFinite(height)) return Math.round(height);
  const feet = Number(height?.feet);
  const inches = Number(height?.inches);
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return HEIGHT_IN_DEFAULT;
  return feet * INCHES_PER_FOOT + inches;
}

/** Clamps total inches and splits into { feet, inches } for Firestore. */
export function inchesToHeightObject(totalInches) {
  const clamped = Math.min(HEIGHT_IN_MAX, Math.max(HEIGHT_IN_MIN, Math.round(totalInches)));
  return {
    feet: Math.floor(clamped / INCHES_PER_FOOT),
    inches: clamped % INCHES_PER_FOOT,
  };
}

/** Design Law display string e.g. 5'11". */
export function formatHeightInches(totalInches) {
  const { feet, inches } = inchesToHeightObject(totalInches);
  return `${feet}'${inches}"`;
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

function aboutStepIsComplete(data) {
  if (data.weight == null) return false;
  if (data.age == null) return false;
  if (data.age < AGE_MIN) return false;
  if (data.height == null) return false;
  if (!data.gender) return false;
  return true;
}

function goalStepIsComplete(data) {
  if (!Array.isArray(data.goals)) return false;
  if (data.goals.length === 0) return false;
  if (!data.fitnessLevel) return false;
  return true;
}

function setupStepIsComplete(data) {
  if (!Array.isArray(data.equipmentAccess)) return false;
  if (data.equipmentAccess.length === 0) return false;
  if (!data.trainingEnvironment) return false;
  if (data.daysPerWeek == null) return false;
  if (!data.preferredWorkoutTime) return false;
  return true;
}

function situationStepIsComplete(data) {
  const story = String(data.situationDescription || '').trim();
  if (story.length === 0) return false;
  if (story.length > STORY_MAX) return false;
  return true;
}

/**
 * Whether Continue should unlock for this onboarding step (Firestore keys unchanged).
 * Flow: pick step → run that step's completeness check → true unlocks Continue.
 * @param {number} step
 * @param {object} data
 * @param {{ trainerChoice?: string, codeValid?: boolean }} [extras]
 * @returns {boolean}
 */
export function validateClientOnboardingStep(step, data, extras = {}) {
  // extras kept for callers (trainerChoice / codeValid); health/trainer/AI stay always-unlock
  void extras;

  if (step === ONBOARDING_STEP_ABOUT) return aboutStepIsComplete(data);
  if (step === ONBOARDING_STEP_GOAL) return goalStepIsComplete(data);
  if (step === ONBOARDING_STEP_SETUP) return setupStepIsComplete(data);
  if (step === ONBOARDING_STEP_HEALTH) return true;
  if (step === ONBOARDING_STEP_TRAINER) return true;
  if (step === ONBOARDING_STEP_SITUATION) return situationStepIsComplete(data);
  if (step === ONBOARDING_STEP_AI) return true;
  if (step === ONBOARDING_STEP_ALL_SET) return true;
  return false;
}

// ===== HELPER FUNCTIONS =====

function SectionLabel({ text, right, colors }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{text}</Text>
      {right || null}
    </View>
  );
}

function PillTag({ label, fill, colors }) {
  let tagBackground = colors.nbSurface;
  if (fill) tagBackground = colors.nbFill;
  let tagTextColor = colors.nbMuted;
  if (fill) tagTextColor = colors.nbInk;

  return (
    <View
      style={[
        styles.pillTag,
        {
          borderColor: colors.nbBorder,
          backgroundColor: tagBackground,
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
      <Text style={[styles.pillTagText, { color: tagTextColor }]}>{label}</Text>
    </View>
  );
}

/** Solid-fill segmented control — Design Law uses black/white, never purple gradients. */
function FillSegmented({ options, selected, onSelect, colors }) {
  return (
    <View style={[styles.seg, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      {options.map((segmentOption, index) => {
        const isSegmentSelected = selected === segmentOption.id;
        let segmentTextColor = colors.nbInk;
        if (isSegmentSelected) segmentTextColor = colors.nbOnFill;

        let leftBorder = null;
        if (index > 0) {
          leftBorder = { borderLeftWidth: nb.borderWidth, borderLeftColor: colors.nbBorder };
        }

        let selectedBackground = null;
        if (isSegmentSelected) {
          selectedBackground = { backgroundColor: colors.nbFill };
        }

        return (
          <TouchableOpacity
            key={segmentOption.id}
            activeOpacity={0.88}
            onPress={() => onSelect(segmentOption.id)}
            style={[styles.segCell, selectedBackground, leftBorder]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSegmentSelected }}
          >
            <Text style={[styles.segText, { color: segmentTextColor }]} numberOfLines={1}>
              {segmentOption.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function IconWell({ iconKey, gradient, size = 40 }) {
  const { colors } = useTheme();
  const src = onboardingIconOrPngFallback(iconKey);
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
  // Wide experience rows (PNG 03): check sits on the far right, not top-right of a square tile.
  const checkSize = wide ? 20 : 18;
  const checkStyle = wide ? undefined : styles.tick;
  let tick = null;
  if (selected) {
    tick = (
      <Ionicons
        name="checkmark"
        size={checkSize}
        color={colors.nbOnFill}
        style={checkStyle}
      />
    );
  }

  let tileBackground = colors.nbSurface;
  if (selected) tileBackground = colors.nbFill;
  let labelColor = colors.nbInk;
  if (selected) labelColor = colors.nbOnFill;
  let descriptionColor = colors.nbMuted;
  if (selected) descriptionColor = colors.nbOnFill;
  let descriptionOpacity = 1;
  if (selected) descriptionOpacity = 0.78;
  const iconWellSize = wide ? 36 : 40;
  const spanStyle = span ? styles.tileSpan : null;
  const wideStyle = wide ? styles.tileWide : null;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.tile,
        spanStyle,
        wideStyle,
        {
          borderColor: colors.nbBorder,
          backgroundColor: tileBackground,
          shadowColor: colors.nbShadow,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      {!wide ? tick : null}
      {iconKey ? <IconWell iconKey={iconKey} gradient={gradient} size={iconWellSize} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.tileLabel, { color: labelColor }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.tileDesc, { color: descriptionColor, opacity: descriptionOpacity }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {wide ? tick : null}
    </TouchableOpacity>
  );
}

function GenderChip({ label, iconKey, selected, onPress, colors }) {
  // PNG 01: pill chips in a 2×2 grid — selected = fill + onFill text (no checkmark on gender).
  let chipBackground = colors.nbSurface;
  if (selected) chipBackground = colors.nbFill;
  let labelColor = colors.nbInk;
  if (selected) labelColor = colors.nbOnFill;
  const gradientIndex = selected ? 0 : 2;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.genderChip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: chipBackground,
          shadowColor: colors.nbShadow,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <IconWell iconKey={iconKey} gradient={accentGradients[gradientIndex]} size={28} />
      <Text style={[styles.genderLabel, { color: labelColor }]} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function SkipChip({ label, selected, onPress, colors }) {
  let chipBackground = colors.nbSurface;
  if (selected) chipBackground = colors.nbFill;
  let labelColor = colors.nbInk;
  if (selected) labelColor = colors.nbOnFill;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      style={[
        styles.skipChip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: chipBackground,
        },
      ]}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color: labelColor }}>
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

// ===== SUMMARY / STRING HELPERS =====

function exercisesDislikeStringToArray(raw) {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean);
}

function exercisesDislikeArrayToString(list) {
  return list.join(', ');
}

function goalValueToDisplayLabel(value) {
  return GOAL_LABELS[value] || String(value || '').replace(/_/g, ' ');
}

function equipmentListToDisplayLabel(list) {
  if (!Array.isArray(list) || !list.length) return 'Your gear';
  return list
    .map((equipmentId) => EQUIP_LABELS[equipmentId] || String(equipmentId).replace(/_/g, ' '))
    .join(', ');
}

function capitalizeFirstLetter(value) {
  if (!value) return '';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function onboardingIconOrPngFallback(key) {
  return getOnboardingIconSource(key) || getOnboardingIconSource(`${key}_png`);
}

function injurySummaryTitle(injuriesValue, injuryRawText) {
  if (injuriesValue === null) return 'No limitations flagged';
  if (!injuryRawText) return 'Limits noted';
  if (injuryRawText.length > INJURY_SNIPPET_MAX_CHARS) {
    return `${injuryRawText.slice(0, INJURY_SNIPPET_MAX_CHARS)}…`;
  }
  return injuryRawText;
}

function injurySummarySubtitle(skipLabels) {
  if (!skipLabels.length) return 'Ready to train';
  const preview = skipLabels.slice(0, SUMMARY_SKIP_PREVIEW_COUNT).join(' and ');
  return `${preview} skipped`;
}

function trainerSummaryTitle(matchedTrainerName, trainerId) {
  if (matchedTrainerName) return `Trainer: ${matchedTrainerName}`;
  if (trainerId) return 'Trainer linked';
  return 'Solo for now';
}

function trainerSummarySubtitle(matchedTrainerName, trainerId) {
  if (matchedTrainerName || trainerId) return 'Waiting for approval';
  return 'You can add a code later';
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
          onChange={(nextWeight) => setData((previous) => ({ ...previous, weight: nextWeight }))}
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
          onChange={(nextHeightInches) =>
            setData((previous) => ({ ...previous, height: inchesToHeightObject(nextHeightInches) }))
          }
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
          onChange={(nextAge) => setData((previous) => ({ ...previous, age: nextAge }))}
        />
      </NbCard>

      <SectionLabel text="GENDER" colors={colors} />
      <View style={styles.genderGrid}>
        {GENDER_OPTIONS.map((genderOption) => (
          <GenderChip
            key={genderOption.id}
            label={genderOption.label}
            iconKey={genderOption.iconKey}
            selected={data.gender === genderOption.id}
            onPress={() => setData((previous) => ({ ...previous, gender: genderOption.id }))}
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
        {GOAL_OPTIONS.map((goalOption, gradientIndex) => (
          <SelectTile
            key={goalOption.value}
            label={goalOption.label}
            iconKey={goalOption.iconKey}
            selected={selectedGoal === goalOption.value}
            colors={colors}
            gradient={accentGradients[gradientIndex % accentGradients.length]}
            onPress={() =>
              setData((previous) => ({
                ...previous,
                goals: [goalOption.value],
                primaryGoal: goalOption.value,
              }))
            }
          />
        ))}
      </View>

      <SectionLabel text="FITNESS EXPERIENCE" colors={colors} />
      <View style={{ gap: 10 }}>
        {LEVEL_OPTIONS.map((levelOption, gradientIndex) => (
          <SelectTile
            key={levelOption.value}
            wide
            label={levelOption.label}
            description={levelOption.desc}
            iconKey={levelOption.iconKey}
            selected={data.fitnessLevel === levelOption.value}
            colors={colors}
            gradient={accentGradients[gradientIndex % accentGradients.length]}
            onPress={() => setData((previous) => ({ ...previous, fitnessLevel: levelOption.value }))}
          />
        ))}
      </View>
    </View>
  );
}

function SetupScreen({ data, setData, colors }) {
  const days = data.daysPerWeek != null ? Number(data.daysPerWeek) : DAYS_DEFAULT;

  const bumpDays = (delta) => {
    setData((previous) => {
      const currentDays = previous.daysPerWeek != null ? Number(previous.daysPerWeek) : DAYS_DEFAULT;
      const nextDays = Math.min(DAYS_MAX, Math.max(DAYS_MIN, currentDays + delta));
      return { ...previous, daysPerWeek: nextDays };
    });
  };

  const toggleEquipment = (equipmentValue) => {
    // 1. Read current multi-select list (Firestore key: equipmentAccess)
    // 2. Add or remove this gear value
    // 3. Write the next list back onto onboarding data
    setData((previous) => {
      const currentList = Array.isArray(previous.equipmentAccess) ? previous.equipmentAccess : [];
      const alreadySelected = currentList.includes(equipmentValue);
      let nextList;
      if (alreadySelected) {
        nextList = currentList.filter((item) => item !== equipmentValue);
      } else {
        nextList = [...currentList, equipmentValue];
      }
      return { ...previous, equipmentAccess: nextList };
    });
  };

  return (
    <View>
      <Text style={[styles.h1, { color: colors.nbInk, marginBottom: 12 }]}>What can you train with?</Text>
      <View style={styles.tileGrid}>
        {EQUIPMENT_OPTIONS.map((equipmentOption, gradientIndex) => (
          <SelectTile
            key={equipmentOption.value}
            label={equipmentOption.label}
            iconKey={equipmentOption.iconKey}
            span={equipmentOption.span}
            selected={(data.equipmentAccess || []).includes(equipmentOption.value)}
            colors={colors}
            gradient={accentGradients[gradientIndex % accentGradients.length]}
            onPress={() => toggleEquipment(equipmentOption.value)}
          />
        ))}
      </View>

      <SectionLabel text="WHERE DO YOU PREFER TO TRAIN?" colors={colors} />
      <FillSegmented
        options={PLACE_OPTIONS}
        selected={data.trainingEnvironment}
        onSelect={(placeId) => setData((previous) => ({ ...previous, trainingEnvironment: placeId }))}
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
          {Array.from({ length: DAYS_IN_WEEK }).map((_, dayIndex) => {
            const dayIsActive = dayIndex < days;
            const dayCellBackground = dayIsActive ? colors.nbFill : colors.nbSurface;
            return (
              <View
                key={`day-slot-${dayIndex}`}
                style={[
                  styles.dayCell,
                  { borderColor: colors.nbBorder, backgroundColor: dayCellBackground },
                ]}
              />
            );
          })}
        </View>
      </NbCard>

      <SectionLabel text="BEST TIME OF DAY" colors={colors} />
      <View style={styles.tileGrid}>
        {TIME_OPTIONS.map((timeOption) => (
          <SelectTile
            key={timeOption.value}
            label={timeOption.label}
            description={timeOption.desc}
            selected={data.preferredWorkoutTime === timeOption.value}
            colors={colors}
            onPress={() =>
              setData((previous) => ({ ...previous, preferredWorkoutTime: timeOption.value }))
            }
          />
        ))}
      </View>
    </View>
  );
}

function HealthScreen({ data, setData, colors }) {
  const noLimitations = data.injuries === null;
  const skips = useMemo(() => exercisesDislikeStringToArray(data.exercisesDislike), [data.exercisesDislike]);

  const toggleSkipExercise = (exerciseLabel) => {
    // 1. Parse stored comma string into a list
    // 2. Add or remove this exercise label
    // 3. Store back as comma string (Firestore key: exercisesDislike)
    setData((previous) => {
      const currentSkips = exercisesDislikeStringToArray(previous.exercisesDislike);
      let nextSkips;
      if (currentSkips.includes(exerciseLabel)) {
        nextSkips = currentSkips.filter((item) => item !== exerciseLabel);
      } else {
        nextSkips = [...currentSkips, exerciseLabel];
      }
      return { ...previous, exercisesDislike: exercisesDislikeArrayToString(nextSkips) };
    });
  };

  return (
    <View>
      <HeroWithLottie
        title="Any injuries or limitations?"
        subtitle="We will help you work around them safely."
        lottie={LOTTIE_INJURIES}
        lottieSize={84}
        colors={colors}
      />

      <NbCard style={{ gap: 12 }}>
        <View style={styles.noLimRow}>
          <IconWell iconKey="injury" gradient={accentGradients[4]} size={36} />
          <Text style={[styles.noLimLabel, { color: colors.nbInk }]}>I have no limitations</Text>
          <NbSwitch
            value={noLimitations}
            onValueChange={(switchOn) =>
              setData((previous) => ({ ...previous, injuries: switchOn ? null : '' }))
            }
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
            onPress={() => toggleSkipExercise(label)}
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


function trainerCodeBorderColor(codeValid, colors) {
  if (codeValid === false) return '#EF4444';
  return colors.nbBorder;
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
                  // 1. Uppercase invite codes so ABC-123 matches Firestore
                  const nextCode = text.toUpperCase();
                  setTrainerCode(nextCode);
                  // 2. Clear prior match/error while typing
                  setCodeValid(null);
                  setCodeError?.(null);
                  // 3. Debounce validate — Manipulate here: TRAINER_CODE_DEBOUNCE_MS
                  if (debounceTimer.current) clearTimeout(debounceTimer.current);
                  if (nextCode.trim().length > 0) {
                    debounceTimer.current = setTimeout(
                      () => validateTrainerCode?.(nextCode),
                      TRAINER_CODE_DEBOUNCE_MS,
                    );
                  }
                }}
                placeholder="ABC-123"
                placeholderTextColor={colors.nbMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={TRAINER_CODE_MAX_LENGTH}
                style={[
                  styles.codeInput,
                  {
                    borderColor: trainerCodeBorderColor(codeValid, colors),
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

/**
 * Pull goal / schedule / injury / trainer lines for the All set summary card.
 * Kept out of AllSetScreen so the screen stays a short paint recipe.
 */
function buildAllSetSummaryModel(data, matchedTrainerName) {
  let goalKey = data.primaryGoal;
  if (Array.isArray(data.goals) && data.goals.length) {
    goalKey = data.goals[0];
  }

  const daysPerWeek = data.daysPerWeek != null ? data.daysPerWeek : DAYS_DEFAULT;
  const goalLabel = goalValueToDisplayLabel(goalKey);

  let goalPhrase = 'your goal';
  if (GOAL_PHRASE[goalKey]) {
    goalPhrase = GOAL_PHRASE[goalKey];
  } else if (goalLabel) {
    goalPhrase = String(goalLabel).toLowerCase();
  }

  const fitnessLevelLabel = capitalizeFirstLetter(data.fitnessLevel) || 'Ready';
  const equipmentLabel = equipmentListToDisplayLabel(data.equipmentAccess);
  const trainingPlaceLabel = PLACE_LABELS[data.trainingEnvironment] || 'ready to train';
  const workoutTimeLabel = TIME_LABELS[data.preferredWorkoutTime] || 'flexible timing';
  const skippedExercises = exercisesDislikeStringToArray(data.exercisesDislike);

  // PNG sample: “Left knee flagged” when the injuries field has free text.
  const injuryRawText = data.injuries === null ? '' : String(data.injuries || '').trim();
  const injuryTitle = injurySummaryTitle(data.injuries, injuryRawText);
  const injurySubtitle = injurySummarySubtitle(skippedExercises);
  const trainerTitle = trainerSummaryTitle(matchedTrainerName, data.trainerId);
  const trainerSubtitle = trainerSummarySubtitle(matchedTrainerName, data.trainerId);

  const summaryRows = [
    { iconKey: 'muscle', title: fitnessLevelLabel, sub: `Goal: ${goalLabel || '—'}` },
    { iconKey: 'dumbbells', title: equipmentLabel, sub: `Training ${trainingPlaceLabel}` },
    { iconKey: 'injury', title: injuryTitle, sub: injurySubtitle },
    { iconKey: 'people', title: trainerTitle, sub: trainerSubtitle },
  ];

  return {
    daysPerWeek,
    goalPhrase,
    trainingPlaceLabel,
    workoutTimeLabel,
    summaryRows,
  };
}

function AllSetPlanHero({ daysPerWeek, workoutTimeLabel, trainingPlaceLabel, goalPhrase, colors }) {
  const heroPlanLine = `${workoutTimeLabel}, ${trainingPlaceLabel}, for ${goalPhrase}.`;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbHero} style={{ marginBottom: 16 }}>
      <View style={[styles.heroSlab, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
        <Text style={[styles.heroEyebrow, { color: colors.nbOnFill, opacity: 0.72 }]}>
          YOUR PLAN STARTS WITH
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text style={[styles.heroNum, { color: colors.nbOnFill }]}>{daysPerWeek}</Text>
          <Text style={[styles.heroUnit, { color: colors.nbOnFill }]}>days a week</Text>
        </View>
        <Text style={[styles.heroSub, { color: colors.nbOnFill, opacity: 0.92 }]}>
          {heroPlanLine}
        </Text>
      </View>
    </HardShadow>
  );
}

function AllSetSummaryRow({ summaryRow, rowIndex, showDividerUnder, colors }) {
  let dividerUnderRow = null;
  if (showDividerUnder) {
    dividerUnderRow = (
      <View style={{ height: 2, backgroundColor: colors.nbBorder, marginHorizontal: 10 }} />
    );
  }

  return (
    <View>
      <View style={styles.summaryRow}>
        <IconWell
          iconKey={summaryRow.iconKey}
          gradient={accentGradients[rowIndex % accentGradients.length]}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: 15, fontWeight: '900', color: colors.nbInk }}
            numberOfLines={1}
          >
            {summaryRow.title}
          </Text>
          <Text
            style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted }}
            numberOfLines={2}
          >
            {summaryRow.sub}
          </Text>
        </View>
      </View>
      {dividerUnderRow}
    </View>
  );
}

function AllSetSummaryCard({ summaryRows, colors }) {
  const lastRowIndex = summaryRows.length - 1;

  return (
    <NbCard style={{ paddingHorizontal: 4, marginBottom: 16 }}>
      {summaryRows.map((summaryRow, rowIndex) => (
        <AllSetSummaryRow
          key={summaryRow.title}
          summaryRow={summaryRow}
          rowIndex={rowIndex}
          showDividerUnder={rowIndex < lastRowIndex}
          colors={colors}
        />
      ))}
    </NbCard>
  );
}

function AllSetScreen({ data, colors, matchedTrainerName }) {
  // All set meta (PNG 15): days hero + one-line place/time/goal phrase under it.
  // 1. Turn wizard answers into the hero numbers + summary rows.
  const summaryModel = buildAllSetSummaryModel(data, matchedTrainerName);

  // 2. Paint hero → summary card → celebration lottie.
  return (
    <View>
      <AllSetPlanHero
        daysPerWeek={summaryModel.daysPerWeek}
        workoutTimeLabel={summaryModel.workoutTimeLabel}
        trainingPlaceLabel={summaryModel.trainingPlaceLabel}
        goalPhrase={summaryModel.goalPhrase}
        colors={colors}
      />
      <AllSetSummaryCard summaryRows={summaryModel.summaryRows} colors={colors} />
      <LottieView source={LOTTIE_DIET} autoPlay loop style={{ width: '100%', height: 120 }} />
    </View>
  );
}

/**
 * Renders one Design Law client onboarding body (steps 1–8).
 * Footer / header chrome stay in NewUserSetupScreen so trainer flow is untouched.
 * Flow: 1. theme  2. pick body for step  3. return that screen
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
  // 1. Theme tokens for every Design Law body
  // vocab: useTheme = Design Law light/dark color bag (nbInk, nbFill, …)
  const { colors } = useTheme();

  // 2. Pick the Design Law body for this step index (header/footer stay in parent).
  if (step === ONBOARDING_STEP_ABOUT) {
    return <BasicsScreen data={data} setData={setData} colors={colors} />;
  }
  if (step === ONBOARDING_STEP_GOAL) {
    return <GoalLevelScreen data={data} setData={setData} colors={colors} />;
  }
  if (step === ONBOARDING_STEP_SETUP) {
    return <SetupScreen data={data} setData={setData} colors={colors} />;
  }
  if (step === ONBOARDING_STEP_HEALTH) {
    return <HealthScreen data={data} setData={setData} colors={colors} />;
  }
  if (step === ONBOARDING_STEP_TRAINER) {
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
  }
  if (step === ONBOARDING_STEP_SITUATION) {
    return <SituationScreen data={data} setData={setData} colors={colors} />;
  }
  if (step === ONBOARDING_STEP_AI) {
    return (
      <AIPermissionStep
        hideActions
        onEnableAI={onEnableAI}
        onSkipAI={onSkipAI}
      />
    );
  }
  if (step === ONBOARDING_STEP_ALL_SET) {
    return (
      <AllSetScreen
        data={data}
        colors={colors}
        matchedTrainerName={matchedTrainer?.name}
      />
    );
  }

  // 3. Unknown step — render nothing
  return null;
}

// ===== PLUMBING — skip unless debugging =====

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
    // Manipulate here: 2×2 gender chip gap (PNG 01)
    gap: 10,
  },
  genderChip: {
    // 2×2 grid: each chip ≈ half row minus gap
    width: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 52,
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
    lineHeight: 16,
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
