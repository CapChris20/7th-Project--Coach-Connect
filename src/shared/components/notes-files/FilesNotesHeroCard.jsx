/**
 * Files Notes Hero Card
 *
 * Purpose: UI screen or component: Files Notes Hero Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: FilesNotesHeroCard
 *
 * @file-header
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const BG_GRADIENT_DARK = ['#1a0a2e', '#0f0a1a'];
const BG_GRADIENT_LIGHT = ['#F8FAFF', '#FFFFFF'];
const TOP_BORDER_GRADIENT = ['#C084FC', '#FF6B9D'];
const CTA_GRADIENT = ['#C084FC', '#FF6B9D'];
const PURPLE = '#C084FC';
const CYAN = '#06B6D4';
const PINK = '#FF6B9D';
const INK = '#0A0A0F';

const FEATURES = [
  { icon: 'document-text-outline', label: 'Docs' },
  { icon: 'camera-outline', label: 'Photos' },
  { icon: 'chatbubble-outline', label: 'Notes' },
  { icon: 'cloud-upload-outline', label: 'Uploads' },
];

/**
 * @param {number} fileCount  — total files in the tab
 * @param {number} newCount   — unread / newly added files (drives the red badge)
 * @param {string} [headerLabel]  — top-left kicker (default: client-facing copy)
 * @param {string} [headline]
 * @param {string} [subhead]
 * @param {string} [ctaLabel]
 * @param {string} [statSingular]  — word after count when count === 1 (default: "file")
 * @param {string} [statPlural]    — word after count when count !== 1 (default: "files")
 * @param {string} [statSharedSuffix] — e.g. "shared" / "in workspace" (default: "shared")
 */
export default function FilesNotesHeroCard({
  onPress,
  fileCount = 0,
  newCount = 0,
  isDark = true,
  headerLabel,
  headline,
  subhead,
  ctaLabel,
  statSingular = 'file',
  statPlural = 'files',
  statSharedSuffix = 'shared',
}) {
  const bgGradient = isDark ? BG_GRADIENT_DARK : BG_GRADIENT_LIGHT;
  const hLabel = headerLabel ?? 'Files & Documents';
  const hLine = headline ?? 'Your Notes & Files';
  const sub = subhead ?? 'Everything shared between you and your coach, all in one place.';
  const cta = ctaLabel ?? 'Open Notes & Files';
  const statWord = fileCount === 1 ? statSingular : statPlural;
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.55)';
  const headlineColor = isDark ? '#FFFFFF' : INK;
  const subheadColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.6)';
  const pillBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.06)';
  const pillText = isDark ? '#FFFFFF' : INK;
  const badgeBorder = isDark ? '#1a0a2e' : '#FFFFFF';
  const statSubColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,15,0.5)';

  return (
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
              colors={TOP_BORDER_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topBorder}
            />
            <LinearGradient
              colors={bgGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.inner}
            >
              <View style={styles.headerRow}>
                <Text style={[styles.label, { color: labelColor }]}>{hLabel}</Text>
                <Ionicons name="folder-open-outline" size={24} color={PURPLE} />
              </View>

              {/* Big stat row */}
              <View style={styles.statRow}>
                <Text style={styles.statNumber}>{fileCount}</Text>
                <Text style={[styles.statLabel, { color: statSubColor }]}>
                  {statWord} {statSharedSuffix}
                </Text>
              </View>

              <Text style={[styles.headline, { color: headlineColor }]}>{hLine}</Text>

              <Text style={[styles.subhead, { color: subheadColor }]}>{sub}</Text>

              <View style={styles.pillsRow}>
                {FEATURES.map(({ icon, label }) => (
                  <View key={label} style={[styles.pill, { backgroundColor: pillBg }]}>
                    <Ionicons name={icon} size={12} color={PURPLE} style={styles.pillIcon} />
                    <Text style={[styles.pillText, { color: pillText }]} numberOfLines={1}>
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.ctaWrap}>
                {newCount > 0 && (
                  <View style={[styles.badge, { borderColor: badgeBorder }]}>
                    <Text style={styles.badgeText}>
                      {newCount > 99 ? '99+' : newCount}
                    </Text>
                  </View>
                )}
                <LinearGradient
                  colors={CTA_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <View style={styles.ctaInner}>
                    <Ionicons name="folder-open-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.ctaText}>{cta}</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </View>
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
        shadowColor: '#C084FC',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.32,
        shadowRadius: 16,
      },
      android: { elevation: 10 },
    }),
  },
  cardClip: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  topBorder: {
    height: 3,
    width: '100%',
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
    color: '#06B6D4',
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
