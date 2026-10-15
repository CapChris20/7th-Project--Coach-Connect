// Builds the 7-day snapshot the AI Coach shows on chips and sends in the prompt.
// Flow: try the server week → if that fails, read Firestore on the phone →
//       fold the numbers into one chip/prompt shape → optionally run day-14 macros.
// Used by: the coach conversation screen and the coach self-test.

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

// ===== MAIN FUNCTION =====

/**
 * Normalize server weekly-context or client aggregate into chip + prompt shape.
 * Flow: 1. pull the three week slices  2. targets  3. identity  4. one object the chips read
 * @param {object|null} raw
 * @param {object} [userProfile]
 * @returns {object|null}
 */
export function normalizeCoachContext(raw, userProfile = {}) {
  if (!raw) return null;

  const nutritionAnalysis = raw.nutritionAnalysis || {};
  const workoutAnalysis = raw.workoutAnalysis || {};
  const sleepAnalysis = raw.sleepAnalysis || {};
  const macroTargets = raw.macroTargets || userProfile?.macroTargets || {};
  const userFields = raw.user || userProfile || {};

  // 1. Week averages the chips show (calories / protein / days logged).
  const nutrition = nutritionChipNumbers(raw, nutritionAnalysis);
  const workoutsLogged = toFiniteNumber(workoutAnalysis.sessionsLogged) ?? toFiniteNumber(raw.workoutsLogged) ?? 0;
  const avgRPE = toFiniteNumber(workoutAnalysis.avgRPE) ?? toFiniteNumber(raw.avgRPE);
  const volumeTrend =
    workoutAnalysis.volumeTrend || raw.volumeTrend || (workoutsLogged > 0 ? VOLUME_TREND_LOGGED : VOLUME_TREND_NONE);
  const avgSleep =
    sleepAnalysis.avgHours != null ? Number(sleepAnalysis.avgHours).toFixed(1) : raw.avgSleep ?? MISSING_SLEEP_LABEL;
  const wellness = raw.wellnessAnalysis || raw.wellness || {};
  const stepsAvg = toFiniteNumber(wellness?.steps?.avgDaily) ?? 0;
  const hasWorkoutPlan = Boolean(raw.workoutPlan?.activePlan?.summary);

  // 2. Daily targets from the saved macros (several field spellings).
  const targets = targetChipNumbers(raw, userProfile, macroTargets);

  // 3. Name, goal, and training level for the prompt header.
  const identity = identityChipFields(raw, userProfile, userFields);

  // 4. One object. Keys stay the names the chips and prompt already read.
  return {
    userName: identity.userName,
    goal: identity.goal,
    trainingLevel: identity.trainingLevel,
    currentPlan: raw.currentPlan || raw.currentPlanName || DEFAULT_PLAN_NAME,
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
    workoutsLogged,
    volumeTrend,
    avgRPE: avgRPE != null ? Number(avgRPE).toFixed(1) : MISSING_RPE_LABEL,
    avgSleep,
    stepsAvg,
    hasWorkoutPlan,
    streakDays:
      toFiniteNumber(raw.streakData?.currentStreak) ?? toFiniteNumber(raw.streakDays) ?? toFiniteNumber(raw.currentStreak) ?? 0,
    photoCount: toFiniteNumber(raw.photoCount) ?? 0,
    trainerNotes: raw.trainerNotes || DEFAULT_TRAINER_NOTES,
    source: raw.source || SOURCE_UNKNOWN,
    dailyFoodLog: nutritionAnalysis.dailyBreakdown || raw.dailyBreakdown || [],
  };
}

