// First load of the client home screen: profile, goals, today's food, and workouts.
// Flow: user doc → calorie goal doc → today's metrics → food log → macro goals →
//       workout history → active workout. Each step has its own timeout so one slow
//       read cannot leave the spinner up forever.
// Used by ClientAppStart. The setters are owned by that screen; this file only fills them.

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
// vocab: doc/getDoc = one Firestore document read. This is not a live listener.
import { doc, getDoc } from 'firebase/firestore';
import { getLocalDateKey } from '../../helpers/getLocalDay';
import { loadCachedOnboardingProfile, fillTraineeProfile } from '../../helpers/fillTraineeProfile';
import { parseDailyMetricsFromSnapshots } from '../../daily-stats/saveDailyStats';
import { calculateMacroTotals, getDailyGoals, getFoodLogsForDate } from '../../nutrition/daily-log/saveLoggedFood';
import { fetchWorkoutHistory, getActiveWorkout } from '../../workouts/create-plan/saveAndLoadWorkoutPlan';
import { calculateStreak } from './homeScreenPieces';

// ===== NAMED CONSTANTS =====

// Manipulate here: the spinner is forced off after this even if a read is still hanging.
const LOADING_SAFETY_MS = 10000;
const USER_DOC_TIMEOUT_MS = 8000;
const NUTRITION_GOALS_DOC_TIMEOUT_MS = 5000;
const DAILY_METRICS_TIMEOUT_MS = 5000;
const NUTRITION_LOGS_TIMEOUT_MS = 6000;
const WORKOUT_HISTORY_TIMEOUT_MS = 6000;
// Manipulate here: calorie goal used only when there is no user doc and no cached target.
const DEFAULT_CALORIE_GOAL = 2000;
const DEFAULT_PROTEIN_TARGET = 150;
const DEFAULT_CARBS_TARGET = 220;
const DEFAULT_FAT_TARGET = 70;
const WORKOUT_HISTORY_LIMIT = 20;

const USERS_COLLECTION = 'users';
const NUTRITION_GOALS_COLLECTION = 'nutrition_goals';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const LEGACY_DAILY_TRACKING_COLLECTION = 'daily_tracking';

const ACTIVE_WORKOUT_NAME = 'Active Workout';

// ===== HELPER FUNCTIONS =====

/**
 * Lose the race when Firestore is slow. The label is the error message the catch logs.
 * @param {number} milliseconds
 * @param {string} message
 * @returns {Promise<never>}
 */
function rejectAfter(milliseconds, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), milliseconds);
  });
}

/**
 * A stand-in snapshot so the rest of the load can call exists() without crashing.
 * @returns {{ exists: Function, data: Function }}
 */
function missingUserDocument() {
  return {
    exists: () => false,
    data: () => null,
  };
}

/**
 * @param {number} startTime
 * @returns {number}
 */
function millisecondsSince(startTime) {
  return Date.now() - startTime;
}

/**
 * User profile, with an 8s cap. A failure becomes an empty snapshot so the home screen
 * still renders defaults instead of spinning.
 * @param {object} database
 * @param {object} user
 * @param {number} startTime
 * @returns {Promise<object>}
 */
async function fetchUserDocument(database, user, startTime) {
  console.log(`👤 Fetching user data... (${millisecondsSince(startTime)}ms)`);
  console.log(`🔍 Firebase check - db exists: ${!!database}, user.uid: ${user?.uid}`);
  try {
    const userRef = doc(database, USERS_COLLECTION, user.uid);
    console.log(`📍 User ref path: ${userRef.path}`);
    const userDoc = await Promise.race([
      getDoc(userRef),
      rejectAfter(USER_DOC_TIMEOUT_MS, 'User data timeout'),
    ]);
    console.log(`✅ User data fetched in ${Date.now() - startTime}ms`);
    return userDoc;
  } catch (error) {
    console.error(`❌ User data fetch failed: ${error.message}`);
    console.error('🔍 Error details:', {
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack?.substring(0, 200),
      dbExists: !!database,
      userUid: user?.uid,
      timestamp: new Date().toISOString(),
    });
    return missingUserDocument();
  }
}

/**
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function readCachedProfile(userId) {
  try {
    return await loadCachedOnboardingProfile(userId, AsyncStorage);
  } catch (ignoredError) {
    return null;
  }
}

/**
 * The user doc exists. Cached onboarding fills any fields the doc is missing.
 * @param {object} user
 * @param {object} userDoc
 * @param {number} startTime
 * @param {object} setters
 */
