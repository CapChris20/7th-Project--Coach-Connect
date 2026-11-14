// Neobrutalist button — fill (black/white), ink alias, plain/ghost (surface).
// Flow: pick variant colors → wire press nudge animation → iOS shadow OR Android duplicate layer → label.
// Where used: CTAs, form actions, navigation across all screens.
//
// vocab: fill = nbFill primary block; ghost = surface with border; hard shadow = offset with no blur
// Manipulate here: PRESS_ANIMATION_MS, PRESS_NUDGE_PIXELS; shadow travel uses nb.shadowOffset

import React, { useRef } from 'react';
import { Text, StyleSheet, Pressable, Animated, Platform, View } from 'react-native';

import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: lower = snappier press; raise = softer settle
const PRESS_ANIMATION_MS = 150;
// Manipulate here: how far the face nudges down-right on press (matches hard-shadow collapse)
const PRESS_NUDGE_PIXELS = 3;
const DISABLED_OPACITY = 0.45;
const SMALL_LABEL_FONT_SIZE = 13;
const LARGE_LABEL_FONT_SIZE = 16;

// ===== HELPER FUNCTIONS =====

function variantIsGhostButton(variant) {
  return variant === 'plain' || variant === 'ghost';
}

/**
 * Ghost/plain → surface + ink. Everything else (brand / ink / fill) → fill + onFill.
 */
function pickButtonColors(variant, colors) {
  const isGhost = variantIsGhostButton(variant);
  if (isGhost) {
    return {
      backgroundColor: colors.nbSurface,
      labelColor: colors.nbInk,
    };
  }
  return {
    backgroundColor: colors.nbFill,
    labelColor: colors.nbOnFill,
  };
}

function pickButtonSizing(isSmall) {
  if (isSmall) {
    return {
      height: nb.minTouchTarget,
      fontSize: SMALL_LABEL_FONT_SIZE,
    };
  }
  return {
    height: nb.buttonMinHeight,
    fontSize: LARGE_LABEL_FONT_SIZE,
  };
}

function resolveAccessibilityLabel(accessibilityLabel, children) {
  if (accessibilityLabel) {
    return accessibilityLabel;
  }
  const childrenIsText =
    typeof children === 'string' || typeof children === 'number';
  if (childrenIsText) {
    return String(children);
  }
  return undefined;
}

/**
 * Bordered face + single-line label. Shadow lives outside this view.
 */
