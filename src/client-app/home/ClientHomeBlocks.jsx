// Design Law Client Home blocks — pixels match docs/design/Design-Law/screens/client-home.
// Flow: tiles/sheets/sliders/macros paint the mockup; parents still own Firestore handlers.
// Used only by TrainingHomeScreenLayout. Not a parallel chrome system — Nb* + handoff assets only.

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import NbRing from '../../look-and-feel/NbRing';
import NbSheet from '../../look-and-feel/NbSheet';
import NbSlider from '../../look-and-feel/NbSlider';
import {
  accentGradients,
  lightColors,
  nb,
} from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const HANDOFF_SLEEP = require('../../assets/icons/handoff/sleeping.png');
const HANDOFF_WATER = require('../../assets/icons/handoff/hydration.png');
const HANDOFF_SCALES = require('../../assets/icons/handoff/scales.png');
const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
const HANDOFF_PROTEIN = require('../../assets/icons/handoff/protein.png');
const HANDOFF_CARBS = require('../../assets/icons/handoff/carbs.png');
const HANDOFF_FATS = require('../../assets/icons/handoff/fats.png');
const HANDOFF_PROGRESS = require('../../assets/icons/handoff/progress.png');
const HANDOFF_SCHEDULE = require('../../assets/icons/handoff/schedule.png');
const HANDOFF_CHECKIN = require('../../assets/icons/handoff/checkin.png');

// Manipulate here: Design Law water UI is cups; app stores oz — 1 cup = 8 oz
const OZ_PER_CUP = 8;
const WATER_CUP_GOAL = 8;
const SLEEP_TILE_GOAL_HOURS = 8;
const DEFAULT_CALORIE_GOAL = 2000;
const DEFAULT_WORKOUT_RATING = 7;
const DEFAULT_SORENESS = 4;
const DEFAULT_ENERGY = 5;
const DEFAULT_STRESS = 3;
const CHECK_IN_TOTAL_FIELDS = 5;
const MINI_BAR_FILL_FALLBACK = 0.4;
const DEFAULT_PROTEIN_GOAL = 170;
const DEFAULT_CARBS_GOAL = 220;
const DEFAULT_FATS_GOAL = 70;
const REVIEW_DEFAULT_STARS = 4;
const REVIEW_DEFAULT_TAGS = ['Clear plans', 'Responsive'];

const MOOD_CHIPS = ['Happy', 'Okay', 'Tired', 'Stressed', 'Anxious'];
// Map chip label → legacy MoodCard index (0–4) so dailyLogs stays compatible
const MOOD_CHIP_TO_INDEX = { Happy: 4, Okay: 2, Tired: 1, Stressed: 0, Anxious: 0 };

const WATER_DAY_CHIPS = [
  { id: 0, label: 'Today' },
  { id: 1, label: 'Yesterday' },
];

const MINI_BAR_HEIGHTS = [8, 14, 10, 18, 12, 16, 9];

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  maybeFunction(...args);
}


/**
 * Convert stored ounces into whole cups for the tile / sheet UI.
 * @param {number} oz
 * @returns {number}
 */
function ozToCups(oz) {
  let ounces = Number(oz);
  if (!ounces) {
    ounces = 0;
  }
  return Math.max(0, Math.round(ounces / OZ_PER_CUP));
}

/**
 * Convert cups from the water sheet back into ounces for storage.
 * @param {number} cups
 * @returns {number}
 */
function cupsToOz(cups) {
  let cupCount = Number(cups);
  if (!cupCount) {
    cupCount = 0;
  }
  return Math.max(0, Math.round(cupCount) * OZ_PER_CUP);
}

function logSheetTitleForMetric(metricKey) {
  if (metricKey === 'water') {
    return 'Log water';
  }
  if (metricKey === 'sleep') {
    return 'Log sleep';
  }
  if (metricKey === 'weight') {
    return 'Log weight';
  }
  if (metricKey === 'steps') {
    return 'Log steps';
  }
  return 'Log';
}

function sleepTileDisplayValue(sleepHours) {
  if (typeof sleepHours === 'number') {
    return `${sleepHours}`;
  }
  return '—';
}

function stepsTileDisplayValue(steps) {
  if (steps != null) {
    return `${Number(steps).toLocaleString()}`;
  }
  return '—';
}

function weightTileDisplayValue(weightLb) {
  if (weightLb != null) {
    return `${weightLb}`;
  }
  return '—';
}

function buildNumberTileRows({ sleepHours, waterOz, weightLb, steps }) {
  const sleepValue = sleepTileDisplayValue(sleepHours);
  const stepsValue = stepsTileDisplayValue(steps);
  const weightValue = weightTileDisplayValue(weightLb);
  const waterCupsValue = `${ozToCups(waterOz)}`;

  const primary = [
    {
      key: 'sleep',
      label: 'Sleep',
      value: sleepValue,
      unit: 'hrs',
      hint: null,
      spark: true,
      icon: HANDOFF_SLEEP,
      index: 2,
      radius: {
        borderTopLeftRadius: 10,
        borderTopRightRadius: 26,
        borderBottomRightRadius: 10,
        borderBottomLeftRadius: 10,
      },
    },
    {
      key: 'water',
      label: 'Water',
      value: waterCupsValue,
      unit: 'cups',
      hint: '+ Add a cup',
      spark: false,
      icon: HANDOFF_WATER,
      index: 0,
      radius: {
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 26,
        borderBottomLeftRadius: 10,
      },
    },
  ];
  const secondary = [
    {
      key: 'weight',
      label: 'Weight',
      value: weightValue,
      unit: 'lb',
      hint: 'Tap to log',
      spark: false,
      icon: HANDOFF_SCALES,
      index: 5,
      radius: {
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
        borderBottomLeftRadius: 10,
      },
    },
    {
      key: 'steps',
      label: 'Steps',
      value: stepsValue,
      unit: '',
      hint: 'Tap to log',
      spark: false,
      icon: HANDOFF_WORKOUT,
      index: 3,
      radius: {
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 10,
        borderBottomLeftRadius: 10,
      },
    },
  ];
  return { primary, secondary };
}

function sleepSparkFillRatio(sleepHours) {
  if (typeof sleepHours === 'number') {
    return Math.min(1, sleepHours / SLEEP_TILE_GOAL_HOURS);
  }
  return MINI_BAR_FILL_FALLBACK;
}

function moodLabelFromIndex(moodIdx) {
  const moodNumber = Number(moodIdx);
  let matchedChip = null;
  for (let index = 0; index < MOOD_CHIPS.length; index += 1) {
    const chipLabel = MOOD_CHIPS[index];
    if (MOOD_CHIP_TO_INDEX[chipLabel] === moodNumber) {
      matchedChip = chipLabel;
      break;
    }
  }
  if (matchedChip) {
    return matchedChip;
  }
  if (Number.isFinite(moodNumber)) {
    return MOOD_CHIPS[2];
  }
  return null;
}

