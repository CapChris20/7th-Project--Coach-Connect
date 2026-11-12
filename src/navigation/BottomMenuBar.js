// Design Law bottom dock — flat surface, 3px top border, gradient icons, soft active chip, centered +.
// Flow: resolve handlers → remember active tab → paint slots + center + → shell navigates.
// Used by client/trainer shells via ShellBottomNavAnchor. Screens reserve space with useShellBottomNavInset.
//
// vocab: navAccentGradient = brand pink→orange for tab icons + the + button
// Active chip hugs the icon only (never the label) — soft fill + border, not a black slab over the text.

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { useMergedNavigation } from './whichScreenIsOpen';
import { useAI } from '../for-both/app-wide-settings/AIPermission';
import ColorfulIcon from '../for-both/icons/ColorfulIcon';
import HardShadow from '../look-and-feel/HardShadow';
import {
  lightColors,
  darkColors,
  navAccentGradient,
  nb,
} from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ACTIVE_KEY_STORAGE = '@coachconnect_nav_active_key';
const TAB_HIGHLIGHT_SPRING_FRICTION = 8;
const ALLOWED_TAB_KEYS = new Set(['home', 'workout', 'files', 'nutrition', 'ai']);
const DEFAULT_ACTIVE_TAB = 'home';
// Manipulate here: keep in sync with bottomMenuSpacing.js BAR height
const BAR_VISUAL_HEIGHT = 86;
// Manipulate here: tab icon size — Workout is one step larger per Design Law
const ICON_SIZE = 30;
const ICON_SIZE_WORKOUT = 34;
// Manipulate here: padding around the glyph inside the active chip (chip = icon only, not the label)
const ICON_CHIP_PAD = 8;
const PLUS_SIZE = 58;
// Manipulate here: how far the + peeks above the bar top (was 30 — felt too high)
const PLUS_OVERHANG = 8;

// ===== HELPERS =====

function springHighlight(animValue, isActive) {
  return Animated.spring(animValue, {
    toValue: isActive ? 1 : 0,
    friction: TAB_HIGHLIGHT_SPRING_FRICTION,
    useNativeDriver: true,
  });
}

