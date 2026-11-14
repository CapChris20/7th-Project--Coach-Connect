// Firestore service for workout plans, templates, active sessions, and history.
// Flow: read/write current plan → templates → active session → history and saved plans.
// Used by CreateWorkoutPlanScreen, ClientAppStart, home loader, exercise-library saved plans.
// Read order: imports → constants → helpers → mains (Firestore recipes) → PLUMBING.

import { db } from '../../app-start/cloudConnection';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { nameWorkoutPlan, looksLikeDefaultAiPlanName } from './nameWorkoutPlan';

// ===== NAMED CONSTANTS =====

// Firestore collection names — letters stay frozen (rules + other files use these).
const WORKOUT_TEMPLATES_COLLECTION = 'workoutTemplates';
const ACTIVE_WORKOUTS_COLLECTION = 'activeWorkouts';
const COMPLETED_WORKOUTS_COLLECTION = 'completedWorkouts';
const SAVED_WORKOUT_PLANS_COLLECTION = 'savedWorkoutPlans';

// Manipulate here: default sets / reps / rest when a template exercise omits them
const DEFAULT_TEMPLATE_SETS = 3;
const DEFAULT_TEMPLATE_REPS = 10;
const DEFAULT_REST_SECONDS = 60;
const SECONDS_PER_MINUTE = 60;

// Manipulate here: how many history / saved-plan rows to return when caller omits limit
const DEFAULT_HISTORY_LIMIT = 50;

// Manipulate here: AI plan defaults when structuredPlan lacks weeks / days / session length
const DEFAULT_PLAN_WEEKS = 8;
const DEFAULT_DAYS_PER_WEEK = 3;
const DEFAULT_SESSION_MINUTES = 45;

const FIRESTORE_PERMISSION_DENIED = 'permission-denied';
const FIRESTORE_FAILED_PRECONDITION = 'failed-precondition';

// ===== HELPER FUNCTIONS =====

function resolveWorkoutPlanDisplayTitle(title, namingInput) {
  if (title && String(title).trim() && !looksLikeDefaultAiPlanName(title)) {
    return String(title).trim();
  }
  return nameWorkoutPlan(namingInput);
}

function isFirestoreMissingIndexError(error) {
  if (!error) return false;
  if (error.code === FIRESTORE_FAILED_PRECONDITION) return true;
  if (error.message && error.message.includes('index')) return true;
  return false;
}

function docsFromQuerySnapshot(snapshot) {
  const rows = [];
  snapshot.forEach((snapshotDoc) => {
    rows.push({ id: snapshotDoc.id, ...snapshotDoc.data() });
  });
  return rows;
}

function stampToDate(stamp) {
  if (!stamp) return new Date(0);
  if (typeof stamp.toDate === 'function') return stamp.toDate();
  return new Date(stamp || 0);
}

function completedAtMillis(workout) {
  const stamp = stampToDate(workout.completedAt);
  return stamp.getTime();
}

function sortWorkoutsNewestFirst(workouts) {
  workouts.sort((left, right) => completedAtMillis(right) - completedAtMillis(left));
  return workouts;
}

function savedPlanSortMillis(plan) {
  // Prefer createdAt Firestore stamp; fall back to generatedAt (0 still counts).
  if (plan.createdAt && typeof plan.createdAt.toDate === 'function') {
    return plan.createdAt.toDate().getTime();
  }
  if (plan.generatedAt != null) return plan.generatedAt;
  return 0;
}

function normalizeTemplateExercise(exercise) {
  return {
    exerciseId: exercise.exerciseId,
    sets: parseInt(exercise.sets) || DEFAULT_TEMPLATE_SETS,
    reps: parseInt(exercise.reps) || DEFAULT_TEMPLATE_REPS,
    restSeconds: parseInt(exercise.restSeconds) || DEFAULT_REST_SECONDS,
  };
}

function normalizeTemplateExerciseList(exercises) {
  const normalizedList = [];
  for (let index = 0; index < exercises.length; index += 1) {
    normalizedList.push(normalizeTemplateExercise(exercises[index]));
  }
  return normalizedList;
}

