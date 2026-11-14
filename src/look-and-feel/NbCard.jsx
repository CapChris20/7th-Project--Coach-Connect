// Neobrutalist card — thick outline plus hard offset shadow behind content.
// Flow: read theme surface/border → Android duplicate shadow layer OR iOS shadow props → padded face.
// Where used: any screen block that needs a bordered card shell.
//
// vocab: hard shadow = shadowRadius 0, solid offset (Design Law — no blur)
// Manipulate here: nb.shadowOffsetCard, nb.cardPadding, nb.borderWidth

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: nb.shadowOffsetCard / nb.cardPadding / nb.borderWidth live on the palette tokens.
const PLATFORM_ANDROID = 'android';
const PLATFORM_IOS = 'ios';

// ===== HELPER FUNCTIONS =====

/**
 * iOS-only hard shadow bag. Radius 0 keeps the slab crisp (no soft blur).
 */
function buildIosHardCardShadowStyle(shadowColor, offsetPixels) {
  return {
    shadowColor,
    shadowOffset: { width: offsetPixels, height: offsetPixels },
    shadowOpacity: 1,
    shadowRadius: 0,
  };
}

/**
 * Face fill + Design Law card padding. Border width/radius live on styles.card.
 */
function buildCardFaceStyle(surfaceColor, borderColor) {
  return {
    backgroundColor: surfaceColor,
    borderColor,
    padding: nb.cardPadding,
  };
}

/**
 * Android hard shadow = a second card painted solid shadow-color, shifted down/right.
 * Absolute fill + top/left offset places it behind the real face.
 */
function AndroidCardShadowLayer({ offsetPixels, shadowColor }) {
  const shadowFillStyle = {
    backgroundColor: shadowColor,
    borderColor: shadowColor,
  };
  const shadowOffsetStyle = {
    top: offsetPixels,
    left: offsetPixels,
  };

  return (
    <View
      style={[
        styles.card,
        shadowFillStyle,
        StyleSheet.absoluteFill,
        shadowOffsetStyle,
      ]}
    />
  );
}

/**
 * Padded bordered face that holds children. Shadow is painted by the parent wrapper.
 */
function CardFace({ surfaceColor, borderColor, children }) {
  const faceStyle = buildCardFaceStyle(surfaceColor, borderColor);
  return (
    <View style={[styles.card, faceStyle]}>
      {children}
    </View>
  );
}

function paintAndroidCardWithShadow({
  style,
  shadowOffsetPixels,
  shadowColor,
  surfaceColor,
  borderColor,
  children,
}) {
  return (
    <View style={style}>
      <AndroidCardShadowLayer
        offsetPixels={shadowOffsetPixels}
        shadowColor={shadowColor}
      />
      <CardFace surfaceColor={surfaceColor} borderColor={borderColor}>
        {children}
      </CardFace>
    </View>
  );
}

function paintSingleLayerCard({
  style,
  surfaceColor,
  borderColor,
  iosShadowStyle,
  children,
}) {
  const faceStyle = buildCardFaceStyle(surfaceColor, borderColor);
  return (
    <View style={[styles.card, faceStyle, iosShadowStyle, style]}>
      {children}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bordered card shell with optional hard offset shadow.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - card content
 * @param {object} [props.style] - additional styles on the outer wrapper
 * @param {boolean} [props.noShadow] - flat card (nested layouts, special cases)
 */
export default function NbCard({ children, style, noShadow = false }) {
  const { colors } = useTheme();

  // 1. Pull Design Law tokens once so both platform branches share the same numbers.
  const shadowOffsetPixels = nb.shadowOffsetCard;
  const surfaceColor = colors.nbSurface;
  const borderColor = colors.nbBorder;
  const shadowColor = colors.nbShadow;

  // 2. Android with shadow: duplicate slab behind the face (iOS cannot do this in one view).
  const androidUsesDuplicateShadow = Platform.OS === PLATFORM_ANDROID && !noShadow;
  if (androidUsesDuplicateShadow) {
    return paintAndroidCardWithShadow({
      style,
      shadowOffsetPixels,
      shadowColor,
      surfaceColor,
      borderColor,
      children,
    });
  }

  // 3. iOS (and Android when noShadow): one view — optional hard shadow on the same layer.
  const shouldApplyIosShadow = Platform.OS === PLATFORM_IOS && !noShadow;
  let iosShadowStyle = {};
  if (shouldApplyIosShadow) {
    iosShadowStyle = buildIosHardCardShadowStyle(shadowColor, shadowOffsetPixels);
  }

  return paintSingleLayerCard({
    style,
    surfaceColor,
    borderColor,
    iosShadowStyle,
    children,
  });
}

export { NbCard };

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
});
