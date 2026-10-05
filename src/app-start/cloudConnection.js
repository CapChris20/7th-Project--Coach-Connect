// Boots Firebase once for the whole app and hands out the shared service handles.
// Flow: read config from env vars → sanity-check it (loudly) → create/reuse the Firebase app → init auth, Firestore, functions, storage.
// Imported anywhere that touches the backend; every `import { db } from '.../config'` gets these same instances.
// Key exports: auth, db, storage, app, functions (default export is the Supabase placeholder)

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableNetwork } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Where the credentials come from.
// vocab: EXPO_PUBLIC_* = Expo's rule that only env vars with this prefix get bundled into the app at
// build time. They are NOT secret — they ship inside the binary; real security comes from Firestore rules.
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

// Tripwire: 'anatrox-auth' is the real backend project id where all users and data live. It does NOT
// match the app's display name on purpose, so this check is here to catch a well-meaning rename of
// the env var. Pointing at any other project = an app with zero accounts in it.
// Manipulate here: only change this string if you are intentionally migrating Firebase projects.
if (firebaseConfig.projectId !== 'anatrox-auth') {
  console.error('🚨 WRONG FIREBASE PROJECT — expected anatrox-auth, got:', firebaseConfig.projectId);
  console.error('🚨 Check your .env file immediately');
}

// A Firebase project has separate app ids per platform, and the id encodes which one it is
// (…:web:… vs …:ios:…). Native Apple/Google sign-in only works with the iOS id, and the failure
// otherwise is a confusing runtime auth error — so we name the real cause up front.
if (firebaseConfig.appId?.includes(':web:')) {
  console.error(
    '🚨 EXPO_PUBLIC_FIREBASE_APP_ID is a WEB app id — native Apple/Google sign-in will fail. Use the iOS app id (…:ios:…) from Firebase project settings.'
  );
}

// Collect every missing key first, then report once — otherwise you fix one var, restart, and
// discover the next missing one, over and over.
const missing = [];
if (!firebaseConfig.apiKey) missing.push('EXPO_PUBLIC_FIREBASE_API_KEY');
if (!firebaseConfig.authDomain) missing.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
if (!firebaseConfig.projectId) missing.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseConfig.storageBucket) missing.push('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
if (!firebaseConfig.messagingSenderId) missing.push('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
if (!firebaseConfig.appId) missing.push('EXPO_PUBLIC_FIREBASE_APP_ID');

if (missing.length > 0) {
  console.error('❌ Firebase configuration is missing:', missing.join(', '));
  // Print check/cross marks rather than the values themselves: this lands in dev logs and we don't
  // want keys pasted into screenshots or CI output.
  console.error('Current values:', {
    apiKey: firebaseConfig.apiKey ? '✓' : '✗',
    authDomain: firebaseConfig.authDomain ? '✓' : '✗',
    projectId: firebaseConfig.projectId ? '✓' : '✗',
    storageBucket: firebaseConfig.storageBucket ? '✓' : '✗',
    messagingSenderId: firebaseConfig.messagingSenderId ? '✓' : '✗',
    appId: firebaseConfig.appId ? '✓' : '✗',
  });
  // Env vars are baked in when Metro starts, so editing .env with the server running changes nothing.
  // This is the #1 cause of "I set it and it's still blank".
  console.error('💡 Make sure to restart your Expo dev server after updating .env file!');
}

// apiKey + projectId are the two we can't fake our way past; everything below keys off this pair.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Cannot initialize Firebase - missing required config values');
  console.error('Please check your .env file and restart the Expo dev server');
}

// --- Firebase app instance ---------------------------------------------------
// Calling initializeApp twice with the same name throws, and Fast Refresh re-runs this module
// constantly in dev — so we look for an already-created app before making a new one.
let app;
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  // vocab: getApps() = every Firebase app already initialized in this JS runtime.
  const apps = getApps();
  // Only reuse an app whose project AND platform id match ours. Matching on projectId alone would
  // happily hand back a web-configured app and break native sign-in.
  const matchingApp =
    apps.find((a) =>
      a?.options?.projectId === firebaseConfig.projectId &&
      a?.options?.appId === firebaseConfig.appId
    ) || null;

  if (matchingApp) {
    app = matchingApp;
    console.log('✅ Firebase initialized successfully (reused matching app)', {
      projectId: app?.options?.projectId,
    });
  } else {
    // Apps exist but none match: usually a stale instance from a previous env after a hot reload.
    // We warn and create our own rather than silently using someone else's project.
    if (apps.length > 0) {
      console.warn('⚠️ Existing Firebase app(s) do not match expected project; creating isolated app', {
        expectedProjectId: firebaseConfig.projectId,
        existingProjectIds: apps.map((a) => a?.options?.projectId || 'unknown'),
      });
    }
    try {
      app = initializeApp(firebaseConfig);
      console.log('✅ Firebase initialized successfully (new isolated app)', {
        projectId: app?.options?.projectId,
      });
    } catch (error) {
      // Swallow rather than throw: a hard crash at import time takes down the whole bundle before
      // any screen renders. app = null lets the UI mount and show a degraded state instead.
      console.error('❌ Firebase initialization error:', error.message);
      app = null;
    }
  }
} else {
  console.warn('⚠️ Firebase not properly configured - using fallback');
  app = null;
}

