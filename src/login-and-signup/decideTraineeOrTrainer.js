// Pure decision helpers LoginGate uses to answer "who is this user and where do they go?".
// Flow: normalize role → decide if onboarding is still owed → detect brand-new accounts → cache/sanitize local profile.
// Used by login/signup routing. No React or Firebase imports so each rule can be unit-tested alone.
// Read order: constants → main recipes → PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

const TRAINER_ROLE = 'trainer';
const CLIENT_ROLE = 'client';
const GOOGLE_AUTH_PROVIDER = 'google';

const DAYS_PER_WEEK = 7;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const FIRST_SESSION_MINUTES = 3;

// Manipulate here: a flagless Google account only counts as "new" inside this window.
const NEW_GOOGLE_ACCOUNT_WINDOW_MS =
  DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Manipulate here: first sign-in timestamps this close together mean the account was just created.
const FIRST_SESSION_WINDOW_MS =
  FIRST_SESSION_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

const PROFILE_CACHE_PREFIX = 'auth_profile_';

// Fields on users/{uid} that firestore.rules refuses to let a client write — server sets them
// because they control access (role, which trainer you're linked to).
// Manipulate here: keep in sync with firestore.rules or client writes fail silently.
export const CLIENT_RESTRICTED_USER_DOC_FIELDS = ['role', 'trainerId', 'linked'];

// ===== MAIN FUNCTION =====

/**
 * Role values arrive from several places with inconsistent casing. One clean value for routing.
 * Manipulate here: 'client' is the safe default — unknown roles must never open trainer tools.
 * @param {string} role
 * @returns {'trainer'|'client'}
 */
export function normalizeAppRole(role) {
  // 1. Lowercase + trim so "Trainer" / " TRAINER " all match.
  const roleText = String(role || '').toLowerCase().trim();

  // 2. Only "trainer" stays trainer; everything else is client.
  if (roleText === TRAINER_ROLE) return TRAINER_ROLE;
  return CLIENT_ROLE;
}

/**
 * Should LoginGate push this user into the onboarding wizard?
 * Missing flag on a legacy account defaults to "no" so veterans are not dumped back into setup.
 * @param {object|null|undefined} profile
 * @returns {boolean}
 */
export function profileNeedsOnboarding(profile) {
  // 1. No profile yet → caller retries once Firestore answers.
  if (!profile || typeof profile !== 'object') return false;

  // 2. A completion timestamp is proof they finished.
  if (profile.onboardingCompletedAt) return false;

  // 3. Read the explicit flag in every spelling we ever wrote.
  const onboardingCompletedFlag = profile.onboardingCompleted;
  if (flagMeansOnboardingFinished(onboardingCompletedFlag)) return false;
  if (flagMeansOnboardingStillOpen(onboardingCompletedFlag)) return true;

  // 4. Fresh Google sign-up can have no flag yet — but only if the account is recent.
  if (googleSignupIsRecentAndFlagless(profile)) return true;

  return false;
}

/**
 * Was this Firebase account created just now, in this same session?
 * The auth listener can fire before our Firestore profile exists; this avoids treating signup as broken.
 * @param {object|null|undefined} firebaseUser
 * @returns {boolean}
 */
export function isLikelyNewFirebaseUser(firebaseUser) {
  // vocab: metadata = Firebase's record of when this account was created and last signed in.
  if (!firebaseUser || !firebaseUser.metadata) return false;

  const createdMs = timeMsFromFirebaseDate(firebaseUser.metadata.creationTime);
  const lastSignInMs = timeMsFromFirebaseDate(firebaseUser.metadata.lastSignInTime);
  if (createdMs === null || lastSignInMs === null) return false;

  // Math.abs: clock skew can order creation and last sign-in either way.
  const gapMs = Math.abs(lastSignInMs - createdMs);
  return gapMs < FIRST_SESSION_WINDOW_MS;
}

/**
 * One naming scheme for the per-user cached profile in AsyncStorage.
 * @param {string} uid
 * @returns {string}
 */
