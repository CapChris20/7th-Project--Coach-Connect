// Small gradient accents for the black/white/gray design: pill, icon chip, avatar, progress bar.
// Flow: each piece is a small outlined shape filled with one gradient pair → color stays on small things only.
// Used by screens that need a status pill, an icon square, a round initial, or a progress bar.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lightDarkMode';
import { NbSurface } from './NbSurface';
import {
  NB_BORDER_WIDTH,
  NB_GRADIENT_END,
  NB_GRADIENT_START,
  NB_RADIUS,
  NB_SPACING,
  NB_TEXT_ON_ACCENT,
  getNbColors,
} from './nbTokens';

// ===== NAMED CONSTANTS =====

const PILL_FONT_SIZE = 11;
const ICON_CHIP_SIZE = 40;
const PROGRESS_HEIGHT = 16;
const PERCENT_MAX = 100;

// ===== HELPER FUNCTIONS =====

/**
 * @param {number} fraction A number from 0 to 1.
 * @returns {number} The same number kept inside 0 to 100 as a percent.
 */
function toPercent(fraction) {
  const percent = Math.round(fraction * PERCENT_MAX);
  return Math.max(0, Math.min(PERCENT_MAX, percent));
}

// ===== MAIN FUNCTIONS =====

/**
 * Small rounded status label with a gradient fill, such as "Active" or "2 of 5 done".
 * @param {object} props
 * @param {string} props.label
 * @param {string[]} props.accent Gradient pair.
 * @returns {JSX.Element}
 */
export function NbPill({ label, accent }) {
  return (
    <NbSurface accent={accent} radius={NB_RADIUS.sheet} hasShadow={false} innerStyle={styles.pillInner}>
      <Text numberOfLines={1} style={styles.pillLabel}>
        {label}
      </Text>
    </NbSurface>
  );
}

/**
 * Small square that holds one icon on a gradient.
 * @param {object} props
 * @param {React.ReactNode} props.children The icon.
 * @param {string[]} props.accent Gradient pair.
 * @returns {JSX.Element}
 */
export function NbIconChip({ children, accent }) {
  return (
    <NbSurface accent={accent} radius={NB_RADIUS.chip} hasShadow={false} innerStyle={styles.iconChipInner}>
      {children}
    </NbSurface>
  );
}

/**
 * Round initial on a gradient.
 * @param {object} props
 * @param {string} props.initial One or two letters.
 * @param {number} [props.size]
 * @param {string[]} props.accent Gradient pair.
 * @returns {JSX.Element}
 */
export function NbAvatar({ initial, size = 52, accent }) {
  const sizeStyle = { width: size, height: size, alignItems: 'center', justifyContent: 'center' };
  return (
    <NbSurface accent={accent} radius={size / 2} hasShadow={false} innerStyle={sizeStyle}>
      <Text style={[styles.avatarLetter, { fontSize: Math.round(size * 0.36) }]}>{initial}</Text>
    </NbSurface>
  );
}

/**
 * Outlined track with a gradient fill that grows from the left.
 * @param {object} props
 * @param {number} props.progress A number from 0 to 1.
 * @param {string[]} props.accent Gradient pair.
 * @returns {JSX.Element}
 */
export function NbProgressBar({ progress, accent }) {
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);
  const trackStyle = { borderColor: colors.border, backgroundColor: colors.gray };
  const fillWidth = `${toPercent(progress)}%`;
  return (
    <View style={[styles.track, trackStyle]} accessibilityRole="progressbar">
      <LinearGradient
        colors={accent}
        start={NB_GRADIENT_START}
        end={NB_GRADIENT_END}
        style={{ width: fillWidth, height: '100%' }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pillInner: { paddingHorizontal: NB_SPACING.medium, paddingVertical: NB_SPACING.tiny },
  pillLabel: {
    fontSize: PILL_FONT_SIZE,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: NB_TEXT_ON_ACCENT,
  },
  iconChipInner: {
    width: ICON_CHIP_SIZE,
    height: ICON_CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontWeight: '800', color: NB_TEXT_ON_ACCENT },
  track: {
    height: PROGRESS_HEIGHT,
    borderWidth: NB_BORDER_WIDTH,
    borderRadius: PROGRESS_HEIGHT / 2,
    overflow: 'hidden',
  },
});
