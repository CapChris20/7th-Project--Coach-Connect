// Coach chat keyboard padding — the typing field rides the keyboard; the thread only gets a small gap.
// Flow: subscribe to keyboard show/hide → measure inset → publish pad numbers for composer + list.
// Used by: CoachConversationScreen and CoachHomeScreen.
// Why not KeyboardAvoidingView? On iOS it double-pads with our bottom nav, so we pad by hand.

import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

const OPERATING_SYSTEM_IOS = 'ios';
const OPERATING_SYSTEM_ANDROID = 'android';

// vocab: iOS "will" events fire during the keyboard animation so padding can track it.
//        Android only fires "did" after the keyboard is already up.
const KEYBOARD_LISTENER_NAMES_BY_OS = {
  ios: { show: 'keyboardWillShow', hide: 'keyboardWillHide' },
  default: { show: 'keyboardDidShow', hide: 'keyboardDidHide' },
};

// Manipulate here: breathing room only — these are NOT a second copy of bottom-nav height.
const GAP_COMPOSER_WHEN_KEYBOARD_UP_PX = 8;
const GAP_COMPOSER_ABOVE_BOTTOM_NAV_PX = 10;
const GAP_MESSAGE_LIST_WHEN_KEYBOARD_UP_PX = 12;
const GAP_MESSAGE_LIST_WHEN_KEYBOARD_DOWN_PX = 20;

// Android ignores autoComplete: 'off' alone — importantForAutofill: 'no' quiets the bar.
export const COACH_COMPOSER_TEXT_INPUT_PROPS = {
  autoComplete: 'off',
  textContentType: 'none',
  autoCorrect: true,
  spellCheck: true,
  ...(Platform.OS === OPERATING_SYSTEM_ANDROID ? { importantForAutofill: 'no' } : {}),
};

// ===== HELPER FUNCTIONS =====

function pickKeyboardListenerNamesForThisOs() {
  const runningOnIos = Platform.OS === OPERATING_SYSTEM_IOS;
  if (runningOnIos) {
    return KEYBOARD_LISTENER_NAMES_BY_OS.ios;
  }
  return KEYBOARD_LISTENER_NAMES_BY_OS.default;
}

function measureIosKeyboardInsetFromEndCoordinates(endCoordinates) {
  const windowHeightPixels = Dimensions.get('window').height;
  const keyboardTopOnScreenPixels = endCoordinates.screenY;
  const rawInsetPixels = windowHeightPixels - keyboardTopOnScreenPixels;
  return Math.max(0, Math.round(rawInsetPixels));
}

/**
 * Read keyboard height from a Keyboard show event.
 * Keep a reported height of 0 — do not treat 0 as missing.
 * @param {object} keyboardEvent
 * @returns {number}
 */
function measureKeyboardInsetFromEvent(keyboardEvent) {
  if (!keyboardEvent) {
    return 0;
  }
  if (!keyboardEvent.endCoordinates) {
    return 0;
  }

  const endCoordinates = keyboardEvent.endCoordinates;
  const runningOnIos = Platform.OS === OPERATING_SYSTEM_IOS;
  if (runningOnIos) {
    return measureIosKeyboardInsetFromEndCoordinates(endCoordinates);
  }

  let androidReportedHeightPixels = endCoordinates.height;
  if (androidReportedHeightPixels === null || androidReportedHeightPixels === undefined) {
    androidReportedHeightPixels = 0;
  }
  return Math.max(0, androidReportedHeightPixels);
}

function bottomPadForComposer(keyboardIsOpen, shellNavPadPixels) {
  if (keyboardIsOpen) {
    return GAP_COMPOSER_WHEN_KEYBOARD_UP_PX;
  }
  return GAP_COMPOSER_ABOVE_BOTTOM_NAV_PX + shellNavPadPixels;
}

function bottomPadForMessageList(keyboardIsOpen) {
  if (keyboardIsOpen) {
    return GAP_MESSAGE_LIST_WHEN_KEYBOARD_UP_PX;
  }
  return GAP_MESSAGE_LIST_WHEN_KEYBOARD_DOWN_PX;
}

function keyboardLiftPadForComposer(
  keyboardIsOpen,
  keyboardInsetPixels,
  composerBottomPadWhenClosed,
) {
  if (keyboardIsOpen) {
    return keyboardInsetPixels + GAP_COMPOSER_WHEN_KEYBOARD_UP_PX;
  }
  return composerBottomPadWhenClosed;
}

// ===== MAIN FUNCTION =====

/**
 * Padding numbers so the coach composer and message list respect the keyboard and shell nav.
 * hideBottomNav is accepted because both screens still pass it; this hook does not read it.
 * Hook order is frozen: useSafeAreaInsets → useState → useEffect.
 * @param {{ hideBottomNav?: boolean }} [options]
 * @returns {{
 *   keyboardVisible: boolean,
 *   keyboardInset: number,
 *   composerBottomPad: number,
 *   composerKeyboardPad: number,
 *   listBottomPad: number,
 *   shellNavPad: number,
 * }}
 */
export function keyboardBehavior({ hideBottomNav: _unusedHideBottomNav = false } = {}) {
  // vocab: useSafeAreaInsets = home-indicator / notch inset from the OS safe-area context.
  const safeArea = useSafeAreaInsets();
  const bottomSafeInsetPixels = Math.max(safeArea.bottom, 0);
  const shellNavPadPixels = BOTTOM_NAV_BAR_HEIGHT + bottomSafeInsetPixels;

  // vocab: keyboardInsetPixels = how many px the keyboard covers from the bottom.
  const [keyboardInsetPixels, setKeyboardInsetPixels] = useState(0);

  // 1. Listen for keyboard show/hide for as long as this screen is mounted.
  useEffect(() => {
    const listenerNames = pickKeyboardListenerNamesForThisOs();

    const showSubscription = Keyboard.addListener(listenerNames.show, (keyboardEvent) => {
      const measuredInsetPixels = measureKeyboardInsetFromEvent(keyboardEvent);
      setKeyboardInsetPixels(measuredInsetPixels);
    });

    const hideSubscription = Keyboard.addListener(listenerNames.hide, () => {
      setKeyboardInsetPixels(0);
    });

    // 2. Tear listeners down when the user leaves chat so nothing keeps nudging padding.
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  // 3. Turn “keyboard open or closed” into the three pad values screens actually apply.
  const keyboardIsOpen = keyboardInsetPixels > 0;
  const composerBottomPad = bottomPadForComposer(keyboardIsOpen, shellNavPadPixels);
  const listBottomPad = bottomPadForMessageList(keyboardIsOpen);
  const composerKeyboardPad = keyboardLiftPadForComposer(
    keyboardIsOpen,
    keyboardInsetPixels,
    composerBottomPad,
  );

  return {
    keyboardVisible: keyboardIsOpen,
    keyboardInset: keyboardInsetPixels,
    composerBottomPad,
    composerKeyboardPad,
    listBottomPad,
    shellNavPad: shellNavPadPixels,
  };
}
