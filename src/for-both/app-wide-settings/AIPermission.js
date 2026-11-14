// Remembers whether this user wants AI features on, and how often they may flip that switch.
// Flow: read the saved preference → show the disclaimer on a settings flip → count the flip → freeze AI off after too many "off" switches.
// Used by Settings, onboarding, and any screen that calls useAI().
// Read order: constants → exported hint + provider → PLUMBING storage / meter helpers.

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const MILLISECONDS_PER_DAY =
  HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Manipulate here: how many on/off flips one calendar month allows.
const MAX_AI_TOGGLES_PER_CALENDAR_MONTH = 3;
// Manipulate here: how many "off" flips in that month force AI to stay off.
const MAX_AI_OFFS_PER_MONTH_BEFORE_FREEZE = 3;
// Manipulate here: how many days the forced-off period lasts after that churn.
const FREEZE_OFF_DAYS = 30;
const FREEZE_OFF_MS = FREEZE_OFF_DAYS * MILLISECONDS_PER_DAY;
// Manipulate here: events older than this many days are dropped the next time we save the log.
const TOGGLE_EVENT_RETENTION_DAYS = 400;
const TOGGLE_EVENT_RETENTION_MS = TOGGLE_EVENT_RETENTION_DAYS * MILLISECONDS_PER_DAY;
const MAX_STORED_TOGGLE_EVENTS = 200;

// Device-wide copy. The per-user key below is the one that survives a profile refresh.
// Freeze: storage key letters must stay aiEnabled.
const AI_ENABLED_STORAGE_KEY = 'aiEnabled';

const TOGGLE_OUTCOME_FROZEN = 'frozen';
const TOGGLE_OUTCOME_MONTHLY_LIMIT = 'monthly_limit';
const TOGGLE_OUTCOME_COMMITTED = 'committed';

const STORED_TRUE = 'true';
const STORED_FALSE = 'false';
const STORED_ONE = '1';
const STORED_ZERO = '0';

/** Title of the alert shown before a settings AI toggle. */
export const AI_MODEL_DISCLAIMER_TITLE = 'About AI in Coach Connect';

/** Body of that alert. Enforcement of the monthly cap stays in code, not in this copy. */
export const AI_MODEL_DISCLAIMER_BODY = `Coach Connect uses third-party AI models. Responses can be wrong, incomplete, or outdated. Nothing here is medical advice, diagnosis, or treatment — always talk to a qualified professional for health decisions.

By continuing, you agree to use AI features at your own discretion.`;

const AIPermissionContext = createContext(null);

const MONTHLY_ALLOWANCE_METER_NOTE =
  '\n\nFlipping this switch uses part of a small monthly allowance (you can see how much is used on the Settings screen). If you turn AI off repeatedly and leave it off, we may keep it off for about a month so you can settle on what you want.';

// ===== MAIN FUNCTION =====

/**
 * Settings copy for the monthly flip allowance. Numbers stay out of the sentence on purpose.
 * @param {{ isFrozenFromChurn?: boolean, freezeOffUntil?: number, remaining?: number, togglesThisMonth?: number }|null} meter
 * @returns {string}
 */
export function getAiToggleMeterHint(meter) {
  // 1. No meter yet, or they are frozen off from churn.
  if (!meter) return '';
  if (meter.isFrozenFromChurn) {
    return `AI stays off until ${formatShortDate(meter.freezeOffUntil)} after repeated off switches this month.`;
  }

  // 2. Used the full monthly allowance.
  if (meter.remaining <= 0) {
    return "You've used your full allowance for flipping this switch this month. It resets next month.";
  }

  // 3. Unused, almost out, or partway through.
  if (meter.togglesThisMonth <= 0) {
    return 'Each on/off flip uses part of a small monthly allowance — pace yourself.';
  }
  if (meter.remaining === 1) {
    return "You're close to your monthly limit for this switch — think before the next flip.";
  }
  return "Part of this month's allowance is used — you can still flip the switch a little more.";
}

/**
 * App-wide AI preference. Wrap the signed-in tree once.
 * Hook order is frozen: three useState → refreshToggleMeter → auth useEffect →
 * setAIFromOnboarding → commitMeteredToggle → toggleAI → value useMemo.
 * @param {{ children: import('react').ReactNode }} props
 */
