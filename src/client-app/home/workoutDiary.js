// Home-screen workout logger: today's exercise rows + sets, saved onto dailyLogs.
// Flow: listen to today's dailyLogs doc → fill the form → on save, write the log and tell the trainer.
// Used by TrainingHomeScreen and LogWorkoutScreen. A blank form is one empty exercise so typing can start.

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

// Firestore path letters stay frozen (users / dailyLogs / field keys below).
const USERS_COLLECTION = 'users';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const NOTIFICATION_TYPE = 'dashboard_update';
const NOTIFICATION_PAYLOAD_TYPE = 'dashboard_workouts';
const NOTIFICATION_LABEL = 'Workouts Today';
const NOTIFICATION_FAILED = 'notification_failed';

// Manipulate here: how long the "trainer notified" banner stays up after a successful save.
const NOTIFIED_BANNER_MS = 3000;

// ===== HELPER FUNCTIONS =====

/**
 * One blank exercise row so the form is never an empty list.
 * @returns {{ id: string, name: string, sets: Array }}
 */
function createEmptyExercise() {
  return {
    id: makeUniqueRowId(),
    name: '',
    sets: [{ id: makeUniqueRowId(), reps: '', weight: '' }],
  };
}

/**
 * Alert + block save when the day name is missing or not a known training-day label.
 * @param {string} trimmedWorkoutName
 * @returns {boolean} true = stop save
 */
function shouldBlockSaveForWorkoutDayName(trimmedWorkoutName) {
  if (!trimmedWorkoutName) {
    Alert.alert(
      'Workout day required',
      `Enter a real training day for today (e.g. ${WORKOUT_DAY_EXAMPLES_SHORT}).`,
    );
    return true;
  }

  const dayLabelIsAllowed = isAllowedClientWorkoutDayLabel(trimmedWorkoutName);
  if (!dayLabelIsAllowed) {
    Alert.alert(
      'Incorrect workout day',
      `That doesn't look like a valid training day. Try something like ${WORKOUT_DAY_EXAMPLES_SHORT}, then save again.`,
    );
    return true;
  }

  return false;
}

/**
 * True when any set on this exercise has draft reps or weight text.
 */
function exerciseHasAnyTypedSet(exercise) {
  let setIndex = 0;
  while (setIndex < exercise.sets.length) {
    const setRow = exercise.sets[setIndex];
    const hasTypedReps = setRow.reps !== '';
    const hasTypedWeight = setRow.weight !== '';
    if (hasTypedReps || hasTypedWeight) return true;
    setIndex += 1;
  }
  return false;
}

/**
 * True when the user typed a name, structured sets, or any draft reps/weight.
 */
function formHasAnythingTyped(workoutName, structuredExercises, workoutExercises) {
  if (workoutName !== '') return true;
  if (structuredExercises.length > 0) return true;

  let exerciseIndex = 0;
  while (exerciseIndex < workoutExercises.length) {
    const exercise = workoutExercises[exerciseIndex];
    if (exercise.name.trim()) return true;
    if (exerciseHasAnyTypedSet(exercise)) return true;
    exerciseIndex += 1;
  }
  return false;
}

/**
 * True when any set on this exercise has draft reps or weight text (truthy check).
 * Kept separate so formHasDraftText stays nesting ≤2.
 */
function exerciseHasDraftSetText(exercise) {
  let setIndex = 0;
  while (setIndex < exercise.sets.length) {
    const setRow = exercise.sets[setIndex];
    // Same truthy check as before (not !== '') — empty string is falsy either way.
    if (setRow.reps || setRow.weight) return true;
    setIndex += 1;
  }
  return false;
}

/**
 * True when name or any set field has draft text (used for "unsaved draft" UI).
 */
function formHasDraftText(workoutName, workoutExercises) {
  if (workoutName) {
    if (workoutName.trim()) return true;
  }

  let exerciseIndex = 0;
  while (exerciseIndex < workoutExercises.length) {
    const exercise = workoutExercises[exerciseIndex];
    if (exercise.name.trim()) return true;
    if (exerciseHasDraftSetText(exercise)) return true;
    exerciseIndex += 1;
  }
  return false;
}

function signedInUserIdOrNull() {
  if (!auth) return null;
  if (!auth.currentUser) return null;
  return auth.currentUser.uid;
}

/**
 * Null when empty; otherwise the trimmed day label for dailyLogs.workoutName.
 */
function workoutNameOrNullForSave(trimmedWorkoutName) {
  if (!trimmedWorkoutName) {
    return null;
  }
  return trimmedWorkoutName;
}

