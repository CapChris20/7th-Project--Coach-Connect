// Measurements so scroll content clears the floating bottom menu.
// Flow: read bar height + phone home-indicator inset → hand padding to shells and long screens.
// Used by client/trainer shells and any scroll view that sits under BottomMenuBar.

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== NAMED CONSTANTS =====

// Manipulate here: must match BottomMenuBar BAR_VISUAL_HEIGHT or content will tuck under the bar.
const BOTTOM_NAV_BAR_HEIGHT = 90;

// Shell SafeAreaView only owns left/right — top/bottom padding is computed below.
const SHELL_SAFE_AREA_EDGES = ['left', 'right'];

// Manipulate here: breathing room under the last list item above the floating bar.
const DEFAULT_CONTENT_GAP = 12;
const DEFAULT_MODAL_EXTRA = 32;
const DEFAULT_EMBEDDED_EXTRA = 24;

// Devices that report 0 bottom inset still need a gutter so content is not flush with the glass edge.
const MIN_EDGE_GUTTER = 16;

const SCROLL_EVENT_THROTTLE = 16;
const NAV_STACK_ORDER = 200;

// Shared FlatList / ScrollView props for forms that sit above the keyboard.
const FORM_SCROLL_PROPS = {
  scrollEventThrottle: SCROLL_EVENT_THROTTLE,
  keyboardDismissMode: 'on-drag',
  keyboardShouldPersistTaps: 'handled',
  showsVerticalScrollIndicator: false,
};

// ===== HELPER FUNCTIONS =====

/**
 * Bottom padding for a scroll view that is not behind the floating menu bar.
 * Adds a minimum gutter when the phone reports no home-indicator inset.
 * @param {number} bottomInset
 * @param {number} extraGap
 * @returns {number}
 */
function paddingAboveHomeIndicator(bottomInset, extraGap) {
  const safeBottomInset = Math.max(bottomInset, MIN_EDGE_GUTTER);
  const totalPadding = safeBottomInset + extraGap;
  return totalPadding;
}

/**
 * Bottom padding for a full-screen shell that draws the absolute bottom menu.
 * Bar height + home indicator + breathing room.
 * @param {number} bottomInset
 * @param {number} extraGap
 * @returns {number}
 */
function paddingAboveFloatingMenuBar(bottomInset, extraGap) {
  const totalPadding = BOTTOM_NAV_BAR_HEIGHT + bottomInset + extraGap;
  return totalPadding;
}

/**
 * Top padding so a tab-root header clears the status bar / notch.
 * @param {number} topInset
 * @param {number} extraGap
 * @returns {number}
 */
function paddingBelowStatusBar(topInset, extraGap) {
  const statusBarInset = Math.max(topInset, 0);
  const totalPadding = statusBarInset + extraGap;
  return totalPadding;
}

/**
 * Absolute pin styles for the bottom menu so it floats above scroll content.
 * @returns {object}
 */
function floatingMenuAnchorStyle() {
  return {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: NAV_STACK_ORDER,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Pins the bottom menu to the bottom of the shell above scroll content.
 * @param {{ children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement|null}
 */
export function ShellBottomNavAnchor({ children }) {
  // 1. An empty anchor would cover the screen and steal taps — render nothing.
  if (!children) {
    return null;
  }

  // 2. Pin the real bar; z-index keeps it above scroll content.
  const anchorStyle = floatingMenuAnchorStyle();
  return <View style={anchorStyle}>{children}</View>;
}

/**
 * Extra bottom inset for a full screen under the floating menu bar.
 * vocab: useSafeAreaInsets().bottom = home-indicator strip height in points.
 * @param {number} [extraGap]
 * @returns {number}
 */
export function useShellBottomNavInset(extraGap = DEFAULT_CONTENT_GAP) {
  // 1. Read the phone's home-indicator height.
  const insets = useSafeAreaInsets();

  // 2. Menu is position:absolute, so screens add bar + inset + gap themselves.
  return paddingAboveFloatingMenuBar(insets.bottom, extraGap);
}

/**
 * Bottom pad for a modal scroll view (no floating menu — only home indicator).
 * @param {number} [extraGap]
 * @returns {number}
 */
export function useModalScrollBottomPad(extraGap = DEFAULT_MODAL_EXTRA) {
  // 1. Read inset.
  const insets = useSafeAreaInsets();

  // 2. Pad above the home indicator with modal breathing room.
  return paddingAboveHomeIndicator(insets.bottom, extraGap);
}

/**
 * Bottom pad for an embedded scroll view inside a shell that already owns the menu.
 * @param {number} [extraGap]
 * @returns {number}
 */
export function useEmbeddedScrollBottomPad(extraGap = DEFAULT_EMBEDDED_EXTRA) {
  // 1. Read inset.
  const insets = useSafeAreaInsets();

  // 2. Pad above the home indicator with embedded breathing room.
  return paddingAboveHomeIndicator(insets.bottom, extraGap);
}

/**
 * Top pad for a tab-root header. Prefer this (or NbPageHeader) over spacing.sm alone.
 * @param {number} [extraGap]
 * @returns {number}
 */
export function useShellTopPad(extraGap = 8) {
  // 1. Read the status-bar / notch inset.
  const insets = useSafeAreaInsets();

  // 2. Status bar height plus a small gap under it.
  // Manipulate here: default extraGap 8 — raise if the header feels tight under the notch.
  return paddingBelowStatusBar(insets.top, extraGap);
}

export {
  BOTTOM_NAV_BAR_HEIGHT,
  SHELL_SAFE_AREA_EDGES,
  SCROLL_EVENT_THROTTLE,
  FORM_SCROLL_PROPS,
};