function countCompletedCheckInFields(values) {
  const fieldValues = [
    (values && values.soreness),
    (values && values.energy),
    (values && values.stress),
    (values && values.mood),
    (values && values.workout),
  ];
  let doneCount = 0;
  for (const fieldValue of fieldValues) {
    if (fieldValue != null && fieldValue !== '') doneCount += 1;
  }
  return doneCount;
}

function setChipDisplayLabel(repsText, weightText) {
  let hasRepsOrWeight = false;
  if (repsText || weightText) {
    hasRepsOrWeight = true;
  }
  if (!hasRepsOrWeight) {
    return 'Reps × lbs';
  }
  let repsPart = repsText;
  if (!repsPart) {
    repsPart = '—';
  }
  let weightPart = weightText;
  if (!weightPart) {
    weightPart = '—';
  }
  return `${repsPart} × ${weightPart}`;
}

function parseSetChipText(rawText) {
  // Accept "8 x 135" or "8×135" so the chip matches Design Law
  const parts = String(rawText).split(/\s*[x×]\s*/i);
  return {
    repsText: parts[0] || '',
    weightText: parts[1] || '',
  };
}

function logSheetDraftValue(metricKey, sleepDraft, weightDraft, stepsDraft) {
  if (metricKey === 'sleep') {
    return sleepDraft;
  }
  if (metricKey === 'weight') {
    return weightDraft;
  }
  return stepsDraft;
}

function logSheetDraftSetter(metricKey, setSleepDraft, setWeightDraft, setStepsDraft) {
  if (metricKey === 'sleep') {
    return setSleepDraft;
  }
  if (metricKey === 'weight') {
    return setWeightDraft;
  }
  return setStepsDraft;
}

function logSheetPlaceholder(metricKey) {
  if (metricKey === 'sleep') {
    return 'Hours';
  }
  if (metricKey === 'weight') {
    return 'Lbs';
  }
  return 'Steps';
}

function trainerSheetSubtitleForRow(row, notesSubtitle, paymentSubtitle) {
  if (row.key === 'notes' && notesSubtitle) {
    return notesSubtitle;
  }
  if (row.key === 'pay' && paymentSubtitle) {
    return paymentSubtitle;
  }
  return row.subtitle;
}

function firstNameFromTrainerName(trainerName) {
  const firstWord = String(trainerName || '').split(/\s+/)[0];
  if (firstWord) {
    return firstWord;
  }
  return 'trainer';
}

function tagsWithoutThisLabel(previousTags, tagToDrop) {
  const kept = [];
  for (let index = 0; index < previousTags.length; index += 1) {
    const existingTag = previousTags[index];
    if (existingTag === tagToDrop) {
      continue;
    }
    kept.push(existingTag);
  }
  return kept;
}

function toggleReviewTag(previousTags, tag, tagIsOn) {
  if (tagIsOn) {
    return tagsWithoutThisLabel(previousTags, tag);
  }
  return [...previousTags, tag];
}

// ===== MAIN FUNCTION =====

/** Mini spark bars under Sleep (Design Law notebook card detail). */
function buildMiniBarElements(themeColors, fillRatio) {
  const bars = [];
  for (let barIndex = 0; barIndex < MINI_BAR_HEIGHTS.length; barIndex += 1) {
    const barHeight = MINI_BAR_HEIGHTS[barIndex];
    let barFilled = false;
    if (barIndex / MINI_BAR_HEIGHTS.length < fillRatio) {
      barFilled = true;
    }
    let barBackground = themeColors.pillBg;
    if (barFilled) {
      barBackground = themeColors.fill;
    }
    bars.push(
      <View
        key={barIndex}
        style={{
          width: 6,
          height: barHeight,
          borderRadius: 2,
          borderWidth: 1.5,
          borderColor: themeColors.cardBorder,
          backgroundColor: barBackground,
        }}
      />,
    );
  }
  return bars;
}

function MiniBars({ themeColors, fillRatio = 0.6 }) {
  return (
    <View style={styles.miniBars}>
      {buildMiniBarElements(themeColors, fillRatio)}
    </View>
  );
}

function NumberTile({ tile, themeColors, sleepHours, onOpenLog, compact }) {
  let tileStyle = styles.vt;
  if (compact) {
    tileStyle = styles.vtCompact;
  }
  let cellStyle = styles.vtCell;
  if (compact) {
    cellStyle = styles.vtCellCompact;
  }
  let valueStyle = styles.vtValue;
  if (compact) {
    valueStyle = styles.vtValueCompact;
  }
  let iconSize = 44;
  if (compact) {
    iconSize = 32;
  }
  const sparkFillRatio = sleepSparkFillRatio(sleepHours);
  let hasUnit = false;
  if (tile.unit) {
    hasUnit = true;
  }

  let unitText = null;
  if (hasUnit) {
    unitText = (
      <Text style={[styles.vtUnit, { color: themeColors.textMuted }]}>{` ${tile.unit}`}</Text>
    );
  }

  let footerContent = (
    <Text style={[styles.vtHint, { color: themeColors.text }]}>{tile.hint}</Text>
  );
  if (tile.spark) {
    footerContent = <MiniBars themeColors={themeColors} fillRatio={sparkFillRatio} />;
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={cellStyle}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => callIfFunction(onOpenLog, tile.key)}
        style={[
          tileStyle,
          tile.radius,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <View style={styles.vtTop}>
          <Text style={[styles.vtLabel, { color: themeColors.textMuted }]}>{tile.label}</Text>
          <NbIconChip source={tile.icon} index={tile.index} size={iconSize} />
        </View>
        <Text style={[valueStyle, { color: themeColors.text }]}>
          {tile.value}
          {unitText}
        </Text>
        <View style={styles.vtFooter}>
          {footerContent}
        </View>
      </TouchableOpacity>
    </HardShadow>
  );
}

/**
 * Design Law “Today’s numbers” — Sleep + Water as the hero pair; Weight/Steps secondary.
 * Tap opens the parent log sheet.
 */

function buildNumberTileElements(tiles, themeColors, sleepHours, onOpenLog, compact) {
  const elements = [];
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index];
    elements.push(
      <NumberTile
        key={tile.key}
        tile={tile}
        themeColors={themeColors}
        sleepHours={sleepHours}
        onOpenLog={onOpenLog}
        compact={compact}
      />,
    );
  }
  return elements;
}

