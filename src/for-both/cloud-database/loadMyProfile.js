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

// ===== MAIN FUNCTION =====

/**
 * Load users/{uid} from Firestore.
 * @param {string} uid
 * @returns {Promise<object|null>}
 */
export async function loadMyProfileFromFirestore(uid) {
  // 1. No uid or no db handle → nothing to load.
  if (!uid || !db) {
    return null;
  }

  try {
    // 2. One-shot read. exists() is false when this user has no profile doc yet.
    // vocab: getDoc = read a single Firestore document once (not a live listener).
    const profileDocumentPath = doc(db, USERS_COLLECTION, uid);
    const profileSnapshot = await getDoc(profileDocumentPath);
    if (!profileSnapshot.exists()) {
      return null;
    }

    // 3. Merge the uid onto the stored fields so callers always have an id.
    const storedFields = profileSnapshot.data() || {};
    return { uid, ...storedFields };
  } catch (profileReadError) {
    return null;
  }
}

/**
 * Server fallback when the Firestore read misses. Tries each base URL until one responds.
 * @param {import('firebase/auth').User} user
 * @returns {Promise<object|null>}
 */
export async function loadMyProfileFromApi(user) {
  // 1. Need a signed-in user with an id.
  if (!user || !user.uid) {
    return null;
  }

  // 2. Fresh Auth record and a new id token before we call /api/me.
  // vocab: reload() = pull the latest Auth user from Firebase before token minting.
  // vocab: getIdToken(true) = force a new JWT; true means do not reuse a cached token.
  await user.reload();
  const idToken = await user.getIdToken(true);

  // 3. Walk each base until one returns a profile (or we run out of bases).
  const basesToTry = listProfileApiBaseUrls();
  for (const baseUrl of basesToTry) {
    const profileFromServer = await tryFetchProfileFromOneBase(baseUrl, idToken);
    if (profileFromServer !== undefined) {
      return profileFromServer;
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
  // 1. Firestore users/{uid} is the source of truth when the doc exists.
  const userId = user && user.uid;
  const profileFromFirestore = await loadMyProfileFromFirestore(userId);
  if (profileFromFirestore) {
    return profileFromFirestore;
  }

  // 2. Miss or read error → try /api/me on each known base.
  return loadMyProfileFromApi(user);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging base-url order or the /api/me fetch.

function listProfileApiBaseUrls() {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (configuredBaseUrl) {
    return [configuredBaseUrl, ...LOCAL_PROFILE_API_BASE_URLS];
  }
  return LOCAL_PROFILE_API_BASE_URLS;
}

// Returns the profile, or undefined when this base failed so the caller can try the next one.
// A JSON body of null is a real answer (returned as null) — do NOT try the next base for that.
async function tryFetchProfileFromOneBase(baseUrl, idToken) {
  try {
    return await fetchProfileFromBaseUrl(baseUrl, idToken);
  } catch (baseFailedError) {
    return undefined;
  }
}

// One base. Throws on a bad status, a network error, or the timeout.
async function fetchProfileFromBaseUrl(baseUrl, idToken) {
  // vocab: AbortController is the switch that cancels this fetch when the timer fires.
  const abortController = new AbortController();
  const timeoutId = setTimeout(function abortTimedOutFetch() {
    abortController.abort();
  }, PROFILE_REQUEST_TIMEOUT_MS);

  try {
    const requestUrl = `${baseUrl}${PROFILE_API_PATH}`;
    const response = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: 'application/json',
      },
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`${PROFILE_API_PATH} failed (${response.status})`);
    }

    const profileJson = await response.json();
    if (profileJson && profileJson.user) {
      return profileJson.user;
    }
    if (profileJson) {
      return profileJson;
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
