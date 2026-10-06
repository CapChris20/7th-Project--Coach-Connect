// Full-screen loading state shared by the client and trainer apps.
// Flow: pick the dark or light shell → set the status-bar text so it stays readable → show the loading bar.
// Used wherever the app is waiting on startup before a real screen can render.

import React from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingBarAnimation from './LoadingBarAnimation';

// ===== NAMED CONSTANTS =====

const STATUS_BAR_LIGHT_CONTENT = 'light-content';
const STATUS_BAR_DARK_CONTENT = 'dark-content';
// Manipulate here: width of the loading-bar animation in points.
const LOADING_BAR_WIDTH = 300;

// ===== HELPER FUNCTIONS =====

/**
 * Light status-bar text sits on the dark shell. Dark text sits on the white shell.
 * @param {boolean} isDark
 * @returns {string}
 */
function statusBarStyleForTheme(isDark) {
  if (isDark) return STATUS_BAR_LIGHT_CONTENT;
  return STATUS_BAR_DARK_CONTENT;
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen loading shell with the shared loading-bar animation.
 * @param {object} [props]
 * @param {boolean} [props.isDark]
 * @returns {JSX.Element}
 */
export default function AppLoadingScreen({ isDark = true }) {
  return (
    // vocab: SafeAreaView = pads inside the notch and home indicator so the spinner is not clipped.
    <SafeAreaView style={[styles.container, isDark ? styles.dark : styles.light]}>
      <StatusBar barStyle={statusBarStyleForTheme(isDark)} />
      <View style={styles.content}>
        <LoadingBarAnimation isDark={isDark} width={LOADING_BAR_WIDTH} />
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
