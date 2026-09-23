// Decides what local data to wipe when the signed-in Firebase user changes.
// Flow: given the previous uid + the next Firebase user → sign-out or account-switch wipes cached user data → returns the new uid.
// Called from the auth listener (LoginGate) so a second account never inherits the first account's cached state.

// vocab: uid = Firebase's permanent unique id for one user account (not the email — emails can change)
// deps = injected helpers ({ clearPushTokensForUid, clearAllUserData }) so this stays testable and import-free.
export async function handleAuthUidTransition(prevUid, nextFirebaseUser, deps) {
  // Firebase hands us `null` when nobody is signed in, so normalize "no user" to a plain null uid.
  // vocab/symbol: ?. = optional chaining — read .uid only if nextFirebaseUser exists, else undefined (no crash)
  const nextUid = nextFirebaseUser?.uid || null;

  // Case 1 — sign-out: we had a user, now we don't. Clear their cached data off this device.
  if (!nextUid && prevUid) {
    // Push reportColors are per-device-per-user: if we leave the old token attached, the previous
    // account keeps getting this phone's notifications. Best-effort only — a failure here
    // must not block the rest of the wipe, hence the try/catch that swallows the error.
    try {
      await deps.clearPushTokensForUid(prevUid);
    } catch (_) {
      /* best-effort */
    }
    await deps.clearAllUserData();

  // Case 2 — account switch: different person signed in without a clean sign-out in between.
  // Same cleanup, because leftover cache from prevUid would show up under the new account.
  } else if (nextUid && prevUid && nextUid !== prevUid) {
    try {
      await deps.clearPushTokensForUid(prevUid);
    } catch (_) {
      /* best-effort */
    }
    await deps.clearAllUserData();
  }

  // Note the cases we deliberately skip: first-ever sign-in (no prevUid) and "same user refreshed"
  // (nextUid === prevUid). Wiping in those cases would throw away good cache for no reason.

  // Caller stores this as the new "previous uid" for the next transition.
  return nextUid;
}
