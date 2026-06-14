/** Benign Firestore listener errors (offline / permission flicker) — ignore in trainer client listeners. */
export function isBenignTrainerClientFirestoreError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || err || '');
  return (
    code === 'permission-denied' ||
    code === 'unavailable' ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('Failed to get document')
  );
}
