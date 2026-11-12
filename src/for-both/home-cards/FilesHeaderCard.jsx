// Design Law hero card that opens Notes & Files — NbCard + HardShadow, no purple gradients.
// Flow: show file count + headline → NbButton CTA (badge when newCount > 0).
// Used by client and trainer home/files tabs. Copy falls back to client-facing defaults when omitted.
//
// vocab: NbCard = thick ink border + hard shadow; accents stay on chips/CTA only

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';
import { spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const PICTURE_ICON = require('../../assets/icons/handoff/picture.png');
// Manipulate here: 100+ new files would overflow the badge, so digits stop at 99+.
const NEW_FILE_BADGE_CAP = 99;

const DEFAULT_HEADER_LABEL = 'Files & Documents';
const DEFAULT_HEADLINE = 'Your Notes & Files';
const DEFAULT_SUBHEAD = 'Everything shared between you and your coach, all in one place.';
const DEFAULT_CTA_LABEL = 'Open Notes & Files';
const DEFAULT_STAT_SINGULAR = 'file';
const DEFAULT_STAT_PLURAL = 'files';
const DEFAULT_STAT_SHARED_SUFFIX = 'shared';

// ===== HELPER FUNCTIONS =====

/**
 * vocab/symbol: ?? keeps an explicit empty string if a parent ever passes one.
 */
function resolvedCardCopy({
  headerLabel,
  headline,
  subhead,
  ctaLabel,
  fileCount,
  statSingular,
  statPlural,
  statSharedSuffix,
}) {
  const countWord = fileCount === 1 ? statSingular : statPlural;
  return {
    headerLabel: headerLabel ?? DEFAULT_HEADER_LABEL,
    headline: headline ?? DEFAULT_HEADLINE,
    subhead: subhead ?? DEFAULT_SUBHEAD,
    ctaLabel: ctaLabel ?? DEFAULT_CTA_LABEL,
    countWord,
    sharedSuffix: statSharedSuffix,
  };
}

function newFilesBadgeLabel(newCount) {
  if (newCount > NEW_FILE_BADGE_CAP) return '99+';
  return newCount;
}

// ===== MAIN FUNCTION =====

/**
 * Files & notes hero. `newCount` drives the badge; `fileCount` is the big number.
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
  const { colors } = useTheme();
  const copy = resolvedCardCopy({
    headerLabel,
    headline,
    subhead,
    ctaLabel,
    fileCount,
    statSingular,
    statPlural,
    statSharedSuffix,
  });

  return (
    <View style={styles.wrapper} accessibilityRole="summary" accessibilityLabel="Your files and notes">
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
        android_ripple={{ color: 'rgba(0,0,0,0.08)' }}
      >
        <NbCard style={styles.inner}>
          <View style={styles.headerRow}>
            <Text style={[styles.label, { color: colors.nbMuted }]}>{copy.headerLabel}</Text>
            <NbIconChip source={PICTURE_ICON} index={0} size={40} />
          </View>

          <View style={styles.statRow}>
            <Text style={[styles.statNumber, { color: colors.nbInk }]}>{fileCount}</Text>
            <Text style={[styles.statLabel, { color: colors.nbMuted }]}>
              {copy.countWord} {copy.sharedSuffix}
            </Text>
          </View>

          <Text style={[styles.headline, { color: colors.nbInk }]}>{copy.headline}</Text>
          <Text style={[styles.subhead, { color: colors.nbMuted }]}>{copy.subhead}</Text>

          <View style={styles.ctaWrap}>
            {newCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: colors.nbFill, borderColor: colors.nbBorder }]}>
                <Text style={[styles.badgeText, { color: colors.nbOnFill }]}>
                  {newFilesBadgeLabel(newCount)}
                </Text>
              </View>
            ) : null}
            <NbButton variant="fill" onPress={onPress}>
              {copy.ctaLabel}
            </NbButton>
          </View>
        </NbCard>
      </Pressable>
    </View>
  );
}

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
