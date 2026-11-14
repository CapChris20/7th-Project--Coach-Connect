// Shares the client app shell (navigation, theme, the open screen) with every client tab.
// Flow: ClientMainScreen builds one shell value → provider publishes it → tabs read it with the hook.
// Used by the client main screen and every client tab that needs shell actions.
// Key exports: ClientAppStartShellProvider, useClientAppStartShell, ClientOpenScreenTracker.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

// Manipulate here: error copy when a screen mounts outside the client shell tree.
const CONTEXT_OUTSIDE_PROVIDER_MESSAGE =
  'useClientAppStartShell must be used within ClientAppStartShellProvider';

// ===== HELPER FUNCTIONS =====

// vocab: React context — value flows down the tree without prop drilling; null means “no provider yet”
const ClientOpenScreenTracker = createContext(null);

/**
 * True when the provider has already published a shell object.
 * @param {object|null|undefined} maybeShell
 * @returns {boolean}
 */
function shellValueIsReady(maybeShell) {
  if (!maybeShell) return false;
  return true;
}

/**
 * Return the shell object, or throw so a missing provider fails loud in development.
 * @param {object|null} maybeShell
 * @returns {object}
 */
function requireShellOrThrow(maybeShell) {
  const shellIsReady = shellValueIsReady(maybeShell);
  if (shellIsReady) {
    return maybeShell;
  }
  throw new Error(CONTEXT_OUTSIDE_PROVIDER_MESSAGE);
}

// ===== MAIN FUNCTION =====

/**
 * Publishes the client shell so every screen under this tree can read navigation / theme / open-screen.
 * Flow: 1. wrap children  2. pass the same shell object ClientMainScreen built
 * @param {{ value: object, children: import('react').ReactNode }} props
 */
export function ClientAppStartShellProvider({ value, children }) {
  // 1. Publish one shell object for the whole client stack.
  return (
    <ClientOpenScreenTracker.Provider value={value}>
      {children}
    </ClientOpenScreenTracker.Provider>
  );
}

/**
 * Reads the client shell. Throws when a screen mounts outside ClientAppStartShellProvider.
 * Flow: 1. read context  2. require a real shell (fail loud if null)
 * @returns {object}
 */
export function useClientAppStartShell() {
  // 1. Read whatever ClientMainScreen put on the provider.
  // vocab: useContext = React hook that returns the nearest matching Provider value
  const shellFromContext = useContext(ClientOpenScreenTracker);

  // 2. Fail loud when a screen mounts outside the client tree.
  const shell = requireShellOrThrow(shellFromContext);
  return shell;
}

export { ClientOpenScreenTracker };
