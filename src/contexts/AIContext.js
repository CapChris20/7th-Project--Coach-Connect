import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../app/config';

const AIContext = createContext(null);

/** Canonical per-user AI toggle — survives AuthGate profile refresh; key avoids clearAllUserData() coachconnect_* wipe. */
const aiPrefStorageKey = (uid) => `user_ai_enabled_${uid}`;

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

const applyAiPreference = async (uid, next) => {
  await AsyncStorage.setItem('aiEnabled', String(next));
  if (uid) await AsyncStorage.setItem(aiPrefStorageKey(uid), String(next));
};

export function AIProvider({ children }) {
  const [aiEnabled, setAiEnabled] = useState(null); // null = loading
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAIPreference();
    // When a user logs in, load their saved AI preference (never force-off just because profile JSON lacks the field).
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user?.uid) return;
      reconcileForUser(user.uid).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => unsub?.();
  }, []);

  const loadAIPreference = async () => {
    try {
      const uid = auth?.currentUser?.uid;
      if (uid) {
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

    // 1) Per-user key (written by Settings toggle — not overwritten when AuthGate refreshes Firestore profile cache).
    try {
      const direct = await AsyncStorage.getItem(aiPrefStorageKey(uid));
      if (direct === 'true' || direct === 'false') {
        const parsed = direct === 'true';
        await AsyncStorage.setItem('aiEnabled', String(parsed));
        setAiEnabled(parsed);
        return;
      }
    } catch (_) {
      // continue
    }

    // 2) Onboarding / cached profile blobs (may include aiEnabled right after onboarding).
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
        // ignore and continue
      }
    }

    // 3) No stored choice: default AI on (opt-out). Never reset returning users to off just because Firestore has no field.
    await applyAiPreference(uid, true);
    setAiEnabled(true);
  };

  const toggleAI = async (enabled) => {
    try {
      const next = !!enabled;
      const uid = auth?.currentUser?.uid;
      await applyAiPreference(uid, next);
      setAiEnabled(next);

      // Mirror into cached profile/onboarding JSON when present (best-effort).
      if (uid) {
        const keysToUpdate = [`onboarding_data_${uid}`, `auth_profile_${uid}`];
        for (const key of keysToUpdate) {
          try {
            const raw = await AsyncStorage.getItem(key);
            const base = raw ? JSON.parse(raw) : {};
            const merged = { ...(base || {}), aiEnabled: next };
            await AsyncStorage.setItem(key, JSON.stringify(merged));
          } catch (_) {
            // ignore
          }
        }
      }
    } catch (error) {
      console.error('Failed to save AI preference:', error);
    }
  };

  const value = useMemo(() => ({ aiEnabled, loading, toggleAI }), [aiEnabled, loading]);

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAI() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAI must be used within AIProvider');
  return ctx;
}

