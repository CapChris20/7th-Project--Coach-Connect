// First load of the client home screen: profile, goals, today's food, and workouts.
// Flow: user doc → calorie goal doc → today's metrics → food log → macro goals → workout history → active workout.
// Used by ClientAppStart. The setters belong to that screen; this file only fills them.
// Key export: loadHomeScreenData — one useEffect that kicks off the ordered load pipeline.

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
const ERROR_STACK_PREVIEW_CHARS = 200;

const USERS_COLLECTION = 'users';
const NUTRITION_GOALS_COLLECTION = 'nutrition_goals';
const DAILY_LOGS_COLLECTION = 'dailyLogs';
const LEGACY_DAILY_TRACKING_COLLECTION = 'daily_tracking';
const ACTIVE_WORKOUT_NAME = 'Active Workout';

// ===== HELPER FUNCTIONS =====

function millisecondsSince(startTime) {
  const now = Date.now();
  return now - startTime;
}

function userIdFromUser(user) {
  if (!user) return null;
  if (user.uid == null) return null;
  return user.uid;
}

// ===== MAIN FUNCTION =====

/**
 * Wire the home screen's first-load effect: skip if already fetching, then run the ordered pipeline.
 * Hook order is frozen — single useEffect keyed on user.uid + db.
 * @param {object} args
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
  const homeScreenSetters = {
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

  // vocab: useEffect = run after paint when the signed-in user or db handle changes
  useEffect(() => {
    const startTime = Date.now();
    const signedInUserId = userIdFromUser(user);
    console.log(`🚀 Starting data fetch for user: ${signedInUserId} at ${new Date().toISOString()}`);

    // 1. Skip when a fetch is already in flight (ref owned by the screen).
    if (isFetching.current) {
      const elapsedMs = millisecondsSince(startTime);
      console.log(`⚠️ Already fetching data, skipping... (${elapsedMs}ms)`);
      return;
    }

    // 2. Run the ordered dashboard load pipeline.
    loadClientHomeDashboard({
      user,
      db,
      isFetching,
      setLoading,
      setLoadingStartTime,
      setters: homeScreenSetters,
      startTime,
    });
  }, [user?.uid, db]);
}

// ===== PLUMBING — skip unless the home spinner hangs or a card shows the wrong first-load number =====

function rejectAfter(milliseconds, message) {
  return new Promise(function rejectWhenTimerFires(_unusedResolve, reject) {
    setTimeout(function fireTimeoutReject() {
      reject(new Error(message));
    }, milliseconds);
  });
}

function missingUserDocument() {
  return {
    exists: function documentDoesNotExist() {
      return false;
    },
    data: function emptyDocumentData() {
      return null;
    },
  };
}

function goalProgressOrNull(profile) {
  if (!profile) return null;
  if (typeof profile.goalProgress !== 'number') return null;
  return profile.goalProgress;
}

function storedCalorieTarget(profile) {
  // vocab/symbol: fall through only on null/undefined so a stored 0 still wins
  if (profile.calorieTarget != null) return profile.calorieTarget;
  if (profile.calorie_target != null) return profile.calorie_target;
  if (!profile.nutrition) return undefined;
  if (profile.nutrition.calories != null) return profile.nutrition.calories;
  return undefined;
}

function calorieGoalFromNutritionDoc(goalsData) {
  if (!goalsData) return null;
  if (typeof goalsData.calorie_target === 'number') return goalsData.calorie_target;
  if (typeof goalsData.calories === 'number') return goalsData.calories;
  return null;
}

function emptyDailySnapshot() {
  return {
    exists: function snapshotDoesNotExist() {
      return false;
    },
  };
}

function defaultMacroGoals() {
  return {
    proteinTarget: DEFAULT_PROTEIN_TARGET,
    carbsTarget: DEFAULT_CARBS_TARGET,
    fatTarget: DEFAULT_FAT_TARGET,
  };
}

function workoutCompletedDate(workout) {
  const completedAt = workout.completedAt;
  let timestampDate;
  if (completedAt) {
    if (completedAt.toDate) {
      timestampDate = completedAt.toDate();
    }
  }
  if (timestampDate) return timestampDate;
  return new Date(completedAt);
}

function workoutsFinishedToday(workouts) {
  const todayKey = getLocalDateKey();
  const finishedToday = [];
  let workoutIndex = 0;
  while (workoutIndex < workouts.length) {
    const workout = workouts[workoutIndex];
    const workoutDate = workoutCompletedDate(workout);
    const isoStamp = workoutDate.toISOString();
    const workoutDayKey = isoStamp.split('T')[0];
    if (workoutDayKey === todayKey) {
      finishedToday.push(workout);
    }
    workoutIndex += 1;
  }
  return finishedToday;
}

function caloriesBurnedToday(workouts) {
  const finishedToday = workoutsFinishedToday(workouts);
  let burned = 0;
  let workoutIndex = 0;
  while (workoutIndex < finishedToday.length) {
    const workout = finishedToday[workoutIndex];
    const burnedThisWorkout = workout.caloriesBurned || 0;
    burned += burnedThisWorkout;
    workoutIndex += 1;
  }
  return burned;
}

function databaseExists(database) {
  return Boolean(database);
}

async function fetchUserDocument(database, user, startTime) {
  console.log(`👤 Fetching user data... (${millisecondsSince(startTime)}ms)`);
  console.log(`🔍 Firebase check - db exists: ${databaseExists(database)}, user.uid: ${userIdFromUser(user)}`);
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
    let stackPreview;
    if (error.stack) {
      stackPreview = error.stack.substring(0, ERROR_STACK_PREVIEW_CHARS);
    }
    console.error('🔍 Error details:', {
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: stackPreview,
      dbExists: databaseExists(database),
      userUid: userIdFromUser(user),
      timestamp: new Date().toISOString(),
    });
    return missingUserDocument();
  }
}

async function readCachedProfile(userId) {
  try {
    const cachedProfile = await loadCachedOnboardingProfile(userId, AsyncStorage);
    return cachedProfile;
  } catch (_ignoredError) {
    return null;
  }
}

async function applyFoundUserProfile(user, userDoc, startTime, setters) {
  const userDocData = userDoc.data();
  const cachedProfile = await readCachedProfile(user.uid);
  const mergedProfile = fillTraineeProfile(cachedProfile, userDocData);
  setters.setOnboardingData(mergedProfile);
  setters.setUserWeight(mergedProfile.weight);
  setters.setGoalProgress(goalProgressOrNull(mergedProfile));

  const storedCalories = storedCalorieTarget(mergedProfile);
  const hasPositiveCalorieTarget = typeof storedCalories === 'number' && storedCalories > 0;
  if (hasPositiveCalorieTarget) {
    setters.setCalorieGoal(Math.round(storedCalories));
  }
  console.log(`✅ User data processed (${millisecondsSince(startTime)}ms)`);
}

async function applyMissingUserProfile(user, startTime, setters) {
  console.log(`⚠️ No user data found, using defaults (${millisecondsSince(startTime)}ms)`);
  const cachedProfile = await readCachedProfile(user.uid);
  const mergedProfile = fillTraineeProfile(cachedProfile);
  setters.setOnboardingData(mergedProfile);

  if (mergedProfile) {
    if (mergedProfile.weight != null) {
      setters.setUserWeight(mergedProfile.weight);
    }
  }

  setters.setGoalProgress(goalProgressOrNull(mergedProfile));

  let hasCalorieTarget = false;
  if (mergedProfile) {
    if (typeof mergedProfile.calorieTarget === 'number' && mergedProfile.calorieTarget > 0) {
      hasCalorieTarget = true;
    }
  }
  if (!hasCalorieTarget) {
    setters.setCalorieGoal(DEFAULT_CALORIE_GOAL);
  }
}

async function applyNutritionGoalsDocument(database, user, startTime, setters) {
  console.log(`🥗 Fetching nutrition goals... (${millisecondsSince(startTime)}ms)`);
  try {
    const goalsDoc = await Promise.race([
      getDoc(doc(database, NUTRITION_GOALS_COLLECTION, user.uid)),
      rejectAfter(NUTRITION_GOALS_DOC_TIMEOUT_MS, 'Nutrition goals timeout'),
    ]);
    if (!goalsDoc.exists()) return;

    const goalCalories = calorieGoalFromNutritionDoc(goalsDoc.data());
    const hasPositiveGoalCalories = goalCalories != null && goalCalories > 0;
    if (hasPositiveGoalCalories) {
      setters.setCalorieGoal(Math.round(goalCalories));
    }
    console.log(`✅ Nutrition goals processed (${millisecondsSince(startTime)}ms)`);
  } catch (_ignoredError) {
    console.log('⚠️ Nutrition goals failed, continuing...');
  }
}

async function readDailyLogsSnapshot(database, user, todayKey) {
  return Promise.race([
    getDoc(doc(database, USERS_COLLECTION, user.uid, DAILY_LOGS_COLLECTION, todayKey)),
    rejectAfter(DAILY_METRICS_TIMEOUT_MS, 'Daily logs timeout'),
  ]);
}

async function readLegacyTrackingSnapshot(database, user, todayKey) {
  try {
    const trackingDoc = await Promise.race([
      getDoc(doc(database, USERS_COLLECTION, user.uid, LEGACY_DAILY_TRACKING_COLLECTION, todayKey)),
      rejectAfter(DAILY_METRICS_TIMEOUT_MS, 'Daily tracking timeout'),
    ]);
    return trackingDoc;
  } catch (_ignoredError) {
    return emptyDailySnapshot();
  }
}

async function applyDailyMetrics(database, user, startTime, setters) {
  console.log(`📊 Fetching daily metrics... (${millisecondsSince(startTime)}ms)`);
  try {
    const todayKey = getLocalDateKey();
    // Promise.all lives in PLUMBING — race each source so one hang cannot block forever.
    const logsAndTracking = await Promise.all([
      readDailyLogsSnapshot(database, user, todayKey),
      readLegacyTrackingSnapshot(database, user, todayKey),
    ]);
    const logsDoc = logsAndTracking[0];
    const trackingDoc = logsAndTracking[1];
    const parsed = parseDailyMetricsFromSnapshots(logsDoc, trackingDoc);
    setters.setWaterIntake(parsed.waterIntake);
    setters.setSleepHours(parsed.sleepHours);
    setters.setSoreness(parsed.soreness);
    setters.setEnergyLevel(parsed.energyLevel);
    setters.setStressLevel(parsed.stressLevel);
    setters.setDashboardWorkoutSummary(parsed.dashboardWorkoutSummary);
    setters.setTodayWorkout(parsed.todayWorkout);
    console.log(`✅ Daily metrics processed (${millisecondsSince(startTime)}ms)`);
  } catch (_ignoredError) {
    console.log('⚠️ Daily metrics failed, continuing...');
  }
}

async function applyNutritionLogs(user, startTime, setters) {
  console.log(`🍎 Fetching nutrition logs... (${millisecondsSince(startTime)}ms)`);
  try {
    const nutritionLogs = await Promise.race([
      getFoodLogsForDate(user.uid, getLocalDateKey()),
      rejectAfter(NUTRITION_LOGS_TIMEOUT_MS, 'Nutrition logs timeout'),
    ]);
    const totals = calculateMacroTotals(nutritionLogs);
    const calories = totals.calories || 0;
    const protein = totals.protein || 0;
    const carbs = totals.carbs || 0;
    const fats = totals.fat || 0;
    setters.setCaloriesConsumed(calories);
    setters.setMacroTotals({
      protein: protein,
      carbs: carbs,
      fats: fats,
    });
    console.log(`✅ Nutrition logs processed (${millisecondsSince(startTime)}ms)`);
    console.log(`🍎 Macro totals - Protein: ${totals.protein}g, Carbs: ${totals.carbs}g, Fat: ${totals.fat}g`);
  } catch (_ignoredError) {
    console.log('⚠️ Nutrition logs failed, continuing...');
  }
}

async function applyNutritionGoalTargets(user, startTime, setters) {
  console.log(`🎯 Fetching nutrition goals... (${millisecondsSince(startTime)}ms)`);
  try {
    const goals = await getDailyGoals(user.uid);
    setters.setNutritionGoals(goals);
    console.log('✅ Nutrition goals loaded:', goals);
    console.log(`🎯 Goals breakdown - Protein: ${goals.proteinTarget}g, Carbs: ${goals.carbsTarget}g, Fat: ${goals.fatTarget}g`);
  } catch (_ignoredError) {
    console.log('⚠️ Nutrition goals failed, using defaults...');
    const defaultGoals = defaultMacroGoals();
    setters.setNutritionGoals(defaultGoals);
    console.log(
      `🎯 Using default goals - Protein: ${defaultGoals.proteinTarget}g, Carbs: ${defaultGoals.carbsTarget}g, Fat: ${defaultGoals.fatTarget}g`,
    );
  }
}

async function applyWorkoutHistory(user, startTime, setters) {
  console.log(`💪 Fetching workout history... (${millisecondsSince(startTime)}ms)`);
  try {
    const workouts = await Promise.race([
      fetchWorkoutHistory(user.uid, WORKOUT_HISTORY_LIMIT),
      rejectAfter(WORKOUT_HISTORY_TIMEOUT_MS, 'Workout history timeout'),
    ]);
    setters.setStreak(calculateStreak(workouts));
    setters.setWorkoutCount(workouts.length);
    setters.setCaloriesBurned(caloriesBurnedToday(workouts));
    console.log(`✅ Workout history processed (${millisecondsSince(startTime)}ms)`);
  } catch (_ignoredError) {
    console.log('⚠️ Workout history failed, continuing...');
  }
}

function exerciseCountFromActiveWorkout(activeWorkout) {
  const exerciseList = activeWorkout.exercises;
  if (!exerciseList) return 0;
  return exerciseList.length;
}

async function applyActiveWorkout(user, startTime, setters) {
  console.log(`🎯 Fetching active workout... (${millisecondsSince(startTime)}ms)`);
  try {
    const activeWorkout = await getActiveWorkout(user.uid);
    if (!activeWorkout) return;

    let workoutName = ACTIVE_WORKOUT_NAME;
    if (activeWorkout.workoutName) {
      workoutName = activeWorkout.workoutName;
    }

    let durationMinutes = 0;
    if (activeWorkout.duration) {
      durationMinutes = activeWorkout.duration;
    }

    setters.setTodayWorkout({
      name: workoutName,
      exercises: exerciseCountFromActiveWorkout(activeWorkout),
      duration: durationMinutes,
      progress: 0,
    });
    console.log(`✅ Active workout processed (${millisecondsSince(startTime)}ms)`);
  } catch (_ignoredError) {
    console.log('⚠️ Active workout failed, continuing...');
  }
}

function canLoadHomeDashboard(user, database) {
  const signedInUserId = userIdFromUser(user);
  if (!signedInUserId) return false;
  if (!database) return false;
  return true;
}

/**
 * Ordered first-load pipeline for the client home dashboard.
 * Failures inside each step are swallowed so later cards still fill.
 */
