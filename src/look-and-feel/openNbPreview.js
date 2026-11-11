// Dev helper to open the neobrutalist components preview screen
// Flow: call this from console or dev tools to navigate to the preview
// Where used: development only, for visual QA of design system components

import { rootNavigate } from '../navigation/openScreenFromAnywhere';

/**
 * Navigate to the Nb components preview screen.
 * Usage: import and call openNbPreview() from anywhere, or use in console:
 *   require('./src/look-and-feel/openNbPreview').openNbPreview()
 */
export function openNbPreview() {
  rootNavigate('ClientNbComponentsPreview');
}

// For console access
if (typeof global !== 'undefined') {
  global.openNbPreview = openNbPreview;
}
