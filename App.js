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