function emptyCompletedSetsForExerciseCount(exerciseCount) {
  const emptySets = [];
  for (let index = 0; index < exerciseCount; index += 1) {
    emptySets.push([]);
  }
  return emptySets;
}

function normalizeSessionExerciseList(exercises) {
  const normalizedList = [];
  for (let index = 0; index < exercises.length; index += 1) {
    normalizedList.push(normalizeSessionExercise(exercises[index]));
  }
  return normalizedList;
}

function safeExerciseObject(exercise) {
  if (exercise) return exercise;
  return {};
}

function restSecondsFromExercise(exercise) {
  const safeExercise = safeExerciseObject(exercise);
  if (safeExercise.restSeconds != null) return safeExercise.restSeconds;
  if (safeExercise.rest != null) return safeExercise.rest;
  if (safeExercise.restPeriod != null) return safeExercise.restPeriod;
  return null;
}

function cueTextFromExercise(exercise) {
  const safeExercise = safeExerciseObject(exercise);
  if (safeExercise.cue) return String(safeExercise.cue);
  if (safeExercise.notes) return String(safeExercise.notes);
  if (safeExercise.formCues) return String(safeExercise.formCues);
  if (safeExercise.cues) return String(safeExercise.cues);
  return '';
}

function exerciseDisplayName(exercise) {
  const safeExercise = safeExerciseObject(exercise);
  if (safeExercise.name) return String(safeExercise.name).trim() || 'Exercise';
  if (safeExercise.exerciseName) return String(safeExercise.exerciseName).trim() || 'Exercise';
  return 'Exercise';
}

function normalizeSessionExercise(exercise) {
  // Combined "3 x 8" / "3×10" lives on sets in some plan rows — split when present.
  const safeExercise = safeExerciseObject(exercise);
  let setsRaw = safeExercise.sets;
  let repsRaw = safeExercise.reps;
  let combined = '';
  if (setsRaw != null) combined = String(setsRaw);
  if (/[×x]/i.test(combined)) {
    const parts = combined.split(/[×x]/i);
    setsRaw = (parts[0] || '').trim();
    if (repsRaw == null || repsRaw === '') repsRaw = (parts[1] || '').trim();
  }

  const sets = parseInt(setsRaw, 10) || DEFAULT_TEMPLATE_SETS;
  const reps = parseInt(repsRaw, 10) || DEFAULT_TEMPLATE_REPS;
  const restSeconds = parseRestSeconds(restSecondsFromExercise(safeExercise));
  const weightNum = parseFloat(safeExercise.weight);
  const cue = cueTextFromExercise(safeExercise).trim();

  let exerciseId = null;
  if (safeExercise.exerciseId) exerciseId = safeExercise.exerciseId;

  return {
    exerciseId,
    name: exerciseDisplayName(safeExercise),
    sets,
    reps,
    restSeconds,
    // Manipulate here: 0 weight = bodyweight / unset — steppers still start at 0
    weight: finiteWeightOrZero(weightNum),
    cue,
  };
}

function firestorePermissionWasDenied(error) {
  if (!error) return false;
  return error.code === FIRESTORE_PERMISSION_DENIED;
}

function finiteWeightOrZero(weightNum) {
  if (Number.isFinite(weightNum)) {
    return weightNum;
  }
  return 0;
}

function parseRestSeconds(raw) {
  if (raw == null || raw === '') return DEFAULT_REST_SECONDS;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  const text = String(raw).trim().toLowerCase().replace(/\s*rest\s*$/i, '').trim();
  if (!text) return DEFAULT_REST_SECONDS;

  // vocab: m:ss clock form used in some plan rows
  const clock = text.match(/^(\d+)\s*:\s*(\d+)$/);
  if (clock) {
    return parseInt(clock[1], 10) * SECONDS_PER_MINUTE + parseInt(clock[2], 10);
  }

  const minutes = text.match(/(\d+)\s*m(?:in(?:ute)?s?)?/);
  const seconds = text.match(/(\d+)\s*s(?:ec(?:ond)?s?)?/);
  if (minutes || seconds) {
    let minuteCount = 0;
    let secondCount = 0;
    if (minutes) {
      minuteCount = parseInt(minutes[1], 10);
    }
    if (seconds) {
      secondCount = parseInt(seconds[1], 10);
    }
    const totalFromParts = minuteCount * SECONDS_PER_MINUTE + secondCount;
    if (totalFromParts) {
      return totalFromParts;
    }
    return DEFAULT_REST_SECONDS;
  }

  const plain = parseInt(text, 10);
  if (Number.isFinite(plain)) {
    return plain;
  }
  return DEFAULT_REST_SECONDS;
}

