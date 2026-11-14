// Design Law empty shell — dashed card, large icon chip, title, one sentence, up to two CTAs.
// Flow: parent passes icon + copy + handlers when a list/screen has nothing to show.
// Used by: drawers, files, marketplace “no results”, and other empty shells.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import NbButton from './NbButton';
import NbIconChip from './NbIconChip';
import { borderRadius, nb, spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====

// Manipulate here: 56 keeps the empty hero chip larger than list NbIconChip (44)
const EMPTY_STATE_ICON_CHIP_SIZE = 56;
const EMPTY_STATE_BORDER_STYLE = 'dashed';
const ACTION_BUTTON_FLEX_STYLE = { flex: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * Optional muted sentence under the title. Null when parent skipped subtitle.
 */
function EmptyStateSubtitle({ subtitle, mutedColor }) {
  if (!subtitle) {
    return null;
  }
  return (
    <Text style={[styles.sub, { color: mutedColor }]}>{subtitle}</Text>
  );
}

/**
 * Primary (fill) + secondary (ghost) CTAs. Mounts only when a label AND handler pair exist.
 */
function EmptyStateActionRow({
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  const primaryHandlerIsFunction = typeof onPrimary === 'function';
  const secondaryHandlerIsFunction = typeof onSecondary === 'function';
  const showPrimaryButton = Boolean(primaryLabel) && primaryHandlerIsFunction;
  const showSecondaryButton = Boolean(secondaryLabel) && secondaryHandlerIsFunction;
  const hasAnyAction = showPrimaryButton || showSecondaryButton;

  if (!hasAnyAction) {
    return null;
  }

  let primaryButtonNode = null;
  if (showPrimaryButton) {
    primaryButtonNode = (
      <NbButton variant="fill" onPress={onPrimary} style={ACTION_BUTTON_FLEX_STYLE}>
        {primaryLabel}
      </NbButton>
    );
  }

  let secondaryButtonNode = null;
  if (showSecondaryButton) {
    secondaryButtonNode = (
      <NbButton variant="ghost" onPress={onSecondary} style={ACTION_BUTTON_FLEX_STYLE}>
        {secondaryLabel}
      </NbButton>
    );
  }

  return (
    <View style={styles.actions}>
      {primaryButtonNode}
      {secondaryButtonNode}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Centered empty shell: dashed card → icon → title → optional subtitle → optional CTAs.
 *
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
  // vocab: useTheme = Design Law light/dark tokens (nbInk, nbSurface, nbBorder, …)
  const { colors } = useTheme();

  // 1. Dashed card chrome signals “nothing here yet” without a second empty list row.
  // vocab: borderStyle dashed = pending/empty look (Android may ignore radius on dashed)
  const dashedCardChrome = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    borderStyle: EMPTY_STATE_BORDER_STYLE,
  };

  // 2. Stack icon chip + title + optional subtitle + optional actions, center-aligned.
  return (
    <View style={[styles.card, dashedCardChrome, style]}>
      <NbIconChip source={iconSource} index={iconIndex} size={EMPTY_STATE_ICON_CHIP_SIZE}>
        {iconChildren}
      </NbIconChip>
      <Text style={[styles.title, { color: colors.nbInk }]}>{title}</Text>
      <EmptyStateSubtitle subtitle={subtitle} mutedColor={colors.nbMuted} />
      <EmptyStateActionRow
        primaryLabel={primaryLabel}
        onPrimary={onPrimary}
        secondaryLabel={secondaryLabel}
        onSecondary={onSecondary}
      />
    </View>
  );
}

// PLUMBING — skip unless debugging spacing / type
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
