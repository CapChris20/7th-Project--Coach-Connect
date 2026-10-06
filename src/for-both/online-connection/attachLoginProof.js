// Builds the login header for Coach Connect API calls.
// Flow: start with JSON accept → if someone is signed in, attach their Firebase token.
// Used by: every API helper that must prove who is calling.

import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const JSON_ACCEPT = 'application/json';
const BEARER_PREFIX = 'Bearer ';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Bearer token headers for Coach Connect API routes.
 * @param {object} [extraHeaders]
 * @returns {Promise<object>}
 */
export async function getApiAuthHeaders(extraHeaders = {}) {
  const headers = {
    Accept: JSON_ACCEPT,
    ...extraHeaders,
  };
  const currentUser = auth?.currentUser;
  if (!currentUser?.getIdToken) return headers;

  const idToken = await currentUser.getIdToken();
  if (idToken) headers.Authorization = `${BEARER_PREFIX}${idToken}`;
  return headers;
}
