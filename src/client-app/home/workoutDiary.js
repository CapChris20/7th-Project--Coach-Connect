// The home-screen workout logger: exercises and sets for today, saved onto dailyLogs.
// Flow: listen to today's dailyLogs doc → fill the form → on save, write the log and tell the trainer.
// Used by TrainingHomeScreen. A blank form is one empty exercise so the user can start typing.

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../app-start/cloudConnection';
import { postDashboardNotification } from '../../for-both/online-connection/loadHomeAlerts';
import { getLocalDateKey } from '../../helpers/getLocalDay';
import { todaysDate } from '../../daily-stats/todaysDate';
import {
  saveDashboardWorkoutLog,
  buildWorkoutLogHydration,
  fetchLegacyDailyTrackingSnap,
} from '../../daily-stats/saveDailyStats';
import {
  isAllowedClientWorkoutDayLabel,
  WORKOUT_DAY_EXAMPLES_SHORT,
} from '../../helpers/workoutDayNames';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const NOTIFICATION_TYPE = 'dashboard_update';
const NOTIFICATION_PAYLOAD_TYPE = 'dashboard_workouts';
const NOTIFICATION_LABEL = 'Workouts Today';
const NOTIFICATION_FAILED = 'notification_failed';
// Manipulate here: how long the "trainer notified" banner stays up after a save.
const NOTIFIED_BANNER_MS = 3000;

// ===== HELPER FUNCTIONS =====

// PLUMBING — skip unless the workout form loads the wrong day or a save never reaches the trainer.

function newRowId() {
  return `${Date.now()}_${Math.random()}`;
}

function createEmptyExercise() {
  return {
    id: newRowId(),
    name: '',
    sets: [{ id: newRowId(), reps: '', weight: '' }],
  };
}

function textFromLoggedNumber(value) {
  if (value == null) return '';
  return String(value);
}

function setsFromSavedRow(item, exerciseIndex) {
  const hasSets = Array.isArray(item.sets) && item.sets.length;
  if (!hasSets) {
    return [{ id: `srv_wl_${exerciseIndex}_s_0`, reps: '', weight: '' }];
  }
  return item.sets.map((setRow, setIndex) => ({
    id: `srv_wl_${exerciseIndex}_s_${setIndex}`,
    reps: textFromLoggedNumber(setRow.reps),
    weight: textFromLoggedNumber(setRow.weight),
  }));
}

function mapSavedWorkoutLog(workoutLog) {
  return workoutLog.map((item, exerciseIndex) => ({
    id: `srv_wl_${exerciseIndex}`,
    name: item.exerciseName || '',
    sets: setsFromSavedRow(item, exerciseIndex),
  }));
}

function mapDashboardExerciseNames(exerciseNames) {
  return exerciseNames.map((name, exerciseIndex) => ({
    id: `srv_dwe_${exerciseIndex}`,
    name: String(name),
    sets: [{ id: `srv_dwe_${exerciseIndex}_s_0`, reps: '', weight: '' }],
  }));
}

function keepExercisesOrStartBlank(previous) {
  if (previous.length > 0) return previous;
  return [createEmptyExercise()];
}

function exercisesFromDailyLog(dailyLog, setWorkoutExercises) {
  if (Array.isArray(dailyLog.workoutLog) && dailyLog.workoutLog.length > 0) {
    setWorkoutExercises(mapSavedWorkoutLog(dailyLog.workoutLog));
    return;
  }
  const namedExercises = dailyLog.dashboard_workout_exercises;
  if (Array.isArray(namedExercises) && namedExercises.length > 0) {
    setWorkoutExercises(mapDashboardExerciseNames(namedExercises));
    return;
  }
  setWorkoutExercises(keepExercisesOrStartBlank);
}

function applyWorkoutHydration(logsSnap, trackingSnap, setters) {
  const { d: dailyLog, fromLogs } = buildWorkoutLogHydration(logsSnap, trackingSnap);
  if (!fromLogs) {
    setters.setWorkoutExercises(keepExercisesOrStartBlank);
    setters.setHasSavedValue(false);
    setters.setLoaded(true);
    return;
  }
  setters.setWorkoutName(dailyLog.dashboard_workout_name || '');
  exercisesFromDailyLog(dailyLog, setters.setWorkoutExercises);
  setters.setHasSavedValue(true);
  setters.setLoaded(true);
}

