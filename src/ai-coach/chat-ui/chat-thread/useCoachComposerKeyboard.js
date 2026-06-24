import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_NAV_BAR_HEIGHT } from '../../../navigation/bottomNavMetrics';

/** CoachConnectHeader content row (below status bar padding). */
const HEADER_BODY_HEIGHT = 68;

/**
 * Keyboard + bottom-nav inset for AI Coach composer.
 * When the keyboard is open, drop shell nav padding so the input sits on the keyboard.
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

  const composerBottomPad = keyboardVisible
    ? Math.max(insets.bottom, 10)
    : 8 + shellNavPad;
  const listBottomPad = keyboardVisible ? 12 : 16 + shellNavPad;
  const keyboardVerticalOffset = Platform.OS === 'ios' ? insets.top + HEADER_BODY_HEIGHT : 20;

  return {
    keyboardVisible,
    composerBottomPad,
    listBottomPad,
    keyboardVerticalOffset,
    shellNavPad,
  };
}