export function AIProvider({ children }) {
  // null means "still reading storage" — screens should wait on `loading` before painting the switch.
  const [aiEnabled, setAiEnabled] = useState(null);
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);
  const [toggleMeter, setToggleMeter] = useState(emptyToggleMeter);

  const refreshToggleMeter = useCallback(async () => {
    const uid = signedInUserId();
    if (!uid) return;
    const meter = await computeToggleMeter(uid);
    setToggleMeter(meterFieldsForContext(meter));
  }, []);

  useEffect(() => {
    loadAIPreference();
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      const uid = userIdFromAuthUser(user);
      if (!uid) return;
      reconcileForUser(uid).catch(() => {});
      refreshToggleMeter().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, [refreshToggleMeter]);

  // A read error turns AI on so a storage glitch does not lock the user out of the feature.
  const loadAIPreference = async () => {
    try {
      // 1. Per-user key wins. Device-wide flag is the fallback.
      const uid = signedInUserId();
      const isEnabled = await loadStoredAiEnabled(uid, refreshToggleMeter);
      setAiEnabled(isEnabled);
    } catch (error) {
      // 2. A read error turns AI on so a storage glitch does not lock the user out.
      console.error('Failed to load AI preference:', error);
      setAiEnabled(true);
    } finally {
      setIsLoadingPreference(false);
    }
  };

  // After login, prefer the per-user key, then cached profiles, then default to on.
  const reconcileForUser = async (uid) => {
    // 1. Need a signed-in user.
    if (!uid) return;

    const fromPerUserKey = await tryReadPerUserAiFlag(uid);
    if (isExactBoolean(fromPerUserKey)) {
      setAiEnabled(fromPerUserKey);
      return;
    }

    // 2. Cached profile blobs, then default to on.
    const fromProfile = await findAiEnabledFromProfileCaches(uid);
    if (isExactBoolean(fromProfile)) {
      await applyAiPreference(uid, fromProfile);
      setAiEnabled(fromProfile);
      return;
    }

    await applyAiPreference(uid, true);
    setAiEnabled(true);
  };

  // Design Law AI permission step (client-onboarding PNG 13/14): Turn on / Not now
  // must NOT burn the Settings monthly flip meter or show the disclaimer alert.
  const setAIFromOnboarding = useCallback(async (enabled) => {
    try {
      const nextEnabled = !!enabled;
      const uid = signedInUserId();
      await applyAiPreference(uid, nextEnabled);
      setAiEnabled(nextEnabled);
      await mirrorProfileAi(uid, nextEnabled);
    } catch (error) {
      console.error('Failed to save AI preference (onboarding):', error);
    }
  }, []);

  const commitMeteredToggle = useCallback(
    async (nextEnabled) => {
      // 1. Need a signed-in user to count this flip.
      const uid = signedInUserId();
      if (!uid) return;
      const result = await recordMeteredAiToggle(uid, nextEnabled);

      // 2. Frozen from churn, or the monthly flip cap is already used.
      if (result.outcome === TOGGLE_OUTCOME_FROZEN) {
        Alert.alert(
          'AI stays off for now',
          `You turned AI off several times this month. It will stay off until ${formatShortDate(result.freezeOffUntil)}. Your coach and the rest of the app still work.`,
        );
        return;
      }
      if (result.outcome === TOGGLE_OUTCOME_MONTHLY_LIMIT) {
        Alert.alert(
          'Monthly limit reached',
          "You've used your full allowance for changing this switch this month. It resets next month — choose wisely when you turn it back on or off.",
        );
        return;
      }

      // 3. Write the new preference and refresh the meter.
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
      // 1. Ignore taps while storage is still loading, or a no-op flip.
      const nextEnabled = !!enabled;
      if (isLoadingPreference) return;
      if (aiEnabled === null) return;
      if (nextEnabled === aiEnabled) return;

      // 2. Disclaimer first. Continue writes the flip and counts it against the month.
      Alert.alert(
        AI_MODEL_DISCLAIMER_TITLE,
        `${AI_MODEL_DISCLAIMER_BODY}${MONTHLY_ALLOWANCE_METER_NOTE}`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue', onPress: () => void commitMeteredToggle(nextEnabled) },
        ],
      );
    },
    [aiEnabled, isLoadingPreference, commitMeteredToggle],
  );

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

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless debugging storage keys or toggle metering.

function signedInUserId() {
  if (!auth) return null;
  if (!auth.currentUser) return null;
  return auth.currentUser.uid || null;
}

function userIdFromAuthUser(user) {
  if (!user) return null;
  if (!user.uid) return null;
  return user.uid;
}

function isExactBoolean(value) {
  if (value === true) return true;
  if (value === false) return true;
  return false;
}

function meterFieldsForContext(meter) {
  return {
    togglesThisMonth: meter.togglesThisMonth,
    offsThisMonth: meter.offsThisMonth,
    remaining: meter.remaining,
    monthlyUseFraction: meter.monthlyUseFraction,
    freezeOffUntil: meter.freezeOffUntil,
    isFrozenFromChurn: meter.isFrozenFromChurn,
  };
}

