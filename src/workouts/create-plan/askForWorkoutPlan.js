// Asks the workout-generation API for a plan, and loads the onboarding answers that go into that request.
// Flow: auth headers → try each API base → treat 429 as a monthly cap → return plan text (or a clear error).
// Used by the create-plan screens. Keep this out of the UI so trainer and client share one request path.

import { auth, db } from '../../app-start/cloudConnection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { getCurrentWorkoutPlan } from '../create-plan/saveAndLoadWorkoutPlan';
import { getApiAuthHeaders } from '../../for-both/online-connection/attachLoginProof';
import { getWorkoutGenerationApiBases } from '../../for-both/online-connection/whereToConnect';
import { postJsonWithTimeout, logApiAttempt } from '../../for-both/online-connection/sendOnlineRequest';
import { formatWorkoutLimitResetLabel } from '../create-plan/countPlansCreated';
import { buildWorkoutOnboardingPayload } from './planRequestAnswers';
import { normalizeClientProfileFields } from '../../helpers/fillTraineeProfile';

// ===== NAMED CONSTANTS =====

const WORKOUT_PLAN_FETCH_TIMEOUT_MS = 180000;
const JSON_CONTENT_TYPE = 'application/json';
const WORKOUT_GENERATE_PATH = '/api/workout/generate';
const API_LOG_LABEL = 'workout/generate';
const USERS_COLLECTION = 'users';
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_GATEWAY_TIMEOUT = 504;
const RETRYABLE_HTTP_STATUSES = [
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_BAD_GATEWAY,
  HTTP_STATUS_SERVICE_UNAVAILABLE,
  HTTP_STATUS_GATEWAY_TIMEOUT,
];
const MONTHLY_LIMIT_ERROR_CODE = 'monthly_limit_reached';
const TIMEOUT_ERROR_CODE = 'timeout';
const MAX_LOGGED_API_BASES = 6;
const SIGN_IN_REQUIRED_MESSAGE = 'Sign in to generate a workout plan.';
const EMPTY_GENERATOR_MESSAGE = 'Empty response from workout generator';
const USER_NOT_FOUND_MESSAGE = 'User not found';

// ===== HELPER FUNCTIONS =====

function isMonthlyLimitResponse(httpStatus, payload) {
  return httpStatus === HTTP_STATUS_TOO_MANY_REQUESTS && payload?.error === MONTHLY_LIMIT_ERROR_CODE;
}

function buildMonthlyLimitError(payload) {
  const limitError = new Error(
    payload.message ||
      `You've used all your workout generations for this month. Resets ${formatWorkoutLimitResetLabel(payload.resets_at)}.`,
  );
  limitError.code = MONTHLY_LIMIT_ERROR_CODE;
  limitError.limitPayload = payload;
  return limitError;
}

function isRetryableHttpStatus(httpStatus) {
  return RETRYABLE_HTTP_STATUSES.includes(httpStatus);
}

function buildHttpFailureError(payload, httpStatus) {
  const httpError = new Error(payload?.message || payload?.error || `Request failed (${httpStatus})`);
  httpError.httpStatus = httpStatus;
  return httpError;
}

async function tryOneWorkoutApiBase(url, requestBody, headers) {
  try {
    const res = await postJsonWithTimeout(url, requestBody, headers, WORKOUT_PLAN_FETCH_TIMEOUT_MS);
    const payload = await res.json().catch(() => ({}));
    const outcome = interpretWorkoutApiResponse(res, payload);
    if (outcome.shouldRetry) {
      logApiAttempt(API_LOG_LABEL, url, outcome.error);
      return { didSucceed: false, error: outcome.error };
    }
    if (__DEV__) {
      console.log('[workout] generate plan OK via', url);
    }
    return { didSucceed: true, plan: outcome.plan };
  } catch (caughtError) {
    logApiAttempt(API_LOG_LABEL, url, caughtError);
    if (shouldRethrowWorkoutError(caughtError)) throw caughtError;
    return { didSucceed: false, error: caughtError };
  }
}

function interpretWorkoutApiResponse(res, payload) {
  if (isMonthlyLimitResponse(res.status, payload)) {
    throw buildMonthlyLimitError(payload);
  }
  if (!res.ok) {
    const httpError = buildHttpFailureError(payload, res.status);
    if (isRetryableHttpStatus(res.status)) {
      return { shouldRetry: true, error: httpError };
    }
    httpError.fromHttpResponse = true;
    throw httpError;
  }
  if (!payload?.text) {
    throw new Error(EMPTY_GENERATOR_MESSAGE);
  }
  return {
    shouldRetry: false,
    plan: {
      text: String(payload.text),
      usage: payload.usage ?? null,
    },
  };
}

