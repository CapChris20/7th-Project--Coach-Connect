// Turns a messy role value ("Trainer", " client ", undefined) into exactly 'trainer' or 'client'.
// Flow: prefer the prop the parent passed → fall back to the navigation route param → default 'client'.
// Used by the onboarding wizard so its branching matches how LoginGate screenNames people after sign-in.

export function cleanUpRoleName(roleProp, routeRole) {
  // Collapse both possible sources into one lowercase, trimmed string so comparison is safe.
  // vocab/symbol: ?? = "if the left side is null/undefined, use the right side instead"
  //               (unlike ||, an empty string '' on the left is kept, not skipped)
  const s = String(roleProp ?? routeRole ?? '').toLowerCase().trim();

  // Only the exact word 'trainer' unlocks trainer onboarding; everything else is treated as a client.
  // Manipulate here: this is the one place that decides the default role — flipping the fallback to
  // 'trainer' would send unknown/blank roles down the trainer path instead.
  return s === 'trainer' ? 'trainer' : 'client';
}