async function tryReadPerUserAiFlag(uid) {
  try {
    return await readAndMirrorPerUserAiFlag(uid);
  } catch (ignoredError) {
    return null;
  }
}

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

function parseAiEnabled(rawValue) {
  if (typeof rawValue === 'boolean') return rawValue;

  if (typeof rawValue === 'string') {
    return parseAiEnabledString(rawValue);
  }

  if (typeof rawValue === 'number') {
    return parseAiEnabledNumber(rawValue);
  }

  return null;
}

function parseAiEnabledString(rawValue) {
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === STORED_TRUE || normalized === STORED_ONE) return true;
  if (normalized === STORED_FALSE || normalized === STORED_ZERO) return false;
  return null;
}

function parseAiEnabledNumber(rawValue) {
  if (rawValue === 1) return true;
  if (rawValue === 0) return false;
  return null;
}

function monthKeyFromTimestamp(timestamp) {
  const date = new Date(timestamp);
  const monthNumber = String(date.getMonth() + 1).padStart(2, '0');
  return `${date.getFullYear()}-${monthNumber}`;
}

function formatShortDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (ignoredError) {
    return 'later';
  }
}

// Stored flip shape is { t: timestampMs, on: boolean }. Those keys are the saved JSON — do not rename them.
function isStoredToggleEvent(event) {
  if (!event) return false;
  if (typeof event.t !== 'number') return false;
  if (typeof event.on !== 'boolean') return false;
  return true;
}

async function loadToggleEvents(uid) {
  if (!uid) return [];
  try {
    const jsonFromStorage = await AsyncStorage.getItem(aiToggleEventsKey(uid));
    const parsedEvents = parseJsonArrayOrEmpty(jsonFromStorage);
    return keepValidToggleEventsSorted(parsedEvents);
  } catch (ignoredError) {
    return [];
  }
}

function parseJsonArrayOrEmpty(jsonFromStorage) {
  if (!jsonFromStorage) return [];
  const parsed = JSON.parse(jsonFromStorage);
  if (!Array.isArray(parsed)) return [];
  return parsed;
}

function keepValidToggleEventsSorted(parsedEvents) {
  const validEvents = [];
  for (let index = 0; index < parsedEvents.length; index += 1) {
    const event = parsedEvents[index];
    if (isStoredToggleEvent(event)) validEvents.push(event);
  }
  validEvents.sort((left, right) => left.t - right.t);
  return validEvents;
}

async function saveToggleEvents(uid, events) {
  if (!uid) return;
  const cutoff = Date.now() - TOGGLE_EVENT_RETENTION_MS;
  const eventsToKeep = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (event.t >= cutoff) eventsToKeep.push(event);
  }
  const trimmedEvents = eventsToKeep.slice(-MAX_STORED_TOGGLE_EVENTS);
  await AsyncStorage.setItem(aiToggleEventsKey(uid), JSON.stringify(trimmedEvents));
}

async function loadFreezeOffUntil(uid) {
  if (!uid) return 0;
  try {
    const raw = await AsyncStorage.getItem(aiFreezeOffUntilKey(uid));
    return parseFreezeTimestamp(raw);
  } catch (ignoredError) {
    return 0;
  }
}

function parseFreezeTimestamp(raw) {
  if (raw == null) return 0;
  const parsedTimestamp = parseInt(String(raw), 10);
  if (!Number.isFinite(parsedTimestamp)) return 0;
  if (parsedTimestamp <= 0) return 0;
  return parsedTimestamp;
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
  const freezeHasExpired = freezeOffUntil > 0 && freezeOffUntil <= now;
  if (freezeHasExpired) {
    freezeOffUntil = 0;
    await saveFreezeOffUntil(uid, 0);
  }
  return freezeOffUntil;
}

function eventsInMonth(events, monthKey) {
  const matched = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (monthKeyFromTimestamp(event.t) === monthKey) matched.push(event);
  }
  return matched;
}

async function computeToggleMeter(uid) {
  const now = Date.now();
  const monthKey = monthKeyFromTimestamp(now);
  const events = await loadToggleEvents(uid);
  const eventsThisMonth = eventsInMonth(events, monthKey);
  const togglesThisMonth = eventsThisMonth.length;
  const offsThisMonth = countOffEvents(eventsThisMonth);
  const freezeOffUntil = await clearExpiredFreeze(uid, now);
  const remaining = Math.max(0, MAX_AI_TOGGLES_PER_CALENDAR_MONTH - togglesThisMonth);
  const monthlyUseFraction = monthlyUseFractionForCount(togglesThisMonth);

  return {
    togglesThisMonth,
    offsThisMonth,
    remaining,
    monthlyUseFraction,
    freezeOffUntil,
    isFrozenFromChurn: freezeOffUntil > now,
  };
}