/**
 * Fetch authoritative weekly context from Express API.
 * Flow: 1. need a signed-in token  2. try each API base  3. chip shape or null
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
export async function fetchWeeklyContextFromServer(userId) {
  if (!userId) return null;

  // 1. The weekly-context route needs a signed-in token.
  const idToken = await signedInIdToken();
  if (!idToken) return null;

  // 2. Walk each API base until one returns a week.
  const headers = { Authorization: `Bearer ${idToken}` };
  for (const base of getResilientApiBases()) {
    const fromThisBase = await tryOneWeeklyContextBase(base, userId, headers);
    if (fromThisBase) return fromThisBase;
  }

  // 3. Every base missed — the caller will try Firestore on the phone.
  return null;
}

/**
 * Client-side 7-day Firestore aggregation (fallback).
 * Flow: 1. profile + macros  2. week numbers  3. plan / streak / photos / notes  4. chip shape
 * @param {string} userId
 * @param {object} [userProfile]
 * @returns {Promise<object|null>}
 */
export async function aggregateUserContext(userId, userProfile = {}) {
  if (!userId || !db) return null;

  try {
    const startMs = Date.now() - SEVEN_DAYS_IN_MS;

    // 1. Profile + saved macros from the four Firestore docs.
    const { profile, macroTargets } = await loadProfileAndMacros(userId, userProfile);

    // 2. Seven-day nutrition / workout / sleep numbers.
    const { nutritionAnalysis, workoutAnalysis, sleepAnalysis } =
      await aggregateCoachWeeklyDataClient(userId);

    // 3. Current plan, streak, recent photos, trainer notes.
    const extras = await loadPlanStreakPhotosAndNotes(userId, startMs);

    // 4. Same chip/prompt shape as the server payload.
    return normalizeCoachContext(
      {
        user: {
          age: profile?.age,
          weight: profile?.weight,
          height: profile?.height,
          goal: profile?.primaryGoal || profile?.goal,
          trainingLevel: profile?.fitnessLevel || profile?.trainingLevel,
        },
        macroTargets,
        nutritionAnalysis,
        workoutAnalysis,
        sleepAnalysis,
        currentPlan: extras.currentPlan,
        streakDays: extras.streakDays,
        photoCount: extras.photoCount,
        trainerNotes: extras.trainerNotes || DEFAULT_TRAINER_NOTES,
        source: SOURCE_CLIENT,
      },
      profile,
    );
  } catch (error) {
    console.error('[contextAggregation] aggregateUserContext failed:', error);
    return null;
  }
}

/**
 * Best available 7-day context: server first, Firestore fallback.
 * Flow: 1. server week  2. phone Firestore  3. profile-only so chips still render
 * @param {string} userId
 * @param {object} [userProfile]
 * @returns {Promise<object|null>}
 */
export async function loadCoachContext(userId, userProfile = {}) {
  // 1. Server week is the source of truth when the phone is online.
  const fromServer = await fetchWeeklyContextFromServer(userId);
  if (fromServer) return { ...fromServer, source: SOURCE_SERVER };

  // 2. Offline / server down → read Firestore on the phone.
  const fromClient = await aggregateUserContext(userId, userProfile);
  if (fromClient) return fromClient;

  // 3. Brand-new account with no logs still gets name/goal chips.
  return normalizeCoachContext(
    {
      user: userProfile,
      macroTargets: userProfile?.macroTargets,
      source: SOURCE_PROFILE_ONLY,
    },
    userProfile,
  );
}

/**
 * 0–100 score for how much logged data the coach can use.
 * @param {object|null} context
 * @returns {number}
 */
export function calculateDataQuality(context) {
  if (!context) return 0;
  const daysLogged = Number(context.nutritionDaysLogged) || 0;
  const workoutsLogged = Number(context.workoutsLogged) || 0;
  const sleepHours = parseFloat(context.avgSleep);
  const streakDays = Number(context.streakDays) || 0;

  const quality =
    nutritionQualityPoints(daysLogged) +
    workoutQualityPoints(workoutsLogged) +
    sleepQualityPoints(sleepHours) +
    streakQualityPoints(streakDays);

  return Math.min(MAX_DATA_QUALITY, quality);
}

/**
 * Loads coach context, optionally runs day-14 macro recalibration, adds quality metadata.
 * Flow: 1. day-14 macros  2. week snapshot  3. quality + note
 * @param {string} userId
 * @param {object} [userProfile]
 * @param {{ skipRecalibration?: boolean }} [options]
 * @returns {Promise<object>}
 */
