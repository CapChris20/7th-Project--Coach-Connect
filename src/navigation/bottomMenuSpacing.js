// Measurements so screens clear the floating bottom menu.
// Flow: bar height plus the phone's home-indicator inset → padding the scroll views use.
// Used by the client and trainer shells and any long screen under the bottom menu.

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ===== NAMED CONSTANTS =====

// Manipulate here: this has to match the drawn height of the bottom menu.
const BOTTOM_NAV_BAR_HEIGHT = 80;
const SHELL_SAFE_AREA_EDGES = ['left', 'right'];
const DEFAULT_CONTENT_GAP = 12;
const DEFAULT_MODAL_EXTRA = 32;
const DEFAULT_EMBEDDED_EXTRA = 24;
const MIN_EDGE_GUTTER = 16;
const SCROLL_EVENT_THROTTLE = 16;
const NAV_STACK_ORDER = 200;

const FORM_SCROLL_PROPS = {
  scrollEventThrottle: SCROLL_EVENT_THROTTLE,
  keyboardDismissMode: 'on-drag',
  keyboardShouldPersistTaps: 'handled',
  showsVerticalScrollIndicator: false,
};

// ===== HELPER FUNCTIONS =====

/**
 * Devices with no home indicator report 0. Content still needs a gutter so it does not sit on the glass edge.
 * @param {number} bottomInset
 * @param {number} extra
 * @returns {number}
 */
function paddingAboveDeviceEdge(bottomInset, extra) {
  return Math.max(bottomInset, MIN_EDGE_GUTTER) + extra;
}

// ===== MAIN FUNCTION =====

/**
 * An empty anchor would sit on top of the screen and swallow taps, so missing children render nothing.
 * @param {{ children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement|null}
 */
export function ShellBottomNavAnchor({ children }) {
  if (!children) return null;
  return (
    <View style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: NAV_STACK_ORDER,
    }}>
      {children}
    </View>
  );
}

/**
 * The menu is taken out of layout, so screens add this much empty space at the bottom.
 * vocab: useSafeAreaInsets().bottom is the home-indicator strip.
 * @param {number} [extra]
 * @returns {number}
 */
export function useShellBottomNavInset(extra = DEFAULT_CONTENT_GAP) {
  const insets = useSafeAreaInsets();
  return BOTTOM_NAV_BAR_HEIGHT + insets.bottom + extra;
}

/**
 * Sheets float above the menu, so they only clear the device edge.
 * @param {number} [extra]
 * @returns {number}
 */
export function useModalScrollBottomPad(extra = DEFAULT_MODAL_EXTRA) {
  const insets = useSafeAreaInsets();
  return paddingAboveDeviceEdge(insets.bottom, extra);
}

/**
 * Panels inside a tab that draws no menu of its own.
 * @param {number} [extra]
 * @returns {number}
 */
export function useEmbeddedScrollBottomPad(extra = DEFAULT_EMBEDDED_EXTRA) {
  const insets = useSafeAreaInsets();
  return paddingAboveDeviceEdge(insets.bottom, extra);
}

export {
  BOTTOM_NAV_BAR_HEIGHT,
  SHELL_SAFE_AREA_EDGES,
  SCROLL_EVENT_THROTTLE,
  FORM_SCROLL_PROPS,
};
