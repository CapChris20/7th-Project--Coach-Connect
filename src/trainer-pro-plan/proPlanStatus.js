// React context token so any screen under ProPlanSetup can read the same subscription object.
// Flow: parent ProPlanSetup fills the provider value → children call useContext(SubscriptionContext).
// Used by trainer Pro plan screens and gates that sit inside the provider tree.

import { createContext } from 'react';

// ===== NAMED CONSTANTS =====

// vocab: createContext — React’s way to pass a value down without threading props on every level.
// Until ProPlanSetup mounts and wraps children, nothing has called the provider yet.
const NO_PROVIDER_VALUE_YET = null;

// ===== HELPER FUNCTIONS =====

// No helpers — this file only exports the context token. Live data always comes from ProPlanSetup.

// ===== MAIN FUNCTION =====

/**
 * Context token for the signed-in trainer’s subscription row.
 * Default is null until a Provider higher in the tree supplies the real status object.
 * Screens import this and call useContext(SubscriptionContext) — they never invent a default shape here.
 */
export const SubscriptionContext = createContext(NO_PROVIDER_VALUE_YET);
