// Design Law free-trial banner — three states on trainer home (inbox-and-money PNG 19).
// Flow: read subscription access → trial running / last 2 days / expired → Subscribe / Renew.
// Used by TrainerMainScreen above Needs you. Active paid Pro hides the banner.
//
// vocab: accessState = ProPlanSetup subscription snapshot (access, trialEndsAt, trialCountdownMs)
// vocab: HardShadow = Design Law hard offset shadow (not a soft glow)

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatTrialCountdown } from './proAccessRules';
import { useSubscription } from './ProPlanSetup';
import { accentGradients, borderRadius, nb } from '../look-and-feel/colorPalette';
import { useTheme } from '../look-and-feel/lightDarkMode';
import HardShadow from '../look-and-feel/HardShadow';
import NbButton from '../look-and-feel/NbButton';
import NbProgressBar from '../look-and-feel/NbProgressBar';

// ===== NAMED CONSTANTS =====

const ACCESS_FREE_TRIAL = 'free_trial';
const ACCESS_EXPIRED = 'expired';
const ACCESS_ACTIVE = 'active';
// Manipulate here: how often the countdown badge re-reads the clock
const TRIAL_COUNTDOWN_TICK_MS = 60000;
// 24 * 60 * 60 * 1000 milliseconds in one day
const MILLISECONDS_PER_DAY = 86400000;
// Manipulate here: “last two days” urgency switch (PNG dark / fill banner)
const LAST_DAYS_MS = 2 * MILLISECONDS_PER_DAY;
// Manipulate here: assumed free-trial length for the progress bar when start is unknown
const ASSUMED_TRIAL_MS = 14 * MILLISECONDS_PER_DAY;
const FALLBACK_PROGRESS_WHEN_UNKNOWN = 0.3;
const MIN_PROGRESS_FRACTION = 0.05;
const MAX_PROGRESS_FRACTION = 0.98;

// ===== HELPER FUNCTIONS =====

/**
 * Badge text like "3 days left" or "Expired".
 * @param {number|null|undefined} remainingMs
 * @returns {string}
 */
function daysLeftLabel(remainingMs) {
  if (remainingMs == null || remainingMs <= 0) {
    return 'Expired';
  }
  const wholeDays = Math.max(1, Math.ceil(remainingMs / MILLISECONDS_PER_DAY));
  const dayWord = wholeDays === 1 ? 'day' : 'days';
  return `${wholeDays} ${dayWord} left`;
}

/**
 * Rough used-fraction of a 14-day trial for NbProgressBar (0.05–0.98).
 * @param {number|null|undefined} remainingMs
 * @returns {number}
 */
function trialProgressFraction(remainingMs) {
  if (remainingMs == null) {
    return FALLBACK_PROGRESS_WHEN_UNKNOWN;
  }
  const usedMs = ASSUMED_TRIAL_MS - remainingMs;
  const rawFraction = usedMs / ASSUMED_TRIAL_MS;
  const clampedLow = Math.max(MIN_PROGRESS_FRACTION, rawFraction);
  return Math.min(MAX_PROGRESS_FRACTION, clampedLow);
}

/**
 * Short month+day label for the trial end date, or null when invalid.
 * @param {Date|*} date
 * @returns {string|null}
 */
