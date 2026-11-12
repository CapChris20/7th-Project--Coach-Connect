// Design Law signed-out stack: welcome poster → create account → sign in (one component, no navigator).
// Flow: `currentView` swaps the three screens → email / Google / Apple auth → users/{uid} →
//       onSignupSuccess or onLoginSuccess so LoginGate routes into the app.
// Used by LoginGate when nobody is signed in. Visual law: screens/welcome-and-sign-in PNGs.

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Animated as RNAnimated } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../look-and-feel/lightDarkMode';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCredential, signOut, GoogleAuthProvider, updateProfile, OAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, functions } from '../app-start/cloudConnection';
import { httpsCallable } from 'firebase/functions';
import * as Google from 'expo-auth-session/providers/google';import * as WebBrowser from 'expo-web-browser';
import { pickImage } from '../ai-coach/conversation/photoPermissions';
import { uploadProfileImage } from '../for-both/cloud-database/uploadAndDownloadFiles';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import GlassBackgroundDark from '../look-and-feel/GlassBackgroundDark';
import GlassBackgroundLight from '../look-and-feel/GlassBackgroundLight';
import GlassCard from '../look-and-feel/GlassCard';
import ErrorPopup from '../for-both/popups/ErrorPopup';
import GlassButton from '../look-and-feel/GlassButton';
import { Liquid } from '../look-and-feel/glassSettings';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppLogo from '../for-both/icons/AppLogo';
import { cachePendingSignupProfile } from './decideTraineeOrTrainer';
import NbButton from '../look-and-feel/NbButton';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import HardShadow from '../look-and-feel/HardShadow';
import {
  nb,
  lightColors,
  darkColors,
  borderRadius,
  spacing,
  accentGradients,
} from '../look-and-feel/colorPalette';

// Digs the Google tokens out of an OAuth response, whichever shape it arrived in.
// Why this is messy: expo-auth-session returns tokens camelCase on `authentication`, snake_case on
// `params`, and in the installed-app flow they only appear after an async code exchange. Checking
// all four spellings is cheaper than guessing which flow ran.
// vocab: idToken = the signed proof of WHO the user is (this is what Firebase needs).
// vocab: accessToken = permission to call Google APIs on their behalf (optional for us).
// ===== NAMED CONSTANTS =====

const MIN_NAME_LENGTH = 2;
const MIN_PASSWORD_LENGTH = 8;
const THEME_ANIM_MS = 250;
const PROFILE_IMAGE_QUALITY = 0.8;
const GOOGLE_OAUTH_TIMEOUT_MS = 1000;
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const NEW_ACCOUNT_WINDOW_DAYS = 7;
const NEW_ACCOUNT_WINDOW_MS =
  NEW_ACCOUNT_WINDOW_DAYS * HOURS_PER_DAY * MINUTES_PER_HOUR * SECONDS_PER_MINUTE * MS_PER_SECOND;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ===== HELPER FUNCTIONS =====

function extractGoogleOAuthTokens(authentication, params = {}) {
  const idToken =
    authentication?.idToken ||
    authentication?.id_token ||
    params.id_token ||
    params.idToken;
  const accessToken =
    authentication?.accessToken ||
    authentication?.access_token ||
    params.access_token ||
    params.accessToken ||
    null;
  return { idToken, accessToken };
}

/**
 * iOS Google OAuth clients require the reversed-client-id redirect, not {bundleId}:/oauthredirect.
 * @see https://developers.google.com/identity/sign-in/ios/start-integrating
 */
function getGoogleIosOAuthRedirectUri(iosClientId) {
  if (Platform.OS !== 'ios' || !iosClientId) return undefined;
  const prefix = String(iosClientId).replace(/\.apps\.googleusercontent\.com$/i, '').trim();
  if (!prefix) return undefined;
  return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
}

function buildAppleDisplayName(appleCredential) {
  const fullName = appleCredential?.fullName;
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/** Auth + onboarding CTA (dark pink → dark orange) */
const AUTH_CTA_GRADIENT = ['#C1265A', '#D84315'];

/** Shown when Client/Trainer toggle does not match the account's role in Firestore */
const ROLE_MISMATCH_TITLE = 'Wrong account type';
const ROLE_MISMATCH_MESSAGE =
  'The account you entered is on the opposite side. Please change the Client / Trainer toggle at the top to match your account, then try again.';
const ROLE_MISMATCH_NEXT_VIEW_KEY = 'auth_role_mismatch_next_view';
let roleMismatchNextViewInMemory = null;

const GOOGLE_OAUTH_NOT_READY_TITLE = 'Google Sign-In Not Ready';
const GOOGLE_OAUTH_NOT_READY_MESSAGE =
  'Google Sign-In is not configured. Please check:\n\n1. Firebase Console > Authentication > Sign-in methods > Enable Google\n2. Google Cloud Console > OAuth consent screen\n3. Add authorized domains';

async function readNormalizedFirestoreRole(uid) {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const raw = snap.data()?.role;
    if (raw == null || String(raw).trim() === '') return null;
    const roleText = String(raw).toLowerCase().trim();
    if (roleText === 'trainer') return 'trainer';
    if (roleText === 'client') return 'client';
    return null;
  } catch (e) {
    console.warn('readNormalizedFirestoreRole:', e?.message || e);
    return null;
  }
}

const googleIcon = require('../assets/icons/Illustration-of-Google-icon-on-transparent-background-PNG.png');
const appleLogo = require('../assets/icons/apple-logo.png');

const AUTH_FONT_ROUNDED = Platform.OS === 'ios' ? 'SF Pro Rounded' : 'System';

const THEME_KEY = 'coachconnect-theme';

// Design Law auth surfaces — map landing toggle onto nb* tokens (fill flips in dark).
const DARK = {
  bg: darkColors.nbBackground,
  surface: darkColors.nbSurface,
  fill: darkColors.nbFill,
  onFill: darkColors.nbOnFill,
  ink: darkColors.nbInk,
  muted: darkColors.nbMuted,
  border: darkColors.nbBorder,
  shadow: darkColors.nbShadow,
  soft: darkColors.nbSoft,
  heading: darkColors.nbInk,
  subtitle: darkColors.nbMuted,
  toggleBg: darkColors.nbSurface,
  toggleBorder: darkColors.nbBorder,
  toggleIcon: darkColors.nbInk,
  signinMuted: darkColors.nbMuted,
  signinLink: darkColors.nbInk,
};

const LIGHT = {
  bg: lightColors.nbBackground,
  surface: lightColors.nbSurface,
  fill: lightColors.nbFill,
  onFill: lightColors.nbOnFill,
  ink: lightColors.nbInk,
  muted: lightColors.nbMuted,
  border: lightColors.nbBorder,
  shadow: lightColors.nbShadow,
  soft: lightColors.nbSoft,
  heading: lightColors.nbInk,
  subtitle: lightColors.nbMuted,
  toggleBg: lightColors.nbSurface,
  toggleBorder: lightColors.nbBorder,
  toggleIcon: lightColors.nbInk,
  signinMuted: lightColors.nbMuted,
  signinLink: lightColors.nbInk,
};

// Manipulate here: welcome ticker copy under the black wordmark poster
const WELCOME_TICKER = 'One Day or Day One!  |  One Day or Day One!  |  One Day or Day One!';
const PASSWORD_RULE_LENGTH = '8+ characters';
const PASSWORD_RULE_LETTER = 'A letter';
const PASSWORD_RULE_NUMBER = 'A number';
// Strength bar accent — Design Law allows pink→orange on small fills only
const PASSWORD_STRENGTH_GRADIENT = accentGradients[0];



function nameFieldError(nameValue) {
  const trimmedName = nameValue.trim();
  if (!trimmedName) return 'Name is required';
  if (trimmedName.length < MIN_NAME_LENGTH) return 'Name must be at least 2 characters';
  return null;
}

function emailFieldError(emailValue) {
  const trimmedEmail = emailValue.trim();
  if (!trimmedEmail) return 'Email is required';
  if (!EMAIL_PATTERN.test(trimmedEmail)) return 'Please enter a valid email address';
  return null;
}

function passwordFieldError(passwordValue) {
  if (!passwordValue) return 'Password is required';
  if (passwordValue.length < MIN_PASSWORD_LENGTH) return 'Password must be at least 8 characters';
  const hasLetter = /[A-Za-z]/.test(passwordValue);
  const hasNumber = /[0-9]/.test(passwordValue);
  if (!hasLetter || !hasNumber) return 'Password must include at least one letter and one number';
  return null;
}

// Design Law create-account chips + strength bar — same rules as passwordFieldError
function passwordRuleChecks(passwordValue) {
  const value = String(passwordValue || '');
  return {
    lengthOk: value.length >= MIN_PASSWORD_LENGTH,
    letterOk: /[A-Za-z]/.test(value),
    numberOk: /[0-9]/.test(value),
  };
}

function confirmPasswordFieldError(passwordValue, confirmValue) {
  if (!confirmValue) return 'Please confirm your password';
  if (passwordValue !== confirmValue) return 'Passwords do not match';
  return null;
}

function collectSignupErrors({ name, email, password, confirmPassword }) {
  const errors = {};
  const nameError = nameFieldError(name);
  if (nameError) errors.name = nameError;
  const emailError = emailFieldError(email);
  if (emailError) errors.email = emailError;
  const passwordError = passwordFieldError(password);
  if (passwordError) errors.password = passwordError;
  const confirmError = confirmPasswordFieldError(password, confirmPassword);
  if (confirmError) errors.confirmPassword = confirmError;
  return errors;
}

function collectLoginErrors({ loginEmail, loginPassword }) {
  const errors = {};
  const emailError = emailFieldError(loginEmail);
  if (emailError) errors.email = emailError;
  if (!loginPassword) errors.password = 'Password is required';
  return errors;
}

