// Shared "app shell" state for the client side (nav handlers, active tab, theme flags, etc).
// Flow: the client shell screen builds one `value` object → Provider publishes it on the tree →
// any nested client screen reads it with useClientAppStartShell() instead of prop-drilling.
// Used by the client main screen and every client tab/overlay that needs shell-level actions.
import React, { createContext, useContext } from 'react';

// vocab: createContext = React's way to broadcast a value down the tree without passing props.
// Default is null on purpose — that's the signal the hook below uses to detect a missing Provider.
export const ClientOpenScreenTracker = createContext(null);

// Thin wrapper so call sites write <ClientAppStartShellProvider value={...}> and never touch the raw
// Context object. Having the wrapper here means shell-wide setup (defaults, memoizing, logging)
// can be added in one place later without editing every screen.
export function ClientAppStartShellProvider({ value, children }) {
  return (
    <ClientOpenScreenTracker.Provider value={value}>
      {children}
    </ClientOpenScreenTracker.Provider>
  );
}

// The read side. We throw rather than return null so a screen mounted outside the shell fails
// loudly in development instead of quietly rendering with dead nav buttons.
export function useClientAppStartShell() {
  // vocab: useContext = React hook that reads the nearest Provider's value for this context
  const ctx = useContext(ClientOpenScreenTracker);
  if (!ctx) {
    throw new Error('useClientAppStartShell must be used within ClientAppStartShellProvider');
  }
  return ctx;
}