function markWorkoutLogMissing(setters) {
  setters.setWorkoutExercises([createEmptyExercise()]);
  setters.setHasSavedValue(false);
  setters.setLoaded(true);
}

function listenToTodayWorkoutLog({ uid, dateKey, setters }) {
  const logsRef = doc(db, USERS_COLLECTION, uid, DAILY_LOGS_COLLECTION, dateKey);
  let isAlive = true;
  let lastLogsSnap = null;
  let lastTrackingSnap = null;

  const hydrate = () => {
    if (!isAlive || !lastLogsSnap) return;
    applyWorkoutHydration(lastLogsSnap, lastTrackingSnap, setters);
  };

  fetchLegacyDailyTrackingSnap(uid, dateKey)
    .then((snapshot) => {
      if (!isAlive) return;
      lastTrackingSnap = snapshot;
      hydrate();
    })
    .catch(() => {});

  const unsubscribeFromLogs = onSnapshot(
    logsRef,
    (snapshot) => {
      lastLogsSnap = snapshot;
      hydrate();
    },
    () => {
      markWorkoutLogMissing(setters);
    },
  );

  return () => {
    isAlive = false;
    try {
      unsubscribeFromLogs();
    } catch (ignoredError) {}
  };
}

function setRowForSave(setRow) {
  return {
    reps: parseInt(setRow.reps, 10) || 0,
    weight: parseFloat(setRow.weight) || 0,
  };
}

function setsReadyToSave(exercise) {
  return exercise.sets
    .filter((setRow) => setRow.reps !== '' || setRow.weight !== '')
    .map(setRowForSave);
}

function buildStructuredExercises(workoutExercises) {
  return workoutExercises
    .filter((exercise) => exercise.name && exercise.name.trim() !== '')
    .map((exercise) => ({
      exerciseName: exercise.name.trim(),
      sets: setsReadyToSave(exercise),
    }))
    .filter((exercise) => exercise.sets.length > 0);
}

function buildWorkoutSummary(workoutName, structuredExercises) {
  const summaryParts = structuredExercises.map((exercise) => {
    const setsSummary = exercise.sets
      .map((setRow) => `${setRow.reps || 0}×${setRow.weight || 0}`)
      .join(', ');
    return `${exercise.exerciseName} (${exercise.sets.length} sets: ${setsSummary})`;
  });
  return [workoutName, ...summaryParts].filter(Boolean).join('\n');
}

function exerciseHasTypedSet(exercise) {
  return exercise.sets.some((setRow) => setRow.reps !== '' || setRow.weight !== '');
}

function hasTypedWorkoutContent(workoutName, structuredExercises, workoutExercises) {
  if (workoutName !== '') return true;
  if (structuredExercises.length > 0) return true;
  return workoutExercises.some((exercise) => exercise.name.trim() || exerciseHasTypedSet(exercise));
}

function rejectWorkoutDayName(name) {
  if (!name) {
    Alert.alert(
      'Workout day required',
      `Enter a real training day for today (e.g. ${WORKOUT_DAY_EXAMPLES_SHORT}).`,
    );
    return true;
  }
  if (!isAllowedClientWorkoutDayLabel(name)) {
    Alert.alert(
      'Incorrect workout day',
      `That doesn't look like a valid training day. Try something like ${WORKOUT_DAY_EXAMPLES_SHORT}, then save again.`,
    );
    return true;
  }
  return false;
}

async function notifyTrainerOfSavedWorkout(userId, combinedSummary) {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  const userData = userSnapshot.exists() ? userSnapshot.data() : {};
  const trainerId = userData.trainerId || userData.trainer_id || null;
  if (!trainerId) return;
  const notifyResult = await postDashboardNotification({
    recipientId: trainerId,
    clientId: userId,
    type: NOTIFICATION_TYPE,
    payload: {
      type: NOTIFICATION_PAYLOAD_TYPE,
      label: NOTIFICATION_LABEL,
      value: combinedSummary,
    },
  });
  if (!notifyResult.ok) {
    throw new Error(notifyResult.reason || NOTIFICATION_FAILED);
  }
}