function messageForSignupAuthError(error) {
  if (error?.code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (error?.code === 'auth/invalid-email') return 'Invalid email address.';
  if (error?.code === 'auth/weak-password') return 'Password is too weak. Please use a stronger password.';
  return error?.message || 'Failed to create account. Please try again.';
}

function messageForGoogleSignUpError(error) {
  let errorMessage = 'Failed to sign up with Google. ';
  if (error?.code === 'auth/account-exists-with-different-credential') {
    return errorMessage + 'An account already exists with this email. Please sign in instead.';
  }
  if (error?.code === 'auth/operation-not-allowed') {
    return errorMessage + 'Google Sign-In is not enabled. Please enable it in Firebase Console > Authentication > Sign-in methods.';
  }
  if (error?.message?.includes('blocked') || error?.message?.includes('disabled')) {
    return errorMessage + 'Google Sign-In is blocked. Please check:\n1. Firebase Console > Authentication > Sign-in methods > Enable Google\n2. Google Cloud Console > OAuth consent screen is configured\n3. Authorized domains include your app domain';
  }
  return errorMessage + (error?.message || 'Please try again.');
}

function messageForGoogleSignInError(error) {
  let errorMessage = 'Failed to sign in with Google. ';
  if (error?.code === 'auth/account-exists-with-different-credential') {
    return errorMessage + 'An account already exists with this email. Please sign in with email/password first.';
  }
  if (error?.code === 'auth/popup-blocked') {
    return errorMessage + 'Popup was blocked. Please allow popups and try again.';
  }
  if (error?.code === 'auth/popup-closed-by-user') {
    return errorMessage + 'Sign-in was cancelled.';
  }
  if (error?.code === 'auth/operation-not-allowed') {
    return errorMessage + 'Google Sign-In is not enabled. Please enable it in Firebase Console > Authentication > Sign-in methods.';
  }
  if (error?.message?.includes('blocked') || error?.message?.includes('disabled')) {
    return errorMessage + 'Google Sign-In is blocked. Please check:\n1. Firebase Console > Authentication > Sign-in methods > Enable Google\n2. Google Cloud Console > OAuth consent screen is configured\n3. Authorized domains include your app domain';
  }
  return errorMessage + (error?.message || 'Please try again.');
}

function messageForAppleAuthError(error, mode) {
  let errorMessage =
    mode === 'signup' ? 'Failed to sign up with Apple. ' : 'Failed to sign in with Apple. ';
  if (error?.code === 'auth/account-exists-with-different-credential') {
    return errorMessage + 'An account already exists with this email. Try email/password or the other sign-in method.';
  }
  if (error?.code === 'auth/operation-not-allowed') {
    return errorMessage + 'Apple Sign-In is not enabled. Enable it in Firebase Console > Authentication > Sign-in methods.';
  }
  return errorMessage + (error?.message || 'Please try again.');
}

function onboardingIsExplicitlyIncomplete(existing) {
  if (existing.onboardingCompleted === false) return true;
  if (existing.onboardingCompleted === 'false') return true;
  if (existing.onboardingCompleted === 0) return true;
  return false;
}

function accountCreatedRecently(existing) {
  const createdMs = existing.createdAt ? new Date(existing.createdAt).getTime() : NaN;
  if (!Number.isFinite(createdMs)) return false;
  return Date.now() - createdMs < NEW_ACCOUNT_WINDOW_MS;
}

function recentProviderWithoutOnboarding(existing, authProvider) {
  if (existing.authProvider !== authProvider) return false;
  if (existing.onboardingCompletedAt) return false;
  if (existing.onboardingCompleted === true) return false;
  if (existing.onboardingCompleted === 'true') return false;
  if (existing.onboardingCompleted === 1) return false;
  return accountCreatedRecently(existing);
}

async function routeIncompleteSocialUser({
  existing,
  authProvider,
  userRef,
  user,
  fallbackRole,
  onSignupSuccess,
}) {
  const explicitlyIncomplete = onboardingIsExplicitlyIncomplete(existing);
  const recentWithoutOnboarding = recentProviderWithoutOnboarding(existing, authProvider);
  if (!explicitlyIncomplete && !recentWithoutOnboarding) return false;
  if (recentWithoutOnboarding && !explicitlyIncomplete) {
    await setDoc(userRef, { onboardingCompleted: false }, { merge: true });
  }
  if (!onSignupSuccess) return false;
  onSignupSuccess(user, existing.role || fallbackRole);
  return true;
}

async function createNewGoogleUserDoc({ user, role, AsyncStorage, includeInviteTitle }) {
  const photoURL = user.photoURL || null;
  await cachePendingSignupProfile(user.uid, role, AsyncStorage);
  const userPayload = {
    uid: user.uid,
    email: user.email || '',
    name: user.displayName || 'User',
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
    authProvider: 'google',
    photoURL,
  };
  if (includeInviteTitle) userPayload.title = 'Coach Connect Invite Code';
  await setDoc(doc(db, 'users', user.uid), userPayload);
  if (role === 'trainer' && photoURL) {
    await setDoc(
      doc(db, 'trainers', user.uid),
      { photoURL, avatarUrl: photoURL },
      { merge: true },
    );
  }
}

async function createNewAppleUserDoc({
  user,
  role,
  AsyncStorage,
  resolvedName,
  resolvedEmail,
  includeInviteTitle,
}) {
  await cachePendingSignupProfile(user.uid, role, AsyncStorage);
  const userPayload = {
    uid: user.uid,
    email: resolvedEmail,
    name: resolvedName,
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
    authProvider: 'apple',
    photoURL: includeInviteTitle ? null : user.photoURL || null,
  };
  if (includeInviteTitle) userPayload.title = 'Coach Connect Invite Code';
  await setDoc(doc(db, 'users', user.uid), userPayload);
}

async function finishExistingGoogleSignup(user, role, userRef, ensureRoleMatchesToggle) {
  const roleMatches = await ensureRoleMatchesToggle(user.uid, role);
  if (!roleMatches) return false;
  await setDoc(userRef, { updatedAt: new Date().toISOString() }, { merge: true });
  return true;
}

async function finishExistingSocialLogin({
  user,
  role,
  userRef,
  existing,
  authProvider,
  ensureRoleMatchesToggle,
  onSignupSuccess,
}) {
  const roleOk = await ensureRoleMatchesToggle(user.uid, role);
  if (!roleOk) return { stopped: true };
  const routedToOnboarding = await routeIncompleteSocialUser({
    existing,
    authProvider,
    userRef,
    user,
    fallbackRole: role,
    onSignupSuccess,
  });
  if (routedToOnboarding) return { stopped: true };
  await setDoc(userRef, { updatedAt: new Date().toISOString() }, { merge: true });
  return { stopped: false };
}

async function finishAppleSignupMode({
  userDoc,
  user,
  role,
  userRef,
  AsyncStorage,
  resolvedName,
  resolvedEmail,
  ensureRoleMatchesToggle,
  onSignupSuccess,
}) {
  if (!userDoc.exists()) {
    await createNewAppleUserDoc({
      user,
      role,
      AsyncStorage,
      resolvedName,
      resolvedEmail,
      includeInviteTitle: false,
    });
    console.log('New user created with Apple sign-up:', resolvedEmail || user.uid, 'Role:', role);
  } else {
    const roleOk = await ensureRoleMatchesToggle(user.uid, role);
    if (!roleOk) return;
    await setDoc(userRef, { updatedAt: new Date().toISOString() }, { merge: true });
    console.log('Existing user signed in with Apple:', resolvedEmail || user.uid);
  }
  if (onSignupSuccess) onSignupSuccess(user, role);
}

async function finishAppleLoginMode({
  userDoc,
  user,
  role,
  userRef,
  AsyncStorage,
  resolvedName,
  resolvedEmail,
  ensureRoleMatchesToggle,
  onSignupSuccess,
  onLoginSuccess,
}) {
  if (userDoc.exists()) {
    const result = await finishExistingSocialLogin({
      user,
      role,
      userRef,
      existing: userDoc.data() || {},
      authProvider: 'apple',
      ensureRoleMatchesToggle,
      onSignupSuccess,
    });
    if (result.stopped) return;
  } else {
    await createNewAppleUserDoc({
      user,
      role,
      AsyncStorage,
      resolvedName,
      resolvedEmail,
      includeInviteTitle: true,
    });
    console.log('New user created via Apple sign-in — routing to onboarding');
    if (onSignupSuccess) {
      onSignupSuccess(user, role);
      return;
    }
  }
  console.log('Apple sign-in successful:', resolvedEmail || user.uid);
  if (onLoginSuccess) onLoginSuccess(user);
}

async function storeAppleAuthCodeBestEffort(authorizationCode) {
  if (!authorizationCode) return;
  try {
    const storeApple = httpsCallable(functions, 'storeAppleAuthForRevoke');
    await storeApple({ authorizationCode });
  } catch (storeErr) {
    if (__DEV__) console.warn('storeAppleAuthForRevoke:', storeErr?.message || storeErr);
  }
}

async function applyAppleDisplayName(user, appleResult) {
  const appleDisplayName = buildAppleDisplayName(appleResult);
  if (!(appleDisplayName && !user.displayName)) {
    return appleDisplayName || user.displayName || 'User';
  }
  try {
    await updateProfile(user, { displayName: appleDisplayName });
  } catch (profileErr) {
    console.warn('Apple updateProfile displayName:', profileErr?.message || profileErr);
  }
  return appleDisplayName || user.displayName || 'User';
}

async function signInWithGoogleCredential(authentication) {
  const params = authentication?.params || {};
  const { idToken, accessToken } = extractGoogleOAuthTokens(authentication, params);
  const id_token = authentication?.id_token ?? idToken;
  const access_token = authentication?.access_token ?? accessToken;
  if (!id_token) throw new Error('No ID token received from Google');
  const credential = GoogleAuthProvider.credential(id_token, access_token);
  return signInWithCredential(auth, credential);
}

async function runGoogleSignUpFlow({ authentication, role, AsyncStorage, ensureRoleMatchesToggle, onSignupSuccess }) {
  const userCredential = await signInWithGoogleCredential(authentication);
  const userRef = doc(db, 'users', userCredential.user.uid);
  const userDoc = await getDoc(userRef);
  if (!userDoc.exists()) {
    await createNewGoogleUserDoc({
      user: userCredential.user,
      role,
      AsyncStorage,
      includeInviteTitle: false,
    });
  } else {
    const keptGoing = await finishExistingGoogleSignup(
      userCredential.user,
      role,
      userRef,
      ensureRoleMatchesToggle,
    );
    if (!keptGoing) return;
  }
  if (onSignupSuccess) onSignupSuccess(userCredential.user, role);
}

async function runGoogleSignInFlow({
  authentication,
  role,
  AsyncStorage,
  ensureRoleMatchesToggle,
  onSignupSuccess,
  onLoginSuccess,
}) {
  const userCredential = await signInWithGoogleCredential(authentication);
  const userRef = doc(db, 'users', userCredential.user.uid);
  const userDoc = await getDoc(userRef);
  if (userDoc.exists()) {
    const result = await finishExistingSocialLogin({
      user: userCredential.user,
      role,
      userRef,
      existing: userDoc.data() || {},
      authProvider: 'google',
      ensureRoleMatchesToggle,
      onSignupSuccess,
    });
    if (result.stopped) return;
  } else {
    await createNewGoogleUserDoc({
      user: userCredential.user,
      role,
      AsyncStorage,
      includeInviteTitle: true,
    });
    console.log('New user created via Google sign-in — routing to onboarding');
    if (onSignupSuccess) {
      onSignupSuccess(userCredential.user, role);
      return;
    }
  }
  console.log('Google sign-in successful:', userCredential.user.email);
  if (onLoginSuccess) onLoginSuccess(userCredential.user);
}

async function signInWithAppleCredential() {
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    const unavailableError = new Error('Apple Sign-In is not available on this device.');
    unavailableError.code = 'apple_unavailable';
    throw unavailableError;
  }
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );
  const appleResult = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });
  if (!appleResult?.identityToken) {
    throw new Error('No identity token received from Apple');
  }
  const provider = new OAuthProvider('apple.com');
  const firebaseCredential = provider.credential({
    idToken: appleResult.identityToken,
    rawNonce,
  });
  const userCredential = await signInWithCredential(auth, firebaseCredential);
  return { userCredential, appleResult };
}

