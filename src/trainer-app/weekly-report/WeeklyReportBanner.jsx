// Weekly report hero / compact card on trainer and client dashboards.
// Flow: pick audience copy → ready/loading/not-ready chrome → tap opens the report.
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

// Manipulate here: bullet copy for the full hero card (client vs trainer wording)
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

const LABEL_WEEKLY_REPORT = 'Weekly report';
const AUDIENCE_TRAINER = 'trainer';
const VARIANT_COMPACT = 'compact';
const COMPACT_SURFACE_INLINE = 'inline';
const DEFAULT_CLIENT_FIRST_NAME = 'Client';
const STATUS_ICON_SIZE = 13;
const COMPACT_CHART_ICON_SIZE = 22;
const BENEFIT_CHECK_ICON_SIZE = 18;

// ===== HELPER FUNCTIONS =====

/**
 * First word of a display name, or "Client" when empty.
 * @param {string} name
 * @returns {string}
 */
function firstNameFromDisplay(name) {
  const displayName = String(name || '').trim();
  const nameParts = displayName.split(/\s+/);
  const firstPart = nameParts[0];
  if (!firstPart) {
    return DEFAULT_CLIENT_FIRST_NAME;
  }
  return firstPart;
}

function themeColorsForMode(isDark) {
  if (isDark) {
    return darkColors;
  }
  return lightColors;
}

function heroHeadline(audience, clientDisplayName) {
  if (audience === AUDIENCE_TRAINER) {
    const firstName = firstNameFromDisplay(clientDisplayName);
    return `${firstName}'s weekly reports`;
  }
  return 'Your week in review';
}

function trainerHeroSubhead(hasReport) {
  if (hasReport) {
    return "Here's a list of all the weekly reports saved so far for this client. Open below to pick a week and read the full recap.";
  }
  return 'No report stored for this client yet. After they log check-ins and the weekly job runs, reports will show up here.';
}

function clientHeroSubhead(hasReport, weekRangeLabel) {
  if (hasReport && weekRangeLabel) {
    return `Latest saved report: ${weekRangeLabel}. Open for trends, daily notes, and coaching takeaways.`;
  }
  return "When your trainer's weekly job runs (after you've logged check-ins), your recap lands here — open it anytime from this card.";
}

function heroSubhead(audience, hasReport, weekRangeLabel) {
  if (audience === AUDIENCE_TRAINER) {
    return trainerHeroSubhead(hasReport);
  }
  return clientHeroSubhead(hasReport, weekRangeLabel);
}

function heroCtaLabel(audience, loading, hasReport) {
  if (loading) {
    return 'Loading…';
  }
  if (!hasReport) {
    return 'Report not ready yet';
  }
  if (audience === AUDIENCE_TRAINER) {
    return 'Open now';
  }
  return 'Open weekly report';
}

function compactHeadline(audience, clientDisplayName) {
  if (audience === AUDIENCE_TRAINER) {
    const firstName = firstNameFromDisplay(clientDisplayName);
    return `${firstName}'s reports`;
  }
  return 'Week in review';
}

function trainerCompactSubhead(hasReport, weekRangeLabel, compactSurface) {
  if (hasReport) {
    let latestPrefix = '';
    if (weekRangeLabel) {
      latestPrefix = `Latest ${weekRangeLabel} · `;
    }
    return `${latestPrefix}Tap to open saved weeks.`;
  }
  if (compactSurface === COMPACT_SURFACE_INLINE) {
    return 'Reports appear after check-ins and the weekly summary job.';
  }
  return 'No report yet — after check-ins and the weekly job, it appears here.';
}

function clientCompactSubhead(hasReport, weekRangeLabel) {
  if (hasReport && weekRangeLabel) {
    return `Latest ${weekRangeLabel} · trends & daily notes`;
  }
  return 'Recap appears here after your weekly summary runs.';
}

function compactSubhead(audience, hasReport, weekRangeLabel, compactSurface) {
  if (audience === AUDIENCE_TRAINER) {
    return trainerCompactSubhead(hasReport, weekRangeLabel, compactSurface);
  }
  return clientCompactSubhead(hasReport, weekRangeLabel);
}

function benefitLinesForAudience(audience) {
  if (audience === AUDIENCE_TRAINER) {
    return BENEFITS_TRAINER;
  }
  return BENEFITS_CLIENT;
}

/**
 * How many weeks to advertise on the compact chip.
 * Prefer reportCount; fall back to 1 when hasReport is true but count is 0.
 * @param {number} reportCount
 * @param {boolean} hasReport
 * @returns {number}
 */
function savedWeekCount(reportCount, hasReport) {
  if (reportCount > 0) {
    return reportCount;
  }
  if (hasReport) {
    return 1;
  }
  return 0;
}

/** Small status chip — spinner / Ready pill / Not ready. */
function InlineStatusChip({ isDark, loading, ready }) {
  const colors = themeColorsForMode(isDark);

  if (loading) {
    return (
      <View
        style={[
          styles.statusChip,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
        ]}
      >
        <ActivityIndicator size="small" color={colors.nbInk} />
      </View>
    );
  }

  if (ready) {
    return <NbPill variant="energy">Ready</NbPill>;
  }

  return (
    <View
      style={[
        styles.statusChip,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
      ]}
    >
      <Ionicons name="time-outline" size={STATUS_ICON_SIZE} color={colors.nbMuted} />
      <Text style={[styles.statusText, { color: colors.nbMuted }]}>Not ready</Text>
    </View>
  );
}

