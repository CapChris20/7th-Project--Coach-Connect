// Shared "app shell" state for the trainer side (nav handlers, theme flags, active tab, etc).
// Flow: the trainer shell screen builds one `value` object → Provider puts it on the tree →
// any nested trainer screen pulls it out with useTrainerAppStartShell() instead of prop-drilling.
// Used by the trainer main screen + every trainer tab/overlay that needs shell-level actions.
import React, { createContext, useContext } from 'react';

// vocab: createContext = React's way to broadcast a value down the tree without passing props.
// Default is null on purpose — that's how the hook below detects "no Provider above me".
export const TrainerOpenScreenTracker = createContext(null);

// Thin wrapper so callers write <TrainerAppStartShellProvider value={...}> instead of touching
// the raw Context object. Keeping the wrapper here means we can add shell-wide setup later
// (memoizing, logging, defaults) in one place without editing every call site.
export function TrainerAppStartShellProvider({ value, children }) {
  return (
    <TrainerOpenScreenTracker.Provider value={value}>
      {children}
    </TrainerOpenScreenTracker.Provider>
  );
}

// The read side. We throw instead of returning null so a misplaced screen fails loudly in
// development rather than silently rendering with missing nav handlers.
export function useTrainerAppStartShell() {
  // vocab: useContext = React hook that reads the nearest Provider's value for this context
  const ctx = useContext(TrainerOpenScreenTracker);
  if (!ctx) {
    throw new Error('useTrainerAppStartShell must be used within TrainerAppStartShellProvider');
  }
  return ctx;
}
