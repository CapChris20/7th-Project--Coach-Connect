// Design Law bottom nav dock — soft active chip on the icon only, gradient + in the middle.
// Flow: theme + safe area → split tabs left/right of + → paint each tab → optional floating plus.
// Used by: previews / simple embeds. Production shell is BottomMenuBar.js (same chrome + storage).
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

// Manipulate here: diameter of the floating +; keep matched to BottomMenuBar.js
const PLUS_SIZE = 58;
// Manipulate here: how far the + hangs above the dock top edge
const PLUS_OVERHANG = 8;
// Manipulate here: padding inside active soft chip AND idle icon so layout does not jump
const ICON_CHIP_PAD = 8;
const ACTIVE_CHIP_RADIUS = 12;
const PLUS_ICON_SIZE = 30;
const PLUS_PRESSED_OPACITY = 0.92;

// ===== HELPER FUNCTIONS =====

/**
 * Split the tab list so half sit left of the center +, half sit right.
 * Odd counts put the extra tab on the left (same as BottomMenuBar handoff).
 */
function splitTabsAroundMiddle(tabList) {
  const safeTabs = tabList || [];
  const splitIndex = Math.ceil(safeTabs.length / 2);
  const leftTabs = safeTabs.slice(0, splitIndex);
  const rightTabs = safeTabs.slice(splitIndex);
  return { leftTabs, rightTabs };
}

function centerPlusShouldShow(onPlusPress) {
  return typeof onPlusPress === 'function';
}

function labelColorForTab(isActive, colors) {
  if (isActive) {
    return colors.nbInk;
  }
  return colors.nbMuted;
}

// Active tab: soft chip + HardShadow behind the glyph only (label stays outside).
function ActiveTabIcon({ iconNode, softFillColor, borderColor }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={ACTIVE_CHIP_RADIUS}>
      <View
        style={[
          styles.activeChip,
          {
            backgroundColor: softFillColor,
            borderColor,
            padding: ICON_CHIP_PAD,
          },
        ]}
      >
        {iconNode}
      </View>
    </HardShadow>
  );
}

// Idle tab: same padding as the chip so the icon does not jump when selection changes.
function IdleTabIcon({ iconNode }) {
  return <View style={styles.iconIdle}>{iconNode}</View>;
}

/**
 * One dock tab: icon column (chip or idle) then label under it.
 */
function BottomNavTab({ tab, isActive, onSelect, colors }) {
  const labelColor = labelColorForTab(isActive, colors);
  const labelWeightStyle = isActive ? styles.activeLabel : null;

  // Name the icon branch before JSX so the Pressable stays flat.
  let iconNode;
  if (isActive) {
    iconNode = (
      <ActiveTabIcon
        iconNode={tab.icon}
        softFillColor={colors.nbSoft}
        borderColor={colors.nbBorder}
      />
    );
  } else {
    iconNode = <IdleTabIcon iconNode={tab.icon} />;
  }

  function handleTabPress() {
    onSelect(tab.id);
  }

  return (
    <Pressable onPress={handleTabPress} style={styles.tab}>
      <View style={styles.iconCol}>{iconNode}</View>
      <Text
        style={[styles.label, { color: labelColor }, labelWeightStyle]}
        numberOfLines={1}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

/**
 * Center gradient + button — only gradient accent on this primitive dock.
 * vocab: LinearGradient = Expo ramp fill; navAccentGradient is Design Law nav accent colors
 */
function BottomNavCenterPlus({ onPlusPress, colors }) {
  const plusBorderStyle = { borderColor: colors.nbBorder };
  const plusRadius = PLUS_SIZE / 2;

  function pressOpacityStyle({ pressed }) {
    if (pressed) {
      return { opacity: PLUS_PRESSED_OPACITY };
    }
    return { opacity: 1 };
  }

  return (
    <View style={styles.plusSlot}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={plusRadius} style={styles.plusShadow}>
        <Pressable
          onPress={onPlusPress}
          accessibilityRole="button"
          accessibilityLabel="Add"
          style={pressOpacityStyle}
        >
          <LinearGradient
            colors={navAccentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.plusBtn, plusBorderStyle]}
          >
            <Ionicons name="add" size={PLUS_ICON_SIZE} color={colors.nbInk} />
          </LinearGradient>
        </Pressable>
      </HardShadow>
    </View>
  );
}

function paintTabList(tabList, activeId, onSelect, colors) {
  return tabList.map((tab) => (
    <BottomNavTab
      key={tab.id}
      tab={tab}
      isActive={activeId === tab.id}
      onSelect={onSelect}
      colors={colors}
    />
  ));
}

// ===== MAIN FUNCTION =====

/**
 * Soft-chip bottom nav with optional floating center +.
 *
 * @param {{
 *   tabs: Array<{id: string, icon: React.ReactNode, label: string}>,
 *   active: string,
 *   onSelect: (id: string) => void,
 *   onPlusPress?: () => void,
 *   style?: object,
 * }} props
 */
export default function NbBottomNav({ tabs, active, onSelect, onPlusPress, style }) {
  // vocab: useTheme = Design Law light/dark color bag for this screen
  const { colors } = useTheme();
  // vocab: useSafeAreaInsets = home-indicator / notch padding from the device
  const insets = useSafeAreaInsets();

  // 1. Split tabs around the middle so the + can sit between left and right groups.
  const { leftTabs, rightTabs } = splitTabsAroundMiddle(tabs);
  const showCenterPlus = centerPlusShouldShow(onPlusPress);

  // 2. Pad the dock bottom by at least spacing.sm so labels clear the home indicator.
  // Manipulate here: spacing.sm floor — raise if labels clip on thick home bars
  const bottomInsetPadding = Math.max(insets.bottom, spacing.sm);

  // 3. Theme surface + top border + caller style on the outer row.
  const dockSurfaceStyle = {
    backgroundColor: colors.nbSurface,
    borderTopColor: colors.nbBorder,
    paddingBottom: bottomInsetPadding,
  };

  // 4. Paint left tabs, optional center +, right tabs — same order as BottomMenuBar handoff.
  const leftTabNodes = paintTabList(leftTabs, active, onSelect, colors);
  const rightTabNodes = paintTabList(rightTabs, active, onSelect, colors);

  let centerPlusNode = null;
  if (showCenterPlus) {
    centerPlusNode = (
      <BottomNavCenterPlus onPlusPress={onPlusPress} colors={colors} />
    );
  }

  return (
    <View style={[styles.container, dockSurfaceStyle, style]}>
      {leftTabNodes}
      {centerPlusNode}
      {rightTabNodes}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
    borderRadius: ACTIVE_CHIP_RADIUS,
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
