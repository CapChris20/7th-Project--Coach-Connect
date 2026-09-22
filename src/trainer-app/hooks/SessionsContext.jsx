// Shares ONE trainer-sessions Firestore subscription with the whole trainer tree.
// Flow: Provider calls useSessions() once → puts the result on context → screens read it.
// Why it exists: if each screen called useSessions() itself we'd open duplicate listeners
// (extra reads, extra cost, out-of-sync lists). One listener, many readers.
import React, { createContext, useContext } from 'react';
import { useSessions } from '../hooks/useMyTrainingSessions';

// Default null so the hooks below can tell "no Provider" apart from "no sessions yet".
const SessionsContext = createContext(null);

// Mount this ABOVE any screen that shows sessions. The listener's lifetime matches this
// component: mounting subscribes, unmounting tears the subscription down.
export function SessionsProvider({ children }) {
  const value = useSessions();
  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

// Strict reader — for screens that genuinely cannot render without session data.
// Throwing here turns a confusing blank screen into an obvious "you forgot the Provider".
export function useSessionsContext() {
  const ctx = useContext(SessionsContext);
  if (!ctx) {
    throw new Error('useSessionsContext requires SessionsProvider');
  }
  return ctx;
}

// Lenient reader — for shared components that may render inside OR outside the trainer tree
// (e.g. a widget reused on a screen with no Provider). Callers must handle null themselves.
export function useSessionsContextOptional() {
  return useContext(SessionsContext);
}
