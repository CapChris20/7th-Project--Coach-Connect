// Shared "app shell" state for the client side (nav handlers, active tab, theme flags, etc).
// Flow: the client shell screen builds one `value` object → Provider publishes it on the tree →
// any nested client screen reads it with useClientAppShell() instead of prop-drilling.
// Used by the client main screen and every client tab/overlay that needs shell-level actions.
import React, { createContext, useContext } from 'react';

// vocab: createContext = React's way to broadcast a value down the tree without passing props.
// Default is null on purpose — that's the signal the hook below uses to detect a missing Provider.
export const ClientAppShellContext = createContext(null);

// Thin wrapper so call sites write <ClientAppShellProvider value={...}> and never touch the raw
// Context object. Having the wrapper here means shell-wide setup (defaults, memoizing, logging)
// can be added in one place later without editing every screen.
export function ClientAppShellProvider({ value, children }) {
  return (
    <ClientAppShellContext.Provider value={value}>
      {children}
    </ClientAppShellContext.Provider>
  );
}

// The read side. We throw rather than return null so a screen mounted outside the shell fails
// loudly in development instead of quietly rendering with dead nav buttons.
export function useClientAppShell() {
  // vocab: useContext = React hook that reads the nearest Provider's value for this context
  const ctx = useContext(ClientAppShellContext);
  if (!ctx) {
    throw new Error('useClientAppShell must be used within ClientAppShellProvider');
  }
  return ctx;
}
