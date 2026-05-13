import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/** Soft violet / blush rim (not harsh red). */
const ACCENT_BORDER_GRADIENT = ['#E879C8', '#C084FC', '#A78BFA', '#C084FC', '#E879C8'];

const CHECK_COLORS = ['#67E8F9', '#F472B6', '#FB923C', '#C084FC'];

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

function firstNameFromDisplay(name) {
  const s = String(name || '').trim();
  return s.split(/\s+/)[0] || 'Client';
}

/**
 * Entry card for weekly intelligence — matches MarketplaceHeroCard / dashboard heroes.
 * `audience`: athlete home vs trainer dashboard copy.
 * `variant`: `hero` (default, tall) or `compact` (slim horizontal row — client dashboard).
 * `compactSurface`: `marketing` (gradient rim, default) or `inline` (1px border — trainer dashboard).
 */
export default function WeeklyReportHeroCard({
  onOpenReport,
  isDark = true,
  hasReport = false,
  weekRangeLabel = '',
  loading = false,
  audience = 'client',
  clientDisplayName = '',
  variant = 'hero',
  compactSurface = 'marketing',
}) {
  const innerBg = isDark ? '#0A0A0F' : '#F8F9FC';
  const headlineColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const subColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.62)';
  const benefitTextColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.85)';
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)';
  const ctaDisabled = loading || !hasReport;
  const benefits = audience === 'trainer' ? BENEFITS_TRAINER : BENEFITS_CLIENT;
  const label = audience === 'trainer' ? 'Weekly report' : 'Weekly intelligence';
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
        : 'When your coach’s weekly job runs (after you’ve logged check-ins), your recap lands here — open it anytime from this card.';
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

  if (variant === 'compact') {
    const inlineBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)';
    const row = (
      <TouchableOpacity
        style={[compactStyles.row, compactSurface === 'inline' && compactStyles.rowInline]}
        onPress={onOpenReport}
        disabled={ctaDisabled}
        activeOpacity={ctaDisabled ? 1 : 0.88}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: ctaDisabled }}
      >
        <View
          style={[
            compactStyles.iconBubble,
            compactSurface === 'inline' && compactStyles.iconBubbleInline,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          ]}
        >
          {loading ? (
            <ActivityIndicator color="#C084FC" size="small" />
          ) : (
            <Ionicons name="document-text-outline" size={compactSurface === 'inline' ? 20 : 22} color="#C084FC" />
          )}
        </View>
        <View style={compactStyles.textBlock}>
          <Text style={[compactStyles.label, compactSurface === 'inline' && compactStyles.labelInline, { color: labelColor }]}>
            {label}
          </Text>
          <Text
            style={[compactStyles.headline, compactSurface === 'inline' && compactStyles.headlineInline, { color: headlineColor }]}
            numberOfLines={1}
          >
            {compactHeadline}
          </Text>
          <Text
            style={[compactStyles.sub, compactSurface === 'inline' && compactStyles.subInline, { color: subColor }]}
            numberOfLines={compactSurface === 'inline' ? 1 : 2}
          >
            {compactSub}
          </Text>
        </View>
        {ctaDisabled ? (
          compactSurface === 'inline' ? (
            <View style={[compactStyles.ctaGhost, { borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.12)' }]}>
              <Text style={[compactStyles.ctaGhostText, { color: subColor }]}>{loading ? '…' : 'Soon'}</Text>
            </View>
          ) : (
            <LinearGradient
              colors={['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={compactStyles.ctaPill}
            >
              <View style={compactStyles.ctaInner}>
                <Text style={compactStyles.ctaText}>{loading ? '…' : '—'}</Text>
              </View>
            </LinearGradient>
          )
        ) : (
          <LinearGradient
            colors={['#8B5CF6', '#DB7093']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={compactStyles.ctaPill}
          >
            <View style={compactStyles.ctaInner}>
              <Text style={compactStyles.ctaText}>{loading ? '…' : 'Open'}</Text>
              {!loading ? <Ionicons name="chevron-forward" size={18} color="#FFFFFF" /> : null}
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>
    );

    if (compactSurface === 'inline') {
      return (
        <View style={compactStyles.outerInline} accessibilityRole="summary" accessibilityLabel="Weekly report">
          <View style={[compactStyles.inlineShell, { backgroundColor: innerBg, borderColor: inlineBorder }]}>{row}</View>
        </View>
      );
    }

    return (
      <View style={compactStyles.outer} accessibilityRole="summary" accessibilityLabel="Weekly report">
        <LinearGradient
          colors={ACCENT_BORDER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[compactStyles.borderRing, isDark ? styles.borderRingShadowDark : styles.borderRingShadowLight]}
        >
          <View style={[compactStyles.innerCard, { backgroundColor: innerBg }]}>{row}</View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.outer} accessibilityRole="summary" accessibilityLabel="Weekly report">
      <LinearGradient
        colors={ACCENT_BORDER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderRing, isDark ? styles.borderRingShadowDark : styles.borderRingShadowLight]}
      >
        <View style={[styles.innerCard, { backgroundColor: innerBg }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.innerWash,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent' },
            ]}
            pointerEvents="none"
          />
          <View style={styles.content}>
            <Text style={[styles.label, { color: labelColor }]}>{label}</Text>

            <Text style={[styles.headline, { color: headlineColor }]}>{headline}</Text>

            <Text style={[styles.subhead, { color: subColor }]}>{subhead}</Text>

            <View style={styles.benefits}>
              {benefits.map((line, i) => (
                <View key={line} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={CHECK_COLORS[i % CHECK_COLORS.length]} style={styles.checkIcon} />
                  <Text style={[styles.benefitText, { color: benefitTextColor }]}>{line}</Text>
                </View>
              ))}
            </View>

            <LinearGradient
              colors={ctaDisabled ? ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)'] : ['#8B5CF6', '#DB7093']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <TouchableOpacity
                onPress={onOpenReport}
                disabled={ctaDisabled}
                activeOpacity={0.88}
                style={styles.ctaTouchable}
                accessibilityRole="button"
                accessibilityLabel={audience === 'trainer' && hasReport ? 'Open weekly reports' : 'Open weekly report'}
                accessibilityState={{ disabled: ctaDisabled }}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons name="document-text-outline" size={20} color="#FFFFFF" />
                )}
                <Text style={styles.ctaText}>{ctaLabel}</Text>
                {!loading && hasReport ? <Ionicons name="arrow-forward" size={20} color="#FFFFFF" /> : null}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  borderRing: {
    borderRadius: 24,
    padding: 3,
  },
  borderRingShadowDark: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 8,
  },
  borderRingShadowLight: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  innerCard: {
    borderRadius: 21,
    overflow: 'hidden',
  },
  innerWash: {
    zIndex: 0,
  },
  content: {
    padding: 20,
    gap: 14,
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  benefits: {
    gap: 8,
    marginTop: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  checkBubble: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  ctaGradient: {
    borderRadius: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  ctaTouchable: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
});

const compactStyles = StyleSheet.create({
  outer: {
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 0,
  },
  outerInline: {
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  inlineShell: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  borderRing: {
    borderRadius: 18,
    padding: 2,
  },
  innerCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
    minHeight: 56,
  },
  rowInline: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
    minHeight: 48,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.35)',
  },
  iconBubbleInline: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderColor: 'rgba(192,132,252,0.22)',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  labelInline: {
    fontSize: 9,
    letterSpacing: 0.8,
    marginBottom: 0,
  },
  headline: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  headlineInline: {
    fontSize: 14,
    marginTop: 1,
  },
  sub: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  subInline: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1,
    fontWeight: '500',
  },
  ctaPill: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 72,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  ctaGhost: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