function shouldRethrowWorkoutError(caughtError) {
  if (caughtError?.code === MONTHLY_LIMIT_ERROR_CODE) return true;
  if (caughtError?.code === TIMEOUT_ERROR_CODE) return true;
  if (caughtError?.fromHttpResponse) return true;
  return false;
}

function workoutApiGiveUpHint(lastError) {
  const errorMessage = String(lastError?.message || '');
  if (errorMessage.includes('timed out')) {
    return 'The server took too long. Try again on Wi-Fi.';
  }
  if (errorMessage.includes('404') || lastError?.httpStatus === HTTP_STATUS_NOT_FOUND) {
    return 'Workout API missing on Cloud Run (stale deploy). Run: npm run server — or redeploy with ./server/deploy.sh';
  }
  if (errorMessage.includes('AI provider unavailable')) {
    return 'Workout generation needs ANTHROPIC_API_KEY on Cloud Run. Add it to .env, then run: ./scripts/syncCloudRunEnv.sh';
  }
  return 'Could not reach the workout API. Check internet, then reload with: npm start (dev build).';
}

function onboardingCacheKey(subjectUid) {
  return `onboarding_data_${subjectUid}`;
}

async function loadOnboardingFromUserDoc(subjectUid) {
  if (!db) return null;
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, subjectUid));
  if (!userSnapshot.exists()) return null;
  return normalizeClientProfileFields(userSnapshot.data());
}

async function loadOnboardingFromCache(subjectUid) {
  const cached = await AsyncStorage.getItem(onboardingCacheKey(subjectUid));
  if (!cached) return null;
  return normalizeClientProfileFields(JSON.parse(cached));
}

// ===== MAIN FUNCTION =====

/**
 * POST onboarding answers to /api/workout/generate, trying each configured API base.
 * A 429 monthly cap is thrown immediately. 404/502/503/504 fall through to the next base.
 * @param {object} onboardingData
 * @param {string} [subjectUserId]
 * @returns {Promise<{ text: string, usage: * }>}
 */
export async function askForWorkoutPlanFromApi(onboardingData, subjectUserId) {
  const headers = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
  if (!headers.Authorization) {
    throw new Error(SIGN_IN_REQUIRED_MESSAGE);
  }

  const apiBases = getWorkoutGenerationApiBases();
  const requestBody = {
    onboardingData: buildWorkoutOnboardingPayload(onboardingData),
    subjectUserId: subjectUserId || auth.currentUser?.uid,
  };

  if (__DEV__) {
    console.log('[workout] generate plan - trying API bases:', apiBases.slice(0, MAX_LOGGED_API_BASES).join(' -> '));
  }

  let lastError = null;
  for (const apiBase of apiBases) {
    const url = `${String(apiBase).replace(/\/$/, '')}${WORKOUT_GENERATE_PATH}`;
    const attempt = await tryOneWorkoutApiBase(url, requestBody, headers);
    if (attempt.didSucceed) return attempt.plan;
    lastError = attempt.error;
  }

  const triedBases = apiBases.slice(0, MAX_LOGGED_API_BASES).join(', ');
  const hint = workoutApiGiveUpHint(lastError);
  throw lastError || new Error(`${hint}${triedBases ? ` Tried: ${triedBases}` : ''}`);
}

/**
 * Load onboarding answers (Firestore, then local cache) and the current workout plan.
 * @param {{ userId?: string, propPlan?: object }} [options]
 * @returns {Promise<{ onboardingData: object|null, plan: object|null }>}
 */
export async function loadOnboardingAndPlanArtifacts({ userId, propPlan } = {}) {
  const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
  if (!subjectUid) {
    throw new Error(USER_NOT_FOUND_MESSAGE);
  }
  let onboardingData = await loadOnboardingFromUserDoc(subjectUid);
  if (!onboardingData) {
    onboardingData = await loadOnboardingFromCache(subjectUid);
  }
  let plan = propPlan || null;
  if (!plan) {
    plan = await getCurrentWorkoutPlan(subjectUid);
  }
  return { onboardingData, plan };
}

/**
 * Generate a workout plan and stamp it with when it was created.
 * @param {{ onboardingData: object, userId?: string }} options
 * @returns {Promise<{ planText: string, generatedAt: number, userData: object, usage: * }>}
 */
export async function generateWorkoutPlanWithClaude({ onboardingData, userId }) {
  const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
  const { text, usage } = await askForWorkoutPlanFromApi(onboardingData, subjectUid);
  return {
    planText: text,
    generatedAt: Date.now(),
    userData: onboardingData,
    usage,
  };
}
