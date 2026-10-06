// Remembers whether this user wants AI features on, and how often they may flip that switch.
// Flow: read the saved preference → show the disclaimer on a settings flip → count the flip → freeze AI off after too many "off" switches.
// Used by Settings, onboarding, and any screen that calls useAI().

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many on/off flips one calendar month allows.
const MAX_AI_TOGGLES_PER_CALENDAR_MONTH = 3;
// Manipulate here: how many "off" flips in that month force AI to stay off.
const MAX_AI_OFFS_PER_MONTH_BEFORE_FREEZE = 3;
// Manipulate here: how long the forced-off period lasts after that churn.
const FREEZE_OFF_MS = 30 * 24 * 60 * 60 * 1000;
// Manipulate here: events older than this are dropped the next time we save the log.
const TOGGLE_EVENT_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
const MAX_STORED_TOGGLE_EVENTS = 200;

// Device-wide copy. The per-user key below is the one that survives a profile refresh.
const AI_ENABLED_STORAGE_KEY = 'aiEnabled';

/** Title of the alert shown before a settings AI toggle. */
export const AI_MODEL_DISCLAIMER_TITLE = 'About AI in Coach Connect';

/** Body of that alert. Enforcement of the monthly cap stays in code, not in this copy. */
export const AI_MODEL_DISCLAIMER_BODY = `Coach Connect uses third-party AI models. Responses can be wrong, incomplete, or outdated. Nothing here is medical advice, diagnosis, or treatment — always talk to a qualified professional for health decisions.

By continuing, you agree to use AI features at your own discretion.`;

const AIPermissionContext = createContext(null);

// ===== HELPER FUNCTIONS =====

// These keys are per user and do not use the coachconnect_* prefix, so a full local wipe misses them.
function aiPrefStorageKey(uid) {
  return `user_ai_enabled_${uid}`;
}

function aiToggleEventsKey(uid) {
  return `user_ai_toggle_events_${uid}`;
}

function aiFreezeOffUntilKey(uid) {
  return `user_ai_freeze_off_until_${uid}`;
}

function onboardingDataStorageKey(uid) {
  return `onboarding_data_${uid}`;
}

function authProfileStorageKey(uid) {
  return `auth_profile_${uid}`;
}

// Saved values have been a boolean, the strings "true"/"1", and the numbers 1/0.
function parseAiEnabled(rawValue) {
  if (typeof rawValue === 'boolean') return rawValue;
  if (typeof rawValue === 'string') {
    const normalized = rawValue.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return true;
    if (normalized === 'false' || normalized === '0') return false;
  }
  if (typeof rawValue === 'number') {
    if (rawValue === 1) return true;
    if (rawValue === 0) return false;
  }
  return null;
}