async function loadClientHomeDashboard({
  user,
  db,
  isFetching,
  setLoading,
  setLoadingStartTime,
  setters,
  startTime,
}) {
  isFetching.current = true;

  if (!canLoadHomeDashboard(user, db)) {
    console.log(`❌ No user or db, setting loading false (${millisecondsSince(startTime)}ms)`);
    setLoading(false);
    isFetching.current = false;
    return;
  }

  const loadingSafetyTimer = setTimeout(function forceLoadingOff() {
    console.log(`⏰ TIMEOUT: Forcing loading to complete due to timeout (${millisecondsSince(startTime)}ms)`);
    setLoading(false);
  }, LOADING_SAFETY_MS);

  try {
    console.log(`📥 Setting loading to true (${millisecondsSince(startTime)}ms)`);
    setLoadingStartTime(Date.now());
    setLoading(true);

    // 1. Profile from users/{uid} (or cached onboarding when missing).
    const userDoc = await fetchUserDocument(db, user, startTime);
    const userDocExists = userDoc && userDoc.exists();
    if (userDocExists) {
      await applyFoundUserProfile(user, userDoc, startTime, setters);
    } else {
      await applyMissingUserProfile(user, startTime, setters);
    }

    // 2. Calorie target from nutrition_goals/{uid} when present.
    await applyNutritionGoalsDocument(db, user, startTime, setters);

    // 3. Today's wellness + workout summary from dailyLogs + legacy tracking.
    await applyDailyMetrics(db, user, startTime, setters);

    // 4. Food log totals for today.
    await applyNutritionLogs(user, startTime, setters);

    // 5. Macro targets (protein / carbs / fat).
    await applyNutritionGoalTargets(user, startTime, setters);

    // 6. Streak and history stats.
    await applyWorkoutHistory(user, startTime, setters);

    // 7. In-progress workout card when one is active.
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
}
