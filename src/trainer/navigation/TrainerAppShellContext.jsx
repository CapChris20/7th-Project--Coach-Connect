/**
 * Trainer App Shell Context
 *
 * Purpose: Trainer App Shell Context — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: TrainerAppShellProvider, useTrainerAppShell, TrainerAppShellContext
 *
 * @file-header
 */
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