// ===== MAIN FUNCTION =====




/**
 * Read the user's active plan doc (users/{uid}/workoutPlan/current).
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getCurrentWorkoutPlan(userId) {
  if (!userId || !db) return null;

  try {
    // 1. Point at the single "current plan" doc for this user.
    // vocab: doc / getDoc = one Firestore document path + one-shot read
    const currentPlanRef = doc(db, 'users', userId, 'workoutPlan', 'current');

    // 2. Read once; missing doc → null (caller shows empty state).
    const currentPlanSnapshot = await getDoc(currentPlanRef);
    if (!currentPlanSnapshot.exists()) return null;
    return currentPlanSnapshot.data();
  } catch (error) {
    if (!firestorePermissionWasDenied(error)) {
      console.error('getCurrentWorkoutPlan:', error);
    }
    return null;
  }
}



/**
 * Write the active plan to current + library docs. Field letters stay frozen.
 * @param {string} userId
 * @param {{ rawPlan: string, generatedAt?: number|object, structuredPlan?: object|null, planText?: string, title?: string }} planFields
 * @returns {Promise<void>}
 */
export async function setCurrentWorkoutPlan(
  userId,
  { rawPlan, generatedAt, structuredPlan, planText, title },
) {
  if (!userId || !db || rawPlan == null) return;

  // 1. Normalize plan text + title the home screens already expect.
  const planTextForStorage = String(planText || rawPlan);
  // vocab: serverTimestamp = Firestore fills the write time on the server
  const generatedAtForStorage = generatedAt || serverTimestamp();
  const generatedAtForNaming =
    typeof generatedAt === 'number' ? generatedAt : Date.now();
  const displayTitle = resolveWorkoutPlanDisplayTitle(title, {
    structuredPlan: structuredPlan || null,
    planText: planTextForStorage,
    generatedAt: generatedAtForNaming,
  });

  const planBody = {
    rawPlan: String(rawPlan),
    planText: planTextForStorage,
    title: displayTitle,
    name: displayTitle,
    structuredPlan: structuredPlan || null,
    generatedAt: generatedAtForStorage,
    updatedAt: serverTimestamp(),
    source: 'generator',
    status: 'active',
  };

  try {
    // 2. Active plan doc trainers / client home read as "the" plan.
    const currentPlanRef = doc(db, 'users', userId, 'workoutPlan', 'current');
    await setDoc(currentPlanRef, planBody, { merge: true });

    // 3. Stable library doc so collection queries always see the latest client plan.
    const libraryPlanRef = doc(db, 'users', userId, 'workoutPlans', 'current');
    await setDoc(libraryPlanRef, { userId, ...planBody }, { merge: true });
  } catch (error) {
    if (!firestorePermissionWasDenied(error)) {
      console.error('setCurrentWorkoutPlan:', error);
    }
  }
}



/**
 * Add a reusable workout template for this user.
 * @param {string} userId
 * @param {string} name
 * @param {string} goal
 * @param {Array} exercises
 * @returns {Promise<{ success: boolean, id?: string, template?: object, error?: string }>}
 */
export async function createWorkoutTemplate(userId, name, goal, exercises) {
  if (!userId || !db || !name || !exercises || exercises.length === 0) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    // 1. Normalize each exercise into the frozen template shape.
    const normalizedExercises = normalizeTemplateExerciseList(exercises);
    const templateData = {
      userId,
      name: name.trim(),
      goal: goal || 'general',
      exercises: normalizedExercises,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // 2. Write the template doc and return its id.
    const docRef = await addDoc(collection(db, WORKOUT_TEMPLATES_COLLECTION), templateData);
    return { success: true, id: docRef.id, template: { id: docRef.id, ...templateData } };
  } catch (error) {
    console.error('Error creating workout template:', error);
    return { success: false, error: error.message };
  }
}



