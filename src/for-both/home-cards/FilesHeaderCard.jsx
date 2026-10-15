// Hero card that opens Notes & Files. Shows how many files exist and how many are new.
// Flow: pick dark/light colors → show the count + four feature chips → badge the CTA when newCount > 0.
// Used by client and trainer home/files tabs. Copy falls back to client-facing defaults when omitted.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const BG_GRADIENT_DARK = ['#1a0a2e', '#0f0a1a'];
const BG_GRADIENT_LIGHT = ['#F8FAFF', '#FFFFFF'];
// Manipulate here: dark orange → dark purple. Same pair as the CTA glow.
const ORANGE_PURPLE_GRADIENT = ['#C2410C', '#4C1D95'];
const CTA_GRADIENT = ORANGE_PURPLE_GRADIENT;
const PINK = '#FF6B9D';
const INK = '#0A0A0F';
// Manipulate here: 100+ new files would overflow the red circle, so the digits stop at 99+.
const NEW_FILE_BADGE_CAP = 99;

const DEFAULT_HEADER_LABEL = 'Files & Documents';
const DEFAULT_HEADLINE = 'Your Notes & Files';
const DEFAULT_SUBHEAD = 'Everything shared between you and your coach, all in one place.';
const DEFAULT_CTA_LABEL = 'Open Notes & Files';
const DEFAULT_STAT_SINGULAR = 'file';
const DEFAULT_STAT_PLURAL = 'files';
const DEFAULT_STAT_SHARED_SUFFIX = 'shared';

// Manipulate here: the four chips under the headline. Icon names are Ionicons.
const FEATURES = [
  { icon: 'document-text-outline', label: 'Docs' },
  { icon: 'camera-outline', label: 'Photos' },
  { icon: 'chatbubble-outline', label: 'Notes' },
  { icon: 'cloud-upload-outline', label: 'Uploads' },
];

// ===== HELPER FUNCTIONS =====

/**
 * Dark vs light text/fill for the card. Kept in one place so the JSX only paints.
 * @param {boolean} isDark
 * @returns {object}
 */
function filesCardPalette(isDark) {
  if (isDark) {
    return {
      backgroundGradient: BG_GRADIENT_DARK,
      labelColor: 'rgba(255,255,255,0.45)',
      headlineColor: '#FFFFFF',
      subheadColor: 'rgba(255,255,255,0.6)',
      pillBackground: 'rgba(255,255,255,0.08)',
      pillText: '#FFFFFF',
      badgeBorder: '#1a0a2e',
      statSubColor: 'rgba(255,255,255,0.5)',
    };
  }
  return {
    backgroundGradient: BG_GRADIENT_LIGHT,
    labelColor: 'rgba(10,10,15,0.55)',
    headlineColor: INK,
    subheadColor: 'rgba(10,10,15,0.6)',
    pillBackground: 'rgba(10,10,15,0.06)',
    pillText: INK,
    badgeBorder: '#FFFFFF',
    statSubColor: 'rgba(10,10,15,0.5)',
  };
}

/**
 * vocab/symbol: ?? keeps an explicit empty string if a parent ever passes one.
 * @param {object} props
 * @returns {object}
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

/**
 * 100+ new files would overflow the red circle, so the digits stop at 99+.
 * @param {number} newCount
 * @returns {string|number}
 */
function newFilesBadgeLabel(newCount) {
  if (newCount > NEW_FILE_BADGE_CAP) return '99+';
  return newCount;
}

/**
 * @param {object} palette
 */
function FeaturePills({ palette }) {
  return (
    <View style={styles.pillsRow}>
      {FEATURES.map((feature) => (
        <View key={feature.label} style={[styles.pill, { backgroundColor: palette.pillBackground }]}>
          <Ionicons name={feature.icon} size={12} color={PINK} style={styles.pillIcon} />
          <Text style={[styles.pillText, { color: palette.pillText }]} numberOfLines={1}>
            {feature.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Orange-purple bar. The red bubble sits on the top-right when there are unread files.
 * @param {object} props
 */
function OpenFilesButton({ ctaLabel, newCount, palette }) {
  const hasNewFiles = newCount > 0;
  return (
    <View style={styles.ctaWrap}>
      {hasNewFiles ? (
        <View style={[styles.badge, { borderColor: palette.badgeBorder }]}>
          <Text style={styles.badgeText}>{newFilesBadgeLabel(newCount)}</Text>
        </View>
      ) : null}
      <LinearGradient
        colors={CTA_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.ctaGradient}
      >
        <View style={styles.ctaInner}>
          <Ionicons name="folder-open-outline" size={16} color="#FFFFFF" />
          <Text style={styles.ctaText}>{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </LinearGradient>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Files & notes hero. `newCount` drives the red badge; `fileCount` is the big number.
 * @param {object} props
 */
export default function FilesHeaderCard({
  onPress,
  fileCount = 0,
  newCount = 0,
  isDark = true,
  headerLabel,
  headline,
  subhead,
  ctaLabel,
  statSingular = DEFAULT_STAT_SINGULAR,
  statPlural = DEFAULT_STAT_PLURAL,
  statSharedSuffix = DEFAULT_STAT_SHARED_SUFFIX,
}) {
  const palette = filesCardPalette(isDark);
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

  // 1. Dark vs light paint, then the copy the parent passed (or the client defaults).
  // 2. Paint the hero. The red badge only appears when newCount is above 0.
  return (
    // vocab: Pressable = tap target that reports pressed/hovered. LinearGradient = expo fill between two colors.
    <View style={styles.wrapper} accessibilityRole="summary" accessibilityLabel="Your files and notes">
      <Pressable
        onPress={onPress}
        style={({ pressed, hovered }) => [
          styles.pressable,
          pressed && styles.pressablePressed,
          hovered && styles.pressableHovered,
        ]}
        android_ripple={{ color: 'rgba(255,255,255,0.12)' }}
      >
        <View style={styles.cardShadow}>
          <View style={styles.cardClip}>
            <LinearGradient
              colors={palette.backgroundGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.inner}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.label, { color: palette.labelColor }]}>{copy.headerLabel}</Text>
                <Ionicons name="folder-open-outline" size={24} color={PINK} />
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statNumber}>{fileCount}</Text>
                <Text style={[styles.statLabel, { color: palette.statSubColor }]}>
                  {copy.countWord} {copy.sharedSuffix}
                </Text>
              </View>

              <Text style={[styles.headline, { color: palette.headlineColor }]}>{copy.headline}</Text>

              <Text style={[styles.subhead, { color: palette.subheadColor }]}>{copy.subhead}</Text>

              <FeaturePills palette={palette} />

              <OpenFilesButton ctaLabel={copy.ctaLabel} newCount={newCount} palette={palette} />
            </LinearGradient>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  pressable: {
    borderRadius: 24,
  },
  pressablePressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  pressableHovered: {
    ...Platform.select({
      web: { transform: [{ translateY: -2 }] },
      default: {},
    }),
  },
  cardShadow: {
    borderRadius: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#C2410C',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.38,
        shadowRadius: 18,
      },
      android: { elevation: 10 },
    }),
  },
  cardClip: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  inner: {
    padding: 24,
    minHeight: 220,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
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
    fontSize: 42,
    fontWeight: '900',
    color: PINK,
    lineHeight: 46,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headline: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
  },
  subhead: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  pill: {
    flex: 1,
    minWidth: 0,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pillIcon: {
    marginTop: 0,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '600',
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
    backgroundColor: '#FF3B30',
    borderRadius: 11,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  ctaGradient: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 48,
    justifyContent: 'center',
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 16,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
