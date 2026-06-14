import React, { createContext, useContext } from 'react';

export const TrainerAppShellContext = createContext(null);

export function TrainerAppShellProvider({ value, children }) {
  return (
    <TrainerAppShellContext.Provider value={value}>
      {children}
    </TrainerAppShellContext.Provider>
  );
}

export function useTrainerAppShell() {
  const ctx = useContext(TrainerAppShellContext);
  if (!ctx) {
    throw new Error('useTrainerAppShell must be used within TrainerAppShellProvider');
  }
  return ctx;
}
