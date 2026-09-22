// Re-exports the onboarding screenshot plan that lives in a JSON manifest.
// Flow: JSON list of capture steps → exported as-is, plus its length as a step count.
// Used by the snapshot runner so it knows which onboarding states to screenshot and how many there are.

import manifest from './onboardingSnapshotManifest.json';

// Manipulate here: add/remove/reorder capture steps in onboardingSnapshotManifest.json, not here —
// this file intentionally holds no logic so the manifest stays the single source of truth.
export const ONBOARDING_SNAPSHOT_CAPTURES = manifest;
export const ONBOARDING_SNAPSHOT_TOTAL = manifest.length;
