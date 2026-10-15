// The traffic cop between "app just launched" and "user is looking at their app".
// Flow: listen to Firebase auth → no user? show login/reset → user? load profile
//       (Firestore → retry → phone cache → safe default) → wizard or Trainer/Client shell.
// Used once at the top of the tree. Everything else mounts under whatever this picks.

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { ProPlanSetup } from '../trainer-pro-plan/ProPlanSetup';
import { useStartupLoadingCoverLock } from '../for-both/loading-and-header/StartupLoadingCover';
import { auth, db } from './cloudConnection';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeErrorSync } from '../crash-reports/sendSavedErrors';
import { clearOldSharedChats } from '../ai-coach/past-chats/savedChatShape';
import { clearAllUserData } from '../logout-cleanup/clearDataOnLogout';
import { flushPendingOnboardingSync } from '../for-both/online-connection/uploadSetupAnswers';
import { clearPushTokensForUid } from '../notifications/manageAlerts';
import { loadMyProfile } from '../for-both/cloud-database/loadMyProfile';
import {
  getProfileCacheKey,
  isLikelyNewFirebaseUser,
  normalizeAppRole,
  profileNeedsOnboarding,
} from '../login-and-signup/decideTraineeOrTrainer';
import { handleAuthUidTransition } from '../login-and-signup/signOutCleanupSteps';
import { fillTraineeProfile } from '../helpers/fillTraineeProfile';

// vocab: React.lazy = do not load this file until something actually renders it.
const LoginScreen = React.lazy(() => import('../login-and-signup/LoginScreen'));
const ResetPasswordScreen = React.lazy(() => import('../login-and-signup/ForgotPasswordFlow'));
const NewUserSetupScreen = React.lazy(() => import('../login-and-signup/NewUserSetupScreen'));
const TrainerAppStart = React.lazy(() => import('./TrainerAppStart'));
const ClientAppStart = React.lazy(() => import('./ClientAppStart'));

// ===== NAMED CONSTANTS =====

const USERS_COLLECTION = 'users';
const ONBOARDING_DATA_PREFIX = 'onboarding_data_';
const DEFAULT_ROLE_CLIENT = 'client';
const ROLE_TRAINER = 'trainer';
// Manipulate here: how long a user stares at the boot overlay before we skip Firestore.
const FIRESTORE_PROFILE_TIMEOUT_MS = 7000;
// Manipulate here: must match the boot overlay or you will see a color flicker.
const BOOT_BACKGROUND = '#0A0A0A';
const FIRESTORE_TIMEOUT_MESSAGE = 'Firestore profile timeout';

// ===== HELPER FUNCTIONS =====

function bootBlankScreen() {
  return <View style={{ flex: 1, backgroundColor: BOOT_BACKGROUND }} />;
}

function AuthBootFallback() {
  useStartupLoadingCoverLock(true);
  return bootBlankScreen();
}

// vocab: Suspense = show fallback until the lazy child is ready.
function AuthScreenSuspense({ children }) {
  return (
    <Suspense fallback={<AuthBootFallback />}>
      <View style={{ flex: 1 }}>{children}</View>
    </Suspense>
  );
}

export { normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser };
export { handleAuthUidTransition } from '../login-and-signup/signOutCleanupSteps';

function parseCachedObject(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object') return parsed;
    return null;
  } catch (error) {
    return null;
  }
}

async function readJsonFromStorage(storageKey) {
  try {
    const rawText = await AsyncStorage.getItem(storageKey);
    if (!rawText) return null;
    return parseCachedObject(rawText);
  } catch (error) {
    return null;
  }
}

async function readFirstCachedProfile(uid) {
  const storageKeys = [`${ONBOARDING_DATA_PREFIX}${uid}`, getProfileCacheKey(uid)];
  for (const storageKey of storageKeys) {
    const parsed = await readJsonFromStorage(storageKey);
    if (parsed) return parsed;
  }
  return null;
}

/**
 * Trust the phone when the wizard finished offline and Firestore is behind.
 * Keys: onboarding_data_{uid} then auth_profile_{uid}.
 * @param {string} uid
 * @param {object} firestoreProfile
 * @returns {Promise<object>}
 */
async function mergeLocalOnboardingTruth(uid, firestoreProfile) {
  if (!uid || !firestoreProfile || typeof firestoreProfile !== 'object') {
    return firestoreProfile;
  }
  const cachedProfile = await readFirstCachedProfile(uid);
  if (!cachedProfile) return firestoreProfile;
  return fillTraineeProfile(cachedProfile, firestoreProfile);
}

