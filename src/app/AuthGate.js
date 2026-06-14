/**
 * AuthGate - Handles authentication state and routes to appropriate app
 * 
 * Responsibilities:
 * - Shows splash screen initially
 * - Handles auth flow (login, signup, forgot password)
 * - Checks onboarding status
 * - Routes authenticated users to TrainerApp or ClientApp based on role
 */

import React, { useState, useEffect } from 'react';
import AuthScreen from '../auth/AuthScreen';
import ForgotPasswordScreen from '../auth/ForgotPasswordScreen';
import OnboardingScreen from '../auth/OnboardingScreen';
import TrainerApp from './TrainerApp';
import ClientApp from './ClientApp';
import AppLoadingScreen from '../shared/components/AppLoadingScreen';
import { auth, db } from './config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeErrorSync } from '../../utils/errorSyncService';
import { clearOldSharedChats } from '../ai/services/chatStorageService';
import { clearAllUserData } from '../utils/dataCacheCleanup';
import { flushPendingOnboardingSync } from '../shared/services/onboardingSync';
import { clearPushTokensForUid } from '../shared/services/notificationsService';
import logger from '../shared/services/logger';

const getProfileCacheKey = (uid) => `auth_profile_${uid}`;

/** Single source for routing + onboarding; avoids null/undefined flashing the wrong shell. */
function normalizeAppRole(role) {
  return String(role || '').toLowerCase().trim() === 'trainer' ? 'trainer' : 'client';
}

/** Only force onboarding when explicitly incomplete — missing field = legacy users who already use the app. */
function profileNeedsOnboarding(profile) {
  if (!profile || typeof profile !== 'object') return false;
  if (profile.onboardingCompletedAt) return false;
  const v = profile.onboardingCompleted;
  if (v === true || v === 'true' || v === 1) return false;
  if (v === false || v === 'false' || v === 0) return true;
  if (
    profile.authProvider === 'google' &&
    !profile.onboardingCompletedAt &&
    profile.createdAt
  ) {
    const createdMs = new Date(profile.createdAt).getTime();
    const recent =
      Number.isFinite(createdMs) && Date.now() - createdMs < 7 * 24 * 60 * 60 * 1000;
    if (recent) return true;
  }
  return false;
}