/**
 * Four client daily health stat tiles: sleep, water, weight, and steps.
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ClientNumberTiles({
  themeColors,
  sleepHours,
  waterOz,
  weightLb,
  steps,
  onOpenLog,
}) {
  // 1. Build the two Design Law rows from today’s stored numbers.
  const { primary, secondary } = buildNumberTileRows({ sleepHours, waterOz, weightLb, steps });

  // 2. Paint hero pair, then compact secondary pair.
  return (
    <View style={{ marginBottom: nb.blockGap, gap: 12 }}>
      <View style={styles.vtGrid}>
        {buildNumberTileElements(primary, themeColors, sleepHours, onOpenLog, false)}
      </View>
      <View style={styles.vtGrid}>
        {buildNumberTileElements(secondary, themeColors, sleepHours, onOpenLog, true)}
      </View>
    </View>
  );
}

function NutritionEmptyCard({ themeColors, onOpenNutrition }) {
  let showLogButton = false;
  if (typeof onOpenNutrition === 'function') {
    showLogButton = true;
  }
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View
        style={[
          styles.emptyDashCard,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <NbIconChip source={HANDOFF_PROTEIN} index={2} size={48} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No meals logged yet</Text>
        <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
          Log breakfast, lunch, or a snack and macros show up here.
        </Text>
        {showLogButton ? (
          <NbButton variant="fill" onPress={onOpenNutrition} style={{ alignSelf: 'stretch' }}>
            Log a meal
          </NbButton>
        ) : null}
      </View>
    </HardShadow>
  );
}

function MacroProgressRow({ macroRow, themeColors }) {
  const fractionLabel = `${macroRow.value}/${macroRow.goal}g`;
  const progress = macroRow.value / Math.max(1, macroRow.goal);
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.macroRow}>
        <NbIconChip source={macroRow.icon} index={macroRow.index} size={28} />
        <Text style={[styles.macroLabel, { color: themeColors.text }]}>{macroRow.label}</Text>
        <Text style={[styles.macroFrac, { color: themeColors.textMuted }]}>{fractionLabel}</Text>
      </View>
      <NbProgressBar progress={progress} index={macroRow.index} />
    </View>
  );
}

/**
 * Nutrition today — calorie ring + protein/carbs/fats bars (Design Law).
 * Macro totals are optional; when missing we show 0 / goal placeholders from calorieGoal.
 */

function buildMacroProgressElements(macros, themeColors) {
  const elements = [];
  for (let index = 0; index < macros.length; index += 1) {
    const macroRow = macros[index];
    elements.push(
      <MacroProgressRow
        key={macroRow.key}
        macroRow={macroRow}
        themeColors={themeColors}
      />,
    );
  }
  return elements;
}

/**
 * Daily nutrition summary card showing calorie ring and macro progress bars.
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ClientNutritionCard({
  themeColors,
  todayCalories,
  calorieGoal,
  proteinG,
  carbsG,
  fatsG,
  proteinGoal = DEFAULT_PROTEIN_GOAL,
  carbsGoal = DEFAULT_CARBS_GOAL,
  fatsGoal = DEFAULT_FATS_GOAL,
  onOpenNutrition,
}) {
  // 1. Round today’s macros and decide empty-vs-data.
  let caloriesToday = Math.round(todayCalories || 0);
  let calorieGoalValue = calorieGoal;
  if (!calorieGoalValue) {
    calorieGoalValue = DEFAULT_CALORIE_GOAL;
  }
  const calorieTarget = Math.max(1, Math.round(calorieGoalValue));
  const proteinGrams = Math.round(proteinG || 0);
  const carbsGrams = Math.round(carbsG || 0);
  const fatsGrams = Math.round(fatsG || 0);
  let isEmpty = false;
  if (caloriesToday <= 0 && proteinGrams <= 0 && carbsGrams <= 0 && fatsGrams <= 0) {
    isEmpty = true;
  }

  const macros = [
    {
      key: 'protein',
      label: 'Protein',
      value: proteinGrams,
      goal: proteinGoal,
      icon: HANDOFF_PROTEIN,
      index: 1,
    },
    {
      key: 'carbs',
      label: 'Carbs',
      value: carbsGrams,
      goal: carbsGoal,
      icon: HANDOFF_CARBS,
      index: 3,
    },
    {
      key: 'fats',
      label: 'Fats',
      value: fatsGrams,
      goal: fatsGoal,
      icon: HANDOFF_FATS,
      index: 0,
    },
  ];

  // 2. Empty dashed shell when nothing is logged yet.
  if (isEmpty) {
    return <NutritionEmptyCard themeColors={themeColors} onOpenNutrition={onOpenNutrition} />;
  }

  // 3. Ring + macro bars; whole card opens nutrition.
  const ringProgress = Math.min(1, caloriesToday / calorieTarget);
  const caloriesLabel = `${caloriesToday.toLocaleString()}`;
  const goalLabel = `of ${calorieTarget.toLocaleString()}`;

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={onOpenNutrition} style={{ marginBottom: nb.blockGap }}>
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View
          style={[
            styles.nutritionCard,
            { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder },
          ]}
        >
          <NbRing
            progress={ringProgress}
            size={112}
            strokeWidth={12}
            value={caloriesLabel}
            label={goalLabel}
          />
          <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
            {buildMacroProgressElements(macros, themeColors)}
          </View>
        </View>
      </HardShadow>
    </TouchableOpacity>
  );
}

function WorkoutEmptyCard({ themeColors, addExercise }) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View
        style={[
          styles.emptyDashCard,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.cardBorder,
          },
        ]}
      >
        <NbIconChip source={HANDOFF_WORKOUT} index={5} size={48} />
        <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No workout logged yet</Text>
        <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
          Add an exercise and its sets. Your trainer is told when you save.
        </Text>
        <NbButton variant="fill" onPress={addExercise} style={{ alignSelf: 'stretch' }}>
          + Add exercise
        </NbButton>
      </View>
    </HardShadow>
  );
}

function WorkoutSetChip({ exerciseId, setRow, themeColors, updateSetField, removeSet }) {
  const repsText = String(setRow.reps || '').trim();
  const weightText = String(setRow.weight || '').trim();
  const hasRepsOrWeight = Boolean(repsText || weightText);
  const label = setChipDisplayLabel(repsText, weightText);
  let inputValue = '';
  if (hasRepsOrWeight) {
    inputValue = label;
  }

  const onChangeSetText = (rawText) => {
    const parsed = parseSetChipText(rawText);
    updateSetField(exerciseId, setRow.id, 'reps', parsed.repsText);
    updateSetField(exerciseId, setRow.id, 'weight', parsed.weightText);
  };

  return (
    <TouchableOpacity
      key={setRow.id}
      onLongPress={() => removeSet(exerciseId, setRow.id)}
      style={[
        styles.setChip,
        { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg },
      ]}
    >
      <TextInput
        style={[styles.setChipInput, { color: themeColors.text }]}
        placeholder="8 × 135"
        placeholderTextColor={themeColors.textMuted}
        value={inputValue}
        onChangeText={onChangeSetText}
      />
    </TouchableOpacity>
  );
}

function WorkoutExerciseBlock({
  exercise,
  themeColors,
  updateExerciseName,
  removeExercise,
  addSet,
  removeSet,
  updateSetField,
}) {
  return (
    <View key={exercise.id} style={styles.exBlock}>
      <View style={styles.exHeader}>
        <TextInput
          style={[styles.exName, { color: themeColors.text }]}
          placeholder="Exercise name"
          placeholderTextColor={themeColors.textMuted}
          value={exercise.name}
          onChangeText={(nameText) => updateExerciseName(exercise.id, nameText)}
        />
        <TouchableOpacity onPress={() => removeExercise(exercise.id)} hitSlop={8}>
          <Ionicons name="trash-outline" size={18} color={themeColors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={styles.setsRow}>
        {buildWorkoutSetChipElements(
          exercise.id,
          exercise.sets,
          themeColors,
          updateSetField,
          removeSet,
        )}
        <TouchableOpacity
          onPress={() => addSet(exercise.id)}
          style={[styles.addSet, { borderColor: themeColors.cardBorder }]}
        >
          <Text style={{ fontWeight: '900', color: themeColors.text, fontSize: 13 }}>+ Add set</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Workouts today — exercise rows with set chips (Design Law), still driven by workoutDiary state.
 */

