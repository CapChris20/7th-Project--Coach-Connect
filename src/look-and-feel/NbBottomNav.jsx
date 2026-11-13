// Design Law bottom nav primitive — soft active chip on icon only, gradient + in the middle.
// Flow: tabs → active chip + bold label → optional centerPlus. Production shell uses BottomMenuBar.js
// (same chrome + AsyncStorage active key + AI slot). Keep this for previews / simple embeds.
//
// Pass ink/muted outline icons as tab.icon — the + is the only gradient accent on this dock.
// vocab: soft chip = nbSoft fill + border behind the glyph only (never a black slab over the label)
// Manipulate here: PLUS_SIZE / PLUS_OVERHANG must stay in sync with BottomMenuBar.js

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { nb, spacing, navAccentGradient } from './colorPalette';
import { useTheme } from './lightDarkMode';
import HardShadow from './HardShadow';

// ===== NAMED CONSTANTS =====

const PLUS_SIZE = 58;
const PLUS_OVERHANG = 8;
const ICON_CHIP_PAD = 8;

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   tabs: Array<{id: string, icon: React.ReactNode, label: string}>,
 *   active: string,
 *   onSelect: (id: string) => void,
 *   onPlusPress?: () => void,
 *   style?: object,
 * }} props
 */
export default function NbBottomNav({ tabs, active, onSelect, onPlusPress, style }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Split around the center + when the caller provides onPlusPress.
  const mid = Math.ceil((tabs?.length || 0) / 2);
  const left = (tabs || []).slice(0, mid);
  const right = (tabs || []).slice(mid);
  const showPlus = typeof onPlusPress === 'function';

  const renderTab = (tab) => {
    const isActive = active === tab.id;
    return (
      <Pressable key={tab.id} onPress={() => onSelect(tab.id)} style={styles.tab}>
        <View style={styles.iconCol}>
          {isActive ? (
            <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
              <View
                style={[
                  styles.activeChip,
                  {
                    backgroundColor: colors.nbSoft,
                    borderColor: colors.nbBorder,
                    padding: ICON_CHIP_PAD,
                  },
                ]}
              >
                {tab.icon}
              </View>
            </HardShadow>
          ) : (
            <View style={styles.iconIdle}>{tab.icon}</View>
          )}
        </View>
        <Text
          style={[
            styles.label,
            { color: isActive ? colors.nbInk : colors.nbMuted },
            isActive && styles.activeLabel,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.nbSurface,
          borderTopColor: colors.nbBorder,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
        style,
      ]}
    >
      {left.map(renderTab)}
      {showPlus ? (
        <View style={styles.plusSlot}>
          <HardShadow offset={nb.shadowOffsetSmall} radius={PLUS_SIZE / 2} style={styles.plusShadow}>
            <Pressable
              onPress={onPlusPress}
              accessibilityRole="button"
              accessibilityLabel="Add"
              style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
              <LinearGradient
                colors={navAccentGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.plusBtn,
                  { borderColor: colors.nbBorder },
                ]}
              >
                <Ionicons name="add" size={30} color={colors.nbInk} />
              </LinearGradient>
            </Pressable>
          </HardShadow>
        </View>
      ) : null}
      {right.map(renderTab)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: nb.borderWidth,
    paddingTop: spacing.sm + 4,
    alignItems: 'flex-end',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    minHeight: nb.minTouchTarget,
  },
  iconCol: {
    marginBottom: 4,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconIdle: {
    padding: ICON_CHIP_PAD,
  },
  activeChip: {
    borderWidth: nb.borderWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  activeLabel: {
    fontWeight: '800',
  },
  plusSlot: {
    width: PLUS_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  plusShadow: {
    marginTop: -PLUS_OVERHANG,
  },
  plusBtn: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    borderRadius: PLUS_SIZE / 2,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
