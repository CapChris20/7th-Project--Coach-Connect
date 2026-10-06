// Shares the trainer's Pro subscription with any screen under the provider.
// Flow: a parent sets the value. Children read it with useContext.
// Used by: the Pro plan screens.

import { createContext } from 'react';

// ===== NAMED CONSTANTS =====

// Null until a provider higher in the tree supplies the real subscription.
const NO_SUBSCRIPTION_YET = null;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * React context for the signed-in trainer's subscription.
 * The default is null until a provider supplies the real status.
 */
export const SubscriptionContext = createContext(NO_SUBSCRIPTION_YET);
