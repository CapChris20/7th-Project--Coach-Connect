// Gradient icon chip — small accent square only (handoff). Owner icon art sits inside.
// Flow: pick accent color ramp → LinearGradient square frame → Image or children centered.
// Used by: dashboard number cards, nav-adjacent chrome, empty states, list rows.
//
// vocab: accentGradients = rotating palette list when the caller omits custom colors
// vocab: LinearGradient = expo diagonal fill; chip outline still uses theme nbBorder
// Manipulate here: DEFAULT_CHIP_SIZE 44 matches min touch; INNER_ICON_SIZE 28 fits owner art

import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { accentGradients, borderRadius, nb } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const DEFAULT_CHIP_SIZE = 44;
const INNER_ICON_SIZE = 28;
// Diagonal top-left → bottom-right (Design Law small accent, not a solid purple rim)
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

// Prefer caller colors; otherwise cycle the shared accent list by chip index.
function accentColorRampForChip(customColors, chipIndex) {
  if (customColors) {
    return customColors;
  }
  const rampIndex = chipIndex % accentGradients.length;
  return accentGradients[rampIndex];
}

function buildChipFrameStyle(themeColors, chipSize, callerStyle) {
  return [
    styles.chip,
    {
      width: chipSize,
      height: chipSize,
      borderRadius: borderRadius.nbIconChip,
      borderWidth: nb.borderWidth,
      borderColor: themeColors.nbBorder,
    },
    callerStyle,
  ];
}

function buildInnerIconImageStyle() {
  return {
    width: INNER_ICON_SIZE,
    height: INNER_ICON_SIZE,
  };
}

// ===== SMALL UI PIECES =====

// Image wins when `source` is set; otherwise render whatever children the caller passed.
function ChipInnerGraphic({ imageSource, children }) {
  if (imageSource) {
    const imageStyle = buildInnerIconImageStyle();
    return (
      <Image
        source={imageSource}
        style={imageStyle}
        resizeMode="contain"
      />
    );
  }
  return children;
}

// ===== MAIN FUNCTION =====

/**
 * Small gradient accent chip with optional owner PNG or custom children.
 * @param {{
 *   source?: number|object,
 *   children?: import('react').ReactNode,
 *   colors?: string[],
 *   size?: number,
 *   style?: object,
 *   index?: number,
 * }} props
 */
export default function NbIconChip({
  source,
  children,
  colors,
  size = DEFAULT_CHIP_SIZE,
  style,
  index = 0,
}) {
  // vocab: useTheme = ThemeProvider hook — nbBorder follows light/dark outline tokens
  const { colors: themeColors } = useTheme();

  // 1. Gradient list comes from props or cycles accentGradients by index.
  const gradientColors = accentColorRampForChip(colors, index);

  // 2. Outline follows theme border (white stroke in dark) — never a fixed purple-only rim.
  const chipFrameStyle = buildChipFrameStyle(themeColors, size, style);

  // 3. Paint the diagonal gradient square, then center the icon / children.
  return (
    <LinearGradient
      colors={gradientColors}
      start={GRADIENT_START}
      end={GRADIENT_END}
      style={chipFrameStyle}
    >
      <ChipInnerGraphic imageSource={source}>{children}</ChipInnerGraphic>
    </LinearGradient>
  );
}

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
