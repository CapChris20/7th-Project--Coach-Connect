// Design Law workout SESSION MODE — log-set (PNG 09/10) + rest (PNG 11/12).
// Flow: plan day Start session → load/persist active workout → log sets ↔ rest ring → end/complete.
// Used by ClientWorkoutSession route. Visual law: docs/design/Design-Law/screens/workouts/09–12.
// Read order: constants → session math helpers → chrome subcomponents → main screen → styles.
//
// vocab: activeWorkouts = existing Firestore collection (no new collection names)
// Manipulate here: WEIGHT_STEP, DEFAULT_REST_SEC, REST_ADD_SEC, ring size

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb } from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbProgressBar from '../../look-and-feel/NbProgressBar';
import NbIconChip from '../../look-and-feel/NbIconChip';
import {
  startWorkoutFromExercises,
  getActiveWorkout,
  updateActiveWorkout,
  completeWorkout,
  cancelWorkout,
} from '../create-plan/saveAndLoadWorkoutPlan';
import { rootGoBack } from '../../navigation/openScreenFromAnywhere';
import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: steppers / rest — match mockup stepper deltas (±5 lb, ±1 rep, +30 s)
const WEIGHT_STEP = 5;
const REPS_STEP = 1;
const DEFAULT_REST_SEC = 90;
const REST_ADD_SEC = 30;
const SESSION_TICK_MS = 1000;
// vocab: clock math — 1000 ms in a second, 60 seconds in a minute (formatClock / duration)
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

// Manipulate here: rest ring geometry (PNG ~190 viewBox feel)
const REST_RING_SIZE = 190;
const REST_RING_STROKE = 14;

const PHASE_LOG = 'log';
const PHASE_REST = 'rest';

const PROGRESS_GRADIENT = accentGradients[0]; // pink → orange (progress fill only)
const UP_NEXT_GRADIENT = accentGradients[3]; // blue → indigo chip accent

const DUMBBELL_ICON = require('../../assets/icons/handoff/dumbbell.png');

const MIN_WEIGHT = 0;
const MAX_WEIGHT = 999;
const MIN_REPS = 0;
const MAX_REPS = 99;

const DEFAULT_PLANNED_SETS = 3;
const DEFAULT_PLANNED_REPS = 8;
const DEFAULT_WORKOUT_NAME = 'Workout';

// ===== HELPER FUNCTIONS =====

// mm:ss for the session elapsed pill (PNG "24:10").
function formatClock(totalSeconds) {
  const wholeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutesPart = Math.floor(wholeSeconds / SECONDS_PER_MINUTE);
  const secondsPart = wholeSeconds % SECONDS_PER_MINUTE;
  return `${minutesPart}:${String(secondsPart).padStart(2, '0')}`;
}

// Rest center time — same clock helper as the header pill.
function formatRestClock(totalSeconds) {
  return formatClock(totalSeconds);
}

// Planned set count from an exercise row (defaults to 3).
function plannedSets(exercise) {
  let setsRaw = null;
  if (exercise != null) {
    setsRaw = exercise.sets;
  }
  const parsedSets = parseInt(setsRaw, 10);
  if (Number.isFinite(parsedSets) && parsedSets > 0) return parsedSets;
  return DEFAULT_PLANNED_SETS;
}

// Target reps for display / default stepper.
function plannedReps(exercise) {
  let repsRaw = null;
  if (exercise != null) {
    repsRaw = exercise.reps;
  }
  const parsedReps = parseInt(repsRaw, 10);
  if (Number.isFinite(parsedReps) && parsedReps > 0) return parsedReps;
  return DEFAULT_PLANNED_REPS;
}

// Planned weight for steppers / chips (0 when missing).
function plannedWeight(exercise) {
  let weightRaw = null;
  if (exercise != null) {
    weightRaw = exercise.weight;
  }
  const parsedWeight = parseFloat(weightRaw);
  if (Number.isFinite(parsedWeight) && parsedWeight >= 0) return parsedWeight;
  return 0;
}

// Rest seconds for this exercise after a logged set.
function plannedRest(exercise) {
  let restRaw = null;
  if (exercise != null) {
    restRaw = exercise.restSeconds;
  }
  const parsedRest = parseInt(restRaw, 10);
  if (Number.isFinite(parsedRest) && parsedRest > 0) return parsedRest;
  return DEFAULT_REST_SEC;
}

// Sum of planned sets across the session (progress denominator).
function totalPlannedSets(exercises) {
  let plannedSum = 0;
  const exerciseList = exercises || [];
  for (let index = 0; index < exerciseList.length; index += 1) {
    plannedSum += plannedSets(exerciseList[index]);
  }
  return plannedSum;
}

// How many sets are already logged across all exercises.
function totalLoggedSets(completedSets) {
  let loggedSum = 0;
  const completedList = completedSets || [];
  for (let index = 0; index < completedList.length; index += 1) {
    const setsForExercise = completedList[index];
    let setCount = 0;
    if (setsForExercise != null) {
      setCount = setsForExercise.length || 0;
    }
    loggedSum += setCount;
  }
  return loggedSum;
}

// "8 × 135" chip / logged line copy.
function formatSetPair(loggedSet) {
  // vocab/symbol: ?? = use right side only when left is null/undefined (0 reps must survive).
  let repsValue = 0;
  let weightValue = 0;
  if (loggedSet != null) {
    if (loggedSet.reps != null) {
      repsValue = loggedSet.reps;
    }
    if (loggedSet.weight != null) {
      weightValue = loggedSet.weight;
    }
  }
  return `${repsValue} × ${weightValue}`;
}

