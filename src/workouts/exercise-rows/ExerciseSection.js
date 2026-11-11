// Section heading for a group of exercises: title, optional subtitle, and a fading accent line.
// Flow: pick title and subtitle colors → build the line gradient → render the heading, then the children.
// Used by the exercise videos tab to group exercises under a labeled block.

import React from 'react';
import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ACCENT_FADE_COLOR = 'transparent';
const MINIMUM_GRADIENT_STOPS = 2;
const ACCENT_LINE_START = { x: 0, y: 0.5 };
const ACCENT_LINE_END = { x: 1, y: 0.5 };

// ===== HELPER FUNCTIONS =====

/**
 * The line needs at least two stops. A short or missing gradient uses the brand gradient, then fades out.
 * @param {Array|undefined} accentGradient
 * @returns {Array}
 */
function fadingAccentGradient(accentGradient) {
  const hasEnoughStops = accentGradient?.length >= MINIMUM_GRADIENT_STOPS;
  const lineColors = hasEnoughStops ? accentGradient : gradients.brand.colors;
  return [...lineColors, ACCENT_FADE_COLOR];
}

// ===== MAIN FUNCTION =====

/**
 * Labeled exercise group with a fading accent line under the heading.
 * @param {object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {string[]} [props.accentGradient]
 * @param {React.ReactNode} props.children
 * @param {object} [props.style]
 * @param {object} [props.colors] Deprecated - uses nb tokens now
 * @param {boolean} props.isDark Deprecated - uses color scheme now
 * @returns {JSX.Element}
 */
export default function ExerciseSection({ title, subtitle, accentGradient, children, style, colors: deprecatedColors, isDark: deprecatedIsDark }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const accentLineColors = fadingAccentGradient(accentGradient);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: colors.nbMuted }]}>{subtitle}</Text> : null}
        <View style={styles.lineWrap}>
          {/* vocab: LinearGradient = a view painted with color stops. The last stop is transparent so the line fades. */}
          <LinearGradient
            colors={accentLineColors}
            start={ACCENT_LINE_START}
            end={ACCENT_LINE_END}
            style={styles.accentLine}
          />
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
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
