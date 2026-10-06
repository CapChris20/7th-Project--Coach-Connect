// Shares the trainer app shell (navigation, theme, the open screen) with every trainer tab.
// Flow: the shell screen builds one value → the provider publishes it → screens read it with the hook.
// Used by: the trainer main screen and every trainer tab that needs shell actions.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

const MISSING_PROVIDER_MESSAGE = 'useTrainerAppStartShell must be used within TrainerAppStartShellProvider';

// ===== HELPER FUNCTIONS =====

// vocab: createContext broadcasts a value down the tree. Null means no provider is above this screen.
const TrainerOpenScreenTracker = createContext(null);

// ===== MAIN FUNCTION =====

/**
 * @param {{ value: object, children: import('react').ReactNode }} props
 */
export function TrainerAppStartShellProvider({ value, children }) {
  return (
    <TrainerOpenScreenTracker.Provider value={value}>
      {children}
    </TrainerOpenScreenTracker.Provider>
  );
}

/**
 * Reads the trainer shell. Throws when a screen is mounted outside the provider.
 * @returns {object}
 */
export function useTrainerAppStartShell() {
  const shellValue = useContext(TrainerOpenScreenTracker);
  if (!shellValue) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return shellValue;
}

export { TrainerOpenScreenTracker };
