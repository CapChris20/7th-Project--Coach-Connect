/**
 * trainer Firestore Errors
 *
 * Purpose: Data/service layer: trainer Firestore Errors. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: isBenignTrainerClientFirestoreError
 *
 * @file-header
 */
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
