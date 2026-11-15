// One live trainer-sessions list shared by the whole trainer tree.
// Flow: SessionsProvider runs useSessions once → every child reads that same object.
// Used by: trainer screens that show sessions. One listener = no duplicate reads, no lists that drift.
// Read order: constants → guard helpers → provider + hooks.

import React, { createContext, useContext } from 'react';
import { useSessions } from '../scheduling/mySessions';

// ===== NAMED CONSTANTS =====

// Spoken error when a screen calls the required hook outside SessionsProvider.
const MISSING_PROVIDER_MESSAGE = 'useSharedSessionList requires SessionsProvider';

// vocab: createContext(null) = “no provider yet”.
// Null means the provider is missing. An empty session array from the hook is still a real value.
const SharedSessionListContext = createContext(null);

// ===== HELPER FUNCTIONS =====

/**
 * True when context still holds the createContext default (provider never mounted).
 * @param {object|null|undefined} sessionState
 * @returns {boolean}
 */
function providerIsMissing(sessionState) {
  return sessionState == null;
}

/**
 * Turn a missing provider into a clear Error.
 * An empty list from useSessions is valid — only null/undefined fails.
 * @param {object|null} sessionState
 * @returns {object}
 */
function sessionStateOrThrow(sessionState) {
  if (providerIsMissing(sessionState)) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return sessionState;
}

/**
 * Soft read of the shared list — null when no SessionsProvider is above.
 * Must stay a use* helper so Rules of Hooks stay happy.
 * @returns {object|null}
 */
function useReadSharedSessionState() {
  // vocab: useContext = React hook; returns the createContext default (null) when no provider is mounted.
  return useContext(SharedSessionListContext);
}

// ===== MAIN FUNCTION =====

/**
 * Mount above any screen that shows trainer sessions.
 * Unmounting tears the Firestore listener down (see mySessions.js).
 * @param {{ children: React.ReactNode }} props
 */
export function SessionsProvider({ children }) {
  // 1. Start the single live listener for this trainer’s sessions.
  // vocab: useSessions = reads auth uid + onSnapshot on the trainer sessions collection.
  const sessionState = useSessions();

  // 2. Hand that same object to every descendant via context.
  const providerElement = (
    <SharedSessionListContext.Provider value={sessionState}>
      {children}
    </SharedSessionListContext.Provider>
  );
  return providerElement;
}

/**
 * Required hook for screens that cannot render without session data.
 * Throws if SessionsProvider is not above this call.
 * @returns {object} same shape as useSessions()
 */
export function useSharedSessionList() {
  // 1. Read the nearest SessionsProvider value.
  const sessionState = useReadSharedSessionState();

  // 2. Fail fast with a spoken error instead of crashing on undefined destructuring later.
  return sessionStateOrThrow(sessionState);
}

/**
 * Optional hook for a widget that may sit outside the trainer tree.
 * Caller must handle null (no provider) themselves.
 * @returns {object|null}
 */
export function useSharedSessionListOptional() {
  // 1. Soft read — null is allowed; do not throw.
  return useReadSharedSessionState();
}
