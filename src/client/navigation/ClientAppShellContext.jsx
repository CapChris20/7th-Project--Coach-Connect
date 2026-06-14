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
