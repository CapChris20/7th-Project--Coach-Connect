/**
 * Floating bottom nav for client stack screens (Profile, Settings, etc.)
 * so tab navigation stays available outside MainTabs.
 */
import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, View } from 'react-native';
import BottomNavBar from '../../navigation/BottomNavBar';

export default function ClientShellBottomNav({ shell, activeTabKey }) {
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

  if (!shell?.navProviderProps || keyboardVisible) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 200 }}>
      <BottomNavBar
        {...shell.navProviderProps}
        activeTabKey={activeTabKey ?? shell.mainTabActiveKey ?? 'home'}
      />
    </View>
  );
}
