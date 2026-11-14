// Full-screen loading state shared by the client and trainer apps.
// Flow: theme → status bar readable on that shell → centered prism loading bar.
// Used wherever startup waits before a real screen can render.

import React from 'react';
import { StyleSheet, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LoadingBarAnimation from './LoadingBarAnimation';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const STATUS_BAR_LIGHT_CONTENT = 'light-content';
const STATUS_BAR_DARK_CONTENT = 'dark-content';
// Manipulate here: width of the loading-bar animation in points.
const LOADING_BAR_WIDTH = 300;

// ===== HELPER FUNCTIONS =====

// Light status-bar glyphs on a dark shell; dark glyphs on a white shell.
function statusBarStyleForDarkShell(isDarkShell) {
  if (isDarkShell) {
    return STATUS_BAR_LIGHT_CONTENT;
  }
  return STATUS_BAR_DARK_CONTENT;
}

function shellBackgroundStyleForDarkShell(isDarkShell) {
  if (isDarkShell) {
    return styles.dark;
  }
  return styles.light;
}

function themePresentationForShell(isDarkShell) {
  return {
    statusBarStyle: statusBarStyleForDarkShell(isDarkShell),
    shellBackgroundStyle: shellBackgroundStyleForDarkShell(isDarkShell),
  };
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen loading shell with the shared prism loading-bar animation.
 * @param {{ isDark?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function AppLoadingScreen({ isDark = true }) {
  // 1. Pick status-bar text color + shell fill so the bar stays readable.
  const themePresentation = themePresentationForShell(isDark);
  const statusBarStyle = themePresentation.statusBarStyle;
  const shellBackgroundStyle = themePresentation.shellBackgroundStyle;

  // 2. Safe-area shell, then center the shared loading bar at LOADING_BAR_WIDTH.
  // vocab: SafeAreaView = inset padding for notch and home indicator.
  // vocab: StatusBar barStyle = iOS glyph color ("light-content" = white icons).
  return (
    <SafeAreaView style={[styles.container, shellBackgroundStyle]}>
      <StatusBar barStyle={statusBarStyle} />
      <View style={styles.content}>
        <LoadingBarAnimation isDark={isDark} width={LOADING_BAR_WIDTH} />
      </View>
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Manipulate here: dark shell fill (near-black, not a theme token — matches Design Law boot).
  dark: {
    backgroundColor: '#0A0A0A',
  },
  light: {
    backgroundColor: lightColors.white,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
});
