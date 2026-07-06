import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../../navigation/bottomNavMetrics';

/** Prevent iOS Passwords / strong-password autofill bar on the coach chat field. */
export const COACH_COMPOSER_TEXT_INPUT_PROPS = {
  autoComplete: 'off',
  textContentType: 'none',
  autoCorrect: true,
  spellCheck: true,
  ...(Platform.OS === 'android' ? { importantForAutofill: 'no' } : {}),
};

function keyboardInsetFromEvent(e) {
  const coords = e?.endCoordinates;
  if (!coords) return 0;
  if (Platform.OS === 'ios') {
    const windowH = Dimensions.get('window').height;
    return Math.max(0, Math.round(windowH - coords.screenY));
  }
  return Math.max(0, coords.height ?? 0);
}

/**
 * Keyboard inset for AI Coach composer — positions input flush above the keyboard.
 * Avoids KeyboardAvoidingView, which double-pads and leaves a floating gap on iOS.
 */
export function useCoachComposerKeyboard({ hideBottomNav = false } = {}) {
  const insets = useSafeAreaInsets();
  const shellNavPad = hideBottomNav ? BOTTOM_NAV_BAR_HEIGHT + insets.bottom : insets.bottom;
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e) => setKeyboardInset(keyboardInsetFromEvent(e));
    const onHide = () => setKeyboardInset(0);
    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const keyboardVisible = keyboardInset > 0;
  const composerBottomPad = keyboardVisible ? 8 : 10 + shellNavPad;
  const listBottomPad = keyboardVisible ? 8 : 12 + shellNavPad;
  /** Apply to composer wrapper: lifts bar exactly above keyboard when open. */
  const composerKeyboardPad = keyboardVisible ? keyboardInset + 8 : composerBottomPad;

  return {
    keyboardVisible,
    keyboardInset,
    composerBottomPad,
    composerKeyboardPad,
    listBottomPad,
  };
}
