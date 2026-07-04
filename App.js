import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import { CrimsonPro_400Regular, CrimsonPro_600SemiBold, CrimsonPro_700Bold } from '@expo-google-fonts/crimson-pro';
import { ThemeProvider } from './src/shared-ui/ThemeContext';
import AuthGate from './src/app-start/AuthGate';
import { AppStripeProvider } from './src/shared/payments/AppStripeProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { configureNotifications } from './src/notifications/manageNotifications';
import { initMonitoring } from './src/shared/api/monitorAppHealth';
import { AIProvider } from './src/shared/contexts/AIContext';
import { SubscriptionProvider } from './src/subscription/SubscriptionProvider';
import OnboardingSnapshotRunner from './src/auth/OnboardingSnapshotRunner';

initMonitoring();

function useOnboardingSnapshotAutoStart() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!__DEV__ || active) return undefined;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch('http://127.0.0.1:9876/ping', { method: 'GET' });
        if (!cancelled && res.ok) setActive(true);
      } catch {
        /* capture server not running */
      }
    };

    tick();
    const id = setInterval(tick, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return [active, setActive];
}

export default function App() {
  const [snapshotCapture, setSnapshotCapture] = useOnboardingSnapshotAutoStart();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
    CrimsonPro_400Regular,
    CrimsonPro_600SemiBold,
    CrimsonPro_700Bold,
  });

  useEffect(() => {
    try {
      configureNotifications();
    } catch (e) {
      if (__DEV__) console.warn('[notifications] configureNotifications failed:', e?.message || e);
    }
  }, []);

  useEffect(() => {
    const prevHandler = global?.ErrorUtils?.getGlobalHandler?.();
    if (global?.ErrorUtils?.setGlobalHandler) {
      global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        const message = error?.message || (error != null ? String(error) : 'unknown error');
        const name = error?.name || 'Error';
        console.error(`🌋 Global error handler [${name}]: ${message}`);
        if (error?.stack) console.error(error.stack);
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

  if (snapshotCapture && __DEV__) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AIProvider>
              <SubscriptionProvider userId={null}>
                <OnboardingSnapshotRunner onDone={() => setSnapshotCapture(false)} />
              </SubscriptionProvider>
            </AIProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppStripeProvider>
            <AIProvider>
              <AuthGate />
            </AIProvider>
          </AppStripeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