/**
 * Null when empty; otherwise the multi-line summary for dashboard_workouts.
 */
function summaryOrNullForSave(combinedSummary) {
  if (!combinedSummary) {
    return null;
  }
  return combinedSummary;
}

/**
 * Tell the parent screen what just saved (same args as before).
 */
function tellParentAfterWorkoutSave(onAfterSave, combinedSummary, trimmedWorkoutName, structuredExercises) {
  if (!onAfterSave) {
    return;
  }
  const summaryForCallback = summaryOrNullForSave(combinedSummary);
  const nameForCallback = trimmedWorkoutName || '';
  onAfterSave(summaryForCallback, nameForCallback, structuredExercises);
}

/**
 * True when the user typed something and the day label is missing/invalid.
 */
function shouldStopSaveForDayName(userTypedSomething, trimmedWorkoutName) {
  if (!userTypedSomething) {
    return false;
  }
  return shouldBlockSaveForWorkoutDayName(trimmedWorkoutName);
}

/**
 * Write today's workout to dailyLogs, notify the trainer, flash the banner.
 * Field keys workoutName / workoutLog / dashboard_workouts stay frozen.
 */
async function saveWorkoutDiaryForm({
  workoutName,
  workoutExercises,
  setShowNotified,
  setHasSavedValue,
  onAfterSave,
}) {
  const trimmedWorkoutName = workoutName.trim();
  const structuredExercises = buildStructuredExercisesForSave(workoutExercises);
  const dateKey = getLocalDateKey();
  // vocab: auth.currentUser = Firebase signed-in user; uid is the Firestore users/{uid} id
  const signedInUserId = signedInUserIdOrNull();
  if (!db) return;
  if (!signedInUserId) return;

  const combinedSummary = buildWorkoutSummaryText(trimmedWorkoutName, structuredExercises);
  const userTypedSomething = formHasAnythingTyped(
    trimmedWorkoutName,
    structuredExercises,
    workoutExercises,
  );
  if (shouldStopSaveForDayName(userTypedSomething, trimmedWorkoutName)) {
    return;
  }

  try {
    const workoutNameForSave = workoutNameOrNullForSave(trimmedWorkoutName);
    const summaryForSave = summaryOrNullForSave(combinedSummary);

    await saveDashboardWorkoutLog(
      signedInUserId,
      {
        workoutName: workoutNameForSave,
        workoutLog: structuredExercises,
        dashboard_workouts: summaryForSave,
      },
      dateKey,
    );
    await notifyTrainerOfSavedWorkout(signedInUserId, combinedSummary);
    setShowNotified(true);
    setHasSavedValue(true);
    tellParentAfterWorkoutSave(
      onAfterSave,
      combinedSummary,
      trimmedWorkoutName,
      structuredExercises,
    );

    setTimeout(function hideNotifiedBanner() {
      setShowNotified(false);
    }, NOTIFIED_BANNER_MS);
  } catch (error) {
    console.warn('Workout log save error:', error);
  }
}

/**
 * Live listener for users/{uid}/dailyLogs/{dateKey} plus one-shot legacy tracking hydrate.
 * Cleanup: stop listening and ignore late snapshots after unmount.
 */
function listenToTodayWorkoutLog({ uid, dateKey, setters }) {
  const dailyLogsDocRef = doc(db, USERS_COLLECTION, uid, DAILY_LOGS_COLLECTION, dateKey);
  let listenerIsAlive = true;
  let lastDailyLogsSnapshot = null;
  let lastLegacyTrackingSnapshot = null;

  function hydrateFormFromLatestSnapshots() {
    if (!listenerIsAlive) return;
    if (!lastDailyLogsSnapshot) return;
    applyWorkoutHydrationFromSnaps(
      lastDailyLogsSnapshot,
      lastLegacyTrackingSnapshot,
      setters,
    );
  }

  // vocab: fetchLegacyDailyTrackingSnap = older dailyTracking doc used when dailyLogs is thin
  fetchLegacyDailyTrackingSnap(uid, dateKey)
    .then(function onLegacySnapshot(snapshot) {
      if (!listenerIsAlive) return;
      lastLegacyTrackingSnapshot = snapshot;
      hydrateFormFromLatestSnapshots();
    })
    .catch(function ignoreLegacyError() {});

  // vocab: onSnapshot = Firestore live listener; first arg = success, second = error
  const unsubscribeFromDailyLogs = onSnapshot(
    dailyLogsDocRef,
    function onDailyLogsSnapshot(snapshot) {
      lastDailyLogsSnapshot = snapshot;
      hydrateFormFromLatestSnapshots();
    },
    function onDailyLogsError() {
      markWorkoutLogMissingOnError(setters);
    },
  );

  return function stopListeningToTodayWorkoutLog() {
    listenerIsAlive = false;
    try {
      unsubscribeFromDailyLogs();
    } catch (_ignoredCleanupError) {}
  };
}

