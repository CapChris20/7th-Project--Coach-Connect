// Floating bottom tab bar for client screens pushed on top of the main tabs.
// Flow: watch the keyboard → hide while typing or before nav props exist → otherwise pin the bar to the bottom.
// Used by stack screens that would otherwise lose the tab bar.

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
// Manipulate here: raise this if a sheet covers the bar.
const MENU_Z_INDEX = 200;

// ===== HELPER FUNCTIONS =====

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

function subscribeToKeyboardVisibility(setIsKeyboardVisible) {
  const { showEventName, hideEventName } = keyboardEventNames();
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

function shouldHideBottomMenu(shell, isKeyboardVisible) {
  const hasNavProps = shell && shell.navProviderProps;
  if (!hasNavProps) return true;
  if (isKeyboardVisible) return true;
  return false;
}

function highlightedTabKeyForMenu(activeTabKey, shell) {
  if (activeTabKey != null) return activeTabKey;
  if (shell.mainTabActiveKey != null) return shell.mainTabActiveKey;
  return DEFAULT_TAB_KEY;
}

function ClientBottomMenuBar({ shell, highlightedTabKey }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: MENU_Z_INDEX }}>
      <BottomMenuBar {...shell.navProviderProps} activeTabKey={highlightedTabKey} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

export default function ClientBottomMenu({ shell, activeTabKey }) {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    return subscribeToKeyboardVisibility(setIsKeyboardVisible);
  }, []);

  if (shouldHideBottomMenu(shell, isKeyboardVisible)) return null;

  const highlightedTabKey = highlightedTabKeyForMenu(activeTabKey, shell);
  return <ClientBottomMenuBar shell={shell} highlightedTabKey={highlightedTabKey} />;
}
