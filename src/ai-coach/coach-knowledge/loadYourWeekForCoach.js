// Builds the 7-day snapshot the AI Coach shows on chips and sends in the prompt.
// Flow: try the server week → if that fails, read Firestore on the phone →
//       fold the numbers into one chip/prompt shape → optionally run day-14 macros.
// Used by: coach conversation screen, sendMessageToCoach, and coach self-test.

import { auth, db } from '../../app-start/cloudConnection';
// vocab: collection/doc point at Firestore paths. query+where filter. getDoc/getDocs read once.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import { getAICoachApiBases, getResilientApiBases } from '../../for-both/online-connection/whereToConnect';
import { showSetupAnswers } from '../../helpers/showSetupAnswers';
import { aggregateCoachWeeklyDataClient } from './loadWeeklyNumbers';

// ===== NAMED CONSTANTS =====

const DAYS_IN_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;
const MS_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const SEVEN_DAYS_IN_MS = DAYS_IN_WEEK * MS_PER_DAY;

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

const USERS_COLLECTION = 'users';
const PROFILE_SUBCOLLECTION = 'profile';
const CURRENT_DOC_ID = 'current';
const MACRO_TARGETS_SUBCOLLECTION = 'macroTargets';
const NUTRITION_GOALS_COLLECTION = 'nutrition_goals';
const WORKOUT_PLANS_SUBCOLLECTION = 'workoutPlans';
const STREAKS_SUBCOLLECTION = 'streaks';
const PROGRESS_PHOTOS_SUBCOLLECTION = 'progressPhotos';
const NOTES_AND_FILES_SUBCOLLECTION = 'notes_and_files';

const WEEKLY_CONTEXT_PATH = '/api/weekly-context';
const MACRO_RECALIBRATION_PATH = '/api/macro-recalibration';

const PHOTO_QUERY_LIMIT = 20;
const NOTES_QUERY_LIMIT = 8;
const TRAINER_NOTE_LINE_CAP = 3;

const DEFAULT_PLAN_NAME = 'Your plan';
const DEFAULT_TRAINER_NOTES = 'No recent notes';
const DEFAULT_USER_NAME = 'Coach';
const DEFAULT_GOAL_LABEL = 'Not set';
const MISSING_LEVEL_LABEL = '—';
const MISSING_SLEEP_LABEL = '—';
const MISSING_RPE_LABEL = '—';
const VOLUME_TREND_LOGGED = 'logged';
const VOLUME_TREND_NONE = 'none';
const SOURCE_SERVER = 'server';
const SOURCE_CLIENT = 'client';
const SOURCE_PROFILE_ONLY = 'profile-only';
const SOURCE_UNKNOWN = 'unknown';

const MAX_DATA_QUALITY = 100;
const NUTRITION_FULL_DAYS = 6;
const NUTRITION_PARTIAL_DAYS = 3;
const NUTRITION_FULL_POINTS = 30;
const NUTRITION_PARTIAL_POINTS = 15;
const WORKOUT_FULL_SESSIONS = 3;
const WORKOUT_PARTIAL_SESSIONS = 1;
const WORKOUT_FULL_POINTS = 30;
const WORKOUT_PARTIAL_POINTS = 15;
// Manipulate here: average sleep at or above this many hours scores full recovery points.
const SLEEP_FULL_HOURS = 7;
const SLEEP_PARTIAL_HOURS = 6;
const SLEEP_FULL_POINTS = 20;
const SLEEP_PARTIAL_POINTS = 10;
const STREAK_POINTS = 20;

// ===== HELPER FUNCTIONS =====
// Chip / number helpers the mains call. Firestore and network stay under PLUMBING.

/**
 * Finite number, or null when the value is not a number.
 * @param {*} value
 * @returns {number|null}
 */
function pickFiniteNumber(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue;
  }
  return null;
}

/**
 * First finite number in the list wins; null when none are finite.
 * @param {Array<*>} candidates
 * @returns {number|null}
 */
function firstFiniteAmong(candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const finite = pickFiniteNumber(candidates[index]);
    if (finite != null) {
      return finite;
    }
  }
  return null;
}

/**
 * Streak days from whichever field name the payload used.
 * @param {object} raw
 * @returns {number}
 */
function pickStreakDaysFromRaw(raw) {
  let streakDataCurrent = null;
  if (raw.streakData) {
    streakDataCurrent = raw.streakData.currentStreak;
  }

  const fromStreakData = pickFiniteNumber(streakDataCurrent);
  if (fromStreakData != null) return fromStreakData;

  const fromStreakDays = pickFiniteNumber(raw.streakDays);
  if (fromStreakDays != null) return fromStreakDays;

  const fromCurrentStreak = pickFiniteNumber(raw.currentStreak);
  if (fromCurrentStreak != null) return fromCurrentStreak;

  return 0;
}

/**
 * @param {object} raw
 * @param {object} nutritionAnalysis
 * @returns {{ avgCals: number, avgProtein: number, avgCarbs: number, avgFat: number, daysLogged: number, nutritionConsistency: number }}
 */
