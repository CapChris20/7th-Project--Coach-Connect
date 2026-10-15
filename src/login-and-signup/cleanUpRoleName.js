// Turns a messy role value ("Trainer", " client ", undefined) into exactly 'trainer' or 'client'.
// Flow: prefer the prop the parent passed → fall back to the navigation route param → default to client.
// Used by: the onboarding wizard, so its branching matches how LoginGate routes people after sign-in.

// ===== NAMED CONSTANTS =====

const TRAINER_ROLE = 'trainer';
const CLIENT_ROLE = 'client';

// ===== HELPER FUNCTIONS =====

/**
 * Lowercase + trim so " Trainer " and "TRAINER" both match.
 * vocab/symbol: ?? keeps an empty string. || would skip it and fall through to the route role.
 * @param {string} [roleProp]
 * @param {string} [routeRole]
 * @returns {string}
 */
function normalizedRoleText(roleProp, routeRole) {
  return String(roleProp ?? routeRole ?? '').toLowerCase().trim();
}

function isTrainerRoleText(roleText) {
  // Manipulate here: only the exact word trainer unlocks trainer onboarding. Anything else is a client.
  return roleText === TRAINER_ROLE;
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} [roleProp]
 * @param {string} [routeRole]
 * @returns {'trainer'|'client'}
 */
export function cleanUpRoleName(roleProp, routeRole) {
  const roleText = normalizedRoleText(roleProp, routeRole);
  if (isTrainerRoleText(roleText)) return TRAINER_ROLE;
  return CLIENT_ROLE;
}
