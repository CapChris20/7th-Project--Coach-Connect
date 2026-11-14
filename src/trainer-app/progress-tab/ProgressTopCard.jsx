// One metric tile on the trainer Progress tab — hero number, caption, optional footer.
// Flow: pick light/dark palette → build card chrome → icon + metric + label (+ footer).
// Used by: Progress tab metric grid at the top of TrainerProgressTab / trainer home.
// Read order: constants → color helpers → pure layout → exported card → PLUMBING styles.

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
// vocab: Ionicons name = string id for a glyph in Expo's vector icon font
import { Ionicons } from '@expo/vector-icons';
import { lightColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const DARK_TEXT = lightColors.white;
const LIGHT_TEXT = lightColors.nbInk;
const DARK_MUTED = 'rgba(255,255,255,0.55)';
const LIGHT_MUTED = 'rgba(10,10,15,0.55)';
const DARK_BACKGROUND = '#14141C';
const LIGHT_BACKGROUND = lightColors.white;
const DARK_BORDER = 'rgba(255,255,255,0.10)';
const LIGHT_BORDER = 'rgba(10,10,15,0.08)';
const SHADOW_COLOR = '#000';
// Manipulate here: darker theme = stronger shadow; light = softer lift
const DARK_SHADOW_OPACITY = 0.25;
const LIGHT_SHADOW_OPACITY = 0.08;
const SHADOW_OFFSET_HEIGHT = 2;
const SHADOW_RADIUS = 8;
const ANDROID_ELEVATION = 2;
// Manipulate here: shared amber accent on every progress metric icon
const ICON_COLOR = '#FDBA74';
const ICON_SIZE = 20;
// Manipulate here: smallest scale when adjustsFontSizeToFit shrinks long values
const METRIC_MIN_FONT_SCALE = 0.7;

// ===== HELPER FUNCTIONS =====

/**
 * Light vs dark ink / fill / border for one progress metric tile.
 * @param {boolean} isDark
 * @returns {{ text: string, muted: string, background: string, border: string }}
 */
function progressCardColors(isDark) {
  if (isDark) {
    return {
      text: DARK_TEXT,
      muted: DARK_MUTED,
      background: DARK_BACKGROUND,
      border: DARK_BORDER,
    };
  }
  return {
    text: LIGHT_TEXT,
    muted: LIGHT_MUTED,
    background: LIGHT_BACKGROUND,
    border: LIGHT_BORDER,
  };
}

/**
 * Platform shadow props for the tile (iOS soft shadow vs Android elevation).
 * @param {boolean} isDark
 * @returns {object}
 */
function cardShadowForTheme(isDark) {
  // vocab: Platform.select = pick one object per OS (iOS shadow* vs Android elevation)
  let shadowOpacity = LIGHT_SHADOW_OPACITY;
  if (isDark) {
    shadowOpacity = DARK_SHADOW_OPACITY;
  }

  return Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: SHADOW_OFFSET_HEIGHT },
      shadowOpacity,
      shadowRadius: SHADOW_RADIUS,
    },
    android: { elevation: ANDROID_ELEVATION },
  });
}

/**
 * Merge base card styles with theme fill, border, shadow, and any caller override.
 * @param {object} colors
 * @param {boolean} isDark
 * @param {object|object[]|undefined} style
 * @returns {Array}
 */
function buildCardChromeStyle(colors, isDark, style) {
  const cardShadow = cardShadowForTheme(isDark);
  return [
    styles.card,
    {
      backgroundColor: colors.background,
      borderColor: colors.border,
      ...cardShadow,
    },
    style,
  ];
}

/**
 * Pure layout for the metric tile (no hooks).
 */
function ProgressTopCardLayout({
  colors,
  isDark,
  icon,
  metric,
  label,
  footer,
  style,
}) {
  // Name decisions before JSX so the return stays a short recipe.
  const cardChromeStyle = buildCardChromeStyle(colors, isDark, style);
  const metricTextStyle = [styles.metric, { color: colors.text }];
  const labelTextStyle = [styles.label, { color: colors.muted }];
  const showFooter = Boolean(footer);

  let footerBlock = null;
  if (showFooter) {
    footerBlock = <View style={styles.footer}>{footer}</View>;
  }

  return (
    <View style={cardChromeStyle}>
      <View style={styles.body}>
        <Ionicons
          name={icon}
          size={ICON_SIZE}
          color={ICON_COLOR}
          style={styles.cornerIcon}
        />
        {/* vocab: adjustsFontSizeToFit = shrink the number until it fits one line */}
        <Text
          style={metricTextStyle}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={METRIC_MIN_FONT_SCALE}
        >
          {metric}
        </Text>
        <Text style={labelTextStyle} numberOfLines={1}>
          {label}
        </Text>
        {footerBlock}
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * One Progress tab metric tile — icon, hero number, caption, optional footer.
 * @param {{ isDark: boolean, icon: string, metric: *, label: string, footer?: *, style?: * }} props
 */
export default function ProgressTopCard({
  isDark,
  icon,
  metric,
  label,
  footer,
  style,
}) {
  // 1. Resolve light/dark palette for text, border, and fill.
  const colors = progressCardColors(isDark);

  // 2. Hand off to the pure layout shell (safe above any future hooks).
  return (
    <ProgressTopCardLayout
      colors={colors}
      isDark={isDark}
      icon={icon}
      metric={metric}
      label={label}
      footer={footer}
      style={style}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 118,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    justifyContent: 'flex-end',
  },
  cornerIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.9,
  },
  metric: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
  },
  label: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 8,
  },
});
