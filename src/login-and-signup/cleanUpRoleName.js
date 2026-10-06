// Turns a messy role value ("Trainer", " client ", undefined) into exactly 'trainer' or 'client'.
// Flow: prefer the prop the parent passed → fall back to the navigation route param → default to client.
// Used by: the onboarding wizard, so its branching matches how LoginGate routes people after sign-in.

// ===== NAMED CONSTANTS =====

const TRAINER_ROLE = 'trainer';
const CLIENT_ROLE = 'client';

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {string} [roleProp]
 * @param {string} [routeRole]
 * @returns {'trainer'|'client'}
 */
export function cleanUpRoleName(roleProp, routeRole) {
  // vocab: ?? keeps an empty string. || would skip it and fall through to the route role.
  const normalizedRole = String(roleProp ?? routeRole ?? '').toLowerCase().trim();

  // Manipulate here: only the exact word trainer unlocks trainer onboarding. Anything else is a client.
  if (normalizedRole === TRAINER_ROLE) return TRAINER_ROLE;
  return CLIENT_ROLE;
}
