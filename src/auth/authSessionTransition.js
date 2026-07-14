/** Clears local session when auth uid changes or signs out. */
export async function handleAuthUidTransition(prevUid, nextFirebaseUser, deps) {
  const nextUid = nextFirebaseUser?.uid || null;
  if (!nextUid && prevUid) {
    try {
      await deps.clearPushTokensForUid(prevUid);
    } catch (_) {
      /* best-effort */
    }
    await deps.clearAllUserData();
  } else if (nextUid && prevUid && nextUid !== prevUid) {
    try {
      await deps.clearPushTokensForUid(prevUid);
    } catch (_) {
      /* best-effort */
    }
    await deps.clearAllUserData();
  }
  return nextUid;
}
