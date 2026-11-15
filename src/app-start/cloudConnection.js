// Boots Firebase once for the whole app and hands out the shared service handles.
// Flow: read env config → sanity-check (loudly) → create/reuse app → auth + Firestore + extras.
// Used by: anywhere that touches the backend (`import { db, auth } from '.../cloudConnection'`).

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableNetwork } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ===== NAMED CONSTANTS =====

// vocab: EXPO_PUBLIC_* = Expo only bundles env vars with this prefix into the app binary.
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

function functionsHandleForApp(firebaseAppHandle) {
  if (!firebaseAppHandle) {
    return null;
  }
  return getFunctions(firebaseAppHandle);
}

function storageHandleForApp(firebaseAppHandle) {
  if (!firebaseAppHandle) {
    return null;
  }
  return getStorage(firebaseAppHandle);
}

/**
 * Tripwire: 'anatrox-auth' is the real backend project id where all users and data live.
 * Manipulate here: only change LIVE_FIREBASE_PROJECT_ID if you are intentionally migrating projects.
 */
function warnIfWrongFirebaseProject() {
  if (firebaseConfig.projectId === LIVE_FIREBASE_PROJECT_ID) {
    return;
  }
  console.error('🚨 WRONG FIREBASE PROJECT — expected anatrox-auth, got:', firebaseConfig.projectId);
  console.error('🚨 Check your .env file immediately');
}

/**
 * A Firebase project has separate app ids per platform; the id encodes which one
 * (…:web:… vs …:ios:…). Native Apple/Google sign-in only works with the iOS id.
 */
function warnIfWebAppId() {
  const appIdText = firebaseConfig.appId;
  if (!appIdText) {
    return;
  }
  if (!appIdText.includes(WEB_APP_ID_MARKER)) {
    return;
  }
  console.error(
    '🚨 EXPO_PUBLIC_FIREBASE_APP_ID is a WEB app id — native Apple/Google sign-in will fail. Use the iOS app id (…:ios:…) from Firebase project settings.',
  );
}

/**
 * Collect every missing key first, then report once.
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
  if (value) {
    return '✓';
  }
  return '✗';
}

function logMissingFirebaseConfig(missingNames) {
  if (missingNames.length === 0) {
    return;
  }
  console.error('❌ Firebase configuration is missing:', missingNames.join(', '));
  console.error('Current values:', {
    apiKey: presentOrMissingMark(firebaseConfig.apiKey),
    authDomain: presentOrMissingMark(firebaseConfig.authDomain),
    projectId: presentOrMissingMark(firebaseConfig.projectId),
    storageBucket: presentOrMissingMark(firebaseConfig.storageBucket),
    messagingSenderId: presentOrMissingMark(firebaseConfig.messagingSenderId),
    appId: presentOrMissingMark(firebaseConfig.appId),
  });
  console.error('💡 Make sure to restart your Expo dev server after updating .env file!');
}

function warnIfCannotInitialize() {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    return;
  }
  console.error('❌ Cannot initialize Firebase - missing required config values');
  console.error('Please check your .env file and restart the Expo dev server');
}

function runFirebaseConfigSanityChecks() {
  warnIfWrongFirebaseProject();
  warnIfWebAppId();
  logMissingFirebaseConfig(collectMissingFirebaseEnvNames());
  warnIfCannotInitialize();
}

function projectIdFromAppOptions(existingApp) {
  if (!existingApp) {
    return null;
  }
  if (!existingApp.options) {
    return null;
  }
  return existingApp.options.projectId || null;
}

function appIdFromAppOptions(existingApp) {
  if (!existingApp) {
    return null;
  }
  if (!existingApp.options) {
    return null;
  }
  return existingApp.options.appId || null;
}

/**
 * vocab: getApps() = every Firebase app already initialized in this JS runtime.
 * Only reuse an app whose project AND platform id match ours.
 * @param {Array} apps
 * @returns {object|null}
 */
function findMatchingFirebaseApp(apps) {
  for (let index = 0; index < apps.length; index += 1) {
    const existingApp = apps[index];
    const projectMatches = projectIdFromAppOptions(existingApp) === firebaseConfig.projectId;
    const appIdMatches = appIdFromAppOptions(existingApp) === firebaseConfig.appId;
    if (projectMatches && appIdMatches) {
      return existingApp;
    }
  }
  return null;
}

function projectIdsFromExistingApps(apps) {
  const projectIds = [];
  for (let index = 0; index < apps.length; index += 1) {
    const projectId = projectIdFromAppOptions(apps[index]);
    if (projectId) {
      projectIds.push(projectId);
    } else {
      projectIds.push('unknown');
    }
  }
  return projectIds;
}

function warnIfStaleFirebaseApps(apps) {
  if (apps.length === 0) {
    return;
  }
  console.warn('⚠️ Existing Firebase app(s) do not match expected project; creating isolated app', {
    expectedProjectId: firebaseConfig.projectId,
    existingProjectIds: projectIdsFromExistingApps(apps),
  });
}

