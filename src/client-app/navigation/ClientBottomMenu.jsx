// Floating bottom tab bar for client STACK screens (Profile, Settings, …).
// Flow: watch the keyboard → hide while typing → otherwise pin BottomMenuBar to the bottom.
// Why it exists: those screens live outside MainTabs, so they'd lose tab navigation entirely.
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import BottomMenuBar from '../../navigation/BottomMenuBar';

export default function ClientBottomMenu({ shell, activeTabKey }) {
  // Tracks whether the on-screen keyboard is up, so we can get the nav bar out of the way.
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Subscribe to keyboard show/hide once on mount. Empty dependency array = run this setup a
  // single time; the returned function runs on unmount to remove the listeners (no leaks).
  // vocab: useEffect = React hook that runs after render, and runs its return value on cleanup
  useEffect(() => {
    // iOS fires "will" events BEFORE the keyboard animates, Android only has "did" (after).
    // Using "will" on iOS makes the nav bar disappear in sync with the keyboard sliding up
    // instead of visibly jumping a beat late.
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Two reasons to render nothing: the shell hasn't handed us nav props yet (still booting, so
  // tapping a tab would do nothing), or the keyboard is covering the bottom of the screen.
  // vocab: ?. = optional chaining — only read .navProviderProps if `shell` exists
  if (!shell?.navProviderProps || keyboardVisible) return null;

  return (
    // Absolute + bottom: 0 lifts the bar out of normal layout flow and pins it to the screen
    // edge, so the screen's own scroll content passes underneath it.
    // Manipulate here: zIndex 200 decides stacking — raise it if a modal/sheet covers the bar,
    // lower it if the bar is floating on top of something that should win.
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 200 }}>
      {/* Spread passes the shell's nav wiring (tab list, onPress handlers) straight through.
          activeTabKey decides which tab looks selected: the explicit prop wins, then the
          shell's own idea, then 'home'.
          vocab/symbol: ?? = use the right side only when the left is null/undefined
          Manipulate here: 'home' is the last-resort highlight if nothing else is known. */}
      <BottomMenuBar
        {...shell.navProviderProps}
        activeTabKey={activeTabKey ?? shell.mainTabActiveKey ?? 'home'}
      />
    </View>
  );
}