async function applyFoundUserProfile(user, userDoc, startTime, setters) {
  const userDocData = userDoc.data();
  const cachedProfile = await readCachedProfile(user.uid);
  const mergedProfile = fillTraineeProfile(cachedProfile, userDocData);
  setters.setOnboardingData(mergedProfile);
  setters.setUserWeight(mergedProfile.weight);
  setters.setGoalProgress(typeof mergedProfile.goalProgress === 'number' ? mergedProfile.goalProgress : null);

  const storedCalories =
    mergedProfile.calorieTarget ?? mergedProfile.calorie_target ?? mergedProfile.nutrition?.calories;
  if (typeof storedCalories === 'number' && storedCalories > 0) {
    setters.setCalorieGoal(Math.round(storedCalories));
  }
  console.log(`✅ User data processed (${millisecondsSince(startTime)}ms)`);
}

/**
 * No user doc. Still merge the on-device cache, and only then fall back to 2000 calories.
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyMissingUserProfile(user, startTime, setters) {
  console.log(`⚠️ No user data found, using defaults (${millisecondsSince(startTime)}ms)`);
  const cachedProfile = await readCachedProfile(user.uid);
  const mergedProfile = fillTraineeProfile(cachedProfile);
  setters.setOnboardingData(mergedProfile);
  if (mergedProfile?.weight != null) setters.setUserWeight(mergedProfile.weight);
  setters.setGoalProgress(
    typeof mergedProfile?.goalProgress === 'number' ? mergedProfile.goalProgress : null,
  );
  const hasCalorieTarget = typeof mergedProfile?.calorieTarget === 'number' && mergedProfile.calorieTarget > 0;
  if (!hasCalorieTarget) setters.setCalorieGoal(DEFAULT_CALORIE_GOAL);
}

/**
 * nutrition_goals doc can override the calorie number that came off the user profile.
 * @param {object} database
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyNutritionGoalsDocument(database, user, startTime, setters) {
  console.log(`🥗 Fetching nutrition goals... (${millisecondsSince(startTime)}ms)`);
  try {
    const goalsDoc = await Promise.race([
      getDoc(doc(database, NUTRITION_GOALS_COLLECTION, user.uid)),
      rejectAfter(NUTRITION_GOALS_DOC_TIMEOUT_MS, 'Nutrition goals timeout'),
    ]);
    if (!goalsDoc.exists()) return;
    const goalsData = goalsDoc.data();
    const goalCalories =
      typeof goalsData?.calorie_target === 'number'
        ? goalsData.calorie_target
        : typeof goalsData?.calories === 'number'
          ? goalsData.calories
          : null;
    if (goalCalories != null && goalCalories > 0) {
      setters.setCalorieGoal(Math.round(goalCalories));
    }
    console.log(`✅ Nutrition goals processed (${millisecondsSince(startTime)}ms)`);
  } catch (ignoredError) {
    console.log('⚠️ Nutrition goals failed, continuing...');
  }
}

/**
 * Today's water, sleep, and ratings. dailyLogs wins; daily_tracking is the old copy.
 * A tracking timeout becomes an empty snapshot so the logs read can still apply.
 * @param {object} database
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyDailyMetrics(database, user, startTime, setters) {
  console.log(`📊 Fetching daily metrics... (${millisecondsSince(startTime)}ms)`);
  try {
    const todayKey = getLocalDateKey();
    const timeout = (label) => rejectAfter(DAILY_METRICS_TIMEOUT_MS, `${label} timeout`);
    const [logsDoc, trackingDoc] = await Promise.all([
      Promise.race([
        getDoc(doc(database, USERS_COLLECTION, user.uid, DAILY_LOGS_COLLECTION, todayKey)),
        timeout('Daily logs'),
      ]),
      // TODO(phase-5): remove legacy daily_tracking read after backfill
      Promise.race([
        getDoc(doc(database, USERS_COLLECTION, user.uid, LEGACY_DAILY_TRACKING_COLLECTION, todayKey)),
        timeout('Daily tracking'),
      ]).catch(() => ({ exists: () => false })),
    ]);
    const parsed = parseDailyMetricsFromSnapshots(logsDoc, trackingDoc);
    setters.setWaterIntake(parsed.waterIntake);
    setters.setSleepHours(parsed.sleepHours);
    setters.setSoreness(parsed.soreness);
    setters.setEnergyLevel(parsed.energyLevel);
    setters.setStressLevel(parsed.stressLevel);
    setters.setDashboardWorkoutSummary(parsed.dashboardWorkoutSummary);
    setters.setTodayWorkout(parsed.todayWorkout);
    console.log(`✅ Daily metrics processed (${millisecondsSince(startTime)}ms)`);
  } catch (ignoredError) {
    console.log('⚠️ Daily metrics failed, continuing...');
  }
}

/**
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyNutritionLogs(user, startTime, setters) {
  console.log(`🍎 Fetching nutrition logs... (${millisecondsSince(startTime)}ms)`);
  try {
    const nutritionLogs = await Promise.race([
      getFoodLogsForDate(user.uid, getLocalDateKey()),
      rejectAfter(NUTRITION_LOGS_TIMEOUT_MS, 'Nutrition logs timeout'),
    ]);
    const totals = calculateMacroTotals(nutritionLogs);
    setters.setCaloriesConsumed(totals.calories || 0);
    // The food service calls the field fat. The home screen state calls it fats.
    setters.setMacroTotals({
      protein: totals.protein || 0,
      carbs: totals.carbs || 0,
      fats: totals.fat || 0,
    });
    console.log(`✅ Nutrition logs processed (${millisecondsSince(startTime)}ms)`);
    console.log(`🍎 Macro totals - Protein: ${totals.protein}g, Carbs: ${totals.carbs}g, Fat: ${totals.fat}g`);
  } catch (ignoredError) {
    console.log('⚠️ Nutrition logs failed, continuing...');
  }
}

/**
 * Full macro targets for the progress rings. Separate from the calorie-only doc read above.
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyNutritionGoalTargets(user, startTime, setters) {
  console.log(`🎯 Fetching nutrition goals... (${millisecondsSince(startTime)}ms)`);
  try {
    const goals = await getDailyGoals(user.uid);
    setters.setNutritionGoals(goals);
    console.log('✅ Nutrition goals loaded:', goals);
    console.log(`🎯 Goals breakdown - Protein: ${goals.proteinTarget}g, Carbs: ${goals.carbsTarget}g, Fat: ${goals.fatTarget}g`);
  } catch (ignoredError) {
    console.log('⚠️ Nutrition goals failed, using defaults...');
    const defaultGoals = {
      proteinTarget: DEFAULT_PROTEIN_TARGET,
      carbsTarget: DEFAULT_CARBS_TARGET,
      fatTarget: DEFAULT_FAT_TARGET,
    };
    setters.setNutritionGoals(defaultGoals);
    console.log(`🎯 Using default goals - Protein: ${defaultGoals.proteinTarget}g, Carbs: ${defaultGoals.carbsTarget}g, Fat: ${defaultGoals.fatTarget}g`);
  }
}

/**
 * @param {object[]} workouts
 * @returns {object[]}
 */
