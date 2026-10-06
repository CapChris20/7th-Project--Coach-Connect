// Centered uppercase section label with a fading pink-to-orange underline.
// Flow: paint the gradient word → draw a short rule under it that fades at both ends.
// Used by home sections that need the same header treatment as the workout tab.

import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ColorText from '../../look-and-feel/ColorText';

// ===== NAMED CONSTANTS =====

const SECTION_TITLE_FONT = 'SpaceGrotesk_600SemiBold';

// Brighter pink → orange, matching the workout tab header.
const SECTION_HEADER_GRADIENT = ['#FF6B9D', '#FB923C'];

const DARK_UNDERLINE_COLORS = [
  'transparent',
  'rgba(255,107,157,0.75)',
  'rgba(251,146,60,0.65)',
  'transparent',
];
const LIGHT_UNDERLINE_COLORS = [
  'transparent',
  'rgba(255,107,157,0.55)',
  'rgba(251,146,60,0.45)',
  'transparent',
];

// The color stops sit in the middle so both ends of the rule fade out.
const UNDERLINE_LOCATIONS = [0, 0.35, 0.65, 1];
const HORIZONTAL_GRADIENT_START = { x: 0, y: 0.5 };
const HORIZONTAL_GRADIENT_END = { x: 1, y: 0.5 };

// ===== HELPER FUNCTIONS =====

function underlineColors(isDark) {
  if (isDark) return DARK_UNDERLINE_COLORS;
  return LIGHT_UNDERLINE_COLORS;
}

// Every platform maps to the same family on purpose, so a missing face does not swap in a system font.
function sectionTitleFontFamily() {
  return Platform.select({
    ios: SECTION_TITLE_FONT,
    android: SECTION_TITLE_FONT,
    default: SECTION_TITLE_FONT,
  });
}

// ===== MAIN FUNCTION =====

/**
 * Uppercase section title plus the short gradient rule under it.
 * @param {{ text?: string, isDark?: boolean, style?: object }} props
 * @returns {import('react').ReactElement}
 */
export default function SectionTitle({ text, isDark = true, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <ColorText
        colors={SECTION_HEADER_GRADIENT}
        start={HORIZONTAL_GRADIENT_START}
        end={HORIZONTAL_GRADIENT_END}
        style={[
          styles.label,
          {
            fontFamily: sectionTitleFontFamily(),
            alignSelf: 'center',
          },
        ]}
      >
        {String(text || '').toUpperCase()}
      </ColorText>
      <LinearGradient
        colors={underlineColors(isDark)}
        locations={UNDERLINE_LOCATIONS}
        start={HORIZONTAL_GRADIENT_START}
        end={HORIZONTAL_GRADIENT_END}
        style={styles.rule}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 22,
    marginBottom: 14,
    alignItems: 'center',
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  rule: {
    marginTop: 12,
    height: 2,
    width: '56%',
    alignSelf: 'center',
    borderRadius: 2,
  },
});
