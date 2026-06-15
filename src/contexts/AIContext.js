/**
 * AIContext
 *
 * Purpose: AIContext — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/contexts
 * Key exports: getAiToggleMeterHint, AIProvider, useAI, AI_MODEL_DISCLAIMER_TITLE, AI_MODEL_DISCLAIMER_BODY
 *
 * @file-header
 */
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../app/config';

const AIContext = createContext(null);

/** Canonical per-user AI toggle — survives AuthGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe. */
const aiPrefStorageKey = (uid) => `user_ai_enabled_${uid}`;
const aiToggleEventsKey = (uid) => `user_ai_toggle_events_${uid}`;
const aiFreezeOffUntilKey = (uid) => `user_ai_freeze_off_until_${uid}`;

const MAX_AI_TOGGLES_PER_CALENDAR_MONTH = 3;
const MAX_AI_OFFS_PER_MONTH_BEFORE_FREEZE = 3;
const FREEZE_OFF_MS = 30 * 24 * 60 * 60 * 1000;

export const AI_MODEL_DISCLAIMER_TITLE = 'About AI in Coach Connect';

export const AI_MODEL_DISCLAIMER_BODY = `Coach Connect uses third-party AI models. Responses can be wrong, incomplete, or outdated. Nothing here is medical advice, diagnosis, or treatment — always talk to a qualified professional for health decisions.

By continuing, you agree to use AI features at your own discretion.`;

const parseAiEnabled = (rawVal) => {
  if (typeof rawVal === 'boolean') return rawVal;
  if (typeof rawVal === 'string') {
    const s = rawVal.trim().toLowerCase();
    if (s === 'true' || s === '1') return true;
    if (s === 'false' || s === '0') return false;
  }
  if (typeof rawVal === 'number') {
    if (rawVal === 1) return true;
    if (rawVal === 0) return false;
  }
  return null;
};

function monthKeyFromTs(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatShortDate(ts) {
  try {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (_) {
    return 'later';
  }
}

/** Settings / onboarding copy — no numeric “X of Y” limits; enforcement stays in code. */
export function getAiToggleMeterHint(m) {
  if (!m) return '';
  if (m.isFrozenFromChurn) {
    return `AI stays off until ${formatShortDate(m.freezeOffUntil)} after repeated off switches this month.`;
  }
  if (m.remaining <= 0) {
    return "You've used your full allowance for flipping this switch this month. It resets next month.";
  }
  if (m.togglesThisMonth <= 0) {
    return 'Each on/off flip uses part of a small monthly allowance — pace yourself.';
  }
  if (m.remaining === 1) {
    return "You're close to your monthly limit for this switch — think before the next flip.";
  }
  return "Part of this month's allowance is used — you can still flip the switch a little more.";
}

async function loadToggleEvents(uid) {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(aiToggleEventsKey(uid));
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.t === 'number' && typeof e.on === 'boolean')
      .sort((a, b) => a.t - b.t);
  } catch (_) {
    return [];
  }
}

async function saveToggleEvents(uid, events) {
  if (!uid) return;
  const cutoff = Date.now() - 400 * 24 * 60 * 60 * 1000;
  const pruned = events.filter((e) => e.t >= cutoff).slice(-200);
  await AsyncStorage.setItem(aiToggleEventsKey(uid), JSON.stringify(pruned));
}

