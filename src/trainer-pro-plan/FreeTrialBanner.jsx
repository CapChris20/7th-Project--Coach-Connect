// Design Law free-trial banner — three states on trainer home (inbox-and-money PNG 19).
// Flow: read subscription access → trial running / last 2 days / expired → Subscribe / Renew.
// Used by TrainerMainScreen above Needs you. Active paid Pro hides the banner.

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
const TRIAL_COUNTDOWN_TICK_MS = 60000;
// Manipulate here: “last two days” urgency switch (PNG dark banner)
const LAST_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
// Manipulate here: assumed free-trial length for the progress bar when start is unknown
const ASSUMED_TRIAL_MS = 14 * 24 * 60 * 60 * 1000;

// ===== HELPER FUNCTIONS =====

function daysLeftLabel(ms) {
  if (ms == null || ms <= 0) return 'Expired';
  const days = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  return `${days} day${days === 1 ? '' : 's'} left`;
}

function trialProgress(remainingMs) {
  if (remainingMs == null) return 0.3;
  const used = ASSUMED_TRIAL_MS - remainingMs;
  return Math.max(0.05, Math.min(0.98, used / ASSUMED_TRIAL_MS));
}

function endDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ onSubscribe?: Function }} props
 */
export default function FreeTrialBanner({ onSubscribe }) {
  const { colors } = useTheme();
  const { accessState } = useSubscription();
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    if (accessState.access !== ACCESS_FREE_TRIAL && accessState.access !== ACCESS_EXPIRED) {
      return undefined;
    }
    const id = setInterval(() => setNowMs(Date.now()), TRIAL_COUNTDOWN_TICK_MS);
    return () => clearInterval(id);
  }, [accessState.access]);

  const remainingMs = useMemo(() => {
    if (!accessState.trialEndsAt) return accessState.trialCountdownMs;
    return accessState.trialEndsAt.getTime() - nowMs;
  }, [accessState.trialEndsAt, accessState.trialCountdownMs, nowMs]);

  if (accessState.access === ACCESS_ACTIVE) return null;
  if (accessState.access !== ACCESS_FREE_TRIAL && accessState.access !== ACCESS_EXPIRED) {
    return null;
  }

  const expired = accessState.access === ACCESS_EXPIRED || (remainingMs != null && remainingMs <= 0);
  const lastDays = !expired && remainingMs != null && remainingMs <= LAST_DAYS_MS;
  const fillCard = lastDays;
  const dashed = expired;

  const title = expired
    ? 'Subscription expired'
    : lastDays
      ? `Free trial ends in ${Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)))} days`
      : 'Free trial active';
  const badge = expired ? 'Expired' : daysLeftLabel(remainingMs);
  const footer = expired
    ? 'New client requests are paused until you renew.'
    : lastDays
      ? 'Subscribe to keep taking clients.'
      : accessState.trialEndsAt
        ? `Full Pro access until ${endDateLabel(accessState.trialEndsAt)}.`
        : formatTrialCountdown(remainingMs);
  const cta = expired ? 'Renew Coach Connect Pro' : 'Subscribe';

  const ink = fillCard ? colors.nbOnFill : colors.nbInk;
  const muted = fillCard ? colors.nbOnFill : colors.nbMuted;

  return (
    <View style={styles.wrap}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: fillCard ? colors.nbFill : colors.nbSurface,
              borderColor: colors.nbBorder,
              borderStyle: dashed ? 'dashed' : 'solid',
            },
          ]}
        >
          <View style={styles.head}>
            <Text style={[styles.title, { color: ink }]}>{title}</Text>
            <LinearGradient
              colors={accentGradients[0]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.badge, { borderColor: colors.nbBorder }]}
            >
              <Text style={styles.badgeText}>{badge}</Text>
            </LinearGradient>
          </View>

          {!expired ? (
            <NbProgressBar progress={trialProgress(remainingMs)} index={lastDays ? 1 : 0} />
          ) : null}

          <Text style={[styles.footer, { color: muted }]}>{footer}</Text>

          <NbButton
            variant={fillCard ? 'ghost' : 'fill'}
            onPress={() => onSubscribe?.()}
            style={fillCard ? { backgroundColor: colors.nbSurface } : undefined}
          >
            {cta}
          </NbButton>
        </View>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: nb.screenGutter, paddingTop: 8, paddingBottom: 4 },
  card: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  title: { flex: 1, fontSize: 15, fontWeight: '900' },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: nb.borderWidthPill,
  },
  badgeText: { fontSize: 11, fontWeight: '900', color: '#0A0A0A' },
  footer: { fontSize: 13, fontWeight: '600' },
});
