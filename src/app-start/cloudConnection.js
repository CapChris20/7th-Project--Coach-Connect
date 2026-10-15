// Boots Firebase once for the whole app and hands out the shared service handles.
// Flow: read config from env vars → sanity-check it (loudly) → create/reuse the Firebase app → init auth, Firestore, functions, storage.
// Used by: anywhere that touches the backend; every `import { db } from '.../cloudConnection'` gets these same instances.

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableNetwork } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== NAMED CONSTANTS =====

// Where the credentials come from.
// vocab: EXPO_PUBLIC_* = Expo's rule that only env vars with this prefix get bundled into the app
// at build time. They are NOT secret — they ship inside the binary; real security comes from Firestore rules.
// app.json also carries literal strings, but we deliberately ignore those and read process.env so
// switching .env files is the single way to point at a different backend.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const WEB_APP_ID_MARKER = ':web:';
const FIRESTORE_FORCE_LONG_POLLING_FLAG = 'true';
// Letters must stay anatrox-auth. That is the live Firebase project, not the app display name.
const LIVE_FIREBASE_PROJECT_ID = 'anatrox-auth';

const FIREBASE_ENV_NAMES = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};

// ===== HELPER FUNCTIONS =====

/**
 * Tripwire: 'anatrox-auth' is the real backend project id where all users and data live.
 * It does NOT match the app's display name on purpose, so this check catches a well-meaning
 * rename of the env var. Pointing at any other project = an app with zero accounts in it.
 * Manipulate here: only change this string if you are intentionally migrating Firebase projects.
 */
function warnIfWrongFirebaseProject() {
  if (firebaseConfig.projectId !== LIVE_FIREBASE_PROJECT_ID) {
    console.error('🚨 WRONG FIREBASE PROJECT — expected anatrox-auth, got:', firebaseConfig.projectId);
    console.error('🚨 Check your .env file immediately');
  }
}

/**
 * A Firebase project has separate app ids per platform, and the id encodes which one it is
 * (…:web:… vs …:ios:…). Native Apple/Google sign-in only works with the iOS id.
 */
function warnIfWebAppId() {
  if (!firebaseConfig.appId?.includes(WEB_APP_ID_MARKER)) return;
  console.error(
    '🚨 EXPO_PUBLIC_FIREBASE_APP_ID is a WEB app id — native Apple/Google sign-in will fail. Use the iOS app id (…:ios:…) from Firebase project settings.'
  );
}

/**
 * Collect every missing key first, then report once — otherwise you fix one var, restart,
 * and discover the next missing one, over and over.
 * @returns {string[]}
 */
function collectMissingFirebaseEnvNames() {
  const missingNames = [];
  if (!firebaseConfig.apiKey) missingNames.push(FIREBASE_ENV_NAMES.apiKey);
  if (!firebaseConfig.authDomain) missingNames.push(FIREBASE_ENV_NAMES.authDomain);
  if (!firebaseConfig.projectId) missingNames.push(FIREBASE_ENV_NAMES.projectId);
  if (!firebaseConfig.storageBucket) missingNames.push(FIREBASE_ENV_NAMES.storageBucket);
  if (!firebaseConfig.messagingSenderId) missingNames.push(FIREBASE_ENV_NAMES.messagingSenderId);
  if (!firebaseConfig.appId) missingNames.push(FIREBASE_ENV_NAMES.appId);
  return missingNames;
}

function presentOrMissingMark(value) {
  return value ? '✓' : '✗';
}

function logMissingFirebaseConfig(missingNames) {
  if (missingNames.length === 0) return;
  console.error('❌ Firebase configuration is missing:', missingNames.join(', '));
  // Print check/cross marks rather than the values themselves: this lands in dev logs and we don't
  // want keys pasted into screenshots or CI output.
  console.error('Current values:', {
    apiKey: presentOrMissingMark(firebaseConfig.apiKey),
    authDomain: presentOrMissingMark(firebaseConfig.authDomain),
    projectId: presentOrMissingMark(firebaseConfig.projectId),
    storageBucket: presentOrMissingMark(firebaseConfig.storageBucket),
    messagingSenderId: presentOrMissingMark(firebaseConfig.messagingSenderId),
    appId: presentOrMissingMark(firebaseConfig.appId),
  });
  // Env vars are baked in when Metro starts, so editing .env with the server running changes nothing.
  console.error('💡 Make sure to restart your Expo dev server after updating .env file!');
}

function warnIfCannotInitialize() {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) return;
  console.error('❌ Cannot initialize Firebase - missing required config values');
  console.error('Please check your .env file and restart the Expo dev server');
}

/**
 * vocab: getApps() = every Firebase app already initialized in this JS runtime.
 * Only reuse an app whose project AND platform id match ours.
 * @param {Array} apps
 * @returns {object|null}
 */
function findMatchingFirebaseApp(apps) {
  const matchingApp = apps.find((existingApp) =>
    existingApp?.options?.projectId === firebaseConfig.projectId &&
    existingApp?.options?.appId === firebaseConfig.appId
  );
  return matchingApp || null;
}

