// Builds the login header for Coach Connect API calls.
// Flow: start with JSON accept → if someone is signed in, attach their Firebase ID token.
// Used by: every API helper that must prove who is calling (Firebase project: anatrox-auth).

import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const JSON_ACCEPT = 'application/json';
const BEARER_PREFIX = 'Bearer ';

// ===== HELPER FUNCTIONS =====

function findSignedInUserWhoCanFetchToken() {
  // vocab: auth.currentUser = Firebase Auth's signed-in user, or null when logged out
  const signedInUser = auth?.currentUser;
  if (!signedInUser) {
    return null;
  }
  if (!signedInUser.getIdToken) {
    return null;
  }
  return signedInUser;
}

function headersWithBearerTokenAttached(headers, idToken) {
  if (!idToken) {
    return headers;
  }
  headers.Authorization = `${BEARER_PREFIX}${idToken}`;
  return headers;
}

// ===== MAIN FUNCTION =====

/**
 * Bearer token headers for Coach Connect API routes.
 * @param {object} [extraHeaders]
 * @returns {Promise<object>}
 */
export async function getApiAuthHeaders(extraHeaders = {}) {
  // 1. Always accept JSON; merge any caller headers on top.
  const headers = {
    Accept: JSON_ACCEPT,
    ...extraHeaders,
  };

  // 2. No signed-in user (or no token API) → return accept-only headers for anonymous routes.
  const signedInUser = findSignedInUserWhoCanFetchToken();
  if (!signedInUser) {
    return headers;
  }

  // 3. Ask Firebase for a fresh ID token, then attach Authorization: Bearer …
  // vocab: getIdToken() = Firebase Auth promise that returns the JWT string for this session
  //        (projectId stays anatrox-auth — do not rename for branding)
  const idToken = await signedInUser.getIdToken();
  return headersWithBearerTokenAttached(headers, idToken);
}