function workoutsFinishedToday(workouts) {
  return workouts.filter((workout) => {
    // vocab: toDate() = Firestore Timestamp → Date. A plain value falls through to new Date.
    const workoutDate = workout.completedAt?.toDate?.() || new Date(workout.completedAt);
    return workoutDate.toISOString().split('T')[0] === getLocalDateKey();
  });
}

/**
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyWorkoutHistory(user, startTime, setters) {
  console.log(`💪 Fetching workout history... (${millisecondsSince(startTime)}ms)`);
  try {
    const workouts = await Promise.race([
      fetchWorkoutHistory(user.uid, WORKOUT_HISTORY_LIMIT),
      rejectAfter(WORKOUT_HISTORY_TIMEOUT_MS, 'Workout history timeout'),
    ]);
    setters.setStreak(calculateStreak(workouts));
    setters.setWorkoutCount(workouts.length);
    const burned = workoutsFinishedToday(workouts).reduce(
      (sum, workout) => sum + (workout.caloriesBurned || 0),
      0,
    );
    setters.setCaloriesBurned(burned);
    console.log(`✅ Workout history processed (${millisecondsSince(startTime)}ms)`);
  } catch (ignoredError) {
    console.log('⚠️ Workout history failed, continuing...');
  }
}

/**
 * @param {object} user
 * @param {number} startTime
 * @param {object} setters
 */
