// Neobrutalist avatar — circular photo or initials on brand gradient.
// Flow: size + theme border → image URI branch OR gradient + initials fallback.
// Where used: profiles, user lists, comments, headers.
//
// vocab: avatar = circular user image or initials inside Design Law outline
// Manipulate here: DEFAULT_AVATAR_SIZE_PX, INITIALS_SIZE_RATIO, INITIALS_INK_COLOR

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { nb, gradients } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: default diameter when caller omits size
const DEFAULT_AVATAR_SIZE_PX = 40;
// Manipulate here: 0.4 scales initials to ~40% of diameter
const INITIALS_SIZE_RATIO = 0.4;
// Manipulate here: ink on brand gradient (Design Law status/avatar text — fixed dark)
const INITIALS_INK_COLOR = '#0A0A0F';
const MISSING_INITIALS_MARK = '?';

// ===== HELPER FUNCTIONS =====

function halfOfSizeAsCornerRadius(sizePixels) {
  return sizePixels / 2;
}

function buildAvatarRingStyle(sizePixels, cornerRadius, borderColor, extraStyle) {
  return [
    styles.container,
    {
      width: sizePixels,
      height: sizePixels,
      borderRadius: cornerRadius,
      borderColor,
    },
    extraStyle,
  ];
}

function buildCircularImageStyle(sizePixels, cornerRadius) {
  return [
    styles.image,
    {
      width: sizePixels,
      height: sizePixels,
      borderRadius: cornerRadius,
    },
  ];
}

function initialsLabelOrQuestionMark(initials) {
  if (initials) {
    return initials;
  }
  return MISSING_INITIALS_MARK;
}

function initialsFontSizeForDiameter(sizePixels) {
  return sizePixels * INITIALS_SIZE_RATIO;
}

// Photo path: bordered ring with the image clipped to a circle.
function AvatarWithPhoto({ imageUri, sizePixels, cornerRadius, borderColor, extraStyle }) {
  const ringStyle = buildAvatarRingStyle(sizePixels, cornerRadius, borderColor, extraStyle);
  const imageStyle = buildCircularImageStyle(sizePixels, cornerRadius);
  const imageSource = { uri: imageUri };

  return (
    <View style={ringStyle}>
      <Image source={imageSource} style={imageStyle} />
    </View>
  );
}

// No photo: brand gradient plate with bold initials (Design Law accent, not a flat slab).
function AvatarWithInitials({ initials, sizePixels, cornerRadius, borderColor, extraStyle }) {
  const ringStyle = buildAvatarRingStyle(sizePixels, cornerRadius, borderColor, extraStyle);
  const initialsText = initialsLabelOrQuestionMark(initials);
  const initialsFontSize = initialsFontSizeForDiameter(sizePixels);
  const initialsStyle = [styles.initials, { fontSize: initialsFontSize }];
  const brandGradient = gradients.brand;

  return (
    <LinearGradient
      colors={brandGradient.colors}
      start={brandGradient.start}
      end={brandGradient.end}
      style={ringStyle}
    >
      <Text style={initialsStyle}>{initialsText}</Text>
    </LinearGradient>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Circular avatar with image or initials on gradient.
 *
 * @param {object} props
 * @param {string} [props.source] - image URI
 * @param {string} [props.initials] - fallback initials (1-2 chars)
 * @param {number} [props.size] - diameter in pixels (default 40)
 * @param {object} [props.style] - additional container styles
 */
export default function NbAvatar({
  source,
  initials,
  size = DEFAULT_AVATAR_SIZE_PX,
  style,
}) {
  const { colors: themeColors } = useTheme();
  const cornerRadius = halfOfSizeAsCornerRadius(size);
  // Design Law: outline follows theme border (white in dark), never a fixed purple stroke
  const borderColor = themeColors.nbBorder;
  const hasPhotoUri = Boolean(source);

  // 1. Valid image URI → photo avatar.
  if (hasPhotoUri) {
    return (
      <AvatarWithPhoto
        imageUri={source}
        sizePixels={size}
        cornerRadius={cornerRadius}
        borderColor={borderColor}
        extraStyle={style}
      />
    );
  }

  // 2. Otherwise gradient + initials (or "?" when caller omits initials).
  return (
    <AvatarWithInitials
      initials={initials}
      sizePixels={size}
      cornerRadius={cornerRadius}
      borderColor={borderColor}
      extraStyle={style}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  container: {
    borderWidth: nb.borderWidth,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    // Image fills the circular clip inside the bordered container.
  },
  initials: {
    fontFamily: 'SpaceGrotesk_700Bold',
    color: INITIALS_INK_COLOR,
    textTransform: 'uppercase',
  },
});
