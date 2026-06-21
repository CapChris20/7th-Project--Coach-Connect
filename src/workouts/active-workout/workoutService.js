/**
 * workout Service
 *
 * Purpose: Data/service layer: workout Service. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/workouts
 * Key exports: getCurrentWorkoutPlan, setCurrentWorkoutPlan, createWorkoutTemplate, fetchWorkoutTemplates, getWorkoutTemplate, startWorkout, getActiveWorkout, subscribeToActiveWorkout
 *
 * @file-header
 */
import { db } from '../../app-start/config';
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

// Firestore Collections
const WORKOUT_TEMPLATES_COLLECTION = 'workoutTemplates';
const ACTIVE_WORKOUTS_COLLECTION = 'activeWorkouts';
const COMPLETED_WORKOUTS_COLLECTION = 'completedWorkouts';
const SAVED_WORKOUT_PLANS_COLLECTION = 'savedWorkoutPlans';

/** Single doc path for current workout plan: users/{uid}/workoutPlan */
export async function getCurrentWorkoutPlan(userId) {
  if (!userId || !db) return null;
  try {
    const ref = doc(db, 'users', userId, 'workoutPlan', 'current');
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    if (e?.code !== 'permission-denied') console.error('getCurrentWorkoutPlan:', e);
    return null;
  }
}

