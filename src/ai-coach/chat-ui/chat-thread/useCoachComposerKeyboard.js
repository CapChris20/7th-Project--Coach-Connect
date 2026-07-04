import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../../navigation/bottomNavMetrics';

/** CoachConnectHeader: safe-area top + 8px padding + ~44px row */
const HEADER_BODY_HEIGHT = 52;

/** Prevent iOS Passwords / strong-password autofill bar on the coach chat field. */
export const COACH_COMPOSER_TEXT_INPUT_PROPS = {
  autoComplete: 'off',
  textContentType: 'none',
  autoCorrect: true,
  spellCheck: true,
  ...(Platform.OS === 'android' ? { importantForAutofill: 'no' } : {}),
};

/**
 * Keyboard + bottom-nav inset for AI Coach composer.
 * When the keyboard is open, drop shell nav + home-indicator padding so the input sits flush on the keyboard.
 */
export function useCoachComposerKeyboard({ hideBottomNav = false } = {}) {
  const insets = useSafeAreaInsets();
  const shellNavPad = hideBottomNav ? BOTTOM_NAV_BAR_HEIGHT + insets.bottom : 0;
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const composerBottomPad = keyboardVisible ? 10 : 10 + shellNavPad;
  const listBottomPad = keyboardVisible ? 8 : 12 + shellNavPad;
  const keyboardVerticalOffset =
    Platform.OS === 'ios' ? insets.top + HEADER_BODY_HEIGHT : 0;

  return {
    keyboardVisible,
    composerBottomPad,
    listBottomPad,
    keyboardVerticalOffset,
    shellNavPad,
  };
}