function warnIfStaleFirebaseApps(apps) {
  if (apps.length === 0) return;
  console.warn('⚠️ Existing Firebase app(s) do not match expected project; creating isolated app', {
    expectedProjectId: firebaseConfig.projectId,
    existingProjectIds: apps.map((existingApp) => existingApp?.options?.projectId || 'unknown'),
  });
}

function initializeIsolatedFirebaseApp() {
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully (new isolated app)', {
      projectId: firebaseApp?.options?.projectId,
    });
    return firebaseApp;
  } catch (error) {
    // Swallow rather than throw: a hard crash at import time takes down the whole bundle.
    console.error('❌ Firebase initialization error:', error.message);
    return null;
  }
}

/**
 * Calling initializeApp twice with the same name throws, and Fast Refresh re-runs this module
 * constantly in dev — so we look for an already-created app before making a new one.
 * @returns {object|null}
 */
function createOrReuseFirebaseApp() {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('⚠️ Firebase not properly configured - using fallback');
    return null;
  }

  const apps = getApps();
  const matchingApp = findMatchingFirebaseApp(apps);
  if (matchingApp) {
    console.log('✅ Firebase initialized successfully (reused matching app)', {
      projectId: matchingApp?.options?.projectId,
    });
    return matchingApp;
  }

  warnIfStaleFirebaseApps(apps);
  return initializeIsolatedFirebaseApp();
}

function getExistingFirebaseAuth(firebaseApp) {
  try {
    return getAuth(firebaseApp);
  } catch (error) {
    console.error('❌ Failed to get Firebase auth:', error.message);
    return null;
  }
}

/**
 * initializeAuth (not getAuth) is required on React Native to choose where the session is stored.
 * vocab: persistence = where the signed-in session is saved between app launches. AsyncStorage is
 * RN's key/value store — without this, users get logged out every time they close the app.
 * initializeAuth throws if auth was already set up (Fast Refresh) — then getAuth is what we want.
 * @param {object|null} firebaseApp
 * @returns {object|null}
 */
function createFirebaseAuth(firebaseApp) {
  if (!firebaseApp) return null;
  try {
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (_alreadyInitialized) {
    return getExistingFirebaseAuth(firebaseApp);
  }
}

function initializeOrReuseFirestore(firebaseApp, forceLongPolling) {
  try {
    console.log('🔥 Firestore init (RN)', {
      forceLongPolling,
      experimentalAutoDetectLongPolling: !forceLongPolling,
    });
    return initializeFirestore(firebaseApp, {
      // These two are mutually exclusive: auto-detect probes the connection and decides; force skips
      // the probe. The `!forceLongPolling` flip is what keeps exactly one of them active.
      experimentalAutoDetectLongPolling: !forceLongPolling,
      experimentalForceLongPolling: forceLongPolling,
      // RN's fetch implementation doesn't support streaming bodies; leaving this on causes hangs.
      useFetchStreams: false,
    });
  } catch (_alreadyInitialized) {
    return getFirestore(firebaseApp);
  }
}

function enableFirestoreNetwork(firestore) {
  // Firestore can be left in a disabled-network state by a previous session; this explicitly wakes it.
  // Fire-and-forget on purpose — module load must not await the network.
  enableNetwork(firestore)
    .then(() => console.log('🛰️ Firestore network enabled'))
    .catch((error) => console.warn('🛰️ Firestore enableNetwork failed:', error?.message || error));
}

/**
 * On React Native / Expo the default WebChannel transport often fails and Firestore reports
 * "Failed to get document because the client is offline" on perfectly good Wi-Fi. Long-polling fixes it.
 * Manipulate here: set EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING=true in .env when a device still
 * reports phantom "offline" errors.
 * @param {object|null} firebaseApp
 * @returns {object|null}
 */
function createFirestore(firebaseApp) {
  if (!firebaseApp) return null;
  const forceLongPolling = process.env.EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === FIRESTORE_FORCE_LONG_POLLING_FLAG;
  const firestore = initializeOrReuseFirestore(firebaseApp, forceLongPolling);
  enableFirestoreNetwork(firestore);
  return firestore;
}

/**
 * Kept so `import supabase from '.../cloudConnection'` keeps resolving for legacy call sites.
 * It is always null today; the env check just marks where a real client would be created.
 * @returns {null}
 */
function createSupabasePlaceholder() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    // Supabase initialization would go here if needed
    // import { createClient } from '../supabase/supabase-js';
    // supabase = createClient(
    //   process.env.EXPO_PUBLIC_SUPABASE_URL,
    //   process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
    // );
  }
  return null;
}

// ===== MAIN FUNCTION =====

warnIfWrongFirebaseProject();
warnIfWebAppId();
logMissingFirebaseConfig(collectMissingFirebaseEnvNames());
warnIfCannotInitialize();

const firebaseApp = createOrReuseFirebaseApp();
const auth = createFirebaseAuth(firebaseApp);
const db = createFirestore(firebaseApp);
const functions = firebaseApp ? getFunctions(firebaseApp) : null;
const storage = firebaseApp ? getStorage(firebaseApp) : null;
const supabase = createSupabasePlaceholder();

export { auth, db, storage, firebaseApp as app, functions };
export default supabase;
