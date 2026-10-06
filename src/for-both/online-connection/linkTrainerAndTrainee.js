// Links a trainer to a client, and sets that client's monthly rate, through the Coach Connect API.
// Flow: check the fields → attach the login header → POST each API base until one accepts.
// Used by the trainer listing popup (accept) and the earnings screen (set rate).

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

// Candidate bases sometimes include a trailing slash. The path already starts with /,
// so a double slash would miss the route.
function joinApiUrl(apiBase, path) {
  const baseWithoutTrailingSlash = String(apiBase).replace(/\/$/, '');
  return `${baseWithoutTrailingSlash}${path}`;
}

// One bad base (old LAN IP, sleeping dev server) should not fail the action.
// A real HTTP error is remembered and the next base is tried. The last error wins.
async function postTrainerJson(path, body) {
  const headers = await getApiAuthHeaders({ 'Content-Type': JSON_CONTENT_TYPE });
  const isSignedIn = Boolean(headers.Authorization);
  if (!isSignedIn) {
    throw new Error(NOT_SIGNED_IN_MESSAGE);
  }

  const requestBody = JSON.stringify(body);
  const apiBases = getApiBaseCandidates();
  let lastError = null;

  for (const apiBase of apiBases) {
    try {
      const response = await fetch(joinApiUrl(apiBase, path), {
        method: 'POST',
        headers,
        body: requestBody,
      });
      // A non-JSON body (HTML error page) must not crash the loop.
      const responseData = await response.json().catch(() => ({}));
      if (response.ok) return responseData;
      lastError = new Error(responseData?.error || `HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error(API_UNREACHABLE_MESSAGE);
}

function isValidMonthlyRateCents(rateCents) {
  return Number.isFinite(rateCents) && rateCents >= MINIMUM_RATE_CENTS;
}

// ===== MAIN FUNCTION =====

/**
 * Accept a pending connection and link the trainer to the client.
 * @param {object} linkRequest
 * @param {string} linkRequest.trainerId
 * @param {string} linkRequest.clientId
 * @param {string} linkRequest.messageId
 * @param {object} [linkRequest.clientData]
 * @returns {Promise<object>}
 */
export async function postAcceptTrainerClient({ trainerId, clientId, messageId, clientData = {} }) {
  const hasRequiredFields = Boolean(trainerId && clientId && messageId);
  if (!hasRequiredFields) {
    throw new Error(MISSING_LINK_FIELDS_MESSAGE);
  }

  return postTrainerJson(ACCEPT_CLIENT_PATH, { trainerId, clientId, messageId, clientData });
}

/**
 * Set the monthly coaching rate for a linked client.
 * The server writes both the user profile and the trainer's client row.
 * @param {object} rateRequest
 * @param {string} rateRequest.clientId
 * @param {number} rateRequest.monthlyRateCents
 * @returns {Promise<object>}
 */
export async function postSetClientRate({ clientId, monthlyRateCents }) {
  if (!clientId) throw new Error(MISSING_CLIENT_ID_MESSAGE);

  const rateCents = Math.round(Number(monthlyRateCents));
  if (!isValidMonthlyRateCents(rateCents)) {
    throw new Error(RATE_TOO_LOW_MESSAGE);
  }

  return postTrainerJson(SET_CLIENT_RATE_PATH, { clientId, monthlyRateCents: rateCents });
}
