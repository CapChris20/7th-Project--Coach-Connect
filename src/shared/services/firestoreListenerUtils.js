/** True when Firestore rejected the request — expected during/after sign-out. */
export function isFirestorePermissionDenied(err) {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return code === 'permission-denied' || msg.includes('insufficient permissions');
}

/** Log snapshot errors except expected sign-out permission denials. */
export function logSnapshotError(err, label) {
  if (isFirestorePermissionDenied(err)) return;
  if (label) console.error(label, err);
  else console.error(err);
}
