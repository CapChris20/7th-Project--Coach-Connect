// Firestore service for workout plans, templates, active sessions, and history.
// Flow: read/write current plan → templates → start/complete active workout → history / saved plans.
// Used by: CreateWorkoutPlanScreen, ClientAppStart, home loader, exercise-library saved plans.
// Key exports: getCurrentWorkoutPlan, setCurrentWorkoutPlan, createWorkoutTemplate,
//   fetchWorkoutTemplates, getWorkoutTemplate, startWorkout, getActiveWorkout,
//   subscribeToActiveWorkout, and the history / saved-plan helpers below.

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

// Manipulate here: how many history / saved-plan rows to return when caller omits limit
const DEFAULT_HISTORY_LIMIT = 50;

// Manipulate here: AI plan defaults when structuredPlan lacks weeks / days / session length
const DEFAULT_PLAN_WEEKS = 8;
const DEFAULT_DAYS_PER_WEEK = 3;
const DEFAULT_SESSION_MINUTES = 45;

const FIRESTORE_PERMISSION_DENIED = 'permission-denied';
const FIRESTORE_FAILED_PRECONDITION = 'failed-precondition';

// ===== HELPER FUNCTIONS =====

/**
 * Pick a display title: keep a real custom name, otherwise invent one from the plan.
 * @param {string|undefined} title
 * @param {object} namingInput
 * @returns {string}
 */
function resolveWorkoutPlanDisplayTitle(title, namingInput) {
  if (title && String(title).trim() && !looksLikeDefaultAiPlanName(title)) {
    return String(title).trim();
  }
  return nameWorkoutPlan(namingInput);
}

/**
 * True when Firestore says we need a composite index (or the message mentions index).
 * @param {Error} error
 * @returns {boolean}
 */
function isFirestoreMissingIndexError(error) {
  return (
    error?.code === FIRESTORE_FAILED_PRECONDITION ||
    (error?.message && error.message.includes('index'))
  );
}

/**
 * Map a Firestore query snapshot into [{ id, ...fields }, …].
 * @param {import('firebase/firestore').QuerySnapshot} snapshot
 * @returns {Array}
 */
function docsFromQuerySnapshot(snapshot) {
  const rows = [];
  snapshot.forEach((snapshotDoc) => {
    rows.push({ id: snapshotDoc.id, ...snapshotDoc.data() });
  });
  return rows;
}

/**
 * Timestamp millis from a completed-workout row (Firestore Timestamp or number).
 * @param {object} workout
 * @returns {number}
 */
function completedAtMillis(workout) {
  const stamp = workout.completedAt?.toDate?.() || new Date(workout.completedAt || 0);
  return stamp.getTime();
}

/**
 * Sort completed workouts newest-first by completedAt.
 * @param {Array} workouts
 * @returns {Array}
 */
function sortWorkoutsNewestFirst(workouts) {
  workouts.sort((left, right) => completedAtMillis(right) - completedAtMillis(left));
  return workouts;
}

/**
 * Fetch completed workouts ordered by completedAt (needs composite index).
 * @param {string} userId
 * @returns {Promise<Array>}
 */
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

/**
 * Fallback when the completedAt index is missing — filter/sort in memory.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function fetchCompletedWorkoutsUnorderedThenSort(userId) {
  console.warn(
    '⚠️ Firestore index not found. Fetching without orderBy and sorting in memory. For better performance, create the index at the URL provided in the error.',
  );
  const completedRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
  const simpleQuery = query(completedRef, where('userId', '==', userId));
  const snapshot = await getDocs(simpleQuery);
  return sortWorkoutsNewestFirst(docsFromQuerySnapshot(snapshot));
}

/**
 * Ordered history, or in-memory sort when the composite index is missing.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
async function fetchCompletedWorkoutsOrderedOrFallback(userId) {
  try {
    return await fetchCompletedWorkoutsOrdered(userId);
  } catch (indexError) {
    if (!isFirestoreMissingIndexError(indexError)) throw indexError;
    return await fetchCompletedWorkoutsUnorderedThenSort(userId);
  }
}

/**
 * Start-of-today and start-of-tomorrow Date bounds for "today's workouts".
 * @returns {{ todayStart: Date, tomorrowStart: Date }}
 */
