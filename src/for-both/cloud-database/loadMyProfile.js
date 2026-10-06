// Load the signed-in user's profile. Firestore first, then a server fallback.
// Flow: read users/{uid} → if that misses, GET /api/me on each known base until one answers.
// Used by LoginGate while the app is deciding which home screen to show.

import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const PROFILE_API_PATH = '/api/me';

// Manipulate here: this runs only after Firestore already failed, so login should not wait long.
const PROFILE_REQUEST_TIMEOUT_MS = 7000;

// Local API ports, tried after EXPO_PUBLIC_API_BASE_URL when that env var is set,
// or on their own when it isn't. Order matches the old fallback list.
const LOCAL_PROFILE_API_BASE_URLS = [
  'http://localhost:4002',
  'http://127.0.0.1:4002',
  'http://localhost:4001',
  'http://127.0.0.1:4001',
];

// ===== HELPER FUNCTIONS =====

function profileApiBaseUrls() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configuredBaseUrl) return [configuredBaseUrl, ...LOCAL_PROFILE_API_BASE_URLS];
  return LOCAL_PROFILE_API_BASE_URLS;
}

// One base. Throws on a bad status, a network error, or the timeout, so the caller can try the next base.
// A JSON body of null is returned as null and is NOT a reason to try the next base.
async function fetchProfileFromBaseUrl(baseUrl, idToken) {
  // vocab: AbortController is the switch that cancels this fetch when the timer fires.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROFILE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}${PROFILE_API_PATH}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`${PROFILE_API_PATH} failed (${response.status})`);
    }
    const profileJson = await response.json();
    return profileJson?.user || profileJson || null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Load users/{uid} from Firestore.
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export async function loadMyProfileFromFirestore(uid) {
  if (!uid || !db) return null;
  try {
    // vocab: getDoc reads the document once. exists() is false when this user has no profile doc yet.
    const profileSnapshot = await getDoc(doc(db, USERS_COLLECTION, uid));
    if (!profileSnapshot.exists()) return null;
    return { uid, ...(profileSnapshot.data() || {}) };
  } catch (_error) {
    return null;
  }
}

/**
 * Server fallback when the Firestore read misses. Tries each base URL until one responds.
 * @param {import('firebase/auth').User} user
 * @returns {Promise<object|null>}
 */
export async function loadMyProfileFromApi(user) {
  if (!user?.uid) return null;

  // vocab: reload() refreshes the Auth user from the server before we ask /api/me who this is.
  // vocab: getIdToken(true) forces a new token. true means don't reuse a cached one.
  await user.reload();
  const idToken = await user.getIdToken(true);

  for (const baseUrl of profileApiBaseUrls()) {
    try {
      return await fetchProfileFromBaseUrl(baseUrl, idToken);
    } catch (_error) {
      // This base was down, slow, or not ok. Try the next one.
    }
  }
  return null;
}

/**
 * Firestore first, then /api/me.
 * @param {import('firebase/auth').User} user
 * @returns {Promise<object|null>}
 */
export async function loadMyProfile(user) {
  const uid = user?.uid;
  const profileFromFirestore = await loadMyProfileFromFirestore(uid);
  if (profileFromFirestore) return profileFromFirestore;
  return loadMyProfileFromApi(user);
}
