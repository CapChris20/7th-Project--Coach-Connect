// Shares one trainer-sessions listener with the whole trainer tree.
// Flow: SessionsProvider calls useSessions once → child screens read that same result.
// Used by: trainer screens that list sessions. One listener avoids duplicate reads and lists that drift apart.

import React, { createContext, useContext } from 'react';
import { useSessions } from '../scheduling/mySessions';

// ===== NAMED CONSTANTS =====

const MISSING_PROVIDER_MESSAGE = 'useSharedSessionList requires SessionsProvider';

// Null means "no provider mounted". An empty session list from the hook is a real value.
const SharedSessionListContext = createContext(null);

// ===== HELPER FUNCTIONS =====

/**
 * Turn a missing provider into a clear error (empty list is still a valid value).
 * @param {object|null} sessionState
 * @returns {object}
 */
function sessionStateOrThrow(sessionState) {
  if (!sessionState) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return sessionState;
}

// ===== MAIN FUNCTION =====

/**
 * Mount this above any screen that shows sessions. Unmounting tears the listener down.
 * @param {{ children: import('react').ReactNode }} props
 */
export function SessionsProvider({ children }) {
  // vocab: useSessions = live Firestore listener for this trainer's sessions (see mySessions.js).
  const sessionState = useSessions();
  return (
    <SharedSessionListContext.Provider value={sessionState}>
      {children}
    </SharedSessionListContext.Provider>
  );
}

/**
 * For screens that cannot render without session data.
 * @returns {object}
 */
export function useSharedSessionList() {
  // vocab: useContext = React hook that reads the nearest matching Provider value.
  const sessionState = useContext(SharedSessionListContext);
  return sessionStateOrThrow(sessionState);
}

/**
 * For a widget that may render outside the trainer tree. The caller handles null.
 * @returns {object|null}
 */
export function useSharedSessionListOptional() {
  return useContext(SharedSessionListContext);
}
