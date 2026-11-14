// Hands shared header and bottom-nav buttons the handlers for whichever app shell is open.
// Flow: the shell publishes handlers → chrome reads them → a prop passed on the component still wins.
// Used by ClientAppStart, TrainerAppStart, TopHeader, and BottomMenuBar.
// Key exports: AppNavigationProvider, useAppNavigation, useMergedNavigation.

import React, { createContext, useContext } from 'react';

// ===== NAMED CONSTANTS =====

// vocab: createContext = a pipe from the shell down to header and nav without a prop on every screen.
// null (not {}) lets a reader tell "no provider" apart from a provider that published empty handlers.
const navigationHandlersContext = createContext(null);

// A missing handler is a silent no-op so a tap on an icon this shell does not implement does not throw.
function doNothing() {}

// Every chrome button name the provider normalizes.
// Manipulate here: add a key here AND fill it in the shell that publishes AppNavigationProvider.
const HANDLER_KEYS = [
  'onProfilePress',
  'onSettingsPress',
  'onHomePress',
  'onPlusPress',
  'onVoicePress',
  'onNutritionPress',
  'onWorkoutPress',
  'onMessagesPress',
];

// ===== HELPER FUNCTIONS =====

/**
 * Use the shell handler when present; otherwise doNothing.
 * vocab/symbol: ?? = use the right side only when the left is null or undefined.
 * @param {function|null|undefined} handlerFromShell
 * @returns {function}
 */
function handlerOrDoNothing(handlerFromShell) {
  if (handlerFromShell == null) {
    return doNothing;
  }
  return handlerFromShell;
}

/**
 * Left to right: an explicit prop wins, then the shell's context value, then doNothing.
 * @param {function|null|undefined} explicitHandler
 * @param {function|null|undefined} contextHandler
 * @returns {function}
 */
function pickBestHandler(explicitHandler, contextHandler) {
  if (explicitHandler != null) {
    return explicitHandler;
  }
  if (contextHandler != null) {
    return contextHandler;
  }
  return doNothing;
}

/**
 * Turn raw props from the shell into a full handler map with doNothing for anything omitted.
 * @param {object} handlersFromShell
 * @returns {object}
 */
function fillMissingHandlersWithDoNothing(handlersFromShell) {
  const filledHandlers = {};
  let keyIndex = 0;
  while (keyIndex < HANDLER_KEYS.length) {
    const handlerKey = HANDLER_KEYS[keyIndex];
    filledHandlers[handlerKey] = handlerOrDoNothing(handlersFromShell[handlerKey]);
    keyIndex += 1;
  }
  return filledHandlers;
}

/**
 * Merge props on the chrome component with the shell's published handlers.
 * @param {object} explicitProps
 * @param {object} handlersFromShell
 * @returns {object}
 */
function mergePropsOverShellHandlers(explicitProps, handlersFromShell) {
  const mergedHandlers = {};
  let keyIndex = 0;
  while (keyIndex < HANDLER_KEYS.length) {
    const handlerKey = HANDLER_KEYS[keyIndex];
    mergedHandlers[handlerKey] = pickBestHandler(
      explicitProps[handlerKey],
      handlersFromShell[handlerKey],
    );
    keyIndex += 1;
  }
  return mergedHandlers;
}

// ===== MAIN FUNCTION =====

/**
 * Publishes the nav handlers this shell supports. Any handler left out becomes doNothing.
 * @param {{ children?: import('react').ReactNode, onProfilePress?: function, onSettingsPress?: function, onHomePress?: function, onPlusPress?: function, onVoicePress?: function, onNutritionPress?: function, onWorkoutPress?: function, onMessagesPress?: function }} props
 * @returns {import('react').ReactElement}
 */
export function AppNavigationProvider({ children, ...handlersFromShell }) {
  // 1. Normalize every supported handler so chrome never calls undefined.
  const navigationHandlers = fillMissingHandlersWithDoNothing(handlersFromShell);

  // 2. Publish down the tree for TopHeader and BottomMenuBar.
  return (
    <navigationHandlersContext.Provider value={navigationHandlers}>
      {children}
    </navigationHandlersContext.Provider>
  );
}

/**
 * The raw context value, or null when no AppNavigationProvider is above this component.
 * vocab: useContext = read the nearest matching Provider above this component.
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
  // 1. Read whatever the shell published (or nothing).
  const contextValue = useAppNavigation();
  const handlersFromShell = contextValue || {};

  // 2. Let an explicit prop on the chrome component win over the shell.
  return mergePropsOverShellHandlers(props, handlersFromShell);
}
