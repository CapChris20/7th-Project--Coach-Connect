import React, { useEffect } from 'react';
import { ThemeProvider } from './src/shared/ui/ThemeContext';
import AuthGate from './src/app/AuthGate';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from './src/shared/services/notificationsService';
import { AIProvider } from './src/contexts/AIContext';

export default function App() {
  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
    // Surface otherwise-silent runtime errors in Metro with a stack trace.
    // This helps quickly pinpoint crashes like: "Cannot read property 'map' of undefined".
    const prevHandler = global?.ErrorUtils?.getGlobalHandler?.();
    if (global?.ErrorUtils?.setGlobalHandler) {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        try {
          console.error('🌋 Global error handler:', {
            name: error?.name,
            message: error?.message,
            isFatal,
            stack: error?.stack,
          });
        } catch (_) {
          // ignore
        }
        if (typeof prevHandler === 'function') prevHandler(error, isFatal);
      });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AIProvider>
          <AuthGate />
        </AIProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
