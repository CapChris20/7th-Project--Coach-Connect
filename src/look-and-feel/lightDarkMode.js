// App-wide light, dark, or system theme — colors and tokens through React context.
// Flow: load saved mode → mirror phone when system → expose palette via useTheme().
// Used by almost every screen; wrap the tree once in ThemeProvider.
// Read order: constants → ThemeProvider / useTheme → PLUMBING helpers.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  lightColors,
  darkColors,
  typography,
  spacing,
  borderRadius,
  fontSize,
  fontWeight,
  shadows,
} from './colorPalette';

// ===== NAMED CONSTANTS =====

// vocab: AsyncStorage = phone key/value store that survives app restarts
const THEME_STORAGE_KEY = '@coachconnect_theme_mode';
const LEGACY_THEME_STORAGE_KEY = 'themeMode';
const SYSTEM_MODE = 'system';
const DARK_MODE = 'dark';
const LIGHT_MODE = 'light';
// Manipulate here: first-run default before any saved preference (owner: prioritize light)
const DEFAULT_THEME_MODE = LIGHT_MODE;

// vocab: createContext = React bag shared down the tree without prop drilling
const appThemeContext = createContext();

// ===== HELPER FUNCTIONS =====
// (storage + system-scheme helpers live under PLUMBING)

// ===== MAIN FUNCTION =====

/**
 * Owns theme mode state and feeds colors/tokens to every useTheme() caller.
 * Hook order frozen: system scheme → saved mode → dark flag → load effect → sync effect.
 * @param {{ children: React.ReactNode }} props
 */
export function ThemeProvider({ children }) {
  // vocab: useColorScheme = phone light/dark preference from React Native
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(DEFAULT_THEME_MODE);
  const [isDark, setIsDark] = useState(false);

  // 1. Hydrate saved preference once on mount (primary key, then legacy).
  useEffect(() => {
    loadSavedThemeModeIntoState(setThemeMode);
  }, []);

  // 2. Recompute dark palette when mode or phone scheme changes.
  useEffect(() => {
    const phoneWantsDarkNow = resolveIsDarkForMode(themeMode, systemColorScheme);
    setIsDark(phoneWantsDarkNow);
  }, [themeMode, systemColorScheme]);

  // 3. Persist the user's next choice (light / dark / system).
  const toggleTheme = (nextMode) => saveThemeModeChoice(nextMode, setThemeMode);

  // 4. Pack the active palette + tokens for context consumers.
  const themeBagForTree = buildThemeContextValue(isDark, themeMode, toggleTheme);

  return (
    <appThemeContext.Provider value={themeBagForTree}>
      {children}
    </appThemeContext.Provider>
  );
}

/**
 * Read the active theme bag. Must sit under ThemeProvider.
 * @returns {object}
 */
export function useTheme() {
  // vocab: useContext = pull the nearest matching Provider value
  const themeBag = useContext(appThemeContext);
  if (!themeBag) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return themeBag;
}

// ===== PLUMBING — skip unless debugging =====

// Pull AsyncStorage once on mount. Failed read leaves DEFAULT_THEME_MODE in place.
async function loadSavedThemeModeIntoState(setThemeMode) {
  try {
    // Prefer ThemeProvider key; fall back to legacy onboarding key once.
    const savedFromPrimary = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    const savedFromLegacy = await AsyncStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    // vocab/symbol: || = first truthy; empty string is falsy so legacy can win
    const savedTheme = savedFromPrimary || savedFromLegacy;

    const modeIsKnown =
      savedTheme === LIGHT_MODE ||
      savedTheme === DARK_MODE ||
      savedTheme === SYSTEM_MODE;
    if (!modeIsKnown) {
      return;
    }

    setThemeMode(savedTheme);

    // Migrate legacy value into the primary key when they differ.
    const needsPrimaryMigrate = savedTheme !== savedFromPrimary;
    if (needsPrimaryMigrate) {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, savedTheme);
    }
  } catch (loadError) {
    console.error('Error loading theme preference:', loadError);
  }
}

function resolveIsDarkForMode(themeMode, systemColorScheme) {
  if (themeMode === SYSTEM_MODE) {
    const phonePrefersDark = systemColorScheme === DARK_MODE;
    return phonePrefersDark;
  }
  return themeMode === DARK_MODE;
}

function buildThemeContextValue(isDark, themeMode, toggleTheme) {
  const activeColors = isDark ? darkColors : lightColors;
  return {
    colors: activeColors,
    typography,
    spacing,
    borderRadius,
    fontSize,
    fontWeight,
    shadows,
    isDark,
    themeMode,
    toggleTheme,
  };
}

async function saveThemeModeChoice(mode, setThemeMode) {
  try {
    setThemeMode(mode);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch (saveError) {
    console.error('Error saving theme preference:', saveError);
  }
}