function nutritionChipNumbers(raw, nutritionAnalysis) {
  let daysLogged = pickFiniteNumber(nutritionAnalysis.totalLoggedDaysAllTime);
  if (daysLogged == null) {
    daysLogged = pickFiniteNumber(nutritionAnalysis.daysLogged);
  }
  if (daysLogged == null) {
    daysLogged = pickFiniteNumber(raw.nutritionDaysLogged);
  }
  if (daysLogged == null) {
    daysLogged = 0;
  }

  let avgCalsSource = pickFiniteNumber(nutritionAnalysis.avgDailyCalories);
  if (avgCalsSource == null) {
    avgCalsSource = pickFiniteNumber(raw.avgCals);
  }
  if (avgCalsSource == null) {
    avgCalsSource = 0;
  }

  let avgProteinSource = pickFiniteNumber(nutritionAnalysis.avgProtein);
  if (avgProteinSource == null) {
    avgProteinSource = pickFiniteNumber(raw.avgProtein);
  }
  if (avgProteinSource == null) {
    avgProteinSource = 0;
  }

  let avgCarbsSource = pickFiniteNumber(nutritionAnalysis.avgCarbs);
  if (avgCarbsSource == null) {
    avgCarbsSource = pickFiniteNumber(raw.avgCarbs);
  }
  if (avgCarbsSource == null) {
    avgCarbsSource = 0;
  }

  let avgFatSource = pickFiniteNumber(nutritionAnalysis.avgFat);
  if (avgFatSource == null) {
    avgFatSource = pickFiniteNumber(raw.avgFat);
  }
  if (avgFatSource == null) {
    avgFatSource = 0;
  }

  let nutritionConsistency = pickFiniteNumber(nutritionAnalysis.consistencyScore);
  if (nutritionConsistency == null) {
    nutritionConsistency = 0;
  }

  return {
    avgCals: Math.round(avgCalsSource),
    avgProtein: Math.round(avgProteinSource),
    avgCarbs: Math.round(avgCarbsSource),
    avgFat: Math.round(avgFatSource),
    daysLogged,
    nutritionConsistency,
  };
}

/**
 * Default volume trend when the payload omitted one.
 * @param {number} workoutsLogged
 * @returns {string}
 */
function volumeTrendFromSessionCount(workoutsLogged) {
  if (workoutsLogged > 0) return VOLUME_TREND_LOGGED;
  return VOLUME_TREND_NONE;
}

/**
 * @param {object} raw
 * @param {object} workoutAnalysis
 * @returns {{ workoutsLogged: number, volumeTrend: string, avgRPELabel: string }}
 */
function workoutChipNumbers(raw, workoutAnalysis) {
  let workoutsLogged = pickFiniteNumber(workoutAnalysis.sessionsLogged);
  if (workoutsLogged == null) {
    workoutsLogged = pickFiniteNumber(raw.workoutsLogged);
  }
  if (workoutsLogged == null) {
    workoutsLogged = 0;
  }

  let volumeTrend = workoutAnalysis.volumeTrend || raw.volumeTrend;
  if (!volumeTrend) {
    volumeTrend = volumeTrendFromSessionCount(workoutsLogged);
  }

  let avgRpeNumber = pickFiniteNumber(workoutAnalysis.avgRPE);
  if (avgRpeNumber == null) {
    avgRpeNumber = pickFiniteNumber(raw.avgRPE);
  }

  let avgRPELabel = MISSING_RPE_LABEL;
  if (avgRpeNumber != null) {
    avgRPELabel = Number(avgRpeNumber).toFixed(1);
  }

  return { workoutsLogged, volumeTrend, avgRPELabel };
}

/**
 * @param {object} raw
 * @param {object} sleepAnalysis
 * @returns {string}
 */
function sleepAverageLabel(raw, sleepAnalysis) {
  if (sleepAnalysis.avgHours != null) {
    return Number(sleepAnalysis.avgHours).toFixed(1);
  }
  if (raw.avgSleep != null) {
    return raw.avgSleep;
  }
  return MISSING_SLEEP_LABEL;
}

/**
 * Walk candidates in order; first finite number wins, then round. vocab: keeps a saved 0.
 * @param {Array<*>} candidates
 * @returns {number}
 */
function pickRoundedMacroTarget(candidates) {
  const finite = firstFiniteAmong(candidates);
  if (finite != null) {
    return Math.round(finite);
  }
  return 0;
}

/**
 * @param {object} raw
 * @param {object} userProfile
 * @param {object} macroTargets
 * @returns {{ targetCals: number, targetProtein: number, targetCarbs: number, targetFat: number }}
 */
function targetChipNumbers(raw, userProfile, macroTargets) {
  let profileCalories;
  let profileProteinTarget;
  if (userProfile) {
    profileCalories = userProfile.calories;
    profileProteinTarget = userProfile.proteinTarget;
  }

  const targetCals = pickRoundedMacroTarget([
    macroTargets.calories,
    macroTargets.cals,
    macroTargets.calorie_target,
    profileCalories,
    raw.targetCals,
  ]);

  const targetProtein = pickRoundedMacroTarget([
    macroTargets.protein,
    macroTargets.protein_target,
    profileProteinTarget,
    raw.targetProtein,
  ]);

  const targetCarbs = pickRoundedMacroTarget([macroTargets.carbs, raw.targetCarbs]);
  const targetFat = pickRoundedMacroTarget([macroTargets.fat, raw.targetFat]);

  return { targetCals, targetProtein, targetCarbs, targetFat };
}

/**
 * Display name for chips: firstName → name → user fields → default.
 * @param {object} userProfile
 * @param {object} userFields
 * @returns {string}
 */
function pickUserDisplayName(userProfile, userFields) {
  if (userProfile && userProfile.firstName) return userProfile.firstName;
  if (userProfile && userProfile.name) return userProfile.name;
  if (userFields.firstName) return userFields.firstName;
  return DEFAULT_USER_NAME;
}

/**
 * Goal label: setup answer → raw string → "Not set".
 * @param {string} goalRaw
 * @returns {string}
 */
function pickGoalLabel(goalRaw) {
  const goalFromSetup = showSetupAnswers(goalRaw, '');
  if (goalFromSetup) return goalFromSetup;
  if (goalRaw) return String(goalRaw);
  return DEFAULT_GOAL_LABEL;
}