// ===== MAIN FUNCTION =====

/**
 * Workout name, exercises, and save for today's logger.
 * Flow: 1. form state  2. listen for today's log  3. row editors  4. save  5. return bag
 * @param {Function} [onAfterSave]
 * @returns {object}
 */
export function workoutDiary(onAfterSave) {
  // 1. Form state (hook order frozen — do not reorder).
  const [workoutName, setWorkoutName] = useState('');
  const [workoutExercises, setWorkoutExercises] = useState([]);
  const [showNotified, setShowNotified] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasSavedValue, setHasSavedValue] = useState(false);
  const todayDateKey = todaysDate();

  // 2. Subscribe to today's dailyLogs while signed in; cleanup on leave / day change.
  // vocab: useEffect = run after paint; return function = cleanup when deps change or unmount
  useEffect(() => {
    if (!db) return undefined;
    if (!auth) return undefined;
    if (!auth.currentUser) return undefined;

    const signedInUserId = auth.currentUser.uid;
    return listenToTodayWorkoutLog({
      uid: signedInUserId,
      dateKey: todayDateKey,
      setters: {
        setWorkoutName,
        setWorkoutExercises,
        setHasSavedValue,
        setLoaded,
      },
    });
  }, [auth?.currentUser?.uid, todayDateKey]);

  // 3. Row editors — each returns a new exercises array (React state must stay immutable).
  function addExercise() {
    setWorkoutExercises(function appendBlankExercise(previousExercises) {
      return [...previousExercises, createEmptyExercise()];
    });
  }

  function removeExercise(exerciseId) {
    setWorkoutExercises(function removeOneExercise(previousExercises) {
      return exercisesAfterRemovingRow(previousExercises, exerciseId);
    });
  }

  function updateExerciseName(exerciseId, name) {
    setWorkoutExercises(function renameOneExercise(previousExercises) {
      return exercisesWithRenamedRow(previousExercises, exerciseId, name);
    });
  }

  function addSet(exerciseId) {
    setWorkoutExercises(function appendSetToExercise(previousExercises) {
      return exercisesWithAddedSetRow(previousExercises, exerciseId);
    });
  }

  function removeSet(exerciseId, setId) {
    setWorkoutExercises(function removeOneSet(previousExercises) {
      return exercisesWithRemovedSetRow(previousExercises, exerciseId, setId);
    });
  }

  function updateSetField(exerciseId, setId, field, value) {
    setWorkoutExercises(function changeOneSetField(previousExercises) {
      return exercisesWithUpdatedSetField(previousExercises, exerciseId, setId, field, value);
    });
  }

  // 4. Persist + notify trainer.
  function save() {
    return saveWorkoutDiaryForm({
      workoutName,
      workoutExercises,
      setShowNotified,
      setHasSavedValue,
      onAfterSave,
    });
  }

  // 5. Return the same public bag TrainingHomeScreen / LogWorkoutScreen already read.
  const hasDraftValue = formHasDraftText(workoutName, workoutExercises);

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

// PLUMBING — skip unless the form loads the wrong day, sets serialize wrong, or notify fails.

function makeUniqueRowId() {
  const now = Date.now();
  const randomPiece = Math.random();
  return `${now}_${randomPiece}`;
}

function textFromLoggedNumber(value) {
  if (value == null) return '';
  return String(value);
}

function setsFromSavedWorkoutRow(savedExercise, exerciseIndex) {
  const savedSets = savedExercise.sets;
  const hasSavedSets = Array.isArray(savedSets) && savedSets.length > 0;
  if (!hasSavedSets) {
    return [{ id: `srv_wl_${exerciseIndex}_s_0`, reps: '', weight: '' }];
  }

  const formSets = [];
  let setIndex = 0;
  while (setIndex < savedSets.length) {
    const setRow = savedSets[setIndex];
    formSets.push({
      id: `srv_wl_${exerciseIndex}_s_${setIndex}`,
      reps: textFromLoggedNumber(setRow.reps),
      weight: textFromLoggedNumber(setRow.weight),
    });
    setIndex += 1;
  }
  return formSets;
}

