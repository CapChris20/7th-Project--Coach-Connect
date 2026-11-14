// Notes & Files hero card on home — count, headline, and Open CTA with optional new-file badge.
// Flow: merge copy defaults → decide badge → Pressable NbCard (label + chip, count, headline, CTA).
// Used by client and trainer home/files tabs (ClientAppStart and related home pieces).

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const PICTURE_ICON = require('../../assets/icons/handoff/picture.png');

// Manipulate here: badge digits stop at 99+ so a huge newCount cannot blow the layout
const NEW_FILE_BADGE_CAP = 99;

const DEFAULT_HEADER_LABEL = 'Files & Documents';
const DEFAULT_HEADLINE = 'Your Notes & Files';
const DEFAULT_SUBHEAD = 'Everything shared between you and your coach, all in one place.';
const DEFAULT_CTA_LABEL = 'Open Notes & Files';
const DEFAULT_STAT_SINGULAR = 'file';
const DEFAULT_STAT_PLURAL = 'files';
const DEFAULT_STAT_SHARED_SUFFIX = 'shared';

const ACCESSIBILITY_SUMMARY_LABEL = 'Your files and notes';
const ANDROID_RIPPLE_COLOR = 'rgba(0,0,0,0.08)';

// ===== HELPER FUNCTIONS =====

function countWordForFileTotal(fileCount, singularWord, pluralWord) {
  if (fileCount === 1) {
    return singularWord;
  }
  return pluralWord;
}

function mergeFilesCardCopy(copyParts) {
  // vocab: ?? = use the right side only when the left is null or undefined (not when "")
  const headerLabel = copyParts.headerLabel ?? DEFAULT_HEADER_LABEL;
  const headline = copyParts.headline ?? DEFAULT_HEADLINE;
  const subhead = copyParts.subhead ?? DEFAULT_SUBHEAD;
  const ctaLabel = copyParts.ctaLabel ?? DEFAULT_CTA_LABEL;
  const countWord = countWordForFileTotal(
    copyParts.fileCount,
    copyParts.statSingular,
    copyParts.statPlural,
  );

  return {
    headerLabel,
    headline,
    subhead,
    ctaLabel,
    countWord,
    sharedSuffix: copyParts.statSharedSuffix,
  };
}

function labelForNewFilesBadge(newCount) {
  if (newCount > NEW_FILE_BADGE_CAP) {
    return '99+';
  }
  return newCount;
}

function pressableStyleFromState({ pressed }) {
  if (pressed) {
    return [styles.pressable, styles.pressablePressed];
  }
  return styles.pressable;
}

function FilesCardHeaderRow({ headerLabel, mutedColor }) {
  return (
    <View style={styles.headerRow}>
      <Text style={[styles.label, { color: mutedColor }]}>{headerLabel}</Text>
      <NbIconChip source={PICTURE_ICON} index={0} size={40} />
    </View>
  );
}

function FilesCountRow({ fileCount, countWord, sharedSuffix, inkColor, mutedColor }) {
  const countLine = `${countWord} ${sharedSuffix}`;
  return (
    <View style={styles.statRow}>
      <Text style={[styles.statNumber, { color: inkColor }]}>{fileCount}</Text>
      <Text style={[styles.statLabel, { color: mutedColor }]}>{countLine}</Text>
    </View>
  );
}

function NewFilesBadgeChip({ badgeLabel, fillColor, borderColor, onFillColor }) {
  return (
    <View style={[styles.badge, { backgroundColor: fillColor, borderColor }]}>
      <Text style={[styles.badgeText, { color: onFillColor }]}>{badgeLabel}</Text>
    </View>
  );
}

function FilesCardCtaBlock({
  showNewFilesBadge,
  badgeLabel,
  ctaLabel,
  onPress,
  colors,
}) {
  let badgeNode = null;
  if (showNewFilesBadge) {
    badgeNode = (
      <NewFilesBadgeChip
        badgeLabel={badgeLabel}
        fillColor={colors.nbFill}
        borderColor={colors.nbBorder}
        onFillColor={colors.nbOnFill}
      />
    );
  }

  return (
    <View style={styles.ctaWrap}>
      {badgeNode}
      <NbButton variant="fill" onPress={onPress}>
        {ctaLabel}
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Files & notes hero. `fileCount` is the big number; `newCount` drives the corner badge.
 * Parent still may pass `isDark` — we ignore it and read theme from useTheme instead.
 * @param {object} props
 */
export default function FilesHeaderCard({
  onPress,
  fileCount = 0,
  newCount = 0,
  isDark: _isDarkIgnored,
  headerLabel,
  headline,
  subhead,
  ctaLabel,
  statSingular = DEFAULT_STAT_SINGULAR,
  statPlural = DEFAULT_STAT_PLURAL,
  statSharedSuffix = DEFAULT_STAT_SHARED_SUFFIX,
}) {
  // vocab: useTheme = Design Law light/dark tokens (nbInk, nbMuted, nbFill, …)
  const { colors } = useTheme();

  // 1. Merge caller copy with Design Law defaults (empty string from parent still wins).
  const cardCopy = mergeFilesCardCopy({
    headerLabel,
    headline,
    subhead,
    ctaLabel,
    fileCount,
    statSingular,
    statPlural,
    statSharedSuffix,
  });

  // 2. Name badge decisions before JSX so the tree stays flat.
  const showNewFilesBadge = newCount > 0;
  const badgeLabel = labelForNewFilesBadge(newCount);

  // 3. Paint the pressable NbCard hero.
  return (
    <View
      style={styles.wrapper}
      accessibilityRole="summary"
      accessibilityLabel={ACCESSIBILITY_SUMMARY_LABEL}
    >
      <Pressable
        onPress={onPress}
        style={pressableStyleFromState}
        android_ripple={{ color: ANDROID_RIPPLE_COLOR }}
      >
        <NbCard style={styles.inner}>
          <FilesCardHeaderRow
            headerLabel={cardCopy.headerLabel}
            mutedColor={colors.nbMuted}
          />

          <FilesCountRow
            fileCount={fileCount}
            countWord={cardCopy.countWord}
            sharedSuffix={cardCopy.sharedSuffix}
            inkColor={colors.nbInk}
            mutedColor={colors.nbMuted}
          />

          <Text style={[styles.headline, { color: colors.nbInk }]}>
            {cardCopy.headline}
          </Text>
          <Text style={[styles.subhead, { color: colors.nbMuted }]}>
            {cardCopy.subhead}
          </Text>

          <FilesCardCtaBlock
            showNewFilesBadge={showNewFilesBadge}
            badgeLabel={badgeLabel}
            ctaLabel={cardCopy.ctaLabel}
            onPress={onPress}
            colors={colors}
          />
        </NbCard>
      </Pressable>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: spacing.md,
  },
  pressablePressed: {
    opacity: 0.94,
  },
  pressable: {},
  inner: {
    padding: 20,
    minHeight: 200,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 14,
  },
  statNumber: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1,
  },
  statLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    letterSpacing: -0.2,
  },
  headline: {
    marginTop: 6,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    lineHeight: 28,
  },
  subhead: {
    marginTop: 6,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  ctaWrap: {
    marginTop: 16,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: 8,
    zIndex: 10,
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
  },
});