function TabSlot({
  label,
  colorfulName,
  iconSize,
  active,
  anim,
  onPress,
  themeColors,
  badge,
  maxWidth,
}) {
  // Chip size = glyph + pad. Label stays outside so the highlight never covers text.
  const chipSize = iconSize + ICON_CHIP_PAD * 2;

  return (
    <TouchableOpacity
      style={[styles.navItem, maxWidth ? { maxWidth } : null]}
      activeOpacity={0.92}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      onPress={onPress}
    >
      <View style={styles.navContent}>
        {/* Icon column: soft bordered chip fades in behind the glyph only. */}
        <View style={[styles.navIcon, { width: chipSize, height: chipSize }]} collapsable={false}>
          <Animated.View
            pointerEvents="none"
            style={[styles.activeChipAnim, { opacity: anim }]}
          >
            <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
              <View
                style={[
                  styles.activeChip,
                  {
                    width: chipSize,
                    height: chipSize,
                    backgroundColor: themeColors.soft,
                    borderColor: themeColors.border,
                  },
                ]}
              />
            </HardShadow>
          </Animated.View>
          {/* Always gradient icon — active is the soft chip + bolder label, not a color swap. */}
          <ColorfulIcon
            name={colorfulName}
            size={iconSize}
            colors={navAccentGradient}
            locations={[0, 1]}
          />
          {badge ? <View style={styles.tabBadgeDot} /> : null}
        </View>
        <Text
          style={[
            styles.navLabel,
            {
              color: active ? themeColors.ink : themeColors.muted,
              fontWeight: active ? '800' : '700',
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

export default function BottomMenuBar({
  onPlusPress: onPlusPressProp,
  onVoicePress: onVoicePressProp,
  onNutritionPress: onNutritionPressProp,
  onProfilePress: onProfilePressProp,
  onWorkoutPress: onWorkoutPressProp,
  onHomePress: onHomePressProp,
  onMessagesPress: onMessagesPressProp,
  activeTabKey: activeTabKeyProp,
  workoutTabBadge = false,
  appearanceIsDark,
}) {
  const mergedNav = useMergedNavigation({
    onHomePress: onHomePressProp,
    onPlusPress: onPlusPressProp,
    onVoicePress: onVoicePressProp,
    onNutritionPress: onNutritionPressProp,
    onWorkoutPress: onWorkoutPressProp,
    onProfilePress: onProfilePressProp,
    onMessagesPress: onMessagesPressProp,
  });
  const {
    onHomePress,
    onPlusPress,
    onVoicePress,
    onNutritionPress,
    onWorkoutPress,
  } = mergedNav;

  const { isDark: globalIsDark } = useTheme();
  const isDark = appearanceIsDark !== undefined ? appearanceIsDark : globalIsDark;
  const insets = useSafeAreaInsets();
  const { aiEnabled } = useAI();
  const aiOn = aiEnabled === true;

  const themeColors = {
    surface: isDark ? darkColors.nbSurface : lightColors.nbSurface,
    soft: isDark ? darkColors.nbSoft : lightColors.nbSoft,
    border: isDark ? darkColors.nbBorder : lightColors.nbBorder,
    ink: isDark ? darkColors.nbInk : lightColors.nbInk,
    muted: isDark ? darkColors.nbMuted : lightColors.nbMuted,
  };

  const [activeKey, setActiveKey] = useState(activeTabKeyProp || DEFAULT_ACTIVE_TAB);
  const homeAnim = useRef(new Animated.Value(0)).current;
  const workoutAnim = useRef(new Animated.Value(0)).current;
  const filesAnim = useRef(new Animated.Value(0)).current;
  const nutritionAnim = useRef(new Animated.Value(0)).current;
  const aiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      springHighlight(homeAnim, activeKey === 'home'),
      springHighlight(workoutAnim, activeKey === 'workout'),
      springHighlight(filesAnim, activeKey === 'files'),
      springHighlight(nutritionAnim, activeKey === 'nutrition'),
      springHighlight(aiAnim, activeKey === 'ai'),
    ]).start();
  }, [activeKey, homeAnim, workoutAnim, filesAnim, nutritionAnim, aiAnim]);

  useEffect(() => {
    if (activeTabKeyProp) {
      setActiveKey(activeTabKeyProp);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(ACTIVE_KEY_STORAGE);
        if (!cancelled && saved && ALLOWED_TAB_KEYS.has(saved)) setActiveKey(saved);
      } catch (_) {}
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTabKeyProp]);

  const activate = (key, handler) => {
    setActiveKey(key);
    AsyncStorage.setItem(ACTIVE_KEY_STORAGE, key).catch(() => {});
    if (typeof handler === 'function') handler();
  };

  const slotMax = aiOn ? '18%' : '25%';
  const thirdKey = aiOn ? 'ai' : 'files';
  const thirdLabel = aiOn ? 'AI Coach' : 'Files';
  const thirdName = aiOn ? 'sparkles' : 'document-text';
  const thirdAnim = aiOn ? aiAnim : filesAnim;
  const thirdHandler = aiOn ? onVoicePress : onPlusPress;

  // Sit the + mostly inside the bar — only a small overhang above the top border.
  const plusTop = -PLUS_OVERHANG;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.border,
          paddingBottom: insets.bottom,
          minHeight: BAR_VISUAL_HEIGHT + insets.bottom,
        },
      ]}
    >
      <View style={styles.row}>
        <TabSlot
          label="Home"
          colorfulName="home"
          iconSize={ICON_SIZE}
          active={activeKey === 'home'}
          anim={homeAnim}
          onPress={() => activate('home', onHomePress || (() => {}))}
          themeColors={themeColors}
          maxWidth={slotMax}
        />
        <TabSlot
          label="Workout"
          colorfulName="barbell"
          iconSize={ICON_SIZE_WORKOUT}
          active={activeKey === 'workout'}
          anim={workoutAnim}
          onPress={() => activate('workout', onWorkoutPress || (() => {}))}
          themeColors={themeColors}
          badge={workoutTabBadge}
          maxWidth={slotMax}
        />
        <View style={{ width: PLUS_SIZE, flexShrink: 0 }} />
        <TabSlot
          label={thirdLabel}
          colorfulName={thirdName}
          iconSize={ICON_SIZE}
          active={activeKey === thirdKey}
          anim={thirdAnim}
          onPress={() => activate(thirdKey, thirdHandler || (() => {}))}
          themeColors={themeColors}
          maxWidth={slotMax}
        />
        <TabSlot
          label="Nutrition"
          colorfulName="restaurant"
          iconSize={ICON_SIZE}
          active={activeKey === 'nutrition'}
          anim={nutritionAnim}
          onPress={() => activate('nutrition', onNutritionPress || (() => {}))}
          themeColors={themeColors}
          maxWidth={slotMax}
        />
      </View>

      <View style={[styles.plusWrap, { top: plusTop }]} pointerEvents="box-none">
        <HardShadow offset={nb.shadowOffsetCard} radius={PLUS_SIZE / 2}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPlusPress}
            style={[styles.plusHit, { borderColor: themeColors.border }]}
          >
            <LinearGradient
              colors={navAccentGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.plusFab}
            >
              <Ionicons name="add" size={32} color={lightColors.nbInk} />
            </LinearGradient>
          </TouchableOpacity>
        </HardShadow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: nb.borderWidth,
    position: 'relative',
    zIndex: 100,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    paddingTop: 10,
    minHeight: BAR_VISUAL_HEIGHT,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 2,
    paddingBottom: 6,
    position: 'relative',
    minHeight: nb.minTouchTarget,
  },
  navContent: {
    alignItems: 'center',
  },
  navIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  // Absolute inside the icon box only — never stretches over the label.
  activeChipAnim: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeChip: {
    borderRadius: 12,
    borderWidth: nb.borderWidth,
  },
  navLabel: {
    // Manipulate here: Design Law floor is 12 — keep labels bold and readable
    fontSize: 12,
    letterSpacing: 0.2,
    marginTop: 2,
  },
  tabBadgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: lightColors.primary,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  plusWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  plusHit: {
    width: PLUS_SIZE,
    height: PLUS_SIZE,
    borderRadius: PLUS_SIZE / 2,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  plusFab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
