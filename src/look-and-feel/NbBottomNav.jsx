// Design Law bottom nav primitive — flat surface, 3px top, active fill block.
// Flow: map tabs → active gets fill block + bold label. Live shell uses BottomMenuBar.js (same chrome).
// Where used: previews / future shared nav; BottomMenuBar is the production dock.

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';
import HardShadow from './HardShadow';

/**
 * @param {{ tabs: Array<{id: string, icon: React.ReactNode, label: string}>, active: string, onSelect: (id: string) => void, style?: object }} props
 */
export default function NbBottomNav({ tabs, active, onSelect, style }) {
  const { colors } = useTheme();

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
          <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={styles.tab}>
            {isActive ? (
              <HardShadow offset={nb.shadowOffsetSmall} radius={10}>
                <View style={[styles.activeBlock, { backgroundColor: colors.nbFill }]}>
                  {tab.icon}
                </View>
              </HardShadow>
            ) : (
              <View style={styles.iconContainer}>{tab.icon}</View>
            )}
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
    height: 40,
    justifyContent: 'center',
  },
  activeBlock: {
    width: 48,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeLabel: {
    fontWeight: '800',
  },
});