function buildWorkoutSetChipElements(exerciseId, sets, themeColors, updateSetField, removeSet) {
  const chips = [];
  for (let index = 0; index < sets.length; index += 1) {
    const setRow = sets[index];
    chips.push(
      <WorkoutSetChip
        key={setRow.id}
        exerciseId={exerciseId}
        setRow={setRow}
        themeColors={themeColors}
        updateSetField={updateSetField}
        removeSet={removeSet}
      />,
    );
  }
  return chips;
}

function buildWorkoutExerciseElements(
  workoutExercises,
  themeColors,
  updateExerciseName,
  removeExercise,
  addSet,
  removeSet,
  updateSetField,
) {
  const blocks = [];
  for (let index = 0; index < workoutExercises.length; index += 1) {
    const exercise = workoutExercises[index];
    blocks.push(
      <WorkoutExerciseBlock
        key={exercise.id}
        exercise={exercise}
        themeColors={themeColors}
        updateExerciseName={updateExerciseName}
        removeExercise={removeExercise}
        addSet={addSet}
        removeSet={removeSet}
        updateSetField={updateSetField}
      />,
    );
  }
  return blocks;
}

/**
 * Workout tracking card displaying exercises, sets, and rep completion state.
 * @param {object} props
 * @returns {JSX.Element|null}
 */
export function ClientWorkoutCard({ themeColors, state }) {
  if (!(state && state.loaded)) {
    return null;
  }
  const {
    workoutName,
    setWorkoutName,
    workoutExercises,
    addExercise,
    removeExercise,
    updateExerciseName,
    addSet,
    removeSet,
    updateSetField,
    save,
    showNotified,
  } = state;

  // empty-vs-data PNG: dashed shell + Add exercise when nothing logged yet
  if (!(workoutExercises && workoutExercises.length)) {
    return <WorkoutEmptyCard themeColors={themeColors} addExercise={addExercise} />;
  }

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View
        style={[
          styles.workoutCard,
          { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder },
        ]}
      >
        <TextInput
          style={[
            styles.dayInput,
            {
              borderColor: themeColors.cardBorder,
              color: themeColors.text,
              backgroundColor: themeColors.pillBg,
            },
          ]}
          placeholder="Workout day — Chest, Pull, Legs…"
          placeholderTextColor={themeColors.textMuted}
          value={workoutName}
          onChangeText={setWorkoutName}
        />
        {buildWorkoutExerciseElements(
          workoutExercises,
          themeColors,
          updateExerciseName,
          removeExercise,
          addSet,
          removeSet,
          updateSetField,
        )}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <TouchableOpacity
            onPress={addExercise}
            style={[styles.ghostBtn, { flex: 1, borderColor: themeColors.cardBorder }]}
          >
            <Text style={{ fontWeight: '900', color: themeColors.text }}>+ Exercise</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={save}
          activeOpacity={0.9}
          style={[
            styles.saveBtn,
            { backgroundColor: themeColors.fill, borderColor: themeColors.cardBorder },
          ]}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.onFill }}>
            Save workout
          </Text>
        </TouchableOpacity>
        {showNotified ? (
          <View
            style={[
              styles.notifyPill,
              { backgroundColor: accentGradients[0][0], borderColor: themeColors.cardBorder },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: lightColors.nbInk }}>
              Trainer notified after you save
            </Text>
          </View>
        ) : (
          <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 6 }}>
            Trainer notified after you save
          </Text>
        )}
      </View>
    </HardShadow>
  );
}

