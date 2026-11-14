// Links a trainer to a client, and sets that client's monthly rate, through the Coach Connect API.
// Flow: check the fields → attach the login header → POST each API base until one accepts.
// Used by: the trainer listing popup (accept) and the earnings screen (set rate).

import { getApiBaseCandidates } from './whereToConnect';
import { getApiAuthHeaders } from './attachLoginProof';

// ===== NAMED CONSTANTS =====

const ACCEPT_CLIENT_PATH = '/api/trainer/accept-client';
const SET_CLIENT_RATE_PATH = '/api/trainer/set-client-rate';
// Manipulate here: rates below this are rejected before any network call. 100 cents = $1.
const MINIMUM_RATE_CENTS = 100;
const JSON_CONTENT_TYPE = 'application/json';

const MISSING_LINK_FIELDS_MESSAGE = 'trainerId, clientId, and messageId are required';
const MISSING_CLIENT_ID_MESSAGE = 'clientId is required';
const RATE_TOO_LOW_MESSAGE = 'Enter a rate of at least $1';
const NOT_SIGNED_IN_MESSAGE = 'Not signed in';
const API_UNREACHABLE_MESSAGE = 'Could not reach Coach Connect API';

// ===== HELPER FUNCTIONS =====

/**
 * Join an API base (maybe with trailing slash) to a path that already starts with /.
 * @param {string} apiBase
 * @param {string} path
 * @returns {string}
 */
function joinApiBaseWithPath(apiBase, path) {
  // Candidate bases sometimes include a trailing slash. The path already starts with /,
  // so a double slash would miss the route.
  const baseWithoutTrailingSlash = String(apiBase).replace(/\/$/, '');
  return `${baseWithoutTrailingSlash}${path}`;
}

/**
 * One POST attempt. Never throws — returns { didSucceed, responseData } or { didSucceed, error }.
 * @param {string} url
 * @param {object} headers
 * @param {string} requestBody
 */
async function postJsonToUrlOnce(url, headers, requestBody) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: requestBody,
    });
    // vocab: response.json().catch = empty body or non-JSON → treat as {}.
    const responseData = await response.json().catch(() => ({}));
    if (response.ok) {
      return { didSucceed: true, responseData };
    }
    const serverErrorText = responseData?.error || `HTTP ${response.status}`;
    return {
      didSucceed: false,
      error: new Error(serverErrorText),
    };
  } catch (requestError) {
    return { didSucceed: false, error: requestError };
  }
}

/**
 * Attach auth headers, then try each API base until one POST succeeds.
 * @param {string} path
 * @param {object} bodyObject
 * @returns {Promise<object>}
 */
async function postTrainerActionOnFirstWorkingBase(path, bodyObject) {
  // vocab: getApiAuthHeaders = builds Authorization from the signed-in Firebase user.
  const headers = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
  const userIsSignedIn = Boolean(headers.Authorization);
  if (!userIsSignedIn) {
    throw new Error(NOT_SIGNED_IN_MESSAGE);
  }

  const requestBody = JSON.stringify(bodyObject);
  // vocab: getApiBaseCandidates = ordered list of API roots (prod / staging / local).
  const apiBases = getApiBaseCandidates();
  let lastRequestError = null;

  for (const apiBase of apiBases) {
    const fullUrl = joinApiBaseWithPath(apiBase, path);
    const attempt = await postJsonToUrlOnce(fullUrl, headers, requestBody);
    if (attempt.didSucceed) {
      return attempt.responseData;
    }
    lastRequestError = attempt.error;
  }

  throw lastRequestError || new Error(API_UNREACHABLE_MESSAGE);
}

// ===== MAIN FUNCTION =====

/**
 * Accept a pending client request (trainer ↔ client link).
 * Flow: 1. require three ids  2. POST accept-client on the first working API base
 * @param {{ trainerId: string, clientId: string, messageId: string, clientData?: object }} args
 * @returns {Promise<object>}
 */
export async function postAcceptTrainerClient({ trainerId, clientId, messageId, clientData = {} }) {
  // 1. Need trainer, client, and the pending-request message id.
  const hasAllLinkFields = Boolean(trainerId && clientId && messageId);
  if (!hasAllLinkFields) {
    throw new Error(MISSING_LINK_FIELDS_MESSAGE);
  }

  // 2. POST until one API base accepts the link.
  const acceptBody = {
    trainerId,
    clientId,
    messageId,
    clientData,
  };
  return postTrainerActionOnFirstWorkingBase(ACCEPT_CLIENT_PATH, acceptBody);
}

/**
 * Set a client's monthly rate in cents (server updates profile + trainer client row).
 * Flow: 1. require clientId  2. round + enforce $1 min  3. POST set-client-rate
 * @param {{ clientId: string, monthlyRateCents: number }} args
 * @returns {Promise<object>}
 */
export async function postSetClientRate({ clientId, monthlyRateCents }) {
  // 1. Fail fast without a client.
  if (!clientId) {
    throw new Error(MISSING_CLIENT_ID_MESSAGE);
  }

  // 2. Round to whole cents and refuse anything under $1.
  const rateCentsRounded = Math.round(Number(monthlyRateCents));
  const rateIsHighEnough =
    Number.isFinite(rateCentsRounded) && rateCentsRounded >= MINIMUM_RATE_CENTS;
  if (!rateIsHighEnough) {
    throw new Error(RATE_TOO_LOW_MESSAGE);
  }

  // 3. The server writes both the user profile and the trainer's client row.
  const rateBody = {
    clientId,
    monthlyRateCents: rateCentsRounded,
  };
  return postTrainerActionOnFirstWorkingBase(SET_CLIENT_RATE_PATH, rateBody);
}
