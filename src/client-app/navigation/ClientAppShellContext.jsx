/**
 * Client App Shell Context
 *
 * Purpose: Client App Shell Context — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientAppShellProvider, useClientAppShell, ClientAppShellContext
 *
 * @file-header
 */
import React, { createContext, useContext } from 'react';

export const ClientAppShellContext = createContext(null);

export function ClientAppShellProvider({ value, children }) {
  return (
    <ClientAppShellContext.Provider value={value}>
      {children}
    </ClientAppShellContext.Provider>
  );
}

export function useClientAppShell() {
  const ctx = useContext(ClientAppShellContext);
  if (!ctx) {
    throw new Error('useClientAppShell must be used within ClientAppShellProvider');
  }
  return ctx;
}
