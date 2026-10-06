// The home-screen workout logger: exercises and sets for today, saved onto dailyLogs.
// Flow: listen to today's dailyLogs doc → fill the form → on save, write the log and
//       tell the trainer. A blank form is one empty exercise so the user can start typing.
// Used by TrainingHomeScreen. Hooks stay in this function, in this order.

import { useState, useEffect } from 'react';
import { Alert } from 'react-native';
// vocab: onSnapshot = live Firestore listener. The cleanup function stops it when the screen leaves.
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

/**
 * A new row id. Time plus random so two taps in the same millisecond do not clash.
 * @returns {string}
 */
function newRowId() {
  return `${Date.now()}_${Math.random()}`;
}

/**
 * One empty exercise with one empty set. The form always has at least this.
 * @returns {object}
 */
function createEmptyExercise() {
  return {
    id: newRowId(),
    name: '',
    sets: [{ id: newRowId(), reps: '', weight: '' }],
  };
}

/**
 * Saved workoutLog rows use exerciseName. The form uses name, plus a stable id for React.
 * @param {object[]} workoutLog
 * @returns {object[]}
 */
function mapSavedWorkoutLog(workoutLog) {
  return workoutLog.map((item, exerciseIndex) => ({
    id: `srv_wl_${exerciseIndex}`,
    name: item.exerciseName || '',
    sets: Array.isArray(item.sets) && item.sets.length
      ? item.sets.map((setRow, setIndex) => ({
          id: `srv_wl_${exerciseIndex}_s_${setIndex}`,
          reps: setRow.reps != null ? String(setRow.reps) : '',
          weight: setRow.weight != null ? String(setRow.weight) : '',
        }))
      : [{ id: `srv_wl_${exerciseIndex}_s_0`, reps: '', weight: '' }],
  }));
}

/**
 * Older docs stored only exercise names, no sets. Each name becomes one empty set.
 * @param {string[]} exerciseNames
 * @returns {object[]}
 */
function mapDashboardExerciseNames(exerciseNames) {
  return exerciseNames.map((name, exerciseIndex) => ({
    id: `srv_dwe_${exerciseIndex}`,
    name: String(name),
    sets: [{ id: `srv_dwe_${exerciseIndex}_s_0`, reps: '', weight: '' }],
  }));
}

/**
 * Drop blank exercises and blank sets. Reps and weight become numbers for the save.
 * @param {object[]} workoutExercises
 * @returns {object[]}
 */
function buildStructuredExercises(workoutExercises) {
  return workoutExercises
    .filter((exercise) => exercise.name && exercise.name.trim() !== '')
    .map((exercise) => ({
      exerciseName: exercise.name.trim(),
      sets: exercise.sets
        .filter((setRow) => setRow.reps !== '' || setRow.weight !== '')
        .map((setRow) => ({
          reps: parseInt(setRow.reps, 10) || 0,
          weight: parseFloat(setRow.weight) || 0,
        })),
    }))
    .filter((exercise) => exercise.sets.length > 0);
}

/**
 * The text the trainer sees: the day name, then each exercise and its sets.
 * @param {string} workoutName
 * @param {object[]} structuredExercises
 * @returns {string}
 */
function buildWorkoutSummary(workoutName, structuredExercises) {
  const summaryParts = structuredExercises.map((exercise) => {
    const setsSummary = exercise.sets
      .map((setRow) => `${setRow.reps || 0}×${setRow.weight || 0}`)
      .join(', ');
    return `${exercise.exerciseName} (${exercise.sets.length} sets: ${setsSummary})`;
  });
  return [workoutName, ...summaryParts].filter(Boolean).join('\n');
}

/**
 * True when the form has anything the user typed, even if it is not ready to save.
 * The name check and the set check are different from the "dirty" flag on the return value.
 * @param {string} workoutName
 * @param {object[]} structuredExercises
 * @param {object[]} workoutExercises
 * @returns {boolean}
 */
function hasTypedWorkoutContent(workoutName, structuredExercises, workoutExercises) {
  return (
    workoutName !== '' ||
    structuredExercises.length > 0 ||
    workoutExercises.some(
      (exercise) => exercise.name.trim() || exercise.sets.some((setRow) => setRow.reps !== '' || setRow.weight !== ''),
    )
  );
}

/**
 * Tell the linked trainer. No trainer id means there is nobody to notify, which is not an error.
 * A failed post throws so the save catch can log it and skip the success banner.
 * @param {string} userId
 * @param {string} combinedSummary
 */
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

// ===== MAIN FUNCTION =====

