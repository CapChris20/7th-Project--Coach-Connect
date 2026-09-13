/**
 * Client-side onboarding completion writes (extracted from OnboardingWizardScreen.handleFinish).
 */
import { omitRestrictedUserDocFields } from './detectUserRole';

function stripUndefinedForFirestore(input) {
  if (input === undefined) return undefined;
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) {
    return input
      .map((item) => stripUndefinedForFirestore(item))
      .filter((item) => item !== undefined);
  }
  const out = {};
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    const next = stripUndefinedForFirestore(val);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}

export function buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData = null) {
  const finalOnboardingData = overrideData ? { ...onboardingData, ...overrideData } : onboardingData;
  const nowIso = new Date().toISOString();
  return {
    ...finalOnboardingData,
    role: finalRole,
    onboardingCompleted: true,
    onboardingCompletedAt: nowIso,
    updatedAt: nowIso,
    ...(finalOnboardingData?.weight != null && finalOnboardingData.weight !== ''
      ? { startingWeight: finalOnboardingData.weight }
      : {}),
  };
}

/**
 * Persists onboarding completion locally + users/{uid}, then syncs via API.
 * Retries the server role write so trainers don't fall into the client shell if
 * the first /api/onboarding/complete call flakes.
 * Returns { updateData, firestoreSynced, serverResponse, error, roleCached }.
 */
export async function completeOnboardingClient({
  userId,
  finalRole,
  onboardingData,
  overrideData = null,
  db,
  doc,
  setDoc,
  serverTimestamp,
  AsyncStorage,
  postOnboardingApi,
  displayName = null,
  getProfileCacheKey = (uid) => `auth_profile_${uid}`,
}) {
  const updateData = buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);
  let firestoreSynced = false;
  let serverResponse = null;
  let error = null;
  let roleCached = false;

  const cacheRoleLocally = async () => {
    if (!AsyncStorage?.setItem || !userId) return;
    const role = String(finalRole || '').toLowerCase() === 'trainer' ? 'trainer' : 'client';
    await AsyncStorage.setItem(`onboarding_data_${userId}`, JSON.stringify(updateData));
    await AsyncStorage.setItem(
      getProfileCacheKey(userId),
      JSON.stringify({
        uid: userId,
        ...updateData,
        role,
        onboardingCompleted: true,
      }),
    );
    // If server sync fails, AuthGate can retry from this flag on next launch.
    await AsyncStorage.setItem(
      `pending_onboarding_complete_${userId}`,
      JSON.stringify({ finalRole: role, onboardingData: updateData, displayName }),
    );
    roleCached = true;
  };

  try {
    await cacheRoleLocally();

    if (db && setDoc && doc) {
      const { onboardingCompletedAt: _oca, updatedAt: _ua, ...restForFs } = updateData;
      await setDoc(
        doc(db, 'users', userId),
        {
          ...omitRestrictedUserDocFields(stripUndefinedForFirestore(restForFs)),
          onboardingCompleted: true,
          onboardingCompletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      firestoreSynced = true;
    }

    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        serverResponse = await postOnboardingApi('/api/onboarding/complete', {
          finalRole,
          onboardingData: updateData,
          displayName,
        });
        lastErr = null;
        if (AsyncStorage?.removeItem) {
          await AsyncStorage.removeItem(`pending_onboarding_complete_${userId}`);
        }
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
      }
    }
    if (lastErr) {
      error = lastErr;
      return { updateData, firestoreSynced, serverResponse, error: lastErr, roleCached };
    }

    return { updateData, firestoreSynced, serverResponse, error: null, roleCached };
  } catch (e) {
    error = e;
    try {
      await cacheRoleLocally();
    } catch (_) {
      /* ignore */
    }
    return { updateData, firestoreSynced, serverResponse, error: e, roleCached };
  }
}
