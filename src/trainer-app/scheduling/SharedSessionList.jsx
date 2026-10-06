// Shares one trainer-sessions listener with the whole trainer tree.
// Flow: the provider calls useSessions once → screens read that same result.
// Used by: trainer screens that list sessions. One listener avoids duplicate reads and lists that drift apart.

import React, { createContext, useContext } from 'react';
import { useSessions } from '../scheduling/mySessions';

// ===== NAMED CONSTANTS =====

const MISSING_PROVIDER_MESSAGE = 'useSharedSessionList requires SessionsProvider';

// ===== HELPER FUNCTIONS =====

// Null means there is no provider. An empty session list is a real value from the hook.
const SharedSessionList = createContext(null);

// ===== MAIN FUNCTION =====

/**
 * Mount this above any screen that shows sessions. Unmounting tears the listener down.
 * @param {{ children: import('react').ReactNode }} props
 */
export function SessionsProvider({ children }) {
  const sessionState = useSessions();
  return <SharedSessionList.Provider value={sessionState}>{children}</SharedSessionList.Provider>;
}

/**
 * For screens that cannot render without session data.
 * @returns {object}
 */
export function useSharedSessionList() {
  const sessionState = useContext(SharedSessionList);
  if (!sessionState) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return sessionState;
}

/**
 * For a widget that may render outside the trainer tree. The caller handles null.
 * @returns {object|null}
 */
export function useSharedSessionListOptional() {
  return useContext(SharedSessionList);
}
