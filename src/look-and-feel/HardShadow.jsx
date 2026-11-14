// Hard offset shadow wrapper so Android matches iOS (no soft blur).
// Flow: read theme shadow color → iOS native hard shadow OR Android offset fill behind children.
// Used by: NbCard, NbButton, pilot dashboard cards, NbBottomNav chips.
//
// vocab: hard shadow = solid offset with shadowRadius 0 (Design Law — never soft blur)
// Manipulate here: offset default = nb.shadowOffsetCard; radius default = DEFAULT_CORNER_RADIUS

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const PLATFORM_IOS = 'ios';
// Manipulate here: default corner radius when Android paints the duplicate fill
const DEFAULT_CORNER_RADIUS = 10;
const HARD_SHADOW_OPACITY = 1;
const HARD_SHADOW_BLUR_RADIUS = 0;

// ===== HELPER FUNCTIONS =====

function buildIosHardShadowStyle(shadowColor, offsetPixels) {
  return {
    shadowColor,
    shadowOffset: { width: offsetPixels, height: offsetPixels },
    shadowOpacity: HARD_SHADOW_OPACITY,
    shadowRadius: HARD_SHADOW_BLUR_RADIUS,
  };
}

function buildAndroidShadowFillStyle(offsetPixels, cornerRadius, shadowColor) {
  return [
    StyleSheet.absoluteFillObject,
    {
      top: offsetPixels,
      left: offsetPixels,
      borderRadius: cornerRadius,
      backgroundColor: shadowColor,
    },
  ];
}

// Android cannot match iOS hard edges with shadow props — paint a sibling fill instead.
function AndroidOffsetShadowFill({ offsetPixels, cornerRadius, shadowColor }) {
  const fillStyle = buildAndroidShadowFillStyle(offsetPixels, cornerRadius, shadowColor);
  return <View pointerEvents="none" style={fillStyle} />;
}

function HardShadowShellOnIos({ children, offsetPixels, wrapperStyle, shadowColor }) {
  const iosShadowStyle = buildIosHardShadowStyle(shadowColor, offsetPixels);
  const combinedStyle = [iosShadowStyle, wrapperStyle];
  return <View style={combinedStyle}>{children}</View>;
}

function HardShadowShellOnAndroid({
  children,
  offsetPixels,
  cornerRadius,
  wrapperStyle,
  shadowColor,
}) {
  const wrapperCombinedStyle = [styles.androidRelativeShell, wrapperStyle];
  return (
    <View style={wrapperCombinedStyle}>
      <AndroidOffsetShadowFill
        offsetPixels={offsetPixels}
        cornerRadius={cornerRadius}
        shadowColor={shadowColor}
      />
      {children}
    </View>
  );
}

function runningOnIos() {
  return Platform.OS === PLATFORM_IOS;
}

// ===== MAIN FUNCTION =====

/**
 * Hard offset shadow: iOS uses native shadow API; Android paints an offset fill behind children.
 * @param {{ children: import('react').ReactNode, offset?: number, radius?: number, style?: object }} props
 */
export default function HardShadow({
  children,
  offset = nb.shadowOffsetCard,
  radius = DEFAULT_CORNER_RADIUS,
  style,
}) {
  const { colors: themeColors } = useTheme();
  // vocab: nbShadow = theme token for the hard offset fill / iOS shadowColor
  const shadowColor = themeColors.nbShadow;

  // 1. iOS: one wrapper, native shadow API, zero blur radius.
  if (runningOnIos()) {
    return (
      <HardShadowShellOnIos
        offsetPixels={offset}
        wrapperStyle={style}
        shadowColor={shadowColor}
      >
        {children}
      </HardShadowShellOnIos>
    );
  }

  // 2. Android: relative stack — offset fill behind, interactive children on top.
  return (
    <HardShadowShellOnAndroid
      offsetPixels={offset}
      cornerRadius={radius}
      wrapperStyle={style}
      shadowColor={shadowColor}
    >
      {children}
    </HardShadowShellOnAndroid>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  androidRelativeShell: {
    position: 'relative',
  },
});
