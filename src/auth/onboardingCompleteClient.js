/**
 * Client-side onboarding completion writes (extracted from OnboardingScreen.handleFinish).
 */
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
 * Returns { updateData, firestoreSynced, serverResponse, error }.
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
}) {
  const updateData = buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData);
  let firestoreSynced = false;
  let serverResponse = null;
  let error = null;

  try {
    await AsyncStorage.setItem(`onboarding_data_${userId}`, JSON.stringify(updateData));

    if (db && setDoc && doc) {
      const { onboardingCompletedAt: _oca, updatedAt: _ua, ...restForFs } = updateData;
      await setDoc(
        doc(db, 'users', userId),
        {
          ...stripUndefinedForFirestore(restForFs),
          onboardingCompleted: true,
          onboardingCompletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      firestoreSynced = true;
    }

    serverResponse = await postOnboardingApi('/api/onboarding/complete', {
      finalRole,
      onboardingData: updateData,
      displayName,
    });

    return { updateData, firestoreSynced, serverResponse, error: null };
  } catch (e) {
    error = e;
    return { updateData, firestoreSynced, serverResponse, error: e };
  }
}