/**
 * Training level: setup answer → user fields → profile → missing placeholder.
 * @param {object} userFields
 * @param {object} userProfile
 * @returns {string}
 */
function pickTrainingLevelLabel(userFields, userProfile) {
  let profileFitnessLevel;
  if (userProfile) {
    profileFitnessLevel = userProfile.fitnessLevel;
  }

  const levelRaw = userFields.trainingLevel || profileFitnessLevel;
  const levelFromSetup = showSetupAnswers(levelRaw, '');
  if (levelFromSetup) return levelFromSetup;
  if (userFields.trainingLevel) return userFields.trainingLevel;
  if (profileFitnessLevel) return profileFitnessLevel;
  return MISSING_LEVEL_LABEL;
}

/**
 * @param {object} raw
 * @param {object} userProfile
 * @param {object} userFields
 * @returns {{ userName: string, goal: string, trainingLevel: string }}
 */
function identityChipFields(raw, userProfile, userFields) {
  let profilePrimaryGoal;
  let profileGoal;
  if (userProfile) {
    profilePrimaryGoal = userProfile.primaryGoal;
    profileGoal = userProfile.goal;
  }

  const goalRaw = userFields.goal || profilePrimaryGoal || profileGoal || raw.goal || '';
  const userName = pickUserDisplayName(userProfile, userFields);
  const goal = pickGoalLabel(goalRaw);
  const trainingLevel = pickTrainingLevelLabel(userFields, userProfile);
  return { userName, goal, trainingLevel };
}

/**
 * Macro targets object from raw payload or the user profile.
 * @param {object} raw
 * @param {object} userProfile
 * @returns {object}
 */
function macroTargetsFromRawOrProfile(raw, userProfile) {
  if (raw.macroTargets) {
    return raw.macroTargets;
  }
  if (userProfile && userProfile.macroTargets) {
    return userProfile.macroTargets;
  }
  return {};
}

/**
 * User fields object from raw.user or the profile fallback.
 * @param {object} raw
 * @param {object} userProfile
 * @returns {object}
 */
function userFieldsFromRawOrProfile(raw, userProfile) {
  if (raw.user) {
    return raw.user;
  }
  if (userProfile) {
    return userProfile;
  }
  return {};
}

/**
 * Average daily steps from wellness analysis blobs.
 * @param {object} raw
 * @returns {number}
 */
function stepsAverageFromRaw(raw) {
  const wellness = raw.wellnessAnalysis || raw.wellness || {};
  let stepsBlob = null;
  if (wellness.steps) {
    stepsBlob = wellness.steps;
  }

  let avgDaily;
  if (stepsBlob) {
    avgDaily = stepsBlob.avgDaily;
  }

  const finiteSteps = pickFiniteNumber(avgDaily);
  if (finiteSteps == null) {
    return 0;
  }
  return finiteSteps;
}

/**
 * Whether an active plan summary exists on the payload.
 * @param {object} raw
 * @returns {boolean}
 */
function hasActiveWorkoutPlanSummary(raw) {
  if (!raw.workoutPlan) {
    return false;
  }
  if (!raw.workoutPlan.activePlan) {
    return false;
  }
  if (!raw.workoutPlan.activePlan.summary) {
    return false;
  }
  return true;
}

/**
 * Photo count from raw, or 0.
 * @param {object} raw
 * @returns {number}
 */
function photoCountFromRaw(raw) {
  const finite = pickFiniteNumber(raw.photoCount);
  if (finite == null) {
    return 0;
  }
  return finite;
}

/**
 * Daily food log rows for the prompt block.
 * @param {object} raw
 * @param {object} nutritionAnalysis
 * @returns {Array}
 */
function dailyFoodLogFromRaw(raw, nutritionAnalysis) {
  if (nutritionAnalysis.dailyBreakdown) {
    return nutritionAnalysis.dailyBreakdown;
  }
  if (raw.dailyBreakdown) {
    return raw.dailyBreakdown;
  }
  return [];
}

/**
 * Quality points for nutrition days logged.
 * @param {number} daysLogged
 * @returns {number}
 */
function nutritionQualityPoints(daysLogged) {
  if (daysLogged >= NUTRITION_FULL_DAYS) return NUTRITION_FULL_POINTS;
  if (daysLogged >= NUTRITION_PARTIAL_DAYS) return NUTRITION_PARTIAL_POINTS;
  return 0;
}

/**
 * @param {number} workoutsLogged
 * @returns {number}
 */
function workoutQualityPoints(workoutsLogged) {
  if (workoutsLogged >= WORKOUT_FULL_SESSIONS) return WORKOUT_FULL_POINTS;
  if (workoutsLogged >= WORKOUT_PARTIAL_SESSIONS) return WORKOUT_PARTIAL_POINTS;
  return 0;
}

/**
 * @param {number} sleepHours
 * @returns {number}
 */
function sleepQualityPoints(sleepHours) {
  if (!Number.isFinite(sleepHours)) return 0;
  if (sleepHours >= SLEEP_FULL_HOURS) return SLEEP_FULL_POINTS;
  if (sleepHours >= SLEEP_PARTIAL_HOURS) return SLEEP_PARTIAL_POINTS;
  return 0;
}

/**
 * @param {number} streakDays
 * @returns {number}
 */
function streakQualityPoints(streakDays) {
  if (streakDays > 0) return STREAK_POINTS;
  return 0;
}


// ===== MAIN FUNCTION =====

/**
 * Turn server weekly-context or a client aggregate into chip + prompt shape.
 * Flow: 1. nutrition  2. workouts  3. sleep  4. targets + identity  5. one object chips read
 * @param {object|null} raw
 * @param {object} [userProfile]
 * @returns {object|null}
 */
