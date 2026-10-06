// How far the coach composer and the message list sit above the keyboard and the bottom nav.
// Flow: listen for show and hide → measure the keyboard → pad the composer and leave the list a small gap.
// Used by CoachConversationScreen and CoachHomeScreen. KeyboardAvoidingView double-pads on iOS, so we do this by hand.

import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

// iOS moves the field with the keyboard animation. Android only tells us after the keyboard is up.
const IOS_KEYBOARD_SHOW_EVENT = 'keyboardWillShow';
const OTHER_KEYBOARD_SHOW_EVENT = 'keyboardDidShow';
const IOS_KEYBOARD_HIDE_EVENT = 'keyboardWillHide';
const OTHER_KEYBOARD_HIDE_EVENT = 'keyboardDidHide';

// Manipulate here: these are the breathing gaps, not a second copy of the nav bar height.
const COMPOSER_GAP_WHEN_KEYBOARD_OPEN = 8;
const COMPOSER_GAP_ABOVE_NAV = 10;
const LIST_GAP_WHEN_KEYBOARD_OPEN = 12;
const LIST_GAP_WHEN_KEYBOARD_CLOSED = 20;

// Android's password bar ignores autoComplete: 'off'. This extra flag is what actually blocks it.
export const COACH_COMPOSER_TEXT_INPUT_PROPS = {
  autoComplete: 'off',
  textContentType: 'none',
  autoCorrect: true,
  spellCheck: true,
  ...(Platform.OS === 'android' ? { importantForAutofill: 'no' } : {}),
};

// ===== HELPER FUNCTIONS =====

function keyboardShowEventName() {
  if (Platform.OS === 'ios') return IOS_KEYBOARD_SHOW_EVENT;
  return OTHER_KEYBOARD_SHOW_EVENT;
}

function keyboardHideEventName() {
  if (Platform.OS === 'ios') return IOS_KEYBOARD_HIDE_EVENT;
  return OTHER_KEYBOARD_HIDE_EVENT;
}

// iOS reports the keyboard's top in screen coordinates. The inset is the window height minus that top.
function iosKeyboardInset(endCoordinates) {
  const windowHeight = Dimensions.get('window').height;
  return Math.max(0, Math.round(windowHeight - endCoordinates.screenY));
}

function keyboardInsetFromEvent(keyboardEvent) {
  const endCoordinates = keyboardEvent?.endCoordinates;
  if (!endCoordinates) return 0;
  if (Platform.OS === 'ios') return iosKeyboardInset(endCoordinates);
  return Math.max(0, endCoordinates.height ?? 0);
}

function composerBottomPadding(isKeyboardVisible, shellNavPad) {
  if (isKeyboardVisible) return COMPOSER_GAP_WHEN_KEYBOARD_OPEN;
  return COMPOSER_GAP_ABOVE_NAV + shellNavPad;
}

function listBottomPadding(isKeyboardVisible) {
  if (isKeyboardVisible) return LIST_GAP_WHEN_KEYBOARD_OPEN;
  return LIST_GAP_WHEN_KEYBOARD_CLOSED;
}

function composerKeyboardPadding(isKeyboardVisible, keyboardInset, closedComposerPad) {
  if (isKeyboardVisible) return keyboardInset + COMPOSER_GAP_WHEN_KEYBOARD_OPEN;
  return closedComposerPad;
}

// ===== MAIN FUNCTION =====

/**
 * Keyboard inset for the coach composer. The list only gets a small gap, not another nav-height pad.
 * hideBottomNav is still accepted because both screens pass it. This hook does not read it.
 * @param {{ hideBottomNav?: boolean }} [options]
 * @returns {{ keyboardVisible: boolean, keyboardInset: number, composerBottomPad: number, composerKeyboardPad: number, listBottomPad: number, shellNavPad: number }}
 */
export function keyboardBehavior({ hideBottomNav: _hideBottomNav = false } = {}) {
  // vocab: useSafeAreaInsets = the home-indicator (or notch) inset from the operating system.
  const insets = useSafeAreaInsets();
  const shellNavPad = BOTTOM_NAV_BAR_HEIGHT + Math.max(insets.bottom, 0);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // vocab: useEffect cleanup removes the listeners so a closed chat does not keep moving padding.
  useEffect(() => {
    const showEventName = keyboardShowEventName();
    const hideEventName = keyboardHideEventName();
    const onShow = (keyboardEvent) => setKeyboardInset(keyboardInsetFromEvent(keyboardEvent));
    const onHide = () => setKeyboardInset(0);
    const showSubscription = Keyboard.addListener(showEventName, onShow);
    const hideSubscription = Keyboard.addListener(hideEventName, onHide);
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const isKeyboardVisible = keyboardInset > 0;
  const composerBottomPad = composerBottomPadding(isKeyboardVisible, shellNavPad);
  const listBottomPad = listBottomPadding(isKeyboardVisible);
  const composerKeyboardPad = composerKeyboardPadding(
    isKeyboardVisible,
    keyboardInset,
    composerBottomPad,
  );

  return {
    keyboardVisible: isKeyboardVisible,
    keyboardInset,
    composerBottomPad,
    composerKeyboardPad,
    listBottomPad,
    shellNavPad,
  };
}
