// Shared "app shell" state for the trainer side (nav handlers, theme flags, active tab, etc).
// Flow: the trainer shell screen builds one `value` object → Provider puts it on the tree →
// any nested trainer screen pulls it out with useTrainerAppShell() instead of prop-drilling.
// Used by the trainer main screen + every trainer tab/overlay that needs shell-level actions.
import React, { createContext, useContext } from 'react';

// vocab: createContext = React's way to broadcast a value down the tree without passing props.
// Default is null on purpose — that's how the hook below detects "no Provider above me".
export const TrainerAppShellContext = createContext(null);

// Thin wrapper so callers write <TrainerAppShellProvider value={...}> instead of touching
// the raw Context object. Keeping the wrapper here means we can add shell-wide setup later
// (memoizing, logging, defaults) in one place without editing every call site.
export function TrainerAppShellProvider({ value, children }) {
  return (
    <TrainerAppShellContext.Provider value={value}>
      {children}
    </TrainerAppShellContext.Provider>
  );
}

// The read side. We throw instead of returning null so a misplaced screen fails loudly in
// development rather than silently rendering with missing nav handlers.
export function useTrainerAppShell() {
  // vocab: useContext = React hook that reads the nearest Provider's value for this context
  const ctx = useContext(TrainerAppShellContext);
  if (!ctx) {
    throw new Error('useTrainerAppShell must be used within TrainerAppShellProvider');
  }
  return ctx;
}
