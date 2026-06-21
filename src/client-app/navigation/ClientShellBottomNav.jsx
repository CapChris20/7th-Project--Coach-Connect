/**
 * Floating bottom nav for client stack screens (Profile, Settings, etc.)
 * so tab navigation stays available outside MainTabs.
 */
import React from 'react';
import { View } from 'react-native';
import BottomNavBar from '../../navigation/BottomNavBar';

export default function ClientShellBottomNav({ shell, activeTabKey }) {
  if (!shell?.navProviderProps) return null;

  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 200 }}>
      <BottomNavBar
        {...shell.navProviderProps}
        activeTabKey={activeTabKey ?? shell.mainTabActiveKey ?? 'home'}
      />
    </View>
  );
}
