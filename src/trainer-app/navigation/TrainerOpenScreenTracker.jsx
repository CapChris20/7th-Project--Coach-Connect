// Shares the trainer app shell (navigation, theme, the open screen) with every trainer tab.
// Flow: shell screen builds one value → provider publishes it → screens read it with the hook.
// Used by the trainer main screen and every trainer tab that needs shell actions.
// Read order: constants → helpers → provider + hook mains → re-export context for rare direct reads.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

const MISSING_PROVIDER_MESSAGE =
  'useTrainerAppStartShell must be used within TrainerAppStartShellProvider';

// ===== HELPER FUNCTIONS =====

// vocab: createContext broadcasts a value down the tree. Null means no provider is above this screen.
const TrainerOpenScreenTracker = createContext(null);

/**
 * True when a provider published a non-null shell bag.
 * @param {object|null} shellValue
 * @returns {boolean}
 */
function shellValueIsPresent(shellValue) {
  return Boolean(shellValue);
}

/**
 * Fail fast when a screen mounts outside the shell provider.
 * @param {object|null} shellValue
 * @returns {object}
 */
function requireTrainerShell(shellValue) {
  if (!shellValueIsPresent(shellValue)) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return shellValue;
}

/**
 * Wrap children in the context Provider with the shell bag.
 * Kept as a helper so the exported provider stays a one-step recipe.
 * @param {object} shellValue
 * @param {import('react').ReactNode} children
 * @returns {import('react').ReactElement}
 */
function publishShellValueToTree(shellValue, children) {
  return (
    <TrainerOpenScreenTracker.Provider value={shellValue}>
      {children}
    </TrainerOpenScreenTracker.Provider>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Publish the trainer shell bag to every descendant that calls useTrainerAppStartShell.
 * @param {{ value: object, children: import('react').ReactNode }} props
 */
export function TrainerAppStartShellProvider({ value, children }) {
  // 1. Hand the same object reference to every descendant via context.
  return publishShellValueToTree(value, children);
}

/**
 * Reads the trainer shell. Throws when a screen is mounted outside the provider.
 * @returns {object}
 */
export function useTrainerAppStartShell() {
  // 1. Read whatever the provider last published (null when missing).
  // vocab: useContext = React hook that returns the nearest matching Provider value
  const shellValueFromContext = useContext(TrainerOpenScreenTracker);

  // 2. Fail fast so we do not render trainer overlays with a half-built shell.
  return requireTrainerShell(shellValueFromContext);
}

export { TrainerOpenScreenTracker };

// ===== PLUMBING — skip unless debugging provider wiring =====
// (helpers above cover this file; section kept for Variation 3 story shape)