function CheckInEmptyCard({ themeColors, onExpand }) {
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={onExpand}
        style={[
          styles.emptyDashCard,
          {
            backgroundColor: themeColors.cardBg,
            borderColor: themeColors.cardBorder,
            alignItems: 'flex-start',
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%' }}>
          <NbIconChip source={HANDOFF_CHECKIN} index={4} size={44} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Not logged yet</Text>
            <Text style={[styles.emptyBody, { color: themeColors.textMuted }]}>
              Soreness, energy, stress, and mood — tap to start.
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </HardShadow>
  );
}

function buildMoodChipElements(moodLabel, themeColors, onSave) {
  const chips = [];
  for (let index = 0; index < MOOD_CHIPS.length; index += 1) {
    const chipLabel = MOOD_CHIPS[index];
    let isSelected = false;
    if (moodLabel === chipLabel) {
      isSelected = true;
    }
    let chipBackground = themeColors.pillBg;
    let chipTextColor = themeColors.text;
    if (isSelected) {
      chipBackground = themeColors.fill;
      chipTextColor = themeColors.onFill;
    }
    chips.push(
      <TouchableOpacity
        key={chipLabel}
        onPress={() => callIfFunction(onSave, 'dashboard_mood', String(MOOD_CHIP_TO_INDEX[chipLabel]))}
        style={[
          styles.moodChip,
          {
            borderColor: themeColors.cardBorder,
            backgroundColor: chipBackground,
          },
        ]}
      >
        <Text style={{ fontSize: 12, fontWeight: '900', color: chipTextColor }}>
          {chipLabel}
        </Text>
      </TouchableOpacity>,
    );
  }
  return chips;
}

function MoodChipRow({ moodLabel, themeColors, onSave }) {
  return (
    <View style={styles.moodRow}>
      {buildMoodChipElements(moodLabel, themeColors, onSave)}
    </View>
  );
}

/**
 * One Daily check-in card: sliders + mood chips + post-workout (Design Law).
 * saveFn(storageKey, stringValue) must write the same keys RatingCard used.
 */
export function ClientCheckInCard({
  themeColors,
  values,
  onSave,
  trainerFirstName,
  noteValue,
  onNoteChange,
  onNoteBlur,
}) {
  // Hook order frozen: expanded only
  const [expanded, setExpanded] = useState(false);

  // 1. Read slider defaults + mood chip from stored dailyLogs values.
  let soreness = Number(values && values.soreness);
  if (!soreness) {
    soreness = DEFAULT_SORENESS;
  }
  let energy = Number(values && values.energy);
  if (!energy) {
    energy = DEFAULT_ENERGY;
  }
  let stress = Number(values && values.stress);
  if (!stress) {
    stress = DEFAULT_STRESS;
  }
  let workout = Number(values && values.workout);
  if (!workout) {
    workout = DEFAULT_WORKOUT_RATING;
  }
  const moodLabel = moodLabelFromIndex((values && values.mood));
  const doneCount = countCompletedCheckInFields(values);
  const donePillLabel = `${doneCount} of ${CHECK_IN_TOTAL_FIELDS} done`;
  let noteHeading = 'Note to trainer';
  if (trainerFirstName) {
    noteHeading = `Note to ${trainerFirstName}`;
  }

  // empty-vs-data PNG: collapsed “Not logged yet” until the first slider/mood is saved (or tap to expand)
  if (doneCount === 0 && !expanded) {
    return <CheckInEmptyCard themeColors={themeColors} onExpand={() => setExpanded(true)} />;
  }

  // 2. Full check-in: sliders, mood chips, workout rating, note.
  // Storage keys stay dashboard_* — letters frozen for dailyLogs / RatingCard compatibility.
  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: nb.blockGap }}>
      <View
        style={[
          styles.checkCard,
          { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder },
        ]}
      >
        <View style={styles.checkHead}>
          <Text style={[styles.checkTitle, { color: themeColors.text }]}>Daily check-in</Text>
          <View
            style={[
              styles.donePill,
              { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.textMuted }}>
              {donePillLabel}
            </Text>
          </View>
        </View>

        <NbSlider
          label="Muscle soreness"
          valueLabel={`${soreness}/8`}
          value={soreness}
          min={1}
          max={8}
          colors={accentGradients[1]}
          onChange={(sliderValue) => callIfFunction(onSave, 'dashboard_soreness', String(sliderValue))}
          style={{ marginBottom: 14 }}
        />
        <NbSlider
          label="Energy level"
          valueLabel={`${energy}/8`}
          value={energy}
          min={1}
          max={8}
          colors={accentGradients[0]}
          onChange={(sliderValue) => callIfFunction(onSave, 'dashboard_energy', String(sliderValue))}
          style={{ marginBottom: 14 }}
        />
        <NbSlider
          label="Stress level"
          valueLabel={`${stress}/8`}
          value={stress}
          min={1}
          max={8}
          colors={accentGradients[2]}
          onChange={(sliderValue) => callIfFunction(onSave, 'dashboard_stress', String(sliderValue))}
          style={{ marginBottom: 14 }}
        />

        <Text style={[styles.moodLabel, { color: themeColors.text }]}>Mood</Text>
        <MoodChipRow moodLabel={moodLabel} themeColors={themeColors} onSave={onSave} />

        <NbSlider
          label="Post-workout rating"
          valueLabel={`${workout}/10`}
          value={workout}
          min={1}
          max={10}
          colors={accentGradients[3]}
          onChange={(sliderValue) => callIfFunction(onSave, 'dashboard_workout_rating', String(sliderValue))}
          style={{ marginTop: 14, marginBottom: 14 }}
        />

        <Text style={[styles.moodLabel, { color: themeColors.text }]}>{noteHeading}</Text>
        <TextInput
          style={[
            styles.noteBox,
            {
              borderColor: themeColors.cardBorder,
              backgroundColor: themeColors.pillBg,
              color: themeColors.text,
            },
          ]}
          placeholder="How did you feel today? Any pain or wins?"
          placeholderTextColor={themeColors.textMuted}
          multiline
          value={noteValue || ''}
          onChangeText={onNoteChange}
          onBlur={onNoteBlur}
        />
      </View>
    </HardShadow>
  );
}


function buildGoTileElements(items, themeColors) {
  const tiles = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    let iconSource = HANDOFF_PROGRESS;
    if (item.icon) {
      iconSource = item.icon;
    }
    const chipIndex = itemIndex * 3;
    let onPressItem = item.onPress;
    if (!onPressItem) {
      onPressItem = () => {};
    }
    let subLine = null;
    if (item.sub) {
      subLine = (
        <Text style={{ fontSize: 12, color: themeColors.textMuted }}>{item.sub}</Text>
      );
    }
    tiles.push(
      <HardShadow
        key={item.label}
        offset={nb.shadowOffsetSmall}
        radius={10}
        style={{ width: '48%' }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={onPressItem}
          style={[
            styles.goTile,
            { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder },
          ]}
        >
          <NbIconChip source={iconSource} index={chipIndex} size={40} />
          <Text style={[styles.goLabel, { color: themeColors.text }]}>{item.label}</Text>
          {subLine}
        </TouchableOpacity>
      </HardShadow>,
    );
  }
  return tiles;
}

