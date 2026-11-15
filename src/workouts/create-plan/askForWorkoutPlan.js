// Asks the workout-generation API for a plan, and loads onboarding answers for that request.
// Flow: auth headers → try each API base → 429 = monthly cap → return plan text (or a clear error).
// Used by create-plan screens and workoutPlanCreation. Shared by trainer and client — no UI here.

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

// Manipulate here: how long we wait for Claude on Cloud Run before timing out (ms)
const WORKOUT_GENERATE_FETCH_TIMEOUT_MS = 180000;
const JSON_CONTENT_TYPE = 'application/json';
// Manipulate here: must match the Express route that builds the plan
const WORKOUT_GENERATE_PATH = '/api/workout/generate';
const WORKOUT_GENERATE_API_LOG_LABEL = 'workout/generate';
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

/**
 * Signed-in Firebase uid, or undefined when nobody is logged in.
 * @returns {string|undefined}
 */
function signedInUserUid() {
  const signedInUser = auth.currentUser;
  if (!signedInUser) {
    return undefined;
  }
  return signedInUser.uid;
}

/**
 * True when the server answered 429 with the monthly-cap error code.
 * @param {number} httpStatus
 * @param {object} payload
 * @returns {boolean}
 */
function responseIsMonthlyLimit(httpStatus, payload) {
  if (httpStatus !== HTTP_STATUS_TOO_MANY_REQUESTS) {
    return false;
  }
  if (!payload) {
    return false;
  }
  return payload.error === MONTHLY_LIMIT_ERROR_CODE;
}

/**
 * Build the Error the UI shows for a monthly generation cap.
 * @param {object} payload
 * @returns {Error}
 */
function buildMonthlyLimitError(payload) {
  const resetLabel = formatWorkoutLimitResetLabel(payload.resets_at);
  const defaultMessage = `You've used all your workout generations for this month. Resets ${resetLabel}.`;
  let message = defaultMessage;
  if (payload.message) {
    message = payload.message;
  }
  const limitError = new Error(message);
  limitError.code = MONTHLY_LIMIT_ERROR_CODE;
  limitError.limitPayload = payload;
  return limitError;
}

/**
 * True for statuses where we should try the next API base.
 * @param {number} httpStatus
 * @returns {boolean}
 */
function httpStatusIsRetryableOnNextBase(httpStatus) {
  return RETRYABLE_HTTP_STATUSES.includes(httpStatus);
}

function extractPayloadErrorMessage(payload) {
  if (!payload) return null;
  if (payload.message) return payload.message;
  if (payload.error) return payload.error;
  return null;
}

/**
 * Generic HTTP failure Error with .httpStatus attached.
 * @param {object} payload
 * @param {number} httpStatus
 * @returns {Error}
 */
function buildHttpFailureError(payload, httpStatus) {
  const customMessage = extractPayloadErrorMessage(payload);
  const message = customMessage || `Request failed (${httpStatus})`;
  const httpError = new Error(message);
  httpError.httpStatus = httpStatus;
  return httpError;
}

/**
 * Turn one HTTP response into plan text, a retry signal, or a thrown Error.
 * @param {{ status: number, ok: boolean }} response
 * @param {object} payload
 * @returns {{ shouldRetry: boolean, plan?: object, error?: Error }}
 */
function interpretWorkoutGenerateResponse(response, payload) {
  if (responseIsMonthlyLimit(response.status, payload)) {
    throw buildMonthlyLimitError(payload);
  }

  if (!response.ok) {
    const httpError = buildHttpFailureError(payload, response.status);
    if (httpStatusIsRetryableOnNextBase(response.status)) {
      return { shouldRetry: true, error: httpError };
    }
    httpError.fromHttpResponse = true;
    throw httpError;
  }

  const planText = payload && payload.text;
  if (!planText) {
    throw new Error(EMPTY_GENERATOR_MESSAGE);
  }

  // vocab/symbol: keep null usage when the server omitted it (do not use ||)
  let usage = null;
  if (payload && payload.usage != null) {
    usage = payload.usage;
  }

  return {
    shouldRetry: false,
    plan: {
      text: String(planText),
      usage,
    },
  };
}

