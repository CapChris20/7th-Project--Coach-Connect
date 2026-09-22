// Alias file: `sendPasswordResetEmail` is just the friendlier name for `requestPasswordReset`.
// Flow: caller imports this name → the real work (backend API call, Firebase fallback) happens in requestPasswordReset.
// Exists so screens can import an intention-revealing name without knowing about the API/Firebase split.

// Note: this is a re-export, not a wrapper — there is no extra behavior here. Change reset logic in requestPasswordReset.js.
export { requestPasswordReset as sendPasswordResetEmail } from './requestPasswordReset';
