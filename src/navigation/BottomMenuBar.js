// Design Law bottom dock — production path (Batch 3 chose this over a parallel NbBottomNav shell).
// Flow: resolve handlers → remember active tab → paint slots + center + → shell navigates.
// Used by client/trainer shells via ShellBottomNavAnchor. NbBottomNav.jsx is the preview twin only.
//
// Tab glyphs are ink/muted outline Ionicons (same black/white language as TopHeader).
// vocab: navAccentGradient = brand pink→orange — kept ONLY on the center + button
// Active chip hugs the icon only (never the label) — soft fill + border, not a black slab over the text.
// Read order: constants → BottomMenuTabSlot / CenterPlusButton → BottomMenuBar → PLUMBING styles.

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

const TAB_IONICON_BY_NAME = {
  home: 'home-outline',
  barbell: 'barbell-outline',
  restaurant: 'restaurant-outline',
  'document-text': 'document-text-outline',
  sparkles: 'sparkles',
};

// ===== HELPER FUNCTIONS =====

function runTabHighlightSpring(highlightOpacity, tabIsActive) {
  return Animated.spring(highlightOpacity, {
    toValue: tabIsActive ? 1 : 0,
    friction: TAB_HIGHLIGHT_SPRING_FRICTION,
    useNativeDriver: true,
  });
}

function pickDockThemeColors(isDark) {
  if (isDark) {
    return {
      surface: darkColors.nbSurface,
      soft: darkColors.nbSoft,
      border: darkColors.nbBorder,
      ink: darkColors.nbInk,
      muted: darkColors.nbMuted,
    };
  }
  return {
    surface: lightColors.nbSurface,
    soft: lightColors.nbSoft,
    border: lightColors.nbBorder,
    ink: lightColors.nbInk,
    muted: lightColors.nbMuted,
  };
}