/**
 * List this user's templates, newest first.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function fetchWorkoutTemplates(userId) {
  if (!userId || !db) return [];

  try {
    const templatesRef = collection(db, WORKOUT_TEMPLATES_COLLECTION);
    const templatesQuery = query(
      templatesRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
    );
    const snapshot = await getDocs(templatesQuery);
    return docsFromQuerySnapshot(snapshot);
  } catch (error) {
    console.error('Error fetching workout templates:', error);
    return [];
  }
}



/**
 * Load one template by id.
 * @param {string} templateId
 * @returns {Promise<object|null>}
 */
export async function getWorkoutTemplate(templateId) {
  if (!templateId || !db) return null;

  try {
    const templateRef = doc(db, WORKOUT_TEMPLATES_COLLECTION, templateId);
    const templateSnap = await getDoc(templateRef);
    if (templateSnap.exists()) {
      return { id: templateSnap.id, ...templateSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting workout template:', error);
    return null;
  }
}



/**
 * Start a live session from a template (blocks if one is already active).
 * @param {string} userId
 * @param {string} workoutId
 * @returns {Promise<{ success: boolean, id?: string, activeWorkout?: object, error?: string }>}
 */
export async function startWorkout(userId, workoutId) {
  if (!userId || !db || !workoutId) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    // 1. Load the template we are starting from.
    const template = await getWorkoutTemplate(workoutId);
    if (!template) {
      return { success: false, error: 'Workout template not found' };
    }

    // 2. Block a second active session — user must complete or cancel first.
    const alreadyActive = await getActiveWorkout(userId);
    if (alreadyActive) {
      return {
        success: false,
        error: 'You already have an active workout. Please complete or cancel it first.',
      };
    }

    // 3. Create the active row (one empty completedSets array per exercise).
    const emptyCompletedSets = emptyCompletedSetsForExerciseCount(template.exercises.length);
    const activeWorkoutData = {
      userId,
      workoutId,
      workoutName: template.name,
      startedAt: serverTimestamp(),
      currentExerciseIndex: 0,
      completedSets: emptyCompletedSets,
      exercises: template.exercises,
    };

    const docRef = await addDoc(collection(db, ACTIVE_WORKOUTS_COLLECTION), activeWorkoutData);
    return {
      success: true,
      id: docRef.id,
      activeWorkout: { id: docRef.id, ...activeWorkoutData },
    };
  } catch (error) {
    console.error('Error starting workout:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Start (or resume) a plan-day session from an exercise list.
 * @param {string} userId
 * @param {string} workoutName
 * @param {Array} exercises
 * @returns {Promise<{ success: boolean, id?: string, activeWorkout?: object, resumed?: boolean, error?: string }>}
 */
export async function startWorkoutFromExercises(userId, workoutName, exercises) {
  if (!userId || !db) {
    return { success: false, error: 'Missing required fields' };
  }
  const list = Array.isArray(exercises) ? exercises : [];
  if (list.length === 0) {
    return { success: false, error: 'No exercises to start' };
  }

  try {
    // 1. Resume an in-progress session rather than blocking the client on the plan CTA.
    const alreadyActive = await getActiveWorkout(userId);
    if (alreadyActive) {
      return {
        success: true,
        id: alreadyActive.id,
        activeWorkout: alreadyActive,
        resumed: true,
      };
    }

    // 2. Normalize plan-day rows into the shape session UI + completeWorkout expect.
    const normalized = normalizeSessionExerciseList(list);
    const emptyCompletedSets = emptyCompletedSetsForExerciseCount(normalized.length);
    const activeWorkoutData = {
      userId,
      // vocab: workoutId = template id when from startWorkout; plan-day sessions use a local tag
      workoutId: 'plan-day',
      workoutName: String(workoutName || 'Workout').trim() || 'Workout',
      startedAt: serverTimestamp(),
      currentExerciseIndex: 0,
      completedSets: emptyCompletedSets,
      exercises: normalized,
      source: 'plan-day',
    };

    const docRef = await addDoc(collection(db, ACTIVE_WORKOUTS_COLLECTION), activeWorkoutData);
    return {
      success: true,
      id: docRef.id,
      activeWorkout: { id: docRef.id, ...activeWorkoutData },
      resumed: false,
    };
  } catch (error) {
    console.error('Error starting workout from exercises:', error);
    return { success: false, error: error.message };
  }
}



/**
 * One-shot read of the user's in-progress session, if any.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getActiveWorkout(userId) {
  if (!userId || !db) return null;

  try {
    const activeRef = collection(db, ACTIVE_WORKOUTS_COLLECTION);
    const activeQuery = query(activeRef, where('userId', '==', userId));
    const snapshot = await getDocs(activeQuery);
    if (snapshot.empty) return null;

    const firstDoc = snapshot.docs[0];
    return { id: firstDoc.id, ...firstDoc.data() };
  } catch (error) {
    console.error('Error getting active workout:', error);
    return null;
  }
}



/**
 * Live listener for the active session. Returns an unsubscribe function.
 * @param {string} userId
 * @param {(row: object|null) => void} callback
 * @returns {() => void}
 */
export function subscribeToActiveWorkout(userId, callback) {
  if (!userId || !db) return () => {};

  try {
    // vocab: onSnapshot = live listener; return value unsubscribes
    const activeRef = collection(db, ACTIVE_WORKOUTS_COLLECTION);
    const activeQuery = query(activeRef, where('userId', '==', userId));

    return onSnapshot(activeQuery, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }
      const firstDoc = snapshot.docs[0];
      callback({ id: firstDoc.id, ...firstDoc.data() });
    });
  } catch (error) {
    console.error('Error subscribing to active workout:', error);
    return () => {};
  }
}



/**
 * Merge progress fields onto the active session doc.
 * @param {string} activeWorkoutId
 * @param {object} updates
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function updateActiveWorkout(activeWorkoutId, updates) {
  if (!activeWorkoutId || !db) {
    return { success: false, error: 'Missing active workout ID' };
  }

  try {
    const activeRef = doc(db, ACTIVE_WORKOUTS_COLLECTION, activeWorkoutId);
    await updateDoc(activeRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating active workout:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Move the active session into history and delete the active row.
 * @param {string} activeWorkoutId
 * @param {number} duration
 * @param {number} [totalVolume=0]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function completeWorkout(activeWorkoutId, duration, totalVolume = 0) {
  if (!activeWorkoutId || !db) {
    return { success: false, error: 'Missing active workout ID' };
  }

  try {
    // 1. Load the active session.
    const activeRef = doc(db, ACTIVE_WORKOUTS_COLLECTION, activeWorkoutId);
    const activeSnap = await getDoc(activeRef);
    if (!activeSnap.exists()) {
      return { success: false, error: 'Active workout not found' };
    }

    const activeWorkout = activeSnap.data();

    // 2. Write a completed history row.
    const completedWorkoutData = {
      userId: activeWorkout.userId,
      workoutId: activeWorkout.workoutId,
      workoutName: activeWorkout.workoutName,
      completedAt: serverTimestamp(),
      duration,
      totalVolume,
      exercises: activeWorkout.exercises,
      completedSets: activeWorkout.completedSets,
    };
    await addDoc(collection(db, COMPLETED_WORKOUTS_COLLECTION), completedWorkoutData);

    // 3. Remove the active session so a new one can start.
    await deleteDoc(activeRef);

    return { success: true };
  } catch (error) {
    console.error('Error completing workout:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Delete the active session without writing history.
 * @param {string} activeWorkoutId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function cancelWorkout(activeWorkoutId) {
  if (!activeWorkoutId || !db) {
    return { success: false, error: 'Missing active workout ID' };
  }

  try {
    const activeRef = doc(db, ACTIVE_WORKOUTS_COLLECTION, activeWorkoutId);
    await deleteDoc(activeRef);
    return { success: true };
  } catch (error) {
    console.error('Error canceling workout:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Completed workouts for this user (newest first), capped by limit.
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<Array>}
 */
export async function fetchWorkoutHistory(userId, limit = DEFAULT_HISTORY_LIMIT) {
  if (!userId || !db) return [];

  try {
    const workouts = await fetchCompletedWorkoutsOrderedOrFallback(userId);
    return workouts.slice(0, limit);
  } catch (error) {
    console.error('Error fetching workout history:', error);
    return [];
  }
}



/**
 * Remove one template doc.
 * @param {string} templateId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteWorkoutTemplate(templateId) {
  if (!templateId || !db) {
    return { success: false, error: 'Missing template ID' };
  }

  try {
    const templateRef = doc(db, WORKOUT_TEMPLATES_COLLECTION, templateId);
    await deleteDoc(templateRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting workout template:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Completed workouts logged today (local midnight → tomorrow).
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getTodaysWorkouts(userId) {
  if (!userId || !db) return [];

  const { todayStart, tomorrowStart } = todayAndTomorrowBounds();

  try {
    return await fetchTodaysWorkoutsOrderedOrFallback(userId, todayStart, tomorrowStart);
  } catch (error) {
    console.error("Error getting today's workouts:", error);
    return [];
  }
}



/**
 * Quick-add a zero-detail completed workout for today.
 * @param {string} userId
 * @param {string} workoutName
 * @returns {Promise<{ success: boolean, id?: string, workout?: object, error?: string }>}
 */
export async function addTodaysWorkout(userId, workoutName) {
  if (!userId || !db || !workoutName) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    const completedWorkoutData = {
      userId,
      workoutName: workoutName.trim(),
      completedAt: serverTimestamp(),
      duration: 0,
      totalVolume: 0,
      exercises: [],
      completedSets: [],
    };

    const docRef = await addDoc(collection(db, COMPLETED_WORKOUTS_COLLECTION), completedWorkoutData);
    const workout = { id: docRef.id, ...completedWorkoutData };
    return { success: true, id: docRef.id, workout };
  } catch (error) {
    console.error("Error adding today's workout:", error);
    return { success: false, error: error.message };
  }
}



/**
 * Delete one completed-workout history row.
 * @param {string} workoutId
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function deleteWorkout(workoutId) {
  if (!workoutId || !db) {
    return { success: false, error: 'Missing workout ID' };
  }

  try {
    const workoutRef = doc(db, COMPLETED_WORKOUTS_COLLECTION, workoutId);
    await deleteDoc(workoutRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting workout:', error);
    return { success: false, error: error.message };
  }
}



/**
 * Save an AI-generated plan into users/{uid}/workoutPlans.
 * @param {string} userId
 * @param {object} planData
 * @param {string} name
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export async function saveGeneratedPlanToCollection(userId, planData, name) {
  if (!userId || !db || !planData) {
    return { success: false, error: 'Missing userId, db, or plan data' };
  }

  try {
    const displayName = resolveWorkoutPlanDisplayTitle(name, planData);
    const structured = planData.structuredPlan || null;

    let goal = '';
    let weeks = DEFAULT_PLAN_WEEKS;
    let daysPerWeek = DEFAULT_DAYS_PER_WEEK;
    let sessionMinutes = DEFAULT_SESSION_MINUTES;
    if (structured) {
      if (structured.goal) goal = structured.goal;
      else if (structured.focus) goal = structured.focus;

      if (structured.weeks) weeks = structured.weeks;
      else if (structured.totalWeeks) weeks = structured.totalWeeks;
      else if (structured.durationWeeks) weeks = structured.durationWeeks;

      if (structured.daysPerWeek) {
        daysPerWeek = structured.daysPerWeek;
      } else if (structured.trainingDays && structured.trainingDays.length) {
        daysPerWeek = structured.trainingDays.length;
      }

      if (structured.sessionMinutes) sessionMinutes = structured.sessionMinutes;
      else if (structured.sessionLength) sessionMinutes = structured.sessionLength;
    }

    const docData = {
      userId,
      name: displayName,
      title: displayName,
      planText: planData.planText || '',
      rawPlan: planData.planText || '',
      structuredPlan: structured,
      goal,
      focus: goal,
      totalWeeks: weeks,
      daysPerWeek,
      sessionMinutes,
      status: 'paused',
      source: 'ai',
      generatedAt: planData.generatedAt || Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // Path letters stay: users/{uid}/workoutPlans (SAVED_WORKOUT_PLANS_COLLECTION is unused path alias)
    const colRef = collection(db, 'users', userId, 'workoutPlans');
    const docRef = await addDoc(colRef, docData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving workout plan to collection:', error);
    return { success: false, error: error.message };
  }
}



/**
 * List saved library plans for this user (newest generatedAt first).
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<Array>}
 */
export async function fetchSavedWorkoutPlans(userId, limit = DEFAULT_HISTORY_LIMIT) {
  if (!userId || !db) return [];

  try {
    const plansRef = collection(db, 'users', userId, 'workoutPlans');
    const orderedQuery = query(plansRef, orderBy('generatedAt', 'desc'));
    const snapshot = await getDocs(orderedQuery);
    return docsFromQuerySnapshot(snapshot).slice(0, limit);
  } catch (error) {
    if (!isFirestoreMissingIndexError(error)) {
      console.error('Error fetching saved workout plans:', error);
      return [];
    }

    const plansRef = collection(db, 'users', userId, 'workoutPlans');
    const snapshot = await getDocs(plansRef);
    const plans = docsFromQuerySnapshot(snapshot);
    plans.sort((left, right) => savedPlanSortMillis(right) - savedPlanSortMillis(left));
    return plans.slice(0, limit);
  }
}

// ===== PLUMBING — skip unless debugging =====

async function fetchCompletedWorkoutsOrdered(userId) {
  // vocab: query / where / orderBy = Firestore filters; getDocs = one-shot read
  const completedRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
  const orderedQuery = query(
    completedRef,
    where('userId', '==', userId),
    orderBy('completedAt', 'desc'),
  );
  const snapshot = await getDocs(orderedQuery);
  return docsFromQuerySnapshot(snapshot);
}

async function fetchCompletedWorkoutsUnorderedThenSort(userId) {
  console.warn(
    '⚠️ Firestore index not found. Fetching without orderBy and sorting in memory. For better performance, create the index at the URL provided in the error.',
  );
  const completedRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
  const simpleQuery = query(completedRef, where('userId', '==', userId));
  const snapshot = await getDocs(simpleQuery);
  return sortWorkoutsNewestFirst(docsFromQuerySnapshot(snapshot));
}

async function fetchCompletedWorkoutsOrderedOrFallback(userId) {
  try {
    return await fetchCompletedWorkoutsOrdered(userId);
  } catch (indexError) {
    if (!isFirestoreMissingIndexError(indexError)) throw indexError;
    return await fetchCompletedWorkoutsUnorderedThenSort(userId);
  }
}

function todayAndTomorrowBounds() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return { todayStart, tomorrowStart };
}