// Empty completed-sets rows — one [] per exercise (no .map in callers).
function emptyCompletedRowsForExercises(exercises) {
  const emptyRows = [];
  for (let index = 0; index < exercises.length; index += 1) {
    emptyRows.push([]);
  }
  return emptyRows;
}

// Normalize a completedSets row from Firestore (must be an array).
function normalizeCompletedRows(rawCompletedSets, exerciseCount) {
  const normalized = [];
  for (let index = 0; index < exerciseCount; index += 1) {
    const row = rawCompletedSets[index];
    if (Array.isArray(row)) {
      normalized.push(row);
    } else {
      normalized.push([]);
    }
  }
  return normalized;
}

// Build local session seed from route params (works offline / without Firestore).
function seedFromParams(params) {
  let exercises = [];
  let workoutNameRaw = DEFAULT_WORKOUT_NAME;
  if (params != null) {
    if (Array.isArray(params.exercises)) {
      exercises = params.exercises;
    }
    if (params.workoutName) {
      workoutNameRaw = params.workoutName;
    }
  }
  const workoutNameText =
    String(workoutNameRaw || DEFAULT_WORKOUT_NAME).trim() || DEFAULT_WORKOUT_NAME;
  return {
    workoutName: workoutNameText,
    exercises,
    completedSets: emptyCompletedRowsForExercises(exercises),
    currentExerciseIndex: 0,
  };
}

// Hydrate UI seed from an activeWorkouts doc (resume).
function seedFromActive(activeWorkout) {
  let exercises = [];
  let workoutNameRaw = DEFAULT_WORKOUT_NAME;
  let currentExerciseIndexRaw = 0;
  let rawCompletedSets = null;

  if (activeWorkout != null) {
    if (Array.isArray(activeWorkout.exercises)) {
      exercises = activeWorkout.exercises;
    }
    if (Array.isArray(activeWorkout.completedSets)) {
      rawCompletedSets = activeWorkout.completedSets;
    }
    if (activeWorkout.workoutName) {
      workoutNameRaw = activeWorkout.workoutName;
    }
    if (activeWorkout.currentExerciseIndex != null) {
      currentExerciseIndexRaw = activeWorkout.currentExerciseIndex;
    }
  }

  let completedSets;
  if (rawCompletedSets) {
    completedSets = normalizeCompletedRows(rawCompletedSets, exercises.length);
  } else {
    completedSets = emptyCompletedRowsForExercises(exercises);
  }

  const workoutNameText =
    String(workoutNameRaw || DEFAULT_WORKOUT_NAME).trim() || DEFAULT_WORKOUT_NAME;
  const savedExerciseIndex = Math.max(
    0,
    parseInt(currentExerciseIndexRaw, 10) || 0,
  );

  return {
    workoutName: workoutNameText,
    exercises,
    completedSets,
    currentExerciseIndex: savedExerciseIndex,
  };
}

// Find the first incomplete (exerciseIndex, setIndex) pair.
function nextOpenSlot(exercises, completedSets) {
  for (let exerciseIndex = 0; exerciseIndex < exercises.length; exerciseIndex += 1) {
    const setsForExercise = completedSets[exerciseIndex];
    let loggedOnExercise = 0;
    if (setsForExercise != null) {
      loggedOnExercise = setsForExercise.length || 0;
    }
    const setsNeeded = plannedSets(exercises[exerciseIndex]);
    if (loggedOnExercise < setsNeeded) {
      return { exerciseIndex, setIndex: loggedOnExercise };
    }
  }
  return null;
}

// Subtitle under each set chip in the log phase.
function setChipDetailLine({ active, done, loggedSet, exercise }) {
  if (active && !done) return 'now';
  if (done) return formatSetPair(loggedSet);

  const defaultWeight = plannedWeight(exercise);
  const defaultReps = plannedReps(exercise);
  if (defaultWeight > 0) return `${defaultReps} × ${defaultWeight}`;
  return `${defaultReps} reps`;
}

// Rough session volume: sum of weight × reps for every logged set.
function totalVolumeFromCompletedSets(completedSets) {
  let volume = 0;
  for (const setsForExercise of completedSets || []) {
    for (const loggedSet of setsForExercise || []) {
      const setWeight = Number(loggedSet.weight) || 0;
      const setReps = Number(loggedSet.reps) || 0;
      volume += setWeight * setReps;
    }
  }
  return volume;
}

// Append one logged set onto completedSets at exerciseIndex (immutable copy).
function appendLoggedSetAtIndex(completedSets, exerciseIndex, loggedSet) {
  const nextRows = [];
  for (let rowIndex = 0; rowIndex < completedSets.length; rowIndex += 1) {
    const row = completedSets[rowIndex] || [];
    if (rowIndex === exerciseIndex) {
      nextRows.push([...row, loggedSet]);
    } else {
      nextRows.push(row);
    }
  }
  return nextRows;
}

// Target line under the exercise name (“Target 8 reps. Last time …”).
function buildTargetLine(currentExercise, completedSets, exerciseIndex, setIndex) {
  if (!currentExercise) return '';

  const targetReps = plannedReps(currentExercise);
  let previousSet = null;
  const setsForExercise = completedSets[exerciseIndex];
  if (setsForExercise != null && setIndex > 0) {
    previousSet = setsForExercise[setIndex - 1];
  }
  let lastTimeHint = '';

  if (previousSet) {
    lastTimeHint = `Last time ${previousSet.reps} × ${previousSet.weight} lb.`;
  } else if (plannedWeight(currentExercise) > 0) {
    lastTimeHint = `Last time ${plannedReps(currentExercise)} × ${plannedWeight(currentExercise)} lb.`;
  }

  if (lastTimeHint) return `Target ${targetReps} reps. ${lastTimeHint}`;
  return `Target ${targetReps} reps.`;
}