/**
 * Workout name, exercises, and save for today's logger.
 * @param {Function} [onAfterSave] Called with the summary, the day name, and the structured sets
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
    if (!db || !auth?.currentUser) return;
    const uid = auth.currentUser.uid;
    const dateKey = todayDateKey;
    const logsRef = doc(db, USERS_COLLECTION, uid, DAILY_LOGS_COLLECTION, dateKey);

    let isAlive = true;
    let lastLogsSnap = null;
    let lastTrackingSnap = null;

    // Both reads land whenever they land. Hydrate only once the logs snapshot exists,
    // because that doc is the one we treat as current.
    const hydrate = () => {
      if (!isAlive || !lastLogsSnap) return;

      const { d: dailyLog, fromLogs } = buildWorkoutLogHydration(lastLogsSnap, lastTrackingSnap);

      if (!fromLogs) {
        setWorkoutExercises((previous) => (previous.length > 0 ? previous : [createEmptyExercise()]));
        setHasSavedValue(false);
        setLoaded(true);
        return;
      }

      setWorkoutName(dailyLog.dashboard_workout_name || '');
      if (Array.isArray(dailyLog.workoutLog) && dailyLog.workoutLog.length > 0) {
        setWorkoutExercises(mapSavedWorkoutLog(dailyLog.workoutLog));
      } else if (
        Array.isArray(dailyLog.dashboard_workout_exercises) &&
        dailyLog.dashboard_workout_exercises.length > 0
      ) {
        setWorkoutExercises(mapDashboardExerciseNames(dailyLog.dashboard_workout_exercises));
      } else {
        setWorkoutExercises((previous) => (previous.length > 0 ? previous : [createEmptyExercise()]));
      }
      setHasSavedValue(true);
      setLoaded(true);
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
        setWorkoutExercises([createEmptyExercise()]);
        setHasSavedValue(false);
        setLoaded(true);
      },
    );

    return () => {
      isAlive = false;
      try { unsubscribeFromLogs?.(); } catch (ignoredError) {}
    };
  }, [auth?.currentUser?.uid, todayDateKey]);

  const addExercise = () => setWorkoutExercises((previous) => [...previous, createEmptyExercise()]);
  const removeExercise = (exerciseId) =>
    setWorkoutExercises((previous) =>
      previous.length > 1 ? previous.filter((exercise) => exercise.id !== exerciseId) : previous,
    );
  const updateExerciseName = (exerciseId, name) =>
    setWorkoutExercises((previous) =>
      previous.map((exercise) => (exercise.id === exerciseId ? { ...exercise, name } : exercise)),
    );

  const addSet = (exerciseId) =>
    setWorkoutExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: [...exercise.sets, { id: newRowId(), reps: '', weight: '' }],
            }
          : exercise,
      ),
    );

  const removeSet = (exerciseId, setId) =>
    setWorkoutExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.length > 1
                ? exercise.sets.filter((setRow) => setRow.id !== setId)
                : exercise.sets,
            }
          : exercise,
      ),
    );

  const updateSetField = (exerciseId, setId, field, value) =>
    setWorkoutExercises((previous) =>
      previous.map((exercise) =>
        exercise.id === exerciseId
          ? {
              ...exercise,
              sets: exercise.sets.map((setRow) => (setRow.id === setId ? { ...setRow, [field]: value } : setRow)),
            }
          : exercise,
      ),
    );

  const save = async () => {
    const name = workoutName.trim();
    const structured = buildStructuredExercises(workoutExercises);
    const dateKey = getLocalDateKey();
    const uid = auth?.currentUser?.uid;
    if (!db || !uid) return;

    const combined = buildWorkoutSummary(name, structured);

    // A day name is required only when they actually typed something. An empty form can save as a clear.
    if (hasTypedWorkoutContent(name, structured, workoutExercises)) {
      if (!name) {
        Alert.alert(
          'Workout day required',
          `Enter a real training day for today (e.g. ${WORKOUT_DAY_EXAMPLES_SHORT}).`,
        );
        return;
      }
      if (!isAllowedClientWorkoutDayLabel(name)) {
        Alert.alert(
          'Incorrect workout day',
          `That doesn't look like a valid training day. Try something like ${WORKOUT_DAY_EXAMPLES_SHORT}, then save again.`,
        );
        return;
      }
    }

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
  };

  const hasDraftValue =
    (workoutName && workoutName.trim()) ||
    workoutExercises.some(
      (exercise) => exercise.name.trim() || exercise.sets.some((setRow) => setRow.reps || setRow.weight),
    );

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