function todayAndTomorrowBounds() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  return { todayStart, tomorrowStart };
}

/**
 * Fetch today's completed workouts with a ranged Firestore query (needs index).
 * @param {string} userId
 * @param {Date} todayStart
 * @param {Date} tomorrowStart
 * @returns {Promise<Array>}
 */
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

/**
 * Fallback: load all user completions, keep only today's, sort newest first.
 * @param {string} userId
 * @param {Date} todayStart
 * @param {Date} tomorrowStart
 * @returns {Promise<Array>}
 */
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
    const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt || 0);
    if (completedAt >= todayStart && completedAt < tomorrowStart) {
      todays.push({ id: snapshotDoc.id, ...data });
    }
  });

  return sortWorkoutsNewestFirst(todays);
}

/**
 * Today's workouts via ranged query, or in-memory filter when the index is missing.
 * @param {string} userId
 * @param {Date} todayStart
 * @param {Date} tomorrowStart
 * @returns {Promise<Array>}
 */
async function fetchTodaysWorkoutsOrderedOrFallback(userId, todayStart, tomorrowStart) {
  try {
    return await fetchTodaysWorkoutsOrdered(userId, todayStart, tomorrowStart);
  } catch (indexError) {
    if (!isFirestoreMissingIndexError(indexError)) throw indexError;
    return await fetchTodaysWorkoutsInMemory(userId, todayStart, tomorrowStart);
  }
}

/**
 * Saved-plan sort key: createdAt Timestamp, else generatedAt number.
 * @param {object} plan
 * @returns {number}
 */
function savedPlanSortMillis(plan) {
  // vocab/symbol: ?? = use right side only when left is null/undefined (0 generatedAt survives)
  return plan.createdAt?.toDate?.()?.getTime() ?? plan.generatedAt ?? 0;
}

/**
 * Map a template exercise into the stored sets/reps/rest shape.
 * @param {object} exercise
 * @returns {object}
 */