function countOffEvents(events) {
  let offCount = 0;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].on === false) offCount += 1;
  }
  return offCount;
}

function monthlyUseFractionForCount(togglesThisMonth) {
  if (MAX_AI_TOGGLES_PER_CALENDAR_MONTH <= 0) return 0;
  const fraction = togglesThisMonth / MAX_AI_TOGGLES_PER_CALENDAR_MONTH;
  if (fraction > 1) return 1;
  return fraction;
}

async function applyAiPreference(uid, nextEnabled) {
  await AsyncStorage.setItem(AI_ENABLED_STORAGE_KEY, String(nextEnabled));
  if (uid) await AsyncStorage.setItem(aiPrefStorageKey(uid), String(nextEnabled));
}

async function mirrorProfileAi(uid, nextEnabled) {
  if (!uid) return;
  const keysToUpdate = [onboardingDataStorageKey(uid), authProfileStorageKey(uid)];
  for (let index = 0; index < keysToUpdate.length; index += 1) {
    await writeAiEnabledOntoCacheKey(keysToUpdate[index], nextEnabled);
  }
}

async function writeAiEnabledOntoCacheKey(storageKey, nextEnabled) {
  try {
    const jsonFromStorage = await AsyncStorage.getItem(storageKey);
    const cachedProfile = jsonFromStorage ? JSON.parse(jsonFromStorage) : {};
    const safeProfile = cachedProfile || {};
    const profileWithAi = { ...safeProfile, aiEnabled: nextEnabled };
    await AsyncStorage.setItem(storageKey, JSON.stringify(profileWithAi));
  } catch (ignoredError) {
    /* ignore corrupt cache blobs */
  }
}

async function readAndMirrorPerUserAiFlag(uid) {
  const perUser = await AsyncStorage.getItem(aiPrefStorageKey(uid));
  if (perUser === STORED_TRUE) {
    await AsyncStorage.setItem(AI_ENABLED_STORAGE_KEY, STORED_TRUE);
    return true;
  }
  if (perUser === STORED_FALSE) {
    await AsyncStorage.setItem(AI_ENABLED_STORAGE_KEY, STORED_FALSE);
    return false;
  }
  return null;
}

async function readAiEnabledFromCacheKey(storageKey) {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const rawFlag = data ? data.aiEnabled : null;
    const normalized = parseAiEnabled(rawFlag);
    if (isExactBoolean(normalized)) return normalized;
    return null;
  } catch (ignoredError) {
    return null;
  }
}

async function findAiEnabledFromProfileCaches(uid) {
  const cacheKeys = [onboardingDataStorageKey(uid), authProfileStorageKey(uid)];
  for (let index = 0; index < cacheKeys.length; index += 1) {
    const normalized = await readAiEnabledFromCacheKey(cacheKeys[index]);
    if (isExactBoolean(normalized)) return normalized;
  }
  return null;
}

async function loadStoredAiEnabled(uid, refreshToggleMeter) {
  if (uid) {
    await refreshToggleMeter();
    const storedEnabled = await readAndMirrorPerUserAiFlag(uid);
    if (isExactBoolean(storedEnabled)) return storedEnabled;
  }
  const saved = await AsyncStorage.getItem(AI_ENABLED_STORAGE_KEY);
  return saved === STORED_TRUE;
}

async function recordMeteredAiToggle(uid, nextEnabled) {
  const now = Date.now();
  const monthKey = monthKeyFromTimestamp(now);
  const events = await loadToggleEvents(uid);
  const togglesThisMonth = eventsInMonth(events, monthKey).length;
  const freezeOffUntil = await clearExpiredFreeze(uid, now);

  if (nextEnabled === true && freezeOffUntil > now) {
    return { outcome: TOGGLE_OUTCOME_FROZEN, freezeOffUntil };
  }
  if (togglesThisMonth >= MAX_AI_TOGGLES_PER_CALENDAR_MONTH) {
    return { outcome: TOGGLE_OUTCOME_MONTHLY_LIMIT };
  }

  // Freeze: event keys stay t / on — other code and stored JSON depend on those letters.
  const nextEvents = [...events, { t: now, on: nextEnabled }];
  await saveToggleEvents(uid, nextEvents);

  const offsAfter = countOffEvents(eventsInMonth(nextEvents, monthKey));
  if (!nextEnabled && offsAfter >= MAX_AI_OFFS_PER_MONTH_BEFORE_FREEZE) {
    const until = now + FREEZE_OFF_MS;
    await saveFreezeOffUntil(uid, until);
  }

  return { outcome: TOGGLE_OUTCOME_COMMITTED };
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