async function runAppleAuthFlow({
  mode,
  role,
  AsyncStorage,
  ensureRoleMatchesToggle,
  onSignupSuccess,
  onLoginSuccess,
}) {
  const { userCredential, appleResult } = await signInWithAppleCredential();
  await storeAppleAuthCodeBestEffort(appleResult?.authorizationCode);
  const resolvedName = await applyAppleDisplayName(userCredential.user, appleResult);
  const resolvedEmail = userCredential.user.email || appleResult.email || '';
  const userRef = doc(db, 'users', userCredential.user.uid);
  const userDoc = await getDoc(userRef);
  if (mode === 'signup') {
    await finishAppleSignupMode({
      userDoc,
      user: userCredential.user,
      role,
      userRef,
      AsyncStorage,
      resolvedName,
      resolvedEmail,
      ensureRoleMatchesToggle,
      onSignupSuccess,
    });
    return;
  }
  await finishAppleLoginMode({
    userDoc,
    user: userCredential.user,
    role,
    userRef,
    AsyncStorage,
    resolvedName,
    resolvedEmail,
    ensureRoleMatchesToggle,
    onSignupSuccess,
    onLoginSuccess,
  });
}

function splitSpecializationList(specializationsText) {
  return specializationsText
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

async function uploadTrainerProfilePhotoIfNeeded({ profileImageUri, role, user, displayName }) {
  if (!(profileImageUri && role === 'trainer')) {
    await updateProfile(user, { displayName });
    return null;
  }
  const uploadResult = await uploadProfileImage(user.uid, { uri: profileImageUri });
  if (!uploadResult.success) return null;
  const photoURL = uploadResult.downloadURL;
  await updateProfile(user, { displayName, photoURL });
  return photoURL;
}

function buildEmailSignupUserData({ name, email, role, bio, credentials, specializations, location, photoURL }) {
  const userData = {
    name: name.trim(),
    email: email.trim(),
    onboardingCompleted: false,
    createdAt: new Date().toISOString(),
  };
  if (role === 'trainer') {
    userData.bio = bio.trim();
    userData.credentials = credentials.trim();
    userData.specializations = splitSpecializationList(specializations);
    userData.location = location.trim();
  }
  if (photoURL) userData.photoURL = photoURL;
  return userData;
}

// Design Law field: caps label + 3px outlined input (+ optional SHOW for passwords).
// vocab: secureTextEntry = RN hides glyphs; we flip it with the SHOW control, not a separate field.
function AuthField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  showSecureToggle = false,
  secureVisible = false,
  onToggleSecure,
  keyboardType = 'default',
  autoCapitalize = 'none',
  theme,
  accessibilityLabel,
  errorText,
  dashedError = false,
}) {
  const hideText = secureTextEntry && !secureVisible;
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={[authUiStyles.fieldLabel, { color: theme.muted }]}>{label}</Text>
      <View
        style={[
          authUiStyles.fieldShell,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
            shadowColor: theme.shadow,
            borderStyle: dashedError ? 'dashed' : 'solid',
          },
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.muted}
          secureTextEntry={hideText}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={accessibilityLabel || label}
          style={[authUiStyles.fieldInput, { color: theme.ink, flex: 1 }]}
        />
        {showSecureToggle ? (
          <TouchableOpacity
            onPress={onToggleSecure}
            accessibilityRole="button"
            accessibilityLabel={secureVisible ? 'Hide password' : 'Show password'}
            style={[authUiStyles.showBtn, { backgroundColor: theme.soft, borderLeftColor: theme.border }]}
            activeOpacity={0.85}
          >
            <Text style={[authUiStyles.showBtnText, { color: theme.ink }]}>
              {secureVisible ? 'HIDE' : 'SHOW'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {errorText ? (
        <View style={authUiStyles.errorRow}>
          <View style={[authUiStyles.errorDot, { borderColor: theme.border, backgroundColor: theme.fill }]}>
            <Text style={[authUiStyles.errorBang, { color: theme.onFill }]}>!</Text>
          </View>
          <Text style={[authUiStyles.errorCopy, { color: theme.ink }]}>{errorText}</Text>
        </View>
      ) : null}
    </View>
  );
}

// Design Law role segmented — selected = solid fill (black/white), not pink gradient.
function RoleToggle({ role, onRoleChange, theme }) {
  const tabs = [
    { id: 'client', label: 'I am a client' },
    { id: 'trainer', label: 'I am a trainer' },
  ];
  return (
    <View
      style={[
        authUiStyles.roleTabs,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          shadowColor: theme.shadow,
        },
      ]}
    >
      {tabs.map((tab) => {
        const selected = role === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.88}
            onPress={() => onRoleChange(tab.id)}
            style={[
              authUiStyles.roleTabCell,
              selected ? { backgroundColor: theme.fill } : null,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text
              style={[
                authUiStyles.roleTabLabel,
                { color: selected ? theme.onFill : theme.ink },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Square theme chip — matches welcome PNG moon control (HardShadow, 3px).
function ThemeToggleChip({ isDarkLanding, onPress, theme }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={isDarkLanding ? 'Switch to light mode' : 'Switch to dark mode'}
      style={[
        authUiStyles.themeChip,
        {
          borderColor: theme.border,
          backgroundColor: theme.surface,
          shadowColor: theme.shadow,
        },
      ]}
    >
      <Ionicons
        name={isDarkLanding ? 'sunny-outline' : 'moon-outline'}
        size={20}
        color={theme.toggleIcon}
      />
    </TouchableOpacity>
  );
}

function AuthOrDivider({ label, theme }) {
  return (
    <View style={authUiStyles.orRow}>
      <View style={[authUiStyles.orLine, { backgroundColor: theme.border }]} />
      <Text style={[authUiStyles.orText, { color: theme.muted }]}>{label}</Text>
      <View style={[authUiStyles.orLine, { backgroundColor: theme.border }]} />
    </View>
  );
}

function SocialAuthRow({
  onApple,
  onGoogle,
  appleLogoSource,
  googleIconSource,
  disabled,
  theme,
  appleBusy,
}) {
  return (
    <View style={authUiStyles.socialRow}>
      {Platform.OS === 'ios' ? (
        <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton} style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={onApple}
            activeOpacity={0.85}
            disabled={disabled || appleBusy}
            style={[
              authUiStyles.socialBtn,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
                opacity: disabled || appleBusy ? 0.6 : 1,
              },
            ]}
          >
            <Image
              source={appleLogoSource}
              style={{ width: 18, height: 18, resizeMode: 'contain', tintColor: theme.ink }}
            />
            <Text style={[authUiStyles.socialLabel, { color: theme.ink }]}>Apple</Text>
          </TouchableOpacity>
        </HardShadow>
      ) : null}
      <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton} style={{ flex: 1 }}>
        <TouchableOpacity
          onPress={onGoogle}
          activeOpacity={0.85}
          disabled={disabled}
          style={[
            authUiStyles.socialBtn,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              opacity: disabled ? 0.6 : 1,
            },
          ]}
        >
          <Image source={googleIconSource} style={{ width: 18, height: 18, resizeMode: 'contain' }} />
          <Text style={[authUiStyles.socialLabel, { color: theme.ink }]}>Google</Text>
        </TouchableOpacity>
      </HardShadow>
    </View>
  );
}

function PasswordRuleChips({ password, theme }) {
  const rules = passwordRuleChecks(password);
  const chips = [
    { key: 'len', label: PASSWORD_RULE_LENGTH, ok: rules.lengthOk },
    { key: 'letter', label: PASSWORD_RULE_LETTER, ok: rules.letterOk },
    { key: 'number', label: PASSWORD_RULE_NUMBER, ok: rules.numberOk },
  ];
  const passed = chips.filter((c) => c.ok).length;
  // Manipulate here: strength fill grows with each rule met (0 / 33 / 66 / 100%)
  const strengthPct = (passed / chips.length) * 100;

  return (
    <View style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
      <View style={authUiStyles.ruleChipRow}>
        {chips.map((chip) => (
          <View
            key={chip.key}
            style={[
              authUiStyles.ruleChip,
              {
                borderColor: theme.border,
                backgroundColor: chip.ok ? theme.fill : theme.surface,
              },
            ]}
          >
            <Text
              style={[
                authUiStyles.ruleChipText,
                { color: chip.ok ? theme.onFill : theme.ink },
              ]}
              numberOfLines={1}
            >
              {chip.ok ? `✓ ${chip.label}` : chip.label}
            </Text>
          </View>
        ))}
      </View>
      <View
        style={[
          authUiStyles.strengthTrack,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <LinearGradient
          colors={PASSWORD_STRENGTH_GRADIENT}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[authUiStyles.strengthFill, { width: `${Math.max(strengthPct, 4)}%` }]}
        />
      </View>
    </View>
  );
}

function AuthTextLink({ prefix, actionLabel, onPress, theme }) {
  return (
    <View style={authUiStyles.linkRow}>
      {prefix ? <Text style={[authUiStyles.linkPrefix, { color: theme.signinMuted }]}>{prefix}</Text> : null}
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Text style={[authUiStyles.linkAction, { color: theme.signinLink, borderBottomColor: theme.border }]}>
          {actionLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const authUiStyles = StyleSheet.create({
  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  fieldShell: {
    minHeight: 52,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  fieldInput: {
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 14,
    paddingRight: 12,
  },
  showBtn: {
    minWidth: 64,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderLeftWidth: nb.borderWidth,
  },
  showBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  errorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBang: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 12,
  },
  errorCopy: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  roleTabs: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 10,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  roleTabCell: {
    flex: 1,
    minHeight: nb.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  roleTabLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  themeChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.md,
  },
  orLine: { flex: 1, height: 2 },
  orText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: spacing.lg,
  },
  socialBtn: {
    height: 52,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  socialLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  ruleChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  ruleChip: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ruleChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  strengthTrack: {
    height: 14,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  linkPrefix: {
    fontSize: 14,
    fontWeight: '600',
  },
  linkAction: {
    fontSize: 14,
    fontWeight: '900',
    borderBottomWidth: 3,
    paddingBottom: 1,
  },
});

function OrSeparator({ isDark, label = 'OR' }) {
  return (
    <View style={stylesLiquidAuth.orRow}>
      <View style={[stylesLiquidAuth.orLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]} />
      <Text style={[stylesLiquidAuth.orText, { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }]}>{label}</Text>
      <View style={[stylesLiquidAuth.orLine, { backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)' }]} />
    </View>
  );
}

function LiquidRolePill({ selected, onPress, label, iconSource, isDark }) {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress} style={[stylesLiquidAuth.rolePillHit, selected && stylesLiquidAuth.rolePillHitSelected]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.00)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={stylesLiquidAuth.rolePillStroke}
      >
        <View
          style={[
            stylesLiquidAuth.rolePillSurface,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.62)',
              borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          {selected ? (
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(0,229,255,0.16)', 'rgba(109,40,217,0.12)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFillObject, { borderRadius: 16 }]}
            />
          ) : null}
          {iconSource ? <Image source={iconSource} style={stylesLiquidAuth.rolePillIcon} /> : null}
          <Text
            style={[
              stylesLiquidAuth.rolePillText,
              { color: isDark ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.88)' },
              selected && { color: isDark ? lightColors.white : 'rgba(15,23,42,0.92)' },
            ]}
          >
            {label}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function LiquidAuthField({
  label,
  value,
  onChangeText,
  placeholder,
  placeholderTextColor,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  textContentType,
  returnKeyType,
  multiline,
  numberOfLines,
  isDark,
  focused,
  onFocus,
  onBlur,
}) {
  return (
    <View style={stylesLiquidAuth.fieldWrap}>
      <LinearGradient
        colors={isDark ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.00)'] : ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.00)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={[stylesLiquidAuth.fieldStroke, focused && { borderColor: 'transparent' }]}
      >
        <View
          style={[
            stylesLiquidAuth.fieldSurface,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
              shadowColor: focused ? Liquid.colors.cyan : '#000',
              shadowOpacity: focused ? (isDark ? 0.35 : 0.18) : 0,
            },
          ]}
        >
          {/* inner shadow for "carved" feel */}
          <LinearGradient
            pointerEvents="none"
            colors={isDark ? ['rgba(0,0,0,0.32)', 'rgba(0,0,0,0.00)'] : ['rgba(15,23,42,0.10)', 'rgba(15,23,42,0.00)']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={stylesLiquidAuth.fieldInnerShadow}
          />

          <Text style={[stylesLiquidAuth.fieldLabel, { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)' }]}>
            {label}
          </Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={placeholderTextColor}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            textContentType={textContentType}
            returnKeyType={returnKeyType}
            multiline={multiline}
            numberOfLines={numberOfLines}
            onFocus={onFocus}
            onBlur={onBlur}
            style={[stylesLiquidAuth.fieldInput, { color: isDark ? 'rgba(255,255,255,0.87)' : 'rgba(15,23,42,0.92)' }]}
          />
        </View>
      </LinearGradient>
    </View>
  );
}

function SocialGlassButton({
  title,
  iconSource,
  onPress,
  isDark,
  preserveColors = true,
  iconHalo = null, // { bg: 'rgba(...)', border: 'rgba(...)', opacity: number }
}) {
  return (
    <GlassCard
      onPress={onPress}
      radius={Liquid.radius.inner}
      blurIntensity={28}
      strokeColors={isDark ? ['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.00)'] : ['rgba(0,0,0,0.10)', 'rgba(0,0,0,0.00)']}
      contentStyle={[
        stylesLiquidAuth.socialSurface,
        { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.80)' },
      ]}
      style={stylesLiquidAuth.socialHit}
    >
      <View style={stylesLiquidAuth.socialRow}>
        <View style={stylesLiquidAuth.socialIconSlot}>
          {iconHalo ? (
            <View
              pointerEvents="none"
              style={[
                stylesLiquidAuth.iconHalo,
                {
                  backgroundColor: iconHalo.bg,
                  borderColor: iconHalo.border,
                  opacity: typeof iconHalo.opacity === 'number' ? iconHalo.opacity : 1,
                },
              ]}
            />
          ) : null}
          <Image source={iconSource} style={stylesLiquidAuth.socialIcon} />
        </View>
        <Text style={[stylesLiquidAuth.socialText, { color: isDark ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.90)' }]}>
          {title}
        </Text>
      </View>
    </GlassCard>
  );
}

// ===== MAIN FUNCTION =====

export default function LoginScreen({ onSignupSuccess, onLoginSuccess, onForgotPasswordFlowPress }) {
  const { colors, typography, spacing, isDark, themeMode = 'light', toggleTheme: togglelightDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    try {
      WebBrowser.maybeCompleteAuthSession();
    } catch (_) {
      /* non-fatal — defer avoids TurboModule crash during cold start on iOS 26 */
    }
  }, []);

  const [focusedField, setFocusedField] = useState(null);
  const [currentView, setCurrentView] = useState(() => roleMismatchNextViewInMemory || 'welcome'); // 'welcome' | 'signup' | 'login'
  const [selectedRole, setSelectedRole] = useState('client'); // 'trainer' | 'client'
  // First paint / first login: light — Design Law pops harder in light; user can flip to dark.
  const [isDarkLanding, setIsDarkLanding] = useState(false);
  const bgAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      // Manipulate here: null = first visit → light (not dark)
      const dark = val === 'dark';
      setIsDarkLanding(dark);
      togglelightDarkMode?.(dark ? 'dark' : 'light');
      bgAnim.setValue(dark ? 1 : 0);
    });
  }, []);

  useEffect(() => {
    // If we just bounced due to client/trainer role mismatch, keep them on the sign-in view.
    AsyncStorage.getItem(ROLE_MISMATCH_NEXT_VIEW_KEY)
      .then((val) => {
        if (val === 'login') setCurrentView('login');
      })
      .finally(() => {
        roleMismatchNextViewInMemory = null;
        AsyncStorage.removeItem(ROLE_MISMATCH_NEXT_VIEW_KEY).catch(() => {});
      });
  }, []);

  const toggleTheme = () => {
    const next = !isDarkLanding;
    setIsDarkLanding(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
    // Sync lightDarkMode so Signup (and any shared UI) matches Welcome toggle.
    togglelightDarkMode?.(next ? 'dark' : 'light');
    RNAnimated.timing(bgAnim, {
      toValue: next ? 1 : 0,
      duration: THEME_ANIM_MS,
      useNativeDriver: false,
    }).start();
  };

  const landingTheme = isDarkLanding ? DARK : LIGHT;

  const animatedBg = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [LIGHT.bg, DARK.bg],
  });

  const onGetStarted = () => setCurrentView('signup');
  const onSignIn = () => setCurrentView('login');

  // Signup state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('client');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupErrors, setSignupErrors] = useState({});
  // Design Law SHOW toggles — passwords stay masked until the user taps SHOW
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [bio, setBio] = useState('');
  const [credentials, setCredentials] = useState('');
  const [specializations, setSpecializations] = useState('');
  const [location, setLocation] = useState('');
  const [profileImageUri, setProfileImageUri] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginErrors, setLoginErrors] = useState({});

  const [errorModal, setErrorPopup] = useState(null);

  const ensureRoleMatchesToggle = useCallback(async (uid, selectedRole) => {
    const expected = selectedRole === 'trainer' ? 'trainer' : 'client';
    const actual = await readNormalizedFirestoreRole(uid);
    if (actual == null) {
      console.log('[Auth] No role on user profile; skipping Client/Trainer login gate');
      return true;
    }
    if (actual === expected) return true;
    console.log('[Auth] Login role mismatch — profile:', actual, 'toggle:', selectedRole);
    try {
      roleMismatchNextViewInMemory = 'login';
      await AsyncStorage.setItem(ROLE_MISMATCH_NEXT_VIEW_KEY, 'login').catch(() => {});
      await signOut(auth);
    } catch (e) {
      console.warn('signOut after role mismatch:', e?.message || e);
    }
    setErrorPopup({ title: ROLE_MISMATCH_TITLE, message: ROLE_MISMATCH_MESSAGE });
    return false;
  }, []);

  // Social auth loading + error
  const [isLoadingApple, setIsLoadingApple] = useState(false);
  const [isLoadingGoogle, setIsLoadingGoogle] = useState(false);

  // Google OAuth configuration (shared for signup and login)
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleRedirectUri = useMemo(
    () => getGoogleIosOAuthRedirectUri(googleIosClientId),
    [googleIosClientId]
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    iosClientId: googleIosClientId,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: googleRedirectUri,
  });

  if (__DEV__ && request) {
    console.log('Google OAuth redirect URI:', request.redirectUri);
    console.log('Google OAuth code challenge:', request.codeChallenge);
  }

  /** Latest screen for Google OAuth callback (signup vs login) */
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const handleGoogleSignUpRef = useRef(async () => {});
  const handleGoogleSignInRef = useRef(async () => {});

  useEffect(() => {
    if (!response) return;

    if (response.type === 'cancel' || response.type === 'dismiss') {
      console.log('Google OAuth cancelled/dismissed by user');
      setIsLoadingGoogle(false);
      setSignupLoading(false);
      setLoginLoading(false);
      return;
    }

    if (response.type === 'error') {
      setIsLoadingGoogle(false);
      setSignupLoading(false);
      setLoginLoading(false);
      console.error('Google OAuth error:', {
        error: response.error,
        description: response.params?.error_description,
        redirectUri: request?.redirectUri,
      });
      setErrorPopup({
        title: 'Google Sign-In',
        message: 'Google sign-in failed. Please try again.',
      });
      return;
    }

    if (response.type !== 'success') return;

    const params = response.params || {};
    const { idToken, accessToken } = extractGoogleOAuthTokens(response.authentication, params);

    if (!idToken) {
      console.error('Google OAuth: no id_token in response', { params, authentication: response.authentication });
      setIsLoadingGoogle(false);
      setErrorPopup({
        title: 'Sign-In Failed',
        message: 'Google sign-in did not complete successfully. Please try again.',
      });
      return;
    }

    setIsLoadingGoogle(false);
    const payload = { id_token: idToken, access_token: accessToken };
    const view = currentViewRef.current;
    if (view === 'signup') {
      void handleGoogleSignUpRef.current?.(payload);
    } else {
      void handleGoogleSignInRef.current?.(payload);
    }
  }, [response, request]);

  // ==================== SIGNUP HANDLERS ====================
  const handlePickImage = async () => {
    try {
      const image = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: PROFILE_IMAGE_QUALITY });
      if (image && image.uri) {
        setProfileImageUri(image.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setErrorPopup({
        title: 'Error',
        message: 'Failed to pick image. Please try again.',
        retryText: 'Try again',
        onRetry: () => {
          setErrorPopup(null);
          void handlePickImage();
        },
      });
    }
  };

  const validateSignupForm = () => {
    const newErrors = collectSignupErrors({ name, email, password, confirmPassword });
    setSignupErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    console.log('🚀 Starting signup process...');
    console.log('📝 Form data:', { name: name.trim(), email: email.trim(), role, bioLength: bio.length, credentialsLength: credentials.length, locationLength: location.length });

    if (!validateSignupForm()) {
      console.log('❌ Form validation failed:', signupErrors);
      return;
    }

    if (!auth || !db) {
      console.error('❌ Firebase not initialized:', { auth: !!auth, db: !!db });
      setErrorPopup({
        title: 'Error',
        message: 'Firebase is not initialized. Please check your configuration.',
      });
      return;
    }

    setSignupLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const displayName = name.trim();
      let photoURL = null;
      setUploadingImage(Boolean(profileImageUri && role === 'trainer'));
      try {
        photoURL = await uploadTrainerProfilePhotoIfNeeded({
          profileImageUri,
          role,
          user: userCredential.user,
          displayName,
        });
      } catch (uploadError) {
        console.error('❌ Error uploading profile image:', uploadError);
      } finally {
        setUploadingImage(false);
      }

      await cachePendingSignupProfile(userCredential.user.uid, role, AsyncStorage);
      const userData = buildEmailSignupUserData({
        name,
        email,
        role,
        bio,
        credentials,
        specializations,
        location,
        photoURL,
      });

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      if (role === 'trainer' && photoURL) {
        await setDoc(doc(db, 'trainers', userCredential.user.uid), { photoURL, avatarUrl: photoURL }, { merge: true });
      }

      if (onSignupSuccess) onSignupSuccess(userCredential.user, role);
    } catch (error) {
      console.error('❌ Signup error:', error);
      setErrorPopup({
        title: 'Signup Failed',
        message: messageForSignupAuthError(error),
        retryText: 'Try again',
        onRetry: () => {
          setErrorPopup(null);
          void handleSignup();
        },
      });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGoogleSignUp = async (authentication) => {
    if (!auth || !db) {
      setErrorPopup({ title: 'Error', message: 'Firebase is not initialized.' });
      return;
    }
    setSignupLoading(true);
    try {
      await runGoogleSignUpFlow({
        authentication,
        role,
        AsyncStorage,
        ensureRoleMatchesToggle,
        onSignupSuccess,
      });
    } catch (error) {
      console.error('Google sign-up error:', error);
      setErrorPopup({
        title: 'Google Sign-Up Failed',
        message: messageForGoogleSignUpError(error),
        retryText: 'Try again',
        onRetry: () => {
          setErrorPopup(null);
          void handleGoogleSignUpRef.current?.(authentication);
        },
      });
    } finally {
      setSignupLoading(false);
    }
  };

  // ==================== LOGIN HANDLERS ====================
  const validateLoginForm = () => {
    const newErrors = collectLoginErrors({ loginEmail, loginPassword });
    setLoginErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateLoginForm()) return;
    
    if (!auth) {
      setErrorPopup({
        title: 'Error',
        message: 'Firebase authentication is not initialized. Please check your configuration.',
      });
      return;
    }

    setLoginLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
      console.log('Login successful:', userCredential.user.email);

      const roleOk = await ensureRoleMatchesToggle(userCredential.user.uid, role);
      if (!roleOk) return;

      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Failed to sign in. Please try again.';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'No account found with this email address.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/user-disabled':
          errorMessage = 'This account has been disabled.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many failed attempts. Please try again later.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setErrorPopup({
        title: 'Login Failed',
        message: errorMessage,
        retryText: 'Try again',
        onRetry: () => {
          setErrorPopup(null);
          void handleLogin();
        },
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleSignIn = async (authentication) => {
    if (!auth || !db) {
      setErrorPopup({ title: 'Error', message: 'Firebase is not initialized.' });
      return;
    }
    setLoginLoading(true);
    try {
      await runGoogleSignInFlow({
        authentication,
        role,
        AsyncStorage,
        ensureRoleMatchesToggle,
        onSignupSuccess,
        onLoginSuccess,
      });
    } catch (error) {
      console.error('Google sign-in error:', error);
      setErrorPopup({
        title: 'Google Sign-In Failed',
        message: messageForGoogleSignInError(error),
        retryText: 'Try again',
        onRetry: () => {
          setErrorPopup(null);
          void handleGoogleSignInRef.current?.(authentication);
        },
      });
    } finally {
      setLoginLoading(false);
    }
  };

  handleGoogleSignUpRef.current = handleGoogleSignUp;
  handleGoogleSignInRef.current = handleGoogleSignIn;

  const handleAppleAuth = async ({ mode }) => {
    if (Platform.OS !== 'ios') {
      setErrorPopup({
        title: 'Apple Sign-In',
        message: 'Apple Sign-In is only available on iOS devices.',
      });
      return;
    }
    if (!auth || !db) {
      setErrorPopup({ title: 'Error', message: 'Firebase is not initialized.' });
      return;
    }

    const setLoading = mode === 'signup' ? setSignupLoading : setLoginLoading;
    setIsLoadingApple(true);
    setLoading(true);

    try {
      await runAppleAuthFlow({
        mode,
        role,
        AsyncStorage,
        ensureRoleMatchesToggle,
        onSignupSuccess,
        onLoginSuccess,
      });
    } catch (appleError) {
      if (appleError?.code === 'ERR_REQUEST_CANCELED') return;
      if (appleError?.code === 'apple_unavailable') {
        setErrorPopup({
          title: 'Apple Sign-In',
          message: 'Apple Sign-In is not available on this device.',
        });
        return;
      }
      console.error('Apple auth error:', appleError);
      setErrorPopup({
        title: mode === 'signup' ? 'Apple Sign-Up Failed' : 'Apple Sign-In Failed',
        message: messageForAppleAuthError(appleError, mode),
        retryText: 'Try again',
        onRetry: () => {
          setErrorPopup(null);
          void handleAppleAuth({ mode });
        },
      });
    } finally {
      setIsLoadingApple(false);
      setSignupLoading(false);
      setLoginLoading(false);
    }
  };

  // ==================== RENDER VIEWS ====================
  // Design Law welcome (01/02): fill poster wordmark + ticker, paired illustration cards,
  // headline, solid Get started, underlined Sign in. Theme chip top-right.
  const renderWelcomeView = () => (
    <RNAnimated.View style={{ flex: 1, backgroundColor: animatedBg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.sm,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: nb.screenGutter,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'flex-end', marginBottom: spacing.sm }}>
          <ThemeToggleChip
            isDarkLanding={isDarkLanding}
            onPress={toggleTheme}
            theme={landingTheme}
          />
        </View>

        {/* Black/white fill poster — brand is the hero, not an accent word */}
        <HardShadow offset={nb.shadowOffsetHero} radius={borderRadius.nbHero} style={{ marginBottom: spacing.md }}>
          <View
            style={{
              borderWidth: nb.borderWidth,
              borderColor: landingTheme.border,
              backgroundColor: landingTheme.fill,
              borderRadius: borderRadius.nbHero,
              paddingTop: 22,
              paddingHorizontal: 16,
              paddingBottom: 14,
              overflow: 'hidden',
            }}
          >
            <Text
              style={{
                fontSize: 42,
                fontWeight: '900',
                letterSpacing: -2,
                color: landingTheme.onFill,
                textAlign: 'center',
              }}
            >
              COACH CONNECT
            </Text>
            <View
              style={{
                marginTop: 14,
                borderTopWidth: 2,
                borderTopColor: landingTheme.onFill,
                paddingTop: 10,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '800',
                  fontStyle: 'italic',
                  color: landingTheme.onFill,
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                {WELCOME_TICKER}
              </Text>
            </View>
          </View>
        </HardShadow>

        {/* Paired feature cards under the poster (AI Lottie + plans chip) */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: spacing.lg }}>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ flex: 1 }}>
            <View
              style={{
                borderWidth: nb.borderWidth,
                borderColor: landingTheme.border,
                backgroundColor: landingTheme.surface,
                borderRadius: borderRadius.nbCard,
                height: 140,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <LottieView
                source={require('../assets/animations/handoff/robot.json')}
                autoPlay
                loop
                style={{ width: 120, height: 120 }}
              />
            </View>
          </HardShadow>
          <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard} style={{ flex: 1 }}>
            <View
              style={{
                borderWidth: nb.borderWidth,
                borderColor: landingTheme.border,
                backgroundColor: landingTheme.surface,
                borderRadius: borderRadius.nbCard,
                height: 140,
                padding: 12,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: borderRadius.nbIconChip,
                  borderWidth: nb.borderWidth,
                  borderColor: landingTheme.border,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={accentGradients[3]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Image
                    source={require('../assets/icons/handoff/dumbbell.png')}
                    style={{ width: 28, height: 28, resizeMode: 'contain' }}
                  />
                </LinearGradient>
              </View>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: '900',
                  color: landingTheme.ink,
                  textAlign: 'center',
                  lineHeight: 18,
                }}
              >
                Plans, logs, check-ins
              </Text>
            </View>
          </HardShadow>
        </View>

        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: '900',
              letterSpacing: -0.6,
              color: landingTheme.heading,
              marginBottom: 8,
              lineHeight: 34,
            }}
          >
            Trainers and clients, finally in sync.
          </Text>
          <Text
            style={{
              fontSize: 15,
              fontWeight: '500',
              lineHeight: 22,
              color: landingTheme.subtitle,
              marginBottom: spacing.lg,
            }}
          >
            One platform for programming, tracking, and communication.
          </Text>

          <NbButton variant="fill" onPress={onGetStarted} style={{ marginBottom: spacing.md }}>
            Get started >
          </NbButton>

          <AuthTextLink
            prefix="Already have an account? "
            actionLabel="Sign in"
            onPress={onSignIn}
            theme={landingTheme}
          />
        </View>
      </ScrollView>
    </RNAnimated.View>
  );

  const renderRoleSelectionView = () => null;

  const renderSignupView = () => {
    const placeholderTextColor = isDarkLanding ? 'rgba(255,255,255,0.35)' : '#6B7280';

    const signupStyles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: landingTheme.bg,
      },
      keyboardView: {
        flex: 1,
      },
      scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
        paddingBottom: 32,
      },
      header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
      },
      logo: {
        fontSize: 36,
        fontWeight: '800',
        color: isDarkLanding ? lightColors.white : lightColors.nbInk,
        letterSpacing: 2,
        marginBottom: spacing.sm,
      },
      subtitle: {
        fontSize: 16,
        color: isDarkLanding ? '#C1265A' : (colors.accent ?? '#C1265A'),
        textAlign: 'center',
      },
      form: {
        backgroundColor: isDarkLanding ? colors.surfaceSecondary : lightColors.white,
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
        shadowColor: lightColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDarkLanding ? 0.15 : 0.3,
        shadowRadius: 8,
        elevation: 5,
        flexGrow: 1,
        paddingBottom: 20,
      },
      formTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: isDarkLanding ? lightColors.white : lightColors.nbInk,
        textAlign: 'center',
        marginBottom: spacing.lg,
      },
      inputContainer: {
        marginBottom: spacing.md,
      },
      inputLabel: {
        fontSize: 14,
        color: isDarkLanding ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)',
        marginBottom: spacing.sm,
        fontWeight: '600',
      },
      input: {
        borderWidth: 1,
        borderColor:
          signupErrors.name || signupErrors.email || signupErrors.password || signupErrors.confirmPassword
            ? '#F87171'
            : (isDarkLanding ? 'rgba(255,255,255,0.14)' : 'rgba(88, 86, 214, 0.3)'),
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: isDarkLanding ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)',
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.06)' : '#F9F9F9',
        minHeight: 50,
      },
      errorText: {
        fontSize: 12,
        color: '#F87171',
        marginTop: spacing.xs,
      },
      roleContainer: {
        marginBottom: spacing.md,
      },
      roleLabel: {
        fontSize: 14,
        color: isDarkLanding ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)',
        marginBottom: spacing.sm,
        fontWeight: '600',
      },
      roleButtons: {
        flexDirection: 'row',
        gap: spacing.sm,
      },
      roleButton: {
        flex: 1,
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.14)' : 'rgba(88, 86, 214, 0.3)',
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.06)' : '#F9F9F9',
        alignItems: 'center',
      },
      roleButtonActive: {
        borderColor: lightColors.primary,
        backgroundColor: 'rgba(88, 86, 214, 0.2)',
      },
      roleButtonText: {
        fontSize: 14,
        color: '#C1265A',
        fontWeight: '600',
      },
      roleButtonTextActive: {
        color: lightColors.primary,
        fontWeight: '700',
      },
      signupButton: {
        backgroundColor: lightColors.primary,
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.md,
        shadowColor: lightColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
      signupButtonText: {
        fontSize: 16,
        color: lightColors.white,
        fontWeight: '700',
      },
      divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
      },
      dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
      },
      dividerText: {
        marginHorizontal: spacing.md,
        fontSize: 14,
        color: '#C1265A',
      },
      googleButton: {
        flexDirection: 'row',
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.06)' : '#F9F9F9',
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
      },
      appleButton: {
        flexDirection: 'row',
        backgroundColor: isDarkLanding ? lightColors.white : '#000000',
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: isDarkLanding ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
      },
      googleButtonText: {
        fontSize: 16,
        color: isDarkLanding ? lightColors.white : lightColors.nbInk,
        fontWeight: '600',
        marginLeft: spacing.sm,
      },
      appleButtonText: {
        fontSize: 16,
        color: isDarkLanding ? '#000000' : lightColors.white,
        fontWeight: '600',
        marginLeft: spacing.sm,
      },
      googleIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
      },
      appleIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
        tintColor: isDarkLanding ? '#000000' : lightColors.white,
      },
      footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.lg,
      },
      footerText: {
        fontSize: 14,
        color: isDarkLanding ? 'rgba(255,255,255,0.60)' : '#C1265A',
        marginRight: spacing.sm,
      },
      loginLink: {
        fontSize: 14,
        color: lightColors.primary,
        fontWeight: '700',
      },
      textArea: {
        minHeight: 100,
        paddingTop: spacing.md,
      },
      imagePickerButton: {
        marginTop: spacing.xs,
      },
      imagePickerPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.06)' : '#F9F9F9',
        borderWidth: 2,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.18)' : 'rgba(255,45,206,0.30)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
      },
      imagePickerText: {
        fontSize: 12,
        color: isDarkLanding ? 'rgba(255,255,255,0.65)' : '#FF00D4',
        textAlign: 'center',
      },
      profileImagePreview: {
        width: 100,
        height: 100,
        borderRadius: 50,
        borderWidth: 2,
        borderColor: '#FF2DCE',
      },
    });

    return (
      <SafeAreaView style={signupStyles.container}>
        <StatusBar style={isDarkLanding ? 'light' : 'dark'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={signupStyles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          <ScrollView 
            contentContainerStyle={signupStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            marginBottom: spacing.xl,
            marginTop: 6,
          }}
        >
          <View style={{ flex: 1 }}>
            <AppLogo width={148} style={{ marginBottom: 8 }} />
            <Text style={signupStyles.subtitle}>Create Your Account</Text>
          </View>

          <TouchableOpacity
            onPress={toggleTheme}
            activeOpacity={0.75}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1,
              backgroundColor: landingTheme.toggleBg,
              borderColor: landingTheme.toggleBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
            }}
          >
            <Ionicons
              name={isDarkLanding ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={landingTheme.toggleIcon}
            />
          </TouchableOpacity>
        </View>

            <View style={signupStyles.form}>
              <Text style={signupStyles.formTitle}>Get Started</Text>
              
              <View style={signupStyles.roleContainer}>
                <Text style={signupStyles.roleLabel}>I am a:</Text>
                <View style={signupStyles.roleButtons}>
                  <TouchableOpacity
                    style={[signupStyles.roleButton, role === 'client' && signupStyles.roleButtonActive]}
                    onPress={() => {
                      console.log('👤 Client role selected');
                      setRole('client');
                      setSelectedRole('client');
                    }}
                    disabled={signupLoading}
                  >
                    <Text style={[signupStyles.roleButtonText, role === 'client' && signupStyles.roleButtonTextActive]}>
                      Client
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[signupStyles.roleButton, role === 'trainer' && signupStyles.roleButtonActive]}
                    onPress={() => {
                      console.log('👨‍🏫 Trainer role selected');
                      setRole('trainer');
                      setSelectedRole('trainer');
                    }}
                    disabled={signupLoading}
                  >
                    <Text style={[signupStyles.roleButtonText, role === 'trainer' && signupStyles.roleButtonTextActive]}>
                      Trainer
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={signupStyles.inputContainer}>
                <Text style={signupStyles.inputLabel}>Email</Text>
                <TextInput
                  style={signupStyles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={placeholderTextColor}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (signupErrors.email) setSignupErrors({ ...signupErrors, email: '' });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!signupLoading}
                />
                {signupErrors.email && <Text style={signupStyles.errorText}>{signupErrors.email}</Text>}
              </View>

              <View style={signupStyles.inputContainer}>
                <Text style={signupStyles.inputLabel}>Password</Text>
                <TextInput
                  style={signupStyles.input}
                  placeholder="Create a password (8+ chars, letter + number)"
                  placeholderTextColor={placeholderTextColor}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (signupErrors.password) setSignupErrors({ ...signupErrors, password: '' });
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  editable={!signupLoading}
                  returnKeyType="next"
                />
                {signupErrors.password && <Text style={signupStyles.errorText}>{signupErrors.password}</Text>}
              </View>

              <View style={signupStyles.inputContainer}>
                <Text style={signupStyles.inputLabel}>Confirm Password</Text>
                <TextInput
                  style={signupStyles.input}
                  placeholder="Confirm your password"
                  placeholderTextColor={placeholderTextColor}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    if (signupErrors.confirmPassword) setSignupErrors({ ...signupErrors, confirmPassword: '' });
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="password"
                  editable={!signupLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleSignup}
                />
                {signupErrors.confirmPassword && <Text style={signupStyles.errorText}>{signupErrors.confirmPassword}</Text>}
              </View>

              {role === 'trainer' && (
                <>
                  <View style={{ backgroundColor: 'red', padding: 10, margin: 10 }}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>TRAINER FIELDS SECTION - ROLE: {role}</Text>
                  </View>
                  
                  <View style={signupStyles.inputContainer}>
                    <Text style={signupStyles.inputLabel}>Profile Picture (Optional)</Text>
                    <TouchableOpacity
                      style={signupStyles.imagePickerButton}
                      onPress={handlePickImage}
                      disabled={signupLoading || uploadingImage}
                    >
                      {profileImageUri ? (
                        <Image source={{ uri: profileImageUri }} style={signupStyles.profileImagePreview} />
                      ) : (
                        <View style={signupStyles.imagePickerPlaceholder}>
                          <Text style={signupStyles.imagePickerText}>📷 Tap to add photo</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={signupStyles.inputContainer}>
                    <Text style={signupStyles.inputLabel}>Bio *</Text>
                    <TextInput
                      style={[signupStyles.input, signupStyles.textArea]}
                      placeholder="Tell clients about yourself, your experience, and training philosophy (min. 20 characters)"
                      placeholderTextColor="#6B7280"
                      value={bio}
                      onChangeText={(text) => {
                        setBio(text);
                        if (signupErrors.bio) setSignupErrors({ ...signupErrors, bio: '' });
                      }}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      editable={!signupLoading}
                    />
                    {signupErrors.bio && <Text style={signupStyles.errorText}>{signupErrors.bio}</Text>}
                  </View>

                  <View style={signupStyles.inputContainer}>
                    <Text style={signupStyles.inputLabel}>Credentials *</Text>
                    <TextInput
                      style={signupStyles.input}
                      placeholder="e.g., NASM-CPT, ACE Certified, CSCS"
                      placeholderTextColor="#6B7280"
                      value={credentials}
                      onChangeText={(text) => {
                        setCredentials(text);
                        if (signupErrors.credentials) setSignupErrors({ ...signupErrors, credentials: '' });
                      }}
                      editable={!signupLoading}
                    />
                    {signupErrors.credentials && <Text style={signupStyles.errorText}>{signupErrors.credentials}</Text>}
                  </View>

                  <View style={signupStyles.inputContainer}>
                    <Text style={signupStyles.inputLabel}>Specializations</Text>
                    <TextInput
                      style={signupStyles.input}
                      placeholder="e.g., Strength Training, HIIT, Yoga, Nutrition (comma-separated)"
                      placeholderTextColor="#6B7280"
                      value={specializations}
                      onChangeText={setSpecializations}
                      editable={!signupLoading}
                    />
                  </View>

                  <View style={signupStyles.inputContainer}>
                    <Text style={signupStyles.inputLabel}>Location *</Text>
                    <TextInput
                      style={signupStyles.input}
                      placeholder="e.g., New York, NY or Online"
                      placeholderTextColor="#6B7280"
                      value={location}
                      onChangeText={(text) => {
                        setLocation(text);
                        if (signupErrors.location) setSignupErrors({ ...signupErrors, location: '' });
                      }}
                      editable={!signupLoading}
                    />
                    {signupErrors.location && <Text style={signupStyles.errorText}>{signupErrors.location}</Text>}
                  </View>
                </>
              )}

              <TouchableOpacity 
                style={[signupStyles.signupButton, signupLoading && { opacity: 0.6 }]} 
                onPress={handleSignup}
                disabled={signupLoading}
              >
                <Text style={signupStyles.signupButtonText}>Create Account</Text>
              </TouchableOpacity>

              <View style={signupStyles.divider}>
                <View style={signupStyles.dividerLine} />
                <Text style={signupStyles.dividerText}>OR</Text>
                <View style={signupStyles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[signupStyles.googleButton, (signupLoading || !request) && { opacity: 0.6 }]}
                onPress={() => {
                  if (!request) {
                    setErrorPopup({
                      title: GOOGLE_OAUTH_NOT_READY_TITLE,
                      message: GOOGLE_OAUTH_NOT_READY_MESSAGE,
                    });
                    return;
                  }
                  promptAsync();
                }}
                disabled={signupLoading}
              >
                <Image source={googleIcon} style={signupStyles.googleIcon} />
                <Text style={signupStyles.googleButtonText}>Sign up with Google</Text>
              </TouchableOpacity>

              {/* Platform UI: Apple Sign-In only exists on iOS — hide the button on Android. */}
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={[signupStyles.appleButton, (signupLoading || isLoadingApple) && { opacity: 0.6 }]}
                  onPress={() => handleAppleAuth({ mode: 'signup' })}
                  disabled={signupLoading || isLoadingApple}
                >
                  <Image source={appleLogo} style={signupStyles.appleIcon} />
                  <Text style={signupStyles.appleButtonText}>Sign up with Apple</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={signupStyles.footer}>
              <Text style={signupStyles.footerText}>Already have an account?</Text>
              <TouchableOpacity 
                onPress={() => setCurrentView('login')}
                disabled={signupLoading}
              >
                <Text style={signupStyles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };

  const renderLoginView = () => {
    const placeholderTextColor = isDarkLanding ? 'rgba(255,255,255,0.35)' : '#6B7280';
    const loginStyles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: landingTheme.bg,
      },
      keyboardView: {
        flex: 1,
      },
      scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xl,
        paddingBottom: 32,
      },
      header: {
        alignItems: 'center',
        marginBottom: spacing.xxl,
      },
      logo: {
        fontSize: 36,
        fontWeight: '800',
        color: isDarkLanding ? lightColors.white : (colors.text ?? '#000000'),
        letterSpacing: 2,
        marginBottom: spacing.sm,
      },
      subtitle: {
        fontSize: 16,
        color: isDarkLanding ? '#C1265A' : (colors.accent ?? '#C1265A'),
        textAlign: 'center',
      },
      form: {
        backgroundColor: isDarkLanding ? colors.surfaceSecondary : colors.surface,
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
        shadowColor: lightColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: isDarkLanding ? 0.15 : 0.3,
        shadowRadius: 8,
        elevation: 5,
        flexGrow: 1,
        paddingBottom: 20,
      },
      formTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: isDarkLanding ? lightColors.white : lightColors.nbInk,
        textAlign: 'center',
        marginBottom: spacing.lg,
      },
      inputContainer: {
        marginBottom: spacing.md,
      },
      inputLabel: {
        fontSize: 14,
        color: isDarkLanding ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)',
        marginBottom: spacing.sm,
        fontWeight: '600',
      },
      input: {
        borderWidth: 1,
        borderColor: loginErrors.email || loginErrors.password ? '#F87171' : (isDarkLanding ? 'rgba(255,255,255,0.14)' : 'rgba(88, 86, 214, 0.3)'),
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        color: isDarkLanding ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)',
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.06)' : '#F9F9F9',
      },
      errorText: {
        fontSize: 12,
        color: '#F87171',
        marginTop: spacing.xs,
      },
      loginButton: {
        backgroundColor: lightColors.primary,
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.md,
        shadowColor: lightColors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
      loginButtonText: {
        fontSize: 16,
        color: lightColors.white,
        fontWeight: '700',
      },
      divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: spacing.lg,
      },
      dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
      },
      dividerText: {
        marginHorizontal: spacing.md,
        fontSize: 14,
        color: '#C1265A',
      },
      googleButton: {
        flexDirection: 'row',
        backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.06)' : '#F9F9F9',
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
        borderWidth: 1,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
      },
      googleButtonText: {
        fontSize: 16,
        color: isDarkLanding ? lightColors.white : lightColors.nbInk,
        fontWeight: '600',
        marginLeft: spacing.sm,
      },
      googleIcon: {
        width: 20,
        height: 20,
        resizeMode: 'contain',
      },
      forgotPassword: {
        alignItems: 'center',
        marginTop: spacing.sm,
      },
      forgotPasswordText: {
        fontSize: 14,
        color: lightColors.primary,
        fontWeight: '600',
      },
      footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.sm,
      },
      footerText: {
        fontSize: 14,
        color: isDarkLanding ? 'rgba(255,255,255,0.60)' : '#C1265A',
        marginRight: spacing.sm,
      },
      signupLink: {
        fontSize: 14,
        color: lightColors.primary,
        fontWeight: '700',
      },
    });

    return (
      <SafeAreaView style={loginStyles.container}>
        <StatusBar style={isDarkLanding ? 'light' : 'dark'} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={loginStyles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={loginStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={loginStyles.header}>
              <Text style={loginStyles.logo}>COACH ConnectT</Text>
              <Text style={loginStyles.subtitle}>Your AI Fitness Companion</Text>
            </View>

            <View style={loginStyles.form}>
              <Text style={loginStyles.formTitle}>Welcome Back</Text>
              
              <View style={loginStyles.inputContainer}>
                <Text style={loginStyles.inputLabel}>Email</Text>
                <TextInput
                  style={loginStyles.input}
                  placeholder="Enter your email"
                  placeholderTextColor={placeholderTextColor}
                  value={loginEmail}
                  onChangeText={(text) => {
                    setLoginEmail(text);
                    if (loginErrors.email) setLoginErrors({ ...loginErrors, email: '' });
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loginLoading}
                  accessibilityLabel="Login email"
                  textContentType="emailAddress"
                />
                {loginErrors.email && <Text style={loginStyles.errorText}>{loginErrors.email}</Text>}
              </View>

              <View style={loginStyles.inputContainer}>
                <Text style={loginStyles.inputLabel}>Password</Text>
                <TextInput
                  style={loginStyles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={placeholderTextColor}
                  value={loginPassword}
                  onChangeText={(text) => {
                    setLoginPassword(text);
                    if (loginErrors.password) setLoginErrors({ ...loginErrors, password: '' });
                  }}
                  secureTextEntry
                  editable={!loginLoading}
                  accessibilityLabel="Login password"
                  textContentType="password"
                />
                {loginErrors.password && <Text style={loginStyles.errorText}>{loginErrors.password}</Text>}
              </View>

              <TouchableOpacity 
                style={[loginStyles.loginButton, loginLoading && { opacity: 0.6 }]} 
                onPress={handleLogin}
                disabled={loginLoading}
                accessibilityRole="button"
                accessibilityLabel="Submit login"
              >
                <Text style={loginStyles.loginButtonText}>Sign In</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={loginStyles.forgotPassword}
                disabled={loginLoading}
                onPress={() => onForgotPasswordFlowPress?.()}
              >
                <Text style={loginStyles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <View style={loginStyles.footer}>
                <Text style={loginStyles.footerText}>Don't have an account?</Text>
        <TouchableOpacity 
                  onPress={() => setCurrentView('signup')}
                  disabled={loginLoading}
                >
                  <Text style={loginStyles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>

              <View style={loginStyles.divider}>
                <View style={loginStyles.dividerLine} />
                <Text style={loginStyles.dividerText}>OR</Text>
                <View style={loginStyles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[loginStyles.googleButton, (loginLoading || !request) && { opacity: 0.6 }]}
                onPress={() => {
                  if (!request) {
                    setErrorPopup({
                      title: GOOGLE_OAUTH_NOT_READY_TITLE,
                      message: GOOGLE_OAUTH_NOT_READY_MESSAGE,
                    });
                    return;
                  }
                  promptAsync();
                }}
                disabled={loginLoading}
              >
                <Image source={googleIcon} style={loginStyles.googleIcon} />
                <Text style={loginStyles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };

  // Design Law create account (03/04): role segmented, outlined fields, SHOW + rule chips,
  // solid Create account, Apple/Google, Sign in link. Behavior unchanged.
  const renderSignupViewLiquid = () => {
    const onGoogle = () => {
      if (!request) {
        setErrorPopup({
          title: GOOGLE_OAUTH_NOT_READY_TITLE,
          message: GOOGLE_OAUTH_NOT_READY_MESSAGE,
        });
        return;
      }
      setIsLoadingGoogle(true);
      promptAsync();
    };

    const onApple = () => handleAppleAuth({ mode: 'signup' });
    const roleHint =
      role === 'trainer'
        ? 'Build plans, manage clients, and get paid in one place.'
        : 'Find a trainer, or join the one you already have with a code.';

    return (
      <View style={{ flex: 1, backgroundColor: landingTheme.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <NbPageHeader title="Create your account" onBack={() => setCurrentView('welcome')} />
          <ScrollView
            contentContainerStyle={{
              paddingBottom: insets.bottom + 32,
              paddingHorizontal: nb.screenGutter,
              maxWidth: 440,
              alignSelf: 'center',
              width: '100%',
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <RoleToggle role={role} onRoleChange={setRole} theme={landingTheme} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: landingTheme.muted,
                marginBottom: spacing.md,
                lineHeight: 18,
              }}
            >
              {roleHint}
            </Text>

            <AuthField
              label="Full name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (signupErrors.name) setSignupErrors({ ...signupErrors, name: '' });
              }}
              placeholder="Alex Rivera"
              autoCapitalize="words"
              theme={landingTheme}
              errorText={signupErrors.name || null}
              dashedError={!!signupErrors.name}
            />
            <AuthField
              label="Email address"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (signupErrors.email) setSignupErrors({ ...signupErrors, email: '' });
              }}
              placeholder="alex@example.com"
              keyboardType="email-address"
              theme={landingTheme}
              errorText={signupErrors.email || null}
              dashedError={!!signupErrors.email}
            />
            <AuthField
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (signupErrors.password) setSignupErrors({ ...signupErrors, password: '' });
              }}
              placeholder="••••••••"
              secureTextEntry
              showSecureToggle
              secureVisible={showSignupPassword}
              onToggleSecure={() => setShowSignupPassword((v) => !v)}
              theme={landingTheme}
              errorText={signupErrors.password || null}
              dashedError={!!signupErrors.password}
            />
            <PasswordRuleChips password={password} theme={landingTheme} />
            <AuthField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (signupErrors.confirmPassword) {
                  setSignupErrors({ ...signupErrors, confirmPassword: '' });
                }
              }}
              placeholder="Type it again"
              secureTextEntry
              showSecureToggle
              secureVisible={showSignupConfirmPassword}
              onToggleSecure={() => setShowSignupConfirmPassword((v) => !v)}
              theme={landingTheme}
              errorText={signupErrors.confirmPassword || null}
              dashedError={!!signupErrors.confirmPassword}
            />

            <NbButton
              variant="fill"
              onPress={handleSignup}
              disabled={signupLoading}
              style={{ marginTop: spacing.sm, marginBottom: spacing.md }}
            >
              {signupLoading ? 'Creating…' : 'Create account'}
            </NbButton>

            <AuthOrDivider label="OR SIGN UP WITH" theme={landingTheme} />
            <SocialAuthRow
              onApple={onApple}
              onGoogle={onGoogle}
              appleLogoSource={appleLogo}
              googleIconSource={googleIcon}
              disabled={signupLoading || isLoadingGoogle}
              appleBusy={isLoadingApple}
              theme={landingTheme}
            />

            <AuthTextLink
              prefix="Already a member? "
              actionLabel="Sign in"
              onPress={onSignIn}
              theme={landingTheme}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  };

  // Design Law sign in (05–08): header + hero line, outlined fields + SHOW, forgot link,
  // solid Sign in, social row. Role toggle kept (auth mismatch needs it) even though PNG is lean.
  const renderLoginViewLiquid = () => {
    const onGoogle = () => {
      if (!request) {
        setErrorPopup({
          title: GOOGLE_OAUTH_NOT_READY_TITLE,
          message: GOOGLE_OAUTH_NOT_READY_MESSAGE,
        });
        return;
      }
      setIsLoadingGoogle(true);
      promptAsync();
    };

    const onApple = () => handleAppleAuth({ mode: 'login' });

    return (
      <View style={{ flex: 1, backgroundColor: landingTheme.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <NbPageHeader
            title="Sign in"
            subtitle="Welcome back"
            onBack={() => setCurrentView('welcome')}
          />
          <ScrollView
            contentContainerStyle={{
              paddingBottom: insets.bottom + 32,
              paddingHorizontal: nb.screenGutter,
              maxWidth: 440,
              alignSelf: 'center',
              width: '100%',
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: '900',
                letterSpacing: -0.6,
                color: landingTheme.ink,
                marginBottom: spacing.md,
                lineHeight: 34,
              }}
            >
              Pick up where you left off.
            </Text>

            <RoleToggle role={role} onRoleChange={setRole} theme={landingTheme} />
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: landingTheme.muted,
                marginBottom: spacing.md,
                lineHeight: 18,
              }}
            >
              Match the toggle to your account type before signing in.
            </Text>

            <AuthField
              label="Email address"
              value={loginEmail}
              onChangeText={(text) => {
                setLoginEmail(text);
                if (loginErrors.email) setLoginErrors({ ...loginErrors, email: '' });
              }}
              placeholder="alex@example.com"
              keyboardType="email-address"
              theme={landingTheme}
              accessibilityLabel="Sign in email"
              errorText={loginErrors.email || null}
              dashedError={!!loginErrors.email}
            />
            <AuthField
              label="Password"
              value={loginPassword}
              onChangeText={(text) => {
                setLoginPassword(text);
                if (loginErrors.password) setLoginErrors({ ...loginErrors, password: '' });
              }}
              placeholder="••••••••"
              secureTextEntry
              showSecureToggle
              secureVisible={showLoginPassword}
              onToggleSecure={() => setShowLoginPassword((v) => !v)}
              theme={landingTheme}
              accessibilityLabel="Sign in password"
              errorText={loginErrors.password || null}
              dashedError={!!loginErrors.password}
            />

            <TouchableOpacity
              onPress={() => onForgotPasswordFlowPress?.(loginEmail)}
              activeOpacity={0.8}
              disabled={loginLoading}
              style={{ alignSelf: 'flex-end', marginBottom: spacing.md }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '900',
                  color: landingTheme.ink,
                  borderBottomWidth: 3,
                  borderBottomColor: landingTheme.border,
                  paddingBottom: 1,
                }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>

            <NbButton
              variant="fill"
              onPress={handleLogin}
              disabled={loginLoading}
              style={{ marginBottom: spacing.md }}
            >
              {loginLoading ? 'Signing in…' : 'Sign in'}
            </NbButton>

            <AuthOrDivider label="OR CONTINUE WITH" theme={landingTheme} />
            <SocialAuthRow
              onApple={onApple}
              onGoogle={onGoogle}
              appleLogoSource={appleLogo}
              googleIconSource={googleIcon}
              disabled={loginLoading || isLoadingGoogle}
              appleBusy={isLoadingApple}
              theme={landingTheme}
            />

            <AuthTextLink
              prefix="New here? "
              actionLabel="Create an account"
              onPress={() => setCurrentView('signup')}
              theme={landingTheme}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  };

  // ==================== MAIN RENDER ====================
  return (
    <>
      {currentView === 'welcome'
        ? renderWelcomeView()
        : currentView === 'signup'
          ? renderSignupViewLiquid()
          : renderLoginViewLiquid()}
      <ErrorPopup
        visible={!!errorModal}
        title={errorModal?.title ?? 'Error'}
        message={errorModal?.message ?? ''}
        icon={errorModal?.icon}
        onDismiss={() => setErrorPopup(null)}
        onRetry={errorModal?.onRetry}
        retryText={errorModal?.retryText}
      />
    </>
  );
}

// ==================== STYLES ====================
const welcomeStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#1F2937',
  },
  taglineContainer: {
    marginBottom: 64,
    maxWidth: 280,
  },
  tagline: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 26,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 320,
    gap: 16,
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: lightColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: lightColors.white,
  },
  ghostButton: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
});

const roleStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#1F2937',
    fontWeight: '600',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  cardsContainer: {
    gap: 24,
  },
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  cardGradient: {
    height: 200,
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconEmoji: {
    fontSize: 64,
  },
  iconImage: {
    width: 56,
    height: 56,
    resizeMode: 'contain',
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: lightColors.white,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
});

const stylesLiquidAuth = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  brand: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 3,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 10,
  },
  title: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 34,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 14,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.55)',
  },
  cardHit: {
    alignSelf: 'stretch',
  },
  cardSurface: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  rolePillHit: { flex: 1 },
  rolePillHitSelected: {},
  rolePillStroke: { borderRadius: 16, padding: 1 },
  rolePillSurface: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rolePillIcon: { width: 18, height: 18, resizeMode: 'contain', opacity: 0.95 },
  rolePillText: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontWeight: '800',
    letterSpacing: 0.4,
    fontSize: 14,
  },
  fieldWrap: { marginBottom: 12 },
  fieldStroke: { borderRadius: 16, padding: 1 },
  fieldSurface: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 18,
  },
  fieldInnerShadow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  fieldLabel: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldInput: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  errorText: {
    fontFamily: AUTH_FONT_ROUNDED,
    marginTop: -4,
    marginBottom: 10,
    fontSize: 12,
    color: 'rgba(255,99,99,0.95)',
  },
  primaryBtn: { marginTop: 8, marginBottom: 16 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  orLine: { flex: 1, height: 1 },
  orText: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  socialGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  socialHit: { flex: 1, minHeight: 52 },
  socialSurface: { paddingVertical: 14, paddingHorizontal: 12, justifyContent: 'center' },
  socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  socialIconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: 1,
  },
  socialIcon: { width: 22, height: 22, resizeMode: 'contain', opacity: 0.98 },
  socialText: { fontFamily: AUTH_FONT_ROUNDED, fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  forgotHit: { alignSelf: 'center', paddingVertical: 8, marginBottom: 8 },
  forgotText: { fontFamily: AUTH_FONT_ROUNDED, color: 'rgba(255,255,255,0.62)', fontWeight: '700' },
  footerRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 6 },
  footerText: { fontFamily: AUTH_FONT_ROUNDED, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
  footerLink: { fontFamily: AUTH_FONT_ROUNDED, color: Liquid.colors.cyan, fontWeight: '900' },
});

