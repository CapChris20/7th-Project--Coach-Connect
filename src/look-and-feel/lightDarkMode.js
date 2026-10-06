// The app-wide light, dark, or system theme.
// Flow: read the saved choice → follow the phone when the choice is system → share colors through context.
// Used by screens that call useTheme() for the palette.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, typography, spacing, borderRadius, fontSize, fontWeight, shadows } from './colorPalette';

// ===== NAMED CONSTANTS =====

const THEME_STORAGE_KEY = '@coachconnect_theme_mode';
const SYSTEM_MODE = 'system';
const DARK_MODE = 'dark';
const themeContext = createContext();

// ===== HELPER FUNCTIONS =====

/**
 * A failed read leaves the default in place. The screen still has a theme.
 * @param {Function} setThemeMode
 * @returns {Promise<void>}
 */
async function loadSavedThemeMode(setThemeMode) {
  try {
    const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme) setThemeMode(savedTheme);
  } catch (loadError) {
    console.error('Error loading theme preference:', loadError);
  }
}

/**
 * @param {string} themeMode
 * @param {string|null|undefined} systemColorScheme
 * @returns {boolean}
 */
function isDarkForMode(themeMode, systemColorScheme) {
  if (themeMode === SYSTEM_MODE) return systemColorScheme === DARK_MODE;
  return themeMode === DARK_MODE;
}

// ===== MAIN FUNCTION =====

/**
 * Hooks stay in this order: system scheme, saved mode, dark flag, load effect, sync effect.
 * @param {{ children: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState(SYSTEM_MODE);
  const [isDark, setIsDark] = useState(systemColorScheme === DARK_MODE);

  useEffect(() => {
    loadSavedThemeMode(setThemeMode);
  }, []);

  useEffect(() => {
    setIsDark(isDarkForMode(themeMode, systemColorScheme));
  }, [themeMode, systemColorScheme]);

  const toggleTheme = async (mode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (saveError) {
      console.error('Error saving theme preference:', saveError);
    }
  };

  const colors = isDark ? darkColors : lightColors;
  const theme = {
    colors,
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

  return (
    <themeContext.Provider value={theme}>
      {children}
    </themeContext.Provider>
  );
}

/**
 * @returns {object}
 */
export function useTheme() {
  const theme = useContext(themeContext);
  if (!theme) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return theme;
}