async function loadFreezeOffUntil(uid) {
  if (!uid) return 0;
  try {
    const raw = await AsyncStorage.getItem(aiFreezeOffUntilKey(uid));
    const n = raw != null ? parseInt(String(raw), 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (_) {
    return 0;
  }
}

async function saveFreezeOffUntil(uid, ts) {
  if (!uid) return;
  if (!ts || ts <= 0) {
    await AsyncStorage.removeItem(aiFreezeOffUntilKey(uid));
    return;
  }
  await AsyncStorage.setItem(aiFreezeOffUntilKey(uid), String(ts));
}

async function computeToggleMeter(uid) {
  const now = Date.now();
  const mk = monthKeyFromTs(now);
  const events = await loadToggleEvents(uid);
  const eventsThisMonth = events.filter((e) => monthKeyFromTs(e.t) === mk);
  const togglesThisMonth = eventsThisMonth.length;
  const offsThisMonth = eventsThisMonth.filter((e) => e.on === false).length;
  let freezeOffUntil = await loadFreezeOffUntil(uid);
  if (freezeOffUntil > 0 && freezeOffUntil <= now) {
    freezeOffUntil = 0;
    await saveFreezeOffUntil(uid, 0);
  }
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

const applyAiPreference = async (uid, next) => {
  await AsyncStorage.setItem('aiEnabled', String(next));
  if (uid) await AsyncStorage.setItem(aiPrefStorageKey(uid), String(next));
};

async function mirrorProfileAi(uid, next) {
  if (!uid) return;
  const keysToUpdate = [`onboarding_data_${uid}`, `auth_profile_${uid}`];
  for (const key of keysToUpdate) {
    try {
      const raw = await AsyncStorage.getItem(key);
      const base = raw ? JSON.parse(raw) : {};
      const merged = { ...(base || {}), aiEnabled: next };
      await AsyncStorage.setItem(key, JSON.stringify(merged));
    } catch (_) {
      /* ignore */
    }
  }
}

export function AIProvider({ children }) {
  const [aiEnabled, setAiEnabled] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);
  const [toggleMeter, setToggleMeter] = useState({
    togglesThisMonth: 0,
    offsThisMonth: 0,
    remaining: MAX_AI_TOGGLES_PER_CALENDAR_MONTH,
    monthlyUseFraction: 0,
    freezeOffUntil: 0,
    isFrozenFromChurn: false,
  });

  const refreshToggleMeter = useCallback(async () => {
    const uid = auth?.currentUser?.uid;
    if (!uid) return;
    const m = await computeToggleMeter(uid);
    setToggleMeter({
      togglesThisMonth: m.togglesThisMonth,
      offsThisMonth: m.offsThisMonth,
      remaining: m.remaining,
      monthlyUseFraction: m.monthlyUseFraction,
      freezeOffUntil: m.freezeOffUntil,
      isFrozenFromChurn: m.isFrozenFromChurn,
    });
  }, []);

  useEffect(() => {
    loadAIPreference();
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user?.uid) return;
      reconcileForUser(user.uid).catch(() => {});
      refreshToggleMeter().catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => unsub?.();
  }, [refreshToggleMeter]);

  const loadAIPreference = async () => {
    try {
      const uid = auth?.currentUser?.uid;
      if (uid) {
        await refreshToggleMeter();
        const perUser = await AsyncStorage.getItem(aiPrefStorageKey(uid));
        if (perUser === 'true' || perUser === 'false') {
          const parsed = perUser === 'true';
          await AsyncStorage.setItem('aiEnabled', String(parsed));
          setAiEnabled(parsed);
          return;
        }
      }
      const saved = await AsyncStorage.getItem('aiEnabled');
      setAiEnabled(saved === 'true');
    } catch (error) {
      console.error('Failed to load AI preference:', error);
      setAiEnabled(true);
    } finally {
      setLoading(false);
    }
  };

  const reconcileForUser = async (uid) => {
    if (!uid) return;

    try {
      const direct = await AsyncStorage.getItem(aiPrefStorageKey(uid));
      if (direct === 'true' || direct === 'false') {
        const parsed = direct === 'true';
        await AsyncStorage.setItem('aiEnabled', String(parsed));
        setAiEnabled(parsed);
        return;
      }
    } catch (_) {
      /* continue */
    }

    const candidates = [`onboarding_data_${uid}`, `auth_profile_${uid}`];
    for (const key of candidates) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const data = JSON.parse(raw);
        const normalized = parseAiEnabled(data?.aiEnabled);
        if (normalized === true || normalized === false) {
          await applyAiPreference(uid, normalized);
          setAiEnabled(normalized);
          return;
        }
      } catch (_) {
        /* ignore */
      }
    }

    await applyAiPreference(uid, true);
    setAiEnabled(true);
  };

  /** Onboarding / programmatic — no monthly meter, no disclaimer. */
  const setAIFromOnboarding = useCallback(async (enabled) => {
    try {
      const next = !!enabled;
      const uid = auth?.currentUser?.uid;
      await applyAiPreference(uid, next);
      setAiEnabled(next);
      await mirrorProfileAi(uid, next);
    } catch (error) {
      console.error('Failed to save AI preference (onboarding):', error);
    }
  }, []);

  const commitMeteredToggle = useCallback(
    async (next) => {
      const uid = auth?.currentUser?.uid;
      if (!uid) return;
      const now = Date.now();
      const mk = monthKeyFromTs(now);
      const events = await loadToggleEvents(uid);
      const eventsThisMonth = events.filter((e) => monthKeyFromTs(e.t) === mk);
      const togglesThisMonth = eventsThisMonth.length;
      let freezeOffUntil = await loadFreezeOffUntil(uid);
      if (freezeOffUntil > 0 && freezeOffUntil <= now) {
        freezeOffUntil = 0;
        await saveFreezeOffUntil(uid, 0);
      }

      if (next === true && freezeOffUntil > now) {
        Alert.alert(
          'AI stays off for now',
          `You turned AI off several times this month. It will stay off until ${formatShortDate(freezeOffUntil)}. Your coach and the rest of the app still work.`,
        );
        return;
      }

      if (togglesThisMonth >= MAX_AI_TOGGLES_PER_CALENDAR_MONTH) {
        Alert.alert(
          'Monthly limit reached',
          "You've used your full allowance for changing this switch this month. It resets next month — choose wisely when you turn it back on or off.",
        );
        return;
      }

      const nextEvents = [...events, { t: now, on: next }];
      await saveToggleEvents(uid, nextEvents);

      const monthEvents = nextEvents.filter((e) => monthKeyFromTs(e.t) === mk);
      const offsAfter = monthEvents.filter((e) => e.on === false).length;
      if (!next && offsAfter >= MAX_AI_OFFS_PER_MONTH_BEFORE_FREEZE) {
        const until = now + FREEZE_OFF_MS;
        await saveFreezeOffUntil(uid, until);
      }

      await applyAiPreference(uid, next);
      setAiEnabled(next);
      await mirrorProfileAi(uid, next);
      await refreshToggleMeter();
    },
    [refreshToggleMeter],
  );

  /** Settings / user flip — disclaimer + monthly cap + freeze if they churn off. */
  const toggleAI = useCallback(
    (enabled) => {
      const next = !!enabled;
      if (loading || aiEnabled === null) return;
      if (next === aiEnabled) return;

      const meterNote =
        '\n\nFlipping this switch uses part of a small monthly allowance (you can see how much is used on the Settings screen). If you turn AI off repeatedly and leave it off, we may keep it off for about a month so you can settle on what you want.';

      Alert.alert(AI_MODEL_DISCLAIMER_TITLE, `${AI_MODEL_DISCLAIMER_BODY}${meterNote}`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => void commitMeteredToggle(next) },
      ]);
    },
    [aiEnabled, loading, commitMeteredToggle],
  );

  const value = useMemo(
    () => ({
      aiEnabled,
      loading,
      toggleAI,
      setAIFromOnboarding,
      toggleMeter,
      refreshToggleMeter,
    }),
    [aiEnabled, loading, toggleAI, setAIFromOnboarding, toggleMeter, refreshToggleMeter],
  );

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}
