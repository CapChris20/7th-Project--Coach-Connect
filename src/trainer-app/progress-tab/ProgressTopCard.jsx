// One stat tile on the trainer's Progress tab (big number + label + optional footer row).
// Flow: parent passes icon/metric/label → we resolve theme colors → render a bordered card.
// Used in the grid of metric cards at the top of the trainer Progress tab.

import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
// vocab: Ionicons = icon font from Expo's vector-icons; `name` selects a glyph by string id
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const DARK_TEXT = '#FFFFFF';
const LIGHT_TEXT = '#0A0A0F';
const DARK_MUTED = 'rgba(255,255,255,0.55)';
const LIGHT_MUTED = 'rgba(10,10,15,0.55)';
const DARK_BACKGROUND = '#14141C';
const LIGHT_BACKGROUND = '#FFFFFF';
const DARK_BORDER = 'rgba(255,255,255,0.10)';
const LIGHT_BORDER = 'rgba(10,10,15,0.08)';
const SHADOW_COLOR = '#000';
const DARK_SHADOW_OPACITY = 0.25;
const LIGHT_SHADOW_OPACITY = 0.08;
const ICON_COLOR = '#FDBA74';
const ICON_SIZE = 20;
const METRIC_MIN_FONT_SCALE = 0.7;

// ===== HELPER FUNCTIONS =====

function progressCardColors(isDark) {
  // Theme colors are computed per render rather than pulled from a stylesheet because they flip
  // with light/dark mode. Manipulate here: muted uses low-alpha black/white instead of a solid
  // grey so it blends with whatever card background sits behind it.
  return {
    text: isDark ? DARK_TEXT : LIGHT_TEXT,
    muted: isDark ? DARK_MUTED : LIGHT_MUTED,
    background: isDark ? DARK_BACKGROUND : LIGHT_BACKGROUND,
    border: isDark ? DARK_BORDER : LIGHT_BORDER,
  };
}

function cardShadow(isDark) {
  // iOS and Android have completely different shadow systems, so there's no single set of
  // props that works on both — Platform.select picks the right one at runtime.
  // vocab: Platform.select = return the value for the current OS
  // Manipulate here: shadowOpacity is higher in dark mode because a soft shadow is nearly
  // invisible against a dark background; `elevation` is Android's single shadow dial.
  return Platform.select({
    ios: {
      shadowColor: SHADOW_COLOR,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? DARK_SHADOW_OPACITY : LIGHT_SHADOW_OPACITY,
      shadowRadius: 8,
    },
    android: { elevation: 2 },
  });
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ isDark: boolean, icon: string, metric: string|number, label: string, footer?: import('react').ReactNode, style?: object }} props
 * @returns {import('react').ReactElement}
 */
export default function ProgressTopCard({
  isDark,
  icon,
  metric,
  label,
  // `footer` is a rendered node (not a string) so callers can drop in a trend pill, sparkline,
  // or nothing at all without this component knowing what those look like.
  footer,
  // `style` lets the parent grid own the layout (widths, gaps) while we own the card's look.
  style,
}) {
  const colors = progressCardColors(isDark);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
          ...cardShadow(isDark),
        },
        // Caller style goes LAST so the parent can override anything above it.
        style,
      ]}
    >
      <View style={styles.body}>
        {/* Icon is absolutely positioned (see styles.cornerIcon) so it floats in the top-right
            and doesn't participate in the bottom-aligned text stack below it.
            Manipulate here: ICON_COLOR is the shared amber accent for every progress metric. */}
        <Ionicons name={icon} size={ICON_SIZE} color={ICON_COLOR} style={styles.cornerIcon} />
        {/* The headline number. numberOfLines={1} + adjustsFontSizeToFit is the pairing that
            makes a long value ("184.5 lbs") shrink to fit instead of wrapping or being cut off.
            Manipulate here: METRIC_MIN_FONT_SCALE is the shrink floor — below that the number
            gets too small to read at a glance. */}
        <Text
          style={[styles.metric, { color: colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={METRIC_MIN_FONT_SCALE}
        >
          {metric}
        </Text>
        <Text style={[styles.label, { color: colors.muted }]} numberOfLines={1}>
          {label}
        </Text>
        {/* Render the footer row only when one was passed. Returning null (not undefined or false)
            keeps the empty case from reserving the footer's marginTop. */}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    // flex: 1 makes sibling cards in a row share width equally.
    flex: 1,
    // Manipulate here: borderRadius sets the card's roundness; minHeight guarantees every card in
    // the grid is the same height even when one has no footer.
    borderRadius: 16,
    borderWidth: 1,
    // overflow hidden clips the rounded corners — without it, the corner icon could poke past them.
    overflow: 'hidden',
    minHeight: 118,
  },
  body: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    // flex-end is the key layout choice: content is pushed to the BOTTOM of the card, so cards
    // with different amounts of content still have their big numbers on the same baseline.
    justifyContent: 'flex-end',
  },
  cornerIcon: {
    // Absolute removes the icon from the flex flow so it can't push the number down.
    // Manipulate here: top/right are the inset from the card corner.
    position: 'absolute',
    top: 12,
    right: 12,
    opacity: 0.9,
  },
  metric: {
    // Manipulate here: this is the "hero number" type. Negative letterSpacing tightens the big
    // digits (they look gappy at this size), and lineHeight slightly above fontSize stops tall
    // glyphs from clipping.
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
  },
  label: {
    // Manipulate here: small, bold, slightly tracked-out caption under the number.
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 8,
  },
});
