import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS, STORAGE_KEY } from './tokens';

const WeeklyReportThemeContext = createContext(null);

export function WeeklyReportThemeProvider({ children, initialMode = 'dark' }) {
  const [mode, setMode] = useState(initialMode === 'light' ? 'light' : 'dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (mounted && (value === 'dark' || value === 'light')) {
        setMode(value);
      }
      if (mounted) setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(() => {
    const colors = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
    return {
      mode,
      colors,
      loaded,
      toggle: () => {
        setMode((prev) => {
          const next = prev === 'dark' ? 'light' : 'dark';
          AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
          return next;
        });
      },
      setMode: (next) => {
        if (next !== 'dark' && next !== 'light') return;
        setMode(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      },
    };
  }, [mode, loaded]);

  return (
    <WeeklyReportThemeContext.Provider value={value}>{children}</WeeklyReportThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(WeeklyReportThemeContext);
  if (!ctx) throw new Error('useTheme must be used within WeeklyReportThemeProvider');
  return ctx;
}

export { GRADIENTS } from './tokens';
