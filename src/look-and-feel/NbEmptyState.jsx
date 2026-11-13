// Design Law empty shell — dashed card, large icon chip, h1, one sentence, one or two buttons.
// Flow: parent passes icon + copy + CTAs when a list/screen has nothing to show.
// Used by drawers, files, marketplace “no results”, and other empty shells.
//
// vocab: dashed = pending/empty borderStyle (Android may ignore radius on dashed)
// Manipulate here: ICON_CHIP 56 keeps the hero chip larger than list NbIconChip (44)

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NbButton from './NbButton';
import NbIconChip from './NbIconChip';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

const ICON_CHIP = 56;

// ===== MAIN FUNCTION =====

/**
 * @param {{
 *   title: string,
 *   subtitle?: string,
 *   iconSource?: number|object,
 *   iconIndex?: number,
 *   iconChildren?: import('react').ReactNode,
 *   primaryLabel?: string,
 *   onPrimary?: () => void,
 *   secondaryLabel?: string,
 *   onSecondary?: () => void,
 *   style?: object,
 * }} props
 */
export default function NbEmptyState({
  title,
  subtitle,
  iconSource,
  iconIndex = 0,
  iconChildren,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  style,
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          borderStyle: 'dashed',
        },
        style,
      ]}
    >
      <NbIconChip source={iconSource} index={iconIndex} size={ICON_CHIP}>
        {iconChildren}
      </NbIconChip>
      <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.sub, { color: colors.nbMuted }]}>{subtitle}</Text>
      ) : null}
      {primaryLabel || secondaryLabel ? (
        <View style={styles.actions}>
          {primaryLabel && typeof onPrimary === 'function' ? (
            <NbButton variant="fill" onPress={onPrimary} style={{ flex: 1 }}>
              {primaryLabel}
            </NbButton>
          ) : null}
          {secondaryLabel && typeof onSecondary === 'function' ? (
            <NbButton variant="ghost" onPress={onSecondary} style={{ flex: 1 }}>
              {secondaryLabel}
            </NbButton>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  sub: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
});