export function normalizeCoachContext(raw, userProfile = {}) {
  if (!raw) return null;

  const nutritionAnalysis = raw.nutritionAnalysis || {};
  const workoutAnalysis = raw.workoutAnalysis || {};
  const sleepAnalysis = raw.sleepAnalysis || {};
  const macroTargets = macroTargetsFromRawOrProfile(raw, userProfile);
  const userFields = userFieldsFromRawOrProfile(raw, userProfile);

  // 1. Week averages the chips show (calories / protein / days logged).
  const nutrition = nutritionChipNumbers(raw, nutritionAnalysis);

  // 2. Workout sessions, RPE, and volume trend.
  const workoutChip = workoutChipNumbers(raw, workoutAnalysis);

  // 3. Sleep average as a display string (or the missing placeholder).
  const avgSleep = sleepAverageLabel(raw, sleepAnalysis);

  // 4. Steps and whether an active plan summary exists.
  const stepsAvg = stepsAverageFromRaw(raw);
  const hasWorkoutPlan = hasActiveWorkoutPlanSummary(raw);

  // 5. Daily targets from saved macros (several field spellings).
  const targets = targetChipNumbers(raw, userProfile, macroTargets);

  // 6. Name, goal, and training level for the prompt header.
  const identity = identityChipFields(raw, userProfile, userFields);

  // 7. Streak and photos — several payloads use different field names.
  const streakDays = pickStreakDaysFromRaw(raw);
  const photoCount = photoCountFromRaw(raw);

  const currentPlan = raw.currentPlan || raw.currentPlanName || DEFAULT_PLAN_NAME;
  const trainerNotes = raw.trainerNotes || DEFAULT_TRAINER_NOTES;
  const source = raw.source || SOURCE_UNKNOWN;
  const dailyFoodLog = dailyFoodLogFromRaw(raw, nutritionAnalysis);

  return {
    userName: identity.userName,
    goal: identity.goal,
    trainingLevel: identity.trainingLevel,
    currentPlan,
    avgCals: nutrition.avgCals,
    avgProtein: nutrition.avgProtein,
    avgCarbs: nutrition.avgCarbs,
    avgFat: nutrition.avgFat,
    targetCals: targets.targetCals,
    targetProtein: targets.targetProtein,
    targetCarbs: targets.targetCarbs,
    targetFat: targets.targetFat,
    nutritionDaysLogged: nutrition.daysLogged,
    nutritionConsistency: nutrition.nutritionConsistency,
    workoutsLogged: workoutChip.workoutsLogged,
    volumeTrend: workoutChip.volumeTrend,
    avgRPE: workoutChip.avgRPELabel,
    avgSleep,
    stepsAvg,
    hasWorkoutPlan,
    streakDays,
    photoCount,
    trainerNotes,
    source,
    dailyFoodLog,
  };
}

/**
 * Fetch authoritative weekly context from the Express API.
 * Flow: 1. signed-in token  2. try each API base  3. chip shape or null
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function fetchWeeklyContextFromServer(userId) {
  if (!userId) return null;

  // 1. The weekly-context route needs a signed-in token.
  const idToken = await readSignedInUserIdToken();
  if (!idToken) return null;

  // 2. Walk each API base until one returns a week.
  const headers = { Authorization: `Bearer ${idToken}` };
  const apiBases = getResilientApiBases();
  for (let baseIndex = 0; baseIndex < apiBases.length; baseIndex += 1) {
    const apiBase = apiBases[baseIndex];
    const weekFromBase = await fetchWeekFromOneApiBase(apiBase, userId, headers);
    if (weekFromBase) return weekFromBase;
  }

  // 3. Every base missed — caller will try Firestore on the phone.
  return null;
}

/**
 * Client-side 7-day Firestore aggregation when the server is unreachable.
 * Flow: 1. profile + macros  2. week numbers  3. plan / streak / photos / notes  4. chip shape
 * @param {string} userId
 * @param {object} [userProfile]
 * @returns {Promise<object|null>}
 */
export async function aggregateUserContext(userId, userProfile = {}) {
  if (!userId || !db) return null;

  try {
    const windowStartMs = Date.now() - SEVEN_DAYS_IN_MS;

    // 1. Profile + saved macros from four Firestore docs.
    const profileAndMacros = await loadProfileAndMacroTargets(userId, userProfile);
    const profile = profileAndMacros.profile;
    const macroTargets = profileAndMacros.macroTargets;

    // 2. Seven-day nutrition / workout / sleep numbers (shared weekly aggregator).
    const weekNumbers = await aggregateCoachWeeklyDataClient(userId);
    const nutritionAnalysis = weekNumbers.nutritionAnalysis;
    const workoutAnalysis = weekNumbers.workoutAnalysis;
    const sleepAnalysis = weekNumbers.sleepAnalysis;

    // 3. Current plan, streak, recent photos, trainer notes.
    const extras = await loadPlanStreakPhotosAndNotes(userId, windowStartMs);

    // 4. Same chip/prompt shape as the server payload.
    let profileAge;
    let profileWeight;
    let profileHeight;
    let profileGoal;
    let profileTrainingLevel;
    if (profile) {
      profileAge = profile.age;
      profileWeight = profile.weight;
      profileHeight = profile.height;
      profileGoal = profile.primaryGoal || profile.goal;
      profileTrainingLevel = profile.fitnessLevel || profile.trainingLevel;
    }

    let trainerNotes = extras.trainerNotes;
    if (!trainerNotes) {
      trainerNotes = DEFAULT_TRAINER_NOTES;
    }

    const clientPayload = {
      user: {
        age: profileAge,
        weight: profileWeight,
        height: profileHeight,
        goal: profileGoal,
        trainingLevel: profileTrainingLevel,
      },
      macroTargets,
      nutritionAnalysis,
      workoutAnalysis,
      sleepAnalysis,
      currentPlan: extras.currentPlan,
      streakDays: extras.streakDays,
      photoCount: extras.photoCount,
      trainerNotes,
      source: SOURCE_CLIENT,
    };

    return normalizeCoachContext(clientPayload, profile);
  } catch (error) {
    console.error('[contextAggregation] aggregateUserContext failed:', error);
    return null;
  }
}