/** Firestore may not exist yet when auth fires right after first Google/email sign-up. */
function isLikelyNewFirebaseUser(firebaseUser) {
  if (!firebaseUser?.metadata) return false;
  try {
    const created = new Date(firebaseUser.metadata.creationTime).getTime();
    const lastSignIn = new Date(firebaseUser.metadata.lastSignInTime).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false;
    return Math.abs(lastSignIn - created) < 3 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Firestore can lag behind local completion (API/offline). Prefer AsyncStorage if it proves onboarding finished.
 * Keys: `onboarding_data_${uid}` (full payload from OnboardingScreen) and `auth_profile_${uid}` (AuthGate cache).
 */
async function mergeLocalOnboardingTruth(uid, firestoreProfile) {
  if (!uid || !firestoreProfile || typeof firestoreProfile !== 'object') {
    return firestoreProfile;
  }
  const base = { ...firestoreProfile };
  try {
    const keys = [`onboarding_data_${uid}`, getProfileCacheKey(uid)];
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      let loc;
      try {
        loc = JSON.parse(raw);
      } catch {
        continue;
      }
      const done =
        loc?.onboardingCompleted === true ||
        loc?.onboardingCompleted === 'true' ||
        loc?.onboardingCompleted === 1 ||
        !!loc?.onboardingCompletedAt;
      if (done) {
        return {
          ...base,
          onboardingCompleted: true,
          onboardingCompletedAt: loc.onboardingCompletedAt || base.onboardingCompletedAt || null,
        };
      }
    }
  } catch (_) {
    /* ignore */
  }
  return base;
}

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [keyLoaded, setKeyLoaded] = useState(false);

  // Load API key and initialize error syncing on app start
  useEffect(() => {
    (async () => {
      try {
        // Initialize automatic error syncing
        await initializeErrorSync();
      } catch (e) {
        console.error('Failed to load API key:', e);
      } finally {
        setKeyLoaded(true);
      }
    })();
  }, []);

  // Set up global error handlers - DISABLED TO PREVENT INFINITE LOOPS
  // Error handlers re-enabled in AuthGate useEffect monitoring for auth state

  // Firebase auth state listener
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clear cache when user signs out or switches
      if (!firebaseUser && user) {
        try {
          if (user.uid) await clearPushTokensForUid(user.uid);
        } catch (_) {
          /* best-effort */
        }
        await clearAllUserData();
      }
      
      // Clear cache when user switches accounts
      if (firebaseUser && user && firebaseUser.uid !== user.uid) {
        try {
          await clearPushTokensForUid(user.uid);
        } catch (_) {
          /* best-effort */
        }
        await clearAllUserData();
      }
      
      // Clear old shared chats when user logs in (migration)
      if (firebaseUser) {
        try {
          await clearOldSharedChats();
        } catch (e) {
          // Ignore errors - migration is optional
        }
      }
      
      setUser(firebaseUser);
      
      // Load user role and check onboarding status
      if (firebaseUser) {
        // Best-effort: if onboarding couldn't sync earlier (offline/dev API down),
        // retry in the background as soon as we have an authed user.
        flushPendingOnboardingSync(firebaseUser).catch(() => {});

        // Prefer direct Firestore profile read first. This keeps auth flow stable even when
        // backend `/api/me` is misconfigured for a different Firebase project.
        try {
          if (db && firebaseUser?.uid) {
            const uid = firebaseUser.uid;
            const profileRef = doc(db, 'users', uid);
            const profileSnap = await Promise.race([
              getDoc(profileRef),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore profile timeout')), 7000)),
            ]);

            if (profileSnap?.exists?.()) {
              let profile = { uid, ...(profileSnap.data() || {}) };
              if (profile?.role) {
                profile = await mergeLocalOnboardingTruth(uid, profile);
                setUserData(profile);
                setUserRole(profile.role);
                setShowOnboarding(profileNeedsOnboarding(profile));
                try {
                  await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(profile));
                } catch (_) {}
                setAuthLoading(false);
                setOnboardingChecked(true);
                return;
              }
            }
          }
        } catch (firestoreBootstrapError) {
          // Continue to server/cache fallbacks below.
          console.warn('Firestore-first auth bootstrap failed:', firestoreBootstrapError?.message || firestoreBootstrapError);
        }

        // Final bootstrap path (no backend dependency):
        // 1) retry Firestore once without timeout,
        // 2) use local cache,
        // 3) default into client flow to keep app usable.
        try {
          if (db && firebaseUser?.uid) {
            const uid = firebaseUser.uid;
            const retrySnap = await getDoc(doc(db, 'users', uid));
            if (retrySnap?.exists?.()) {
              let profile = { uid, ...(retrySnap.data() || {}) };
              if (profile?.role) {
                profile = await mergeLocalOnboardingTruth(uid, profile);
                setUserData(profile);
                setUserRole(profile.role);
                setShowOnboarding(profileNeedsOnboarding(profile));
                try {
                  await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(profile));
                } catch (_) {}
                setAuthLoading(false);
                setOnboardingChecked(true);
                return;
              }
            }
          }
        } catch (retryError) {
          console.warn('Firestore retry bootstrap failed:', retryError?.message || retryError);
        }

        try {
          const uid = firebaseUser?.uid;
          if (uid) {
            const candidates = [
              await AsyncStorage.getItem(getProfileCacheKey(uid)),
              await AsyncStorage.getItem(`onboarding_data_${uid}`),
            ];
            for (const cachedRaw of candidates) {
              if (!cachedRaw) continue;
              const cached = JSON.parse(cachedRaw);
              const cachedRole = cached?.role || null;
              if (!cachedRole) continue;
              const profile = { uid, ...(cached || {}) };
              setUserData(profile);
              setUserRole(cachedRole);
              setShowOnboarding(profileNeedsOnboarding(profile));
              setAuthLoading(false);
              setOnboardingChecked(true);
              return;
            }
          }
        } catch (cacheError) {
          console.warn('AsyncStorage bootstrap fallback failed:', cacheError?.message || cacheError);
        }

        const uid = firebaseUser?.uid || null;
        const likelyNew = isLikelyNewFirebaseUser(firebaseUser);
        setUserData(
          uid
            ? { uid, role: 'client', onboardingCompleted: likelyNew ? false : true }
            : null
        );
        setUserRole('client');
        setShowOnboarding(likelyNew);
        setAuthLoading(false);
        setOnboardingChecked(true);
        return;

        // Server fallback path.
        try {
          const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
          const fallbackBaseUrls = [
            'http://localhost:4002',
            'http://127.0.0.1:4002',
            'http://localhost:4001',
            'http://127.0.0.1:4001',
          ];

          if (!apiBaseUrl) throw new Error('Missing EXPO_PUBLIC_API_BASE_URL');

          const tryFetchMe = async (baseUrl) => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 7000);

            const fetchWithFreshToken = async () => {
              await firebaseUser.reload();
              const idToken = await firebaseUser.getIdToken(true);
              if (!idToken || typeof idToken !== 'string') {
                throw new Error('Missing/invalid Firebase ID token');
              }

              // Guard against mixed Firebase projects in local env/config.
              try {
                const expectedAud = String(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '').trim();
                const tokenPayloadRaw = idToken.split('.')[1] || '';
                if (typeof global?.atob !== 'function') {
                  throw new Error('atob unavailable');
                }
                const tokenPayloadJson = global.atob(tokenPayloadRaw.replace(/-/g, '+').replace(/_/g, '/'));
                const tokenPayload = JSON.parse(tokenPayloadJson);
                const tokenAud = String(tokenPayload?.aud || '').trim();
                if (expectedAud && tokenAud && tokenAud !== expectedAud) {
                  const err = new Error(`Firebase project mismatch: token aud=${tokenAud}, expected=${expectedAud}`);
                  err.code = 'auth/project-mismatch';
                  throw err;
                }
              } catch (tokenErr) {
                // Bubble mismatch errors; ignore decode errors and let server verify token.
                if (tokenErr?.code === 'auth/project-mismatch') throw tokenErr;
              }

              return fetch(`${baseUrl}/api/me`, {
                method: 'GET',
                headers: {
                  Authorization: `Bearer ${idToken}`,
                  Accept: 'application/json',
                },
                signal: controller.signal,
              });
            };

            try {
              let resp = await fetchWithFreshToken();

              if (!resp.ok) {
                const text = await resp.text().catch(() => '');
                // If token verification fails (401), we'll fall back to Firestore below.
                const err = new Error(`Server /api/me failed (${resp.status}) ${text}`.trim());
                err.status = resp.status;
                throw err;
              }

              const payload = await resp.json();
              return payload?.user || payload || {};
            } finally {
              clearTimeout(timeoutId);
            }
          };

          let data = null;
          try {
            data = await tryFetchMe(apiBaseUrl);
          } catch (e) {
            // Don't waste time trying other bases when the token itself is being rejected.
            if (e?.status === 401) throw e;

            // If we couldn't connect to the provided IP, retry with localhost addresses (iOS simulator).
            const firstMsg = e?.message || '';
            console.warn('Server /api/me fetch failed; trying localhost fallback:', firstMsg);

            for (const base of fallbackBaseUrls) {
              try {
                data = await tryFetchMe(base);
                break;
              } catch (_) {
                // continue trying other bases
              }
            }

            if (!data) throw e;
          }

          logger.debug('/api/me response', {
            role: data?.role || null,
            onboardingCompleted: !!data?.onboardingCompleted,
          });

          try {
            await AsyncStorage.setItem(getProfileCacheKey(firebaseUser.uid), JSON.stringify(data || {}));
          } catch (_) {
            // Non-blocking cache write
          }

          setUserData(data);
          setUserRole(data?.role || null);
          setShowOnboarding(profileNeedsOnboarding(data));
        } catch (serverError) {
          console.warn('Server /api/me failed (falling back to Firestore role):', {
            message: serverError?.message,
            code: serverError?.code,
          });

          // If the Firebase token audience doesn't match the backend's Firebase project
          // (e.g. user still has a persisted session from a different project),
          // force a sign-out so the next login creates an ID token for the correct project.
          const serverErrMsg = String(serverError?.message || '').toLowerCase();
          const isAudienceMismatch =
            (serverErrMsg.includes('incorrect') && serverErrMsg.includes('aud')) ||
            (serverErrMsg.includes('audience') && serverErrMsg.includes('expected') && serverErrMsg.includes('but got')) ||
            serverErrMsg.includes('project mismatch');
          if (isAudienceMismatch) {
            // Non-blocking: continue with local/Firestore fallback flow.
            console.warn('Firebase audience mismatch detected; continuing with Firestore-first flow.');
          }

          // Hard offline fallback: use locally cached onboarding profile first.
          try {
            const uid = firebaseUser?.uid;
            if (uid) {
              const candidates = [
                await AsyncStorage.getItem(getProfileCacheKey(uid)),
                await AsyncStorage.getItem(`onboarding_data_${uid}`),
              ];

              for (const cachedRaw of candidates) {
                if (!cachedRaw) continue;
                const cached = JSON.parse(cachedRaw);
                const cachedRole = cached?.role || null;
                if (!cachedRole) continue;
                const profile = { uid, ...(cached || {}) };
                setUserData(profile);
                setUserRole(cachedRole);
                setShowOnboarding(profileNeedsOnboarding(profile));
                return;
              }
            }
          } catch (cacheError) {
            console.warn('AsyncStorage role fallback failed:', cacheError?.message || cacheError);
          }

          // Server token verification is failing; fall back to Firestore so onboarding still works.
          try {
            if (!db) throw new Error('Firestore db not initialized');
            const uid = firebaseUser?.uid;
            if (!uid) throw new Error('Missing uid for Firestore fallback');

            // Firestore sometimes briefly reports "client is offline" in Expo Go.
            // Retry once to avoid unnecessarily dropping into role selection.
            let snap = null;
            let data = null;
            for (let attempt = 0; attempt < 2; attempt++) {
              snap = await getDoc(doc(db, 'users', uid));
              data = snap.exists() ? snap.data() : null;
              break;
            }
            const profile = { uid, ...(data || {}) };

            try {
              await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(profile));
            } catch (_) {
              // Non-blocking cache write
            }

            setUserData(profile);
            setUserRole(profile?.role || null);
            setShowOnboarding(profileNeedsOnboarding(profile));
          } catch (fallbackError) {
            console.error('Firestore fallback for /api/me role failed:', {
              message: fallbackError?.message,
              code: fallbackError?.code,
            });

            // If everything is down, preserve app flow instead of forcing role selection.
            // Default to client flow unless/until a real role is fetched.
            const uid = firebaseUser?.uid || null;
            setUserData((prev) => prev || (uid ? { uid, role: 'client', onboardingCompleted: true } : null));
            setUserRole((prev) => prev || 'client');
            setShowOnboarding(false);
          }
        }
      } else {
        setUserRole(null);
        setShowOnboarding(false);
      }
      
      setAuthLoading(false);
      setOnboardingChecked(true);
      
      // If user signs out, reset app state
      if (!firebaseUser) {
        setShowOnboarding(false);
        setOnboardingChecked(false);
        setUserRole(null);
        setUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Show auth screens if user is not logged in
  if (!user) {
    if (showForgotPassword) {
      return (
        <ForgotPasswordScreen
          navigation={{
            navigate: () => setShowForgotPassword(false),
            goBack: () => setShowForgotPassword(false),
          }}
        />
      );
    }
    return (
      <AuthScreen
        onSignupSuccess={(userData, role) => {
          setUser(userData);
          const r = normalizeAppRole(role);
          setUserRole(r);
          setShowOnboarding(true); // New users always go to onboarding
          if (userData?.uid) {
            AsyncStorage.setItem(
              getProfileCacheKey(userData.uid),
              JSON.stringify({ uid: userData.uid, role: r, onboardingCompleted: false })
            ).catch(() => {});
          }
        }}
        onLoginSuccess={async (userData) => {
          setUser(userData);
          if (!userData?.uid || !db) return;
          try {
            const snap = await getDoc(doc(db, 'users', userData.uid));
            if (!snap.exists()) {
              const likelyNew = isLikelyNewFirebaseUser(userData);
              if (likelyNew) {
                setUserRole('client');
                setShowOnboarding(true);
                setOnboardingChecked(true);
              }
              return;
            }
            const profile = { uid: userData.uid, ...(snap.data() || {}) };
            if (profile.role) {
              setUserData(profile);
              setUserRole(profile.role);
              setShowOnboarding(profileNeedsOnboarding(profile));
              setOnboardingChecked(true);
            }
          } catch (_) {
            /* onAuthStateChanged will reconcile */
          }
        }}
        onForgotPasswordPress={() => setShowForgotPassword(true)}
      />
    );
  }

  // For logged-in users, wait for onboarding check and key loading — show app loading screen
  if (!keyLoaded || !onboardingChecked) {
    return <AppLoadingScreen message="Loading your data..." isDark />;
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <OnboardingScreen
        role={normalizeAppRole(userRole)}
        onComplete={(chosenRole, updateData) => {
          if (chosenRole) setUserRole(normalizeAppRole(chosenRole));
          if (updateData) setUserData(updateData);
          if (user?.uid && chosenRole) {
            const r = normalizeAppRole(chosenRole);
            AsyncStorage.setItem(
              getProfileCacheKey(user.uid),
              JSON.stringify({
                uid: user.uid,
                ...(updateData || {}),
                role: r,
                onboardingCompleted: true,
              })
            ).catch(() => {});
          }
          setShowOnboarding(false);
        }}
      />
    );
  }

  // User is authenticated - route to appropriate app based on role
  if (normalizeAppRole(userRole) === 'trainer') {
    return <TrainerApp user={user} />;
  }

  // Refetch user data (e.g. after trainerId reconciliation in ClientApp)
  const refetchUserData = async () => {
    try {
      if (!user?.uid) return;

      const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
      const fallbackBaseUrls = [
        'http://localhost:4002',
        'http://127.0.0.1:4002',
        'http://localhost:4001',
        'http://127.0.0.1:4001',
      ];
      const baseUrls = apiBaseUrl ? [apiBaseUrl, ...fallbackBaseUrls] : fallbackBaseUrls;

      await user.reload();
      const idToken = await user.getIdToken(true);

      let payload = null;
      for (const baseUrl of baseUrls) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);
      try {
        const resp = await fetch(`${baseUrl}/api/me`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${idToken}`, Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!resp.ok) throw new Error(`/api/me failed (${resp.status})`);
        const json = await resp.json();
        payload = json?.user || json || null;
        break;
      } finally {
        clearTimeout(timeoutId);
      }
      }

      if (payload) setUserData(payload);
    } catch (e) {
      console.error('refetchUserData:', e);
    }
  };

  // Default to client app (includes unknown / missing role — same as Firestore bootstrap fallback)
  const clientPayload =
    userData && typeof userData === 'object'
      ? { ...userData, role: normalizeAppRole(userData.role ?? userRole) }
      : { uid: user?.uid, role: 'client' };
  return <ClientApp user={user} userData={clientPayload} onRefetchUserData={refetchUserData} />;
}
