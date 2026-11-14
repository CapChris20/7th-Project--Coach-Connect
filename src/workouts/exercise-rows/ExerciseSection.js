// Section heading above a group of exercise rows: title, optional subtitle, fading accent line.
// Flow: resolve theme tokens → build gradient stops → render header, then children.
// Used by: exercise videos tab and other workout lists that need a labeled block.

import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const FADE_OUT_STOP = 'transparent';
// LinearGradient refuses a single stop — need at least two before we append transparent.
const MIN_GRADIENT_STOP_COUNT = 2;
// Horizontal fade: left → right across the accent hairline.
const ACCENT_LINE_START = { x: 0, y: 0.5 };
const ACCENT_LINE_END = { x: 1, y: 0.5 };

// ===== HELPER FUNCTIONS =====

/**
 * Color stops for the accent hairline.
 * Always ends with transparent so the brand gradient fades out to the right.
 * @param {string[]|undefined} customStops
 * @returns {string[]}
 */
function accentLineColorStops(customStops) {
  const customStopCount = customStops?.length || 0;
  const hasCustomStops = customStopCount >= MIN_GRADIENT_STOP_COUNT;

  let baseStops = gradients.brand.colors;
  if (hasCustomStops) {
    baseStops = customStops;
  }

  return [...baseStops, FADE_OUT_STOP];
}

function pickThemeColorsForScheme(colorScheme) {
  if (colorScheme === 'dark') {
    return darkColors;
  }
  return lightColors;
}

// ===== MAIN FUNCTION =====

/**
 * Labeled block: uppercase title, optional subtitle, fading accent, then children rows.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string[]} [props.accentGradient]
 * @param {React.ReactNode} props.children
 * @param {object} [props.style]
 * @param {object} [props.colors] deprecated
 * @param {boolean} [props.isDark] deprecated
 */
export default function ExerciseSection({
  title,
  subtitle,
  accentGradient,
  children,
  style,
  colors: deprecatedColors,
  isDark: deprecatedIsDark,
}) {
  void deprecatedColors;
  void deprecatedIsDark;

  // 1. Pick light/dark tokens from the OS scheme (ignore deprecated props).
  // vocab: useColorScheme = RN hook reading OS light/dark
  const colorScheme = useColorScheme();
  const themeColors = pickThemeColorsForScheme(colorScheme);

  // 2. Build the fading accent hairline stops (custom or brand, always ends transparent).
  const lineGradientStops = accentLineColorStops(accentGradient);

  // 3. Name colors + optional subtitle before JSX.
  const titleColor = themeColors.nbInk;
  const subtitleColor = themeColors.nbMuted;
  const hasSubtitle = Boolean(subtitle);

  const sectionWrapStyle = [sectionStyles.wrap, style];
  const titleStyle = [sectionStyles.title, { color: titleColor }];
  const subtitleStyle = [sectionStyles.subtitle, { color: subtitleColor }];

  let subtitleNode = null;
  if (hasSubtitle) {
    subtitleNode = <Text style={subtitleStyle}>{subtitle}</Text>;
  }

  // 4. Header (title → subtitle → hairline) then the exercise row children.
  return (
    <View style={sectionWrapStyle}>
      <View style={sectionStyles.header}>
        <Text style={titleStyle}>{title}</Text>
        {subtitleNode}
        <View style={sectionStyles.lineWrap}>
          {/* vocab: LinearGradient paints a view with color stops along start→end vectors */}
          <LinearGradient
            colors={lineGradientStops}
            start={ACCENT_LINE_START}
            end={ACCENT_LINE_END}
            style={sectionStyles.accentLine}
          />
        </View>
      </View>
      {children}
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const sectionStyles = StyleSheet.create({
  // Manipulate here: space below the whole section (title + kids)
  wrap: { marginBottom: 28 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10 },
  title: {
    fontSize: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  lineWrap: { marginTop: 12, height: 2, borderRadius: 1, overflow: 'hidden' },
  accentLine: { flex: 1, height: 2, borderRadius: 1 },
});
