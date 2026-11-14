// The traffic cop between "app just launched" and "user is looking at their app".
// Flow: listen to Firebase auth → no user? show login/reset → user? load profile
//       (Firestore → retry → phone cache → safe default) → wizard or Trainer/Client shell.
// Used once at the top of the tree. Everything else mounts under whatever this picks.
// Read order: constants → screen pieces → LoginGate recipe → PLUMBING for profile load.

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

// Re-exported helpers other files still import from LoginGate.
export { normalizeAppRole, profileNeedsOnboarding, isLikelyNewFirebaseUser };
export { handleAuthUidTransition } from '../login-and-signup/signOutCleanupSteps';

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

function uidFromUser(user) {
  if (!user) {
    return null;
  }
  if (!user.uid) {
    return null;
  }
  return user.uid;
}

function buildClientShellPayload(user, userData, userRole) {
  const userDataIsObject = userData && typeof userData === 'object';
  if (userDataIsObject) {
    let roleFromUserData = userRole;
    if (userData.role != null) {
      roleFromUserData = userData.role;
    }
    return { ...userData, role: normalizeAppRole(roleFromUserData) };
  }
  return { uid: uidFromUser(user), role: DEFAULT_ROLE_CLIENT };
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
  if (authLoading) {
    return bootBlankScreen();
  }

  if (showForgotPasswordFlow) {
    const forgotPasswordNavigation = {
      navigate: onCloseForgotPassword,
      goBack: onCloseForgotPassword,
    };
    return (
      <AuthScreenSuspense>
        <ResetPasswordScreen
          initialEmail={forgotPasswordEmail}
          navigation={forgotPasswordNavigation}
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
  const signedInUid = uidFromUser(user);

  if (showOnboarding) {
    const normalizedRole = normalizeAppRole(userRole);
    return (
      <ProPlanSetup userId={signedInUid}>
        <AuthScreenSuspense>
          <NewUserSetupScreen
            role={normalizedRole}
            onComplete={onOnboardingComplete}
          />
        </AuthScreenSuspense>
      </ProPlanSetup>
    );
  }

  const isTrainerRole = normalizeAppRole(userRole) === ROLE_TRAINER;
  if (isTrainerRole) {
    return (
      <AuthScreenSuspense>
        <TrainerAppStart user={user} />
      </AuthScreenSuspense>
    );
  }

  const clientPayload = buildClientShellPayload(user, userData, userRole);
  return (
    <AuthScreenSuspense>
      <ClientAppStart
        user={user}
        userData={clientPayload}
        onRefetchUserData={onRefetchUserData}
      />
    </AuthScreenSuspense>
  );
}

function buildAuthSetters(setters) {
  return {
    setUser: setters.setUser,
    setUserData: setters.setUserData,
    setUserRole: setters.setUserRole,
    setShowOnboarding: setters.setShowOnboarding,
    setAuthLoading: setters.setAuthLoading,
    setOnboardingChecked: setters.setOnboardingChecked,
  };
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

  // Keep the boot poster up until we know signed-out vs signed-in role/wizard.
  const waitingOnSignedOutAuth = !user && authLoading;
  const waitingOnSignedInBootstrap = !!user && (!keyLoaded || !onboardingChecked);
  const bootLocked = waitingOnSignedOutAuth || waitingOnSignedInBootstrap;
  useStartupLoadingCoverLock(bootLocked);

  // Crash-report sync / API key warm-up — must finish before we trust keyLoaded.
  useEffect(() => {
    warmUpErrorSyncThenMarkKeyLoaded(setKeyLoaded);
  }, []);

  // vocab: onAuthStateChanged = Firebase fires whenever sign-in / sign-out changes.
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }
    const setters = buildAuthSetters({
      setUser,
      setUserData,
      setUserRole,
      setShowOnboarding,
      setAuthLoading,
      setOnboardingChecked,
    });
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

  const openForgotPasswordFlow = (prefillEmail) => {
    setForgotPasswordFlowEmail(String(prefillEmail || '').trim());
    setShowForgotPasswordFlow(true);
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
        onForgotPasswordFlowPress={openForgotPasswordFlow}
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

// ===== PLUMBING — skip unless debugging =====

function warmUpErrorSyncThenMarkKeyLoaded(setKeyLoaded) {
  (async () => {
    try {
      await initializeErrorSync();
    } catch (error) {
      console.error('Failed to load API key:', error);
    } finally {
      setKeyLoaded(true);
    }
  })();
}

function parseCachedObject(rawText) {
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function readJsonFromStorage(storageKey) {
  try {
    const rawText = await AsyncStorage.getItem(storageKey);
    if (!rawText) {
      return null;
    }
    return parseCachedObject(rawText);
  } catch (error) {
    return null;
  }
}

async function readFirstCachedProfile(uid) {
  const storageKeys = [`${ONBOARDING_DATA_PREFIX}${uid}`, getProfileCacheKey(uid)];
  for (let keyIndex = 0; keyIndex < storageKeys.length; keyIndex += 1) {
    const storageKey = storageKeys[keyIndex];
    const parsed = await readJsonFromStorage(storageKey);
    if (parsed) {
      return parsed;
    }
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
  if (!cachedProfile) {
    return firestoreProfile;
  }
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

function snapshotExists(snapshot) {
  if (!snapshot) {
    return false;
  }
  if (typeof snapshot.exists !== 'function') {
    return false;
  }
  return snapshot.exists();
}

function profileFromSnapshot(uid, snapshot) {
  if (!snapshotExists(snapshot)) {
    return null;
  }
  const profile = { uid, ...(snapshot.data() || {}) };
  if (!profile.role) {
    return null;
  }
  return profile;
}

function promiseFirestoreTimedOut() {
  return new Promise((unusedResolve, reject) => {
    void unusedResolve;
    setTimeout(() => reject(new Error(FIRESTORE_TIMEOUT_MESSAGE)), FIRESTORE_PROFILE_TIMEOUT_MS);
  });
}

function errorMessageOrValue(errorValue) {
  if (errorValue && errorValue.message) {
    return errorValue.message;
  }
  return errorValue;
}

/**
 * One Firestore read, optionally raced with a timeout on the first attempt only.
 * @returns {Promise<object|null>} merged profile ready for setters, or null
 */
async function loadProfileFromFirestoreOnce(uid, useTimeout) {
  if (!db || !uid) {
    return null;
  }

  try {
    let snapshot;
    if (useTimeout) {
      // vocab: Promise.race = first of the two to settle wins (doc or timeout).
      snapshot = await Promise.race([fetchUserDoc(uid), promiseFirestoreTimedOut()]);
    } else {
      snapshot = await fetchUserDoc(uid);
    }
    const profile = profileFromSnapshot(uid, snapshot);
    if (!profile) {
      return null;
    }
    return await mergeLocalOnboardingTruth(uid, profile);
  } catch (firestoreError) {
    const label = useTimeout
      ? 'Firestore-first auth bootstrap failed'
      : 'Firestore retry bootstrap failed';
    console.warn(`${label}:`, errorMessageOrValue(firestoreError));
    return null;
  }
}

async function resolveFirestoreProfile(uid, setters) {
  const firstTry = await loadProfileFromFirestoreOnce(uid, true);
  if (firstTry) {
    applyResolvedProfile(setters, firstTry);
    await cacheProfileOnPhone(uid, firstTry);
    return true;
  }

  const secondTry = await loadProfileFromFirestoreOnce(uid, false);
  if (secondTry) {
    applyResolvedProfile(setters, secondTry);
    await cacheProfileOnPhone(uid, secondTry);
    return true;
  }

  return false;
}

function profileFromCachedRaw(uid, cachedRaw) {
  if (!cachedRaw) {
    return null;
  }
  try {
    const cached = JSON.parse(cachedRaw);
    let cachedRole = null;
    if (cached && cached.role) {
      cachedRole = cached.role;
    }
    if (!cachedRole) {
      return null;
    }
    return { uid, ...(cached || {}) };
  } catch (error) {
    return null;
  }
}

async function firstProfileFromStorageKeys(uid, cacheKeys) {
  for (let keyIndex = 0; keyIndex < cacheKeys.length; keyIndex += 1) {
    const storageKey = cacheKeys[keyIndex];
    const raw = await AsyncStorage.getItem(storageKey);
    const profile = profileFromCachedRaw(uid, raw);
    if (profile) {
      return profile;
    }
  }
  return null;
}

async function tryCachedProfile(uid, setters) {
  if (!uid) {
    return false;
  }
  const cacheKeys = [getProfileCacheKey(uid), `${ONBOARDING_DATA_PREFIX}${uid}`];
  try {
    const profile = await firstProfileFromStorageKeys(uid, cacheKeys);
    if (!profile) {
      return false;
    }
    applyResolvedProfile(setters, profile);
    return true;
  } catch (cacheError) {
    console.warn('AsyncStorage bootstrap fallback failed:', errorMessageOrValue(cacheError));
    return false;
  }
}

function applySafeDefaultProfile(firebaseUser, setters) {
  const uid = uidFromUser(firebaseUser);
  const likelyNew = isLikelyNewFirebaseUser(firebaseUser);
  if (uid) {
    setters.setUserData({
      uid,
      role: DEFAULT_ROLE_CLIENT,
      onboardingCompleted: likelyNew ? false : true,
    });
  } else {
    setters.setUserData(null);
  }
  setters.setUserRole(DEFAULT_ROLE_CLIENT);
  setters.setShowOnboarding(likelyNew);
  setters.setAuthLoading(false);
  setters.setOnboardingChecked(true);
}

async function bootstrapSignedInProfile(firebaseUser, setters) {
  // 1. Flush any onboarding answers queued while offline.
  flushPendingOnboardingSync(firebaseUser).catch(() => {});

  const uid = uidFromUser(firebaseUser);

  // 2. Firestore (timed, then plain retry).
  const loadedFromFirestore = await resolveFirestoreProfile(uid, setters);
  if (loadedFromFirestore) {
    return;
  }

  // 3. Phone cache.
  const loadedFromCache = await tryCachedProfile(uid, setters);
  if (loadedFromCache) {
    return;
  }

  // 4. Safe default so the shell can still mount.
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
  prevUidRef.current = uidFromUser(firebaseUser);

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
  const signedUpUid = uidFromUser(signedUpUser);
  if (!signedUpUid) {
    return;
  }
  AsyncStorage.setItem(
    getProfileCacheKey(signedUpUid),
    JSON.stringify({ uid: signedUpUid, role: appRole, onboardingCompleted: false }),
  ).catch(() => {});
}

function applyMissingProfileOnLogin(signedInUser, setters) {
  if (!isLikelyNewFirebaseUser(signedInUser)) {
    return;
  }
  setters.setUserRole(DEFAULT_ROLE_CLIENT);
  setters.setShowOnboarding(true);
  setters.setOnboardingChecked(true);
}

function applyExistingProfileOnLogin(signedInUser, snap, setters) {
  const profile = { uid: signedInUser.uid, ...(snap.data() || {}) };
  if (!profile.role) {
    return;
  }
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
  const signedInUid = uidFromUser(signedInUser);
  if (!signedInUid || !db) {
    return;
  }
  applyLoginSnapshot(signedInUser, setters).catch(() => {
    /* onAuthStateChanged still reconciles */
  });
}

function rememberFinishedWizard(user, chosenRole, updateData, setters) {
  if (chosenRole) {
    setters.setUserRole(normalizeAppRole(chosenRole));
  }
  if (updateData) {
    setters.setUserData(updateData);
  }
  const wizardUid = uidFromUser(user);
  if (wizardUid && chosenRole) {
    const appRole = normalizeAppRole(chosenRole);
    AsyncStorage.setItem(
      getProfileCacheKey(wizardUid),
      JSON.stringify({
        uid: wizardUid,
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
    const signedInUid = uidFromUser(user);
    if (!signedInUid) {
      return;
    }
    const payload = await loadMyProfile(user);
    if (payload) {
      setUserData(payload);
    }
  } catch (error) {
    console.error('refetchUserData:', error);
  }
}
