/**
 * Shared trainer sessions state — one Firestore listener for the trainer app tree.
 */
import React, { createContext, useContext } from 'react';
import { useSessions } from '../hooks/useMyTrainingSessions';

const SessionsContext = createContext(null);

export function SessionsProvider({ children }) {
  const value = useSessions();
  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

export function useSessionsContext() {
  const ctx = useContext(SessionsContext);
  if (!ctx) {
    throw new Error('useSessionsContext requires SessionsProvider');
  }
  return ctx;
}

export function useSessionsContextOptional() {
  return useContext(SessionsContext);
}