function endDateLabel(date) {
  const isRealDate = date instanceof Date && !Number.isNaN(date.getTime());
  if (!isRealDate) {
    return null;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function expiredBannerCopy() {
  return {
    title: 'Subscription expired',
    badge: 'Expired',
    footer: 'New client requests are paused until you renew.',
    callToActionLabel: 'Renew Coach Connect Pro',
    useFillCardChrome: false,
    useDashedBorder: true,
    showProgressBar: false,
    progressAccentIndex: 0,
  };
}

function lastTwoDaysBannerCopy(remainingMs) {
  const daysUntilEnd = Math.max(1, Math.ceil(remainingMs / MILLISECONDS_PER_DAY));
  return {
    title: `Free trial ends in ${daysUntilEnd} days`,
    badge: daysLeftLabel(remainingMs),
    footer: 'Subscribe to keep taking clients.',
    callToActionLabel: 'Subscribe',
    useFillCardChrome: true,
    useDashedBorder: false,
    showProgressBar: true,
    progressAccentIndex: 1,
  };
}

function activeTrialFooterLine(accessState, remainingMs) {
  let footerLine = formatTrialCountdown(remainingMs);
  if (!accessState.trialEndsAt) {
    return footerLine;
  }
  const formattedEnd = endDateLabel(accessState.trialEndsAt);
  if (!formattedEnd) {
    return footerLine;
  }
  return `Full Pro access until ${formattedEnd}.`;
}

function activeTrialBannerCopy(accessState, remainingMs) {
  return {
    title: 'Free trial active',
    badge: daysLeftLabel(remainingMs),
    footer: activeTrialFooterLine(accessState, remainingMs),
    callToActionLabel: 'Subscribe',
    useFillCardChrome: false,
    useDashedBorder: false,
    showProgressBar: true,
    progressAccentIndex: 0,
  };
}

/**
 * Plain-text + chrome flags for the three banner states.
 * @param {object} accessState
 * @param {number|null|undefined} remainingMs
 * @returns {object}
 */
function buildTrialBannerCopy(accessState, remainingMs) {
  const trialEndedByClock = remainingMs != null && remainingMs <= 0;
  const expired = accessState.access === ACCESS_EXPIRED || trialEndedByClock;
  if (expired) {
    return expiredBannerCopy();
  }

  const inLastTwoDays = remainingMs != null && remainingMs <= LAST_DAYS_MS;
  if (inLastTwoDays) {
    return lastTwoDaysBannerCopy(remainingMs);
  }

  return activeTrialBannerCopy(accessState, remainingMs);
}

function remainingMsFromAccessState(accessState, nowMs) {
  if (!accessState.trialEndsAt) {
    return accessState.trialCountdownMs;
  }
  return accessState.trialEndsAt.getTime() - nowMs;
}

function shouldTickCountdown(accessValue) {
  return accessValue === ACCESS_FREE_TRIAL || accessValue === ACCESS_EXPIRED;
}

function shouldShowTrialBanner(accessValue) {
  return accessValue === ACCESS_FREE_TRIAL || accessValue === ACCESS_EXPIRED;
}

// ===== MAIN FUNCTION =====

/**
 * Trainer-home free-trial / expired subscription banner.
 * @param {{ onSubscribe?: Function }} props
 */
export default function FreeTrialBanner({ onSubscribe }) {
  const { colors } = useTheme();
  // vocab: useSubscription = ProPlanSetup hook that exposes accessState for this trainer
  const { accessState } = useSubscription();
  // Hook order frozen: clock tick used by remainingMs memo.
  const [nowMs, setNowMs] = useState(Date.now());

  // Tick once a minute while trial/expired so the badge stays honest.
  useEffect(() => {
    if (!shouldTickCountdown(accessState.access)) {
      return undefined;
    }
    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, TRIAL_COUNTDOWN_TICK_MS);
    return () => clearInterval(intervalId);
  }, [accessState.access]);

  const remainingMs = useMemo(
    () => remainingMsFromAccessState(accessState, nowMs),
    [accessState.trialEndsAt, accessState.trialCountdownMs, nowMs],
  );

  // Paid Pro — nothing to show.
  if (accessState.access === ACCESS_ACTIVE) {
    return null;
  }

  if (!shouldShowTrialBanner(accessState.access)) {
    return null;
  }

  const copy = buildTrialBannerCopy(accessState, remainingMs);

  // Fill chrome (last-two-days urgency) flips ink onto the dark fill card.
  let inkColor = colors.nbInk;
  let mutedColor = colors.nbMuted;
  if (copy.useFillCardChrome) {
    inkColor = colors.nbOnFill;
    mutedColor = colors.nbOnFill;
  }

  const cardBackgroundColor = copy.useFillCardChrome ? colors.nbFill : colors.nbSurface;
  const borderStyle = copy.useDashedBorder ? 'dashed' : 'solid';
  const buttonVariant = copy.useFillCardChrome ? 'ghost' : 'fill';
  const ghostButtonStyle = copy.useFillCardChrome
    ? { backgroundColor: colors.nbSurface }
    : undefined;
  const progressValue = trialProgressFraction(remainingMs);

  let progressBarNode = null;
  if (copy.showProgressBar) {
    progressBarNode = (
      <NbProgressBar progress={progressValue} index={copy.progressAccentIndex} />
    );
  }

  const handleSubscribePress = () => {
    if (typeof onSubscribe !== 'function') {
      return;
    }
    onSubscribe();
  };

  return (
    <View style={styles.wrap}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: cardBackgroundColor,
              borderColor: colors.nbBorder,
              borderStyle,
            },
          ]}
        >
          <View style={styles.head}>
            <Text style={[styles.title, { color: inkColor }]}>{copy.title}</Text>
            <LinearGradient
              colors={accentGradients[0]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.badge, { borderColor: colors.nbBorder }]}
            >
              <Text style={styles.badgeText}>{copy.badge}</Text>
            </LinearGradient>
          </View>

          {progressBarNode}

          <Text style={[styles.footer, { color: mutedColor }]}>{copy.footer}</Text>

          <NbButton
            variant={buttonVariant}
            onPress={handleSubscribePress}
            style={ghostButtonStyle}
          >
            {copy.callToActionLabel}
          </NbButton>
        </View>
      </HardShadow>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: nb.screenGutter, paddingTop: 8, paddingBottom: 4 },
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: { flex: 1, fontSize: 15, fontWeight: '900' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
  },
  // Manipulate here: badge text stays near-black so it reads on the accent gradient
  badgeText: { fontSize: 11, fontWeight: '900', color: '#0A0A0A' },
  footer: { fontSize: 13, fontWeight: '600' },
});