function initializeIsolatedFirebaseApp() {
  try {
    const newFirebaseApp = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully (new isolated app)', {
      projectId: projectIdFromAppOptions(newFirebaseApp),
    });
    return newFirebaseApp;
  } catch (error) {
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
      projectId: projectIdFromAppOptions(matchingApp),
    });
    return matchingApp;
  }

  warnIfStaleFirebaseApps(apps);
  return initializeIsolatedFirebaseApp();
}

function getExistingFirebaseAuth(firebaseAppHandle) {
  try {
    return getAuth(firebaseAppHandle);
  } catch (error) {
    console.error('❌ Failed to get Firebase auth:', error.message);
    return null;
  }
}

/**
 * initializeAuth (not getAuth) is required on React Native to choose where the session is stored.
 * vocab: persistence = where the signed-in session is saved between launches.
 * @param {object|null} firebaseAppHandle
 * @returns {object|null}
 */
function createFirebaseAuth(firebaseAppHandle) {
  if (!firebaseAppHandle) {
    return null;
  }
  try {
    return initializeAuth(firebaseAppHandle, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (_alreadyInitialized) {
    return getExistingFirebaseAuth(firebaseAppHandle);
  }
}

function initializeOrReuseFirestore(firebaseAppHandle, forceLongPolling) {
  const autoDetectLongPolling = !forceLongPolling;
  try {
    console.log('🔥 Firestore init (RN)', {
      forceLongPolling,
      experimentalAutoDetectLongPolling: autoDetectLongPolling,
    });
    return initializeFirestore(firebaseAppHandle, {
      experimentalAutoDetectLongPolling: autoDetectLongPolling,
      experimentalForceLongPolling: forceLongPolling,
      useFetchStreams: false,
    });
  } catch (_alreadyInitialized) {
    return getFirestore(firebaseAppHandle);
  }
}

function messageFromCaughtError(error) {
  if (error && error.message) {
    return error.message;
  }
  return error;
}

function enableFirestoreNetwork(firestoreHandle) {
  enableNetwork(firestoreHandle)
    .then(() => console.log('🛰️ Firestore network enabled'))
    .catch((error) => {
      console.warn('🛰️ Firestore enableNetwork failed:', messageFromCaughtError(error));
    });
}

/**
 * On React Native / Expo the default WebChannel transport often fails; long-polling fixes it.
 * Manipulate here: set EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING=true in .env when needed.
 * @param {object|null} firebaseAppHandle
 * @returns {object|null}
 */
function createFirestore(firebaseAppHandle) {
  if (!firebaseAppHandle) {
    return null;
  }
  const forceLongPolling =
    process.env.EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === FIRESTORE_FORCE_LONG_POLLING_FLAG;
  const firestoreHandle = initializeOrReuseFirestore(firebaseAppHandle, forceLongPolling);
  enableFirestoreNetwork(firestoreHandle);
  return firestoreHandle;
}

/**
 * Kept so `import supabase from '.../cloudConnection'` keeps resolving for legacy call sites.
 * @returns {null}
 */
function createSupabasePlaceholder() {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    // Supabase initialization would go here if needed
  }
  return null;
}

// ===== MAIN FUNCTION =====

/**
 * One-shot boot: scream if misconfigured, then build the shared Firebase handles.
 * Flow: 1. sanity  2. app  3. auth  4. Firestore  5. optional siblings
 * @returns {{ firebaseApp: object|null, auth: object|null, db: object|null, functions: object|null, storage: object|null, supabase: null }}
 */
function bootSharedFirebaseServices() {
  // 1. Scream early if env points at the wrong project or missing keys.
  runFirebaseConfigSanityChecks();

  // 2. App singleton (Fast Refresh safe — never call initializeApp twice for the same name).
  const firebaseAppHandle = createOrReuseFirebaseApp();

  // 3. Auth with AsyncStorage persistence (React Native requirement).
  const authHandle = createFirebaseAuth(firebaseAppHandle);

  // 4. Firestore with RN transport tweaks + network wake-up.
  const firestoreHandle = createFirestore(firebaseAppHandle);

  // 5. Optional siblings — null when the app failed to boot.
  const functionsHandle = functionsHandleForApp(firebaseAppHandle);
  const storageHandle = storageHandleForApp(firebaseAppHandle);
  const supabasePlaceholder = createSupabasePlaceholder();

  return {
    firebaseApp: firebaseAppHandle,
    auth: authHandle,
    db: firestoreHandle,
    functions: functionsHandle,
    storage: storageHandle,
    supabase: supabasePlaceholder,
  };
}

const sharedServices = bootSharedFirebaseServices();
const auth = sharedServices.auth;
const db = sharedServices.db;
const functions = sharedServices.functions;
const storage = sharedServices.storage;
const supabase = sharedServices.supabase;
const firebaseApp = sharedServices.firebaseApp;

export { auth, db, storage, firebaseApp as app, functions };
export default supabase;