function mapSavedWorkoutLogToForm(workoutLog) {
  const formExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < workoutLog.length) {
    const savedExercise = workoutLog[exerciseIndex];
    let exerciseName = '';
    if (savedExercise.exerciseName) {
      exerciseName = savedExercise.exerciseName;
    }
    formExercises.push({
      id: `srv_wl_${exerciseIndex}`,
      name: exerciseName,
      sets: setsFromSavedWorkoutRow(savedExercise, exerciseIndex),
    });
    exerciseIndex += 1;
  }
  return formExercises;
}

function mapDashboardExerciseNamesToForm(exerciseNames) {
  const formExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < exerciseNames.length) {
    formExercises.push({
      id: `srv_dwe_${exerciseIndex}`,
      name: String(exerciseNames[exerciseIndex]),
      sets: [{ id: `srv_dwe_${exerciseIndex}_s_0`, reps: '', weight: '' }],
    });
    exerciseIndex += 1;
  }
  return formExercises;
}

function keepPreviousExercisesOrStartBlank(previousExercises) {
  if (previousExercises.length > 0) return previousExercises;
  return [createEmptyExercise()];
}

function fillExercisesFromDailyLog(dailyLog, setWorkoutExercises) {
  // Prefer structured workoutLog; fall back to name-only dashboard_workout_exercises.
  const hasStructuredLog = Array.isArray(dailyLog.workoutLog) && dailyLog.workoutLog.length > 0;
  if (hasStructuredLog) {
    setWorkoutExercises(mapSavedWorkoutLogToForm(dailyLog.workoutLog));
    return;
  }

  const namedExercises = dailyLog.dashboard_workout_exercises;
  const hasNamedExercises = Array.isArray(namedExercises) && namedExercises.length > 0;
  if (hasNamedExercises) {
    setWorkoutExercises(mapDashboardExerciseNamesToForm(namedExercises));
    return;
  }

  setWorkoutExercises(keepPreviousExercisesOrStartBlank);
}

function applyWorkoutHydrationFromSnaps(logsSnap, trackingSnap, setters) {
  // vocab: buildWorkoutLogHydration = merges dailyLogs + legacy tracking into one dailyLog shape
  const hydration = buildWorkoutLogHydration(logsSnap, trackingSnap);
  const dailyLog = hydration.d;
  const cameFromLogs = hydration.fromLogs;

  if (!cameFromLogs) {
    setters.setWorkoutExercises(keepPreviousExercisesOrStartBlank);
    setters.setHasSavedValue(false);
    setters.setLoaded(true);
    return;
  }

  let workoutNameFromLog = '';
  if (dailyLog.dashboard_workout_name) {
    workoutNameFromLog = dailyLog.dashboard_workout_name;
  }
  setters.setWorkoutName(workoutNameFromLog);
  fillExercisesFromDailyLog(dailyLog, setters.setWorkoutExercises);
  setters.setHasSavedValue(true);
  setters.setLoaded(true);
}

function markWorkoutLogMissingOnError(setters) {
  setters.setWorkoutExercises([createEmptyExercise()]);
  setters.setHasSavedValue(false);
  setters.setLoaded(true);
}

function setRowNumbersForSave(setRow) {
  return {
    reps: parseInt(setRow.reps, 10) || 0,
    weight: parseFloat(setRow.weight) || 0,
  };
}

function setsReadyToSaveFromExercise(exercise) {
  const setsWithNumbers = [];
  let setIndex = 0;
  while (setIndex < exercise.sets.length) {
    const setRow = exercise.sets[setIndex];
    const hasTypedRepsOrWeight = setRow.reps !== '' || setRow.weight !== '';
    if (hasTypedRepsOrWeight) {
      setsWithNumbers.push(setRowNumbersForSave(setRow));
    }
    setIndex += 1;
  }
  return setsWithNumbers;
}

function buildStructuredExercisesForSave(workoutExercises) {
  const structuredExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < workoutExercises.length) {
    const exercise = workoutExercises[exerciseIndex];
    exerciseIndex += 1;

    if (!exercise.name) continue;
    if (exercise.name.trim() === '') continue;

    const setsForSave = setsReadyToSaveFromExercise(exercise);
    if (setsForSave.length === 0) continue;

    structuredExercises.push({
      exerciseName: exercise.name.trim(),
      sets: setsForSave,
    });
  }
  return structuredExercises;
}

function formatOneSetPiece(setRow) {
  const repsText = setRow.reps || 0;
  const weightText = setRow.weight || 0;
  return `${repsText}×${weightText}`;
}

