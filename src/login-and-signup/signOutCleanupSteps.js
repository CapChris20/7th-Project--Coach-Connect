// Decides what local data to wipe when the signed-in Firebase user changes.
// Flow: previous uid + next Firebase user → sign-out or account-switch wipes cache → return the new uid.
// Used by LoginGate so a second account never inherits the first account's cache.

// ===== NAMED CONSTANTS =====

// (no tweakable knobs — wipe rules are structural)

// ===== HELPER FUNCTIONS =====

/**
 * Read the next account id. A missing user or a blank uid counts as signed out.
 * @param {{ uid?: string }|null} nextFirebaseUser Firebase hands us null when nobody is signed in.
 * @returns {string|null}
 */
function nextUidFromFirebaseUser(nextFirebaseUser) {
  // vocab: uid = Firebase's permanent id for one account (not the email).
  // vocab/symbol: ?. = read .uid only if nextFirebaseUser exists, otherwise undefined.
  const nextUid = nextFirebaseUser?.uid;
  if (!nextUid) return null;
  return nextUid;
}

/**
 * Drop the previous account's push token and cached profile off this device.
 * A failed token clear must not block the rest of the wipe. Leftover tokens
 * would keep sending the old account this phone's notifications.
 * @param {string} previousUid
 * @param {{ clearPushTokensForUid: Function, clearAllUserData: Function }} cleanupDependencies
 */
async function clearCachedDataForPreviousUser(previousUid, cleanupDependencies) {
  try {
    await cleanupDependencies.clearPushTokensForUid(previousUid);
  } catch {
    // Best-effort. The profile wipe below still has to run.
  }
  await cleanupDependencies.clearAllUserData();
}

/**
 * First sign-in (no previous uid) and a refresh of the same user keep the cache.
 * Wiping those would throw away data that still belongs to the person on screen.
 * @param {string|null} previousUid
 * @param {string|null} nextUid
 * @returns {boolean}
 */
function shouldWipeCachedUserData(previousUid, nextUid) {
  const signedOut = !nextUid && Boolean(previousUid);
  if (signedOut) return true;

  const bothPresent = Boolean(nextUid) && Boolean(previousUid);
  if (!bothPresent) return false;

  const switchedAccounts = nextUid !== previousUid;
  return switchedAccounts;
}

// ===== MAIN FUNCTION =====

/**
 * Wipe local user data when the signed-in uid changes, then return the new uid.
 * @param {string|null} previousUid
 * @param {{ uid?: string }|null} nextFirebaseUser
 * @param {{ clearPushTokensForUid: Function, clearAllUserData: Function }} cleanupDependencies
 * @returns {Promise<string|null>}
 */
export async function handleAuthUidTransition(previousUid, nextFirebaseUser, cleanupDependencies) {
  const nextUid = nextUidFromFirebaseUser(nextFirebaseUser);

  if (shouldWipeCachedUserData(previousUid, nextUid)) {
    await clearCachedDataForPreviousUser(previousUid, cleanupDependencies);
  }

  return nextUid;
}
