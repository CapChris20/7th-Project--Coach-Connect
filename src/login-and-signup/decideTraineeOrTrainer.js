// Pure decision helpers LoginGate uses to answer "who is this user and where do they go?".
// Flow: normalize the role string → decide if onboarding is still owed → detect brand-new accounts → cache/sanitize the local profile copy.
// Used by login/signup routing. Kept free of React and Firebase imports so each rule can be unit-tested on its own.

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
// Manipulate here: a flagless Google account only counts as new inside this window.
const NEW_GOOGLE_ACCOUNT_WINDOW_MS =
  DAYS_PER_WEEK * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
// Manipulate here: first sign-in timestamps this close together mean the account was just created.
const FIRST_SESSION_WINDOW_MS =
  FIRST_SESSION_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const PROFILE_CACHE_PREFIX = 'auth_profile_';

// Fields on users/{uid} that firestore.rules refuses to let a client write — they're set server-side
// because they control access (what role you have, which trainer you're linked to).
// Manipulate here: this list must stay in sync with firestore.rules; adding a field here without
// changing the rules (or vice versa) causes silent permission-denied writes.
export const CLIENT_RESTRICTED_USER_DOC_FIELDS = ['role', 'trainerId', 'linked'];

// ===== HELPER FUNCTIONS =====

function isOnboardingMarkedComplete(onboardingCompletedFlag) {
  return onboardingCompletedFlag === true || onboardingCompletedFlag === 'true' || onboardingCompletedFlag === 1;
}

function isOnboardingMarkedIncomplete(onboardingCompletedFlag) {
  return onboardingCompletedFlag === false || onboardingCompletedFlag === 'false' || onboardingCompletedFlag === 0;
}

function isRecentFlaglessGoogleSignup(profile) {
  if (profile.authProvider !== GOOGLE_AUTH_PROVIDER) return false;
  if (profile.onboardingCompletedAt) return false;
  if (!profile.createdAt) return false;
  const createdMs = new Date(profile.createdAt).getTime();
  // vocab: Number.isFinite = guards against an unparseable date, which gives NaN and would make
  // the comparison below quietly false.
  return Number.isFinite(createdMs) && Date.now() - createdMs < NEW_GOOGLE_ACCOUNT_WINDOW_MS;
}

// ===== MAIN FUNCTION =====

/**
 * Role values arrive from several places (Firestore, cached JSON, signup form) with inconsistent
 * casing/whitespace. Everything funnels through here so routing compares one clean value.
 * Manipulate here: 'client' is the safe default — an unknown role must never fall into trainer tools.
 * @param {string|null|undefined} role
 * @returns {string}
 */
export function normalizeAppRole(role) {
  return String(role || '').toLowerCase().trim() === TRAINER_ROLE ? TRAINER_ROLE : CLIENT_ROLE;
}

/**
 * Should we push this user into the onboarding wizard?
 * Only force onboarding when the profile explicitly says it's incomplete. A MISSING
 * flag means a legacy account created before we tracked onboarding — those people already use the
 * app, and dumping them back into the wizard would be a bug, so absence defaults to "no".
 * @param {object|null|undefined} profile
 * @returns {boolean}
 */
export function profileNeedsOnboarding(profile) {
  // No profile loaded yet → don't assume anything; the caller will retry once Firestore answers.
  if (!profile || typeof profile !== 'object') return false;

  // A completion timestamp is the strongest possible proof they finished. Nothing after this matters.
  if (profile.onboardingCompletedAt) return false;

  // The flag has been written as a boolean, a string, and a number across app versions, so accept
  // all three spellings of true/false rather than trusting one type.
  const onboardingCompletedFlag = profile.onboardingCompleted;
  if (isOnboardingMarkedComplete(onboardingCompletedFlag)) return false;
  if (isOnboardingMarkedIncomplete(onboardingCompletedFlag)) return true;

  // Rescue case for Google sign-up: the account exists in Firebase Auth before our wizard writes any
  // flag, so a fresh Google user can legitimately have no onboarding field at all. We only treat that
  // as "needs onboarding" if the account is recent — an old Google account with no flag is a legacy
  // user who should be left alone.
  if (isRecentFlaglessGoogleSignup(profile)) return true;

  return false;
}

/**
 * Was this account created just now, in this same session?
 * Why it matters: the auth listener fires the instant Firebase creates the user, which can be BEFORE
 * our Firestore profile document exists. Without this check the app sees "no profile" and treats a
 * brand-new signup like a broken account.
 * @param {object|null|undefined} firebaseUser
 * @returns {boolean}
 */
export function isLikelyNewFirebaseUser(firebaseUser) {
  // vocab: metadata = Firebase's record of when this account was created and last signed in.
  if (!firebaseUser?.metadata) return false;
  try {
    const created = new Date(firebaseUser.metadata.creationTime).getTime();
    const lastSignIn = new Date(firebaseUser.metadata.lastSignInTime).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false;
    // On a first-ever sign-in these two timestamps are nearly identical; on a returning user they're
    // far apart. Math.abs because clock skew can order them either way.
    return Math.abs(lastSignIn - created) < FIRST_SESSION_WINDOW_MS;
  } catch {
    // Unparseable metadata — fall back to "not new", the safer answer since it just means we wait
    // for the real profile instead of assuming a signup is in flight.
    return false;
  }
}

/**
 * One naming scheme for the per-user cached profile in AsyncStorage. Keying by uid is what keeps two
 * accounts on the same device from reading each other's cached profile.
 * @param {string} uid
 * @returns {string}
 */
export function getProfileCacheKey(uid) {
  return `${PROFILE_CACHE_PREFIX}${uid}`;
}

/**
 * Strips protected fields before a client-side write, so an update that happens to carry a
 * cached `role` doesn't get the whole write rejected by the security rules.
 * @param {object|null|undefined} data
 * @returns {object|null|undefined}
 */
export function omitRestrictedUserDocFields(data) {
  if (!data || typeof data !== 'object') return data;
  // vocab/symbol: { ...data } = shallow copy, so we delete from our copy and never mutate the
  // caller's object (which may still be React state elsewhere).
  const fieldsWithoutRestricted = { ...data };
  for (const key of CLIENT_RESTRICTED_USER_DOC_FIELDS) {
    delete fieldsWithoutRestricted[key];
  }
  return fieldsWithoutRestricted;
}

/**
 * Remembers the role a user picked at signup, locally, for the gap between "account created" and
 * "server onboarding writes role onto the user doc". Without this the app briefly doesn't know
 * whether to show client or trainer onboarding and defaults everyone to client.
 * `storage` is injected (rather than importing AsyncStorage) so tests can pass a fake.
 * @param {string} uid
 * @param {string} role
 * @param {{ setItem?: Function }} storage
 * @returns {Promise<void>}
 */
export async function cachePendingSignupProfile(uid, role, storage) {
  if (!uid || !storage?.setItem) return;
  const payload = {
    uid,
    role: normalizeAppRole(role),
    // Hardcoded false: by definition we're caching this mid-signup, before onboarding finishes.
    onboardingCompleted: false,
  };
  try {
    // AsyncStorage only stores strings, hence JSON.stringify.
    await storage.setItem(getProfileCacheKey(uid), JSON.stringify(payload));
  } catch {
    // Best-effort: a failed cache write just means a slightly worse first render, never a blocked signup.
  }
}
