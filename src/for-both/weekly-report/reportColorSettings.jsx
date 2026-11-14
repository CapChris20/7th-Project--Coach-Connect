// Weekly report light/dark palette — saved on device and shared through React context.
// Flow: read AsyncStorage on mount → expose colors + toggle → write mode when user flips theme.
// Used by WeeklyReportScreen and every report card that calls useTheme().
// Read order: constants → provider recipe → useTheme → PLUMBING (mode helpers).

import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS, STORAGE_KEY } from './reportColors';

// ===== NAMED CONSTANTS =====

// vocab: createContext = pipe so deep report cards read theme without prop-drilling every child
// null (not {}) lets useTheme tell "no provider above me" apart from a real theme value
const weeklyReportThemeContext = createContext(null);

const DARK_MODE = 'dark';
const LIGHT_MODE = 'light';
const THEME_PROVIDER_MISSING_ERROR = 'useTheme must be used within WeeklyReportThemeProvider';

// ===== MAIN FUNCTION =====

/**
 * Loads the saved report theme and shares mode, colors, and the toggle with the report tree.
 * Hook order is frozen: colorMode state → loaded state → mount read → memoized value.
 * @param {{ children: import('react').ReactNode, initialMode?: string }} props
 * @returns {import('react').ReactElement}
 */
export function WeeklyReportThemeProvider({ children, initialMode = DARK_MODE }) {
  // vocab: useState = React hook that keeps a value across re-renders
  const [colorMode, setColorMode] = useState(colorModeFromInitialProp(initialMode));
  const [isLoaded, setIsLoaded] = useState(false);

  // 1. After first paint, read persisted mode once (empty deps — not on every theme flip)
  // vocab: useEffect = runs after paint; return cleanup runs when this provider unmounts
  // vocab: isStillMounted flag skips setState if user left the screen before AsyncStorage returns
  useEffect(() => {
    let isStillMounted = true;

    AsyncStorage.getItem(STORAGE_KEY).then((storedValue) => {
      applyStoredModeIfStillMounted(storedValue, isStillMounted, setColorMode);
      markLoadedIfStillMounted(isStillMounted, setIsLoaded);
    });

    return () => {
      isStillMounted = false;
    };
  }, []);

  // 2. Rebuild context object only when mode or loaded flag changes (not every child render)
  // vocab: useMemo = cheap referential stability for consumers that depend on themeValue
  const themeValue = useMemo(
    () => assembleThemeContextValue(colorMode, isLoaded, setColorMode),
    [colorMode, isLoaded],
  );

  // 3. Wrap report subtree so every card can call useTheme()
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
  // vocab: useContext = read the nearest matching Provider value above this component
  const themeSettings = useContext(weeklyReportThemeContext);
  if (!themeSettings) throw new Error(THEME_PROVIDER_MISSING_ERROR);
  return themeSettings;
}

export { GRADIENTS } from './reportColors';

// ===== HELPER FUNCTIONS =====

function applyStoredModeIfStillMounted(storedValue, isStillMounted, setColorMode) {
  if (!isStillMounted) return;
  if (!storedValueIsKnownMode(storedValue)) return;
  setColorMode(storedValue);
}

function markLoadedIfStillMounted(isStillMounted, setIsLoaded) {
  if (!isStillMounted) return;
  setIsLoaded(true);
}

// ===== PLUMBING — skip unless debugging =====

// Anything other than the exact word "light" starts dark, including a missing initialMode prop
function colorModeFromInitialProp(initialMode) {
  if (initialMode === LIGHT_MODE) return LIGHT_MODE;
  return DARK_MODE;
}

// AsyncStorage hands back a string. Only the two modes we write are safe to apply
function storedValueIsKnownMode(storedValue) {
  if (storedValue === DARK_MODE) return true;
  if (storedValue === LIGHT_MODE) return true;
  return false;
}

// Toggle has no third mode — unexpected current value lands on dark (same as the old ternary)
function oppositeColorMode(currentMode) {
  if (currentMode === DARK_MODE) return LIGHT_MODE;
  return DARK_MODE;
}

// Failed write must not throw through the toggle — on-screen mode still changes
function persistColorModeToDisk(colorMode) {
  AsyncStorage.setItem(STORAGE_KEY, colorMode).catch(() => {});
}

function paletteForColorMode(colorMode) {
  if (colorMode === DARK_MODE) return DARK_COLORS;
  return LIGHT_COLORS;
}

function assembleThemeContextValue(colorMode, isLoaded, setColorMode) {
  return {
    mode: colorMode,
    colors: paletteForColorMode(colorMode),
    loaded: isLoaded,
    toggle: () => {
      setColorMode((currentMode) => {
        const nextMode = oppositeColorMode(currentMode);
        persistColorModeToDisk(nextMode);
        return nextMode;
      });
    },
    setMode: (requestedMode) => {
      if (!storedValueIsKnownMode(requestedMode)) return;
      setColorMode(requestedMode);
      persistColorModeToDisk(requestedMode);
    },
  };
}