async function fetchTodaysWorkoutsOrdered(userId, todayStart, tomorrowStart) {
  const completedRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
  const rangedQuery = query(
    completedRef,
    where('userId', '==', userId),
    where('completedAt', '>=', todayStart),
    where('completedAt', '<', tomorrowStart),
    orderBy('completedAt', 'desc'),
  );
  const snapshot = await getDocs(rangedQuery);
  return docsFromQuerySnapshot(snapshot);
}

async function fetchTodaysWorkoutsInMemory(userId, todayStart, tomorrowStart) {
  console.warn(
    '⚠️ Firestore index not found for getTodaysWorkouts. Fetching without orderBy and filtering in memory.',
  );
  const completedRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
  const simpleQuery = query(completedRef, where('userId', '==', userId));
  const snapshot = await getDocs(simpleQuery);
  const todays = [];

  snapshot.forEach((snapshotDoc) => {
    const data = snapshotDoc.data();
    const completedAt = stampToDate(data.completedAt);
    if (completedAt >= todayStart && completedAt < tomorrowStart) {
      todays.push({ id: snapshotDoc.id, ...data });
    }
  });

  return sortWorkoutsNewestFirst(todays);
}

async function fetchTodaysWorkoutsOrderedOrFallback(userId, todayStart, tomorrowStart) {
  try {
    return await fetchTodaysWorkoutsOrdered(userId, todayStart, tomorrowStart);
  } catch (indexError) {
    if (!isFirestoreMissingIndexError(indexError)) throw indexError;
    return await fetchTodaysWorkoutsInMemory(userId, todayStart, tomorrowStart);
  }
}