export async function loadCoachContextEnhanced(userId, userProfile = {}, options = {}) {
  const { skipRecalibration = false } = options;
  let recalibrationResult = null;

  // 1. Day-14 macro tweak on the server (skipped when the caller says so).
  if (!skipRecalibration && userId) {
    recalibrationResult = await tryMacroRecalibration(userId);
  }

  // 2. Server week first, then Firestore, then profile-only.
  const context = await loadCoachContext(userId, userProfile);

  // 3. Attach quality score and any recalibration note.
  return enrichContextWithQuality(context, recalibrationResult);
}

/**
 * Compact system-prompt block (server still builds the full prompt; this supplements userProfile).
 * @param {object|null} context
 * @returns {string}
 */
export function buildContextSystemBlock(context) {
  if (!context) return '';
  const dailyLines = formatDailyFoodLogForPrompt(context.dailyFoodLog);
  return `CLIENT ACCOUNT SNAPSHOT (from app):
User: ${context.userName}
Goal: ${context.goal}
Training level: ${context.trainingLevel}
Plan: ${context.currentPlan}
Nutrition: ${context.avgCals} kcal/day avg (target ${context.targetCals}), ${context.avgProtein}g protein, ${context.nutritionDaysLogged}/7 days logged (${context.nutritionConsistency}%)
${dailyLines ? `Daily food log:\n${dailyLines}\n` : ''}Workouts: ${context.workoutsLogged} sessions, volume trend ${context.volumeTrend}, avg RPE ${context.avgRPE}
Sleep: ${context.avgSleep} h/night avg
Streak: ${context.streakDays} days
Trainer notes:
${context.trainerNotes}`;
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging

/**
 * Finite number, or null when the value is not a number.
 * @param {*} value
 * @returns {number|null}
 */
function toFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Average of the finite numbers. Null when there are none.
 * @param {Array<number|null>} values
 * @returns {number|null}
 */
function mean(values) {
  const finiteValues = (values || []).filter((value) => Number.isFinite(value));
  if (!finiteValues.length) return null;
  const total = finiteValues.reduce((sum, value) => sum + value, 0);
  return total / finiteValues.length;
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
  if (candidate?.toMillis) {
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
function docInLast7Days(docSnap, startMs) {
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
  } catch (_) {
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
    if (docInLast7Days(snapshotDoc, startMs)) recentDocs.push(snapshotDoc);
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
  } catch (_) {
    return [];
  }
}

/**
 * @returns {Promise<string|undefined>}
 */
async function signedInIdToken() {
  return auth?.currentUser?.getIdToken?.();
}

/**
 * @param {string} base
 * @param {string} userId
 * @param {object} headers
 * @returns {Promise<object|null>}
 */
async function tryOneWeeklyContextBase(base, userId, headers) {
  const url = `${String(base).replace(/\/$/, '')}${WEEKLY_CONTEXT_PATH}/${encodeURIComponent(userId)}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const weekly = await res.json();
    return normalizeCoachContext({ ...weekly, source: SOURCE_SERVER }, null);
  } catch (_) {
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
 * Newer nutrition_goals fields win when present. vocab: ?? keeps a saved 0.
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
  return {
    ...merged,
    calories: goalData.calorie_target ?? merged.calories,
    protein: goalData.protein_target ?? merged.protein,
    carbs: goalData.carbs_target ?? merged.carbs,
    fat: goalData.fat_target ?? merged.fat,
  };
}

/**
 * @param {string} userId
 * @param {object} userProfile
 * @returns {Promise<{ profile: object, macroTargets: object }>}
 */
async function loadProfileAndMacros(userId, userProfile) {
  const [profileCurrentResult, profileRootResult, macroCurrentResult, nutritionGoalsResult] =
    await readProfileAndMacroDocs(userId);
  // Macros start from the caller's profile, same as before the Firestore docs merge.
  const startingMacros = userProfile?.macroTargets || {};
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
    getDocs(query(collection(db, USERS_COLLECTION, userId, PROGRESS_PHOTOS_SUBCOLLECTION), limit(PHOTO_QUERY_LIMIT))),
    getDocs(query(collection(db, USERS_COLLECTION, userId, NOTES_AND_FILES_SUBCOLLECTION), limit(NOTES_QUERY_LIMIT))),
  ]);
}

/**
 * Prefer users/{id}/workoutPlans/current. Otherwise the first active/assigned plan.
 * @param {string} userId
 * @param {PromiseSettledResult} curPlanResult
 * @returns {Promise<string>}
 */
async function readCurrentPlanName(userId, curPlanResult) {
  if (curPlanResult.status === 'fulfilled' && curPlanResult.value.exists()) {
    const planData = curPlanResult.value.data();
    return planData?.name || planData?.title || DEFAULT_PLAN_NAME;
  }
  try {
    const plansSnap = await getDocs(collection(db, USERS_COLLECTION, userId, WORKOUT_PLANS_SUBCOLLECTION));
    const active = plansSnap.docs.find((planDoc) => planDoc.data()?.status === 'active' || planDoc.data()?.assigned);
    if (active) return active.data()?.name || active.data()?.title || DEFAULT_PLAN_NAME;
  } catch (_) {
    /* ignore */
  }
  return DEFAULT_PLAN_NAME;
}

/**
 * @param {PromiseSettledResult} streakResult
 * @returns {number}
 */
function streakDaysFromResult(streakResult) {
  if (streakResult.status !== 'fulfilled' || !streakResult.value.exists()) return 0;
  const streakData = streakResult.value.data();
  return toFiniteNumber(streakData?.streak) ?? toFiniteNumber(streakData?.currentStreak) ?? 0;
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
    if (docInLast7Days(photoDoc, startMs)) photoCount += 1;
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
    if (docInLast7Days(noteDoc, startMs)) recentDocs.push(noteDoc);
  }
  const firstThree = recentDocs.slice(0, TRAINER_NOTE_LINE_CAP);
  const lines = [];
  for (const noteDoc of firstThree) {
    const data = noteDoc.data() || {};
    const text = data.note || data.text || data.title || data.name;
    if (text) lines.push(`- ${String(text).trim()}`);
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
  const streakDays = streakDaysFromResult(streakResult);
  const photoCount = countRecentPhotos(photoResult, startMs);
  const trainerNotes = recentTrainerNoteLines(notesResult, startMs);
  return { currentPlan, streakDays, photoCount, trainerNotes };
}

/**
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
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const isAuthRejected = res.status === HTTP_UNAUTHORIZED || res.status === HTTP_FORBIDDEN;
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
  } catch (_) {
    return { stop: false, result: null };
  }
}

/**
 * Day-14 macro recalibration via server Admin SDK (avoids client Firestore permission gaps).
 * @param {string} userId
 * @returns {Promise<object>}
 */
async function runMacroRecalibrationViaServer(userId) {
  const idToken = await signedInIdToken();
  if (!idToken) return { success: true, skipped: true, reason: 'not_signed_in' };

  const { shouldRecalibrateMacros } = await import('../../nutrition/targets/recalculateFoodTargets');
  const eligible = await shouldRecalibrateMacros(userId);
  if (!eligible) return { success: true, skipped: true, reason: 'not_eligible' };

  for (const base of getAICoachApiBases()) {
    const attempt = await tryOneRecalibrationBase(base, idToken);
    if (attempt.result) return attempt.result;
    if (attempt.stop) break;
  }

  return { success: true, skipped: true, reason: 'server_unreachable' };
}

/**
 * @param {string} userId
 * @returns {Promise<object|null>}
 */
async function tryMacroRecalibration(userId) {
  try {
    return await runMacroRecalibrationViaServer(userId);
  } catch (error) {
    console.warn('[loadCoachContextEnhanced] recalibration skipped:', error?.message || error);
    return null;
  }
}

/**
 * @param {object} context
 * @param {object|null} recalibrationResult
 * @returns {object}
 */
function enrichContextWithQuality(context, recalibrationResult) {
  const enriched = {
    ...context,
    _lastUpdated: new Date().toISOString(),
    _dataQuality: calculateDataQuality(context),
    _recalibration: recalibrationResult,
  };
  if (recalibrationResult?.adjusted && recalibrationResult?.message) {
    enriched._recalibrationNote = recalibrationResult.message;
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
  return `${dayRow.date}: ${dayRow.calories} cal — ${mealText || foodFallback}`;
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

/**
 * @param {object} raw
 * @param {object} nutritionAnalysis
 * @returns {{ avgCals: number, avgProtein: number, avgCarbs: number, avgFat: number, daysLogged: number, nutritionConsistency: number }}
 */
function nutritionChipNumbers(raw, nutritionAnalysis) {
  return {
    avgCals: Math.round(toFiniteNumber(nutritionAnalysis.avgDailyCalories) ?? toFiniteNumber(raw.avgCals) ?? 0),
    avgProtein: Math.round(toFiniteNumber(nutritionAnalysis.avgProtein) ?? toFiniteNumber(raw.avgProtein) ?? 0),
    avgCarbs: Math.round(toFiniteNumber(nutritionAnalysis.avgCarbs) ?? toFiniteNumber(raw.avgCarbs) ?? 0),
    avgFat: Math.round(toFiniteNumber(nutritionAnalysis.avgFat) ?? toFiniteNumber(raw.avgFat) ?? 0),
    daysLogged:
      toFiniteNumber(nutritionAnalysis.totalLoggedDaysAllTime) ??
      toFiniteNumber(nutritionAnalysis.daysLogged) ??
      toFiniteNumber(raw.nutritionDaysLogged) ??
      0,
    nutritionConsistency: toFiniteNumber(nutritionAnalysis.consistencyScore) ?? 0,
  };
}

/**
 * @param {object} raw
 * @param {object} userProfile
 * @param {object} macroTargets
 * @returns {{ targetCals: number, targetProtein: number, targetCarbs: number, targetFat: number }}
 */
function targetChipNumbers(raw, userProfile, macroTargets) {
  return {
    targetCals: Math.round(
      toFiniteNumber(macroTargets.calories) ??
        toFiniteNumber(macroTargets.cals) ??
        toFiniteNumber(macroTargets.calorie_target) ??
        toFiniteNumber(userProfile?.calories) ??
        toFiniteNumber(raw.targetCals) ??
        0,
    ),
    targetProtein: Math.round(
      toFiniteNumber(macroTargets.protein) ??
        toFiniteNumber(macroTargets.protein_target) ??
        toFiniteNumber(userProfile?.proteinTarget) ??
        toFiniteNumber(raw.targetProtein) ??
        0,
    ),
    targetCarbs: Math.round(toFiniteNumber(macroTargets.carbs) ?? toFiniteNumber(raw.targetCarbs) ?? 0),
    targetFat: Math.round(toFiniteNumber(macroTargets.fat) ?? toFiniteNumber(raw.targetFat) ?? 0),
  };
}

/**
 * @param {object} raw
 * @param {object} userProfile
 * @param {object} userFields
 * @returns {{ userName: string, goal: string, trainingLevel: string }}
 */
function identityChipFields(raw, userProfile, userFields) {
  const goalRaw = userFields.goal || userProfile?.primaryGoal || userProfile?.goal || raw.goal || '';
  return {
    userName: userProfile?.firstName || userProfile?.name || userFields.firstName || DEFAULT_USER_NAME,
    goal: showSetupAnswers(goalRaw, '') || String(goalRaw || DEFAULT_GOAL_LABEL),
    trainingLevel:
      showSetupAnswers(userFields.trainingLevel || userProfile?.fitnessLevel, '') ||
      userFields.trainingLevel ||
      userProfile?.fitnessLevel ||
      MISSING_LEVEL_LABEL,
  };
}

