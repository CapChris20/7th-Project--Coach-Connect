// Section heading for a group of exercises: title, optional subtitle, and a fading accent line.
// Flow: pick title and subtitle colors → build the line gradient → render the heading, then the children.
// Used by the exercise videos tab to group exercises under a labeled block.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// ===== NAMED CONSTANTS =====

const TITLE_COLOR_DARK = '#FFFFFF';
const TITLE_COLOR_LIGHT = '#0A0A0F';
const SUBTITLE_COLOR_DARK = 'rgba(255,255,255,0.55)';
const SUBTITLE_COLOR_LIGHT = 'rgba(10,10,15,0.55)';
const DEFAULT_ACCENT_GRADIENT = ['#FF6B9D', '#C2410C'];
const ACCENT_FADE_COLOR = 'transparent';
const MINIMUM_GRADIENT_STOPS = 2;
const ACCENT_LINE_START = { x: 0, y: 0.5 };
const ACCENT_LINE_END = { x: 1, y: 0.5 };

// ===== HELPER FUNCTIONS =====

/**
 * A theme color wins. Otherwise dark and light each have their own fallback so the heading stays readable.
 * @param {string|undefined} themeColor
 * @param {boolean} isDark
 * @param {string} darkColor
 * @param {string} lightColor
 * @returns {string}
 */
function colorFromThemeOrFallback(themeColor, isDark, darkColor, lightColor) {
  if (themeColor) return themeColor;
  if (isDark) return darkColor;
  return lightColor;
}

/**
 * The line needs at least two stops. A short or missing gradient uses the default pink-to-orange, then fades out.
 * @param {Array|undefined} accentGradient
 * @returns {Array}
 */
function fadingAccentGradient(accentGradient) {
  const hasEnoughStops = accentGradient?.length >= MINIMUM_GRADIENT_STOPS;
  const lineColors = hasEnoughStops ? accentGradient : DEFAULT_ACCENT_GRADIENT;
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
 * @param {object} [props.colors] Theme text colors. text and textMuted are read when present.
 * @param {boolean} props.isDark
 * @returns {JSX.Element}
 */
export default function ExerciseSection({ title, subtitle, accentGradient, children, style, colors, isDark }) {
  const titleColor = colorFromThemeOrFallback(colors?.text, isDark, TITLE_COLOR_DARK, TITLE_COLOR_LIGHT);
  const subtitleColor = colorFromThemeOrFallback(
    colors?.textMuted,
    isDark,
    SUBTITLE_COLOR_DARK,
    SUBTITLE_COLOR_LIGHT,
  );
  const accentLineColors = fadingAccentGradient(accentGradient);

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: subtitleColor }]}>{subtitle}</Text> : null}
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
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  lineWrap: { marginTop: 12, height: 2, borderRadius: 1, overflow: 'hidden' },
  accentLine: { flex: 1, height: 2, borderRadius: 1 },
});