/**
 * Best available 7-day context: server first, Firestore fallback, then profile-only chips.
 * Flow: 1. server week  2. phone Firestore  3. profile-only so chips still render
 * @param {string} userId
 * @param {object} [userProfile]
 * @returns {Promise<object|null>}
 */
export async function loadCoachContext(userId, userProfile = {}) {
  // 1. Server week is the source of truth when the phone is online.
  const fromServer = await fetchWeeklyContextFromServer(userId);
  if (fromServer) {
    return { ...fromServer, source: SOURCE_SERVER };
  }

  // 2. Offline / server down → read Firestore on the phone.
  const fromClient = await aggregateUserContext(userId, userProfile);
  if (fromClient) {
    return fromClient;
  }

  // 3. Brand-new account with no logs still gets name/goal chips.
  let profileMacros;
  if (userProfile) {
    profileMacros = userProfile.macroTargets;
  }

  const profileOnlyPayload = {
    user: userProfile,
    macroTargets: profileMacros,
    source: SOURCE_PROFILE_ONLY,
  };
  return normalizeCoachContext(profileOnlyPayload, userProfile);
}

/**
 * Score 0–100 for how much logged data the coach can trust this week.
 * Flow: 1. read chip fields  2. add pillar points  3. cap at 100
 * @param {object|null} context
 * @returns {number}
 */
export function calculateDataQuality(context) {
  if (!context) return 0;

  const daysLogged = Number(context.nutritionDaysLogged) || 0;
  const workoutsLogged = Number(context.workoutsLogged) || 0;
  const sleepHours = parseFloat(context.avgSleep);
  const streakDays = Number(context.streakDays) || 0;

  let qualityScore = 0;
  qualityScore += nutritionQualityPoints(daysLogged);
  qualityScore += workoutQualityPoints(workoutsLogged);
  qualityScore += sleepQualityPoints(sleepHours);
  qualityScore += streakQualityPoints(streakDays);

  if (qualityScore > MAX_DATA_QUALITY) {
    return MAX_DATA_QUALITY;
  }
  return qualityScore;
}

/**
 * Load coach context, optionally run day-14 macro recalibration, add quality metadata.
 * Flow: 1. day-14 macros  2. week snapshot  3. quality + recalibration note
 * @param {string} userId
 * @param {object} [userProfile]
 * @param {{ skipRecalibration?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function loadCoachContextEnhanced(userId, userProfile = {}, options = {}) {
  let skipRecalibration = false;
  if (options.skipRecalibration) {
    skipRecalibration = true;
  }

  let recalibrationResult = null;

  // 1. Day-14 macro tweak on the server (skipped when the caller says so).
  if (!skipRecalibration && userId) {
    recalibrationResult = await tryMacroRecalibrationOnServer(userId);
  }

  // 2. Server week first, then Firestore, then profile-only.
  const context = await loadCoachContext(userId, userProfile);

  // 3. Attach quality score and any recalibration note.
  return attachQualityAndRecalibration(context, recalibrationResult);
}

/**
 * Compact system-prompt block (server still builds the full prompt; this supplements userProfile).
 * Flow: 1. bail when empty  2. daily food lines  3. one text block
 * @param {object|null} context
 * @returns {string}
 */
export function buildContextSystemBlock(context) {
  if (!context) return '';

  const dailyLines = formatDailyFoodLogForPrompt(context.dailyFoodLog);
  let dailySection = '';
  if (dailyLines) {
    dailySection = `Daily food log:\n${dailyLines}\n`;
  }

  return `CLIENT ACCOUNT SNAPSHOT (from app):
User: ${context.userName}
Goal: ${context.goal}
Training level: ${context.trainingLevel}
Plan: ${context.currentPlan}
Nutrition: ${context.avgCals} kcal/day avg (target ${context.targetCals}), ${context.avgProtein}g protein, ${context.nutritionDaysLogged}/7 days logged (${context.nutritionConsistency}%)
${dailySection}Workouts: ${context.workoutsLogged} sessions, volume trend ${context.volumeTrend}, avg RPE ${context.avgRPE}
Sleep: ${context.avgSleep} h/night avg
Streak: ${context.streakDays} days
Trainer notes:
${context.trainerNotes}`;
}


// ===== PLUMBING — skip unless debugging =====

async function readSignedInUserIdToken() {
  if (!auth) return undefined;
  if (!auth.currentUser) return undefined;
  if (typeof auth.currentUser.getIdToken !== 'function') return undefined;
  return auth.currentUser.getIdToken();
}

/**
 * @param {string} apiBase
 * @param {string} userId
 * @param {object} headers
 * @returns {Promise<object|null>}
 */
async function fetchWeekFromOneApiBase(apiBase, userId, headers) {
  const trimmedBase = String(apiBase).replace(/\/$/, '');
  const url = `${trimmedBase}${WEEKLY_CONTEXT_PATH}/${encodeURIComponent(userId)}`;
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const weeklyJson = await response.json();
    return normalizeCoachContext({ ...weeklyJson, source: SOURCE_SERVER }, null);
  } catch (ignoredError) {
    return null;
  }
}

