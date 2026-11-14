// Decides what local data to wipe when the signed-in Firebase user changes.
// Flow: previous uid + next Firebase user → sign-out or account-switch wipes cache → return the new uid.
// Used by LoginGate so a second account never inherits the first account's cache.

// ===== NAMED CONSTANTS =====

// (no tweakable knobs — wipe rules are structural)

// ===== HELPER FUNCTIONS =====

// vocab: uid = Firebase's permanent id for one account (not the email address).
// vocab/symbol: ?. = read .uid only when nextFirebaseUser exists; otherwise undefined.
function uidFromFirebaseUserOrNull(nextFirebaseUser) {
  const maybeUid = nextFirebaseUser?.uid;
  if (!maybeUid) {
    return null;
  }
  return maybeUid;
}

// True for sign-out (had a uid, now nobody) and for account-switch (uid A → uid B).
// First sign-in and a same-user refresh keep the cache so we do not throw away live data.
function mustWipeLocalCacheForThisTransition(previousUid, nextUid) {
  const userJustSignedOut = !nextUid && Boolean(previousUid);
  if (userJustSignedOut) {
    return true;
  }

  const bothUidsAreKnown = Boolean(previousUid) && Boolean(nextUid);
  if (!bothUidsAreKnown) {
    return false;
  }

  const differentPersonSignedIn = nextUid !== previousUid;
  return differentPersonSignedIn;
}

// Drop the outgoing account's push token, then wipe AsyncStorage profile cache.
// A failed token clear must not block the profile wipe — leftover tokens would keep
// notifying the old account on this phone.
async function wipePushTokenAndCachedProfile(previousUid, cleanupDependencies) {
  try {
    await cleanupDependencies.clearPushTokensForUid(previousUid);
  } catch {
    // Best-effort. Profile wipe below still has to run.
  }
  await cleanupDependencies.clearAllUserData();
}

// ===== MAIN FUNCTION =====

/**
 * Wipe local user data when the signed-in uid changes, then return the new uid.
 * @param {string|null} previousUid Uid LoginGate remembered from the last auth tick.
 * @param {{ uid?: string }|null} nextFirebaseUser Firebase Auth user (null when signed out).
 * @param {{ clearPushTokensForUid: Function, clearAllUserData: Function }} cleanupDependencies Injected wipe helpers.
 * @returns {Promise<string|null>} The uid to store next (null when signed out).
 */
export async function handleAuthUidTransition(previousUid, nextFirebaseUser, cleanupDependencies) {
  // 1. Read who Firebase says is signed in now (null = nobody).
  const nextUid = uidFromFirebaseUserOrNull(nextFirebaseUser);

  // 2. Sign-out and account-switch both need a full wipe; same-user refresh does not.
  const shouldWipeLocalData = mustWipeLocalCacheForThisTransition(previousUid, nextUid);

  // 3. Best-effort token + cache clear for the outgoing account only when required.
  if (shouldWipeLocalData) {
    await wipePushTokenAndCachedProfile(previousUid, cleanupDependencies);
  }

  // 4. Hand the new uid back so LoginGate can update its ref.
  return nextUid;
}