function ButtonFace({ height, borderColor, backgroundColor, labelColor, fontSize, children }) {
  const faceChromeStyle = {
    height,
    borderColor,
    backgroundColor,
  };
  const labelStyle = {
    color: labelColor,
    fontSize,
  };

  return (
    <View style={[styles.button, faceChromeStyle]}>
      <Text style={[styles.text, labelStyle]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

/**
 * Android hard shadow = a second filled view behind the face that collapses on press.
 * iOS cannot paint a solid offset slab this way, so we keep a duplicate layer here only.
 */
function NbButtonOnAndroid({
  style,
  height,
  colors,
  shadowTranslateX,
  shadowTranslateY,
  translateX,
  translateY,
  buttonFace,
}) {
  const shadowLayerStyle = [
    styles.shadowView,
    {
      height,
      backgroundColor: colors.nbShadow,
      borderColor: colors.nbShadow,
    },
    {
      transform: [
        { translateX: shadowTranslateX },
        { translateY: shadowTranslateY },
      ],
    },
  ];
  const faceNudgeStyle = {
    transform: [{ translateX }, { translateY }],
  };

  return (
    <View style={style}>
      <Animated.View style={shadowLayerStyle} />
      <Animated.View style={faceNudgeStyle}>{buttonFace}</Animated.View>
    </View>
  );
}

/**
 * iOS hard shadow = native shadow* props with radius 0 (Design Law — no blur).
 */
function NbButtonOnIos({
  style,
  colors,
  translateX,
  translateY,
  buttonFace,
}) {
  const iosHardShadowStyle = {
    shadowColor: colors.nbShadow,
    shadowOffset: { width: nb.shadowOffset, height: nb.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
  };
  const faceNudgeStyle = {
    transform: [{ translateX }, { translateY }],
  };

  return (
    <Animated.View style={[iosHardShadowStyle, faceNudgeStyle, style]}>
      {buttonFace}
    </Animated.View>
  );
}

function paintButtonForPlatform({
  isAndroid,
  style,
  height,
  colors,
  shadowTranslateX,
  shadowTranslateY,
  translateX,
  translateY,
  buttonFace,
}) {
  if (isAndroid) {
    return (
      <NbButtonOnAndroid
        style={style}
        height={height}
        colors={colors}
        shadowTranslateX={shadowTranslateX}
        shadowTranslateY={shadowTranslateY}
        translateX={translateX}
        translateY={translateY}
        buttonFace={buttonFace}
      />
    );
  }

  return (
    <NbButtonOnIos
      style={style}
      colors={colors}
      translateX={translateX}
      translateY={translateY}
      buttonFace={buttonFace}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Handoff button: fill / ink (=fill) / plain (ghost).
 * Press animation: translate 3,3 and collapse shadow to 0.
 *
 * @param {object} props
 * @param {string} props.variant - 'brand' | 'ink' | 'plain' | 'fill' | 'ghost'
 * @param {string} props.children - button text (single line)
 * @param {Function} [props.onPress]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.sm]
 * @param {object} [props.style]
 */
export default function NbButton({
  variant = 'brand',
  children,
  onPress,
  disabled = false,
  sm = false,
  style,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  // vocab: useRef + Animated.Value = one shared 0→1 progress for press-in / press-out
  // vocab: .current = the Animated.Value instance; we keep the same object across renders
  const pressProgress = useRef(new Animated.Value(0)).current;

  // 1. Resolve fill vs ghost colors and small vs large sizing from props + theme.
  const { backgroundColor, labelColor } = pickButtonColors(variant, colors);
  const { height, fontSize } = pickButtonSizing(sm);
  const voiceOverLabel = resolveAccessibilityLabel(accessibilityLabel, children);

  // 2. Build the press nudge + shadow-collapse interpolations from the shared progress value.
  const { translateX, translateY } = buildPressNudgeTransforms(pressProgress);
  const { shadowTranslateX, shadowTranslateY } =
    buildShadowCollapseTransforms(pressProgress);

  // 3. Face is shared; platform wrappers only differ in how they paint the hard shadow.
  const buttonFace = (
    <ButtonFace
      height={height}
      borderColor={colors.nbBorder}
      backgroundColor={backgroundColor}
      labelColor={labelColor}
      fontSize={fontSize}
    >
      {children}
    </ButtonFace>
  );

  const isAndroid = Platform.OS === 'android';
  const paintedButton = paintButtonForPlatform({
    isAndroid,
    style,
    height,
    colors,
    shadowTranslateX,
    shadowTranslateY,
    translateX,
    translateY,
    buttonFace,
  });

  // 4. Pressable is the hit target only — chrome lives in paintedButton children.
  function handlePressIn() {
    startPressInAnimation(pressProgress);
  }

  function handlePressOut() {
    startPressOutAnimation(pressProgress);
  }

  const disabledStyle = disabled ? styles.disabled : null;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={voiceOverLabel}
      style={[styles.container, disabledStyle]}
    >
      {paintedButton}
    </Pressable>
  );
}

export { NbButton };

// ===== PLUMBING — skip unless debugging =====

function startPressInAnimation(animatedValue) {
  // vocab: useNativeDriver = run transform on the native thread (smoother, no JS lag)
  Animated.timing(animatedValue, {
    toValue: 1,
    duration: PRESS_ANIMATION_MS,
    useNativeDriver: true,
  }).start();
}

function startPressOutAnimation(animatedValue) {
  Animated.timing(animatedValue, {
    toValue: 0,
    duration: PRESS_ANIMATION_MS,
    useNativeDriver: true,
  }).start();
}

function buildPressNudgeTransforms(animatedValue) {
  // vocab: interpolate = map progress 0→1 onto pixel travel for the face
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PRESS_NUDGE_PIXELS],
  });
  const translateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, PRESS_NUDGE_PIXELS],
  });
  return { translateX, translateY };
}

function buildShadowCollapseTransforms(animatedValue) {
  // Shadow starts at nb.shadowOffset and collapses to 0 as the face nudges into it.
  const shadowTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [nb.shadowOffset, 0],
  });
  const shadowTranslateY = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [nb.shadowOffset, 0],
  });
  return { shadowTranslateX, shadowTranslateY };
}

const styles = StyleSheet.create({
  container: {
    // Pressable is just the hit area — visual chrome lives in children.
  },
  button: {
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    paddingHorizontal: nb.chipPadding,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: DISABLED_OPACITY,
  },
  shadowView: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
});