/**
 * Quick action navigation grid for key app sections.
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ClientGoToGrid({ themeColors, items, notesFilesItem }) {
  return (
    <View style={{ marginBottom: 24, gap: 10 }}>
      <View style={styles.goGrid}>
        {buildGoTileElements(items, themeColors)}
      </View>
      {notesFilesItem ? (
        <HardShadow offset={nb.shadowOffsetCard} radius={10}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={notesFilesItem.onPress ? notesFilesItem.onPress : () => {}}
            style={[
              styles.notesRow,
              { backgroundColor: themeColors.cardBg, borderColor: themeColors.cardBorder },
            ]}
          >
            <NbIconChip source={HANDOFF_SCHEDULE} index={2} size={40} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: themeColors.text }}>
                {notesFilesItem.label}
              </Text>
              <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                {notesFilesItem.sub}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={themeColors.text} />
          </TouchableOpacity>
        </HardShadow>
      ) : null}
    </View>
  );
}


function buildWaterCupElements(cups, themeColors, setCups) {
  const cupsElements = [];
  for (let cupIndex = 0; cupIndex < WATER_CUP_GOAL; cupIndex += 1) {
    let cupIsFilled = false;
    if (cupIndex < cups) {
      cupIsFilled = true;
    }
    let cupBackground = themeColors.pillBg;
    let tintColor = undefined;
    if (cupIsFilled) {
      cupBackground = themeColors.fill;
      tintColor = themeColors.onFill;
    }
    cupsElements.push(
      <TouchableOpacity
        key={cupIndex}
        onPress={() => setCups(cupIndex + 1)}
        style={[
          styles.cup,
          {
            borderColor: themeColors.cardBorder,
            backgroundColor: cupBackground,
          },
        ]}
      >
        <Image
          source={HANDOFF_WATER}
          style={{ width: 22, height: 22, tintColor }}
          resizeMode="contain"
        />
      </TouchableOpacity>,
    );
  }
  return cupsElements;
}


function buildWaterDayChipElements(dayOffset, setDayOffset, themeColors) {
  const chips = [];
  for (let index = 0; index < WATER_DAY_CHIPS.length; index += 1) {
    const dayChip = WATER_DAY_CHIPS[index];
    let dayIsSelected = false;
    if (dayOffset === dayChip.id) {
      dayIsSelected = true;
    }
    let dayBackground = themeColors.pillBg;
    let dayTextColor = themeColors.text;
    if (dayIsSelected) {
      dayBackground = themeColors.fill;
      dayTextColor = themeColors.onFill;
    }
    chips.push(
      <TouchableOpacity
        key={dayChip.id}
        onPress={() => setDayOffset(dayChip.id)}
        style={[
          styles.dayChip,
          {
            borderColor: themeColors.cardBorder,
            backgroundColor: dayBackground,
          },
        ]}
      >
        <Text style={{ fontWeight: '900', color: dayTextColor }}>{dayChip.label}</Text>
      </TouchableOpacity>,
    );
  }
  return chips;
}

function WaterLogBody({
  themeColors,
  cups,
  setCups,
  dayOffset,
  setDayOffset,
  onClose,
  onSave,
}) {
  const cupsHeading = `${cups} of ${WATER_CUP_GOAL} cups`;
  return (
    <View style={{ gap: 16, paddingBottom: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: '900', color: themeColors.text }}>
        {cupsHeading}
      </Text>
      <View style={styles.cupGrid}>
        {buildWaterCupElements(cups, themeColors, setCups)}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {buildWaterDayChipElements(dayOffset, setDayOffset, themeColors)}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NbButton variant="ghost" onPress={onClose}>
            Cancel
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton variant="fill" onPress={onSave}>
            Save
          </NbButton>
        </View>
      </View>
    </View>
  );
}

function GenericMetricLogBody({
  themeColors,
  metricKey,
  sleepDraft,
  weightDraft,
  stepsDraft,
  setSleepDraft,
  setWeightDraft,
  setStepsDraft,
  onClose,
  onSave,
}) {
  const draftValue = logSheetDraftValue(metricKey, sleepDraft, weightDraft, stepsDraft);
  const onChangeDraft = logSheetDraftSetter(
    metricKey,
    setSleepDraft,
    setWeightDraft,
    setStepsDraft,
  );
  const placeholder = logSheetPlaceholder(metricKey);

  return (
    <View style={{ gap: 16, paddingBottom: 24 }}>
      <TextInput
        style={[
          styles.genericInput,
          {
            borderColor: themeColors.cardBorder,
            color: themeColors.text,
            backgroundColor: themeColors.pillBg,
          },
        ]}
        keyboardType="decimal-pad"
        value={draftValue}
        onChangeText={onChangeDraft}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textMuted}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <NbButton variant="ghost" onPress={onClose}>
            Cancel
          </NbButton>
        </View>
        <View style={{ flex: 1 }}>
          <NbButton variant="fill" onPress={onSave}>
            Save
          </NbButton>
        </View>
      </View>
    </View>
  );
}


function draftTextFromMaybeNumber(value) {
  if (value == null) {
    return '';
  }
  return String(value);
}

/**
 * Daily health metrics logging bottom sheet for water, sleep, weight, and steps.
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ClientLogSheet({
  visible,
  metricKey,
  themeColors,
  waterOz,
  sleepHours,
  weightLb,
  steps,
  onClose,
  onSaveWaterOz,
  onSaveSleep,
  onSaveWeight,
  onSaveSteps,
}) {
  const title = logSheetTitleForMetric(metricKey);

  // Hook order frozen: cups → sleep → weight → steps → dayOffset → reset effect
  const [cups, setCups] = useState(ozToCups(waterOz));
  const [sleepDraft, setSleepDraft] = useState(String(sleepHours == null ? '' : sleepHours));
  const [weightDraft, setWeightDraft] = useState(String(weightLb ?? ''));
  const [stepsDraft, setStepsDraft] = useState(String(steps ?? ''));
  // Manipulate here: dayOffset is UI-only for water (0 today, 1 yesterday) — does not change save path yet
  const [dayOffset, setDayOffset] = useState(0);

  // vocab: useEffect = reset drafts whenever the sheet opens or the metric/source numbers change
  useEffect(() => {
    if (!visible) return;
    setCups(ozToCups(waterOz));
    setSleepDraft(String(sleepHours == null ? '' : sleepHours));
    setWeightDraft(draftTextFromMaybeNumber(weightLb));
    setStepsDraft(draftTextFromMaybeNumber(steps));
    setDayOffset(0);
  }, [visible, metricKey, waterOz, sleepHours, weightLb, steps]);

  // 1. Parse drafts and call the matching parent save, then close.
  const save = () => {
    if (metricKey === 'water') callIfFunction(onSaveWaterOz, cupsToOz(cups));
    if (metricKey === 'sleep') {
      const sleepHoursValue = parseFloat(sleepDraft);
      if (!Number.isNaN(sleepHoursValue)) callIfFunction(onSaveSleep, sleepHoursValue);
    }
    if (metricKey === 'weight') {
      const weightValue = parseFloat(weightDraft);
      if (!Number.isNaN(weightValue)) callIfFunction(onSaveWeight, weightValue);
    }
    if (metricKey === 'steps') {
      const stepsValue = parseInt(stepsDraft, 10);
      if (!Number.isNaN(stepsValue)) callIfFunction(onSaveSteps, stepsValue);
    }
    callIfFunction(onClose);
  };

  const isWaterMetric = metricKey === 'water';

  return (
    <NbSheet visible={!!visible} onClose={onClose} title={title}>
      {isWaterMetric ? (
        <WaterLogBody
          themeColors={themeColors}
          cups={cups}
          setCups={setCups}
          dayOffset={dayOffset}
          setDayOffset={setDayOffset}
          onClose={onClose}
          onSave={save}
        />
      ) : (
        <GenericMetricLogBody
          themeColors={themeColors}
          metricKey={metricKey}
          sleepDraft={sleepDraft}
          weightDraft={weightDraft}
          stepsDraft={stepsDraft}
          setSleepDraft={setSleepDraft}
          setWeightDraft={setWeightDraft}
          setStepsDraft={setStepsDraft}
          onClose={onClose}
          onSave={save}
        />
      )}
    </NbSheet>
  );
}

// Manipulate here: subtitles match Design Law copy; icon indices cycle accentGradients
const TRAINER_SHEET_ROWS = [
  {
    key: 'message',
    label: 'Message',
    subtitle: 'Usually replies within a few hours',
    ion: 'chatbubble-outline',
    accentIndex: 0,
  },
  {
    key: 'profile',
    label: 'View profile',
    subtitle: 'Rates, specialties, credentials',
    ion: 'person-outline',
    accentIndex: 2,
  },
  {
    key: 'notes',
    label: 'Notes and files',
    subtitle: 'Shared between you and your coach',
    ion: 'folder-outline',
    accentIndex: 4,
  },
  {
    key: 'pay',
    label: 'Manage coaching payment',
    subtitle: 'Next charge on the 1st',
    ion: 'card-outline',
    accentIndex: 3,
    paymentOnly: true,
  },
  {
    key: 'review',
    label: 'Write a review',
    subtitle: 'Tell other clients how it went',
    ion: 'star-outline',
    accentIndex: 1,
  },
];

/**
 * Trainer quick-actions sheet (message, profile, notes, payment, review).
 * @param {object} props
 */

