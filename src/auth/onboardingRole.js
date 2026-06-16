/** Role normalization for onboarding (matches AuthGate routing defaults). */
export function normalizeOnboardingRole(roleProp, routeRole) {
  const s = String(roleProp ?? routeRole ?? '').toLowerCase().trim();
  return s === 'trainer' ? 'trainer' : 'client';
}
