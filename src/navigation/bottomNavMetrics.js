// Shared measurements + helpers for laying out screens around the floating bottom nav bar.
// Flow: nav bar height + the phone's safe-area inset → padding numbers screens use so content never hides behind chrome.
// Used by client/trainer shells and any long-scroll screen that sits under the bottom nav.
// Key exports: BOTTOM_NAV_BAR_HEIGHT, SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor, useShellBottomNavInset,
//              SCROLL_EVENT_THROTTLE, FORM_SCROLL_PROPS, useModalScrollBottomPad, useEmbeddedScrollBottomPad

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// How tall the nav bar draws itself, ignoring the home-indicator strip underneath it.
// Manipulate here: if BottomNavBar's visual height changes, update this number or every screen's
// bottom padding will be wrong (content tucked under the bar, or a floating gap above it).
export const BOTTOM_NAV_BAR_HEIGHT = 80;

// vocab: safe area = the part of the screen not covered by the notch, status bar, or home indicator.
// vocab: edges = which sides SafeAreaView is allowed to pad.
// We list only left/right because the header handles top padding and the nav bar handles bottom padding
// themselves — letting the shell pad those edges too would double up and push content down twice.
export const SHELL_SAFE_AREA_EDGES = ['left', 'right'];

// Wrapper that pins whatever you put in it to the physical bottom of the screen, floating over content.
export function ShellBottomNavAnchor({ children }) {
  // Render nothing at all (not an empty box) when there's no nav to show, so the absolute layer
  // doesn't sit invisibly on top of the screen swallowing taps.
  if (!children) return null;
  return (
    <View style={{
      // position 'absolute' + left/right/bottom 0 = stretch across the bottom, out of the normal
      // layout flow, which is why screens must reserve space via useShellBottomNavInset below.
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      // Manipulate here: zIndex is the stacking order — raise it if a new overlay ever covers the nav,
      // lower it if the nav starts drawing on top of a modal that should win.
      zIndex: 200,
    }}>
      {children}
    </View>
  );
}

// How much empty space a screen should leave at the bottom so its last row clears the floating nav.
// Because the nav is absolutely positioned it takes up no layout space — this hook is what gives it some.
export function useShellBottomNavInset(extra = 12) {
  // vocab: useSafeAreaInsets = hook returning this device's uncovered margins; insets.bottom is the
  // home-indicator strip (a real number on modern iPhones, 0 on most Androids).
  const insets = useSafeAreaInsets();
  // Manipulate here: `extra` is the breathing room between content and the nav — raise for a looser feel.
  return BOTTOM_NAV_BAR_HEIGHT + insets.bottom + extra;
}

// How often (in ms) a ScrollView reports its position while dragging.
// Manipulate here: 16ms ≈ 60fps — raise it to fire fewer scroll events (cheaper, but scroll-linked
// animations get choppy); lower it and you just pay more work for no visible gain.
export const SCROLL_EVENT_THROTTLE = 16;

// One prop bundle every form/long-content ScrollView spreads, so keyboard behavior is identical app-wide.
export const FORM_SCROLL_PROPS = {
  scrollEventThrottle: SCROLL_EVENT_THROTTLE,
  // 'on-drag' = dragging the list dismisses the keyboard, which is what users expect when they
  // scroll away from a field they were typing in.
  keyboardDismissMode: 'on-drag',
  // 'handled' is the important one: with the keyboard open, the first tap on a button still fires
  // instead of being eaten as a "dismiss the keyboard" tap. Manipulate here: 'never' would force
  // users to tap twice; 'always' keeps the keyboard up even when tapping elsewhere.
  keyboardShouldPersistTaps: 'handled',
  showsVerticalScrollIndicator: false,
};

// Bottom padding for modals/sheets, which float above the nav and so don't reserve nav height.
export function useModalScrollBottomPad(extra = 32) {
  const insets = useSafeAreaInsets();
  // Math.max(insets.bottom, 16) sets a floor: devices with no home indicator report 0, and content
  // flush against the screen edge looks broken — so we guarantee at least 16px.
  // Manipulate here: 16 is that minimum gutter; `extra` is the comfort padding on top of it.
  return Math.max(insets.bottom, 16) + extra;
}

// Same idea for panels embedded inside a tab that draws no nav chrome of its own — smaller default
// `extra` because there's no floating bar to clear, just the device edge.
export function useEmbeddedScrollBottomPad(extra = 24) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 16) + extra;
}
