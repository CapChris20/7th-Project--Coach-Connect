/**
 * Auth Gate
 *
 * Purpose: Auth Gate — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/app
 * Key exports: AuthGate
 *
 * @file-header
 */
/**
 * AuthGate - Handles authentication state and routes to appropriate app
 * 
 * Responsibilities:
 * - Shows splash screen initially
 * - Handles auth flow (login, signup, forgot password)
 * - Checks onboarding status
 * - Routes authenticated users to TrainerApp or ClientApp based on role
 */

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SubscriptionProvider } from '../subscription/SubscriptionProvider';
import AppLoadingScreen from '../shared/components/shell/AppLoadingScreen';
import { auth, db } from './config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeErrorSync } from '../utils/syncErrorsToServer';
import { clearOldSharedChats } from '../ai-coach/server-logic/chat-api/chatStorageService';
import { clearAllUserData } from '../utils/clearDataOnLogout';
import { flushPendingOnboardingSync } from '../shared/api/syncOnboardingToServer';
import { clearPushTokensForUid } from '../notifications/manageNotifications';
import { fetchUserProfile } from '../shared/services/fetchUserProfile';
import {
  getProfileCacheKey,
  isLikelyNewFirebaseUser,
  normalizeAppRole,
  profileNeedsOnboarding,
} from '../auth/detectUserRole';
import { handleAuthUidTransition } from '../auth/authSessionTransition';
import { resolveClientProfileFields } from '../shared-utils/resolveClientProfileFields';

/** Lazy-loaded shells — avoids pulling heavy native modules (Reanimated, Lottie, OAuth, etc.) at cold start. */
const LoginScreen = React.lazy(() => import('../auth/LoginScreen'));
const ResetPasswordScreen = React.lazy(() => import('../auth/ResetPasswordScreen'));
const OnboardingWizardScreen = React.lazy(() => import('../auth/OnboardingWizardScreen'));
const TrainerApp = React.lazy(() => import('./TrainerApp'));
const ClientApp = React.lazy(() => import('./ClientApp'));

function AuthScreenSuspense({ children }) {
  return (
    <Suspense fallback={<AppLoadingScreen isDark />}>
      <View style={{ flex: 1 }}>{children}</View>
    </Suspense>
  );
}

export { normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser };
export { handleAuthUidTransition } from '../auth/authSessionTransition';

/**
 * Firestore can lag behind local completion (API/offline). Prefer AsyncStorage if it proves onboarding finished.
 * Keys: `onboarding_data_${uid}` (full payload from OnboardingWizardScreen) and `auth_profile_${uid}` (AuthGate cache).
 */
async function mergeLocalOnboardingTruth(uid, firestoreProfile) {
  if (!uid || !firestoreProfile || typeof firestoreProfile !== 'object') {
    return firestoreProfile;
  }
  let cached = null;
  try {
    const keys = [`onboarding_data_${uid}`, getProfileCacheKey(uid)];
    for (const key of keys) {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          cached = parsed;
          break;
        }
      } catch {
        continue;
      }
    }
  } catch (_) {
    /* ignore */
  }
  if (!cached) return firestoreProfile;
  return resolveClientProfileFields(cached, firestoreProfile);
}

export default function AuthGate() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showForgotPasswordFlow, setShowForgotPasswordFlow] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordFlowEmail] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userData, setUserData] = useState(null);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const prevUidRef = useRef(null);

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
      const prevUid = prevUidRef.current;

      await handleAuthUidTransition(prevUid, firebaseUser, {
        clearPushTokensForUid,
        clearAllUserData,
      });

      if (firebaseUser?.uid) {
        prevUidRef.current = firebaseUser.uid;
      } else {
        prevUidRef.current = null;
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
    if (authLoading) {
      return <AppLoadingScreen isDark />;
    }
    if (showForgotPasswordFlow) {
      return (
        <AuthScreenSuspense>
          <ResetPasswordScreen
          initialEmail={forgotPasswordEmail}
          navigation={{
            navigate: () => {
              setShowForgotPasswordFlow(false);
              setForgotPasswordFlowEmail('');
            },
            goBack: () => {
              setShowForgotPasswordFlow(false);
              setForgotPasswordFlowEmail('');
            },
          }}
        />
        </AuthScreenSuspense>
      );
    }
    return (
      <AuthScreenSuspense>
        <LoginScreen
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
        onForgotPasswordFlowPress={(prefillEmail) => {
          setForgotPasswordFlowEmail(String(prefillEmail || '').trim());
          setShowForgotPasswordFlow(true);
        }}
      />
      </AuthScreenSuspense>
    );
  }

  // For logged-in users, wait for onboarding check and key loading — show app loading screen
  if (!keyLoaded || !onboardingChecked) {
    return <AppLoadingScreen isDark />;
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <SubscriptionProvider userId={user?.uid || null}>
        <AuthScreenSuspense>
          <OnboardingWizardScreen
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
        </AuthScreenSuspense>
      </SubscriptionProvider>
    );
  }

  // User is authenticated - route to appropriate app based on role
  if (normalizeAppRole(userRole) === 'trainer') {
    return (
      <AuthScreenSuspense>
        <TrainerApp user={user} />
      </AuthScreenSuspense>
    );
  }

  // Refetch user data (e.g. after trainerId reconciliation in ClientApp)
  const refetchUserData = async () => {
    try {
      if (!user?.uid) return;
      const payload = await fetchUserProfile(user);
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
  return (
    <AuthScreenSuspense>
      <ClientApp user={user} userData={clientPayload} onRefetchUserData={refetchUserData} />
    </AuthScreenSuspense>
  );
}