function applyResolvedProfile(setters, profile) {
  setters.setUserData(profile);
  setters.setUserRole(profile.role);
  setters.setShowOnboarding(profileNeedsOnboarding(profile));
  setters.setAuthLoading(false);
  setters.setOnboardingChecked(true);
}

async function cacheProfileOnPhone(uid, profile) {
  try {
    await AsyncStorage.setItem(getProfileCacheKey(uid), JSON.stringify(profile));
  } catch (error) {
    /* a cache miss only costs the next cold start */
  }
}

async function fetchUserDoc(uid) {
  const profileRef = doc(db, USERS_COLLECTION, uid);
  return getDoc(profileRef);
}

function profileFromSnapshot(uid, snapshot) {
  if (!snapshot?.exists?.()) return null;
  const profile = { uid, ...(snapshot.data() || {}) };
  if (!profile.role) return null;
  return profile;
}

async function tryFirestoreProfileWithTimeout(uid, setters) {
  if (!db || !uid) return false;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(FIRESTORE_TIMEOUT_MESSAGE)), FIRESTORE_PROFILE_TIMEOUT_MS);
    });
    const profileSnap = await Promise.race([fetchUserDoc(uid), timeoutPromise]);
    const profile = profileFromSnapshot(uid, profileSnap);
    if (!profile) return false;
    const merged = await mergeLocalOnboardingTruth(uid, profile);
    applyResolvedProfile(setters, merged);
    await cacheProfileOnPhone(uid, merged);
    return true;
  } catch (firestoreBootstrapError) {
    console.warn('Firestore-first auth bootstrap failed:', firestoreBootstrapError?.message || firestoreBootstrapError);
    return false;
  }
}

async function tryFirestoreProfileRetry(uid, setters) {
  if (!db || !uid) return false;
  try {
    const retrySnap = await fetchUserDoc(uid);
    const profile = profileFromSnapshot(uid, retrySnap);
    if (!profile) return false;
    const merged = await mergeLocalOnboardingTruth(uid, profile);
    applyResolvedProfile(setters, merged);
    await cacheProfileOnPhone(uid, merged);
    return true;
  } catch (retryError) {
    console.warn('Firestore retry bootstrap failed:', retryError?.message || retryError);
    return false;
  }
}

function profileFromCachedRaw(uid, cachedRaw) {
  if (!cachedRaw) return null;
  const cached = JSON.parse(cachedRaw);
  const cachedRole = cached?.role || null;
  if (!cachedRole) return null;
  return { uid, ...(cached || {}) };
}

async function applyFirstCachedProfile(uid, setters) {
  const candidates = [
    await AsyncStorage.getItem(getProfileCacheKey(uid)),
    await AsyncStorage.getItem(`${ONBOARDING_DATA_PREFIX}${uid}`),
  ];
  for (const cachedRaw of candidates) {
    const profile = profileFromCachedRaw(uid, cachedRaw);
    if (!profile) continue;
    applyResolvedProfile(setters, profile);
    return true;
  }
  return false;
}

async function tryCachedProfile(uid, setters) {
  if (!uid) return false;
  try {
    return await applyFirstCachedProfile(uid, setters);
  } catch (cacheError) {
    console.warn('AsyncStorage bootstrap fallback failed:', cacheError?.message || cacheError);
    return false;
  }
}

function applySafeDefaultProfile(firebaseUser, setters) {
  const uid = firebaseUser?.uid || null;
  const likelyNew = isLikelyNewFirebaseUser(firebaseUser);
  setters.setUserData(
    uid
      ? { uid, role: DEFAULT_ROLE_CLIENT, onboardingCompleted: likelyNew ? false : true }
      : null,
  );
  setters.setUserRole(DEFAULT_ROLE_CLIENT);
  setters.setShowOnboarding(likelyNew);
  setters.setAuthLoading(false);
  setters.setOnboardingChecked(true);
}

async function bootstrapSignedInProfile(firebaseUser, setters) {
  flushPendingOnboardingSync(firebaseUser).catch(() => {});
  const uid = firebaseUser?.uid;
  const loadedWithTimeout = await tryFirestoreProfileWithTimeout(uid, setters);
  if (loadedWithTimeout) return;
  const loadedOnRetry = await tryFirestoreProfileRetry(uid, setters);
  if (loadedOnRetry) return;
  const loadedFromCache = await tryCachedProfile(uid, setters);
  if (loadedFromCache) return;
  applySafeDefaultProfile(firebaseUser, setters);
}

