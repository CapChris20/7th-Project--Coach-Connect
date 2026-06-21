import AsyncStorage from '@react-native-async-storage/async-storage';

export const getProfileCacheKey = (uid) => `auth_profile_${uid}`;

/** Single source for routing + onboarding; avoids null/undefined flashing the wrong shell. */
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

/**
 * Firestore can lag behind local completion (API/offline). Prefer AsyncStorage if it proves onboarding finished.
 */
export async function mergeLocalOnboardingTruth(uid, firestoreProfile) {
  if (!uid || !firestoreProfile || typeof firestoreProfile !== 'object') {
    return firestoreProfile;
  }
  const base = { ...firestoreProfile };
  try {
    const keys = [`onboarding_data_${uid}`, getProfileCacheKey(uid)];
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      let loc;
      try {
        loc = JSON.parse(raw);
      } catch {
        continue;
      }
      const done =
        loc?.onboardingCompleted === true ||
        loc?.onboardingCompleted === 'true' ||
        loc?.onboardingCompleted === 1 ||
        !!loc?.onboardingCompletedAt;
      if (done) {
        return {
          ...base,
          onboardingCompleted: true,
          onboardingCompletedAt: loc.onboardingCompletedAt || base.onboardingCompletedAt || null,
        };
      }
    }
  } catch (_) {
    /* ignore */
  }
  return base;
}
