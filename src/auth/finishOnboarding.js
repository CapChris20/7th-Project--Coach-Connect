// The "save my onboarding answers" pipeline, pulled out of the wizard so it can be tested alone.
// Flow: build the final payload → cache it locally first → write users/{uid} in Firestore → POST the API (with retries) → report what succeeded.
// Called by OnboardingWizardScreen's finish handler; AuthGate reads the leftover "pending" flag to retry a failed server sync on next launch.
// Key exports: buildOnboardingUpdatePayload, completeOnboardingClient

import { omitRestrictedUserDocFields } from './detectUserRole';

// Firestore rejects any `undefined` value outright (null is fine, undefined is not), and our form
// state is full of untouched optional fields. This walks the whole object tree and drops them.
// Recursive because onboarding answers nest (arrays of goals, objects of measurements).
function stripUndefinedForFirestore(input) {
  if (input === undefined) return undefined;
  // Primitives and null pass through untouched — null is a legal Firestore value.
  if (input === null || typeof input !== 'object') return input;
  // Arrays: clean each item, then drop the holes. Deleting a key from an object is easy; an array
  // can't have gaps, so we filter instead.
  if (Array.isArray(input)) {
    return input
      .map((item) => stripUndefinedForFirestore(item))
      .filter((item) => item !== undefined);
  }
  const out = {};
  // vocab: Object.entries = turns { a: 1 } into [['a', 1]] so we can loop keys and values together.
  for (const [key, val] of Object.entries(input)) {
    if (val === undefined) continue;
    const next = stripUndefinedForFirestore(val);
    // A nested object can become undefined after cleaning; skip it rather than writing an empty shell.
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}

// Assembles the exact object we save everywhere. Kept separate from the writing so tests can assert
// the shape without mocking Firestore.
export function buildOnboardingUpdatePayload(finalRole, onboardingData, overrideData = null) {
  // overrideData is last-second data the wizard collected after state was snapshotted (e.g. a field
  // edited on the final screen). Spread order matters: override wins over the stored answers.
  const finalOnboardingData = overrideData ? { ...onboardingData, ...overrideData } : onboardingData;
  // One timestamp reused for every field so the record is internally consistent.
  const nowIso = new Date().toISOString();
  return {
    ...finalOnboardingData,
    role: finalRole,
    // These three are the flags AuthGate/profileNeedsOnboarding read to stop showing the wizard.
    onboardingCompleted: true,
    onboardingCompletedAt: nowIso,
    updatedAt: nowIso,
    // Conditional spread: only add startingWeight if they actually entered a weight.
    // vocab/symbol: `...(cond ? {a:1} : {})` = "include this key only when cond is true".
    // Why: startingWeight is the frozen baseline all progress charts compare against — writing an
    // empty value here would give every future chart a broken starting point.
    ...(finalOnboardingData?.weight != null && finalOnboardingData.weight !== ''
      ? { startingWeight: finalOnboardingData.weight }
      : {}),
  };
}

// Runs the full save. Every Firebase/storage dependency is passed in rather than imported, which is
// what lets the unit tests drive this with fakes and no network.
// Returns { updateData, firestoreSynced, serverResponse, error, roleCached } so the caller can tell
// partial success (saved locally, server failed) from total failure.
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
  // Result flags, filled in as each stage succeeds. They start pessimistic so an early throw still
  // returns an honest report.
  let firestoreSynced = false;
  let serverResponse = null;
  let error = null;
  let roleCached = false;

  // Local-first write. This runs BEFORE any network call on purpose: if the user kills the app or
  // loses signal mid-save, the device still knows they finished and which role they picked, so they
  // don't get bounced back into the wizard or dropped into the wrong shell.
  const cacheRoleLocally = async () => {
    if (!AsyncStorage?.setItem || !userId) return;
    const role = String(finalRole || '').toLowerCase() === 'trainer' ? 'trainer' : 'client';
    // Three separate keys, three different jobs:
    // 1. the raw answers, so the wizard could repopulate
    await AsyncStorage.setItem(`onboarding_data_${userId}`, JSON.stringify(updateData));
    // 2. the profile cache AuthGate reads on launch for instant routing before Firestore answers
    await AsyncStorage.setItem(
      getProfileCacheKey(userId),
      JSON.stringify({
        uid: userId,
        ...updateData,
        role,
        onboardingCompleted: true,
      }),
    );
    // 3. a "still needs syncing" marker — AuthGate retries the server call from this on next launch.
    //    It's deleted below the moment the API call succeeds.
    await AsyncStorage.setItem(
      `pending_onboarding_complete_${userId}`,
      JSON.stringify({ finalRole: role, onboardingData: updateData, displayName }),
    );
    roleCached = true;
  };

  try {
    await cacheRoleLocally();

    // --- Firestore write -----------------------------------------------------
    if (db && setDoc && doc) {
      // Pull the ISO timestamps out of the payload so we can replace them with server timestamps
      // below. vocab/symbol: `const { a: _a, ...rest } = obj` = destructure-and-drop — grab those two
      // keys into throwaway names (the _ prefix marks them unused) and keep everything else in restForFs.
      const { onboardingCompletedAt: _oca, updatedAt: _ua, ...restForFs } = updateData;
      await setDoc(
        doc(db, 'users', userId),
        {
          // Two cleanups before writing: strip undefined (Firestore would reject the whole write),
          // then drop the fields security rules forbid clients from setting (role, trainerId, linked)
          // — the server sets those during /api/onboarding/complete.
          ...omitRestrictedUserDocFields(stripUndefinedForFirestore(restForFs)),
          onboardingCompleted: true,
          // vocab: serverTimestamp() = a placeholder Firestore replaces with ITS clock, not the
          // phone's. Device clocks can be wrong by hours; this keeps ordering trustworthy.
          onboardingCompletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        // vocab: { merge: true } = update the fields we sent and leave every other field alone.
        // Without it, setDoc REPLACES the whole document and wipes the rest of the user's profile.
        { merge: true },
      );
      firestoreSynced = true;
    }

    // --- Server sync with retries -------------------------------------------
    // The API is the only thing allowed to set `role` on the user doc, so if it never lands a trainer
    // ends up stuck in the client shell. That's why this one call gets retried instead of failing once.
    let lastErr = null;
    // Manipulate here: 3 = total attempts. Raise for flakier networks; each extra attempt adds delay
    // before the user sees an error.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        serverResponse = await postOnboardingApi('/api/onboarding/complete', {
          finalRole,
          onboardingData: updateData,
          displayName,
        });
        // Clear the error from any earlier failed attempt — we got through.
        lastErr = null;
        // Server confirmed, so the "retry me on next launch" marker is no longer needed.
        if (AsyncStorage?.removeItem) {
          await AsyncStorage.removeItem(`pending_onboarding_complete_${userId}`);
        }
        break;
      } catch (e) {
        lastErr = e;
        // Back off before trying again, but not after the final attempt (nobody's waiting on it).
        // Manipulate here: 250 * (attempt + 1) = 250ms then 500ms. Growing delays give a briefly
        // overloaded server room to recover instead of hammering it.
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
        }
      }
    }
    // All attempts failed. We still return successfully-cached local state so the caller can let the
    // user into the app — the pending marker means the sync will be retried later.
    if (lastErr) {
      error = lastErr;
      return { updateData, firestoreSynced, serverResponse, error: lastErr, roleCached };
    }

    return { updateData, firestoreSynced, serverResponse, error: null, roleCached };
  } catch (e) {
    // Outer catch = something before/around the retry loop blew up (usually the Firestore write).
    error = e;
    // Try the local cache once more: if the failure happened before caching finished, this is the
    // last chance to leave the device in a recoverable state. Wrapped because it may fail too.
    try {
      await cacheRoleLocally();
    } catch (_) {
      /* ignore */
    }
    return { updateData, firestoreSynced, serverResponse, error: e, roleCached };
  }
}
