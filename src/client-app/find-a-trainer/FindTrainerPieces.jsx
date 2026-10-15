// Shared marketplace chrome: pills, buttons, glass cards, the aurora wash, and the verified badge.
// Flow: each piece paints one bit of the Find-a-Trainer screens so browse, filters, and profile match.
// Used by BrowseTrainersScreen, FilterPopup, and TrainerProfilePopup.

import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BaseColorText from '../../look-and-feel/ColorText';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { BRAND, AURORA_GLOWS, MP_FONT, getTheme } from './trainerFilters';
import { FrostedPanel } from './FrostedPanel';
import BlurredBackground from '../../look-and-feel/BlurredBackground';

// ===== NAMED CONSTANTS =====

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SCALE = 0.99;
const PRESS_LIFT = -4;
const SPRING_DAMPING = 14;
const SPRING_STIFFNESS = 220;
const CARD_LIFT_SHADOW_RADIUS = 24;
const DEFAULT_CARD_RADIUS = 22;
const DEFAULT_PANEL_RADIUS = 16;
const AURORA_BLUR_DARK = 72;
const AURORA_BLUR_LIGHT = 56;
const PILL_BLUR_DARK = 28;
const PILL_BLUR_LIGHT = 22;

const glow = Platform.select({
  ios: {
    shadowColor: BRAND.pink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
  },
  android: { elevation: 10 },
  default: {},
});

const pillActiveGlow = Platform.select({
  ios: {
    shadowColor: BRAND.pink,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  android: { elevation: 4 },
  default: {},
});

const cardLiftShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: CARD_LIFT_SHADOW_RADIUS,
  },
  android: { elevation: 12 },
  default: {},
});

// ===== HELPER FUNCTIONS =====

function foregroundForTheme(isDark) {
  return isDark ? '#F5F5F7' : '#18181F';
}

const cardShadow = (isDark) =>
  Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: isDark ? 0.32 : 0.08,
      shadowRadius: 18,
    },
    android: { elevation: isDark ? 6 : 4 },
    default: {},
  });