async function saveWorkoutDiaryForm({
  workoutName,
  workoutExercises,
  setShowNotified,
  setHasSavedValue,
  onAfterSave,
}) {
  const name = workoutName.trim();
  const structured = buildStructuredExercises(workoutExercises);
  const dateKey = getLocalDateKey();
  const uid = auth?.currentUser?.uid;
  if (!db || !uid) return;

  const combined = buildWorkoutSummary(name, structured);
  if (hasTypedWorkoutContent(name, structured, workoutExercises) && rejectWorkoutDayName(name)) return;

  try {
    await saveDashboardWorkoutLog(
      uid,
      {
        workoutName: name || null,
        workoutLog: structured,
        dashboard_workouts: combined || null,
      },
      dateKey,
    );
    await notifyTrainerOfSavedWorkout(uid, combined);
    setShowNotified(true);
    setHasSavedValue(true);
    if (onAfterSave) onAfterSave(combined || null, name || '', structured);
    setTimeout(() => setShowNotified(false), NOTIFIED_BANNER_MS);
  } catch (error) {
    console.warn('Workout log save error:', error);
  }
}

function exercisesAfterRemoval(previous, exerciseId) {
  if (previous.length <= 1) return previous;
  return previous.filter((exercise) => exercise.id !== exerciseId);
}

function exercisesWithRenamedRow(previous, exerciseId, name) {
  return previous.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return { ...exercise, name };
  });
}

function exercisesWithAddedSet(previous, exerciseId) {
  return previous.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return {
      ...exercise,
      sets: [...exercise.sets, { id: newRowId(), reps: '', weight: '' }],
    };
  });
}

function setsAfterRemoval(sets, setId) {
  if (sets.length <= 1) return sets;
  return sets.filter((setRow) => setRow.id !== setId);
}

function exercisesWithRemovedSet(previous, exerciseId, setId) {
  return previous.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return { ...exercise, sets: setsAfterRemoval(exercise.sets, setId) };
  });
}

function setsWithUpdatedField(sets, setId, field, value) {
  return sets.map((setRow) => {
    if (setRow.id !== setId) return setRow;
    return { ...setRow, [field]: value };
  });
}

function exercisesWithUpdatedSet(previous, exerciseId, setId, field, value) {
  return previous.map((exercise) => {
    if (exercise.id !== exerciseId) return exercise;
    return { ...exercise, sets: setsWithUpdatedField(exercise.sets, setId, field, value) };
  });
}

function formHasDraft(workoutName, workoutExercises) {
  if (workoutName && workoutName.trim()) return true;
  return workoutExercises.some((exercise) => {
    if (exercise.name.trim()) return true;
    return exercise.sets.some((setRow) => setRow.reps || setRow.weight);
  });
}

// ===== MAIN FUNCTION =====

/**
 * Workout name, exercises, and save for today's logger.
 * @param {Function} [onAfterSave]
 * @returns {object}
 */
export function workoutDiary(onAfterSave) {
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showNotified, setShowNotified] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasSavedValue, setHasSavedValue] = useState(false);
  const todayDateKey = todaysDate();

  useEffect(() => {
    if (!db || !auth?.currentUser) return undefined;
    const uid = auth.currentUser.uid;
    return listenToTodayWorkoutLog({
      uid,
      dateKey: todayDateKey,
      setters: {
        setWorkoutName,
        setWorkoutExercises,
        setHasSavedValue,
        setLoaded,
      },
    });
  }, [auth?.currentUser?.uid, todayDateKey]);

  const addExercise = () => setWorkoutExercises((previous) => [...previous, createEmptyExercise()]);
  const removeExercise = (exerciseId) =>
    setWorkoutExercises((previous) => exercisesAfterRemoval(previous, exerciseId));
  const updateExerciseName = (exerciseId, name) =>
    setWorkoutExercises((previous) => exercisesWithRenamedRow(previous, exerciseId, name));
  const addSet = (exerciseId) =>
    setWorkoutExercises((previous) => exercisesWithAddedSet(previous, exerciseId));
  const removeSet = (exerciseId, setId) =>
    setWorkoutExercises((previous) => exercisesWithRemovedSet(previous, exerciseId, setId));
  const updateSetField = (exerciseId, setId, field, value) =>
    setWorkoutExercises((previous) => exercisesWithUpdatedSet(previous, exerciseId, setId, field, value));

  const save = () =>
    saveWorkoutDiaryForm({
      workoutName,
      workoutExercises,
      setShowNotified,
      setHasSavedValue,
      onAfterSave,
    });

  const hasDraftValue = formHasDraft(workoutName, workoutExercises);

  return {
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
    loaded,
    showNotified,
    hasDraftValue,
    hasSavedValue,
  };
}
