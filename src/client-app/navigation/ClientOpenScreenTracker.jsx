// Shares the client app shell (navigation, theme, the open screen) with every client tab.
// Flow: the shell screen builds one value → the provider publishes it → screens read it with the hook.
// Used by: the client main screen and every client tab that needs shell actions.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

const MISSING_PROVIDER_MESSAGE = 'useClientAppStartShell must be used within ClientAppStartShellProvider';

// ===== HELPER FUNCTIONS =====

// vocab: createContext broadcasts a value down the tree. Null means no provider is above this screen.
const ClientOpenScreenTracker = createContext(null);

// ===== MAIN FUNCTION =====

/**
 * @param {{ value: object, children: import('react').ReactNode }} props
 */
export function ClientAppStartShellProvider({ value, children }) {
  return (
    <ClientOpenScreenTracker.Provider value={value}>
      {children}
    </ClientOpenScreenTracker.Provider>
  );
}

/**
 * Reads the client shell. Throws when a screen is mounted outside the provider,
 * so a dead nav button fails loudly instead of rendering blank.
 * @returns {object}
 */
export function useClientAppStartShell() {
  // vocab: useContext reads the nearest provider for this context.
  const shellValue = useContext(ClientOpenScreenTracker);
  if (!shellValue) {
    throw new Error(MISSING_PROVIDER_MESSAGE);
  }
  return shellValue;
}

export { ClientOpenScreenTracker };
