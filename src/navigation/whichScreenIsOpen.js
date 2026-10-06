// Hands shared header and bottom-nav buttons the handlers for whichever app shell is open.
// Flow: the shell publishes handlers → chrome reads them → a prop passed on the component still wins.
// Used by ClientAppStart, TrainerAppStart, TopHeader, and BottomMenuBar.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

// vocab: createContext = a pipe from the shell down to header and nav without a prop on every screen.
// null (not {}) lets a reader tell "no provider" apart from a provider that published empty handlers.
const navigationHandlersContext = createContext(null);

// A missing handler is a silent no-op so a tap on an icon this shell does not implement does not throw.
const doNothing = () => {};

// ===== HELPER FUNCTIONS =====

// vocab/symbol: ?? = use the right side only when the left is null or undefined.
function publishedHandler(handler) {
  return handler ?? doNothing;
}

// Left to right: an explicit prop wins, then the shell's context value, then doNothing.
function pickHandler(explicitHandler, contextHandler) {
  return explicitHandler ?? contextHandler ?? doNothing;
}

// ===== MAIN FUNCTION =====

/**
 * Publishes the nav handlers this shell supports. Any handler left out becomes doNothing.
 * @param {{ children?: import('react').ReactNode, onProfilePress?: function, onSettingsPress?: function, onHomePress?: function, onPlusPress?: function, onVoicePress?: function, onNutritionPress?: function, onWorkoutPress?: function, onMessagesPress?: function }} props
 * @returns {import('react').ReactElement}
 */
export function AppNavigationProvider({ children, ...handlers }) {
  // Manipulate here: a new chrome button needs its key here and again in useMergedNavigation.
  const navigationHandlers = {
    onProfilePress: publishedHandler(handlers.onProfilePress),
    onSettingsPress: publishedHandler(handlers.onSettingsPress),
    onHomePress: publishedHandler(handlers.onHomePress),
    onPlusPress: publishedHandler(handlers.onPlusPress),
    onVoicePress: publishedHandler(handlers.onVoicePress),
    onNutritionPress: publishedHandler(handlers.onNutritionPress),
    onWorkoutPress: publishedHandler(handlers.onWorkoutPress),
    onMessagesPress: publishedHandler(handlers.onMessagesPress),
  };

  return (
    <navigationHandlersContext.Provider value={navigationHandlers}>
      {children}
    </navigationHandlersContext.Provider>
  );
}

/**
 * The raw context value, or null when no AppNavigationProvider is above this component.
 * @returns {object|null}
 */
export function useAppNavigation() {
  return useContext(navigationHandlersContext);
}

/**
 * Handlers for shared chrome. A prop on the component beats the shell, which beats doNothing.
 * @param {object} [props]
 * @returns {{ onProfilePress: function, onSettingsPress: function, onHomePress: function, onPlusPress: function, onVoicePress: function, onNutritionPress: function, onWorkoutPress: function, onMessagesPress: function }}
 */
export function useMergedNavigation(props = {}) {
  const context = useAppNavigation();
  return {
    // vocab/symbol: context?.onProfilePress reads the field only when a provider exists.
    onProfilePress: pickHandler(props.onProfilePress, context?.onProfilePress),
    onSettingsPress: pickHandler(props.onSettingsPress, context?.onSettingsPress),
    onHomePress: pickHandler(props.onHomePress, context?.onHomePress),
    onPlusPress: pickHandler(props.onPlusPress, context?.onPlusPress),
    onVoicePress: pickHandler(props.onVoicePress, context?.onVoicePress),
    onNutritionPress: pickHandler(props.onNutritionPress, context?.onNutritionPress),
    onWorkoutPress: pickHandler(props.onWorkoutPress, context?.onWorkoutPress),
    onMessagesPress: pickHandler(props.onMessagesPress, context?.onMessagesPress),
  };
}