function clearSignedOutSession(setters) {
  setters.setUserRole(null);
  setters.setShowOnboarding(false);
  setters.setAuthLoading(false);
  setters.setOnboardingChecked(false);
  setters.setUserData(null);
}

async function handleFirebaseUser(firebaseUser, prevUidRef, setters) {
  const previousUid = prevUidRef.current;
  await handleAuthUidTransition(previousUid, firebaseUser, {
    clearPushTokensForUid,
    clearAllUserData,
  });
  prevUidRef.current = firebaseUser?.uid || null;

  if (firebaseUser) {
    try {
      await clearOldSharedChats();
    } catch (error) {
      /* migration is optional */
    }
  }

  setters.setUser(firebaseUser);
  if (firebaseUser) {
    await bootstrapSignedInProfile(firebaseUser, setters);
    return;
  }
  clearSignedOutSession(setters);
}

function listenForAuthChanges(prevUidRef, setters) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    await handleFirebaseUser(firebaseUser, prevUidRef, setters);
  });
}

function rememberSignupOnPhone(signedUpUser, role, setters) {
  setters.setUser(signedUpUser);
  const appRole = normalizeAppRole(role);
  setters.setUserRole(appRole);
  setters.setShowOnboarding(true);
  if (!signedUpUser?.uid) return;
  AsyncStorage.setItem(
    getProfileCacheKey(signedUpUser.uid),
    JSON.stringify({ uid: signedUpUser.uid, role: appRole, onboardingCompleted: false }),
  ).catch(() => {});
}

function applyMissingProfileOnLogin(signedInUser, setters) {
  if (!isLikelyNewFirebaseUser(signedInUser)) return;
  setters.setUserRole(DEFAULT_ROLE_CLIENT);
  setters.setShowOnboarding(true);
  setters.setOnboardingChecked(true);
}

function applyExistingProfileOnLogin(signedInUser, snap, setters) {
  const profile = { uid: signedInUser.uid, ...(snap.data() || {}) };
  if (!profile.role) return;
  setters.setUserData(profile);
  setters.setUserRole(profile.role);
  setters.setShowOnboarding(profileNeedsOnboarding(profile));
  setters.setOnboardingChecked(true);
}

async function applyLoginSnapshot(signedInUser, setters) {
  const snap = await getDoc(doc(db, USERS_COLLECTION, signedInUser.uid));
  if (!snap.exists()) {
    applyMissingProfileOnLogin(signedInUser, setters);
    return;
  }
  applyExistingProfileOnLogin(signedInUser, snap, setters);
}

function applyLoginSuccess(signedInUser, setters) {
  setters.setUser(signedInUser);
  if (!signedInUser?.uid || !db) return;
  applyLoginSnapshot(signedInUser, setters).catch(() => {
    /* onAuthStateChanged still reconciles */
  });
}

function rememberFinishedWizard(user, chosenRole, updateData, setters) {
  if (chosenRole) setters.setUserRole(normalizeAppRole(chosenRole));
  if (updateData) setters.setUserData(updateData);
  if (user?.uid && chosenRole) {
    const appRole = normalizeAppRole(chosenRole);
    AsyncStorage.setItem(
      getProfileCacheKey(user.uid),
      JSON.stringify({
        uid: user.uid,
        ...(updateData || {}),
        role: appRole,
        onboardingCompleted: true,
      }),
    ).catch(() => {});
  }
  setters.setShowOnboarding(false);
}

async function refreshSignedInProfile(user, setUserData) {
  try {
    if (!user?.uid) return;
    const payload = await loadMyProfile(user);
    if (payload) setUserData(payload);
  } catch (error) {
    console.error('refetchUserData:', error);
  }
}