/** Write current plan to Firestore. Overwrites existing; mirrors into workoutPlans for library. */
export async function setCurrentWorkoutPlan(userId, { rawPlan, generatedAt, structuredPlan, planText, title }) {
  if (!userId || !db || rawPlan == null) return;
  const text = String(planText || rawPlan);
  const when = generatedAt || serverTimestamp();
  const displayTitle =
    title ||
    `Workout plan · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  try {
    const ref = doc(db, 'users', userId, 'workoutPlan', 'current');
    await setDoc(
      ref,
      {
        rawPlan: String(rawPlan),
        planText: text,
        title: displayTitle,
        name: displayTitle,
        structuredPlan: structuredPlan || null,
        generatedAt: when,
        updatedAt: serverTimestamp(),
        source: 'generator',
        status: 'active',
      },
      { merge: true },
    );

    // Stable library doc so trainers + collection queries always see the latest client plan
    const libraryRef = doc(db, 'users', userId, 'workoutPlans', 'current');
    await setDoc(
      libraryRef,
      {
        userId,
        rawPlan: String(rawPlan),
        planText: text,
        title: displayTitle,
        name: displayTitle,
        structuredPlan: structuredPlan || null,
        generatedAt: when,
        updatedAt: serverTimestamp(),
        source: 'generator',
        status: 'active',
      },
      { merge: true },
    );
  } catch (e) {
    if (e?.code !== 'permission-denied') console.error('setCurrentWorkoutPlan:', e);
  }
}

/**
 * Create a new workout template
 * @param {string} userId - User ID
 * @param {string} name - Workout name
 * @param {string} goal - Workout goal (e.g., "strength", "cardio", "hypertrophy")
 * @param {Array} exercises - Array of exercise objects with {exerciseId, sets, reps, restSeconds}
 * @returns {Promise<Object>} Result with template ID
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
      exercises: exercises.map(ex => ({
        exerciseId: ex.exerciseId,
        sets: parseInt(ex.sets) || 3,
        reps: parseInt(ex.reps) || 10,
        restSeconds: parseInt(ex.restSeconds) || 60,
      })),
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
 * Fetch all workout templates for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of workout templates
 */
export async function fetchWorkoutTemplates(userId) {
  if (!userId || !db) return [];

  try {
    const templatesRef = collection(db, WORKOUT_TEMPLATES_COLLECTION);
    const q = query(
      templatesRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const templates = [];
    querySnapshot.forEach((doc) => {
      templates.push({ id: doc.id, ...doc.data() });
    });

    return templates;
  } catch (error) {
    console.error('Error fetching workout templates:', error);
    return [];
  }
}

/**
 * Get a single workout template by ID
 * @param {string} templateId - Template ID
 * @returns {Promise<Object|null>} Template object or null
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
 * Start a new active workout from a template
 * @param {string} userId - User ID
 * @param {string} workoutId - Workout template ID
 * @returns {Promise<Object>} Result with active workout ID
 */
export async function startWorkout(userId, workoutId) {
  if (!userId || !db || !workoutId) {
    return { success: false, error: 'Missing required fields' };
  }

  try {
    // Get the template
    const template = await getWorkoutTemplate(workoutId);
    if (!template) {
      return { success: false, error: 'Workout template not found' };
    }

    // Check if user has an active workout
    const activeWorkout = await getActiveWorkout(userId);
    if (activeWorkout) {
      return { success: false, error: 'You already have an active workout. Please complete or cancel it first.' };
    }

    const activeWorkoutData = {
      userId,
      workoutId,
      workoutName: template.name,
      startedAt: serverTimestamp(),
      currentExerciseIndex: 0,
      completedSets: template.exercises.map(() => []), // Array of arrays, one per exercise
      exercises: template.exercises,
    };

    const docRef = await addDoc(collection(db, ACTIVE_WORKOUTS_COLLECTION), activeWorkoutData);
    return { success: true, id: docRef.id, activeWorkout: { id: docRef.id, ...activeWorkoutData } };
  } catch (error) {
    console.error('Error starting workout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get the current active workout for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Active workout or null
 */
export async function getActiveWorkout(userId) {
  if (!userId || !db) return null;

  try {
    const activeWorkoutsRef = collection(db, ACTIVE_WORKOUTS_COLLECTION);
    const q = query(
      activeWorkoutsRef,
      where('userId', '==', userId)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;

    // Should only be one active workout per user
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    console.error('Error getting active workout:', error);
    return null;
  }
}

/**
 * Subscribe to active workout changes (real-time)
 * @param {string} userId - User ID
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribeToActiveWorkout(userId, callback) {
  if (!userId || !db) return () => {};

  try {
    const activeWorkoutsRef = collection(db, ACTIVE_WORKOUTS_COLLECTION);
    const q = query(
      activeWorkoutsRef,
      where('userId', '==', userId)
    );

    return onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        callback(null);
        return;
      }
      const doc = snapshot.docs[0];
      callback({ id: doc.id, ...doc.data() });
    });
  } catch (error) {
    console.error('Error subscribing to active workout:', error);
    return () => {};
  }
}

/**
 * Update active workout (sets, exercise index, etc.)
 * @param {string} activeWorkoutId - Active workout ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Result object
 */
export async function updateActiveWorkout(activeWorkoutId, updates) {
  if (!activeWorkoutId || !db) {
    return { success: false, error: 'Missing active workout ID' };
  }

  try {
    const activeWorkoutRef = doc(db, ACTIVE_WORKOUTS_COLLECTION, activeWorkoutId);
    await updateDoc(activeWorkoutRef, {
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
 * Complete a workout and save to history
 * @param {string} activeWorkoutId - Active workout ID
 * @param {number} duration - Duration in seconds
 * @param {number} totalVolume - Total volume (weight × reps × sets)
 * @returns {Promise<Object>} Result object
 */
export async function completeWorkout(activeWorkoutId, duration, totalVolume = 0) {
  if (!activeWorkoutId || !db) {
    return { success: false, error: 'Missing active workout ID' };
  }

  try {
    // Get active workout data
    const activeWorkoutRef = doc(db, ACTIVE_WORKOUTS_COLLECTION, activeWorkoutId);
    const activeWorkoutSnap = await getDoc(activeWorkoutRef);
    
    if (!activeWorkoutSnap.exists()) {
      return { success: false, error: 'Active workout not found' };
    }

    const activeWorkout = activeWorkoutSnap.data();

    // Create completed workout
    const completedWorkoutData = {
      userId: activeWorkout.userId,
      workoutId: activeWorkout.workoutId,
      workoutName: activeWorkout.workoutName,
      completedAt: serverTimestamp(),
      duration, // in seconds
      totalVolume,
      exercises: activeWorkout.exercises,
      completedSets: activeWorkout.completedSets,
    };

    await addDoc(collection(db, COMPLETED_WORKOUTS_COLLECTION), completedWorkoutData);

    // Delete active workout
    await deleteDoc(activeWorkoutRef);

    return { success: true };
  } catch (error) {
    console.error('Error completing workout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cancel/delete an active workout
 * @param {string} activeWorkoutId - Active workout ID
 * @returns {Promise<Object>} Result object
 */
export async function cancelWorkout(activeWorkoutId) {
  if (!activeWorkoutId || !db) {
    return { success: false, error: 'Missing active workout ID' };
  }

  try {
    const activeWorkoutRef = doc(db, ACTIVE_WORKOUTS_COLLECTION, activeWorkoutId);
    await deleteDoc(activeWorkoutRef);
    return { success: true };
  } catch (error) {
    console.error('Error canceling workout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch workout history for a user
 * @param {string} userId - User ID
 * @param {number} limit - Maximum number of workouts to fetch
 * @returns {Promise<Array>} Array of completed workouts
 */
export async function fetchWorkoutHistory(userId, limit = 50) {
  if (!userId || !db) return [];

  try {
    const completedWorkoutsRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
    
    // Try query with orderBy first (requires index)
    try {
      const q = query(
        completedWorkoutsRef,
        where('userId', '==', userId),
        orderBy('completedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const workouts = [];
      querySnapshot.forEach((doc) => {
        workouts.push({ id: doc.id, ...doc.data() });
      });

      return workouts.slice(0, limit);
    } catch (indexError) {
      // If index error, fall back to query without orderBy and sort in memory
      if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
        console.warn('⚠️ Firestore index not found. Fetching without orderBy and sorting in memory. For better performance, create the index at the URL provided in the error.');
        
        const q = query(
          completedWorkoutsRef,
          where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        const workouts = [];
        querySnapshot.forEach((doc) => {
          workouts.push({ id: doc.id, ...doc.data() });
        });

        // Sort by completedAt in memory (descending - most recent first)
        workouts.sort((a, b) => {
          const aTime = a.completedAt?.toDate?.() || new Date(a.completedAt || 0);
          const bTime = b.completedAt?.toDate?.() || new Date(b.completedAt || 0);
          return bTime.getTime() - aTime.getTime(); // Descending order
        });

        return workouts.slice(0, limit);
      } else {
        // Re-throw if it's a different error
        throw indexError;
      }
    }
  } catch (error) {
    console.error('Error fetching workout history:', error);
    // Return empty array on error to prevent app crash
    return [];
  }
}

/**
 * Delete a workout template
 * @param {string} templateId - Template ID
 * @returns {Promise<Object>} Result object
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
 * Get today's workouts for a user (from completed workouts)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of today's completed workouts
 */
export async function getTodaysWorkouts(userId) {
  if (!userId || !db) return [];

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const completedWorkoutsRef = collection(db, COMPLETED_WORKOUTS_COLLECTION);
    
    // Try query with orderBy first (requires index)
    try {
      const q = query(
        completedWorkoutsRef,
        where('userId', '==', userId),
        where('completedAt', '>=', today),
        where('completedAt', '<', tomorrow),
        orderBy('completedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      const workouts = [];
      querySnapshot.forEach((doc) => {
        workouts.push({ id: doc.id, ...doc.data() });
      });

      return workouts;
    } catch (indexError) {
      // If index error, fall back to query without orderBy and filter in memory
      if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
        console.warn('⚠️ Firestore index not found for getTodaysWorkouts. Fetching without orderBy and filtering in memory.');
        
        const q = query(
          completedWorkoutsRef,
          where('userId', '==', userId)
        );

        const querySnapshot = await getDocs(q);
        const workouts = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const completedAt = data.completedAt?.toDate?.() || new Date(data.completedAt || 0);
          
          // Filter for today's workouts in memory
          if (completedAt >= today && completedAt < tomorrow) {
            workouts.push({ id: doc.id, ...data });
          }
        });

        // Sort by completedAt descending
        workouts.sort((a, b) => {
          const aTime = a.completedAt?.toDate?.() || new Date(a.completedAt || 0);
          const bTime = b.completedAt?.toDate?.() || new Date(b.completedAt || 0);
          return bTime.getTime() - aTime.getTime();
        });

        return workouts;
      } else {
        // Re-throw if it's a different error
        throw indexError;
      }
    }
  } catch (error) {
    console.error('Error getting today\'s workouts:', error);
    // Return empty array on error to prevent app crash
    return [];
  }
}

/**
 * Add a workout for today (creates a completed workout entry)
 * @param {string} userId - User ID
 * @param {string} workoutName - Name of the workout
 * @returns {Promise<Object>} Result object with workout data
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
    console.error('Error adding today\'s workout:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a completed workout
 * @param {string} workoutId - Completed workout ID
 * @returns {Promise<Object>} Result object
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
 * Save a generated AI workout plan to the user's workout collection (saved plans)
 * @param {string} userId - User ID
 * @param {Object} planData - Plan object with planText, structuredPlan, etc.
 * @param {string} [name] - Optional display name (default: "AI Plan – [date]")
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
export async function saveGeneratedPlanToCollection(userId, planData, name) {
  if (!userId || !db || !planData) {
    return { success: false, error: 'Missing userId, db, or plan data' };
  }

  try {
    const displayName = name || `AI Plan – ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;

    const structured = planData.structuredPlan || null;
    const goal = structured?.goal || structured?.focus || '';
    const weeks = structured?.weeks || structured?.totalWeeks || structured?.durationWeeks || 8;
    const daysPerWeek = structured?.daysPerWeek || structured?.trainingDays?.length || 3;
    const sessionMinutes = structured?.sessionMinutes || structured?.sessionLength || 45;

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

    const colRef = collection(db, 'users', userId, 'workoutPlans');
    const docRef = await addDoc(colRef, docData);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error saving workout plan to collection:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch saved workout plans for a user
 * @param {string} userId - User ID
 * @param {number} limit - Max number to return
 * @returns {Promise<Array>} Array of saved plans
 */
export async function fetchSavedWorkoutPlans(userId, limit = 50) {
  if (!userId || !db) return [];

  try {
    const ref = collection(db, 'users', userId, 'workoutPlans');
    const q = query(ref, orderBy('generatedAt', 'desc'));
    const snapshot = await getDocs(q);
    const plans = [];
    snapshot.forEach((d) => {
      plans.push({ id: d.id, ...d.data() });
    });
    return plans.slice(0, limit);
  } catch (e) {
    if (e.code === 'failed-precondition' || (e.message && e.message.includes('index'))) {
      const ref = collection(db, 'users', userId, 'workoutPlans');
      const snapshot = await getDocs(ref);
      const plans = [];
      snapshot.forEach((d) => {
        plans.push({ id: d.id, ...d.data() });
      });
      plans.sort((a, b) => {
        const at = a.createdAt?.toDate?.()?.getTime() ?? a.generatedAt ?? 0;
        const bt = b.createdAt?.toDate?.()?.getTime() ?? b.generatedAt ?? 0;
        return bt - at;
      });
      return plans.slice(0, limit);
    }
    console.error('Error fetching saved workout plans:', e);
    return [];
  }
}