export function getProfileCacheKey(uid) {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

/**
 * Strip protected fields before a client-side write so security rules do not reject the whole patch.
 * @param {object} data
 * @returns {object}
 */
export function omitRestrictedUserDocFields(data) {
  // 1. Non-objects pass through unchanged (caller may hand us null).
  if (!data || typeof data !== 'object') return data;

  // 2. Shallow copy, then delete restricted keys from OUR copy only.
  // vocab/symbol: { ...data } = shallow copy — we never mutate the caller's React state.
  const copyWithoutRestricted = { ...data };
  removeRestrictedFieldsFromCopy(copyWithoutRestricted);
  return copyWithoutRestricted;
}

/**
 * Remember the role picked at signup locally until the server writes role on the user doc.
 * `storage` is injected so tests can pass a fake AsyncStorage.
 * @param {string} uid
 * @param {string} role
 * @param {{ setItem?: Function }} storage
 * @returns {Promise<void>}
 */
export async function cachePendingSignupProfile(uid, role, storage) {
  // 1. Need both a uid and a writable storage — otherwise nothing to do.
  const canWrite = Boolean(uid) && Boolean(storage && storage.setItem);
  if (!canWrite) return;

  // 2. Mid-signup payload: role normalized, onboarding not finished yet.
  const payload = {
    uid,
    role: normalizeAppRole(role),
    onboardingCompleted: false,
  };

  // 3. Best-effort write — failed cache only means a slightly worse first render.
  try {
    const cacheKey = getProfileCacheKey(uid);
    // AsyncStorage only stores strings, hence JSON.stringify.
    await storage.setItem(cacheKey, JSON.stringify(payload));
  } catch {
    // Ignore — routing still works from the live profile when it arrives.
  }
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging flag spelling / date parsing.

/**
 * Onboarding flag has been stored as boolean, string, or number across app versions.
 * @param {*} onboardingCompletedFlag
 * @returns {boolean}
 */
function flagMeansOnboardingFinished(onboardingCompletedFlag) {
  if (onboardingCompletedFlag === true) return true;
  if (onboardingCompletedFlag === 'true') return true;
  if (onboardingCompletedFlag === 1) return true;
  return false;
}

/**
 * Explicit "not done" spellings — distinct from "flag missing" (legacy).
 * @param {*} onboardingCompletedFlag
 * @returns {boolean}
 */
function flagMeansOnboardingStillOpen(onboardingCompletedFlag) {
  if (onboardingCompletedFlag === false) return true;
  if (onboardingCompletedFlag === 'false') return true;
  if (onboardingCompletedFlag === 0) return true;
  return false;
}

/**
 * Google account with no completion timestamp and no flag, created inside the new-account window.
 * @param {object} profile
 * @returns {boolean}
 */
function googleSignupIsRecentAndFlagless(profile) {
  if (profile.authProvider !== GOOGLE_AUTH_PROVIDER) return false;
  if (profile.onboardingCompletedAt) return false;
  if (!profile.createdAt) return false;

  const createdMs = timeMsFromFirebaseDate(profile.createdAt);
  if (createdMs === null) return false;

  const ageMs = Date.now() - createdMs;
  return ageMs < NEW_GOOGLE_ACCOUNT_WINDOW_MS;
}

/**
 * Parse a Firebase / ISO date string into milliseconds, or null if unparseable.
 * vocab: Number.isFinite = guards against NaN from bad dates so age checks do not lie.
 * @param {string|number|Date} dateValue
 * @returns {number|null}
 */
function timeMsFromFirebaseDate(dateValue) {
  try {
    const createdMs = new Date(dateValue).getTime();
    if (!Number.isFinite(createdMs)) return null;
    return createdMs;
  } catch {
    return null;
  }
}

/**
 * Delete every restricted field name from a mutable copy.
 * @param {object} copyWithoutRestricted
 */
function removeRestrictedFieldsFromCopy(copyWithoutRestricted) {
  for (let index = 0; index < CLIENT_RESTRICTED_USER_DOC_FIELDS.length; index += 1) {
    const fieldName = CLIENT_RESTRICTED_USER_DOC_FIELDS[index];
    delete copyWithoutRestricted[fieldName];
  }
}