/**
 * vocab: Promise.allSettled = wait for every read; a missing doc does not fail the others.
 * @param {string} userId
 * @returns {Promise<PromiseSettledResult[]>}
 */
async function readProfileAndMacroDocs(userId) {
  return Promise.allSettled([
    getDoc(doc(db, USERS_COLLECTION, userId, PROFILE_SUBCOLLECTION, CURRENT_DOC_ID)),
    getDoc(doc(db, USERS_COLLECTION, userId)),
    getDoc(doc(db, USERS_COLLECTION, userId, MACRO_TARGETS_SUBCOLLECTION, CURRENT_DOC_ID)),
    getDoc(doc(db, NUTRITION_GOALS_COLLECTION, userId)),
  ]);
}

/**
 * @param {object} profile
 * @param {PromiseSettledResult} profileCurrentResult
 * @param {PromiseSettledResult} profileRootResult
 * @returns {object}
 */
function mergeLoadedProfile(profile, profileCurrentResult, profileRootResult) {
  let merged = profile;
  if (profileCurrentResult.status === 'fulfilled' && profileCurrentResult.value.exists()) {
    merged = { ...merged, ...profileCurrentResult.value.data() };
  }
  if (profileRootResult.status === 'fulfilled' && profileRootResult.value.exists()) {
    merged = { ...merged, ...profileRootResult.value.data() };
  }
  return merged;
}

/**
 * Newer nutrition_goals fields win when present.
 * @param {object} macroTargets
 * @param {PromiseSettledResult} macroCurrentResult
 * @param {PromiseSettledResult} nutritionGoalsResult
 * @returns {object}
 */
function mergeLoadedMacroTargets(macroTargets, macroCurrentResult, nutritionGoalsResult) {
  let merged = macroTargets;
  if (macroCurrentResult.status === 'fulfilled' && macroCurrentResult.value.exists()) {
    merged = { ...merged, ...macroCurrentResult.value.data() };
  }
  if (nutritionGoalsResult.status !== 'fulfilled' || !nutritionGoalsResult.value.exists()) {
    return merged;
  }
  const goalData = nutritionGoalsResult.value.data() || {};
  let nextCalories = merged.calories;
  if (goalData.calorie_target !== undefined && goalData.calorie_target !== null) {
    nextCalories = goalData.calorie_target;
  }
  let nextProtein = merged.protein;
  if (goalData.protein_target !== undefined && goalData.protein_target !== null) {
    nextProtein = goalData.protein_target;
  }
  let nextCarbs = merged.carbs;
  if (goalData.carbs_target !== undefined && goalData.carbs_target !== null) {
    nextCarbs = goalData.carbs_target;
  }
  let nextFat = merged.fat;
  if (goalData.fat_target !== undefined && goalData.fat_target !== null) {
    nextFat = goalData.fat_target;
  }
  return {
    ...merged,
    calories: nextCalories,
    protein: nextProtein,
    carbs: nextCarbs,
    fat: nextFat,
  };
}

/**
 * @param {string} userId
 * @param {object} userProfile
 * @returns {Promise<{ profile: object, macroTargets: object }>}
 */
async function loadProfileAndMacroTargets(userId, userProfile) {
  const [profileCurrentResult, profileRootResult, macroCurrentResult, nutritionGoalsResult] =
    await readProfileAndMacroDocs(userId);

  // Macros start from the caller's profile, same as before the Firestore docs merge.
  let startingMacros = {};
  if (userProfile && userProfile.macroTargets) {
    startingMacros = userProfile.macroTargets;
  }
  const profile = mergeLoadedProfile(userProfile, profileCurrentResult, profileRootResult);
  const macroTargets = mergeLoadedMacroTargets(
    startingMacros,
    macroCurrentResult,
    nutritionGoalsResult,
  );
  return { profile, macroTargets };
}

/**
 * @param {string} userId
 * @returns {Promise<PromiseSettledResult[]>}
 */
async function readPlanStreakPhotoAndNoteDocs(userId) {
  return Promise.allSettled([
    getDoc(doc(db, USERS_COLLECTION, userId, WORKOUT_PLANS_SUBCOLLECTION, CURRENT_DOC_ID)),
    getDoc(doc(db, USERS_COLLECTION, userId, STREAKS_SUBCOLLECTION, CURRENT_DOC_ID)),
    getDocs(
      query(collection(db, USERS_COLLECTION, userId, PROGRESS_PHOTOS_SUBCOLLECTION), limit(PHOTO_QUERY_LIMIT)),
    ),
    getDocs(
      query(collection(db, USERS_COLLECTION, userId, NOTES_AND_FILES_SUBCOLLECTION), limit(NOTES_QUERY_LIMIT)),
    ),
  ]);
}

/**
 * Display title from one workout plan doc.
 * @param {object} planData
 * @returns {string}
 */
function planDisplayName(planData) {
  if (planData && planData.name) return planData.name;
  if (planData && planData.title) return planData.title;
  return DEFAULT_PLAN_NAME;
}

/**
 * First active or assigned plan title from an already-loaded docs list.
 * @param {object[]} planDocs
 * @returns {string|null}
 */
function firstActivePlanNameFromDocs(planDocs) {
  for (let planIndex = 0; planIndex < planDocs.length; planIndex += 1) {
    const planData = planDocs[planIndex].data() || {};
    const isActive = planData.status === 'active' || planData.assigned;
    if (!isActive) continue;
    return planDisplayName(planData);
  }
  return null;
}