function buildTrainerSheetRowElements(rows, themeColors, onClose) {
  const rowElements = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const onPressRow = () => {
      callIfFunction(onClose);
      callIfFunction(row.onPress);
    };
    rowElements.push(
      <TouchableOpacity
        key={row.key}
        onPress={onPressRow}
        style={[styles.sheetRow, { borderColor: themeColors.cardBorder }]}
        accessibilityRole="button"
        accessibilityLabel={row.label}
      >
        <NbIconChip index={row.accentIndex} size={44}>
          <Ionicons name={row.ion} size={20} color={lightColors.nbInk} />
        </NbIconChip>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: themeColors.text }}>
            {row.label}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              color: themeColors.textMuted,
              marginTop: 2,
            }}
          >
            {row.subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={themeColors.textMuted} />
      </TouchableOpacity>,
    );
  }
  return rowElements;
}

/**
 * Bottom sheet displaying trainer information and coaching action shortcuts.
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ClientTrainerSheet({
  visible,
  onClose,
  trainerName,
  trainerInitials,
  trainerSpecialty,
  themeColors,
  onMessage,
  onProfile,
  onNotesFiles,
  onPayment,
  onReview,
  showPayment,
  notesSubtitle,
  paymentSubtitle,
}) {
  // Hook order frozen: handlers memo → rows memo
  const handlers = useMemo(
    () => ({
      message: onMessage,
      profile: onProfile,
      notes: onNotesFiles,
      pay: onPayment,
      review: onReview,
    }),
    [onMessage, onProfile, onNotesFiles, onPayment, onReview],
  );

  const rows = useMemo(() => {
    const visibleRows = [];
    for (let index = 0; index < TRAINER_SHEET_ROWS.length; index += 1) {
      const row = TRAINER_SHEET_ROWS[index];
      if (row.paymentOnly && !showPayment) {
        continue;
      }
      visibleRows.push(row);
    }
    const rowsWithHandlers = [];
    for (let index = 0; index < visibleRows.length; index += 1) {
      const row = visibleRows[index];
      const subtitle = trainerSheetSubtitleForRow(row, notesSubtitle, paymentSubtitle);
      rowsWithHandlers.push({ ...row, subtitle, onPress: handlers[row.key] });
    }
    return rowsWithHandlers;
  }, [handlers, showPayment, notesSubtitle, paymentSubtitle]);

  let specialtyLine = 'Your coach';
  if (trainerSpecialty) {
    specialtyLine = trainerSpecialty;
  }
  let displayName = 'Your trainer';
  if (trainerName) {
    displayName = trainerName;
  }

  return (
    <NbSheet visible={!!visible} onClose={onClose}>
      <View style={{ gap: 6, paddingBottom: 28 }}>
        {/* Header: avatar + name + specialty + Your trainer pill (PNG 11) */}
        <View style={styles.trainerHeadRow}>
          <View
            style={[
              styles.av,
              { backgroundColor: accentGradients[0][0], borderColor: themeColors.cardBorder },
            ]}
          >
            <Text style={{ fontWeight: '900', color: lightColors.nbInk }}>{trainerInitials}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ fontSize: 20, fontWeight: '900', color: themeColors.text }}
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: themeColors.textMuted,
                marginTop: 2,
              }}
            >
              {specialtyLine}
            </Text>
          </View>
          <View
            style={[
              styles.yourTrainerPill,
              { borderColor: themeColors.cardBorder, backgroundColor: themeColors.pillBg },
            ]}
          >
            <Text style={{ fontSize: 11, fontWeight: '900', color: themeColors.text }}>
              Your trainer
            </Text>
          </View>
        </View>

        {buildTrainerSheetRowElements(rows, themeColors, onClose)}
      </View>
    </NbSheet>
  );
}

// Manipulate here: tag list matches Design Law review sheet chips
const REVIEW_TAGS = ['Clear plans', 'Responsive', 'Pushes me', 'Great with injuries', 'On time'];
const STAR_COUNTS = [1, 2, 3, 4, 5];

/**
 * Review sheet UI — Firestore write stays in WriteTrainerReviewPopup.
 * @param {object} props
 */

function buildStarElements(stars, setStars, themeColors) {
  const starsElements = [];
  for (let index = 0; index < STAR_COUNTS.length; index += 1) {
    const starCount = STAR_COUNTS[index];
    let starIsFilled = false;
    if (starCount <= stars) {
      starIsFilled = true;
    }
    let starIcon = 'star-outline';
    let starColor = themeColors.textMuted;
    if (starIsFilled) {
      starIcon = 'star';
      starColor = themeColors.fill;
    }
    starsElements.push(
      <TouchableOpacity key={starCount} onPress={() => setStars(starCount)} hitSlop={6}>
        <Ionicons name={starIcon} size={36} color={starColor} />
      </TouchableOpacity>,
    );
  }
  return starsElements;
}


