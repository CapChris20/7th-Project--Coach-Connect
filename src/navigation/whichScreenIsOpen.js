// Central place the app shells hand their navigation handlers to shared chrome (header + bottom nav).
// Flow: ClientAppStart/TrainerAppStart wrap their tree in AppNavigationProvider → TopHeader and BottomMenuBar
//       read the handlers out of context → props passed directly to those components still win.
// Exists so the shared chrome doesn't need a dozen callback props threaded down through every screen.
// Key exports: AppNavigationProvider, useAppNavigation, useMergedNavigation

import React, { createContext, useContext, useCallback, useRef, useState } from 'react';

// vocab: createContext = React's "invisible pipe" — a provider puts a value in at the top of the tree
// and any component below reads it without props being passed hand-to-hand.
// Default is null (not {}) so consumers can tell "no provider above me" from "provider with empty handlers".
const whichScreenIsOpen = createContext(null);

// Do-nothing fallback so a missing handler is a silent no-op instead of "undefined is not a function"
// the moment someone taps a nav icon the current shell doesn't implement.
const noop = () => {};

// Wraps the app and publishes every nav handler the chrome might call.
// `...handlers` collects all remaining props, so a shell just spreads the callbacks it supports.
export function AppNavigationProvider({ children, ...handlers }) {
  // Each slot is one icon/action in the shared chrome. Normalizing to noop here (rather than at
  // every call site) means the header and nav bar can call any of these unconditionally.
  // vocab/symbol: ?? = use the right side only when the left is null/undefined.
  // Manipulate here: adding a new chrome button means adding its handler key in this list AND in
  // useMergedNavigation below, or the button will silently do nothing.
  const value = {
    onProfilePress: handlers.onProfilePress ?? noop,
    onSettingsPress: handlers.onSettingsPress ?? noop,
    onHomePress: handlers.onHomePress ?? noop,
    onPlusPress: handlers.onPlusPress ?? noop,
    onVoicePress: handlers.onVoicePress ?? noop,
    onNutritionPress: handlers.onNutritionPress ?? noop,
    onWorkoutPress: handlers.onWorkoutPress ?? noop,
    onMessagesPress: handlers.onMessagesPress ?? noop,
  };

  return (
    <whichScreenIsOpen.Provider value={value}>
      {children}
    </whichScreenIsOpen.Provider>
  );
}

// Raw read of the context. Returns null when there's no provider above — callers must handle that,
// which is exactly why most components use useMergedNavigation instead.
export function useAppNavigation() {
  return useContext(whichScreenIsOpen);
}

// The handler resolver the shared chrome actually uses.
// Precedence, left to right: an explicitly passed prop wins → then whatever the shell published in
// context → then noop. That order is what lets one screen override a single nav button (say, a custom
// back-to-list behavior) without disturbing the rest of the app's navigation.
export function useMergedNavigation(props = {}) {
  const context = useAppNavigation();
  return {
    // vocab/symbol: context?.onProfilePress = optional chaining; reads the field only if context
    // exists, so this hook still works in screens rendered outside any provider (previews, tests).
    onProfilePress: props.onProfilePress ?? context?.onProfilePress ?? noop,
    onSettingsPress: props.onSettingsPress ?? context?.onSettingsPress ?? noop,
    onHomePress: props.onHomePress ?? context?.onHomePress ?? noop,
    onPlusPress: props.onPlusPress ?? context?.onPlusPress ?? noop,
    onVoicePress: props.onVoicePress ?? context?.onVoicePress ?? noop,
    onNutritionPress: props.onNutritionPress ?? context?.onNutritionPress ?? noop,
    onWorkoutPress: props.onWorkoutPress ?? context?.onWorkoutPress ?? noop,
    onMessagesPress: props.onMessagesPress ?? context?.onMessagesPress ?? noop,
  };
}
