/**
 * Bottom Nav Bar
 *
 * Purpose: Bottom Nav Bar — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/navigation
 * Key exports: BottomNavBar
 *
 * @file-header
 */
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
import { useTheme } from '../shared-ui/ThemeContext';
import { useMergedNavigation } from './AppNavigationContext';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import BlurBackdropPlate from '../shared-ui/BlurBackdropPlate';
import BrandGradientIcon from '../shared/components/icons/BrandGradientIcon';
import MaskedBrandIonicon from '../shared/components/icons/MaskedBrandIonicon';
import { useAI } from '../shared/contexts/AIContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** Logo-aligned vertical gradient for all tab icons (pink → purple → indigo). */
export default function BottomNavBar({
  onPlusPress: onPlusPressProp,
  onVoicePress: onVoicePressProp,
  onNutritionPress: onNutritionPressProp,
  onProfilePress: onProfilePressProp,
  onWorkoutPress: onWorkoutPressProp,
  onHomePress: onHomePressProp,
  onMessagesPress: onMessagesPressProp,
  // Optional: force the initial highlighted tab instantly (used when screens remount).
  activeTabKey: activeTabKeyProp,
  /** Pink dot on Workout tab when a background-generated plan is ready. */
  workoutTabBadge = false,
  /** Override global theme for embedded editors (spreadsheet/document modals). */
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
    onMessagesPress,
  } = mergedNav;
  const { colors, spacing, isDark: globalIsDark } = useTheme();
  const isDark = appearanceIsDark !== undefined ? appearanceIsDark : globalIsDark;
  const insets = useSafeAreaInsets();
  const { aiEnabled } = useAI();
  const aiOn = aiEnabled === true;

  const NAV_BORDER = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const NAV_LABEL = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const NAV_LABEL_ACTIVE = isDark ? '#FFFFFF' : colors.primary;
  const INACTIVE_ICON_COLOR = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';

  // Active state for UI polish: highlighted frosted pill + subtle transition.
  // If a parent screen passes `activeTabKey`, use it immediately (no async delay).
  const [activeKey, setActiveKey] = useState(activeTabKeyProp || 'home');
  const ACTIVE_KEY_STORAGE = '@coachconnect_nav_active_key';
  const homeAnim = useRef(new Animated.Value(0)).current;
  const workoutAnim = useRef(new Animated.Value(0)).current;
  const filesAnim = useRef(new Animated.Value(0)).current;
  const nutritionAnim = useRef(new Animated.Value(0)).current;
  const aiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const to01 = (b) => (b ? 1 : 0);
    Animated.parallel([
      Animated.spring(homeAnim, { toValue: to01(activeKey === 'home'), friction: 8, useNativeDriver: true }),
      Animated.spring(workoutAnim, { toValue: to01(activeKey === 'workout'), friction: 8, useNativeDriver: true }),
      Animated.spring(filesAnim, { toValue: to01(activeKey === 'files'), friction: 8, useNativeDriver: true }),
      Animated.spring(nutritionAnim, { toValue: to01(activeKey === 'nutrition'), friction: 8, useNativeDriver: true }),
      Animated.spring(aiAnim, { toValue: to01(activeKey === 'ai'), friction: 8, useNativeDriver: true }),
    ]).start();
  }, [activeKey, homeAnim, workoutAnim, filesAnim, nutritionAnim, aiAnim]);

  // Persist active tab so the frosted/blur highlight doesn't reset to "home"
  // if the app remounts the nav bar while switching screens.
  useEffect(() => {
    if (activeTabKeyProp) {
      setActiveKey(activeTabKeyProp);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(ACTIVE_KEY_STORAGE);
        if (cancelled) return;
        const allowed = new Set(['home', 'workout', 'files', 'nutrition', 'ai']);
        if (saved && allowed.has(saved)) setActiveKey(saved);
      } catch (_) {
        // ignore storage failures
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeTabKeyProp]);

  const styles = StyleSheet.create({
    container: {
      borderTopWidth: 1,
      borderTopColor: NAV_BORDER,
      backgroundColor: isDark ? 'rgba(12,12,18,0.55)' : 'rgba(255,255,255,0.55)',
      minHeight: 80 + insets.bottom,
      alignItems: 'stretch',
      justifyContent: 'flex-end',
      paddingHorizontal: 0,
      position: 'relative',
      zIndex: 100,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 24,
    },
    navItem: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      borderRadius: 16,
      paddingHorizontal: 0,
      flex: 1,
      maxWidth: '18%',
    },
    navIcon: {
      marginBottom: spacing.xs / 2,
      marginTop: 0,
    },
    navContent: {
      zIndex: 2,
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    navLabel: {
      fontSize: 10,
      color: NAV_LABEL,
      fontWeight: '600',
      letterSpacing: 0.3,
      marginTop: 2,
    },
    navLabelBase: {
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.3,
      marginTop: 2,
    },
    plusButton: {
      width: 56,
      height: 56,
      marginBottom: spacing.md,
      position: 'absolute',
      left: '50%',
      marginLeft: -28,
      zIndex: 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    plusFab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    activeBgWrap: {
      position: 'absolute',
      top: 0,
      left: 4,
      right: 4,
      bottom: 0,
      borderRadius: 18,
      overflow: 'hidden',
      zIndex: 1,
    },
    activeBg: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 18,
    },
    activeShine: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    tabBadgeDot: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#FF6B9D',
      borderWidth: 1.5,
      borderColor: 'rgba(255,255,255,0.95)',
    },
  });

  const containerBlurIntensity = isDark ? 28 : 18;
  const containerTint = isDark ? 'dark' : 'light';
  const containerTintColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';

  /** BlurBackdropPlate wraps children in an inner View; it must repeat the row flex from `styles.container` or tabs stack vertically. */
  const navPlateContentStyle = {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    position: 'relative',
    minWidth: 0,
    paddingTop: spacing.sm,
    paddingBottom: insets.bottom,
    minHeight: 80 + insets.bottom,
  };

  const activate = (key, handler) => {
    setActiveKey(key);
    AsyncStorage.setItem(ACTIVE_KEY_STORAGE, key).catch(() => {});
    if (handler && typeof handler === 'function') handler();
  };

  // Non‑AI users: simple 4-tab bar (no floating center button)
  if (!aiOn) {
    return (
      <BlurBackdropPlate
        intensity={containerBlurIntensity}
        tint={containerTint}
        style={styles.container}
        contentWrapperStyle={navPlateContentStyle}
      >
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />

        <TouchableOpacity
          style={[styles.navItem, { maxWidth: '25%' }]}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => activate('home', onHomePress || (() => {}))}
        >
          <Animated.View style={[styles.activeBgWrap, { opacity: homeAnim }]} pointerEvents="none">
            <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
            <LinearGradient
              colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeShine}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={styles.navContent}>
            <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
              <BrandGradientIcon name="home" size={36} />
            </View>
            <Text
              style={[
                styles.navLabelBase,
                styles.navLabel,
                { color: activeKey === 'home' ? NAV_LABEL_ACTIVE : NAV_LABEL },
              ]}
            >
              Home
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, { maxWidth: '25%' }]}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => activate('workout', onWorkoutPress || (() => {}))}
        >
          <Animated.View style={[styles.activeBgWrap, { opacity: workoutAnim }]} pointerEvents="none">
            <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
            <LinearGradient
              colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeShine}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={styles.navContent}>
            <View style={[styles.navIcon, { width: 44, height: 44 }]} collapsable={false}>
              <BrandGradientIcon name="barbell" size={44} strokeWidth={2.35} />
              {workoutTabBadge ? <View style={styles.tabBadgeDot} /> : null}
            </View>
            <Text
              style={[
                styles.navLabelBase,
                styles.navLabel,
                { color: activeKey === 'workout' ? NAV_LABEL_ACTIVE : NAV_LABEL },
              ]}
            >
              Workout
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, { maxWidth: '25%' }]}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => activate('files', onPlusPress || (() => {}))}
        >
          <Animated.View style={[styles.activeBgWrap, { opacity: filesAnim }]} pointerEvents="none">
            <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
            <LinearGradient
              colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeShine}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={styles.navContent}>
            <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
              <BrandGradientIcon name="document-text" size={36} />
            </View>
            <Text
              style={[
                styles.navLabelBase,
                styles.navLabel,
                { color: activeKey === 'files' ? NAV_LABEL_ACTIVE : NAV_LABEL },
              ]}
            >
              Files
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navItem, { maxWidth: '25%' }]}
          activeOpacity={0.85}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => activate('nutrition', onNutritionPress || (() => {}))}
        >
          <Animated.View style={[styles.activeBgWrap, { opacity: nutritionAnim }]} pointerEvents="none">
            <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
            <LinearGradient
              colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeShine}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={styles.navContent}>
            <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
              <BrandGradientIcon name="restaurant" size={36} />
            </View>
            <Text
              style={[
                styles.navLabelBase,
                styles.navLabel,
                activeKey === 'nutrition' && { fontWeight: '800' },
                { color: activeKey === 'nutrition' ? NAV_LABEL_ACTIVE : NAV_LABEL },
              ]}
            >
              Nutrition
            </Text>
          </View>
        </TouchableOpacity>
      </BlurBackdropPlate>
    );
  }

  return (
    <BlurBackdropPlate
      intensity={containerBlurIntensity}
      tint={containerTint}
      style={styles.container}
      contentWrapperStyle={navPlateContentStyle}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      {/* Left Side - 3 items */}
      {/* Home */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.85}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => activate('home', onHomePress || (() => {}))}
      >
        <Animated.View style={[styles.activeBgWrap, { opacity: homeAnim }]} pointerEvents="none">
          <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
          <LinearGradient
            colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeShine}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={styles.navContent}>
          <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
            <BrandGradientIcon name="home" size={36} />
          </View>
          <Text
            style={[
              styles.navLabelBase,
              styles.navLabel,
              { color: activeKey === 'home' ? NAV_LABEL_ACTIVE : NAV_LABEL },
            ]}
          >
            Home
          </Text>
        </View>
      </TouchableOpacity>

      {/* Workout */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.85}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => activate('workout', onWorkoutPress || (() => {}))}
      >
        <Animated.View style={[styles.activeBgWrap, { opacity: workoutAnim }]} pointerEvents="none">
          <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
          <LinearGradient
            colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeShine}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={styles.navContent}>
          <View style={[styles.navIcon, { width: 44, height: 44 }]} collapsable={false}>
            <BrandGradientIcon name="barbell" size={44} strokeWidth={2.35} />
            {workoutTabBadge ? <View style={styles.tabBadgeDot} /> : null}
          </View>
          <Text
            style={[
              styles.navLabelBase,
              styles.navLabel,
              { color: activeKey === 'workout' ? NAV_LABEL_ACTIVE : NAV_LABEL },
            ]}
          >
            Workout
          </Text>
        </View>
      </TouchableOpacity>

      {/* Spacer — matches the 56px plus button so adjacent tabs stay tappable */}
      <View style={{ width: 56, flexShrink: 0 }} />

      {/* Right Side - 3 items */}
      {/* AI Coach */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.85}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => activate('ai', onVoicePress || (() => {}))}
      >
        <Animated.View style={[styles.activeBgWrap, { opacity: aiAnim }]} pointerEvents="none">
          <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
          <LinearGradient
            colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeShine}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={styles.navContent}>
          <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
            <MaskedBrandIonicon name="sparkles" size={36} />
          </View>
          <Text
            style={[
              styles.navLabelBase,
              styles.navLabel,
              { color: activeKey === 'ai' ? NAV_LABEL_ACTIVE : NAV_LABEL },
            ]}
          >
            AI Coach
          </Text>
        </View>
      </TouchableOpacity>

      {/* Nutrition */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.85}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => activate('nutrition', onNutritionPress || (() => {}))}
      >
        <Animated.View style={[styles.activeBgWrap, { opacity: nutritionAnim }]} pointerEvents="none">
          <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
          <LinearGradient
            colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.activeShine}
            pointerEvents="none"
          />
        </Animated.View>

        <View style={styles.navContent}>
          <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
            <BrandGradientIcon name="restaurant" size={36} />
          </View>
          <Text
            style={[
              styles.navLabelBase,
              styles.navLabel,
              { color: activeKey === 'nutrition' ? NAV_LABEL_ACTIVE : NAV_LABEL },
            ]}
          >
            Nutrition
          </Text>
        </View>
      </TouchableOpacity>

      {/* Center primary action — plus (no logo image in tab bar) */}
      <TouchableOpacity
        style={styles.plusButton}
        onPress={onPlusPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#E94EAD', '#A348D0', '#6B3AD9']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.plusFab}
        >
          <Ionicons name="add" size={38} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </BlurBackdropPlate>
  );
}
