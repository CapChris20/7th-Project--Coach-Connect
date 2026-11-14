// Turns a messy role value ("Trainer", " client ", undefined) into exactly 'trainer' or 'client'.
// Flow: prefer the prop the parent passed → fall back to the navigation route param → default to client.
// Used by: the onboarding wizard, so its branching matches how LoginGate routes people after sign-in.

// ===== NAMED CONSTANTS =====

const TRAINER_ROLE = 'trainer';
const CLIENT_ROLE = 'client';

// ===== HELPER FUNCTIONS =====

// vocab/symbol: ?? = use the right side only when the left is null or undefined (empty "" stays "").
// Why ?? not ||: an intentional empty prop must not skip past to the route and surprise us.
function roleTextFromPropOrRoute(roleFromParent, roleFromRoute) {
  const chosenRawValue = roleFromParent ?? roleFromRoute ?? '';
  const lowerTrimmed = String(chosenRawValue).toLowerCase().trim();
  return lowerTrimmed;
}

// Manipulate here: only this exact spelling unlocks trainer onboarding. Typos become client.
function spellingMeansTrainer(roleText) {
  return roleText === TRAINER_ROLE;
}

// ===== MAIN FUNCTION =====

/**
 * Normalize a role prop / route param into the two roles the app understands.
 * @param {string} [roleProp] Role the parent screen already decided.
 * @param {string} [routeRole] Role sitting on the navigation route as a fallback.
 * @returns {'trainer'|'client'}
 */
export function cleanUpRoleName(roleProp, routeRole) {
  // 1. Lowercase + trim whatever the parent or route handed us.
  const roleText = roleTextFromPropOrRoute(roleProp, routeRole);

  // 2. Trainer is the narrow match; every other spelling becomes client.
  if (spellingMeansTrainer(roleText)) {
    return TRAINER_ROLE;
  }
  return CLIENT_ROLE;
}