function BottomMenuTabSlot({
  label,
  iconName,
  iconSize,
  active,
  highlightOpacity,
  onPress,
  themeColors,
  badge,
  maxWidth,
}) {
  const chipSize = iconSize + ICON_CHIP_PAD * 2;
  const glyphColor = active ? themeColors.ink : themeColors.muted;
  const labelColor = active ? themeColors.ink : themeColors.muted;
  const labelWeight = active ? '800' : '700';
  const ioniconName = TAB_IONICON_BY_NAME[iconName] || 'ellipse-outline';
  const slotWidthStyle = maxWidth ? { maxWidth } : null;

  return (
    <TouchableOpacity
      style={[styles.navItem, slotWidthStyle]}
      activeOpacity={0.92}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      onPress={onPress}
    >
      <View style={styles.navContent}>
        <View style={[styles.navIcon, { width: chipSize, height: chipSize }]} collapsable={false}>
          <Animated.View
            pointerEvents="none"
            style={[styles.activeChipAnim, { opacity: highlightOpacity }]}
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
          <Ionicons name={ioniconName} size={iconSize} color={glyphColor} />
          {badge ? <View style={styles.tabBadgeDot} /> : null}
        </View>
        <Text
          style={[styles.navLabel, { color: labelColor, fontWeight: labelWeight }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function CenterPlusButton({ topOffset, borderColor, onPress }) {
  return (
    <View style={[styles.plusWrap, { top: topOffset }]} pointerEvents="box-none">
      <HardShadow offset={nb.shadowOffsetCard} radius={PLUS_SIZE / 2}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onPress}
          style={[styles.plusHit, { borderColor }]}
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
  );
}

// ===== MAIN FUNCTION =====

/**
 * Production bottom dock — four tab slots + center + FAB.
 * Hook order frozen: merged nav → theme → safe area → AI flag → active tab state → highlight refs → effects.
 */
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
  // 1. Merge shell handlers with any props the parent passed in.
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

  // 2. Theme, safe area, and whether the AI tab slot should show.
  const { isDark: globalIsDark } = useTheme();
  const isDark = appearanceIsDark !== undefined ? appearanceIsDark : globalIsDark;
  const insets = useSafeAreaInsets();
  const { aiEnabled } = useAI();
  const showAiCoachTab = aiEnabled === true;
  const themeColors = pickDockThemeColors(isDark);

  // 3. Which tab looks selected — prop wins on first paint so remounts do not flash storage.
  const [activeTabKey, setActiveTabKey] = useState(activeTabKeyProp || DEFAULT_ACTIVE_TAB);
  const homeHighlight = useRef(new Animated.Value(0)).current;
  const workoutHighlight = useRef(new Animated.Value(0)).current;
  const filesHighlight = useRef(new Animated.Value(0)).current;
  const nutritionHighlight = useRef(new Animated.Value(0)).current;
  const aiHighlight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      runTabHighlightSpring(homeHighlight, activeTabKey === 'home'),
      runTabHighlightSpring(workoutHighlight, activeTabKey === 'workout'),
      runTabHighlightSpring(filesHighlight, activeTabKey === 'files'),
      runTabHighlightSpring(nutritionHighlight, activeTabKey === 'nutrition'),
      runTabHighlightSpring(aiHighlight, activeTabKey === 'ai'),
    ]).start();
  }, [activeTabKey, homeHighlight, workoutHighlight, filesHighlight, nutritionHighlight, aiHighlight]);

  useEffect(() => {
    if (activeTabKeyProp) {
      setActiveTabKey(activeTabKeyProp);
      return undefined;
    }

    let effectCancelled = false;
    (async () => {
      try {
        const savedTabKey = await AsyncStorage.getItem(ACTIVE_KEY_STORAGE);
        const savedKeyIsAllowed = savedTabKey && ALLOWED_TAB_KEYS.has(savedTabKey);
        if (!effectCancelled && savedKeyIsAllowed) {
          setActiveTabKey(savedTabKey);
        }
      } catch (unusedError) {
        // Ignore storage read failures — keep DEFAULT_ACTIVE_TAB.
      }
    })();

    return () => {
      effectCancelled = true;
    };
  }, [activeTabKeyProp]);

  function pressTabAndRemember(tabKey, tabHandler) {
    setActiveTabKey(tabKey);
    AsyncStorage.setItem(ACTIVE_KEY_STORAGE, tabKey).catch(() => {});
    if (typeof tabHandler === 'function') {
      tabHandler();
    }
  }

  // 4. Third slot swaps between Files and AI Coach depending on the permission flag.
  const tabSlotMaxWidth = showAiCoachTab ? '18%' : '25%';
  const thirdTabKey = showAiCoachTab ? 'ai' : 'files';
  const thirdTabLabel = showAiCoachTab ? 'AI Coach' : 'Files';
  const thirdTabIconName = showAiCoachTab ? 'sparkles' : 'document-text';
  const thirdTabHighlight = showAiCoachTab ? aiHighlight : filesHighlight;
  const thirdTabHandler = showAiCoachTab ? onVoicePress : onPlusPress;

  const plusButtonTopOffset = -PLUS_OVERHANG;
  const barMinHeight = BAR_VISUAL_HEIGHT + insets.bottom;
  const noopHandler = () => {};

  const homeIsActive = activeTabKey === 'home';
  const workoutIsActive = activeTabKey === 'workout';
  const thirdTabIsActive = activeTabKey === thirdTabKey;
  const nutritionIsActive = activeTabKey === 'nutrition';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.surface,
          borderTopColor: themeColors.border,
          paddingBottom: insets.bottom,
          minHeight: barMinHeight,
        },
      ]}
    >
      <View style={styles.row}>
        <BottomMenuTabSlot
          label="Home"
          iconName="home"
          iconSize={ICON_SIZE}
          active={homeIsActive}
          highlightOpacity={homeHighlight}
          onPress={() => pressTabAndRemember('home', onHomePress || noopHandler)}
          themeColors={themeColors}
          maxWidth={tabSlotMaxWidth}
        />
        <BottomMenuTabSlot
          label="Workout"
          iconName="barbell"
          iconSize={ICON_SIZE_WORKOUT}
          active={workoutIsActive}
          highlightOpacity={workoutHighlight}
          onPress={() => pressTabAndRemember('workout', onWorkoutPress || noopHandler)}
          themeColors={themeColors}
          badge={workoutTabBadge}
          maxWidth={tabSlotMaxWidth}
        />
        <View style={{ width: PLUS_SIZE, flexShrink: 0 }} />
        <BottomMenuTabSlot
          label={thirdTabLabel}
          iconName={thirdTabIconName}
          iconSize={ICON_SIZE}
          active={thirdTabIsActive}
          highlightOpacity={thirdTabHighlight}
          onPress={() => pressTabAndRemember(thirdTabKey, thirdTabHandler || noopHandler)}
          themeColors={themeColors}
          maxWidth={tabSlotMaxWidth}
        />
        <BottomMenuTabSlot
          label="Nutrition"
          iconName="restaurant"
          iconSize={ICON_SIZE}
          active={nutritionIsActive}
          highlightOpacity={nutritionHighlight}
          onPress={() => pressTabAndRemember('nutrition', onNutritionPress || noopHandler)}
          themeColors={themeColors}
          maxWidth={tabSlotMaxWidth}
        />
      </View>

      <CenterPlusButton
        topOffset={plusButtonTopOffset}
        borderColor={themeColors.border}
        onPress={onPlusPress}
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
