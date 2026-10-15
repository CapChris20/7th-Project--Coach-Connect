// Shares the client app shell (navigation, theme, the open screen) with every client tab.
// Flow: the shell screen builds one value → the provider publishes it → screens read it with the hook.
// Used by the client main screen and every client tab that needs shell actions.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

const MISSING_PROVIDER_MESSAGE = 'useClientAppStartShell must be used within ClientAppStartShellProvider';

// ===== HELPER FUNCTIONS =====

const ClientOpenScreenTracker = createContext(null);

function requireClientShell(shellValue) {
  if (shellValue) return shellValue;
  throw new Error(MISSING_PROVIDER_MESSAGE);
}

// ===== MAIN FUNCTION =====

/**
 * Publishes the client shell to every screen under this provider.
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
 * Reads the client shell. Throws when a screen is mounted outside the provider.
 * @returns {object}
 */
export function useClientAppStartShell() {
  return requireClientShell(useContext(ClientOpenScreenTracker));
}

export { ClientOpenScreenTracker };
