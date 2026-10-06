// Floating bottom tab bar for client stack screens (Profile, Settings, and the other pushed screens).
// Flow: watch the keyboard → hide while typing or before nav props exist → otherwise pin the bar to the bottom.
// Used by the extra client screens that live outside the main tabs and would otherwise lose tab navigation.

import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import BottomMenuBar from '../../navigation/BottomMenuBar';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';
const IOS_KEYBOARD_SHOW_EVENT = 'keyboardWillShow';
const IOS_KEYBOARD_HIDE_EVENT = 'keyboardWillHide';
const ANDROID_KEYBOARD_SHOW_EVENT = 'keyboardDidShow';
const ANDROID_KEYBOARD_HIDE_EVENT = 'keyboardDidHide';
const DEFAULT_TAB_KEY = 'home';
// Manipulate here: raise this if a sheet covers the bar. Lower it if the bar should sit under something else.
const MENU_Z_INDEX = 200;

// ===== HELPER FUNCTIONS =====

/**
 * iOS fires "will" before the keyboard moves, so the bar leaves in sync with the slide.
 * Android only has "did", which fires after the keyboard is already up.
 * @returns {{ showEventName: string, hideEventName: string }}
 */
function keyboardEventNames() {
  const isIos = Platform.OS === IOS_PLATFORM;
  if (isIos) {
    return {
      showEventName: IOS_KEYBOARD_SHOW_EVENT,
      hideEventName: IOS_KEYBOARD_HIDE_EVENT,
    };
  }
  return {
    showEventName: ANDROID_KEYBOARD_SHOW_EVENT,
    hideEventName: ANDROID_KEYBOARD_HIDE_EVENT,
  };
}

/**
 * Subscribe once. The returned function runs on unmount so the listeners do not leak.
 * @param {Function} setIsKeyboardVisible
 * @returns {Function}
 */
function subscribeToKeyboardVisibility(setIsKeyboardVisible) {
  const { showEventName, hideEventName } = keyboardEventNames();
  // vocab: Keyboard.addListener = subscribe to show or hide. Call remove() on the subscription later.
  const showSubscription = Keyboard.addListener(showEventName, () => {
    setIsKeyboardVisible(true);
  });
  const hideSubscription = Keyboard.addListener(hideEventName, () => {
    setIsKeyboardVisible(false);
  });
  return function removeKeyboardListeners() {
    showSubscription.remove();
    hideSubscription.remove();
  };
}

/**
 * No nav props means a tap would do nothing. The keyboard covers the bottom edge, so the bar hides then too.
 * @param {object|undefined} shell
 * @param {boolean} isKeyboardVisible
 * @returns {boolean}
 */
function shouldHideBottomMenu(shell, isKeyboardVisible) {
  // vocab/symbol: ?. = read navProviderProps only when shell exists.
  const isShellMissingNavigation = !shell?.navProviderProps;
  return isShellMissingNavigation || isKeyboardVisible;
}

/**
 * An explicit prop wins, then the shell's own selected tab, then home.
 * `!= null` treats only null and undefined as missing, so a blank string still wins over the fallback.
 * @param {string|null|undefined} activeTabKey
 * @param {object} shell
 * @returns {string}
 */
function highlightedTabKeyForMenu(activeTabKey, shell) {
  if (activeTabKey != null) return activeTabKey;
  if (shell.mainTabActiveKey != null) return shell.mainTabActiveKey;
  return DEFAULT_TAB_KEY;
}

// ===== MAIN FUNCTION =====

/**
 * Bottom tab bar pinned over a client stack screen.
 * @param {object} props
 * @param {object} [props.shell] Nav wiring from the client shell. Missing props hide the bar.
 * @param {string} [props.activeTabKey] Tab that should look selected.
 * @returns {JSX.Element|null}
 */
export default function ClientBottomMenu({ shell, activeTabKey }) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // vocab: useEffect = run after paint. The returned function runs on unmount.
  // Empty deps: subscribe once. The listeners stay for the life of this screen.
  useEffect(() => {
    return subscribeToKeyboardVisibility(setIsKeyboardVisible);
  }, []);

  if (shouldHideBottomMenu(shell, isKeyboardVisible)) return null;

  const highlightedTabKey = highlightedTabKeyForMenu(activeTabKey, shell);

  return (
    // Absolute plus bottom: 0 pins the bar to the screen edge so scroll content passes underneath.
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: MENU_Z_INDEX }}>
      {/* The spread passes the shell's tab list and press handlers through. highlightedTabKey is last so it wins. */}
      <BottomMenuBar
        {...shell.navProviderProps}
        activeTabKey={highlightedTabKey}
      />
    </View>
  );
}
