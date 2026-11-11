// Pink-to-orange banner while a trainer is inside the free Pro trial.
// Flow: read subscription access → tick the clock once a minute during a trial → show the countdown or nothing.
// Used by the trainer main screen above the rest of the trainer app.
//
// vocab: neobrutalist banner with brand gradient background

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTrialCountdown } from './proAccessRules';
import { useSubscription } from './ProPlanSetup';
import { gradients, nb, borderRadius } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const BANNER_ICON_COLOR = '#0A0A0F';
const SPARKLES_ICON_NAME = 'sparkles';
const SPARKLES_ICON_SIZE = 16;
const FREE_TRIAL_ACCESS = 'free_trial';
const FREE_TRIAL_ACTIVE_LABEL = 'Free trial active';
// Manipulate here: the banner talks in minutes, so a one-minute tick is enough. Lower it to refresh faster.
const TRIAL_COUNTDOWN_TICK_MS = 60000;

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} access
 * @returns {boolean}
 */
function isFreeTrialAccess(access) {
  return access === FREE_TRIAL_ACCESS;
}

/**
 * @param {string} access
 * @param {number|null|undefined} trialCountdownMs
 * @returns {boolean}
 */
function shouldShowFreeTrialBanner(access, trialCountdownMs) {
  return isFreeTrialAccess(access) && trialCountdownMs != null;
}

/**
 * Start the once-a-minute clock. The returned function is the effect cleanup, so the timer dies with the screen.
 * @param {Function} setCurrentTimeMs
 * @returns {Function}
 */
function startTrialCountdownTicker(setCurrentTimeMs) {
  // vocab: setInterval = keep calling this until clearInterval runs.
  const intervalId = setInterval(() => {
    setCurrentTimeMs(Date.now());
  }, TRIAL_COUNTDOWN_TICK_MS);
  return function stopTrialCountdownTicker() {
    clearInterval(intervalId);
  };
}

/**
 * The formatter wants milliseconds left, not the end date. No end date means the trial is on but untimed.
 * @param {object} accessState
 * @param {number} currentTimeMs
 * @returns {string}
 */
function trialCountdownText(accessState, currentTimeMs) {
  if (!accessState.trialEndsAt) return FREE_TRIAL_ACTIVE_LABEL;
  const millisecondsRemaining = accessState.trialEndsAt.getTime() - currentTimeMs;
  return formatTrialCountdown(millisecondsRemaining);
}

// ===== MAIN FUNCTION =====

/**
 * Trial banner. Renders nothing when the trainer is not in a free trial.
 * @returns {JSX.Element|null}
 */
export default function FreeTrialBanner() {
  const { accessState } = useSubscription();
  const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());

  useEffect(() => {
    if (!shouldShowFreeTrialBanner(accessState.access, 1)) return undefined;
    return startTrialCountdownTicker(setCurrentTimeMs);
  }, [accessState.access]);

  const bannerVisible = shouldShowFreeTrialBanner(accessState.access, accessState.trialEndsAt || currentTimeMs);
  if (!bannerVisible) return null;

  const countdown = trialCountdownText(accessState, currentTimeMs);

  return (
    <View style={styles.wrap}>
      {/* vocab: LinearGradient = brand gradient for Pro trial banner */}
      <LinearGradient
        colors={gradients.brand.colors}
        start={gradients.brand.start}
        end={gradients.brand.end}
        style={styles.banner}
      >
        <Ionicons name={SPARKLES_ICON_NAME} size={SPARKLES_ICON_SIZE} color={BANNER_ICON_COLOR} />
        <Text style={styles.text}>{countdown}</Text>
        <Text style={styles.sub}>Full Pro access</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    borderColor: '#0A0A0F',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: { 
    color: '#0A0A0F', 
    fontFamily: 'SpaceGrotesk_700Bold',
    fontWeight: '700', 
    fontSize: 13, 
    flex: 1 
  },
  sub: { 
    color: 'rgba(10,10,15,0.85)', 
    fontSize: 12, 
    fontWeight: '600' 
  },
});