function normalizeTemplateExercise(exercise) {
  return {
    exerciseId: exercise.exerciseId,
    sets: parseInt(exercise.sets) || DEFAULT_TEMPLATE_SETS,
    reps: parseInt(exercise.reps) || DEFAULT_TEMPLATE_REPS,
    restSeconds: parseInt(exercise.restSeconds) || DEFAULT_REST_SECONDS,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Read the single current workout plan doc: users/{uid}/workoutPlan/current.
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function getCurrentWorkoutPlan(userId) {
  if (!userId || !db) return null;

  try {
    // vocab: doc / getDoc = one Firestore document path + one-shot read
    const planRef = doc(db, 'users', userId, 'workoutPlan', 'current');
    const snapshot = await getDoc(planRef);
    return snapshot.exists() ? snapshot.data() : null;
  } catch (error) {
    if (error?.code !== FIRESTORE_PERMISSION_DENIED) {
      console.error('getCurrentWorkoutPlan:', error);
    }
    return null;
  }
}

/**
 * Write the current plan to Firestore. Overwrites existing; mirrors into workoutPlans library.
 * @param {string} userId
 * @param {{ rawPlan: *, generatedAt?: *, structuredPlan?: *, planText?: string, title?: string }} planFields
 * @returns {Promise<void>}
 */
export async function setCurrentWorkoutPlan(
  userId,
  { rawPlan, generatedAt, structuredPlan, planText, title },
) {
  if (!userId || !db || rawPlan == null) return;

  const text = String(planText || rawPlan);
  // vocab: serverTimestamp = Firestore fills the write time on the server
  const when = generatedAt || serverTimestamp();
  const displayTitle = resolveWorkoutPlanDisplayTitle(title, {
    structuredPlan: structuredPlan || null,
    planText: text,
    generatedAt: typeof generatedAt === 'number' ? generatedAt : Date.now(),
  });

  const planBody = {
    rawPlan: String(rawPlan),
    planText: text,
    title: displayTitle,
    name: displayTitle,
    structuredPlan: structuredPlan || null,
    generatedAt: when,
    updatedAt: serverTimestamp(),
    source: 'generator',
    status: 'active',
  };

  try {
    // 1. Active plan doc trainers / client home read as "the" plan.
    const currentRef = doc(db, 'users', userId, 'workoutPlan', 'current');
    await setDoc(currentRef, planBody, { merge: true });

    // 2. Stable library doc so collection queries always see the latest client plan.
    const libraryRef = doc(db, 'users', userId, 'workoutPlans', 'current');
    await setDoc(libraryRef, { userId, ...planBody }, { merge: true });
  } catch (error) {
    if (error?.code !== FIRESTORE_PERMISSION_DENIED) {
      console.error('setCurrentWorkoutPlan:', error);
    }
  }
}

/**
 * Create a new workout template row in workoutTemplates.
 * @param {string} userId
 * @param {string} name
 * @param {string} goal
 * @param {Array} exercises
 * @returns {Promise<{success: boolean, id?: string, template?: object, error?: string}>}
 */
export async function createWorkoutTemplate(userId, name, goal, exercises) {
  if (!userId || !db || !name || !exercises || exercises.length === 0) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    const templateData = {
      userId,
      name: name.trim(),
      goal: goal || 'general',
      exercises: exercises.map(normalizeTemplateExercise),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, WORKOUT_TEMPLATES_COLLECTION), templateData);
    return { success: true, id: docRef.id, template: { id: docRef.id, ...templateData } };
  } catch (error) {
    console.error('Error creating workout template:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch all workout templates for a user (newest createdAt first).
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
 * Get a single workout template by ID.
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
 * Start a new active workout from a template (fails if one is already active).
 * @param {string} userId
 * @param {string} workoutId
 * @returns {Promise<{success: boolean, id?: string, activeWorkout?: object, error?: string}>}
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
    const activeWorkoutData = {
      userId,
      workoutId,
      workoutName: template.name,
      startedAt: serverTimestamp(),
      currentExerciseIndex: 0,
      completedSets: template.exercises.map(() => []),
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
 * Get the current active workout for a user (at most one).
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
 * Subscribe to active workout changes (real-time). Returns unsubscribe.
 * @param {string} userId
 * @param {Function} callback
 * @returns {Function}
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
 * Update active workout fields (sets, exercise index, etc.).
 * @param {string} activeWorkoutId
 * @param {object} updates
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * Complete a workout: copy to history, then delete the active row.
 * @param {string} activeWorkoutId
 * @param {number} duration - Duration in seconds
 * @param {number} totalVolume - Total volume (weight × reps × sets)
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * Cancel / delete an active workout without saving history.
 * @param {string} activeWorkoutId
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * Fetch workout history for a user (newest first). Falls back if index is missing.
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
 * Delete a workout template by ID.
 * @param {string} templateId
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * Get today's completed workouts for a user.
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
 * Add a lightweight "done today" completed-workout entry (name only).
 * @param {string} userId
 * @param {string} workoutName
 * @returns {Promise<{success: boolean, id?: string, workout?: object, error?: string}>}
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
 * Delete a completed workout history row.
 * @param {string} workoutId
 * @returns {Promise<{success: boolean, error?: string}>}
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
 * Save a generated AI workout plan into users/{uid}/workoutPlans.
 * @param {string} userId
 * @param {object} planData
 * @param {string} [name]
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export async function saveGeneratedPlanToCollection(userId, planData, name) {
  if (!userId || !db || !planData) {
    return { success: false, error: 'Missing userId, db, or plan data' };
  }

  try {
    const displayName = resolveWorkoutPlanDisplayTitle(name, planData);
    const structured = planData.structuredPlan || null;
    const goal = structured?.goal || structured?.focus || '';
    const weeks =
      structured?.weeks || structured?.totalWeeks || structured?.durationWeeks || DEFAULT_PLAN_WEEKS;
    const daysPerWeek =
      structured?.daysPerWeek || structured?.trainingDays?.length || DEFAULT_DAYS_PER_WEEK;
    const sessionMinutes =
      structured?.sessionMinutes || structured?.sessionLength || DEFAULT_SESSION_MINUTES;

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
 * Fetch saved workout plans for a user (newest generatedAt first).
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
