// Weekly report hero card on trainer and client dashboards.
// Flow: pick client vs trainer copy → show ready/loading chip → tap opens the report.
// Used by trainer home and client home.
//
// vocab: NbCard / NbButton / NbPill = shared neobrutalist primitives (thick outline, hard shadow)

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { lightColors, darkColors, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbPill from '../../look-and-feel/NbPill';

// ===== NAMED CONSTANTS =====

const BENEFITS_CLIENT = [
  'Week-at-a-glance averages (sleep, water, energy, steps)',
  'Day-by-day recap when your coach runs the report',
  'Trends, wins, and focus areas in one scrollable view',
  'Updated automatically after check-ins each week',
];

const BENEFITS_TRAINER = [
  'Averages for sleep, water, energy, and steps',
  'Seven-day breakdown from their daily check-ins',
  'Trends, wins, and focus areas in one scrollable view',
  'Populates after the scheduled weekly summary job runs',
];

// ===== HELPER FUNCTIONS =====

function firstNameFromDisplay(name) {
  const displayName = String(name || '').trim();
  return displayName.split(/\s+/)[0] || 'Client';
}

function themeColors(isDark) {
  return isDark ? darkColors : lightColors;
}

/** Small status chip — ready / loading / not ready. */
function InlineStatusChip({ isDark, loading, ready }) {
  const colors = themeColors(isDark);
  if (loading) {
    return (
      <View style={[styles.statusChip, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip }]}>
        <ActivityIndicator size="small" color={colors.nbInk} />
      </View>
    );
  }
  if (ready) {
    return <NbPill variant="energy">Ready</NbPill>;
  }
  return (
    <View style={[styles.statusChip, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip }]}>
      <Ionicons name="time-outline" size={13} color={colors.nbMuted} />
      <Text style={[styles.statusText, { color: colors.nbMuted }]}>Not ready</Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Weekly-report entry card. Tap opens the report when one is ready.
 * `audience`: athlete home vs trainer dashboard copy.
 * `variant`: `hero` (default, tall) or `compact` (slim horizontal row).
 */
export default function WeeklyReportBanner({
  onOpenReport,
  isDark = true,
  hasReport = false,
  weekRangeLabel = '',
  reportCount = 0,
  loading = false,
  audience = 'client',
  clientDisplayName = '',
  variant = 'hero',
  compactSurface = 'marketing',
}) {
  const colors = themeColors(isDark);
  const ctaDisabled = loading || !hasReport;
  const benefits = audience === 'trainer' ? BENEFITS_TRAINER : BENEFITS_CLIENT;
  const label = 'Weekly report';
  const headline =
    audience === 'trainer'
      ? `${firstNameFromDisplay(clientDisplayName)}'s weekly reports`
      : 'Your week in review';
  const subhead =
    audience === 'trainer'
      ? hasReport
        ? `Here's a list of all the weekly reports saved so far for this client. Open below to pick a week and read the full recap.`
        : 'No report stored for this client yet. After they log check-ins and the weekly job runs, reports will show up here.'
      : hasReport && weekRangeLabel
        ? `Latest saved report: ${weekRangeLabel}. Open for trends, daily notes, and coaching takeaways.`
        : 'When your trainer’s weekly job runs (after you’ve logged check-ins), your recap lands here — open it anytime from this card.';
  const ctaLabel = loading
    ? 'Loading…'
    : hasReport
      ? audience === 'trainer'
        ? 'Open now'
        : 'Open weekly report'
      : 'Report not ready yet';

  const compactHeadline =
    audience === 'trainer' ? `${firstNameFromDisplay(clientDisplayName)}'s reports` : 'Week in review';
  const compactSub =
    audience === 'trainer'
      ? hasReport
        ? `${weekRangeLabel ? `Latest ${weekRangeLabel} · ` : ''}Tap to open saved weeks.`
        : compactSurface === 'inline'
          ? 'Reports appear after check-ins and the weekly summary job.'
          : 'No report yet — after check-ins and the weekly job, it appears here.'
      : hasReport && weekRangeLabel
        ? `Latest ${weekRangeLabel} · trends & daily notes`
        : 'Recap appears here after your weekly summary runs.';

  // Compact row — trainer dashboard / client home slim entry.
  if (variant === 'compact') {
    const savedCount = reportCount > 0 ? reportCount : hasReport ? 1 : 0;

    return (
      <View style={compactStyles.outer} accessibilityRole="summary" accessibilityLabel="Weekly report">
        <TouchableOpacity
          onPress={onOpenReport}
          disabled={ctaDisabled}
          activeOpacity={ctaDisabled ? 1 : 0.9}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: ctaDisabled }}
        >
          <NbCard style={compactStyles.card}>
            <View style={compactStyles.row}>
              <View style={[compactStyles.iconBubble, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip }]}>
                {loading ? (
                  <ActivityIndicator color={colors.nbInk} size="small" />
                ) : (
                  <Ionicons name="bar-chart" size={22} color={colors.nbInk} />
                )}
              </View>

              <View style={compactStyles.textBlock}>
                <Text style={[compactStyles.label, { color: colors.nbMuted }]}>{label.toUpperCase()}</Text>
                <Text style={[compactStyles.headline, { color: colors.nbInk }]} numberOfLines={1}>
                  {compactHeadline}
                </Text>
                {compactSub ? (
                  <Text style={[compactStyles.sub, { color: colors.nbMuted }]} numberOfLines={2}>
                    {compactSub}
                  </Text>
                ) : null}
                {savedCount > 1 ? (
                  <View style={compactStyles.chipRow}>
                    <NbPill>{`${savedCount} weeks saved`}</NbPill>
                  </View>
                ) : null}
              </View>

              {ctaDisabled ? (
                <InlineStatusChip isDark={isDark} loading={loading} ready={false} />
              ) : (
                <NbButton variant="brand" sm onPress={onOpenReport}>
                  Open
                </NbButton>
              )}
            </View>
          </NbCard>
        </TouchableOpacity>
      </View>
    );
  }

  // Hero card — full benefits list + primary CTA (one brand gradient moment via NbButton).
  return (
    <View style={styles.outer} accessibilityRole="summary" accessibilityLabel="Weekly report">
      <NbCard style={styles.card}>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.nbMuted }]}>{label}</Text>
          <Text style={[styles.headline, { color: colors.nbInk }]}>{headline}</Text>
          <Text style={[styles.subhead, { color: colors.nbMuted }]}>{subhead}</Text>

          <View style={styles.benefits}>
            {benefits.map((line) => (
              <View key={line} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={18} color={colors.nbInk} style={styles.checkIcon} />
                <Text style={[styles.benefitText, { color: colors.nbInk }]}>{line}</Text>
              </View>
            ))}
          </View>

          <NbButton
            variant="brand"
            onPress={onOpenReport}
            disabled={ctaDisabled}
            style={styles.ctaButton}
          >
            {ctaLabel}
          </NbButton>
        </View>
      </NbCard>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  card: {
    padding: 0,
  },
  content: {
    padding: 20,
    gap: 14,
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    lineHeight: 30,
  },
  subhead: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 21,
  },
  benefits: {
    gap: spacing.sm,
    marginTop: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
  ctaButton: {
    marginTop: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
  },
  statusText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
  },
});

const compactStyles = StyleSheet.create({
  outer: {
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 0,
  },
  card: {
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: 10,
    gap: 10,
    minHeight: 56,
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  headline: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  sub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  chipRow: {
    marginTop: 6,
  },
});