/**
 * Errors that must bubble immediately (do not try the next base).
 * @param {Error} caughtError
 * @returns {boolean}
 */
function shouldRethrowWithoutTryingNextBase(caughtError) {
  if (!caughtError) {
    return false;
  }
  if (caughtError.code === MONTHLY_LIMIT_ERROR_CODE) {
    return true;
  }
  if (caughtError.code === TIMEOUT_ERROR_CODE) {
    return true;
  }
  if (caughtError.fromHttpResponse) {
    return true;
  }
  return false;
}

/**
 * One POST to one generate URL. Never throws soft network misses — only hard rethrows.
 * @param {string} url
 * @param {object} requestBody
 * @param {object} headers
 * @returns {Promise<{ didSucceed: boolean, plan?: object, error?: Error }>}
 */
async function tryOneWorkoutGenerateBase(url, requestBody, headers) {
  try {
    // vocab: postJsonWithTimeout = fetch POST that aborts after WORKOUT_GENERATE_FETCH_TIMEOUT_MS
    const response = await postJsonWithTimeout(
      url,
      requestBody,
      headers,
      WORKOUT_GENERATE_FETCH_TIMEOUT_MS,
    );
    let payload = {};
    try {
      payload = await response.json();
    } catch (_parseError) {
      payload = {};
    }
    const outcome = interpretWorkoutGenerateResponse(response, payload);

    if (outcome.shouldRetry) {
      logApiAttempt(WORKOUT_GENERATE_API_LOG_LABEL, url, outcome.error);
      return { didSucceed: false, error: outcome.error };
    }

    if (__DEV__) {
      console.log('[workout] generate plan OK via', url);
    }
    return { didSucceed: true, plan: outcome.plan };
  } catch (caughtError) {
    logApiAttempt(WORKOUT_GENERATE_API_LOG_LABEL, url, caughtError);
    if (shouldRethrowWithoutTryingNextBase(caughtError)) {
      throw caughtError;
    }
    return { didSucceed: false, error: caughtError };
  }
}

/**
 * Human hint when every API base failed with a retryable error.
 * @param {Error} lastError
 * @returns {string}
 */
function workoutApiGiveUpHint(lastError) {
  let errorMessage = '';
  if (lastError && lastError.message) {
    errorMessage = String(lastError.message);
  }

  if (errorMessage.includes('timed out')) {
    return 'The server took too long. Try again on Wi-Fi.';
  }

  let httpStatus = null;
  if (lastError) {
    httpStatus = lastError.httpStatus;
  }
  const looksLikeMissingRoute =
    errorMessage.includes('404') || httpStatus === HTTP_STATUS_NOT_FOUND;
  if (looksLikeMissingRoute) {
    return 'Workout API missing on Cloud Run (stale deploy). Run: npm run server — or redeploy with ./server/deploy.sh';
  }

  if (errorMessage.includes('AI provider unavailable')) {
    return 'Workout generation needs ANTHROPIC_API_KEY on Cloud Run. Add it to .env, then run: ./scripts/syncCloudRunEnv.sh';
  }

  return 'Could not reach the workout API. Check internet, then reload with: npm start (dev build).';
}

/**
 * AsyncStorage key for cached onboarding answers for one user.
 * @param {string} subjectUid
 * @returns {string}
 */
function onboardingCacheStorageKey(subjectUid) {
  // Manipulate here: key letters must stay — other screens read the same cache
  return `onboarding_data_${subjectUid}`;
}

/**
 * Read onboarding from users/{uid}. Returns null when db is missing or the doc is gone.
 * @param {string} subjectUid
 * @returns {Promise<object|null>}
 */