function formatSetsJoinedForSummary(sets) {
  const setPieces = [];
  let setIndex = 0;
  while (setIndex < sets.length) {
    setPieces.push(formatOneSetPiece(sets[setIndex]));
    setIndex += 1;
  }
  return setPieces.join(', ');
}

function buildWorkoutSummaryText(workoutName, structuredExercises) {
  const summaryLines = [];
  if (workoutName) {
    summaryLines.push(workoutName);
  }

  let exerciseIndex = 0;
  while (exerciseIndex < structuredExercises.length) {
    const exercise = structuredExercises[exerciseIndex];
    const setsJoined = formatSetsJoinedForSummary(exercise.sets);
    summaryLines.push(
      `${exercise.exerciseName} (${exercise.sets.length} sets: ${setsJoined})`,
    );
    exerciseIndex += 1;
  }

  return summaryLines.join('\n');
}

async function notifyTrainerOfSavedWorkout(userId, combinedSummary) {
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, userId));
  let userData = {};
  if (userSnapshot.exists()) {
    userData = userSnapshot.data();
  }

  // Field letters trainerId / trainer_id stay as stored on the user doc.
  let trainerId = null;
  if (userData.trainerId) {
    trainerId = userData.trainerId;
  } else if (userData.trainer_id) {
    trainerId = userData.trainer_id;
  }
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

function exercisesAfterRemovingRow(previousExercises, exerciseId) {
  if (previousExercises.length <= 1) return previousExercises;

  const remaining = [];
  let exerciseIndex = 0;
  while (exerciseIndex < previousExercises.length) {
    const exercise = previousExercises[exerciseIndex];
    if (exercise.id !== exerciseId) {
      remaining.push(exercise);
    }
    exerciseIndex += 1;
  }
  return remaining;
}

function exercisesWithRenamedRow(previousExercises, exerciseId, name) {
  const nextExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < previousExercises.length) {
    const exercise = previousExercises[exerciseIndex];
    if (exercise.id === exerciseId) {
      nextExercises.push({ ...exercise, name: name });
    } else {
      nextExercises.push(exercise);
    }
    exerciseIndex += 1;
  }
  return nextExercises;
}

function exercisesWithAddedSetRow(previousExercises, exerciseId) {
  const nextExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < previousExercises.length) {
    const exercise = previousExercises[exerciseIndex];
    if (exercise.id === exerciseId) {
      nextExercises.push({
        ...exercise,
        sets: [...exercise.sets, { id: makeUniqueRowId(), reps: '', weight: '' }],
      });
    } else {
      nextExercises.push(exercise);
    }
    exerciseIndex += 1;
  }
  return nextExercises;
}

function setsAfterRemovingRow(sets, setId) {
  if (sets.length <= 1) return sets;

  const remaining = [];
  let setIndex = 0;
  while (setIndex < sets.length) {
    const setRow = sets[setIndex];
    if (setRow.id !== setId) {
      remaining.push(setRow);
    }
    setIndex += 1;
  }
  return remaining;
}

function exercisesWithRemovedSetRow(previousExercises, exerciseId, setId) {
  const nextExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < previousExercises.length) {
    const exercise = previousExercises[exerciseIndex];
    if (exercise.id === exerciseId) {
      nextExercises.push({
        ...exercise,
        sets: setsAfterRemovingRow(exercise.sets, setId),
      });
    } else {
      nextExercises.push(exercise);
    }
    exerciseIndex += 1;
  }
  return nextExercises;
}

function setsWithUpdatedField(sets, setId, field, value) {
  const nextSets = [];
  let setIndex = 0;
  while (setIndex < sets.length) {
    const setRow = sets[setIndex];
    if (setRow.id === setId) {
      nextSets.push({ ...setRow, [field]: value });
    } else {
      nextSets.push(setRow);
    }
    setIndex += 1;
  }
  return nextSets;
}

function exercisesWithUpdatedSetField(previousExercises, exerciseId, setId, field, value) {
  const nextExercises = [];
  let exerciseIndex = 0;
  while (exerciseIndex < previousExercises.length) {
    const exercise = previousExercises[exerciseIndex];
    if (exercise.id === exerciseId) {
      nextExercises.push({
        ...exercise,
        sets: setsWithUpdatedField(exercise.sets, setId, field, value),
      });
    } else {
      nextExercises.push(exercise);
    }
    exerciseIndex += 1;
  }
  return nextExercises;
}