/**
 * First active or assigned plan in the workoutPlans subcollection.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function findFirstActivePlanName(userId) {
  try {
    const plansSnap = await getDocs(collection(db, USERS_COLLECTION, userId, WORKOUT_PLANS_SUBCOLLECTION));
    return firstActivePlanNameFromDocs(plansSnap.docs);
  } catch (ignoredError) {
    /* ignore — missing subcollection is fine */
  }
  return null;
}

/**
 * Prefer users/{id}/workoutPlans/current. Otherwise the first active/assigned plan.
 * @param {string} userId
 * @param {PromiseSettledResult} curPlanResult
 * @returns {Promise<string>}
 */
async function readCurrentPlanName(userId, curPlanResult) {
  if (curPlanResult.status === 'fulfilled' && curPlanResult.value.exists()) {
    return planDisplayName(curPlanResult.value.data());
  }
  const fromActiveList = await findFirstActivePlanName(userId);
  if (fromActiveList) return fromActiveList;
  return DEFAULT_PLAN_NAME;
}

/**
 * @param {PromiseSettledResult} streakResult
 * @returns {number}
 */
function streakDaysFromFirestoreResult(streakResult) {
  if (streakResult.status !== 'fulfilled' || !streakResult.value.exists()) return 0;
  const streakData = streakResult.value.data();
  let streakField;
  let currentStreakField;
  if (streakData) {
    streakField = streakData.streak;
    currentStreakField = streakData.currentStreak;
  }
  const fromStreak = pickFiniteNumber(streakField);
  if (fromStreak != null) return fromStreak;
  const fromCurrentStreak = pickFiniteNumber(currentStreakField);
  if (fromCurrentStreak != null) return fromCurrentStreak;
  return 0;
}

/**
 * @param {PromiseSettledResult} photoResult
 * @param {number} startMs
 * @returns {number}
 */
function countRecentPhotos(photoResult, startMs) {
  if (photoResult.status !== 'fulfilled') return 0;
  const photoDocs = photoResult.value.docs || [];
  let photoCount = 0;
  for (const photoDoc of photoDocs) {
    if (documentWasWrittenInLastSevenDays(photoDoc, startMs)) {
      photoCount += 1;
    }
  }
  return photoCount;
}

/**
 * First three recent note docs. Empty text is dropped after the slice, same as before.
 * @param {PromiseSettledResult} notesResult
 * @param {number} startMs
 * @returns {string}
 */
function recentTrainerNoteLines(notesResult, startMs) {
  if (notesResult.status !== 'fulfilled') return '';
  const noteDocs = notesResult.value.docs || [];
  const recentDocs = [];
  for (const noteDoc of noteDocs) {
    if (documentWasWrittenInLastSevenDays(noteDoc, startMs)) {
      recentDocs.push(noteDoc);
    }
  }
  const firstThree = recentDocs.slice(0, TRAINER_NOTE_LINE_CAP);
  const lines = [];
  for (const noteDoc of firstThree) {
    const data = noteDoc.data() || {};
    const text = data.note || data.text || data.title || data.name;
    if (text) {
      lines.push(`- ${String(text).trim()}`);
    }
  }
  return lines.join('\n');
}

/**
 * @param {string} userId
 * @param {number} startMs
 * @returns {Promise<{ currentPlan: string, streakDays: number, photoCount: number, trainerNotes: string }>}
 */
async function loadPlanStreakPhotosAndNotes(userId, startMs) {
  const [curPlanResult, streakResult, photoResult, notesResult] =
    await readPlanStreakPhotoAndNoteDocs(userId);
  const currentPlan = await readCurrentPlanName(userId, curPlanResult);
  const streakDays = streakDaysFromFirestoreResult(streakResult);
  const photoCount = countRecentPhotos(photoResult, startMs);
  const trainerNotes = recentTrainerNoteLines(notesResult, startMs);
  return { currentPlan, streakDays, photoCount, trainerNotes };
}

/**
 * One timestamp field: Firestore Timestamp returns immediately (even when old).
 * A string / Date / number only wins when it is actually inside the window.
 * @param {*} candidate
 * @param {number} startMs
 * @returns {{ decided: boolean, isRecent: boolean }}
 */
function decisionFromTimestampCandidate(candidate, startMs) {
  // vocab: toMillis() = Firestore Timestamp → milliseconds
  if (candidate && typeof candidate.toMillis === 'function') {
    return { decided: true, isRecent: candidate.toMillis() >= startMs };
  }
  if (typeof candidate === 'string') {
    const parsedMs = Date.parse(candidate);
    if (!Number.isNaN(parsedMs) && parsedMs >= startMs) {
      return { decided: true, isRecent: true };
    }
    return { decided: false, isRecent: false };
  }
  if (candidate instanceof Date && candidate.getTime() >= startMs) {
    return { decided: true, isRecent: true };
  }
  if (typeof candidate === 'number' && candidate >= startMs) {
    return { decided: true, isRecent: true };
  }
  return { decided: false, isRecent: false };
}

/**
 * True when this document was written in the last seven days.
 * Checks timestamp, date, createdAt, updatedAt, then the document id.
 * @param {object} docSnap
 * @param {number} startMs
 * @returns {boolean}
 */
function documentWasWrittenInLastSevenDays(docSnap, startMs) {
  const data = docSnap.data() || {};
  const candidates = [data.timestamp, data.date, data.createdAt, data.updatedAt];
  for (const candidate of candidates) {
    const decision = decisionFromTimestampCandidate(candidate, startMs);
    if (decision.decided) return decision.isRecent;
  }
  const idMs = Date.parse(docSnap.id);
  if (!Number.isNaN(idMs) && idMs >= startMs) return true;
  return false;
}

