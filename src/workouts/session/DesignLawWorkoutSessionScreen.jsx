// Design Law workout SESSION MODE — log-set (PNG 09/10) + rest (PNG 11/12).
// Flow: plan day Start session → load/persist active workout → log sets ↔ rest ring → end/complete.
// Used by ClientWorkoutSession route. Visual law: docs/design/Design-Law/screens/workouts/09–12.
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

// ===== HELPER FUNCTIONS =====

/**
 * mm:ss for the session elapsed pill (PNG "24:10").
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatClock(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Rest center time — same clock, no leading zero minutes padding beyond single digit.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatRestClock(totalSeconds) {
  return formatClock(totalSeconds);
}

/**
 * Planned set count from an exercise row (defaults to 3).
 * @param {object} ex
 * @returns {number}
 */
function plannedSets(ex) {
  const n = parseInt(ex?.sets, 10);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/**
 * Target reps for display / default stepper.
 * @param {object} ex
 * @returns {number}
 */
function plannedReps(ex) {
  const n = parseInt(ex?.reps, 10);
  return Number.isFinite(n) && n > 0 ? n : 8;
}

/**
 * @param {object} ex
 * @returns {number}
 */
function plannedWeight(ex) {
  const n = parseFloat(ex?.weight);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * @param {object} ex
 * @returns {number}
 */
function plannedRest(ex) {
  const n = parseInt(ex?.restSeconds, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REST_SEC;
}

/**
 * Sum of planned sets across the session (progress denominator).
 * @param {Array} exercises
 * @returns {number}
 */
function totalPlannedSets(exercises) {
  return (exercises || []).reduce((sum, ex) => sum + plannedSets(ex), 0);
}

/**
 * How many sets are already logged across all exercises.
 * @param {Array<Array>} completedSets
 * @returns {number}
 */
function totalLoggedSets(completedSets) {
  return (completedSets || []).reduce((sum, row) => sum + (row?.length || 0), 0);
}

/**
 * "8 × 135" chip / logged line copy.
 * @param {{ reps?: number, weight?: number }} set
 * @returns {string}
 */
function formatSetPair(set) {
  const reps = set?.reps ?? 0;
  const weight = set?.weight ?? 0;
  return `${reps} × ${weight}`;
}

/**
 * Build local session seed from route params (works offline / without Firestore).
 * @param {{ workoutName?: string, exercises?: Array }} params
 * @returns {{ workoutName: string, exercises: Array, completedSets: Array<Array>, currentExerciseIndex: number }}
 */
function seedFromParams(params) {
  const exercises = Array.isArray(params?.exercises) ? params.exercises : [];
  return {
    workoutName: String(params?.workoutName || 'Workout').trim() || 'Workout',
    exercises,
    completedSets: exercises.map(() => []),
    currentExerciseIndex: 0,
  };
}

/**
 * Hydrate UI seed from an activeWorkouts doc (resume).
 * @param {object} active
 * @returns {object}
 */
function seedFromActive(active) {
  const exercises = Array.isArray(active?.exercises) ? active.exercises : [];
  const completedSets = Array.isArray(active?.completedSets)
    ? active.completedSets.map((row) => (Array.isArray(row) ? row : []))
    : exercises.map(() => []);
  return {
    workoutName: String(active?.workoutName || 'Workout').trim() || 'Workout',
    exercises,
    completedSets,
    currentExerciseIndex: Math.max(0, parseInt(active?.currentExerciseIndex, 10) || 0),
  };
}

/**
 * Find the first incomplete (exerciseIndex, setIndex) pair.
 * @param {Array} exercises
 * @param {Array<Array>} completedSets
 * @returns {{ exerciseIndex: number, setIndex: number }|null}
 */
function nextOpenSlot(exercises, completedSets) {
  for (let ei = 0; ei < exercises.length; ei += 1) {
    const done = completedSets[ei]?.length || 0;
    const need = plannedSets(exercises[ei]);
    if (done < need) return { exerciseIndex: ei, setIndex: done };
  }
  return null;
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
  const bg = active ? colors.nbFill : done ? colors.nbSoft : colors.nbSurface;
  const fg = active ? colors.nbOnFill : colors.nbInk;
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
      <Pressable
        onPress={onPress}
        style={[
          styles.setChip,
          {
            backgroundColor: bg,
            borderColor: colors.nbBorder,
          },
        ]}
      >
        <Text style={[styles.setChipLabel, { color: fg }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.setChipDetail, { color: active ? colors.nbOnFill : colors.nbMuted }]} numberOfLines={1}>
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
  return (
    <View
      style={[
        styles.stepperRow,
        !isLast && {
          borderBottomWidth: nb.borderWidthDivider,
          borderBottomColor: colors.nbBorder,
          paddingBottom: 12,
          marginBottom: 12,
        },
      ]}
    >
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
 * Rest countdown ring — solid fill stroke (PNG), not gradient (gradient reserved for progress / chip).
 */
function RestRing({ progress, timeLabel, untilLabel, colors }) {
  const size = REST_RING_SIZE;
  const stroke = REST_RING_STROKE;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // vocab: strokeDashoffset = how much of the ring is still "empty"
  const clamped = Math.min(1, Math.max(0, Number(progress) || 0));
  const strokeDashoffset = circumference * (1 - clamped);

  return (
    <View style={[styles.restRingWrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.nbSoft}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.nbFill}
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="butt"
          fill="none"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
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
  const sets = plannedSets(nextExercise);
  const reps = plannedReps(nextExercise);
  const name = nextExercise.name || 'Next exercise';

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.upNextCard,
          { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
        ]}
      >
        <NbIconChip source={DUMBBELL_ICON} colors={UP_NEXT_GRADIENT} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.upNextEyebrow, { color: colors.nbMuted }]}>Up next</Text>
          <Text style={[styles.upNextTitle, { color: colors.nbInk }]} numberOfLines={2}>
            {name} · {sets} × {reps}
          </Text>
        </View>
      </View>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen Design Law session. Route params:
 *   workoutName, exercises[], userId?, onClose?
 * @param {{ navigation?: object, route?: object, onClose?: Function }} props
 */
export default function DesignLawWorkoutSessionScreen({ navigation, route: routeProp, onClose }) {
  const theme = useTheme();
  const { colors } = theme;
  const hookRoute = useRoute();
  // vocab: useRoute = React Navigation hook; prop route wins when embedded without a stack entry
  const route = routeProp || hookRoute;
  const params = route?.params || {};

  const userId = params.userId || auth.currentUser?.uid || null;

  const [booting, setBooting] = useState(true);
  const [activeId, setActiveId] = useState(null);
  const [workoutName, setWorkoutName] = useState('Workout');
  const [exercises, setExercises] = useState([]);
  const [completedSets, setCompletedSets] = useState([]);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(0);
  const [phase, setPhase] = useState(PHASE_LOG);
  const [weight, setWeight] = useState(0);
  const [reps, setReps] = useState(8);
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

  // Header meta: "Exercise 1 of 5 · 4 of 11 sets"
  const headerMeta = useMemo(() => {
    const exPart = `Exercise ${Math.min(exerciseIndex + 1, exercises.length || 1)} of ${exercises.length || 1}`;
    const setPart = `${loggedCount} of ${plannedTotal} sets`;
    return `${exPart} · ${setPart}`;
  }, [exerciseIndex, exercises.length, loggedCount, plannedTotal]);

  /**
   * Seed steppers from the exercise (and last logged set if any).
   */
  const syncSteppersForSlot = useCallback((ex, completedForEx) => {
    if (!ex) return;
    const last = completedForEx?.length
      ? completedForEx[completedForEx.length - 1]
      : null;
    setWeight(last?.weight ?? plannedWeight(ex));
    setReps(last?.reps ?? plannedReps(ex));
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
      } catch (err) {
        console.warn('Session persist failed:', err);
      }
    },
    [activeId],
  );

  /**
   * Apply a seed object into React state and jump to the next open set.
   * @param {{ workoutName: string, exercises: Array, completedSets: Array<Array>, currentExerciseIndex?: number }} seeded
   * @param {string|null} [id]
   */
  const applySeed = useCallback(
    (seeded, id = null) => {
      setActiveId(id);
      setWorkoutName(seeded.workoutName);
      setExercises(seeded.exercises);
      setCompletedSets(seeded.completedSets);
      const slot = nextOpenSlot(seeded.exercises, seeded.completedSets);
      const ei = slot?.exerciseIndex ?? seeded.currentExerciseIndex ?? 0;
      const si = slot?.setIndex ?? 0;
      setExerciseIndex(ei);
      setSetIndex(si);
      syncSteppersForSlot(seeded.exercises[ei], seeded.completedSets[ei]);
    },
    [syncSteppersForSlot],
  );

  // Boot: resume activeWorkouts when present; else start from plan-day exercises; else local-only.
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const localSeed = seedFromParams(params);

      // No auth → chrome still works from route params (dev / offline).
      if (!userId) {
        if (!cancelled) {
          applySeed(localSeed, null);
          setBooting(false);
        }
        return;
      }

      try {
        const existing = await getActiveWorkout(userId);
        const launchingFromPlan = localSeed.exercises.length > 0;

        // 1. Resume only when re-opening session with no fresh plan-day payload.
        if (existing?.exercises?.length && !launchingFromPlan) {
          if (cancelled) return;
          applySeed(seedFromActive(existing), existing.id);
          setBooting(false);
          return;
        }

        // 2. Starting a plan day replaces any leftover active row (one active at a time).
        if (existing?.id && launchingFromPlan) {
          await cancelWorkout(existing.id);
        }

        // 3. Persist a new active session from the plan day (same collection as startWorkout).
        if (launchingFromPlan) {
          const result = await startWorkoutFromExercises(
            userId,
            localSeed.workoutName,
            localSeed.exercises,
          );
          if (cancelled) return;
          if (result.success && result.activeWorkout) {
            applySeed(seedFromActive(result.activeWorkout), result.id || result.activeWorkout.id);
            setBooting(false);
            return;
          }
        }

        // 4. Local-only fallback when Firestore write fails or params are empty.
        if (!cancelled) applySeed(localSeed, null);
      } catch (err) {
        console.warn('Session boot failed, using local seed:', err);
        if (!cancelled) applySeed(localSeed, null);
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    boot();
    return () => {
      cancelled = true;
    };
    // Mount-only boot from initial route params
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Session elapsed timer (header pill).
  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, SESSION_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Rest countdown → auto-return to log when it hits 0.
  useEffect(() => {
    if (phase !== PHASE_REST) return undefined;
    if (restSec <= 0) {
      setPhase(PHASE_LOG);
      return undefined;
    }
    const id = setInterval(() => {
      setRestSec((prev) => {
        if (prev <= 1) {
          setPhase(PHASE_LOG);
          return 0;
        }
        return prev - 1;
      });
    }, SESSION_TICK_MS);
    return () => clearInterval(id);
  }, [phase, restSec]);

  const leaveScreen = useCallback(() => {
    if (typeof onClose === 'function') {
      onClose();
      return;
    }
    if (typeof params.onClose === 'function') {
      params.onClose();
      return;
    }
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }
    rootGoBack();
  }, [navigation, onClose, params]);

  const finishAndLeave = useCallback(
    async ({ saveHistory }) => {
      if (endingRef.current) return;
      endingRef.current = true;
      const duration = Math.floor((Date.now() - startedAtRef.current) / 1000);
      try {
        if (activeId) {
          if (saveHistory) {
            // Rough volume: sum weight × reps for every logged set
            let volume = 0;
            completedSets.forEach((row) => {
              (row || []).forEach((s) => {
                volume += (Number(s.weight) || 0) * (Number(s.reps) || 0);
              });
            });
            await completeWorkout(activeId, duration, volume);
          } else {
            await cancelWorkout(activeId);
          }
        }
      } catch (err) {
        console.warn('End session persist failed:', err);
      } finally {
        leaveScreen();
      }
    },
    [activeId, completedSets, leaveScreen],
  );

  const confirmEnd = useCallback(
    ({ saveHistory }) => {
      Alert.alert(
        saveHistory ? 'Finish workout?' : 'End workout?',
        saveHistory
          ? 'Save this session to your history and leave.'
          : 'Leave without saving this session to history.',
        [
          { text: 'Keep going', style: 'cancel' },
          {
            text: saveHistory ? 'Finish' : 'End workout',
            style: saveHistory ? 'default' : 'destructive',
            onPress: () => finishAndLeave({ saveHistory }),
          },
        ],
      );
    },
    [finishAndLeave],
  );

  const handleClose = useCallback(() => {
    confirmEnd({ saveHistory: false });
  }, [confirmEnd]);

  /**
   * Log the current set → rest (or complete when no sets left).
   */
  const handleLogSet = useCallback(async () => {
    if (!currentExercise || phase !== PHASE_LOG) return;

    const logged = {
      reps,
      weight,
      loggedAt: Date.now(),
    };

    const nextCompleted = completedSets.map((row, i) =>
      i === exerciseIndex ? [...(row || []), logged] : row || [],
    );
    setCompletedSets(nextCompleted);
    setLastLogged({
      setNumber: setIndex + 1,
      reps,
      weight,
      exerciseName: currentExercise.name,
    });

    const slotAfter = nextOpenSlot(exercises, nextCompleted);
    await persistProgress(nextCompleted, slotAfter?.exerciseIndex ?? exerciseIndex);

    if (!slotAfter) {
      // All sets done — complete into history.
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

    // Advance indices for the upcoming log after rest.
    setExerciseIndex(slotAfter.exerciseIndex);
    setSetIndex(slotAfter.setIndex);
    syncSteppersForSlot(exercises[slotAfter.exerciseIndex], nextCompleted[slotAfter.exerciseIndex]);

    const restFor = plannedRest(currentExercise);
    setRestTotal(restFor);
    setRestSec(restFor);
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
    setRestSec(0);
    setPhase(PHASE_LOG);
  }, []);

  const handleAddRest = useCallback(() => {
    setRestSec((s) => s + REST_ADD_SEC);
    setRestTotal((t) => t + REST_ADD_SEC);
  }, []);

  const selectSetChip = useCallback(
    (index) => {
      if (phase !== PHASE_LOG) return;
      const done = completedSets[exerciseIndex]?.length || 0;
      // Only allow jumping to the current open set (or reviewing done chips as display).
      if (index === done) {
        setSetIndex(index);
        syncSteppersForSlot(currentExercise, completedSets[exerciseIndex]);
      }
    },
    [phase, completedSets, exerciseIndex, currentExercise, syncSteppersForSlot],
  );

  const cueText = String(currentExercise?.cue || currentExercise?.notes || '').trim();
  const targetLine = useMemo(() => {
    if (!currentExercise) return '';
    const target = plannedReps(currentExercise);
    const prior = completedSets[exerciseIndex]?.[setIndex - 1];
    const lastHint = prior
      ? `Last time ${prior.reps} × ${prior.weight} lb.`
      : plannedWeight(currentExercise) > 0
        ? `Last time ${plannedReps(currentExercise)} × ${plannedWeight(currentExercise)} lb.`
        : '';
    return lastHint ? `Target ${target} reps. ${lastHint}` : `Target ${target} reps.`;
  }, [currentExercise, completedSets, exerciseIndex, setIndex]);

  const untilLabel = `UNTIL SET ${setIndex + 1}`;
  const restProgress = restTotal > 0 ? 1 - restSec / restTotal : 0;

  if (booting) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.nbBackground }]} edges={['top', 'bottom']}>
        <View style={styles.boot}>
          <Text style={{ color: colors.nbMuted }}>Starting session…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!exercises.length) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.nbBackground }]} edges={['top', 'bottom']}>
        <View style={styles.boot}>
          <Text style={{ color: colors.nbInk, fontWeight: '800', marginBottom: 8 }}>No exercises</Text>
          <Text style={{ color: colors.nbMuted, marginBottom: 16, textAlign: 'center' }}>
            This day has nothing to log. Go back to the plan and pick a training day.
          </Text>
          <NbButton variant="fill" onPress={leaveScreen}>
            Back to plan
          </NbButton>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.nbBackground }]} edges={['top', 'bottom']}>
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
          <SessionTimerPill label={formatClock(elapsedSec)} colors={colors} />
        </View>
        <NbProgressBar progress={progress} colors={PROGRESS_GRADIENT} style={{ marginTop: 12 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {phase === PHASE_LOG ? (
          <View style={styles.blockGap}>
            {/* SET n OF m · exercise · target */}
            <View>
              <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>
                SET {setIndex + 1} OF {setCount}
              </Text>
              <Text style={[styles.exerciseName, { color: colors.nbInk }]}>
                {currentExercise?.name || 'Exercise'}
              </Text>
              <Text style={[styles.targetLine, { color: colors.nbMuted }]}>{targetLine}</Text>
            </View>

            {/* Set selector chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {Array.from({ length: setCount }).map((_, i) => {
                const logged = completedSets[exerciseIndex]?.[i];
                const active = i === setIndex;
                const done = !!logged;
                return (
                  <SetChip
                    key={`set-${i}`}
                    label={`Set ${i + 1}`}
                    detail={
                      active && !done
                        ? 'now'
                        : done
                          ? formatSetPair(logged)
                          : plannedWeight(currentExercise) > 0
                            ? `${plannedReps(currentExercise)} × ${plannedWeight(currentExercise)}`
                            : `${plannedReps(currentExercise)} reps`
                    }
                    active={active}
                    done={done && !active}
                    onPress={() => selectSetChip(i)}
                    colors={colors}
                  />
                );
              })}
            </ScrollView>

            {/* WEIGHT / REPS steppers */}
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
                  onMinus={() => setWeight((w) => Math.max(MIN_WEIGHT, w - WEIGHT_STEP))}
                  onPlus={() => setWeight((w) => Math.min(MAX_WEIGHT, w + WEIGHT_STEP))}
                />
                <StepperRow
                  label="REPS"
                  value={reps}
                  colors={colors}
                  isLast
                  onMinus={() => setReps((r) => Math.max(MIN_REPS, r - REPS_STEP))}
                  onPlus={() => setReps((r) => Math.min(MAX_REPS, r + REPS_STEP))}
                />
              </View>
            </HardShadow>

            {/* CUE soft card — no hard shadow in PNG (soft fill) */}
            {!!cueText && (
              <View
                style={[
                  styles.cueCard,
                  { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.cueLabel, { color: colors.nbMuted }]}>CUE</Text>
                <Text style={[styles.cueBody, { color: colors.nbInk }]}>{cueText}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.blockGap}>
            {/* REST ring + actions + logged/next rows */}
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
              <View style={{ flex: 1 }}>
                <NbButton variant="ghost" onPress={handleAddRest}>
                  +{REST_ADD_SEC} s
                </NbButton>
              </View>
              <View style={{ flex: 1 }}>
                <NbButton variant="ghost" onPress={() => confirmEnd({ saveHistory: false })}>
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
                    {lastLogged
                      ? `Set ${lastLogged.setNumber} logged: ${lastLogged.reps} × ${lastLogged.weight} lb`
                      : 'Set logged'}
                  </Text>
                </View>
                <View style={[styles.statusRow, { marginTop: 14 }]}>
                  <View style={[styles.statusDotDash, { borderColor: colors.nbBorder }]} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.statusTitle, { color: colors.nbInk }]}>
                      Next: set {setIndex + 1}, {(exercises[exerciseIndex]?.name || 'exercise').toLowerCase()}
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.nbMuted }]}>
                      Same weight, aim for {plannedReps(exercises[exerciseIndex])} clean reps
                    </Text>
                  </View>
                </View>
              </View>
            </HardShadow>
          </View>
        )}

        <UpNextCard nextExercise={nextExercise} colors={colors} />
      </ScrollView>

      {/* Sticky footer CTA */}
      <View style={[styles.footer, { backgroundColor: colors.nbBackground, borderTopColor: colors.nbBorder }]}>
        {phase === PHASE_LOG ? (
          <NbButton variant="fill" onPress={handleLogSet}>
            Log set
          </NbButton>
        ) : (
          <NbButton variant="fill" onPress={handleSkipRest}>
            Skip rest
          </NbButton>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: nb.screenGutter,
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