const stylesWelcomeLiquid = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    justifyContent: 'center',
  },
  heroWrap: { 
    alignItems: 'center', 
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
  },
  heroCardHit: { width: 220, height: 220, backgroundColor: 'transparent' },
  heroCardSurface: { backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  heroIconSlot: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  heroIcon: { width: 180, height: 180, resizeMode: 'contain', opacity: 0.98 },
  cardHit: { width: '100%' },
  cardSurface: { 
    padding: 20, 
    backgroundColor: 'rgba(255,255,255,0.03)', 
    borderWidth: 1, 
    borderColor: 'rgba(255,107,157,0.15)' 
  },
  cardSurfaceLight: { padding: 20, backgroundColor: 'rgba(255,255,255,0.95)' },
  headline: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    color: 'rgba(255,255,255,0.87)',
    lineHeight: 56,
    textShadowColor: lightColors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  headlineLight: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    color: 'rgba(0,0,0,0.87)',
    lineHeight: 56,
    textShadowColor: lightColors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  subhead: {
    fontFamily: AUTH_FONT_ROUNDED,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.55)',
  },
  subheadLight: {
    fontFamily: AUTH_FONT_ROUNDED,
    marginTop: 8,
    fontSize: 15,
    lineHeight: 20,
    color: 'rgba(0,0,0,0.55)',
  },
  ctaHit: { borderRadius: 20, overflow: 'hidden' },
  ctaHitLight: { borderRadius: 20, overflow: 'hidden' },
  ctaInner: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  ctaInnerLight: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.10)',
  },
  ctaText: { fontFamily: AUTH_FONT_ROUNDED, fontSize: 18, fontWeight: '900', color: 'rgba(255,255,255,0.92)' },
  ctaTextLight: { fontFamily: AUTH_FONT_ROUNDED, fontSize: 18, fontWeight: '900', color: 'rgba(0,0,0,0.92)' },
  signInHit: { alignSelf: 'center', paddingVertical: 8 },
  signInHitLight: { alignSelf: 'center', paddingVertical: 8 },
  signInText: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.70)',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(255,255,255,0.35)',
  },
  signInTextLight: {
    fontFamily: AUTH_FONT_ROUNDED,
    fontSize: 15,
    fontWeight: '800',
    color: 'rgba(0,0,0,0.70)',
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(0,0,0,0.35)',
  },
});