async function applyActiveWorkout(user, startTime, setters) {
  console.log(`🎯 Fetching active workout... (${millisecondsSince(startTime)}ms)`);
  try {
    const activeWorkout = await getActiveWorkout(user.uid);
    if (!activeWorkout) return;
    setters.setTodayWorkout({
      name: activeWorkout.workoutName || ACTIVE_WORKOUT_NAME,
      exercises: activeWorkout.exercises?.length || 0,
      duration: activeWorkout.duration || 0,
      progress: 0,
    });
    console.log(`✅ Active workout processed (${millisecondsSince(startTime)}ms)`);
  } catch (ignoredError) {
    console.log('⚠️ Active workout failed, continuing...');
  }
}

// ===== MAIN FUNCTION =====

/**
 * Load the client home dashboard once the user id and Firestore are ready.
 * The effect re-runs only when the user id or the database handle changes.
 * A ref blocks a second overlapping load.
 * @param {object} home
 * @param {object} home.user
 * @param {object} home.db
 * @param {{ current: boolean }} home.isFetching
 */
export function loadHomeScreenData({
  user,
  db,
  isFetching,
  setLoading,
  setLoadingStartTime,
  setOnboardingData,
  setUserWeight,
  setGoalProgress,
  setCalorieGoal,
  setWaterIntake,
  setSleepHours,
  setSoreness,
  setEnergyLevel,
  setStressLevel,
  setDashboardWorkoutSummary,
  setTodayWorkout,
  setCaloriesConsumed,
  setMacroTotals,
  setNutritionGoals,
  setStreak,
  setWorkoutCount,
  setCaloriesBurned,
}) {
  const setters = {
    setOnboardingData,
    setUserWeight,
    setGoalProgress,
    setCalorieGoal,
    setWaterIntake,
    setSleepHours,
    setSoreness,
    setEnergyLevel,
    setStressLevel,
    setDashboardWorkoutSummary,
    setTodayWorkout,
    setCaloriesConsumed,
    setMacroTotals,
    setNutritionGoals,
    setStreak,
    setWorkoutCount,
    setCaloriesBurned,
  };

  // vocab: useEffect = run this after paint, and again when user id or db changes.
  useEffect(() => {
    const startTime = Date.now();
    console.log(`🚀 Starting data fetch for user: ${user?.uid} at ${new Date().toISOString()}`);

    if (isFetching.current) {
      console.log(`⚠️ Already fetching data, skipping... (${millisecondsSince(startTime)}ms)`);
      return;
    }

    const fetchData = async () => {
      isFetching.current = true;

      if (!user?.uid || !db) {
        console.log(`❌ No user or db, setting loading false (${millisecondsSince(startTime)}ms)`);
        setLoading(false);
        isFetching.current = false;
        return;
      }

      const loadingSafetyTimer = setTimeout(() => {
        console.log(`⏰ TIMEOUT: Forcing loading to complete due to timeout (${millisecondsSince(startTime)}ms)`);
        setLoading(false);
      }, LOADING_SAFETY_MS);

      try {
        console.log(`📥 Setting loading to true (${millisecondsSince(startTime)}ms)`);
        setLoadingStartTime(Date.now());
        setLoading(true);

        const userDoc = await fetchUserDocument(db, user, startTime);
        if (userDoc && userDoc.exists()) {
          await applyFoundUserProfile(user, userDoc, startTime, setters);
        } else {
          await applyMissingUserProfile(user, startTime, setters);
        }

        await applyNutritionGoalsDocument(db, user, startTime, setters);
        await applyDailyMetrics(db, user, startTime, setters);
        await applyNutritionLogs(user, startTime, setters);
        await applyNutritionGoalTargets(user, startTime, setters);
        await applyWorkoutHistory(user, startTime, setters);
        await applyActiveWorkout(user, startTime, setters);

        console.log('⚡ All dashboard data loaded successfully');
      } catch (error) {
        console.error(`❌ Error fetching data: ${error.message} (${millisecondsSince(startTime)}ms)`);
      } finally {
        const totalTime = Date.now() - startTime;
        console.log(`🏁 Setting loading to false - TOTAL TIME: ${totalTime}ms`);
        clearTimeout(loadingSafetyTimer);
        setLoading(false);
        isFetching.current = false;
      }
    };

    fetchData();
  }, [user?.uid, db]);
}