/** Solid card + subtle 1px border (screenshot / web .glass-card — no rainbow rim). */
function CardSurface({ children, isDark = true, contentStyle, style, borderRadius = DEFAULT_CARD_RADIUS }) {
  const theme = getTheme(isDark);

  return (
    <View
      style={[
        ui.cardMargin,
        style,
        cardShadow(isDark),
        {
          borderRadius,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.card,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={[ui.cardPad, contentStyle]}>{children}</View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Pink → orange gradient text (web .text-gradient).
 * @param {{ children: *, style?: object, colors?: string[] }} props
 */
export function ColorText({
  children,
  style,
  colors = [BRAND.pink, BRAND.orange],
}) {
  const textStyle = [style, { fontFamily: style?.fontFamily || MP_FONT.displayBold }];
  return (
    <BaseColorText colors={colors} style={textStyle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      {children}
    </BaseColorText>
  );
}

/**
 * Web .hero-aurora — soft blobs + blur plate for CSS blur(120px) feel.
 * @param {{ isDark?: boolean, style?: object }} props
 */
export function HeroAurora({ isDark = true, style }) {
  const auroraGlows = isDark ? AURORA_GLOWS.dark : AURORA_GLOWS.light;
  return (
    <View style={[aurora.wrap, style]} pointerEvents="none">
      <BlurredBackground
        intensity={isDark ? AURORA_BLUR_DARK : AURORA_BLUR_LIGHT}
        tint={isDark ? 'dark' : 'light'}
        style={aurora.blurWash}
      >
        <View style={{ flex: 1 }} />
      </BlurredBackground>
      <LinearGradient colors={[auroraGlows.pink, 'transparent']} style={[aurora.blob, aurora.blobPink]} />
      <LinearGradient colors={[auroraGlows.purple, 'transparent']} style={[aurora.blob, aurora.blobPurple]} />
      <LinearGradient colors={[auroraGlows.cyan, 'transparent']} style={[aurora.blob, aurora.blobCyan]} />
    </View>
  );
}

/**
 * Specialty / sort pill. Active pills glow; idle pills sit on frosted glass.
 * The `t` key is the marketplace theme object — callers already pass that name.
 * @param {{ label: string, active: boolean, onPress: Function, t: object, isDark?: boolean }} props
 */
export function Pill({ label, active, onPress, t: theme, isDark = true }) {
  if (active) {
    return (
      <Pressable
        onPress={onPress}
        style={[
          ui.pill,
          pillActiveGlow,
          {
            borderColor: `${BRAND.orange}73`,
            backgroundColor: `${BRAND.pink}33`,
          },
        ]}
      >
        <Text style={[ui.pillText, { color: theme.foreground }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={ui.pillHit}>
      <FrostedPanel
        isDark={isDark}
        borderRadius={999}
        intensity={isDark ? PILL_BLUR_DARK : PILL_BLUR_LIGHT}
        style={ui.pillGlass}
        contentStyle={ui.pillInner}
      >
        <Text style={[ui.pillText, { color: theme.mutedForeground }]}>{label}</Text>
      </FrostedPanel>
    </Pressable>
  );
}

/**
 * Pink→orange filled button used for Connect / Apply.
 * @param {{ children: *, onPress: Function, style?: object, disabled?: boolean, icon?: string }} props
 */
export function PrimaryButton({ children, onPress, style, disabled, icon }) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[style, disabled && { opacity: 0.6 }, { minWidth: 0 }]}
    >
      <LinearGradient
        colors={[BRAND.pink, BRAND.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[ui.primaryBtn, glow]}
      >
        {icon ? <Ionicons name={icon} size={16} color="#fff" style={{ marginRight: 6 }} /> : null}
        <Text style={ui.primaryBtnText} numberOfLines={2}>
          {children}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

/**
 * Outlined button used for Message / Reset / Report.
 * @param {{ children: *, onPress: Function, style?: object, textColor?: string, disabled?: boolean, icon?: string, isDark?: boolean }} props
 */
export function SecondaryButton({ children, onPress, style, textColor, disabled, icon, isDark = true }) {
  const border = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(20, 20, 40, 0.12)';
  const buttonBackground = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(248, 248, 252, 1)';

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[style, disabled && { opacity: 0.6 }, { minWidth: 0 }]}
    >
      <View style={[ui.secondarySolid, { borderColor: border, backgroundColor: buttonBackground }]}>
        {icon ? (
          <Ionicons name={icon} size={16} color={textColor || foregroundForTheme(isDark)} style={{ marginRight: 6 }} />
        ) : null}
        <Text style={[ui.secondaryBtnText, { color: textColor || foregroundForTheme(isDark) }]} numberOfLines={2}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Compact gradient chip that opens the filter sheet.
 * @param {{ onPress: Function, label?: string }} props
 */
export function FilterColorButton({ onPress, label = 'Filter' }) {
  return (
    <Pressable onPress={onPress} style={glow}>
      <LinearGradient
        colors={[BRAND.pink, BRAND.orange]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={ui.filterGradBtn}
      >
        <Ionicons name="options-outline" size={14} color="#fff" />
        <Text style={ui.filterGradText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

/**
 * Uppercase pink section label (About, Specialties, Filters).
 * @param {{ children: * }} props
 */
export function SectionLabel({ children }) {
  return <Text style={ui.sectionLabel}>{children}</Text>;
}

/**
 * Small cyan "Verified" chip on trainer cards and the profile sheet.
 */
export function VerifiedBadge() {
  return (
    <View style={ui.verifiedBadge}>
      <Ionicons name="shield-checkmark" size={11} color={BRAND.cyan} />
      <Text style={ui.verifiedText}>Verified</Text>
    </View>
  );
}

/**
 * Marketplace cards — screenshot-style border, optional press lift.
 * vocab: useSharedValue / withSpring = Reanimated values that run on the UI thread.
 * @param {{ children: *, style?: object, isDark?: boolean, contentStyle?: object, interactive?: boolean }} props
 */
export function GlassCard({
  children,
  style,
  isDark = true,
  contentStyle,
  interactive = false,
}) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(PRESS_SCALE, { damping: SPRING_DAMPING, stiffness: SPRING_STIFFNESS });
    translateY.value = withSpring(PRESS_LIFT, { damping: SPRING_DAMPING, stiffness: SPRING_STIFFNESS });
  };
  const onPressOut = () => {
    scale.value = withSpring(1, { damping: SPRING_DAMPING, stiffness: SPRING_STIFFNESS });
    translateY.value = withSpring(0, { damping: SPRING_DAMPING, stiffness: SPRING_STIFFNESS });
  };

  const card = (
    <CardSurface
      isDark={isDark}
      contentStyle={contentStyle}
      style={[interactive ? { marginBottom: 0 } : null, style]}
    >
      {children}
    </CardSurface>
  );

  if (!interactive) return card;

  return (
    <AnimatedPressable onPressIn={onPressIn} onPressOut={onPressOut} style={[animatedStyle, cardLiftShadow]}>
      {card}
    </AnimatedPressable>
  );
}

/**
 * Search / inline panels — solid surface, no blur.
 * @param {{ children: *, style?: object, contentStyle?: object, contentWrapperStyle?: object, isDark?: boolean, borderRadius?: number }} props
 */
export function GlassPanel({
  children,
  style,
  contentStyle,
  contentWrapperStyle,
  isDark = true,
  borderRadius = DEFAULT_PANEL_RADIUS,
}) {
  const theme = getTheme(isDark);

  return (
    <View
      style={[
        {
          borderRadius,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: isDark ? 'rgba(20, 20, 28, 0.88)' : theme.card,
          overflow: 'hidden',
        },
        cardShadow(isDark),
        style,
      ]}
    >
      <View style={contentWrapperStyle}>
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

const aurora = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blurWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  blob: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    opacity: 0.9,
  },
  blobPink: { top: -140, left: -100 },
  blobPurple: { top: -80, right: -120 },
  blobCyan: { top: 20, left: '22%' },
});

const ui = StyleSheet.create({
  pillHit: { marginRight: 8 },
  pillGlass: { marginBottom: 0 },
  pillInner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  pillText: { fontSize: 13, fontFamily: MP_FONT.bodySemi },
  primaryBtn: {
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontFamily: MP_FONT.bodyBold,
    fontSize: 13,
    textAlign: 'center',
  },
  secondarySolid: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontFamily: MP_FONT.bodySemi,
    fontSize: 13,
    textAlign: 'center',
  },
  filterGradBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  filterGradText: {
    color: '#fff',
    fontFamily: MP_FONT.bodyBold,
    fontSize: 12,
  },
  sectionLabel: {
    color: BRAND.pink,
    fontSize: 11,
    fontFamily: MP_FONT.bodyBold,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  cardMargin: { marginBottom: 16 },
  cardPad: { padding: 20 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: `${BRAND.cyan}18`,
    borderWidth: 1,
    borderColor: `${BRAND.cyan}44`,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  verifiedText: {
    color: BRAND.cyan,
    fontSize: 10,
    fontFamily: MP_FONT.bodyBold,
  },
});
