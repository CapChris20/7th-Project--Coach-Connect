// Floating bottom tab bar for client stack screens that sit on top of MainTabs.
// Flow: subscribe to keyboard → hide while typing → pin BottomMenuBar to the bottom edge.
// Used by clientExtraScreens wrappers so pushed cards keep the same tab bar as the root tabs.

import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import BottomMenuBar from '../../navigation/BottomMenuBar';

// ===== NAMED CONSTANTS =====

const IOS_PLATFORM = 'ios';
const IOS_KEYBOARD_WILL_SHOW = 'keyboardWillShow';
const IOS_KEYBOARD_WILL_HIDE = 'keyboardWillHide';
const ANDROID_KEYBOARD_DID_SHOW = 'keyboardDidShow';
const ANDROID_KEYBOARD_DID_HIDE = 'keyboardDidHide';

// Manipulate here: fallback highlight when neither prop nor shell says which tab is active.
const FALLBACK_HIGHLIGHTED_TAB = 'home';

// Manipulate here: raise if a sheet or modal paints over the bar.
const MENU_BAR_Z_INDEX = 200;

// ===== HELPER FUNCTIONS =====

/**
 * iOS fires "will" events (before animation); Android fires "did" (after).
 * Pick the pair that matches this OS so the bar hides in sync with the keyboard.
 */
function keyboardShowAndHideEventNames() {
  const runningOnIos = Platform.OS === IOS_PLATFORM;
  if (runningOnIos) {
    return {
      showEventName: IOS_KEYBOARD_WILL_SHOW,
      hideEventName: IOS_KEYBOARD_WILL_HIDE,
    };
  }

  return {
    showEventName: ANDROID_KEYBOARD_DID_SHOW,
    hideEventName: ANDROID_KEYBOARD_DID_HIDE,
  };
}

/**
 * Subscribe once; return cleanup that removes both listeners.
 * vocab: Keyboard.addListener = RN keyboard event; .remove() stops it
 */
function startWatchingKeyboard(setKeyboardIsOpen) {
  const eventNames = keyboardShowAndHideEventNames();
  const showEventName = eventNames.showEventName;
  const hideEventName = eventNames.hideEventName;

  const showListener = Keyboard.addListener(showEventName, function markKeyboardOpen() {
    setKeyboardIsOpen(true);
  });
  const hideListener = Keyboard.addListener(hideEventName, function markKeyboardClosed() {
    setKeyboardIsOpen(false);
  });

  return function stopWatchingKeyboard() {
    showListener.remove();
    hideListener.remove();
  };
}

/**
 * Hide when shell is not ready yet (no nav props) or the keyboard covers the bottom.
 * vocab: shell = client app context from ClientOpenScreenTracker (navProviderProps, mainTabActiveKey, …)
 */
function bottomMenuShouldStayHidden(shell, keyboardIsOpen) {
  if (!shell) return true;
  if (!shell.navProviderProps) return true;
  if (keyboardIsOpen) return true;
  return false;
}

/**
 * Prefer the explicit activeTabKey from the wrapper; else shell's main tab; else home.
 */
function pickHighlightedTabKey(activeTabKey, shell) {
  if (activeTabKey != null) {
    return activeTabKey;
  }

  if (shell.mainTabActiveKey != null) {
    return shell.mainTabActiveKey;
  }

  return FALLBACK_HIGHLIGHTED_TAB;
}

const pinnedMenuBarStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: MENU_BAR_Z_INDEX,
};

/**
 * Absolute pin so the bar sits above stack content at the physical bottom.
 * Spread navProviderProps so tab presses use the same handlers as MainTabs.
 */
function PinnedClientMenuBar({ shell, highlightedTabKey }) {
  const navProviderProps = shell.navProviderProps;

  return (
    <View style={pinnedMenuBarStyle}>
      <BottomMenuBar {...navProviderProps} activeTabKey={highlightedTabKey} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client stack floating tab bar.
 * Flow: 1. watch keyboard  2. hide if needed  3. highlight tab  4. paint bar
 * @param {object} props
 * @param {object} props.shell
 * @param {string} [props.activeTabKey]
 */
export default function ClientBottomMenu({ shell, activeTabKey }) {
  const [keyboardIsOpen, setKeyboardIsOpen] = useState(false);

  // 1. Subscribe once on mount; remove listeners on unmount.
  // vocab: empty deps [] = run after first paint only
  useEffect(() => {
    return startWatchingKeyboard(setKeyboardIsOpen);
  }, []);

  // 2. Fail closed — no bar until shell is ready or while keyboard is up.
  const shouldHideMenu = bottomMenuShouldStayHidden(shell, keyboardIsOpen);
  if (shouldHideMenu) {
    return null;
  }

  // 3. Match the highlight MainTabs would show for this destination.
  const highlightedTabKey = pickHighlightedTabKey(activeTabKey, shell);

  // 4. Pin BottomMenuBar above the pushed screen content.
  return <PinnedClientMenuBar shell={shell} highlightedTabKey={highlightedTabKey} />;
}
