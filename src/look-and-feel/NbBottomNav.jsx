// Neobrutalist bottom navigation bar
// Flow: renders bottom tab bar with icons, labels, and gradient active state
// Where used: main app navigation in trainer and client apps
//
// vocab: bottom nav = iOS-style bottom tab bar

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lightColors, darkColors, nb, gradients, spacing } from './colorPalette';

/**
 * Bottom navigation bar with neobrutalist styling.
 * Active tab gets brand gradient.
 * 
 * @param {object} props
 * @param {Array<{id: string, icon: React.ReactNode, activeIcon: React.ReactNode, label: string}>} props.tabs - tab data
 * @param {string} props.active - active tab id
 * @param {Function} props.onSelect - (id) => void
 * @param {object} [props.style] - additional container styles
 */
export default function NbBottomNav({ tabs, active, onSelect, style }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.nbSurface,
          borderTopColor: colors.nbBorder,
        },
        style,
      ]}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={styles.tab}
          >
            <View style={styles.iconContainer}>
              {isActive ? tab.activeIcon : tab.icon}
            </View>
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.nbInk : colors.nbMuted },
                isActive && styles.activeLabel,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: nb.borderWidth,
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm + 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 4,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    textAlign: 'center',
  },
  activeLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
