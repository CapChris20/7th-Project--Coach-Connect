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
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '../shared/ui/ThemeContext';
import SplashScreen from '../splash/SplashScreen';
import LoginScreen from '../auth/LoginScreen';
import SignupScreen from '../auth/SignupScreen';
import ForgotPasswordScreen from '../auth/ForgotPasswordScreen';
import OnboardingScreen from '../auth/OnboardingScreen';
import TrainerApp from './TrainerApp';
import ClientApp from './ClientApp';
import { auth, db } from './config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { initializeErrorSync } from '../../utils/errorSyncService';
import { loadApiKey } from '../ai/services/apiKeyService';
import { clearOldSharedChats } from '../ai/services/chatStorageService';

export default function AuthGate() {
  const [showSplash, setShowSplash] = useState(true);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'signup', 'forgotPassword'
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [keyLoaded, setKeyLoaded] = useState(false);

  // Load API key and initialize error syncing on app start
  useEffect(() => {
    (async () => {
      try {
        // Initialize automatic error syncing
        await initializeErrorSync();
        
        // Load API key
        await loadApiKey();
      } catch (e) {
        console.error('Failed to load API key:', e);
      } finally {
        setKeyLoaded(true);
      }
    })();
  }, []);

  // Set up global error handlers - DISABLED TO PREVENT INFINITE LOOPS
  // TODO: Re-enable once the "undefined module" issue is fixed

  // Firebase auth state listener
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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
      if (firebaseUser && db) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('📄 User data found:', userData);
            const role = userData.role || 'trainer'; // Default to trainer for your account
            setUserRole(role);
            
            // Show onboarding if not completed
            if (!userData.onboardingCompleted) {
              console.log('👋 User needs onboarding - onboardingCompleted:', userData.onboardingCompleted);
              // TEMPORARY FIX: Skip onboarding for your specific account
              if (firebaseUser.email === 'pissdick@gmail.com') {
                console.log('🔧 Skipping onboarding for trainer account - setting onboardingCompleted to true');
                // Update the user document to mark onboarding as completed
                try {
                  await setDoc(doc(db, 'users', firebaseUser.uid), {
                    ...userData,
                    onboardingCompleted: true,
                    updatedAt: new Date().toISOString()
                  }, { merge: true });
                  setShowOnboarding(false);
                } catch (updateError) {
                  console.error('Failed to update onboarding status:', updateError);
                  setShowOnboarding(false); // Skip anyway
                }
              } else {
                setShowOnboarding(true);
              }
            } else {
              console.log('✅ Onboarding completed - proceeding to app');
              setShowOnboarding(false);
            }
          } else {
            // New user, show onboarding
            console.log('🆕 New user detected - showing onboarding');
            setUserRole('trainer'); // Default to trainer for your account
            setShowOnboarding(true);
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          console.log('🔧 Defaulting to trainer role and skipping onboarding due to error');
          setUserRole('trainer'); // Default to trainer
          setShowOnboarding(false); // Skip onboarding if there's an error
        }
      } else {
        console.log('⚠️ Firebase not available - defaulting to trainer');
        setUserRole('trainer');
        setShowOnboarding(false);
      }
      
      setAuthLoading(false);
      setOnboardingChecked(true);
      
      // If user signs out, reset app state
      if (!firebaseUser) {
        console.log('User signed out');
        setShowOnboarding(false);
        setOnboardingChecked(false);
        setUserRole(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Show splash screen first
  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // Show auth screens if user is not logged in
  if (!user) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          {authScreen === 'login' && (
            <LoginScreen
              navigation={{
                navigate: (screen) => setAuthScreen(screen.toLowerCase().replace('screen', '')),
              }}
              onLoginSuccess={(userData) => {
                setUser(userData);
                setAuthScreen('login');
              }}
            />
          )}
          {authScreen === 'signup' && (
            <SignupScreen
              navigation={{
                navigate: (screen) => setAuthScreen(screen.toLowerCase().replace('screen', '')),
              }}
              onSignupSuccess={(userData, role) => {
                setUser(userData);
                if (role) setUserRole(role);
                setShowOnboarding(true); // New users always go to onboarding
                setAuthScreen('login');
              }}
            />
          )}
          {authScreen === 'forgotpassword' && (
            <ForgotPasswordScreen
              navigation={{
                navigate: (screen) => setAuthScreen(screen.toLowerCase().replace('screen', '')),
                goBack: () => setAuthScreen('login'),
              }}
            />
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // For logged-in users, wait for onboarding check and key loading
  if (!keyLoaded || !onboardingChecked) {
    return null; // Loading
  }

  // Show onboarding if needed
  if (showOnboarding) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <OnboardingScreen
            role={userRole}
            onComplete={(chosenRole) => {
              if (chosenRole) setUserRole(chosenRole);
              setShowOnboarding(false);
            }}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // User is authenticated - route to appropriate app based on role
  if (userRole === 'trainer') {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <TrainerApp user={user} />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // Default to client app
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ClientApp user={user} userData={userData} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

