/**
 * App Loading Screen
 *
 * Purpose: UI screen or component: App Loading Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: AppLoadingScreen
 *
 * @file-header
 */
/**
 * AppLoadingScreen — shared full-screen loading for the entire app (client and trainer).
 * Shows Lottie animation only.
 * Used by AuthGate (while checking auth/onboarding) and ClientApp/TrainerApp (while loading data).
 */

import React from 'react';
import { StyleSheet, SafeAreaView, StatusBar } from 'react-native';
import LottieView from 'lottie-react-native';

const LOTTIE_SOURCE = require('../../../assets/animations/legacy/loading.json');

export default function AppLoadingScreen({ isDark = true }) {
  return (
    <SafeAreaView style={[styles.container, isDark ? styles.dark : styles.light]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <LottieView
        source={LOTTIE_SOURCE}
        autoPlay
        loop
        style={styles.lottie}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dark: {
    backgroundColor: '#0A0A0A',
  },
  light: {
    backgroundColor: '#FFFFFF',
  },
  lottie: {
    width: 400,
    height: 400,
  },
});