function buildReviewTagElements(tags, setTags, themeColors) {
  const tagElements = [];
  for (let index = 0; index < REVIEW_TAGS.length; index += 1) {
    const tag = REVIEW_TAGS[index];
    let tagIsOn = false;
    if (tags.includes(tag)) {
      tagIsOn = true;
    }
    let tagBackground = themeColors.pillBg;
    let tagTextColor = themeColors.text;
    if (tagIsOn) {
      tagBackground = themeColors.fill;
      tagTextColor = themeColors.onFill;
    }
    tagElements.push(
      <TouchableOpacity
        key={tag}
        onPress={() => setTags((previousTags) => toggleReviewTag(previousTags, tag, tagIsOn))}
        style={[
          styles.tagChip,
          {
            borderColor: themeColors.cardBorder,
            backgroundColor: tagBackground,
          },
        ]}
      >
        <Text style={{ fontWeight: '800', color: tagTextColor }}>{tag}</Text>
      </TouchableOpacity>,
    );
  }
  return tagElements;
}

/**
 * Bottom sheet allowing clients to submit reviews and star ratings for trainers.
 * @param {object} props
 * @returns {JSX.Element}
 */
export function ClientReviewSheet({
  visible,
  onClose,
  themeColors,
  trainerName,
  trainerInitials,
  onSubmit,
}) {
  // Hook order frozen: stars → tags → body → reset effect
  const [stars, setStars] = useState(REVIEW_DEFAULT_STARS);
  const [tags, setTags] = useState(REVIEW_DEFAULT_TAGS);
  const [body, setBody] = useState('');

  useEffect(() => {
    if (!visible) return;
    setStars(REVIEW_DEFAULT_STARS);
    setTags(REVIEW_DEFAULT_TAGS);
    setBody('');
  }, [visible]);

  const firstName = firstNameFromTrainerName(trainerName);
  const avatarLetters = trainerInitials || firstName.slice(0, 2).toUpperCase();
  const reviewHeading = `Review ${firstName}`;
  let noteBoxBackground = themeColors.pillBg;
  if (themeColors.surface) {
    noteBoxBackground = themeColors.surface;
  }

  const postReview = () => {
    callIfFunction(onSubmit, { stars, tags, body });
    callIfFunction(onClose);
  };

  return (
    <NbSheet visible={!!visible} onClose={onClose}>
      <View style={{ gap: 14, paddingBottom: 28 }}>
        <View style={styles.trainerHeadRow}>
          <View
            style={[
              styles.av,
              { backgroundColor: accentGradients[1][0], borderColor: themeColors.cardBorder },
            ]}
          >
            <Text style={{ fontWeight: '900', color: lightColors.nbInk }}>{avatarLetters}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: themeColors.text }}>
              {reviewHeading}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: themeColors.textMuted,
                marginTop: 2,
              }}
            >
              Visible on their profile.
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {buildStarElements(stars, setStars, themeColors)}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {buildReviewTagElements(tags, setTags, themeColors)}
        </View>

        <HardShadow>
          <TextInput
            style={[
              styles.noteBox,
              {
                minHeight: 100,
                borderColor: themeColors.cardBorder,
                backgroundColor: noteBoxBackground,
                color: themeColors.text,
              },
            ]}
            multiline
            placeholder="Built around my knee from week one, and checks in without nagging."
            placeholderTextColor={themeColors.textMuted}
            value={body}
            onChangeText={setBody}
          />
        </HardShadow>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <NbButton variant="ghost" onPress={onClose} style={{ flex: 1 }}>
            Not now
          </NbButton>
          <NbButton variant="fill" style={{ flex: 1 }} onPress={postReview}>
            Post review
          </NbButton>
        </View>
      </View>
    </NbSheet>
  );
}

export { HANDOFF_CHECKIN, HANDOFF_PROGRESS, HANDOFF_SCHEDULE, HANDOFF_WORKOUT, ozToCups, cupsToOz };

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  vtGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  vtCell: {
    width: '48%',
  },
  vtCellCompact: {
    width: '48%',
  },
  vt: {
    minHeight: 176,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    justifyContent: 'space-between',
  },
  vtCompact: {
    minHeight: 112,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    justifyContent: 'space-between',
  },
  vtTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  vtLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingTop: 4,
  },
  vtValue: { fontSize: 36, fontWeight: '900', letterSpacing: -1.4, marginTop: 14 },
  vtValueCompact: { fontSize: 26, fontWeight: '900', letterSpacing: -1, marginTop: 8 },
  vtUnit: { fontSize: 14, fontWeight: '800' },
  vtFooter: { marginTop: 12, minHeight: 22, justifyContent: 'flex-end' },
  vtHint: { fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 20 },
  nutritionCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
  },
  macroRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macroLabel: { flex: 1, fontSize: 13, fontWeight: '800' },
  macroFrac: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  workoutCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
    gap: 12,
  },
  dayInput: {
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  exBlock: { gap: 8 },
  exHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { flex: 1, fontSize: 17, fontWeight: '900' },
  setsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  setChip: {
    minHeight: 40,
    minWidth: 88,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  setChipInput: { fontSize: 13, fontWeight: '800', paddingVertical: 6 },
  addSet: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    minHeight: 44,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    minHeight: 50,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  notifyPill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    justifyContent: 'center',
  },
  checkCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 14,
  },
  checkHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  checkTitle: { fontSize: 17, fontWeight: '900' },
  donePill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    justifyContent: 'center',
  },
  moodLabel: { fontSize: 15, fontWeight: '800', marginBottom: 8 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodChip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteBox: {
    minHeight: 72,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  goGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  goTile: {
    minHeight: 112,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  goLabel: { fontSize: 15, fontWeight: '900' },
  notesRow: {
    minHeight: 64,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cup: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genericInput: {
    minHeight: 50,
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 18,
    fontWeight: '800',
  },
  trainerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 12,
    marginBottom: 8,
    borderBottomWidth: nb.borderWidthDivider,
  },
  trainerHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  yourTrainerPill: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  av: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRow: {
    // PNG 11 rows carry subtitle — taller than a single-line list row
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: nb.borderWidthDivider,
    paddingVertical: 10,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // empty-vs-data PNG: dashed HardShadow shells for nutrition / workout / check-in
  emptyDashCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    borderStyle: 'dashed',
    padding: 18,
    gap: 10,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', textAlign: 'left', alignSelf: 'stretch' },
  emptyBody: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'left',
    alignSelf: 'stretch',
  },
});
