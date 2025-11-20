import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  sendEmailVerification,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { auth } from './config';

// Configure WebBrowser for auth session
WebBrowser.maybeCompleteAuthSession();

// Sign in with email and password
export const signIn = async (email, password) => {
  try {
    if (!auth) {
      console.error('Firebase auth not initialized');
      return { success: false, error: 'Firebase auth not initialized. Check your Firebase configuration.' };
    }
    console.log('Attempting to sign in user:', email);
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    console.log('User signed in successfully:', userCredential.user.uid);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Sign in error:', error);
    return { success: false, error: error.message };
  }
};

// Create new user account
export const signUp = async (email, password, displayName) => {
  try {
    if (!auth) {
      console.error('Firebase auth not initialized');
      return { success: false, error: 'Firebase auth not initialized. Check your Firebase configuration.' };
    }
    console.log('Creating new user account:', email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update user profile with display name
    if (displayName) {
      await updateProfile(userCredential.user, { displayName });
    }
    
    console.log('User account created successfully:', userCredential.user.uid);
    return { success: true, user: userCredential.user };
  } catch (error) {
    console.error('Sign up error:', error);
    return { success: false, error: error.message };
  }
};

// Sign out current user
export const signOutUser = async () => {
  try {
    console.log('Signing out user');
    await signOut(auth);
    console.log('User signed out successfully');
    return { success: true };
  } catch (error) {
    console.error('Sign out error:', error);
    return { success: false, error: error.message };
  }
};

// Send password reset email
export const resetPassword = async (email) => {
  try {
    console.log('Sending password reset email to:', email);
    await sendPasswordResetEmail(auth, email);
    console.log('Password reset email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Password reset error:', error);
    return { success: false, error: error.message };
  }
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  if (!auth) {
    console.log('Firebase auth not available - using demo mode');
    // Simulate logged in state for demo
    callback({ uid: 'demo-user', email: 'demo@anatrox.com' });
    return () => {}; // Return unsubscribe function
  }
  return onAuthStateChanged(auth, callback);
};

// Get current user
export const getCurrentUser = () => {
  if (!auth) {
    return { uid: 'demo-user', email: 'demo@anatrox.com' };
  }
  return auth.currentUser;
};

// Sign in with Google
export const signInWithGoogle = async () => {
  try {
    if (!auth) {
      throw new Error('Firebase auth not initialized');
    }
    
    // Create redirect URI - use Expo proxy for Google OAuth
    const redirectUri = 'https://auth.expo.io/@anonymous/anatrox-app';
    
    // Create AuthRequest for Google OAuth
    const request = new AuthSession.AuthRequest({
      clientId: "421005574501-v4090b84ff5521cioeb2jsg5mqj2plhn.apps.googleusercontent.com",
      scopes: ['openid', 'profile', 'email'],
      redirectUri: redirectUri,
      responseType: AuthSession.ResponseType.Code,
      extraParams: {},
      additionalParameters: {},
    });

    console.log('Starting Google OAuth flow...');
    console.log('Redirect URI:', redirectUri);

    // Start the auth session
    const result = await request.promptAsync({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    });

    console.log('OAuth result:', result);

    if (result.type === 'success' && result.params.code) {
      console.log('Got authorization code, exchanging for tokens...');
      
      // Exchange the code for tokens
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: "421005574501-v4090b84ff5521cioeb2jsg5mqj2plhn.apps.googleusercontent.com",
          code: result.params.code,
          redirectUri: redirectUri,
        },
        {
          tokenEndpoint: 'https://oauth2.googleapis.com/token',
        }
      );

      console.log('Token response:', tokenResponse);

      if (tokenResponse.idToken) {
        // Create Google credential
        const credential = GoogleAuthProvider.credential(tokenResponse.idToken);
        
        // Sign in with Firebase
        const userCredential = await signInWithCredential(auth, credential);
        
        console.log('Google sign in successful:', userCredential.user.uid);
        return { success: true, user: userCredential.user };
      } else {
        return { success: false, error: 'No ID token received from Google' };
      }
    } else if (result.type === 'cancel') {
      return { success: false, error: 'Google sign in was cancelled' };
    } else {
      return { success: false, error: `OAuth failed: ${result.type}` };
    }
  } catch (error) {
    console.error('Google sign in error:', error);
    return { success: false, error: error.message };
  }
};

// Send email verification
export const sendVerificationEmail = async () => {
  try {
    if (!auth || !auth.currentUser) {
      throw new Error('No authenticated user');
    }
    
    await sendEmailVerification(auth.currentUser);
    console.log('Verification email sent successfully');
    return { success: true };
  } catch (error) {
    console.error('Email verification error:', error);
    return { success: false, error: error.message };
  }
};

// Update user password
export const updateUserPassword = async (newPassword) => {
  try {
    if (!auth || !auth.currentUser) {
      throw new Error('No authenticated user');
    }
    
    await updatePassword(auth.currentUser, newPassword);
    console.log('Password updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Password update error:', error);
    return { success: false, error: error.message };
  }
};

// Reauthenticate user (required for sensitive operations)
export const reauthenticateUser = async (password) => {
  try {
    if (!auth || !auth.currentUser || !auth.currentUser.email) {
      throw new Error('No authenticated user');
    }
    
    const credential = EmailAuthProvider.credential(auth.currentUser.email, password);
    await reauthenticateWithCredential(auth.currentUser, credential);
    console.log('User reauthenticated successfully');
    return { success: true };
  } catch (error) {
    console.error('Reauthentication error:', error);
    return { success: false, error: error.message };
  }
};

// Update user profile
export const updateUserProfile = async (updates) => {
  try {
    if (!auth || !auth.currentUser) {
      throw new Error('No authenticated user');
    }
    
    await updateProfile(auth.currentUser, updates);
    console.log('Profile updated successfully');
    return { success: true };
  } catch (error) {
    console.error('Profile update error:', error);
    return { success: false, error: error.message };
  }
};
