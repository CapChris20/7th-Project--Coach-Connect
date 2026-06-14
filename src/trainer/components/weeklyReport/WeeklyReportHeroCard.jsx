import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WR_BRAND_GRADIENT } from './WeeklyReportPremium';

const ACCENT_PURPLE = '#9333EA';

/** Dark purple → dark orange (matches Today card & Quick Actions). */
const PREMIUM_BORDER_GRADIENT = WR_BRAND_GRADIENT;
const PREMIUM_CTA_GRADIENT = WR_BRAND_GRADIENT;
const PREMIUM_BG_DARK = ['#12081f', '#08050f'];
const PREMIUM_BG_LIGHT = ['#F3F0FA', '#FFFFFF'];

const ACCENT_BORDER_GRADIENT = WR_BRAND_GRADIENT;

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
 * `compactSurface`: `marketing` (gradient rim, default) or `inline` (tighter padding — still uses gradient rim; trainer dashboard).
 */
/** Small status chip — no nested gradient ring (design-system compact row). */
function InlineStatusChip({ isDark, loading, ready }) {
  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.1)';
  const bg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.04)';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.5)';
  const readyColor = isDark ? '#A7F3D0' : '#047857';

  return (
    <View style={[inlineStyles.statusChip, { borderColor: border, backgroundColor: bg }]}>
      {loading ? (
        <ActivityIndicator size="small" color={ACCENT_PURPLE} />
      ) : ready ? (
        <>
          <Ionicons name="checkmark-circle" size={13} color={readyColor} />
          <Text style={[inlineStyles.statusText, { color: readyColor }]}>Ready</Text>
        </>
      ) : (
        <>
          <Ionicons name="time-outline" size={13} color={muted} />
          <Text style={[inlineStyles.statusText, { color: muted }]}>Not ready</Text>
        </>
      )}
    </View>
  );
}

export default function WeeklyReportHeroCard({
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
    const innerBg = isDark ? '#0A0812' : '#FFFFFF';
    const bgGrad = isDark ? PREMIUM_BG_DARK : PREMIUM_BG_LIGHT;
    const iconInnerBg = isDark ? 'rgba(14,12,22,0.98)' : 'rgba(255,255,255,0.98)';
    const iconColor = isDark ? '#FED7AA' : '#6D28D9';
    const kickerColor = isDark ? 'rgba(233,213,255,0.72)' : 'rgba(109,40,217,0.75)';
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
          <LinearGradient
            colors={PREMIUM_BORDER_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[compactStyles.borderRing, isDark ? styles.borderRingShadowDark : styles.borderRingShadowLight]}
          >
            <View style={[compactStyles.innerCard, { backgroundColor: innerBg }]}>
              <LinearGradient colors={bgGrad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
                <LinearGradient
                  colors={PREMIUM_BORDER_GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={compactStyles.topAccent}
                />
                <View style={compactStyles.row}>
                  <LinearGradient
                    colors={PREMIUM_BORDER_GRADIENT}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={compactStyles.iconBubbleRing}
                  >
                    <View style={[compactStyles.iconBubbleInner, { backgroundColor: iconInnerBg }]}>
                      {loading ? (
                        <ActivityIndicator color={iconColor} size="small" />
                      ) : (
                        <Ionicons name="bar-chart" size={24} color={iconColor} />
                      )}
                    </View>
                  </LinearGradient>

                  <View style={compactStyles.textBlock}>
                    <Text style={[compactStyles.label, { color: kickerColor }]}>{label.toUpperCase()}</Text>
                    <Text style={[compactStyles.headline, { color: headlineColor }]} numberOfLines={1}>
                      {compactHeadline}
                    </Text>
                    {compactSub ? (
                      <Text style={[compactStyles.sub, { color: subColor }]} numberOfLines={2}>
                        {compactSub}
                      </Text>
                    ) : null}
                    {savedCount > 1 ? (
                      <View style={compactStyles.chipRow}>
                        <View style={[compactStyles.chip, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)' }]}>
                          <Text style={[compactStyles.chipText, { color: subColor }]}>{savedCount} weeks saved</Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {ctaDisabled ? (
                    <InlineStatusChip isDark={isDark} loading={loading} ready={false} />
                  ) : (
                    <LinearGradient
                      colors={PREMIUM_CTA_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={compactStyles.ctaPill}
                    >
                      <View style={compactStyles.ctaInner}>
                        <Text style={compactStyles.ctaText}>Open</Text>
                        <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                      </View>
                    </LinearGradient>
                  )}
                </View>
              </LinearGradient>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  if (variant === 'compact' && compactSurface === 'inline') {
    // Legacy inline path — same premium compact layout above.
    return null;
  }

  if (false && variant === 'compact') {
    const compactLabelColor =
      audience === 'trainer'
        ? isDark
          ? 'rgba(196,181,253,0.9)'
          : 'rgba(91,33,182,0.75)'
        : labelColor;

    const row = (
      <TouchableOpacity
        style={compactStyles.row}
        onPress={onOpenReport}
        disabled={ctaDisabled}
        activeOpacity={ctaDisabled ? 1 : 0.88}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: ctaDisabled }}
      >
        <LinearGradient
          colors={['rgba(190,24,93,0.75)', 'rgba(194,65,12,0.55)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={compactStyles.iconBubbleRing}
        >
          <View
            style={[
              compactStyles.iconBubbleInner,
              { backgroundColor: isDark ? 'rgba(10,8,16,0.94)' : 'rgba(255,255,255,0.97)' },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#BE185D" size="small" />
            ) : (
              <Ionicons name="document-text-outline" size={22} color={isDark ? '#FCE7F3' : '#BE185D'} />
            )}
          </View>
        </LinearGradient>
        <View style={compactStyles.textBlock}>
          <Text style={[compactStyles.label, { color: compactLabelColor }]}>{label}</Text>
          <Text style={[compactStyles.headline, { color: headlineColor }]} numberOfLines={1}>
            {compactHeadline}
          </Text>
          <Text style={[compactStyles.sub, { color: subColor }]} numberOfLines={2}>
            {compactSub}
          </Text>
        </View>
        {ctaDisabled ? (
          <InlineStatusChip isDark={isDark} loading={loading} ready={false} />
        ) : (
          <LinearGradient
            colors={['#BE185D', '#C2410C']}
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
              colors={ctaDisabled ? ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)'] : WR_BRAND_GRADIENT}
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
    shadowColor: '#9333EA',
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

/** Trainer dashboard row — matches Quick Actions cards on TrainerApp */
const inlineStyles = StyleSheet.create({
  wrapper: {
    marginTop: 0,
    marginBottom: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 88,
  },
  iconWell: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 3,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    marginTop: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
});

const compactStyles = StyleSheet.create({
  outer: {
    marginTop: 2,
    marginBottom: 2,
    paddingHorizontal: 0,
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
  iconBubbleRing: {
    width: 42,
    height: 42,
    borderRadius: 14,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBubbleInner: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
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
  headline: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginTop: 2,
  },
  ctaPill: {
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 76,
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
    letterSpacing: 0.2,
  },
});