// --- Auth --------------------------------------------------------------------
// Every service below follows the same shape: `if (app)` guard, because a null app means we're in
// the misconfigured fallback state and calling Firebase would throw.
let auth;
if (app) {
  try {
    // initializeAuth (not getAuth) is required on React Native to choose where the session is stored.
    // vocab: persistence = where the signed-in session is saved between app launches. AsyncStorage is
    // RN's key/value store — without this, users get logged out every time they close the app.
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // initializeAuth throws if auth was already set up (Fast Refresh again) — in that case the
    // existing instance is exactly what we want, so fetch it with getAuth.
    try {
      auth = getAuth(app);
    } catch (e) {
      console.error('❌ Failed to get Firebase auth:', e.message);
      auth = null;
    }
  }
} else {
  auth = null;
}

// --- Firestore ---------------------------------------------------------------
// On React Native / Expo the default WebChannel transport often fails and Firestore reports
// "Failed to get document because the client is offline" on perfectly good Wi-Fi. That message is a
// lie — it's a transport compatibility problem, not connectivity. Long-polling fixes it.
let db = null;
if (app) {
  // Manipulate here: set EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING=true in .env when a device still
  // reports phantom "offline" errors — that skips auto-detection and always uses long-polling
  // (slightly slower, much more reliable on flaky networks/emulators).
  const forceLongPolling = process.env.EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === 'true';
  try {
    console.log('🔥 Firestore init (RN)', {
      forceLongPolling,
      experimentalAutoDetectLongPolling: !forceLongPolling,
    });
    db = initializeFirestore(app, {
      // These two are mutually exclusive: auto-detect probes the connection and decides; force skips
      // the probe. The `!forceLongPolling` flip is what keeps exactly one of them active.
      experimentalAutoDetectLongPolling: !forceLongPolling,
      experimentalForceLongPolling: forceLongPolling,
      // RN's fetch implementation doesn't support streaming bodies; leaving this on causes hangs.
      useFetchStreams: false,
    });
  } catch (_) {
    // Already initialized elsewhere (hot reload) — settings can only be applied once, so just grab
    // the existing instance and move on.
    db = getFirestore(app);
  }
  // Firestore can be left in a disabled-network state by a previous session; this explicitly wakes it.
  // Fire-and-forget on purpose — module load must not await the network.
  enableNetwork(db)
    .then(() => console.log('🛰️ Firestore network enabled'))
    .catch((e) => console.warn('🛰️ Firestore enableNetwork failed:', e?.message || e));
}

// Cloud Functions client — used for callables like runWeeklySummaries (server-side work the app
// isn't allowed to do directly).
const functions = app ? getFunctions(app) : null;

// Cloud Storage client — profile photos, progress pictures, uploaded files.
const storage = app ? getStorage(app) : null;

// --- Supabase placeholder ----------------------------------------------------
// Kept so `import supabase from '.../config'` keeps resolving for legacy call sites. It is always
// null today; the env check just marks where a real client would be created if we ever add one.
let supabase = null;
if (process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  // Supabase initialization would go here if needed
  // import { createClient } from '../supabase/supabase-js';
  // supabase = createClient(
  //   process.env.EXPO_PUBLIC_SUPABASE_URL,
  //   process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  // );
}

export { auth, db, storage, app, functions };
export default supabase;