function CompactBannerIcon({ loading, inkColor }) {
  if (loading) {
    return <ActivityIndicator color={inkColor} size="small" />;
  }
  return <Ionicons name="bar-chart" size={COMPACT_CHART_ICON_SIZE} color={inkColor} />;
}

function CompactBannerBody({
  colors,
  loading,
  compactHeadlineText,
  compactSubheadText,
  savedCount,
  ctaDisabled,
  isDark,
  onOpenReport,
}) {
  const showWeeksSavedChip = savedCount > 1;
  const showOpenButton = !ctaDisabled;

  let trailingControl = (
    <InlineStatusChip isDark={isDark} loading={loading} ready={false} />
  );
  if (showOpenButton) {
    trailingControl = (
      <NbButton variant="brand" sm onPress={onOpenReport}>
        Open
      </NbButton>
    );
  }

  let subheadNode = null;
  if (compactSubheadText) {
    subheadNode = (
      <Text style={[compactStyles.sub, { color: colors.nbMuted }]} numberOfLines={2}>
        {compactSubheadText}
      </Text>
    );
  }

  let weeksSavedNode = null;
  if (showWeeksSavedChip) {
    weeksSavedNode = (
      <View style={compactStyles.chipRow}>
        <NbPill>{`${savedCount} weeks saved`}</NbPill>
      </View>
    );
  }

  return (
    <View style={compactStyles.row}>
      <View
        style={[
          compactStyles.iconBubble,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
        ]}
      >
        <CompactBannerIcon loading={loading} inkColor={colors.nbInk} />
      </View>

      <View style={compactStyles.textBlock}>
        <Text style={[compactStyles.label, { color: colors.nbMuted }]}>
          {LABEL_WEEKLY_REPORT.toUpperCase()}
        </Text>
        <Text style={[compactStyles.headline, { color: colors.nbInk }]} numberOfLines={1}>
          {compactHeadlineText}
        </Text>
        {subheadNode}
        {weeksSavedNode}
      </View>

      {trailingControl}
    </View>
  );
}

function HeroBenefitRows({ benefits, inkColor }) {
  return (
    <View style={styles.benefits}>
      {benefits.map((line) => (
        <View key={line} style={styles.benefitRow}>
          <Ionicons
            name="checkmark-circle"
            size={BENEFIT_CHECK_ICON_SIZE}
            color={inkColor}
            style={styles.checkIcon}
          />
          <Text style={[styles.benefitText, { color: inkColor }]}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Marketing / compact weekly-report entry card.
 * @param {{
 *   onOpenReport?: Function,
 *   isDark?: boolean,
 *   hasReport?: boolean,
 *   weekRangeLabel?: string,
 *   reportCount?: number,
 *   loading?: boolean,
 *   audience?: string,
 *   clientDisplayName?: string,
 *   variant?: string,
 *   compactSurface?: string,
 * }} props
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
  const colors = themeColorsForMode(isDark);
  const ctaDisabled = loading || !hasReport;
  const benefits = benefitLinesForAudience(audience);
  const headline = heroHeadline(audience, clientDisplayName);
  const subhead = heroSubhead(audience, hasReport, weekRangeLabel);
  const ctaLabel = heroCtaLabel(audience, loading, hasReport);
  const compactHeadlineText = compactHeadline(audience, clientDisplayName);
  const compactSubheadText = compactSubhead(
    audience,
    hasReport,
    weekRangeLabel,
    compactSurface,
  );

  // Compact strip used on tight home layouts — same open rules as the hero.
  if (variant === VARIANT_COMPACT) {
    const savedCount = savedWeekCount(reportCount, hasReport);
    const compactPressOpacity = ctaDisabled ? 1 : 0.9;

    return (
      <View
        style={compactStyles.outer}
        accessibilityRole="summary"
        accessibilityLabel="Weekly report"
      >
        <TouchableOpacity
          onPress={onOpenReport}
          disabled={ctaDisabled}
          activeOpacity={compactPressOpacity}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
          accessibilityState={{ disabled: ctaDisabled }}
        >
          <NbCard style={compactStyles.card}>
            <CompactBannerBody
              colors={colors}
              loading={loading}
              compactHeadlineText={compactHeadlineText}
              compactSubheadText={compactSubheadText}
              savedCount={savedCount}
              ctaDisabled={ctaDisabled}
              isDark={isDark}
              onOpenReport={onOpenReport}
            />
          </NbCard>
        </TouchableOpacity>
      </View>
    );
  }

  // Full hero card with benefit bullets + brand CTA.
  return (
    <View style={styles.outer} accessibilityRole="summary" accessibilityLabel="Weekly report">
      <NbCard style={styles.card}>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.nbMuted }]}>{LABEL_WEEKLY_REPORT}</Text>
          <Text style={[styles.headline, { color: colors.nbInk }]}>{headline}</Text>
          <Text style={[styles.subhead, { color: colors.nbMuted }]}>{subhead}</Text>

          <HeroBenefitRows benefits={benefits} inkColor={colors.nbInk} />

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

// ===== PLUMBING — skip unless debugging =====

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