/**
 * Docs in a collection from the last seven days. Falls back to a full read
 * when the timestamp index is missing.
 * @param {object} colRef
 * @param {number} startMs
 * @returns {Promise<object[]>}
 */
async function queryLast7Docs(colRef, startMs) {
  // vocab: Timestamp.fromMillis = JS milliseconds → Firestore timestamp for where().
  const startTs = Timestamp.fromMillis(startMs);
  try {
    const snapshot = await getDocs(
      query(colRef, where('timestamp', '>=', startTs), orderBy('timestamp', 'desc')),
    );
    return snapshot.docs;
  } catch (ignoredError) {
    return queryLast7DocsWithoutIndex(colRef, startMs);
  }
}

/**
 * @param {object[]} docs
 * @param {number} startMs
 * @returns {object[]}
 */
function docsInLast7Days(docs, startMs) {
  const recentDocs = [];
  for (const snapshotDoc of docs || []) {
    if (documentWasWrittenInLastSevenDays(snapshotDoc, startMs)) {
      recentDocs.push(snapshotDoc);
    }
  }
  return recentDocs;
}

/**
 * @param {object} colRef
 * @param {number} startMs
 * @returns {Promise<object[]>}
 */
async function queryLast7DocsWithoutIndex(colRef, startMs) {
  try {
    const snapshot = await getDocs(colRef);
    return docsInLast7Days(snapshot.docs, startMs);
  } catch (ignoredError) {
    return [];
  }
}


/**
 * @param {boolean} isAuthRejected
 * @returns {{ stop: boolean, result: null }}
 */
function failedRecalibrationAttempt(isAuthRejected) {
  return { stop: isAuthRejected, result: null };
}

/**
 * @param {string} base
 * @param {string} idToken
 * @returns {Promise<{ stop: boolean, result: object|null }>}
 */
async function tryOneRecalibrationBase(base, idToken) {
  const url = `${String(base).replace(/\/$/, '')}${MACRO_RECALIBRATION_PATH}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const isAuthRejected =
        response.status === HTTP_UNAUTHORIZED || response.status === HTTP_FORBIDDEN;
      return failedRecalibrationAttempt(isAuthRejected);
    }
    if (data.reason === 'not_enough_data') {
      return { stop: true, result: { success: true, skipped: true, reason: 'not_enough_data' } };
    }
    return {
      stop: true,
      result: {
        success: data.success !== false,
        adjusted: data.adjusted === true,
        message: data.message,
        details: data.details,
        skipped: false,
      },
    };
  } catch (ignoredError) {
    return { stop: false, result: null };
  }
}

/**
 * Day-14 macro recalibration via server Admin SDK (avoids client Firestore permission gaps).
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function runMacroRecalibrationViaServer(userId) {
  const idToken = await readSignedInUserIdToken();
  if (!idToken) return { success: true, skipped: true, reason: 'not_signed_in' };

  const { shouldRecalibrateMacros } = await import('../../nutrition/targets/recalculateFoodTargets');
  const eligible = await shouldRecalibrateMacros(userId);
  if (!eligible) return { success: true, skipped: true, reason: 'not_eligible' };

  const coachApiBases = getAICoachApiBases();
  for (let baseIndex = 0; baseIndex < coachApiBases.length; baseIndex += 1) {
    const apiBase = coachApiBases[baseIndex];
    const attempt = await tryOneRecalibrationBase(apiBase, idToken);
    if (attempt.result) return attempt.result;
    if (attempt.stop) break;
  }

  return { success: true, skipped: true, reason: 'server_unreachable' };
}

/**
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function tryMacroRecalibrationOnServer(userId) {
  try {
    return await runMacroRecalibrationViaServer(userId);
  } catch (error) {
    let errorMessage = error;
    if (error && error.message) {
      errorMessage = error.message;
    }
    console.warn('[loadCoachContextEnhanced] recalibration skipped:', errorMessage);
    return null;
  }
}

/**
 * @param {object} context
 * @param {object|null} recalibrationResult
 * @returns {object}
 */
function attachQualityAndRecalibration(context, recalibrationResult) {
  const enriched = {
    ...context,
    _lastUpdated: new Date().toISOString(),
    _dataQuality: calculateDataQuality(context),
    _recalibration: recalibrationResult,
  };
  let recalibrationAdjusted = false;
  let recalibrationMessage;
  if (recalibrationResult) {
    recalibrationAdjusted = recalibrationResult.adjusted;
    recalibrationMessage = recalibrationResult.message;
  }
  if (recalibrationAdjusted && recalibrationMessage) {
    enriched._recalibrationNote = recalibrationMessage;
  }
  return enriched;
}

/**
 * One day's meals as "Breakfast: eggs (300 cal); …"
 * @param {object} dayRow
 * @returns {string}
 */
function oneDayFoodLine(dayRow) {
  const mealBits = [];
  const meals = dayRow.meals || [];
  for (const meal of meals) {
    mealBits.push(`${meal.meal}: ${meal.food} (${meal.calories} cal)`);
  }
  const mealText = mealBits.join('; ');
  const foodFallback = (dayRow.foods || []).join(', ');
  const detail = mealText || foodFallback;
  return `${dayRow.date}: ${dayRow.calories} cal — ${detail}`;
}

/**
 * @param {Array|undefined} dailyFoodLog
 * @returns {string}
 */
function formatDailyFoodLogForPrompt(dailyFoodLog) {
  if (!Array.isArray(dailyFoodLog) || !dailyFoodLog.length) return '';
  const dayLines = [];
  for (const dayRow of dailyFoodLog) {
    dayLines.push(oneDayFoodLine(dayRow));
  }
  return dayLines.join('\n');
}
