/**
 * bottom Nav Metrics
 *
 * Purpose: bottom Nav Metrics — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/navigation
 * Key exports: useShellBottomNavInset, BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor
 *
 * @file-header
 */
import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Visual height of BottomNavBar (excludes home-indicator inset). */
export const BOTTOM_NAV_BAR_HEIGHT = 80;

/**
 * Safe-area edges for screens that render CoachConnectHeader + BottomNavBar.
 * Top/bottom insets are owned by those chrome components — not the parent shell.
 */
export const SHELL_SAFE_AREA_EDGES = ['left', 'right'];

/** Pins BottomNavBar to the physical bottom; nav applies home-indicator padding internally. */
export function ShellBottomNavAnchor({ children }) {
  if (!children) return null;
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 200 }}>
      {children}
    </View>
  );
}

/** Space to reserve when a parent shell renders the floating bottom nav (hideBottomNav on child). */
export function useShellBottomNavInset(extra = 12) {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_BAR_HEIGHT + insets.bottom + extra;
}

/** Throttle interval for smooth scroll tracking (~60fps). */
export const SCROLL_EVENT_THROTTLE = 16;

/** Shared ScrollView props for forms and long content screens. */
export const FORM_SCROLL_PROPS = {
  scrollEventThrottle: SCROLL_EVENT_THROTTLE,
  keyboardDismissMode: 'on-drag',
  keyboardShouldPersistTaps: 'handled',
  showsVerticalScrollIndicator: false,
};

/** Bottom padding for modal/sheet scroll content (no bottom nav). */
export function useModalScrollBottomPad(extra = 32) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 16) + extra;
}

/** Bottom padding for embedded tab panels without bottom nav chrome. */
export function useEmbeddedScrollBottomPad(extra = 24) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 16) + extra;
}