// "2026-10" so events can be counted inside one calendar month.
function monthKeyFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${monthNumber}`;
}

function formatShortDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return 'later';
  }
}

// vocab: stored flip shape is { t: timestampMs, on: boolean }. Those keys are the saved JSON — do not rename them.
function isStoredToggleEvent(event) {
  return event && typeof event.t === 'number' && typeof event.on === 'boolean';
}

async function loadToggleEvents(uid) {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(aiToggleEventsKey(uid));
    const parsedEvents = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsedEvents)) return [];
    return parsedEvents.filter(isStoredToggleEvent).sort((left, right) => left.t - right.t);
  } catch (_) {
    return [];
  }
}

async function saveToggleEvents(uid, events) {
  if (!uid) return;
  const cutoff = Date.now() - TOGGLE_EVENT_RETENTION_MS;
  const pruned = events.filter((event) => event.t >= cutoff).slice(-MAX_STORED_TOGGLE_EVENTS);
  await AsyncStorage.setItem(aiToggleEventsKey(uid), JSON.stringify(pruned));
}

async function loadFreezeOffUntil(uid) {
  if (!uid) return 0;
  try {
    const raw = await AsyncStorage.getItem(aiFreezeOffUntilKey(uid));
    const parsedTimestamp = raw != null ? parseInt(String(raw), 10) : 0;
    return Number.isFinite(parsedTimestamp) && parsedTimestamp > 0 ? parsedTimestamp : 0;
  } catch (_) {
    return 0;
  }
}

async function saveFreezeOffUntil(uid, timestamp) {
  if (!uid) return;
  if (!timestamp || timestamp <= 0) {
    await AsyncStorage.removeItem(aiFreezeOffUntilKey(uid));
    return;
  }
  await AsyncStorage.setItem(aiFreezeOffUntilKey(uid), String(timestamp));
}

async function clearExpiredFreeze(uid, now) {
  let freezeOffUntil = await loadFreezeOffUntil(uid);
  if (freezeOffUntil > 0 && freezeOffUntil <= now) {
    freezeOffUntil = 0;
    await saveFreezeOffUntil(uid, 0);
  }
  return freezeOffUntil;
}

function eventsInMonth(events, monthKey) {
  return events.filter((event) => monthKeyFromTimestamp(event.t) === monthKey);
}

async function computeToggleMeter(uid) {
  const now = Date.now();
  const monthKey = monthKeyFromTimestamp(now);
  const events = await loadToggleEvents(uid);
  const eventsThisMonth = eventsInMonth(events, monthKey);
  const togglesThisMonth = eventsThisMonth.length;
  const offsThisMonth = eventsThisMonth.filter((event) => event.on === false).length;
  const freezeOffUntil = await clearExpiredFreeze(uid, now);
  const remaining = Math.max(0, MAX_AI_TOGGLES_PER_CALENDAR_MONTH - togglesThisMonth);
  const monthlyUseFraction = Math.min(
    1,
    MAX_AI_TOGGLES_PER_CALENDAR_MONTH > 0 ? togglesThisMonth / MAX_AI_TOGGLES_PER_CALENDAR_MONTH : 0,
  );
  return {
    togglesThisMonth,
    offsThisMonth,
    remaining,
    monthlyUseFraction,
    freezeOffUntil,
    isFrozenFromChurn: freezeOffUntil > now,
  };
}

async function applyAiPreference(uid, nextEnabled) {
  await AsyncStorage.setItem(AI_ENABLED_STORAGE_KEY, String(nextEnabled));
  if (uid) await AsyncStorage.setItem(aiPrefStorageKey(uid), String(nextEnabled));
}

// Copies the flag into the cached profile blobs so a later reload does not overwrite it.
async function mirrorProfileAi(uid, nextEnabled) {
  if (!uid) return;
  const keysToUpdate = [onboardingDataStorageKey(uid), authProfileStorageKey(uid)];
  for (const storageKey of keysToUpdate) {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const base = raw ? JSON.parse(raw) : {};
      const merged = { ...(base || {}), aiEnabled: nextEnabled };
      await AsyncStorage.setItem(storageKey, JSON.stringify(merged));
    } catch (_) {
      /* ignore */
    }
  }
}

// Returns true/false when the per-user key is set, and mirrors it onto the device-wide key.
async function readAndMirrorPerUserAiFlag(uid) {
  const perUser = await AsyncStorage.getItem(aiPrefStorageKey(uid));
  if (perUser === 'true' || perUser === 'false') {
    const isEnabled = perUser === 'true';
    await AsyncStorage.setItem(AI_ENABLED_STORAGE_KEY, String(isEnabled));
    return isEnabled;
  }
  return null;
}

async function readAiEnabledFromCacheKey(storageKey) {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const normalized = parseAiEnabled(data?.aiEnabled);
    if (normalized === true || normalized === false) return normalized;
    return null;
  } catch (_) {
    return null;
  }
}

async function findAiEnabledFromProfileCaches(uid) {
  const cacheKeys = [onboardingDataStorageKey(uid), authProfileStorageKey(uid)];
  for (const storageKey of cacheKeys) {
    const normalized = await readAiEnabledFromCacheKey(storageKey);
    if (normalized === true || normalized === false) return normalized;
  }
  return null;
}

// Per-user key wins when it is exactly "true" or "false". Otherwise the device-wide flag.
async function loadStoredAiEnabled(uid, refreshToggleMeter) {
  if (uid) {
    await refreshToggleMeter();
    const storedEnabled = await readAndMirrorPerUserAiFlag(uid);
    if (storedEnabled === true || storedEnabled === false) return storedEnabled;
  }
  const saved = await AsyncStorage.getItem(AI_ENABLED_STORAGE_KEY);
  return saved === 'true';
}

/**
 * Settings copy for the monthly flip allowance. Numbers stay out of the sentence on purpose.
 * @param {{ isFrozenFromChurn?: boolean, freezeOffUntil?: number, remaining?: number, togglesThisMonth?: number }|null} meter
 * @returns {string}
 */
export function getAiToggleMeterHint(meter) {
  if (!meter) return '';
  if (meter.isFrozenFromChurn) {
    return `AI stays off until ${formatShortDate(meter.freezeOffUntil)} after repeated off switches this month.`;
  }
  if (meter.remaining <= 0) {
    return "You've used your full allowance for flipping this switch this month. It resets next month.";
  }
  if (meter.togglesThisMonth <= 0) {
    return 'Each on/off flip uses part of a small monthly allowance — pace yourself.';
  }
  if (meter.remaining === 1) {
    return "You're close to your monthly limit for this switch — think before the next flip.";
  }
  return "Part of this month's allowance is used — you can still flip the switch a little more.";
}

// Writes the flip, then maybe starts the freeze. Returns why the flip was blocked, or "committed".
async function recordMeteredAiToggle(uid, nextEnabled) {
  const now = Date.now();
  const monthKey = monthKeyFromTimestamp(now);
  const events = await loadToggleEvents(uid);
  const togglesThisMonth = eventsInMonth(events, monthKey).length;
  const freezeOffUntil = await clearExpiredFreeze(uid, now);

  if (nextEnabled === true && freezeOffUntil > now) {
    return { outcome: 'frozen', freezeOffUntil };
  }

  if (togglesThisMonth >= MAX_AI_TOGGLES_PER_CALENDAR_MONTH) {
    return { outcome: 'monthly_limit' };
  }

  const nextEvents = [...events, { t: now, on: nextEnabled }];
  await saveToggleEvents(uid, nextEvents);

  const offsAfter = eventsInMonth(nextEvents, monthKey).filter((event) => event.on === false).length;
  if (!nextEnabled && offsAfter >= MAX_AI_OFFS_PER_MONTH_BEFORE_FREEZE) {
    const until = now + FREEZE_OFF_MS;
    await saveFreezeOffUntil(uid, until);
  }

  return { outcome: 'committed' };
}

function emptyToggleMeter() {
  return {
    togglesThisMonth: 0,
    offsThisMonth: 0,
    remaining: MAX_AI_TOGGLES_PER_CALENDAR_MONTH,
    monthlyUseFraction: 0,
    freezeOffUntil: 0,
    isFrozenFromChurn: false,
  };
}

// ===== MAIN FUNCTION =====

/**
 * App-wide AI preference. Wrap the signed-in tree once.
 * @param {{ children: import('react').ReactNode }} props
 */
export function AIProvider({ children }) {
  // null means "still reading storage" — screens should wait on `loading` before painting the switch.
  const [aiEnabled, setAiEnabled] = useState(null);
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);
  const [toggleMeter, setToggleMeter] = useState(emptyToggleMeter);

  const refreshToggleMeter = useCallback(async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid) return;
    const meter = await computeToggleMeter(uid);
    setToggleMeter({
      togglesThisMonth: meter.togglesThisMonth,
      offsThisMonth: meter.offsThisMonth,
      remaining: meter.remaining,
      monthlyUseFraction: meter.monthlyUseFraction,
      freezeOffUntil: meter.freezeOffUntil,
      isFrozenFromChurn: meter.isFrozenFromChurn,
    });
  }, []);

  // vocab: useEffect = run after paint. The cleanup unsubscribes the auth listener.
  // vocab: onAuthStateChanged = Firebase calls this when the signed-in user changes.
  useEffect(() => {
    loadAIPreference();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user?.uid) return;
      reconcileForUser(user.uid).catch(() => {});
      refreshToggleMeter().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => unsubscribeAuth?.();
  }, [refreshToggleMeter]);

  // A read error turns AI on so a storage glitch does not lock the user out of the feature.
  const loadAIPreference = async () => {
    try {
      const uid = auth?.currentUser?.uid;
      const isEnabled = await loadStoredAiEnabled(uid, refreshToggleMeter);
      setAiEnabled(isEnabled);
    } catch (error) {
      console.error('Failed to load AI preference:', error);
      setAiEnabled(true);
    } finally {
      setIsLoadingPreference(false);
    }
  };

  // After login, prefer the per-user key, then cached profiles, then default to on.
  const reconcileForUser = async (uid) => {
    if (!uid) return;

    try {
      const storedEnabled = await readAndMirrorPerUserAiFlag(uid);
      if (storedEnabled === true || storedEnabled === false) {
        setAiEnabled(storedEnabled);
        return;
      }
    } catch (_) {
      /* continue */
    }

    const fromProfile = await findAiEnabledFromProfileCaches(uid);
    if (fromProfile === true || fromProfile === false) {
      await applyAiPreference(uid, fromProfile);
      setAiEnabled(fromProfile);
      return;
    }

    await applyAiPreference(uid, true);
    setAiEnabled(true);
  };

  /** Onboarding / programmatic — no monthly meter, no disclaimer. */
  const setAIFromOnboarding = useCallback(async (enabled) => {
    try {
      const nextEnabled = !!enabled;
      const uid = auth?.currentUser?.uid;
      await applyAiPreference(uid, nextEnabled);
      setAiEnabled(nextEnabled);
      await mirrorProfileAi(uid, nextEnabled);
    } catch (error) {
      console.error('Failed to save AI preference (onboarding):', error);
    }
  }, []);

  const commitMeteredToggle = useCallback(
    async (nextEnabled) => {
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      const result = await recordMeteredAiToggle(uid, nextEnabled);
      if (result.outcome === 'frozen') {
        Alert.alert(
          'AI stays off for now',
          `You turned AI off several times this month. It will stay off until ${formatShortDate(result.freezeOffUntil)}. Your coach and the rest of the app still work.`,
        );
        return;
      }
      if (result.outcome === 'monthly_limit') {
        Alert.alert(
          'Monthly limit reached',
          "You've used your full allowance for changing this switch this month. It resets next month — choose wisely when you turn it back on or off.",
        );
        return;
      }
      await applyAiPreference(uid, nextEnabled);
      setAiEnabled(nextEnabled);
      await mirrorProfileAi(uid, nextEnabled);
      await refreshToggleMeter();
    },
    [refreshToggleMeter],
  );

  /** Settings / user flip — disclaimer + monthly cap + freeze if they churn off. */
  const toggleAI = useCallback(
    (enabled) => {
      const nextEnabled = !!enabled;
      if (isLoadingPreference || aiEnabled === null) return;
      if (nextEnabled === aiEnabled) return;

      const meterNote =
        '\n\nFlipping this switch uses part of a small monthly allowance (you can see how much is used on the Settings screen). If you turn AI off repeatedly and leave it off, we may keep it off for about a month so you can settle on what you want.';

      Alert.alert(AI_MODEL_DISCLAIMER_TITLE, `${AI_MODEL_DISCLAIMER_BODY}${meterNote}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void commitMeteredToggle(nextEnabled) },
      ]);
    },
    [aiEnabled, isLoadingPreference, commitMeteredToggle],
  );

  // vocab: useMemo = keep the same object until one of these values changes, so consumers don't re-render for nothing.
  const value = useMemo(
    () => ({
      aiEnabled,
      loading: isLoadingPreference,
      toggleAI,
      setAIFromOnboarding,
      toggleMeter,
      refreshToggleMeter,
    }),
    [aiEnabled, isLoadingPreference, toggleAI, setAIFromOnboarding, toggleMeter, refreshToggleMeter],
  );

  return <AIPermissionContext.Provider value={value}>{children}</AIPermissionContext.Provider>;
}

/**
 * Read the AI preference from the nearest AIProvider.
 * @returns {{ aiEnabled: boolean|null, loading: boolean, toggleAI: Function, setAIFromOnboarding: Function, toggleMeter: object, refreshToggleMeter: Function }}
 */
export function useAI() {
  const contextValue = useContext(AIPermissionContext);
  if (!contextValue) throw new Error('useAI must be used within AIProvider');
  return contextValue;
}
