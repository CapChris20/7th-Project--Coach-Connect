// Dev helper — jump to the neobrutalist component gallery for visual QA.
// Flow: openNbPreview() → rootNavigate → ClientNbComponentsPreview route.
// Used by: Metro console / ad-hoc imports during Design Law QA (not production UX).
//
// vocab: rootNavigate = reach the root stack from anywhere (see openScreenFromAnywhere)
// vocab: global = React Native / Metro debug object; safe to skip when undefined (web tests)

import { rootNavigate } from '../navigation/openScreenFromAnywhere';

// ===== NAMED CONSTANTS =====

const NB_PREVIEW_ROUTE = 'ClientNbComponentsPreview';

// ===== HELPER FUNCTIONS =====

// Attach so `global.openNbPreview()` works from the Metro / RN debugger console.
function attachOpenNbPreviewToGlobal() {
  const globalObjectExists = typeof global !== 'undefined';
  if (!globalObjectExists) {
    return;
  }
  global.openNbPreview = openNbPreview;
}

// ===== MAIN FUNCTION =====

/**
 * Navigate to the Nb components preview screen for visual QA.
 * Console: require('./src/look-and-feel/openNbPreview').openNbPreview()
 *
 * @returns {void}
 */
export function openNbPreview() {
  // 1. Send the root navigator to the design-system preview screen.
  rootNavigate(NB_PREVIEW_ROUTE);
}

// Side effect on load: expose the helper on `global` when the runtime has one.
attachOpenNbPreviewToGlobal();
