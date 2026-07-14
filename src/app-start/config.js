/**
 * config
 *
 * Purpose: config — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/app
 * Key exports: (see file)
 *
 * @file-header
 */
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, enableNetwork } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Get Firebase config from environment variables
// In Expo, EXPO_PUBLIC_* vars are available via process.env
// app.json has literal strings, so we ignore those and use process.env directly
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

if (firebaseConfig.projectId !== 'anatrox-auth') {
  console.error('🚨 WRONG FIREBASE PROJECT — expected anatrox-auth, got:', firebaseConfig.projectId);
  console.error('🚨 Check your .env file immediately');
}

if (firebaseConfig.appId?.includes(':web:')) {
  console.error(
    '🚨 EXPO_PUBLIC_FIREBASE_APP_ID is a WEB app id — native Apple/Google sign-in will fail. Use the iOS app id (…:ios:…) from Firebase project settings.'
  );
}

// Validate config
const missing = [];
if (!firebaseConfig.apiKey) missing.push('EXPO_PUBLIC_FIREBASE_API_KEY');
if (!firebaseConfig.authDomain) missing.push('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
if (!firebaseConfig.projectId) missing.push('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseConfig.storageBucket) missing.push('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET');
if (!firebaseConfig.messagingSenderId) missing.push('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID');
if (!firebaseConfig.appId) missing.push('EXPO_PUBLIC_FIREBASE_APP_ID');

if (missing.length > 0) {
  console.error('❌ Firebase configuration is missing:', missing.join(', '));
  console.error('Current values:', {
    apiKey: firebaseConfig.apiKey ? '✓' : '✗',
    authDomain: firebaseConfig.authDomain ? '✓' : '✗',
    projectId: firebaseConfig.projectId ? '✓' : '✗',
    storageBucket: firebaseConfig.storageBucket ? '✓' : '✗',
    messagingSenderId: firebaseConfig.messagingSenderId ? '✓' : '✗',
    appId: firebaseConfig.appId ? '✓' : '✗',
  });
  console.error('💡 Make sure to restart your Expo dev server after updating .env file!');
}

// Don't initialize if config is missing
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.error('❌ Cannot initialize Firebase - missing required config values');
  console.error('Please check your .env file and restart the Expo dev server');
}

// Initialize Firebase App (only if not already initialized)
let app;
if (firebaseConfig.apiKey && firebaseConfig.projectId) {
  const apps = getApps();
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
      console.error('❌ Firebase initialization error:', error.message);
      app = null;
    }
  }
} else {
  // Create a dummy app to prevent crashes, but it won't work
  console.warn('⚠️ Firebase not properly configured - using fallback');
  app = null;
}

// Initialize Auth with AsyncStorage persistence for React Native
let auth;
if (app) {
  try {
    auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    // If auth is already initialized, get the existing instance
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

// Initialize Firestore
// On React Native / Expo, the default WebChannel transport often fails and Firestore
// reports "Failed to get document because the client is offline" even on good Wi‑Fi.
// Long-polling (auto-detect) fixes that for most devices. This is NOT the same as
// airplane mode — it's a transport compatibility issue.
let db = null;
if (app) {
  const forceLongPolling = process.env.EXPO_PUBLIC_FIRESTORE_FORCE_LONG_POLLING === 'true';
  try {
    console.log('🔥 Firestore init (RN)', {
      forceLongPolling,
      experimentalAutoDetectLongPolling: !forceLongPolling,
    });
    db = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: !forceLongPolling,
      experimentalForceLongPolling: forceLongPolling,
      useFetchStreams: false,
    });
  } catch (_) {
    db = getFirestore(app);
  }
  enableNetwork(db)
    .then(() => console.log('🛰️ Firestore network enabled'))
    .catch((e) => console.warn('🛰️ Firestore enableNetwork failed:', e?.message || e));
}

// Initialize Cloud Functions (for callables e.g. runWeeklySummaries)
const functions = app ? getFunctions(app) : null;

// Initialize Storage
const storage = app ? getStorage(app) : null;

// Export Supabase client if needed (for compatibility)
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