// Header meta: "Exercise 1 of 5 · 4 of 11 sets".
function buildHeaderMeta(exerciseIndex, exerciseCount, loggedCount, plannedTotal) {
  const safeExerciseCount = exerciseCount || 1;
  const exerciseNumber = Math.min(exerciseIndex + 1, safeExerciseCount);
  const exercisePart = `Exercise ${exerciseNumber} of ${safeExerciseCount}`;
  const setPart = `${loggedCount} of ${plannedTotal} sets`;
  return `${exercisePart} · ${setPart}`;
}

// Apply seed into React state only when the boot effect is still mounted.
// Why extract: keeps bootSession try/if nesting at depth ≤2.
function applySeedWhenStillMounted(cancelled, seeded, workoutActiveId, applySeed, setBooting) {
  if (cancelled) return;
  applySeed(seeded, workoutActiveId);
  setBooting(false);
}

// Start a new activeWorkouts row from plan-day exercises.
// Returns true when we should stop boot (started OK, or unmounted mid-flight).
async function tryStartActiveFromPlanDay(userId, localSeed, cancelled, applySeed, setBooting) {
  // 1. Write the new active session (same collection as startWorkout).
  const startResult = await startWorkoutFromExercises(
    userId,
    localSeed.workoutName,
    localSeed.exercises,
  );

  // 2. Screen left while the write was in flight — treat as handled (no local fallback).
  if (cancelled) return true;

  // 3. Hydrate from the new doc when Firestore said success.
  const startSucceeded = !!(startResult.success && startResult.activeWorkout);
  if (!startSucceeded) return false;

  const newActiveId = startResult.id || startResult.activeWorkout.id;
  applySeed(seedFromActive(startResult.activeWorkout), newActiveId);
  setBooting(false);
  return true;
}

// ===== SUBCOMPONENTS =====

/**
 * Square X control — 3px border + hard shadow (PNG header).
 */
