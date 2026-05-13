import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../shared/ui/ThemeContext';
import { useMergedNavigation } from './AppNavigationContext';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import BlurBackdropPlate from '../shared/ui/BlurBackdropPlate';
import GradientGeminiNavIcon from '../shared/components/GradientGeminiNavIcon';
import { useAI } from '../contexts/AIContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../shared/ui/brandGradients';

/** Logo-aligned vertical gradient for all tab icons (pink → purple → indigo). */
const BrandGradientIcon = ({
  name,
  size = 36,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) => (
  <MaskedView
    style={{ width: size, height: size }}
    maskElement={
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <Ionicons name={name} size={size} color="#000" />
      </View>
    }
  >
    <LinearGradient
      colors={colors}
      locations={locations}
      start={start}
      end={end}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

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
}) {
  // Use props directly if provided, otherwise fall back to context
  const directProps = {
    onHomePress: onHomePressProp,
    onPlusPress: onPlusPressProp,
    onVoicePress: onVoicePressProp,
    onNutritionPress: onNutritionPressProp,
    onWorkoutPress: onWorkoutPressProp,
    onProfilePress: onProfilePressProp,
    onMessagesPress: onMessagesPressProp,
  };
  
  // If all required props are provided, use them directly (no context lookup)
  const hasAllProps = Object.values(directProps).every(prop => prop && typeof prop === 'function');

  const mergedNav = useMergedNavigation(directProps);
  const {
    onHomePress,
    onPlusPress,
    onVoicePress,
    onNutritionPress,
    onWorkoutPress,
    onMessagesPress,
  } = hasAllProps ? directProps : mergedNav;
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { aiEnabled } = useAI();
  const aiOn = aiEnabled === true;

  const NAV_BORDER = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const NAV_LABEL = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.78)';
  const NAV_LABEL_ACTIVE = colors.primary;
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
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: NAV_BORDER,
      backgroundColor: isDark ? 'rgba(12,12,18,0.55)' : 'rgba(255,255,255,0.55)',
      paddingBottom: insets.bottom,
      paddingTop: spacing.sm,
      minHeight: 80 + insets.bottom,
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingHorizontal: 0,
      position: 'relative',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 12,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
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
    },
    navLabelBase: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    plusButton: {
      width: 64,
      height: 64,
      marginBottom: spacing.md,
      position: 'absolute',
      left: '50%',
      marginLeft: -32,
      zIndex: 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
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
  });

  const containerBlurIntensity = isDark ? 28 : 18;
  const containerTint = isDark ? 'dark' : 'light';
  const containerTintColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';

  /** BlurBackdropPlate wraps children in an inner View; it must repeat the row flex from `styles.container` or tabs stack vertically. */
  const navPlateContentStyle = {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    position: 'relative',
    minWidth: 0,
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
            <View style={styles.navIcon}>
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
            <View style={styles.navIcon}>
              <BrandGradientIcon name="barbell" size={36} />
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
            <View style={styles.navIcon}>
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
            <View style={styles.navIcon}>
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
          <View style={styles.navIcon}>
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
          <View style={styles.navIcon}>
            <BrandGradientIcon name="barbell" size={36} />
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

      {/* Spacer — keep at 64 so gap next to plus matches other icons */}
      <View style={{ width: 64, flexShrink: 0 }} />

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
          <View style={styles.navIcon}>
            <GradientGeminiNavIcon size={36} />
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
          <View style={styles.navIcon}>
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
