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
 * Exact IconScout loading-bar motion (recolored preview frames, pink → orange).
 */

import React from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingPrismFlip from './LoadingPrismFlip';

export default function AppLoadingScreen({ isDark = true }) {
  return (
    <SafeAreaView style={[styles.container, isDark ? styles.dark : styles.light]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.content}>
        <LoadingPrismFlip isDark={isDark} width={300} />
      </View>
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
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