function SignedOutScreens({
  authLoading,
  showForgotPasswordFlow,
  forgotPasswordEmail,
  onCloseForgotPassword,
  onSignupSuccess,
  onLoginSuccess,
  onForgotPasswordFlowPress,
}) {
  if (authLoading) return bootBlankScreen();
  if (showForgotPasswordFlow) {
    return (
      <AuthScreenSuspense>
        <ResetPasswordScreen
          initialEmail={forgotPasswordEmail}
          navigation={{
            navigate: onCloseForgotPassword,
            goBack: onCloseForgotPassword,
          }}
        />
      </AuthScreenSuspense>
    );
  }
  return (
    <AuthScreenSuspense>
      <LoginScreen
        onSignupSuccess={onSignupSuccess}
        onLoginSuccess={onLoginSuccess}
        onForgotPasswordFlowPress={onForgotPasswordFlowPress}
      />
    </AuthScreenSuspense>
  );
}

function SignedInScreens({
  user,
  userRole,
  userData,
  showOnboarding,
  onOnboardingComplete,
  onRefetchUserData,
}) {
  if (showOnboarding) {
    return (
      <ProPlanSetup userId={user?.uid || null}>
        <AuthScreenSuspense>
          <NewUserSetupScreen
            role={normalizeAppRole(userRole)}
            onComplete={onOnboardingComplete}
          />
        </AuthScreenSuspense>
      </ProPlanSetup>
    );
  }
  if (normalizeAppRole(userRole) === ROLE_TRAINER) {
    return (
      <AuthScreenSuspense>
        <TrainerAppStart user={user} />
      </AuthScreenSuspense>
    );
  }
  const clientPayload =
    userData && typeof userData === 'object'
      ? { ...userData, role: normalizeAppRole(userData.role ?? userRole) }
      : { uid: user?.uid, role: DEFAULT_ROLE_CLIENT };
  return (
    <AuthScreenSuspense>
      <ClientAppStart user={user} userData={clientPayload} onRefetchUserData={onRefetchUserData} />
    </AuthScreenSuspense>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Pick login, the setup wizard, or the trainer/client shell.
 * Hooks stay in this order: nine state boxes, prev uid, boot lock, error sync, auth listener.
 */
export default function LoginGate() {
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

  const bootLocked = (!user && authLoading) || (!!user && (!keyLoaded || !onboardingChecked));
  useStartupLoadingCoverLock(bootLocked);

  useEffect(() => {
    (async () => {
      try {
        await initializeErrorSync();
      } catch (error) {
        console.error('Failed to load API key:', error);
      } finally {
        setKeyLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const setters = {
      setUser,
      setUserData,
      setUserRole,
      setShowOnboarding,
      setAuthLoading,
      setOnboardingChecked,
    };
    return listenForAuthChanges(prevUidRef, setters);
  }, []);

  const closeForgotPassword = () => {
    setShowForgotPasswordFlow(false);
    setForgotPasswordFlowEmail('');
  };

  const handleSignupSuccess = (signedUpUser, role) => {
    rememberSignupOnPhone(signedUpUser, role, {
      setUser,
      setUserRole,
      setShowOnboarding,
    });
  };

  const handleLoginSuccess = (signedInUser) => {
    applyLoginSuccess(signedInUser, {
      setUser,
      setUserData,
      setUserRole,
      setShowOnboarding,
      setOnboardingChecked,
    });
  };

  const handleOnboardingComplete = (chosenRole, updateData) => {
    rememberFinishedWizard(user, chosenRole, updateData, {
      setUserRole,
      setUserData,
      setShowOnboarding,
    });
  };

  const refetchUserData = () => {
    refreshSignedInProfile(user, setUserData);
  };

  // 1. Signed out → login or reset password.
  if (!user) {
    return (
      <SignedOutScreens
        authLoading={authLoading}
        showForgotPasswordFlow={showForgotPasswordFlow}
        forgotPasswordEmail={forgotPasswordEmail}
        onCloseForgotPassword={closeForgotPassword}
        onSignupSuccess={handleSignupSuccess}
        onLoginSuccess={handleLoginSuccess}
        onForgotPasswordFlowPress={(prefillEmail) => {
          setForgotPasswordFlowEmail(String(prefillEmail || '').trim());
          setShowForgotPasswordFlow(true);
        }}
      />
    );
  }

  // 2. Signed in but we do not yet know the role or the wizard.
  if (!keyLoaded || !onboardingChecked) {
    return bootBlankScreen();
  }

  // 3. Wizard, trainer shell, or client shell.
  return (
    <SignedInScreens
      user={user}
      userRole={userRole}
      userData={userData}
      showOnboarding={showOnboarding}
      onOnboardingComplete={handleOnboardingComplete}
      onRefetchUserData={refetchUserData}
    />
  );
}
