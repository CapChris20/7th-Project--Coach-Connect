// Neobrutalist list row — title, optional subtitle, right accessory, one press target.
// Flow: Pressable wrapper → bordered surface → text stack on the left + right slot.
// Used by: settings screens, menu lists, navigation lists, Pro upgrade benefit stacks.
//
// vocab: right = trailing accessory node (icon, badge, chevron) without forcing its layout
// vocab: Pressable = RN tap target; whole row is one hit area
// Manipulate here: row minHeight nb.minTouchTarget; paddingVertical spacing.sm + 4

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====
// (row padding / type sizes live in StyleSheet plumbing)

// ===== HELPER FUNCTIONS =====

function buildRowSurfaceColors(themeColors) {
  return {
    backgroundColor: themeColors.nbSurface,
    borderColor: themeColors.nbBorder,
  };
}

function buildTitleTextStyle(inkColor) {
  return [styles.title, { color: inkColor }];
}

function buildSubtitleTextStyle(mutedColor) {
  return [styles.subtitle, { color: mutedColor }];
}

function buildRowSurfaceStyle(rowSurfaceColors) {
  return [styles.row, rowSurfaceColors];
}

// ===== SMALL UI PIECES =====

function ListRowTitleLine({ titleText, inkColor }) {
  const titleStyle = buildTitleTextStyle(inkColor);
  return (
    <Text style={titleStyle} numberOfLines={1}>
      {titleText}
    </Text>
  );
}

function ListRowSubtitleLine({ subtitleText, mutedColor }) {
  if (!subtitleText) {
    return null;
  }
  const subtitleStyle = buildSubtitleTextStyle(mutedColor);
  return (
    <Text style={subtitleStyle} numberOfLines={1}>
      {subtitleText}
    </Text>
  );
}

function ListRowTextStack({ titleText, subtitleText, inkColor, mutedColor }) {
  return (
    <View style={styles.textContainer}>
      <ListRowTitleLine titleText={titleText} inkColor={inkColor} />
      <ListRowSubtitleLine
        subtitleText={subtitleText}
        mutedColor={mutedColor}
      />
    </View>
  );
}

function ListRowRightAccessory({ rightNode }) {
  if (!rightNode) {
    return null;
  }
  return <View style={styles.rightContainer}>{rightNode}</View>;
}

function ListRowSurface({
  titleText,
  subtitleText,
  rightNode,
  themeColors,
}) {
  const rowSurfaceColors = buildRowSurfaceColors(themeColors);
  const rowSurfaceStyle = buildRowSurfaceStyle(rowSurfaceColors);

  return (
    <View style={rowSurfaceStyle}>
      <ListRowTextStack
        titleText={titleText}
        subtitleText={subtitleText}
        inkColor={themeColors.nbInk}
        mutedColor={themeColors.nbMuted}
      />
      <ListRowRightAccessory rightNode={rightNode} />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Standard list row with title, subtitle, and right accessory.
 * @param {object} props
 * @param {string} props.title - main title
 * @param {string} [props.subtitle] - optional subtitle
 * @param {import('react').ReactNode} [props.right] - right accessory (icon, text, badge)
 * @param {Function} [props.onPress] - press handler
 * @param {object} [props.style] - additional Pressable styles
 */
export default function NbListRow({ title, subtitle, right, onPress, style }) {
  // vocab: useTheme = ThemeProvider hook — surface/ink/muted follow Design Law tokens
  const { colors: themeColors } = useTheme();

  // 1. Paint the bordered surface inside one press target.
  return (
    <Pressable onPress={onPress} style={style}>
      <ListRowSurface
        titleText={title}
        subtitleText={subtitle}
        rightNode={right}
        themeColors={themeColors}
      />
    </Pressable>
  );
}

// PLUMBING — skip unless debugging

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: nb.minTouchTarget,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: spacing.sm,
  },
});
