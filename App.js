import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { ThemeProvider } from './src/shared/ui/ThemeContext';
import AuthGate from './src/app/AuthGate';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from './src/shared/notifications/manageNotifications';
import { initMonitoring } from './src/shared/api/monitorAppHealth';
import { AIProvider } from './src/contexts/AIContext';

initMonitoring();

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    configureNotifications();
  }, []);

  useEffect(() => {
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
          /* ignore */
        }
        if (typeof prevHandler === 'function') prevHandler(error, isFatal);
      });
    }
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#050508' }}>
        <ActivityIndicator size="large" color="#F06BA8" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AIProvider>
            <AuthGate />
          </AIProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
