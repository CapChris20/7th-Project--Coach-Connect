// How far the coach composer and the message list sit above the keyboard and the bottom nav.
// Flow: listen for show and hide → measure the keyboard → pad the composer and leave the list a small gap.
// Used by CoachConversationScreen and CoachHomeScreen. KeyboardAvoidingView double-pads on iOS, so we do this by hand.

import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

const PLATFORM_IOS = 'ios';
const PLATFORM_ANDROID = 'android';

// iOS moves the field with the keyboard animation. Android only tells us after the keyboard is up.
const KEYBOARD_EVENTS_BY_PLATFORM = {
  ios: { show: 'keyboardWillShow', hide: 'keyboardWillHide' },
  default: { show: 'keyboardDidShow', hide: 'keyboardDidHide' },
};

// Manipulate here: these are the breathing gaps, not a second copy of the nav bar height.
const COMPOSER_GAP_WHEN_KEYBOARD_OPEN = 8;
const COMPOSER_GAP_ABOVE_NAV = 10;
const LIST_GAP_WHEN_KEYBOARD_OPEN = 12;
const LIST_GAP_WHEN_KEYBOARD_CLOSED = 20;

function extraAutofillPropsForPlatform() {
  if (Platform.OS === PLATFORM_ANDROID) {
    return { importantForAutofill: 'no' };
  }
  return {};
}

// Android's password bar ignores autoComplete: 'off'. This extra flag is what actually blocks it.
export const COACH_COMPOSER_TEXT_INPUT_PROPS = {
  autoComplete: 'off',
  textContentType: 'none',
  autoCorrect: true,
  spellCheck: true,
  ...extraAutofillPropsForPlatform(),
};

// ===== HELPER FUNCTIONS =====

function keyboardEventNamesForPlatform() {
  if (Platform.OS === PLATFORM_IOS) return KEYBOARD_EVENTS_BY_PLATFORM.ios;
  return KEYBOARD_EVENTS_BY_PLATFORM.default;
}

// iOS reports the keyboard's top in screen coordinates. The inset is the window height minus that top.
function iosKeyboardInsetFromCoordinates(endCoordinates) {
  const windowHeight = Dimensions.get('window').height;
  const keyboardTopY = endCoordinates.screenY;
  return Math.max(0, Math.round(windowHeight - keyboardTopY));
}

/**
 * vocab: ?? keeps a reported height of 0. Do not switch it to ||.
 * @param {object} keyboardEvent
 * @returns {number}
 */
function readKeyboardInsetFromEvent(keyboardEvent) {
  if (!keyboardEvent || !keyboardEvent.endCoordinates) return 0;
  const endCoordinates = keyboardEvent.endCoordinates;
  if (Platform.OS === PLATFORM_IOS) return iosKeyboardInsetFromCoordinates(endCoordinates);
  const androidHeight = endCoordinates.height ?? 0;
  return Math.max(0, androidHeight);
}

/**
 * @param {boolean} isKeyboardVisible
 * @param {number} shellNavPad
 * @returns {number}
 */
function composerBottomPaddingWhenClosedOrOpen(isKeyboardVisible, shellNavPad) {
  if (isKeyboardVisible) return COMPOSER_GAP_WHEN_KEYBOARD_OPEN;
  return COMPOSER_GAP_ABOVE_NAV + shellNavPad;
}

/**
 * @param {boolean} isKeyboardVisible
 * @returns {number}
 */
function listBottomPaddingForKeyboard(isKeyboardVisible) {
  if (isKeyboardVisible) return LIST_GAP_WHEN_KEYBOARD_OPEN;
  return LIST_GAP_WHEN_KEYBOARD_CLOSED;
}

/**
 * @param {boolean} isKeyboardVisible
 * @param {number} keyboardInset
 * @param {number} closedComposerPad
 * @returns {number}
 */
function composerKeyboardPaddingPixels(isKeyboardVisible, keyboardInset, closedComposerPad) {
  if (isKeyboardVisible) return keyboardInset + COMPOSER_GAP_WHEN_KEYBOARD_OPEN;
  return closedComposerPad;
}

/**
 * @param {boolean} isKeyboardVisible
 * @param {number} keyboardInset
 * @param {number} shellNavPad
 * @returns {{ composerBottomPad: number, listBottomPad: number, composerKeyboardPad: number }}
 */
function buildCoachPaddingBundle(isKeyboardVisible, keyboardInset, shellNavPad) {
  const composerBottomPad = composerBottomPaddingWhenClosedOrOpen(isKeyboardVisible, shellNavPad);
  const listBottomPad = listBottomPaddingForKeyboard(isKeyboardVisible);
  const composerKeyboardPad = composerKeyboardPaddingPixels(
    isKeyboardVisible,
    keyboardInset,
    composerBottomPad,
  );
  return { composerBottomPad, listBottomPad, composerKeyboardPad };
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
    const eventNames = keyboardEventNamesForPlatform();
    const onKeyboardShow = (keyboardEvent) => {
      setKeyboardInset(readKeyboardInsetFromEvent(keyboardEvent));
    };
    const onKeyboardHide = () => {
      setKeyboardInset(0);
    };
    const showSubscription = Keyboard.addListener(eventNames.show, onKeyboardShow);
    const hideSubscription = Keyboard.addListener(eventNames.hide, onKeyboardHide);
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const isKeyboardVisible = keyboardInset > 0;
  const paddingBundle = buildCoachPaddingBundle(isKeyboardVisible, keyboardInset, shellNavPad);

  return {
    keyboardVisible: isKeyboardVisible,
    keyboardInset,
    composerBottomPad: paddingBundle.composerBottomPad,
    composerKeyboardPad: paddingBundle.composerKeyboardPad,
    listBottomPad: paddingBundle.listBottomPad,
    shellNavPad,
  };
}
