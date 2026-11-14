// Neobrutalist hero — gradient-masked title, optional muted subtitle, then free children.
// Flow: pick title gradient from theme → MaskedView + LinearGradient title → subtitle → children.
// Used by: screen headers, splash, empty states, welcome screens.
//
// vocab: MaskedView = shows the gradient only where the title Text alpha mask cuts through
// vocab: LinearGradient = expo gradient fill; here it is clipped by the title mask
// Manipulate here: title fontSize 28 / lineHeight 36 in styles.titleMask

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { gradients, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: titleMask fontSize / lineHeight in styles below; spacing.lg / spacing.sm for padding.
const HERO_TITLE_INVISIBLE_OPACITY = 0;

// ===== HELPER FUNCTIONS =====

// ThemeProvider already resolved light vs dark — use that, not raw phone scheme.
function titleGradientForDarkMode(isDarkMode) {
  if (isDarkMode) {
    return gradients.title.dark;
  }
  return gradients.title.light;
}

function buildSubtitleStyle(mutedColor) {
  return [styles.subtitle, { color: mutedColor }];
}

// ===== SMALL UI PIECES =====

/**
 * Title text used as the alpha mask for the gradient fill.
 * Invisible duplicate under the gradient reserves the same layout box.
 */
function HeroTitleMaskText({ titleText }) {
  return <Text style={styles.titleMask}>{titleText}</Text>;
}

function HeroGradientFill({ titleText, titleGradient }) {
  // Opacity 0 twin: same glyphs/size so the gradient layer has real height/width.
  const invisibleSizerStyle = [styles.titleMask, { opacity: HERO_TITLE_INVISIBLE_OPACITY }];

  return (
    <LinearGradient
      colors={titleGradient.colors}
      start={titleGradient.start}
      end={titleGradient.end}
    >
      <Text style={invisibleSizerStyle}>{titleText}</Text>
    </LinearGradient>
  );
}

function HeroGradientTitle({ titleText, titleGradient }) {
  return (
    <MaskedView maskElement={<HeroTitleMaskText titleText={titleText} />}>
      <HeroGradientFill titleText={titleText} titleGradient={titleGradient} />
    </MaskedView>
  );
}

function HeroSubtitleLine({ subtitleText, mutedColor }) {
  if (!subtitleText) {
    return null;
  }
  const subtitleStyle = buildSubtitleStyle(mutedColor);
  return <Text style={subtitleStyle}>{subtitleText}</Text>;
}

// ===== MAIN FUNCTION =====

/**
 * Hero section with gradient-masked title and optional subtitle.
 * @param {object} props
 * @param {string} props.title - main hero title
 * @param {string} [props.subtitle] - optional subtitle
 * @param {import('react').ReactNode} [props.children] - extra content below
 * @param {object} [props.style] - additional container styles
 */
export default function NbHero({ title, subtitle, children, style }) {
  // vocab: useTheme = ThemeProvider hook — isDark follows resolved app theme
  const { colors: themeColors, isDark } = useTheme();

  // 1. Title color ramp follows light/dark from ThemeProvider.
  const titleGradient = titleGradientForDarkMode(isDark);

  // 2. Stack gradient title → optional subtitle → any caller children.
  const heroContainerStyle = [styles.container, style];

  return (
    <View style={heroContainerStyle}>
      <HeroGradientTitle titleText={title} titleGradient={titleGradient} />
      <HeroSubtitleLine
        subtitleText={subtitle}
        mutedColor={themeColors.nbMuted}
      />
      {children}
    </View>
  );
}

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  titleMask: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
