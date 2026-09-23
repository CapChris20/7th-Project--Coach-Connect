// The frosted tab bar pinned to the bottom of both app shells.
// Flow: resolve tap handlers (props → navigation context) → remember which tab is active (state + AsyncStorage)
//       → animate a highlight pill under it → render one of two layouts depending on whether AI is enabled.
// Rendered by the client/trainer shells via ShellBottomNavAnchor; it floats over content, so screens
// reserve space for it with useShellBottomNavInset (see bottomMenuSpacing.js).

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
import { useTheme } from '../look-and-feel/lightDarkMode';
import { useMergedNavigation } from './whichScreenIsOpen';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import BlurredBackground from '../look-and-feel/BlurredBackground';
import ColorfulIcon from '../for-both/icons/ColorfulIcon';
import WorkoutTabIcon from '../for-both/icons/WorkoutTabIcon';
import { useAI } from '../for-both/app-wide-settings/AIPermission';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Every handler prop is renamed to *Prop on the way in. That's deliberate: the same names come back
// out of useMergedNavigation below, and this keeps "what the parent passed" separate from "what we
// actually call" — the merge decides which wins (prop first, then context).
export default function BottomMenuBar({
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
  // Local override beats the global theme. `!== undefined` (not a truthy check) because `false` is a
  // meaningful value here — an embedded editor forcing light mode must not fall through to global.
  const isDark = appearanceIsDark !== undefined ? appearanceIsDark : globalIsDark;
  const insets = useSafeAreaInsets();
  // AI is a feature flag: when it's off, the whole layout below changes from 5 tabs + center button
  // to a plain 4-tab bar. `=== true` guards against the context briefly returning undefined at boot.
  const { aiEnabled } = useAI();
  const aiOn = aiEnabled === true;

  // Theme-dependent colors computed once per render.
  // Manipulate here: rgba(255,255,255,0.55) is white at 55% opacity — that's how muted text and
  // hairline borders are done on the dark theme. Raise the last number for more contrast.
  const NAV_BORDER = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const NAV_LABEL = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)';
  const NAV_LABEL_ACTIVE = isDark ? '#FFFFFF' : colors.primary;
  const INACTIVE_ICON_COLOR = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';

  // Which tab shows the frosted highlight pill. Seeded from the prop when a screen knows the answer
  // synchronously — otherwise the AsyncStorage effect below fills it in, and starting from storage
  // alone would make the highlight visibly jump from 'home' to the real tab.
  const [activeKey, setActiveKey] = useState(activeTabKeyProp || 'home');
  const ACTIVE_KEY_STORAGE = '@coachconnect_nav_active_key';

  // One animated value per tab, each 0 (hidden) → 1 (highlight visible).
  // vocab: Animated.Value = a number the native animation system owns; changing it repaints without
  // a React re-render. useRef(...).current keeps the SAME value object across renders — recreating
  // it every render would reset the animation mid-flight.
  const homeAnim = useRef(new Animated.Value(0)).current;
  const workoutAnim = useRef(new Animated.Value(0)).current;
  const filesAnim = useRef(new Animated.Value(0)).current;
  const nutritionAnim = useRef(new Animated.Value(0)).current;
  const aiAnim = useRef(new Animated.Value(0)).current;

  // Whenever the active tab changes, drive every pill at once: the new one toward 1, all others
  // toward 0. Running them in parallel is what makes the highlight look like it slides across
  // rather than popping off one tab and onto another.
  useEffect(() => {
    const to01 = (b) => (b ? 1 : 0);
    // vocab: Animated.parallel = start these animations together; .start() kicks them off.
    Animated.parallel([
      // vocab: Animated.spring = physics-based easing, not a fixed duration.
      // Manipulate here: friction 8 controls the bounce — lower is springier/wobblier, higher is
      // stiffer and settles faster. useNativeDriver: true runs it on the UI thread so the highlight
      // stays smooth even while JS is busy (only works for opacity/transform, which is all we animate).
      Animated.spring(homeAnim, { toValue: to01(activeKey === 'home'), friction: 8, useNativeDriver: true }),
      Animated.spring(workoutAnim, { toValue: to01(activeKey === 'workout'), friction: 8, useNativeDriver: true }),
      Animated.spring(filesAnim, { toValue: to01(activeKey === 'files'), friction: 8, useNativeDriver: true }),
      Animated.spring(nutritionAnim, { toValue: to01(activeKey === 'nutrition'), friction: 8, useNativeDriver: true }),
      Animated.spring(aiAnim, { toValue: to01(activeKey === 'ai'), friction: 8, useNativeDriver: true }),
    ]).start();
  }, [activeKey, homeAnim, workoutAnim, filesAnim, nutritionAnim, aiAnim]);

  // Restore the highlight after a remount. The shells tear this bar down and rebuild it when
  // switching screens, and without persistence the highlight would snap back to "home" every time
  // even though the user is standing on Nutrition.
  useEffect(() => {
    // A parent that tells us the tab outright is authoritative — skip storage entirely.
    if (activeTabKeyProp) {
      setActiveKey(activeTabKeyProp);
      return;
    }

    // Guard against the read finishing after unmount (setting state then is a React warning).
    let cancelled = false;
    const load = async () => {
      try {
        const saved = await AsyncStorage.getItem(ACTIVE_KEY_STORAGE);
        if (cancelled) return;
        // Whitelist: storage is untrusted (stale key from an older build with different tabs), and
        // an unrecognized value would leave every pill at 0 with no tab looking selected.
        // Manipulate here: adding a tab means adding its key to this set too.
        const allowed = new Set(['home', 'workout', 'files', 'nutrition', 'ai']);
        if (saved && allowed.has(saved)) setActiveKey(saved);
      } catch (_) {
        // ignore storage failures — worst case the highlight starts on 'home'
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeTabKeyProp]);

  // Styles live inside the component (not module scope) because nearly every value depends on the
  // theme or the device's safe-area inset — both of which can change at runtime.
  const styles = StyleSheet.create({
    container: {
      borderTopWidth: 1,
      borderTopColor: NAV_BORDER,
      // Semi-transparent on purpose: the blur plate behind it needs something to show through.
      // Manipulate here: raise 0.55 toward 1 for a more solid bar (and a weaker frosted look).
      backgroundColor: isDark ? 'rgba(12,12,18,0.55)' : 'rgba(255,255,255,0.55)',
      // 80 = the visual bar height (kept in sync with BOTTOM_NAV_BAR_HEIGHT in bottomMenuSpacing.js);
      // + insets.bottom grows it to cover the home-indicator strip so the bar reaches the screen edge.
      minHeight: 80 + insets.bottom,
      alignItems: 'stretch',
      justifyContent: 'flex-end',
      paddingHorizontal: 0,
      position: 'relative',
      zIndex: 100,
      // Clips the blur and the highlight pills to the bar's rounded bounds.
      overflow: 'hidden',
      // Negative height = shadow cast UPWARD onto the content above, which is what visually lifts
      // the bar off the page. elevation is the Android equivalent (iOS uses the shadow* trio).
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
      // flex: 1 = share the row evenly; maxWidth caps each tab so labels can't crowd the center
      // button on wide screens. Manipulate here: 18% suits the 5-tab AI layout; the 4-tab layout
      // overrides it to 25% inline below.
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
      // The classic centering trick: push the left edge to the middle of the bar, then pull back by
      // half the button's width. Manipulate here: marginLeft must always be -(width / 2) — change
      // 56 and this must become -(new width / 2) or the button drifts off-center.
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
    // The highlight pill behind the active tab. zIndex 1 puts it under navContent (zIndex 2) so the
    // icon and label stay readable on top of it.
    // Manipulate here: left/right 4 is the gap between neighbouring pills; borderRadius 18 its roundness.
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
      // vocab: StyleSheet.absoluteFillObject = shorthand for position absolute + top/left/right/bottom 0,
      // i.e. "stretch to completely fill my parent".
      ...StyleSheet.absoluteFillObject,
      borderRadius: 18,
    },
    activeShine: {
      ...StyleSheet.absoluteFillObject,
      opacity: 0.85,
    },
    // Small pink dot on the Workout icon when a background-generated plan is waiting.
    // The white border is what keeps it visible against a dark icon underneath.
    // Manipulate here: borderRadius must stay ≈ half of width/height to remain a circle.
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

  // vocab: blur "intensity" = how strongly the backdrop is frosted (0–100); "tint" tells the blur
  // whether to lean light or dark. Dark mode needs a higher intensity to read as frosted at all.
  // Manipulate here: raise for a milkier bar, lower to see more of the content scrolling behind it.
  const containerBlurIntensity = isDark ? 28 : 18;
  const containerTint = isDark ? 'dark' : 'light';
  // An extra flat wash laid over the blur to deepen contrast behind the labels.
  const containerTintColor = isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.35)';

  // BlurredBackground puts its children inside an extra wrapper View, and that wrapper does NOT
  // inherit the flex settings from `styles.container`. Without repeating them here the tabs lay out
  // vertically instead of in a row — this is the fix for that, not a duplicate by accident.
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

  // Every tab press funnels through here so the highlight, the saved key, and the actual navigation
  // can never drift apart. Order matters: update the UI first so the pill moves instantly, then
  // persist (fire-and-forget), then hand off to the shell's handler.
  const activate = (key, handler) => {
    setActiveKey(key);
    AsyncStorage.setItem(ACTIVE_KEY_STORAGE, key).catch(() => {});
    if (handler && typeof handler === 'function') handler();
  };

  // --- Layout A: AI disabled -> 4 evenly spaced tabs, no floating center button ---------------
  // This is a separate return (rather than conditional bits inside one tree) because the center
  // button changes the spacing of everything around it.
  if (!aiOn) {
    return (
      // vocab: BlurredBackground = our wrapper around expo-blur that frosts whatever is behind it.
      <BlurredBackground
        intensity={containerBlurIntensity}
        tint={containerTint}
        style={styles.container}
        contentWrapperStyle={navPlateContentStyle}
      >
        {/* Flat color wash over the blur. pointerEvents="none" is essential on every decorative
            layer in this file — without it this full-size View would swallow all tab taps. */}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />

        {/* The four tabs below all share one structure, explained once here:
              TouchableOpacity (the tap target, with hitSlop to grow it past the icon)
                Animated.View  -> the highlight pill; its opacity IS that tab's animated value
                  BlurView + LinearGradient -> the frosted look + a diagonal sheen
                View navContent -> the icon and label that sit on top
            maxWidth 25% overrides the 18% default so four tabs fill the bar evenly. */}
        <TouchableOpacity
          style={[styles.navItem, { maxWidth: '25%' }]}
          // Manipulate here: activeOpacity is how dim the tab goes while held (1 = no feedback).
          activeOpacity={0.85}
          // hitSlop extends the tappable area 10px beyond the visual bounds on all sides — small
          // icons are otherwise genuinely hard to hit near the screen edge.
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          // `|| (() => {})` so a shell that doesn't implement this destination still moves the
          // highlight instead of crashing on an undefined call.
          onPress={() => activate('home', onHomePress || (() => {}))}
        >
          <Animated.View style={[styles.activeBgWrap, { opacity: homeAnim }]} pointerEvents="none">
            {/* Manipulate here: 58/44 is the pill's own blur strength — stronger than the bar's so
                the active tab reads as raised out of it. */}
            <BlurView intensity={isDark ? 58 : 44} tint={containerTint} style={styles.activeBg} pointerEvents="none" />
            {/* Diagonal indigo sheen: start/end are 0–1 coordinates across the box, so {0,0}→{1,1}
                runs top-left to bottom-right. Fading to 'transparent' keeps it a soft glow.
                Manipulate here: rgba(88,86,214,…) is the indigo; the 0.18/0.04 stops are its strength. */}
            <LinearGradient
              colors={isDark ? ['rgba(88,86,214,0.18)', 'rgba(88,86,214,0.04)', 'transparent'] : ['rgba(88,86,214,0.14)', 'rgba(88,86,214,0.03)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeShine}
              pointerEvents="none"
            />
          </Animated.View>

          <View style={styles.navContent}>
            {/* collapsable={false} keeps this wrapper as a real native view on Android. React Native
                otherwise optimizes away layout-only views, and the gradient icon inside needs a real
                host view to mask against. */}
            <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
              {/* ColorfulIcon paints the shared pink→purple→indigo gradient into an Ionicon shape. */}
              <ColorfulIcon name="home" size={36} />
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

        {/* Workout — same structure as Home. Its icon is drawn larger (44 vs 36) because the
            barbell glyph reads visually smaller at the same nominal size. */}
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
            {/* Manipulate here: strokeWidth 2.35 thickens the barbell outline so it doesn't look
                thinner than the other icons at this larger size. */}
            <View style={[styles.navIcon, { width: 44, height: 44 }]} collapsable={false}>
              <ColorfulIcon name="barbell" size={44} strokeWidth={2.35} />
              {/* The "your generated plan is ready" dot. `? … : null` rather than `&&` because a
                  falsy `&&` in JSX can try to render a stray value instead of nothing. */}
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

        {/* Files — note it fires onPlusPress. In the AI layout that handler opens the center "+"
            create sheet; with AI off there's no center button, so the same action lives on this tab. */}
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
              <ColorfulIcon name="document-text" size={36} />
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

        {/* Nutrition — last tab of the AI-off layout. */}
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
              <ColorfulIcon name="restaurant" size={36} />
            </View>
            <Text
              style={[
                styles.navLabelBase,
                styles.navLabel,
                // Later entries win in a style array, which is how the active color overrides the
                // muted one below. Manipulate here: this extra bold-when-active is unique to this
                // label — add the same line to the others if you want it everywhere.
                activeKey === 'nutrition' && { fontWeight: '800' },
                { color: activeKey === 'nutrition' ? NAV_LABEL_ACTIVE : NAV_LABEL },
              ]}
            >
              Nutrition
            </Text>
          </View>
        </TouchableOpacity>
      </BlurredBackground>
    );
  }

  // --- Layout B: AI enabled -> Home | Workout | (gap) | AI Coach | Nutrition, with a floating "+"
  // button absolutely positioned over the gap. Same tab structure as Layout A above; the difference
  // is the spacer + center button and that tabs use the default 18% maxWidth.
  return (
    <BlurredBackground
      intensity={containerBlurIntensity}
      tint={containerTint}
      style={styles.container}
      contentWrapperStyle={navPlateContentStyle}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: containerTintColor }]} pointerEvents="none" />
      {/* Left Side - 3 items */}
      {/* Home */}
      {/* Each tab below repeats the structure documented on the Home tab in Layout A:
          touch target → animated highlight pill (blur + sheen) → icon and label on top. */}
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
            <ColorfulIcon name="home" size={36} />
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
            <ColorfulIcon name="barbell" size={44} strokeWidth={2.35} />
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

      {/* Invisible spacer holding open the slot the floating "+" occupies. The button itself is
          position:absolute and takes up no layout space, so without this the Workout and AI tabs
          would slide under it and their taps would be stolen by the button on top.
          Manipulate here: this width must match plusButton's width (56) exactly.
          flexShrink: 0 stops flexbox from squeezing it on narrow screens. */}
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
          {/* WorkoutTabIcon (not ColorfulIcon) here: the sparkles glyph is filled rather
              than outlined, so it needs the masked variant to take the brand gradient correctly. */}
          <View style={[styles.navIcon, { width: 36, height: 36 }]} collapsable={false}>
            <WorkoutTabIcon name="sparkles" size={36} />
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
            <ColorfulIcon name="restaurant" size={36} />
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

      {/* Center primary action. Rendered LAST in the tree so it paints on top of the tabs it
          overlaps. It deliberately doesn't call activate(): it opens a create sheet rather than
          switching tabs, so the highlight must stay where the user left it. */}
      <TouchableOpacity
        style={styles.plusButton}
        onPress={onPlusPress}
        activeOpacity={0.8}
      >
        {/* The brand gradient, pink → purple → indigo. start/end both at x 0.5 with y 0 → 1 makes it
            run straight down (a vertical gradient); shifting x would tilt it.
            Manipulate here: these three hex stops are the app's signature colors — the same ramp the
            logo and ColorfulIcon use, so changing them here alone breaks that alignment. */}
        <LinearGradient
          colors={['#E94EAD', '#A348D0', '#6B3AD9']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.plusFab}
        >
          {/* Plain white Ionicon — no gradient, since the button behind it already carries it. */}
          <Ionicons name="add" size={38} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </BlurredBackground>
  );
}
