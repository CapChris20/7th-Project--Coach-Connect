// Noise filter for trainer-side Firestore listeners.
// Flow: a listener's onError hands us the error → we decide "benign flicker" vs "real bug".
// Used by the trainer client/roster listeners so a dropped connection doesn't show an error UI.

// Some Firestore listener errors are NOT bugs — they fire while auth is still settling,
// while the device is offline, or right as security rules re-evaluate. We swallow those
// so the UI stays calm, and let everything else bubble up as a real failure.
export function isBenignTrainerClientFirestoreError(err) {
  // vocab: ?. = optional chaining — read .code only if err exists, else undefined (no crash)
  // vocab/symbol: || '' = fall back to empty string so the comparisons below never see undefined
  const code = err?.code || '';
  // Firestore sometimes only puts the useful text in .message, and sometimes err is a raw
  // string, so normalize everything to one string before substring matching.
  const msg = String(err?.message || err || '');
  // Manipulate here: this is the allow-list of "ignore me" errors. Add a code/substring to
  // silence another flicker; remove one if you'd rather see it surface loudly during debugging.
  return (
    code === 'permission-denied' ||
    code === 'unavailable' ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('Failed to get document')
  );
}
