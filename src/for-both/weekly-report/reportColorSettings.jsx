// Weekly report light/dark colors, saved on this phone and shared down the report screens.
// Flow: read the saved mode → share colors through context → write the mode back when it flips.
// Used by WeeklyReportScreen and the report cards that call useTheme().

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS, STORAGE_KEY } from './reportColors';

// ===== NAMED CONSTANTS =====

// vocab: createContext = React's pipe so report screens can read the theme without a prop on every card.
// null (not {}) lets useTheme tell "no provider above me" apart from a real theme value.
const weeklyReportThemeContext = createContext(null);

const DARK_MODE = 'dark';
const LIGHT_MODE = 'light';

// ===== HELPER FUNCTIONS =====

// Anything other than the exact word "light" starts dark, including a missing initialMode.
function startingColorMode(initialMode) {
  if (initialMode === LIGHT_MODE) return LIGHT_MODE;
  return DARK_MODE;
}

// AsyncStorage hands back a string. Only the two modes we write are safe to apply.
function isStoredColorMode(storedValue) {
  return storedValue === DARK_MODE || storedValue === LIGHT_MODE;
}

// The toggle has no third mode. Any unexpected current value lands on dark, matching the old ternary.
function flippedColorMode(currentMode) {
  if (currentMode === DARK_MODE) return LIGHT_MODE;
  return DARK_MODE;
}

// A failed write must not throw through the toggle. The on-screen mode still changes.
function rememberColorMode(colorMode) {
  AsyncStorage.setItem(STORAGE_KEY, colorMode).catch(() => {});
}

function colorsForMode(colorMode) {
  if (colorMode === DARK_MODE) return DARK_COLORS;
  return LIGHT_COLORS;
}

// ===== MAIN FUNCTION =====

/**
 * Loads the saved report theme and shares mode, colors, and the toggle with the report tree.
 * @param {{ children: import('react').ReactNode, initialMode?: string }} props
 * @returns {import('react').ReactElement}
 */
export function WeeklyReportThemeProvider({ children, initialMode = DARK_MODE }) {
  const [colorMode, setColorMode] = useState(startingColorMode(initialMode));
  const [isLoaded, setIsLoaded] = useState(false);

  // vocab: useEffect = run after paint. Empty deps means once per mount, not on every theme flip.
  // The flag skips setState if the screen is already gone when the read finishes.
  useEffect(() => {
    let isStillMounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((storedValue) => {
      if (isStillMounted && isStoredColorMode(storedValue)) {
        setColorMode(storedValue);
      }
      if (isStillMounted) setIsLoaded(true);
    });
    return () => {
      isStillMounted = false;
    };
  }, []);

  // vocab: useMemo = rebuild this object only when the mode or the loaded flag changes.
  // The storage write stays inside the toggle updater so it still runs with that state update.
  const themeValue = useMemo(() => {
    return {
      mode: colorMode,
      colors: colorsForMode(colorMode),
      loaded: isLoaded,
      toggle: () => {
        setColorMode((currentMode) => {
          const flippedMode = flippedColorMode(currentMode);
          rememberColorMode(flippedMode);
          return flippedMode;
        });
      },
      setMode: (requestedMode) => {
        if (!isStoredColorMode(requestedMode)) return;
        setColorMode(requestedMode);
        rememberColorMode(requestedMode);
      },
    };
  }, [colorMode, isLoaded]);

  return (
    <weeklyReportThemeContext.Provider value={themeValue}>
      {children}
    </weeklyReportThemeContext.Provider>
  );
}

/**
 * Read the weekly report palette. Throws when this component is outside WeeklyReportThemeProvider.
 * @returns {{ mode: string, colors: object, loaded: boolean, toggle: function, setMode: function }}
 */
export function useTheme() {
  const themeSettings = useContext(weeklyReportThemeContext);
  if (!themeSettings) throw new Error('useTheme must be used within WeeklyReportThemeProvider');
  return themeSettings;
}

export { GRADIENTS } from './reportColors';