async function loadOnboardingFromUserDoc(subjectUid) {
  if (!db) {
    return null;
  }
  // vocab: getDoc = one-shot Firestore read (not a live listener)
  const userSnapshot = await getDoc(doc(db, USERS_COLLECTION, subjectUid));
  if (!userSnapshot.exists()) {
    return null;
  }
  return normalizeClientProfileFields(userSnapshot.data());
}

/**
 * Read onboarding from the phone cache when Firestore has nothing.
 * @param {string} subjectUid
 * @returns {Promise<object|null>}
 */
async function loadOnboardingFromPhoneCache(subjectUid) {
  const cachedJson = await AsyncStorage.getItem(onboardingCacheStorageKey(subjectUid));
  if (!cachedJson) {
    return null;
  }
  return normalizeClientProfileFields(JSON.parse(cachedJson));
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
  // 1. Require a logged-in caller so Cloud Run can attach Firebase proof.
  const headers = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
  if (!headers.Authorization) {
    throw new Error(SIGN_IN_REQUIRED_MESSAGE);
  }

  // 2. Build the body the generate route expects (payload shape is frozen).
  const apiBases = getWorkoutGenerationApiBases();
  const subjectFromCaller = subjectUserId || signedInUserUid();
  const requestBody = {
    onboardingData: buildWorkoutOnboardingPayload(onboardingData),
    subjectUserId: subjectFromCaller,
  };

  if (__DEV__) {
    console.log(
      '[workout] generate plan - trying API bases:',
      apiBases.slice(0, MAX_LOGGED_API_BASES).join(' -> '),
    );
  }

  // 3. Walk bases until one returns plan text or we run out.
  let lastError = null;
  for (let baseIndex = 0; baseIndex < apiBases.length; baseIndex += 1) {
    const apiBase = apiBases[baseIndex];
    const urlWithoutTrailingSlash = String(apiBase).replace(/\/$/, '');
    const url = `${urlWithoutTrailingSlash}${WORKOUT_GENERATE_PATH}`;
    const attempt = await tryOneWorkoutGenerateBase(url, requestBody, headers);
    if (attempt.didSucceed) {
      return attempt.plan;
    }
    lastError = attempt.error;
  }

  // 4. Nothing worked — surface the best hint we have for the UI / console.
  const triedBases = apiBases.slice(0, MAX_LOGGED_API_BASES).join(', ');
  const hint = workoutApiGiveUpHint(lastError);
  let triedSuffix = '';
  if (triedBases) {
    triedSuffix = ` Tried: ${triedBases}`;
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`${hint}${triedSuffix}`);
}

/**
 * Load onboarding answers (Firestore, then phone cache) and the current workout plan.
 * @param {{ userId?: string, propPlan?: object }} [options]
 * @returns {Promise<{ onboardingData: object|null, plan: object|null }>}
 */
export async function loadOnboardingAndPlanArtifacts({ userId, propPlan } = {}) {
  // 1. Decide whose data we are loading (prop userId wins over signed-in uid).
  const trimmedUserId = userId && String(userId).trim();
  const subjectUid = trimmedUserId || signedInUserUid();
  if (!subjectUid) {
    throw new Error(USER_NOT_FOUND_MESSAGE);
  }

  // 2. Onboarding: Firestore user doc first, then AsyncStorage cache.
  let onboardingData = await loadOnboardingFromUserDoc(subjectUid);
  if (!onboardingData) {
    onboardingData = await loadOnboardingFromPhoneCache(subjectUid);
  }

  // 3. Plan: caller may already have one in memory from a parent screen.
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
  // 1. Resolve the subject uid the same way the load recipe does.
  const trimmedUserId = userId && String(userId).trim();
  const subjectUid = trimmedUserId || signedInUserUid();

  // 2. Ask the API for plan text + usage.
  const { text, usage } = await askForWorkoutPlanFromApi(onboardingData, subjectUid);

  // 3. Stamp created-at for screens that show "generated just now."
  return {
    planText: text,
    generatedAt: Date.now(),
    userData: onboardingData,
    usage,
  };
}