function SessionCloseButton({ onPress, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Close session"
        style={[
          styles.sqBtn,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <Ionicons name="close" size={22} color={colors.nbInk} />
      </Pressable>
    </HardShadow>
  );
}

/**
 * Neutral timer pill (session elapsed) — border only, no gradient.
 */
function SessionTimerPill({ label, colors }) {
  return (
    <View
      style={[
        styles.timerPill,
        { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
      ]}
    >
      <Text style={[styles.timerPillText, { color: colors.nbInk }]}>{label}</Text>
    </View>
  );
}

/**
 * Set chip row: done = soft, active = fill, upcoming = surface.
 */
function SetChip({ label, detail, active, done, onPress, colors }) {
  let chipBackground = colors.nbSurface;
  if (active) chipBackground = colors.nbFill;
  if (!active && done) chipBackground = colors.nbSoft;

  const labelColor = active ? colors.nbOnFill : colors.nbInk;
  const detailColor = active ? colors.nbOnFill : colors.nbMuted;

  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
      <Pressable
        onPress={onPress}
        style={[
          styles.setChip,
          {
            backgroundColor: chipBackground,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <Text style={[styles.setChipLabel, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.setChipDetail, { color: detailColor }]} numberOfLines={1}>
          {detail}
        </Text>
      </Pressable>
    </HardShadow>
  );
}

/**
 * WEIGHT / REPS stepper row — 44 touch ± buttons, big tabular number.
 */
function StepperRow({ label, value, onMinus, onPlus, colors, isLast }) {
  const showDivider = !isLast;
  const dividerStyle = showDivider
    ? {
        borderBottomWidth: nb.borderWidthDivider,
        borderBottomColor: colors.nbBorder,
        paddingBottom: 12,
        marginBottom: 12,
      }
    : null;

  return (
    <View style={[styles.stepperRow, dividerStyle]}>
      <Text style={[styles.stepperLabel, { color: colors.nbMuted }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton}>
          <Pressable
            onPress={onMinus}
            accessibilityRole="button"
            accessibilityLabel={`Decrease ${label}`}
            style={[styles.stepBtn, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}
          >
            <Text style={[styles.stepBtnText, { color: colors.nbInk }]}>−</Text>
          </Pressable>
        </HardShadow>
        <Text style={[styles.stepValue, { color: colors.nbInk }]}>{value}</Text>
        <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbButton}>
          <Pressable
            onPress={onPlus}
            accessibilityRole="button"
            accessibilityLabel={`Increase ${label}`}
            style={[styles.stepBtn, { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder }]}
          >
            <Text style={[styles.stepBtnText, { color: colors.nbInk }]}>+</Text>
          </Pressable>
        </HardShadow>
      </View>
    </View>
  );
}

/**
 * Rest countdown ring — solid fill stroke (PNG), not gradient.
 */
function RestRing({ progress, timeLabel, untilLabel, colors }) {
  const ringSize = REST_RING_SIZE;
  const strokeWidth = REST_RING_STROKE;
  const ringRadius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  // vocab: strokeDashoffset = how much of the ring is still "empty"
  const clampedProgress = Math.min(1, Math.max(0, Number(progress) || 0));
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const centerPoint = ringSize / 2;

  return (
    <View style={[styles.restRingWrap, { width: ringSize, height: ringSize }]}>
      <Svg width={ringSize} height={ringSize}>
        <Circle
          cx={centerPoint}
          cy={centerPoint}
          r={ringRadius}
          stroke={colors.nbSoft}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={centerPoint}
          cy={centerPoint}
          r={ringRadius}
          stroke={colors.nbFill}
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="butt"
          fill="none"
          transform={`rotate(-90 ${centerPoint} ${centerPoint})`}
        />
      </Svg>
      <View style={styles.restRingCenter} pointerEvents="none">
        <Text style={[styles.restTime, { color: colors.nbInk }]}>{timeLabel}</Text>
        <Text style={[styles.restUntil, { color: colors.nbMuted }]}>{untilLabel}</Text>
      </View>
    </View>
  );
}

/**
 * Up next card — gradient only on the tiny icon chip.
 */
function UpNextCard({ nextExercise, colors }) {
  if (!nextExercise) return null;

  const setsCount = plannedSets(nextExercise);
  const repsCount = plannedReps(nextExercise);
  const exerciseName = nextExercise.name || 'Next exercise';
  const titleText = `${exerciseName} · ${setsCount} × ${repsCount}`;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.upNextCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <NbIconChip source={DUMBBELL_ICON} colors={UP_NEXT_GRADIENT} size={44} />
        <View style={styles.upNextTextWrap}>
          <Text style={[styles.upNextEyebrow, { color: colors.nbMuted }]}>Up next</Text>
          <Text style={[styles.upNextTitle, { color: colors.nbInk }]} numberOfLines={2}>
            {titleText}
          </Text>
        </View>
      </View>
    </HardShadow>
  );
}

/**
 * Horizontal set chips for the current exercise.
 */
function SetChipRow({
  setCount,
  setIndex,
  completedForExercise,
  currentExercise,
  onSelectSet,
  colors,
}) {
  const chipItems = [];
  for (let chipIndex = 0; chipIndex < setCount; chipIndex += 1) {
    let loggedSet = null;
    if (completedForExercise != null) {
      loggedSet = completedForExercise[chipIndex];
    }
    const chipIsActive = chipIndex === setIndex;
    const chipIsDone = !!loggedSet;
    const chipDetail = setChipDetailLine({
      active: chipIsActive,
      done: chipIsDone,
      loggedSet,
      exercise: currentExercise,
    });
    chipItems.push(
      <SetChip
        key={`set-${chipIndex}`}
        label={`Set ${chipIndex + 1}`}
        detail={chipDetail}
        active={chipIsActive}
        done={chipIsDone && !chipIsActive}
        onPress={() => onSelectSet(chipIndex)}
        colors={colors}
      />,
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {chipItems}
    </ScrollView>
  );
}

/**
 * Log-phase body: eyebrow, name, target, chips, steppers, optional cue.
 */
function LogPhaseBody({
  setIndex,
  setCount,
  currentExercise,
  targetLine,
  completedForExercise,
  onSelectSet,
  weight,
  reps,
  onWeightMinus,
  onWeightPlus,
  onRepsMinus,
  onRepsPlus,
  cueText,
  colors,
}) {
  let exerciseName = 'Exercise';
  if (currentExercise != null && currentExercise.name) {
    exerciseName = currentExercise.name;
  }
  const setEyebrow = `SET ${setIndex + 1} OF ${setCount}`;
  const showCueCard = !!cueText;

  return (
    <View style={styles.blockGap}>
      <View>
        <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>{setEyebrow}</Text>
        <Text style={[styles.exerciseName, { color: colors.nbInk }]}>{exerciseName}</Text>
        <Text style={[styles.targetLine, { color: colors.nbMuted }]}>{targetLine}</Text>
      </View>

      <SetChipRow
        setCount={setCount}
        setIndex={setIndex}
        completedForExercise={completedForExercise}
        currentExercise={currentExercise}
        onSelectSet={onSelectSet}
        colors={colors}
      />

      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.stepperCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <StepperRow
            label="WEIGHT"
            value={weight}
            colors={colors}
            onMinus={onWeightMinus}
            onPlus={onWeightPlus}
          />
          <StepperRow
            label="REPS"
            value={reps}
            colors={colors}
            isLast
            onMinus={onRepsMinus}
            onPlus={onRepsPlus}
          />
        </View>
      </HardShadow>

      {showCueCard ? (
        <View
          style={[
            styles.cueCard,
            { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[styles.cueLabel, { color: colors.nbMuted }]}>CUE</Text>
          <Text style={[styles.cueBody, { color: colors.nbInk }]}>{cueText}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Rest-phase body: ring, +30 / End, status card.
 */
function RestPhaseBody({
  restProgress,
  restSec,
  untilLabel,
  lastLogged,
  setIndex,
  currentExerciseName,
  nextRepsTarget,
  onAddRest,
  onEndWorkout,
  colors,
}) {
  const loggedStatusTitle = lastLogged
    ? `Set ${lastLogged.setNumber} logged: ${lastLogged.reps} × ${lastLogged.weight} lb`
    : 'Set logged';
  const nextExerciseLabel = (currentExerciseName || 'exercise').toLowerCase();
  const nextStatusTitle = `Next: set ${setIndex + 1}, ${nextExerciseLabel}`;
  const nextStatusSub = `Same weight, aim for ${nextRepsTarget} clean reps`;
  const addRestLabel = `+${REST_ADD_SEC} s`;

  return (
    <View style={styles.blockGap}>
      <Text style={[styles.restEyebrow, { color: colors.nbMuted }]}>REST</Text>
      <View style={styles.restRingOuter}>
        <RestRing
          progress={restProgress}
          timeLabel={formatRestClock(restSec)}
          untilLabel={untilLabel}
          colors={colors}
        />
      </View>

      <View style={styles.restActions}>
        <View style={styles.restActionSlot}>
          <NbButton variant="ghost" onPress={onAddRest}>
            {addRestLabel}
          </NbButton>
        </View>
        <View style={styles.restActionSlot}>
          <NbButton variant="ghost" onPress={onEndWorkout}>
            End workout
          </NbButton>
        </View>
      </View>

      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.statusCard,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <View style={styles.statusRow}>
            <View style={[styles.statusDotFill, { backgroundColor: colors.nbFill }]}>
              <Ionicons name="checkmark" size={14} color={colors.nbOnFill} />
            </View>
            <Text style={[styles.statusTitle, { color: colors.nbInk }]}>
              {loggedStatusTitle}
            </Text>
          </View>
          <View style={[styles.statusRow, styles.statusRowSpaced]}>
            <View style={[styles.statusDotDash, { borderColor: colors.nbBorder }]} />
            <View style={styles.statusTextWrap}>
              <Text style={[styles.statusTitle, { color: colors.nbInk }]}>
                {nextStatusTitle}
              </Text>
              <Text style={[styles.statusSub, { color: colors.nbMuted }]}>
                {nextStatusSub}
              </Text>
            </View>
          </View>
        </View>
      </HardShadow>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen Design Law session. Route params:
 *   workoutName, exercises[], userId?, onClose?
 * @param {{ navigation?: object, route?: object, onClose?: Function }} props
 */
export default function WorkoutSessionScreen({ navigation, route: routeProp, onClose }) {
  // Hook order frozen — do not reorder.
  const theme = useTheme();
  const { colors } = theme;
  const hookRoute = useRoute();
  // vocab: useRoute = React Navigation hook; prop route wins when embedded without a stack entry
  const route = routeProp || hookRoute;
  let params = {};
  if (route != null && route.params) {
    params = route.params;
  }

  let signedInUid = null;
  if (auth.currentUser != null) {
    signedInUid = auth.currentUser.uid;
  }
  const userId = params.userId || signedInUid || null;

  const [booting, setBooting] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [workoutName, setWorkoutName] = useState(DEFAULT_WORKOUT_NAME);
  const [exercises, setExercises] = useState([]);
  const [completedSets, setCompletedSets] = useState([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [phase, setPhase] = useState(PHASE_LOG);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(DEFAULT_PLANNED_REPS);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [restSec, setRestSec] = useState(DEFAULT_REST_SEC);
  const [restTotal, setRestTotal] = useState(DEFAULT_REST_SEC);
  // Last logged set copy for the rest summary card
  const [lastLogged, setLastLogged] = useState(null);

  const startedAtRef = useRef(Date.now());
  const endingRef = useRef(false);

  const currentExercise = exercises[exerciseIndex] || null;
  const nextExercise = exercises[exerciseIndex + 1] || null;
  const setCount = currentExercise ? plannedSets(currentExercise) : 0;
  const loggedCount = totalLoggedSets(completedSets);
  const plannedTotal = Math.max(1, totalPlannedSets(exercises));
  const progress = Math.min(1, loggedCount / plannedTotal);

  const headerMeta = useMemo(
    () => buildHeaderMeta(exerciseIndex, exercises.length, loggedCount, plannedTotal),
    [exerciseIndex, exercises.length, loggedCount, plannedTotal],
  );

  /**
   * Seed steppers from the exercise (and last logged set if any).
   */
  const syncSteppersForSlot = useCallback((exercise, completedForExercise) => {
    if (!exercise) return;

    let lastLoggedOnExercise = null;
    if (completedForExercise != null && completedForExercise.length > 0) {
      lastLoggedOnExercise = completedForExercise[completedForExercise.length - 1];
    }

    let nextWeight = plannedWeight(exercise);
    let nextReps = plannedReps(exercise);
    if (lastLoggedOnExercise != null) {
      if (lastLoggedOnExercise.weight != null) {
        nextWeight = lastLoggedOnExercise.weight;
      }
      if (lastLoggedOnExercise.reps != null) {
        nextReps = lastLoggedOnExercise.reps;
      }
    }
    setWeight(nextWeight);
    setReps(nextReps);
  }, []);

  /**
   * Persist completedSets + currentExerciseIndex when we have an activeWorkouts id.
   */
  const persistProgress = useCallback(
    async (nextCompleted, nextExerciseIndex) => {
      if (!activeId) return;
      try {
        await updateActiveWorkout(activeId, {
          completedSets: nextCompleted,
          currentExerciseIndex: nextExerciseIndex,
        });
      } catch (persistError) {
        console.warn('Session persist failed:', persistError);
      }
    },
    [activeId],
  );

  /**
   * Apply a seed object into React state and jump to the next open set.
   * @param {{ workoutName: string, exercises: Array, completedSets: Array<Array>, currentExerciseIndex?: number }} seeded
   * @param {string|null} [workoutActiveId]
   */
  const applySeed = useCallback(
    (seeded, workoutActiveId = null) => {
      setActiveId(workoutActiveId);
      setWorkoutName(seeded.workoutName);
      setExercises(seeded.exercises);
      setCompletedSets(seeded.completedSets);

      const openSlot = nextOpenSlot(seeded.exercises, seeded.completedSets);
      let exerciseIndexToOpen = 0;
      if (seeded.currentExerciseIndex != null) {
        exerciseIndexToOpen = seeded.currentExerciseIndex;
      }
      let setIndexToOpen = 0;
      if (openSlot != null) {
        if (openSlot.exerciseIndex != null) {
          exerciseIndexToOpen = openSlot.exerciseIndex;
        }
        if (openSlot.setIndex != null) {
          setIndexToOpen = openSlot.setIndex;
        }
      }

      setExerciseIndex(exerciseIndexToOpen);
      setSetIndex(setIndexToOpen);
      syncSteppersForSlot(
        seeded.exercises[exerciseIndexToOpen],
        seeded.completedSets[exerciseIndexToOpen],
      );
    },
    [syncSteppersForSlot],
  );

  // Boot: resume activeWorkouts when present; else start from plan-day exercises; else local-only.
  useEffect(() => {
    let cancelled = false;

    async function bootSession() {
      // 1. Local seed from route params (always available for offline / empty auth).
      const localSeed = seedFromParams(params);

      // 2. No auth → chrome still works from route params (dev / offline).
      if (!userId) {
        applySeedWhenStillMounted(cancelled, localSeed, null, applySeed, setBooting);
        return;
      }

      try {
        // 3. Load any leftover activeWorkouts row for this user.
        const existing = await getActiveWorkout(userId);
        const launchingFromPlan = localSeed.exercises.length > 0;
        let existingExerciseCount = 0;
        let existingWorkoutId = null;
        if (existing && Array.isArray(existing.exercises)) {
          existingExerciseCount = existing.exercises.length;
        }
        if (existing && existing.id) {
          existingWorkoutId = existing.id;
        }
        const hasExistingExercises = existingExerciseCount > 0;
        const shouldResumeExisting = hasExistingExercises && !launchingFromPlan;
        const shouldReplaceExisting = !!existingWorkoutId && launchingFromPlan;

        // 4. Resume only when re-opening session with no fresh plan-day payload.
        if (shouldResumeExisting) {
          applySeedWhenStillMounted(
            cancelled,
            seedFromActive(existing),
            existing.id,
            applySeed,
            setBooting,
          );
          return;
        }

        // 5. Starting a plan day replaces any leftover active row (one active at a time).
        if (shouldReplaceExisting) {
          await cancelWorkout(existing.id);
        }

        // 6. Persist a new active session from the plan day when we have exercises.
        let startedFromPlan = false;
        if (launchingFromPlan) {
          startedFromPlan = await tryStartActiveFromPlanDay(
            userId,
            localSeed,
            cancelled,
            applySeed,
            setBooting,
          );
        }
        if (startedFromPlan) return;

        // 7. Local-only fallback when Firestore write fails or params are empty.
        if (!cancelled) applySeed(localSeed, null);
      } catch (bootError) {
        console.warn('Session boot failed, using local seed:', bootError);
        if (!cancelled) applySeed(localSeed, null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    bootSession();
    return () => {
      cancelled = true;
    };
    // Mount-only boot from initial route params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session elapsed timer (header pill).
  useEffect(() => {
    const intervalId = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / MS_PER_SECOND));
    }, SESSION_TICK_MS);
    return () => clearInterval(intervalId);
  }, []);

  // Rest countdown → auto-return to log when it hits 0.
  useEffect(() => {
    if (phase !== PHASE_REST) return undefined;
    if (restSec <= 0) {
      setPhase(PHASE_LOG);
      return undefined;
    }
    const intervalId = setInterval(() => {
      setRestSec((secondsLeft) => {
        if (secondsLeft <= 1) {
          setPhase(PHASE_LOG);
          return 0;
        }
        return secondsLeft - 1;
      });
    }, SESSION_TICK_MS);
    return () => clearInterval(intervalId);
  }, [phase, restSec]);

  const leaveScreen = useCallback(() => {
    // 1. Prefer explicit onClose prop, then route param, then nav stack, then root.
    if (typeof onClose === 'function') {
      onClose();
      return;
    }
    if (typeof params.onClose === 'function') {
      params.onClose();
      return;
    }
    let canGoBackOnNav = false;
    if (navigation != null && typeof navigation.canGoBack === 'function') {
      canGoBackOnNav = navigation.canGoBack();
    }
    if (canGoBackOnNav) {
      navigation.goBack();
      return;
    }
    rootGoBack();
  }, [navigation, onClose, params]);

  const finishAndLeave = useCallback(
    async ({ saveHistory }) => {
      // 1. Guard against double-tap while Firestore write is in flight.
      if (endingRef.current) return;
      endingRef.current = true;

      // 2. Duration from session start (same clock as the header pill).
      const durationSeconds = Math.floor((Date.now() - startedAtRef.current) / MS_PER_SECOND);

      try {
        // 3. Persist complete or cancel when we have an activeWorkouts id.
        if (activeId && saveHistory) {
          const volume = totalVolumeFromCompletedSets(completedSets);
          await completeWorkout(activeId, durationSeconds, volume);
        }
        if (activeId && !saveHistory) {
          await cancelWorkout(activeId);
        }
      } catch (endError) {
        console.warn('End session persist failed:', endError);
      } finally {
        // 4. Always leave the screen after the attempt.
        leaveScreen();
      }
    },
    [activeId, completedSets, leaveScreen],
  );

  const confirmEnd = useCallback(
    ({ saveHistory }) => {
      // 1. Pick copy from whether we are saving history or abandoning.
      let alertTitle = 'End workout?';
      let alertMessage = 'Leave without saving this session to history.';
      let confirmLabel = 'End workout';
      let confirmStyle = 'destructive';
      if (saveHistory) {
        alertTitle = 'Finish workout?';
        alertMessage = 'Save this session to your history and leave.';
        confirmLabel = 'Finish';
        confirmStyle = 'default';
      }

      // 2. Native confirm — Keep going cancels; confirm runs finishAndLeave.
      Alert.alert(alertTitle, alertMessage, [
        { text: 'Keep going', style: 'cancel' },
        {
          text: confirmLabel,
          style: confirmStyle,
          onPress: () => finishAndLeave({ saveHistory }),
        },
      ]);
    },
    [finishAndLeave],
  );

  const handleClose = useCallback(() => {
    // 1. X button always ends without saving history (after confirm).
    confirmEnd({ saveHistory: false });
  }, [confirmEnd]);

  /**
   * Log the current set → rest (or complete when no sets left).
   */
  const handleLogSet = useCallback(async () => {
    // 1. Only log while on the log phase with a current exercise.
    if (!currentExercise || phase !== PHASE_LOG) return;

    // 2. Build the logged set row (field letters frozen: reps / weight / loggedAt).
    const loggedSet = {
      reps,
      weight,
      loggedAt: Date.now(),
    };

    // 3. Append onto completedSets and remember copy for the rest summary card.
    const nextCompleted = appendLoggedSetAtIndex(completedSets, exerciseIndex, loggedSet);
    setCompletedSets(nextCompleted);
    setLastLogged({
      setNumber: setIndex + 1,
      reps,
      weight,
      exerciseName: currentExercise.name,
    });

    // 4. Persist progress and find the next open slot.
    const slotAfter = nextOpenSlot(exercises, nextCompleted);
    let exerciseIndexToPersist = exerciseIndex;
    if (slotAfter != null && slotAfter.exerciseIndex != null) {
      exerciseIndexToPersist = slotAfter.exerciseIndex;
    }
    await persistProgress(nextCompleted, exerciseIndexToPersist);

    // 5. All sets done → offer save / discard.
    if (!slotAfter) {
      Alert.alert('Workout complete', 'Nice work — save this session?', [
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => finishAndLeave({ saveHistory: false }),
        },
        {
          text: 'Save',
          onPress: () => finishAndLeave({ saveHistory: true }),
        },
      ]);
      return;
    }

    // 6. Advance indices for the upcoming log after rest, then enter rest phase.
    setExerciseIndex(slotAfter.exerciseIndex);
    setSetIndex(slotAfter.setIndex);
    syncSteppersForSlot(
      exercises[slotAfter.exerciseIndex],
      nextCompleted[slotAfter.exerciseIndex],
    );

    const restForExercise = plannedRest(currentExercise);
    setRestTotal(restForExercise);
    setRestSec(restForExercise);
    setPhase(PHASE_REST);
  }, [
    currentExercise,
    phase,
    reps,
    weight,
    completedSets,
    exerciseIndex,
    setIndex,
    exercises,
    persistProgress,
    finishAndLeave,
    syncSteppersForSlot,
  ]);

  const handleSkipRest = useCallback(() => {
    // 1. Jump straight back to log phase.
    setRestSec(0);
    setPhase(PHASE_LOG);
  }, []);

  const handleAddRest = useCallback(() => {
    // 1. Add REST_ADD_SEC to both remaining and total (ring progress stays honest).
    setRestSec((secondsLeft) => secondsLeft + REST_ADD_SEC);
    setRestTotal((restDuration) => restDuration + REST_ADD_SEC);
  }, []);

  const selectSetChip = useCallback(
    (chipIndex) => {
      // 1. Only allow jumping to the current open set during log phase.
      if (phase !== PHASE_LOG) return;
      let doneCount = 0;
      const setsForCurrentExercise = completedSets[exerciseIndex];
      if (setsForCurrentExercise != null) {
        doneCount = setsForCurrentExercise.length || 0;
      }
      if (chipIndex !== doneCount) return;

      setSetIndex(chipIndex);
      syncSteppersForSlot(currentExercise, completedSets[exerciseIndex]);
    },
    [phase, completedSets, exerciseIndex, currentExercise, syncSteppersForSlot],
  );

  let cueOrNotes = '';
  if (currentExercise != null) {
    cueOrNotes = currentExercise.cue || currentExercise.notes || '';
  }
  const cueText = String(cueOrNotes).trim();
  const targetLine = useMemo(
    () => buildTargetLine(currentExercise, completedSets, exerciseIndex, setIndex),
    [currentExercise, completedSets, exerciseIndex, setIndex],
  );

  const untilLabel = `UNTIL SET ${setIndex + 1}`;
  const restProgress = restTotal > 0 ? 1 - restSec / restTotal : 0;
  const isLogPhase = phase === PHASE_LOG;
  const completedForExercise = completedSets[exerciseIndex];
  let currentExerciseName = null;
  const exerciseAtIndex = exercises[exerciseIndex];
  if (exerciseAtIndex != null) {
    currentExerciseName = exerciseAtIndex.name;
  }
  const nextRepsTarget = plannedReps(exercises[exerciseIndex]);
  const elapsedClockLabel = formatClock(elapsedSec);
  const safeAreaStyle = [styles.safe, { backgroundColor: colors.nbBackground }];

  const decreaseWeight = () =>
    setWeight((previousWeight) => Math.max(MIN_WEIGHT, previousWeight - WEIGHT_STEP));
  const increaseWeight = () =>
    setWeight((previousWeight) => Math.min(MAX_WEIGHT, previousWeight + WEIGHT_STEP));
  const decreaseReps = () =>
    setReps((previousReps) => Math.max(MIN_REPS, previousReps - REPS_STEP));
  const increaseReps = () =>
    setReps((previousReps) => Math.min(MAX_REPS, previousReps + REPS_STEP));
  const endWithoutSaving = () => confirmEnd({ saveHistory: false });

  if (booting) {
    return (
      <SafeAreaView style={safeAreaStyle} edges={['top', 'bottom']}>
        <View style={styles.boot}>
          <Text style={{ color: colors.nbMuted }}>Starting session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!exercises.length) {
    return (
      <SafeAreaView style={safeAreaStyle} edges={['top', 'bottom']}>
        <View style={styles.boot}>
          <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>No exercises</Text>
          <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
            This day has nothing to log. Go back to the plan and pick a training day.
          </Text>
          <NbButton variant="fill" onPress={leaveScreen}>
            Back to plan
          </NbButton>
        </View>
      </SafeAreaView>
    );
  }

  const phaseBody = isLogPhase ? (
    <LogPhaseBody
      setIndex={setIndex}
      setCount={setCount}
      currentExercise={currentExercise}
      targetLine={targetLine}
      completedForExercise={completedForExercise}
      onSelectSet={selectSetChip}
      weight={weight}
      reps={reps}
      onWeightMinus={decreaseWeight}
      onWeightPlus={increaseWeight}
      onRepsMinus={decreaseReps}
      onRepsPlus={increaseReps}
      cueText={cueText}
      colors={colors}
    />
  ) : (
    <RestPhaseBody
      restProgress={restProgress}
      restSec={restSec}
      untilLabel={untilLabel}
      lastLogged={lastLogged}
      setIndex={setIndex}
      currentExerciseName={currentExerciseName}
      nextRepsTarget={nextRepsTarget}
      onAddRest={handleAddRest}
      onEndWorkout={endWithoutSaving}
      colors={colors}
    />
  );

  const footerButton = isLogPhase ? (
    <NbButton variant="fill" onPress={handleLogSet}>
      Log set
    </NbButton>
  ) : (
    <NbButton variant="fill" onPress={handleSkipRest}>
      Skip rest
    </NbButton>
  );

  return (
    <SafeAreaView style={safeAreaStyle} edges={['top', 'bottom']}>
      {/* Header: X · title/meta · timer pill · gradient progress */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <SessionCloseButton onPress={handleClose} colors={colors} />
          <View style={styles.headerTitles}>
            <Text style={[styles.headerTitle, { color: colors.nbInk }]} numberOfLines={1}>
              {workoutName}
            </Text>
            <Text style={[styles.headerMeta, { color: colors.nbMuted }]} numberOfLines={1}>
              {headerMeta}
            </Text>
          </View>
          <SessionTimerPill label={elapsedClockLabel} colors={colors} />
        </View>
        <NbProgressBar progress={progress} colors={PROGRESS_GRADIENT} style={styles.progressBar} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {phaseBody}
        <UpNextCard nextExercise={nextExercise} colors={colors} />
      </ScrollView>

      {/* Sticky footer CTA */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.nbBackground, borderTopColor: colors.nbBorder },
        ]}
      >
        {footerButton}
      </View>
    </SafeAreaView>
  );
}

// ===== PLUMBING — StyleSheet only =====

const styles = StyleSheet.create({
  safe: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: nb.screenGutter,
  },
  emptyTitle: {
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyBody: {
    marginBottom: 16,
    textAlign: 'center',
  },
  header: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitles: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerMeta: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  progressBar: {
    marginTop: 12,
  },
  sqBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    minHeight: 28,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPillText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: 16,
    paddingBottom: 24,
    gap: nb.blockGap,
  },
  blockGap: {
    gap: nb.blockGap,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  exerciseName: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  targetLine: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 21,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
    paddingRight: 8,
  },
  setChip: {
    minWidth: 96,
    minHeight: nb.minTouchTarget,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  setChipLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  setChipDetail: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  stepperCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: nb.cardPadding,
  },
  stepperRow: {
    gap: 10,
  },
  stepperLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  stepValue: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    minWidth: 72,
    textAlign: 'center',
  },
  cueCard: {
    borderWidth: nb.borderWidth,
    // Manipulate here: cue corner accent (soft card, not hard-shadowed)
    borderRadius: 2,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderBottomLeftRadius: 14,
    padding: 12,
  },
  cueLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cueBody: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: nb.cardPadding,
  },
  upNextTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  upNextEyebrow: {
    fontSize: 13,
    fontWeight: '600',
  },
  upNextTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  restEyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  restRingOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  restRingWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  restRingCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restTime: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  restUntil: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  restActions: {
    flexDirection: 'row',
    gap: 10,
  },
  restActionSlot: {
    flex: 1,
  },
  statusCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: nb.cardPadding,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusRowSpaced: {
    marginTop: 14,
  },
  statusTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  statusDotFill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  statusDotDash: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: nb.borderWidth,
    borderStyle: 'dashed',
    marginTop: 1,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  statusSub: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: nb.screenGutter,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: nb.borderWidth,
  },
});
