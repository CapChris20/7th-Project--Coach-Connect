/**
 * auth Gate Helpers
 *
 * Purpose: auth Gate Helpers — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/auth
 * Key exports: normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser, getProfileCacheKey
 *
 * @file-header
 */
/** Pure helpers for AuthGate routing — exported for unit tests. */

export function normalizeAppRole(role) {
  return String(role || '').toLowerCase().trim() === 'trainer' ? 'trainer' : 'client';
}

/** Only force onboarding when explicitly incomplete — missing field = legacy users who already use the app. */
export function profileNeedsOnboarding(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (profile.onboardingCompletedAt) return false;
  const v = profile.onboardingCompleted;
  if (v === true || v === 'true' || v === 1) return false;
  if (v === false || v === 'false' || v === 0) return true;
  if (
    profile.authProvider === 'google' &&
    !profile.onboardingCompletedAt &&
    profile.createdAt
  ) {
    const createdMs = new Date(profile.createdAt).getTime();
    const recent =
      Number.isFinite(createdMs) && Date.now() - createdMs < 7 * 24 * 60 * 60 * 1000;
    if (recent) return true;
  }
  return false;
}

/** Firestore may not exist yet when auth fires right after first Google/email sign-up. */
export function isLikelyNewFirebaseUser(firebaseUser) {
  if (!firebaseUser?.metadata) return false;
  try {
    const created = new Date(firebaseUser.metadata.creationTime).getTime();
    const lastSignIn = new Date(firebaseUser.metadata.lastSignInTime).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false;
    return Math.abs(lastSignIn - created) < 3 * 60 * 1000;
  } catch {
    return false;
  }
}

export function getProfileCacheKey(uid) {
  return `auth_profile_${uid}`;
}

/** Fields clients cannot write on users/{uid} (see firestore.rules). */
export const CLIENT_RESTRICTED_USER_DOC_FIELDS = ['role', 'trainerId', 'linked'];

export function omitRestrictedUserDocFields(data) {
  if (!data || typeof data !== 'object') return data;
  const out = { ...data };
  for (const key of CLIENT_RESTRICTED_USER_DOC_FIELDS) {
    delete out[key];
  }
  return out;
}

/** Persist chosen role locally until server onboarding sets it on the user doc. */
export async function cachePendingSignupProfile(uid, role, storage) {
  if (!uid || !storage?.setItem) return;
  const payload = {
    uid,
    role: normalizeAppRole(role),
    onboardingCompleted: false,
  };
  try {
    await storage.setItem(getProfileCacheKey(uid), JSON.stringify(payload));
  } catch {
    /* best-effort */
  }
}
