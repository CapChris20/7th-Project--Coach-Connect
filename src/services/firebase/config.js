import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import Constants from 'expo-constants';

// Firebase configuration for anatrox-auth project
const firebaseConfig = {
  apiKey: "AIzaSyApWwNnqjMQg4fOJE5YOqlyLQdB7FFSdfc",
  authDomain: "anatrox-auth.firebaseapp.com",
  projectId: "anatrox-auth",
  storageBucket: "anatrox-auth.firebasestorage.app",
  messagingSenderId: "421005574501",
  appId: "1:421005574501:web:423736a212d1690010218c",
  webClientId: "421005574501-v4090b84ff5521cioeb2jsg5mqj2plhn.apps.googleusercontent.com",
};

// Initialize Firebase with error handling
let app;
let auth;
let db;
let storage;

try {
  console.log('Initializing Firebase with config:', firebaseConfig);
  
  // Check if Firebase app is already initialized
  try {
    app = initializeApp(firebaseConfig);
  } catch (initError) {
    if (initError.code === 'app/duplicate-app') {
      console.log('Firebase app already initialized, using existing instance');
      app = initializeApp(firebaseConfig, 'anatrox-app');
    } else {
      throw initError;
    }
  }
  
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  console.log('Firebase initialized successfully for project:', firebaseConfig.projectId);
} catch (error) {
  console.error('Firebase initialization error:', error);
  console.log('Continuing without Firebase - check your configuration');
  auth = null;
  db = null;
  storage = null;
}

export { auth, db, storage };
export default app;
