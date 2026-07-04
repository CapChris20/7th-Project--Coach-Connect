/**
 * Auth Screen
 *
 * Purpose: UI screen or component: Auth Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/auth
 * Key exports: LoginScreen
 *
 * @file-header
 */
/**
 * LoginScreen - Combined authentication screen
 *
 * Combines WelcomeScreen, RoleSelectionScreen, SignupScreen, and LoginScreen
 * into a single file with internal state management for navigation.
 */

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
import { useTheme } from '../shared-ui/ThemeContext';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithCredential, signOut, GoogleAuthProvider, updateProfile, OAuthProvider } from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../app-start/config';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { pickImage } from '../ai-coach/server-logic/vision/imageStorageService';
import { uploadProfileImage } from '../shared/firestore/storageHelpers';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import LiquidBackground from '../shared-ui/liquid/LiquidBackground';
import LiquidBackgroundLight from '../shared-ui/liquid/LiquidBackgroundLight';
import LiquidGlassCard from '../shared-ui/liquid/LiquidGlassCard';
import ErrorModal from '../shared/components/modals/ErrorModal';
import LiquidGradientButton from '../shared-ui/liquid/LiquidGradientButton';
import { Liquid } from '../shared-ui/liquid/liquidTokens';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BrandLogo from '../shared/components/brand/BrandLogo';
import { cachePendingSignupProfile } from './detectUserRole';

/**
 * expo-auth-session Google: tokens may be camelCase on `authentication`, snake_case on `params`,
 * and may appear only after async code exchange (installed app flow).
 */
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
    const s = String(raw).toLowerCase().trim();
    if (s === 'trainer') return 'trainer';
    if (s === 'client') return 'client';
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

const DARK = {
  bg: '#0A0A0F',
  wordmark: 'rgba(255,255,255,0.4)',
  heading: '#FFFFFF',
  subtitle: 'rgba(255,255,255,0.5)',
  toggleBg: 'rgba(255,255,255,0.08)',
  toggleBorder: 'rgba(255,255,255,0.12)',
  toggleIcon: 'rgba(255,255,255,0.7)',
  lottieGlow: 'rgba(193, 38, 90, 0.2)',
  signinMuted: 'rgba(255,255,255,0.5)',
  signinLink: '#FF8FA8',
};

const LIGHT = {
  bg: '#F5F5F7',
  wordmark: 'rgba(0,0,0,0.35)',
  heading: '#0A0A0F',
  subtitle: 'rgba(0,0,0,0.5)',
  // Higher contrast for light mode so the theme toggle is visible.
  toggleBg: 'rgba(193, 38, 90, 0.10)',
  toggleBorder: 'rgba(193, 38, 90, 0.28)',
  toggleIcon: 'rgba(193, 38, 90, 0.95)',
  lottieGlow: 'rgba(193, 38, 90, 0.12)',
  signinMuted: 'rgba(0,0,0,0.45)',
  signinLink: '#C1265A',
};

function FloatingInput({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  isDark = true,
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
          marginBottom: 6,
          marginLeft: 2,
          color: focused
            ? (isDark ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.78)')
            : (isDark ? 'rgba(255,255,255,0.48)' : 'rgba(15,23,42,0.62)'),
        }}
      >
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={isDark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.35)'}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          height: 52,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1.5,
          fontSize: 15,
          color: isDark ? '#FFFFFF' : '#0F172A',
          backgroundColor: focused
            ? (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.98)')
            : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.55)'),
          borderColor: focused
            ? (isDark ? 'rgba(255,255,255,0.32)' : 'rgba(193, 38, 90, 0.42)')
            : (isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.18)'),
        }}
      />
    </View>
  );
}

/** Role pill fill — matches onboarding CTA */
const ROLE_TOGGLE_GRADIENT = AUTH_CTA_GRADIENT;

/** Border-first role control — no sliding solid gradient fill. */
function RoleToggle({ role, onRoleChange, isDark = true }) {
  const muted = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.5)';
  const innerFill = isDark ? 'rgba(10,10,15,0.88)' : 'rgba(255,255,255,0.96)';
  const idleBorder = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.16)';
  const idleBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.45)';

  return (
    <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginBottom: 28 }}>
      {['client', 'trainer'].map((r) => {
        const selected = role === r;
        const label = r === 'client' ? 'Client' : 'Trainer';
        const labelColor = selected ? (isDark ? '#FFFFFF' : '#0A0A0F') : muted;

        const inner = (
          <View
            style={{
              borderRadius: 14,
              paddingVertical: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? innerFill : idleBg,
              borderWidth: selected ? 0 : 1.5,
              borderColor: idleBorder,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '800', textTransform: 'capitalize', color: labelColor }}>{label}</Text>
          </View>
        );

        return (
          <TouchableOpacity
            key={r}
            activeOpacity={0.88}
            onPress={() => onRoleChange(r)}
            style={{ flex: 1 }}
          >
            {selected ? (
              <LinearGradient
                colors={ROLE_TOGGLE_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ borderRadius: 16, padding: 2 }}
              >
                {inner}
              </LinearGradient>
            ) : (
              inner
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

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
              selected && { color: isDark ? '#FFFFFF' : 'rgba(15,23,42,0.92)' },
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
    <LiquidGlassCard
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
    </LiquidGlassCard>
  );
}

export default function LoginScreen({ onSignupSuccess, onLoginSuccess, onForgotPasswordFlowPress }) {
  const { colors, typography, spacing, isDark, themeMode = 'dark', toggleTheme: toggleThemeContext } = useTheme();
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
  // Auth screen local theme state, synced with ThemeContext (so Welcome + Sign Up match)
  const [isDarkLanding, setIsDarkLanding] = useState(isDark);
  const bgAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((val) => {
      if (val !== null) {
        const dark = val === 'dark';
        setIsDarkLanding(dark);
        // Keep ThemeContext in sync so Signup components using useTheme() match.
        toggleThemeContext?.(dark ? 'dark' : 'light');
        bgAnim.setValue(dark ? 1 : 0);
      }
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
    // Sync ThemeContext so Signup (and any shared UI) matches Welcome toggle.
    toggleThemeContext?.(next ? 'dark' : 'light');
    RNAnimated.timing(bgAnim, {
      toValue: next ? 1 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  const t = isDarkLanding ? DARK : LIGHT;

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

  const [errorModal, setErrorModal] = useState(null);

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
    setErrorModal({ title: ROLE_MISMATCH_TITLE, message: ROLE_MISMATCH_MESSAGE });
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
      setErrorModal({
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
      setErrorModal({
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
      const image = await pickImage({ allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (image && image.uri) {
        setProfileImageUri(image.uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      setErrorModal({
        title: 'Error',
        message: 'Failed to pick image. Please try again.',
        retryText: 'Try again',
        onRetry: () => {
          setErrorModal(null);
          void handlePickImage();
        },
      });
    }
  };

  const validateSignupForm = () => {
    const newErrors = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
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
    
    console.log('✅ Form validation passed');
    
    if (!auth || !db) {
      console.error('❌ Firebase not initialized:', { auth: !!auth, db: !!db });
      setErrorModal({
        title: 'Error',
        message: 'Firebase is not initialized. Please check your configuration.',
      });
      return;
    }

    console.log('✅ Firebase initialized, creating user...');
    setSignupLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      console.log('✅ User created in Firebase Auth:', userCredential.user.uid);
      
      let photoURL = null;
      
      if (profileImageUri && role === 'trainer') {
        console.log('📷 Uploading profile image...');
        setUploadingImage(true);
        try {
          const uploadResult = await uploadProfileImage(userCredential.user.uid, { uri: profileImageUri });
          if (uploadResult.success) {
            photoURL = uploadResult.downloadURL;
            await updateProfile(userCredential.user, {
              displayName: name.trim(),
              photoURL: photoURL,
            });
            console.log('✅ Profile image uploaded and user profile updated');
          }
        } catch (uploadError) {
          console.error('❌ Error uploading profile image:', uploadError);
        } finally {
          setUploadingImage(false);
        }
      } else {
        await updateProfile(userCredential.user, {
          displayName: name.trim(),
        });
        console.log('✅ User profile updated (no image)');
      }
      
      await cachePendingSignupProfile(userCredential.user.uid, role, AsyncStorage);

      // Prepare user data (role is server-only — see firestore.rules users/{userId} create)
      const userData = {
        name: name.trim(),
        email: email.trim(),
        onboardingCompleted: false, // Set to false so onboarding shows after signup
        createdAt: new Date().toISOString(),
      };
      
      if (role === 'trainer') {
        userData.bio = bio.trim();
        userData.credentials = credentials.trim();
        userData.specializations = specializations.split(',').map(s => s.trim()).filter(s => s.length > 0);
        userData.location = location.trim();
        console.log('👨‍🏫 Adding trainer-specific data:', { bioLength: userData.bio.length, credentials: userData.credentials, specializationsCount: userData.specializations.length, location: userData.location });
      }

      if (photoURL) {
        userData.photoURL = photoURL;
      }
      
      console.log('💾 Saving user data to Firestore...');
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      if (role === 'trainer' && photoURL) {
        await setDoc(doc(db, 'trainers', userCredential.user.uid), { photoURL, avatarUrl: photoURL }, { merge: true });
      }
      console.log('✅ User data saved to Firestore');
      
      console.log('🎉 Signup successful:', userCredential.user.email, 'Role:', role);
      
      if (onSignupSuccess) {
        onSignupSuccess(userCredential.user, role);
      }
    } catch (error) {
      console.error('❌ Signup error:', error);
      console.error('❌ Error details:', { code: error.code, message: error.message, stack: error.stack });
      let errorMessage = 'Failed to create account. Please try again.';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'An account with this email already exists.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak. Please use a stronger password.';
          break;
        default:
          errorMessage = error.message || errorMessage;
      }
      
      setErrorModal({
        title: 'Signup Failed',
        message: errorMessage,
        retryText: 'Try again',
        onRetry: () => {
          setErrorModal(null);
          void handleSignup();
        },
      });
    } finally {
      setSignupLoading(false);
    }
  };

  const handleGoogleSignUp = async (authentication) => {
    if (!auth || !db) {
      setErrorModal({ title: 'Error', message: 'Firebase is not initialized.' });
      return;
    }

    setSignupLoading(true);
    try {
      const params = authentication?.params || {};
      const { idToken, accessToken } = extractGoogleOAuthTokens(authentication, params);
      const id_token = authentication?.id_token ?? idToken;
      const access_token = authentication?.access_token ?? accessToken;

      if (!id_token) {
        throw new Error('No ID token received from Google');
      }

      const credential = GoogleAuthProvider.credential(id_token, access_token);
      const userCredential = await signInWithCredential(auth, credential);
      
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await cachePendingSignupProfile(userCredential.user.uid, role, AsyncStorage);
        const userData = {
          uid: userCredential.user.uid,
          name: userCredential.user.displayName || 'User',
          email: userCredential.user.email || '',
          onboardingCompleted: false, // Set to false so onboarding shows after signup
          createdAt: new Date().toISOString(),
          authProvider: 'google',
          photoURL: userCredential.user.photoURL || null,
        };
        await setDoc(userRef, userData);
        if (role === 'trainer' && userCredential.user.photoURL) {
          await setDoc(doc(db, 'trainers', userCredential.user.uid), {
            photoURL: userCredential.user.photoURL,
            avatarUrl: userCredential.user.photoURL,
          }, { merge: true });
        }
        console.log('New user created with Google sign-up:', userCredential.user.email, 'Role:', role);
      } else {
        const ok = await ensureRoleMatchesToggle(userCredential.user.uid, role);
        if (!ok) return;
        await setDoc(userRef, {
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('Existing user signed in with Google:', userCredential.user.email);
      }
      
      if (onSignupSuccess) {
        onSignupSuccess(userCredential.user, role);
      }
    } catch (error) {
      console.error('Google sign-up error:', error);
      let errorMessage = 'Failed to sign up with Google. ';
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage += 'An account already exists with this email. Please sign in instead.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage += 'Google Sign-In is not enabled. Please enable it in Firebase Console > Authentication > Sign-in methods.';
      } else if (error.message?.includes('blocked') || error.message?.includes('disabled')) {
        errorMessage += 'Google Sign-In is blocked. Please check:\n1. Firebase Console > Authentication > Sign-in methods > Enable Google\n2. Google Cloud Console > OAuth consent screen is configured\n3. Authorized domains include your app domain';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      setErrorModal({
        title: 'Google Sign-Up Failed',
        message: errorMessage,
        retryText: 'Try again',
        onRetry: () => {
          setErrorModal(null);
          void handleGoogleSignUpRef.current?.(authentication);
        },
      });
    } finally {
      setSignupLoading(false);
    }
  };

  // ==================== LOGIN HANDLERS ====================
  const validateLoginForm = () => {
    const newErrors = {};
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!loginEmail.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(loginEmail)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!loginPassword) {
      newErrors.password = 'Password is required';
    } else if (loginPassword.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setLoginErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateLoginForm()) return;
    
    if (!auth) {
      setErrorModal({
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
      
      setErrorModal({
        title: 'Login Failed',
        message: errorMessage,
        retryText: 'Try again',
        onRetry: () => {
          setErrorModal(null);
          void handleLogin();
        },
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGoogleSignIn = async (authentication) => {
    if (!auth || !db) {
      setErrorModal({ title: 'Error', message: 'Firebase is not initialized.' });
      return;
    }

    setLoginLoading(true);
    try {
      const params = authentication?.params || {};
      const { idToken, accessToken } = extractGoogleOAuthTokens(authentication, params);
      const id_token = authentication?.id_token ?? idToken;
      const access_token = authentication?.access_token ?? accessToken;

      if (!id_token) {
        throw new Error('No ID token received from Google');
      }

      const credential = GoogleAuthProvider.credential(id_token, access_token);
      const userCredential = await signInWithCredential(auth, credential);
      
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const roleOk = await ensureRoleMatchesToggle(userCredential.user.uid, role);
        if (!roleOk) return;

        const existing = userDoc.data() || {};
        const explicitlyIncomplete =
          existing.onboardingCompleted === false ||
          existing.onboardingCompleted === 'false' ||
          existing.onboardingCompleted === 0;
        const createdMs = existing.createdAt ? new Date(existing.createdAt).getTime() : NaN;
        const recentAccount =
          Number.isFinite(createdMs) && Date.now() - createdMs < 7 * 24 * 60 * 60 * 1000;
        const recentGoogleWithoutOnboarding =
          existing.authProvider === 'google' &&
          !existing.onboardingCompletedAt &&
          existing.onboardingCompleted !== true &&
          existing.onboardingCompleted !== 'true' &&
          existing.onboardingCompleted !== 1 &&
          recentAccount;

        if (explicitlyIncomplete || recentGoogleWithoutOnboarding) {
          if (recentGoogleWithoutOnboarding && !explicitlyIncomplete) {
            await setDoc(userRef, { onboardingCompleted: false }, { merge: true });
          }
          if (onSignupSuccess) {
            onSignupSuccess(userCredential.user, existing.role || role);
            return;
          }
        }
      }

      if (!userDoc.exists()) {
        const gPhoto = userCredential.user.photoURL || null;
        await cachePendingSignupProfile(userCredential.user.uid, role, AsyncStorage);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'User',
          onboardingCompleted: false,
          title: 'Coach Connect Invite Code',
          createdAt: new Date().toISOString(),
          authProvider: 'google',
          photoURL: gPhoto,
        });
        if (role === 'trainer' && gPhoto) {
          await setDoc(doc(db, 'trainers', userCredential.user.uid), { photoURL: gPhoto, avatarUrl: gPhoto }, { merge: true });
        }
        console.log('New user created via Google sign-in — routing to onboarding');
        if (onSignupSuccess) {
          onSignupSuccess(userCredential.user, role);
          return;
        }
      } else {
        await setDoc(
          userRef,
          {
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      console.log('Google sign-in successful:', userCredential.user.email);

      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      let errorMessage = 'Failed to sign in with Google. ';
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        errorMessage += 'An account already exists with this email. Please sign in with email/password first.';
      } else if (error.code === 'auth/popup-blocked') {
        errorMessage += 'Popup was blocked. Please allow popups and try again.';
      } else if (error.code === 'auth/popup-closed-by-user') {
        errorMessage += 'Sign-in was cancelled.';
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage += 'Google Sign-In is not enabled. Please enable it in Firebase Console > Authentication > Sign-in methods.';
      } else if (error.message?.includes('blocked') || error.message?.includes('disabled')) {
        errorMessage += 'Google Sign-In is blocked. Please check:\n1. Firebase Console > Authentication > Sign-in methods > Enable Google\n2. Google Cloud Console > OAuth consent screen is configured\n3. Authorized domains include your app domain';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      setErrorModal({
        title: 'Google Sign-In Failed',
        message: errorMessage,
        retryText: 'Try again',
        onRetry: () => {
          setErrorModal(null);
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
      setErrorModal({
        title: 'Apple Sign-In',
        message: 'Apple Sign-In is only available on iOS devices.',
      });
      return;
    }
    if (!auth || !db) {
      setErrorModal({ title: 'Error', message: 'Firebase is not initialized.' });
      return;
    }

    const setLoading = mode === 'signup' ? setSignupLoading : setLoginLoading;
    setIsLoadingApple(true);
    setLoading(true);

    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        setErrorModal({
          title: 'Apple Sign-In',
          message: 'Apple Sign-In is not available on this device.',
        });
        return;
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

      const appleDisplayName = buildAppleDisplayName(appleResult);
      if (appleDisplayName && !userCredential.user.displayName) {
        try {
          await updateProfile(userCredential.user, { displayName: appleDisplayName });
        } catch (profileErr) {
          console.warn('Apple updateProfile displayName:', profileErr?.message || profileErr);
        }
      }

      const resolvedName =
        appleDisplayName ||
        userCredential.user.displayName ||
        'User';
      const resolvedEmail = userCredential.user.email || appleResult.email || '';

      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);

      if (mode === 'signup') {
        if (!userDoc.exists()) {
          await cachePendingSignupProfile(userCredential.user.uid, role, AsyncStorage);
          await setDoc(userRef, {
            uid: userCredential.user.uid,
            name: resolvedName,
            email: resolvedEmail,
            onboardingCompleted: false,
            createdAt: new Date().toISOString(),
            authProvider: 'apple',
            photoURL: userCredential.user.photoURL || null,
          });
          console.log('New user created with Apple sign-up:', resolvedEmail || userCredential.user.uid, 'Role:', role);
        } else {
          const roleOk = await ensureRoleMatchesToggle(userCredential.user.uid, role);
          if (!roleOk) return;
          await setDoc(userRef, { updatedAt: new Date().toISOString() }, { merge: true });
          console.log('Existing user signed in with Apple:', resolvedEmail || userCredential.user.uid);
        }

        if (onSignupSuccess) {
          onSignupSuccess(userCredential.user, role);
        }
        return;
      }

      if (userDoc.exists()) {
        const roleOk = await ensureRoleMatchesToggle(userCredential.user.uid, role);
        if (!roleOk) return;

        const existing = userDoc.data() || {};
        const explicitlyIncomplete =
          existing.onboardingCompleted === false ||
          existing.onboardingCompleted === 'false' ||
          existing.onboardingCompleted === 0;
        const createdMs = existing.createdAt ? new Date(existing.createdAt).getTime() : NaN;
        const recentAccount =
          Number.isFinite(createdMs) && Date.now() - createdMs < 7 * 24 * 60 * 60 * 1000;
        const recentAppleWithoutOnboarding =
          existing.authProvider === 'apple' &&
          !existing.onboardingCompletedAt &&
          existing.onboardingCompleted !== true &&
          existing.onboardingCompleted !== 'true' &&
          existing.onboardingCompleted !== 1 &&
          recentAccount;

        if (explicitlyIncomplete || recentAppleWithoutOnboarding) {
          if (recentAppleWithoutOnboarding && !explicitlyIncomplete) {
            await setDoc(userRef, { onboardingCompleted: false }, { merge: true });
          }
          if (onSignupSuccess) {
            onSignupSuccess(userCredential.user, existing.role || role);
            return;
          }
        }
      }

      if (!userDoc.exists()) {
        await cachePendingSignupProfile(userCredential.user.uid, role, AsyncStorage);
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: resolvedEmail,
          name: resolvedName,
          onboardingCompleted: false,
          title: 'Coach Connect Invite Code',
          createdAt: new Date().toISOString(),
          authProvider: 'apple',
          photoURL: null,
        });
        console.log('New user created via Apple sign-in — routing to onboarding');
        if (onSignupSuccess) {
          onSignupSuccess(userCredential.user, role);
          return;
        }
      } else {
        await setDoc(userRef, { updatedAt: new Date().toISOString() }, { merge: true });
      }

      console.log('Apple sign-in successful:', resolvedEmail || userCredential.user.uid);
      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
      }
    } catch (e) {
      if (e?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      console.error('Apple auth error:', e);
      let errorMessage = mode === 'signup'
        ? 'Failed to sign up with Apple. '
        : 'Failed to sign in with Apple. ';

      if (e?.code === 'auth/account-exists-with-different-credential') {
        errorMessage += 'An account already exists with this email. Try email/password or the other sign-in method.';
      } else if (e?.code === 'auth/operation-not-allowed') {
        errorMessage += 'Apple Sign-In is not enabled. Enable it in Firebase Console > Authentication > Sign-in methods.';
      } else {
        errorMessage += e?.message || 'Please try again.';
      }

      setErrorModal({
        title: mode === 'signup' ? 'Apple Sign-Up Failed' : 'Apple Sign-In Failed',
        message: errorMessage,
        retryText: 'Try again',
        onRetry: () => {
          setErrorModal(null);
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
  const renderWelcomeView = () => (
    <RNAnimated.View style={{ flex: 1, backgroundColor: animatedBg }}>
      {/* Background glow overlay */}
      <View
        pointerEvents="none"
        style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: isDarkLanding ? 'rgba(26,5,51,0.85)' : 'rgba(124,58,237,0.04)',
        }}
      />

      {/* Top bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
        }}
      >
        <TouchableOpacity
          onPress={toggleTheme}
          activeOpacity={0.75}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            borderWidth: 1,
            backgroundColor: t.toggleBg,
            borderColor: t.toggleBorder,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isDarkLanding ? 'sunny-outline' : 'moon-outline'}
            size={18}
            color={t.toggleIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Welcome wordmark — clean card, no gradient frame; blends with landing background. */}
      <View style={{ width: '100%', alignItems: 'center', marginTop: 6, marginBottom: 8 }}>
        <View
          style={{
            width: '88%',
            maxWidth: 460,
            borderRadius: 24,
            paddingVertical: 22,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: isDarkLanding ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
          }}
        >
          <Text
            style={{
              fontSize: 38,
              fontWeight: '900',
              letterSpacing: 3,
              textAlign: 'center',
              color: t.heading,
            }}
          >
            COACH
          </Text>
          <Text
            style={{
              fontSize: 38,
              fontWeight: '900',
              letterSpacing: 3,
              textAlign: 'center',
              marginTop: -2,
              color: '#FF6B9D',
            }}
          >
            CONNECT
          </Text>

          <View
            style={{
              marginTop: 16,
              borderRadius: 999,
              paddingVertical: 11,
              paddingHorizontal: 18,
              alignSelf: 'stretch',
              maxWidth: 340,
              borderWidth: 1,
              borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(10,10,15,0.10)',
            }}
          >
            <Text
              style={{
                fontSize: 16,
                fontWeight: '800',
                letterSpacing: 0.2,
                color: t.heading,
                textAlign: 'center',
                fontStyle: 'italic',
              }}
            >
              {"\u201cOne Day or Day One!\u201d"}
            </Text>
          </View>
        </View>
      </View>

      {/* Lottie animations */}
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          marginTop: -2,
        }}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: t.lottieGlow,
            }}
          />
          <LottieView
            source={require('../assets/animations/app-flows/Guy talking to Robot _ AI Help.json')}
            autoPlay
            loop
            style={{ width: 160, height: 160 }}
          />
        </View>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: t.lottieGlow,
            }}
          />
          <LottieView
            source={require('../assets/animations/app-flows/Exercise for diet or health.json')}
            autoPlay
            loop
            style={{ width: 160, height: 160 }}
          />
        </View>
      </View>

      {/* Bottom branding + CTAs */}
      <View
        style={{
          paddingHorizontal: 24,
          alignItems: 'center',
          paddingBottom: insets.bottom + 32,
        }}
      >
        <Text
          style={{
            fontSize: 34,
            fontWeight: '800',
            textAlign: 'center',
            lineHeight: 42,
            letterSpacing: 0.3,
            color: t.heading,
            marginBottom: 12,
          }}
        >
          {'Trainers and clients,\nfinally in sync.'}
        </Text>

        <Text
          style={{
            fontSize: 15,
            textAlign: 'center',
            lineHeight: 22,
            color: t.subtitle,
            marginBottom: 32,
          }}
        >
          One platform for programming, tracking, and communication.
        </Text>

        <LinearGradient
          colors={AUTH_CTA_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            alignSelf: 'center',
            width: '80%',
            maxWidth: 400,
            borderRadius: 16,
            padding: 2,
            marginTop: 16,
            marginBottom: 20,
            ...(Platform.OS === 'ios'
              ? {
                  shadowColor: '#C1265A',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.35,
                  shadowRadius: 18,
                }
              : {}),
          }}
        >
          <TouchableOpacity
            onPress={onGetStarted}
            activeOpacity={0.88}
            style={{
              borderRadius: 14,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDarkLanding ? 'rgba(10,10,15,0.92)' : 'rgba(255,255,255,0.96)',
            }}
          >
            <Text
              style={{
                color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
                fontSize: 17,
                fontWeight: '800',
                letterSpacing: 0.3,
              }}
            >
              Get Started
            </Text>
          </TouchableOpacity>
        </LinearGradient>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 14, color: t.signinMuted }}>
            Already have an account?{' '}
          </Text>
          <TouchableOpacity onPress={onSignIn} activeOpacity={0.7}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: '600',
                color: t.signinLink,
              }}
            >
              Sign In
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </RNAnimated.View>
  );

  const renderRoleSelectionView = () => null;

  const renderSignupView = () => {
    const placeholderTextColor = isDarkLanding ? 'rgba(255,255,255,0.35)' : '#6B7280';

    const signupStyles = StyleSheet.create({
      container: {
        flex: 1,
        backgroundColor: t.bg,
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
        color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
        letterSpacing: 2,
        marginBottom: spacing.sm,
      },
      subtitle: {
        fontSize: 16,
        color: isDarkLanding ? '#C1265A' : (colors.accent ?? '#C1265A'),
        textAlign: 'center',
      },
      form: {
        backgroundColor: isDarkLanding ? colors.surfaceSecondary : '#FFFFFF',
        padding: spacing.lg,
        borderRadius: 16,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(88, 86, 214, 0.2)',
        shadowColor: '#5856D6',
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
        color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
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
        borderColor: '#5856D6',
        backgroundColor: 'rgba(88, 86, 214, 0.2)',
      },
      roleButtonText: {
        fontSize: 14,
        color: '#C1265A',
        fontWeight: '600',
      },
      roleButtonTextActive: {
        color: '#5856D6',
        fontWeight: '700',
      },
      signupButton: {
        backgroundColor: '#5856D6',
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#5856D6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
      signupButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
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
        backgroundColor: isDarkLanding ? '#FFFFFF' : '#000000',
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
        color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
        fontWeight: '600',
        marginLeft: spacing.sm,
      },
      appleButtonText: {
        fontSize: 16,
        color: isDarkLanding ? '#000000' : '#FFFFFF',
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
        tintColor: isDarkLanding ? '#000000' : '#FFFFFF',
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
        color: '#5856D6',
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
            <BrandLogo width={148} style={{ marginBottom: 8 }} />
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
              backgroundColor: t.toggleBg,
              borderColor: t.toggleBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 12,
            }}
          >
            <Ionicons
              name={isDarkLanding ? 'sunny-outline' : 'moon-outline'}
              size={18}
              color={t.toggleIcon}
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
                  placeholder="Create a password (min. 6 characters)"
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
                    setErrorModal({
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

              <TouchableOpacity
                style={[signupStyles.appleButton, (signupLoading || isLoadingApple) && { opacity: 0.6 }]}
                onPress={() => handleAppleAuth({ mode: 'signup' })}
                disabled={signupLoading || isLoadingApple}
              >
                <Image source={appleLogo} style={signupStyles.appleIcon} />
                
                
                
                
                <Text style={signupStyles.appleButtonText}>Sign up with Apple</Text>
              </TouchableOpacity>
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
        backgroundColor: t.bg,
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
        color: isDarkLanding ? '#FFFFFF' : (colors.text ?? '#000000'),
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
        shadowColor: '#5856D6',
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
        color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
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
        backgroundColor: '#5856D6',
        padding: spacing.md,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: spacing.md,
        marginBottom: spacing.md,
        shadowColor: '#5856D6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
      },
      loginButtonText: {
        fontSize: 16,
        color: '#FFFFFF',
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
        color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
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
        color: '#5856D6',
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
        color: '#5856D6',
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
                />
                {loginErrors.password && <Text style={loginStyles.errorText}>{loginErrors.password}</Text>}
              </View>

              <TouchableOpacity 
                style={[loginStyles.loginButton, loginLoading && { opacity: 0.6 }]} 
                onPress={handleLogin}
                disabled={loginLoading}
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
                    setErrorModal({
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

  // ==================== LIQUID GLASS AUTH (iOS 18-style) ====================
  const renderSignupViewLiquid = () => {
    const onGoogle = () => {
      if (!request) {
        setErrorModal({
          title: GOOGLE_OAUTH_NOT_READY_TITLE,
          message: GOOGLE_OAUTH_NOT_READY_MESSAGE,
        });
        return;
      }
      setIsLoadingGoogle(true);
      promptAsync();
    };

    const onApple = () => handleAppleAuth({ mode: 'signup' });

    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 32,
              paddingHorizontal: 24,
              alignItems: 'center',
              maxWidth: 400,
              alignSelf: 'center',
              width: '100%',
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back + wordmark */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: 24,
              }}
            >
              <TouchableOpacity
                onPress={() => setCurrentView('welcome')}
                activeOpacity={0.8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)',
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={20} color={t.heading} />
              </TouchableOpacity>

              <BrandLogo width={108} />

              <TouchableOpacity
                onPress={toggleTheme}
                activeOpacity={0.75}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1,
                  backgroundColor: t.toggleBg,
                  borderColor: t.toggleBorder,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isDarkLanding ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={t.toggleIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Heading */}
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: t.heading,
                textAlign: 'center',
                letterSpacing: -0.8,
                marginBottom: 8,
              }}
            >
              Create account
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontSize: 14,
                color: t.subtitle,
                textAlign: 'center',
                marginBottom: 28,
              }}
            >
              Choose your role and get started.
            </Text>

            {/* Role toggle */}
            <RoleToggle role={role} onRoleChange={setRole} isDark={isDarkLanding} />

            {/* Fields */}
            <View style={{ width: '100%' }}>
              <FloatingInput
                label="Full Name"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (signupErrors.name) setSignupErrors({ ...signupErrors, name: '' });
                }}
                placeholder="John Doe"
                isDark={isDarkLanding}
              />
              <FloatingInput
                label="Email Address"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (signupErrors.email) setSignupErrors({ ...signupErrors, email: '' });
                }}
                placeholder="name@example.com"
                keyboardType="email-address"
                isDark={isDarkLanding}
              />
              <FloatingInput
                label="Password"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (signupErrors.password) setSignupErrors({ ...signupErrors, password: '' });
                }}
                placeholder="••••••••"
                secureTextEntry
                isDark={isDarkLanding}
              />
              <FloatingInput
                label="Confirm Password"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (signupErrors.confirmPassword) {
                    setSignupErrors({ ...signupErrors, confirmPassword: '' });
                  }
                }}
                placeholder="••••••••"
                secureTextEntry
                isDark={isDarkLanding}
              />

              {signupErrors.name || signupErrors.email || signupErrors.password || signupErrors.confirmPassword ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#FCA5A5',
                    marginTop: 4,
                    marginBottom: 8,
                  }}
                >
                  Please fix the highlighted fields and try again.
                </Text>
              ) : null}
            </View>

            {/* Create Account CTA — gradient ring, not solid slab */}
            <LinearGradient
              colors={AUTH_CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                alignSelf: 'center',
                width: '80%',
                maxWidth: 400,
                borderRadius: 16,
                padding: 2,
                marginTop: 16,
                marginBottom: 24,
                opacity: signupLoading ? 0.7 : 1,
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: '#C1265A',
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.35,
                      shadowRadius: 20,
                    }
                  : {}),
              }}
            >
              <TouchableOpacity
                onPress={handleSignup}
                activeOpacity={0.88}
                disabled={signupLoading}
                style={{
                  borderRadius: 14,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkLanding ? 'rgba(10,10,15,0.94)' : 'rgba(255,255,255,0.97)',
                }}
              >
                <Text
                  style={{
                    color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
                    fontSize: 17,
                    fontWeight: '800',
                    letterSpacing: 0.2,
                  }}
                >
                  Create Account
                </Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* OR divider */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.14)',
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '500',
                  color: isDarkLanding ? 'rgba(255,255,255,0.3)' : 'rgba(15,23,42,0.35)',
                  marginHorizontal: 12,
                }}
              >
                OR
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.14)',
                }}
              />
            </View>

            {/* Apple + Google */}
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                width: '100%',
                marginBottom: 32,
              }}
            >
              <TouchableOpacity
                onPress={onApple}
                activeOpacity={0.8}
                disabled={signupLoading || isLoadingApple}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.86)',
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: signupLoading || isLoadingApple ? 0.6 : 1,
                }}
              >
                <Image
                  source={appleLogo}
                  style={{ width: 20, height: 20, resizeMode: 'contain', tintColor: isDarkLanding ? '#FFFFFF' : '#0F172A' }}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDarkLanding ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Apple
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onGoogle}
                activeOpacity={0.8}
                disabled={signupLoading || isLoadingGoogle}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.86)',
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Image
                  source={googleIcon}
                  style={{ width: 20, height: 20, resizeMode: 'contain' }}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDarkLanding ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Google
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign In link */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 14,
                  color: isDarkLanding ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.55)',
                }}
              >
                Already have an account?{' '}
              </Text>
              <TouchableOpacity onPress={onSignIn} activeOpacity={0.7}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: isDarkLanding ? '#C084FC' : '#C1265A',
                  }}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  };

  const renderLoginViewLiquid = () => {
    const onGoogle = () => {
      if (!request) {
        setErrorModal({
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
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 40,
              paddingBottom: insets.bottom + 32,
              paddingHorizontal: 24,
              alignItems: 'center',
              maxWidth: 400,
              alignSelf: 'center',
              width: '100%',
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Back + wordmark + theme */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: 24,
              }}
            >
              <TouchableOpacity
                onPress={() => setCurrentView('welcome')}
                activeOpacity={0.8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)',
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="chevron-back" size={20} color={t.heading} />
              </TouchableOpacity>

              <BrandLogo width={108} />

              <TouchableOpacity
                onPress={toggleTheme}
                activeOpacity={0.75}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)',
                  backgroundColor: t.toggleBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isDarkLanding ? 'sunny-outline' : 'moon-outline'}
                  size={18}
                  color={t.toggleIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Heading */}
            <Text
              style={{
                fontSize: 30,
                fontWeight: '800',
                color: t.heading,
                textAlign: 'center',
                letterSpacing: -0.8,
                marginBottom: 8,
              }}
            >
              Sign in
            </Text>

            {/* Subtitle */}
            <Text
              style={{
                fontSize: 14,
                color: t.subtitle,
                textAlign: 'center',
                marginBottom: 28,
              }}
            >
              Enter your details or continue with Apple/Google.
            </Text>

            {/* Role toggle */}
            <RoleToggle role={role} onRoleChange={setRole} isDark={isDarkLanding} />

            {/* Fields */}
            <View style={{ width: '100%' }}>
              <FloatingInput
                label="Email Address"
                value={loginEmail}
                onChangeText={(text) => {
                  setLoginEmail(text);
                  if (loginErrors.email) setLoginErrors({ ...loginErrors, email: '' });
                }}
                placeholder="name@example.com"
                keyboardType="email-address"
                isDark={isDarkLanding}
              />
              {loginErrors.email ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#FCA5A5',
                    marginTop: -6,
                    marginBottom: 8,
                  }}
                >
                  {loginErrors.email}
                </Text>
              ) : null}

              <FloatingInput
                label="Password"
                value={loginPassword}
                onChangeText={(text) => {
                  setLoginPassword(text);
                  if (loginErrors.password) setLoginErrors({ ...loginErrors, password: '' });
                }}
                placeholder="••••••••"
                secureTextEntry
                isDark={isDarkLanding}
              />
              {loginErrors.password ? (
                <Text
                  style={{
                    fontSize: 12,
                    color: '#FCA5A5',
                    marginTop: -6,
                    marginBottom: 8,
                  }}
                >
                  {loginErrors.password}
                </Text>
              ) : null}
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => onForgotPasswordFlowPress?.()}
              activeOpacity={0.8}
              disabled={loginLoading}
              style={{ alignSelf: 'flex-end', marginBottom: 16 }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: isDarkLanding ? '#A5B4FC' : '#7C3AED',
                  fontWeight: '700',
                }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>

            {/* Sign In CTA — gradient ring */}
            <LinearGradient
              colors={AUTH_CTA_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                alignSelf: 'center',
                width: '80%',
                maxWidth: 400,
                borderRadius: 16,
                padding: 2,
                marginTop: 16,
                marginBottom: 24,
                opacity: loginLoading ? 0.7 : 1,
                ...(Platform.OS === 'ios'
                  ? {
                      shadowColor: '#C1265A',
                      shadowOffset: { width: 0, height: 10 },
                      shadowOpacity: 0.32,
                      shadowRadius: 20,
                    }
                  : {}),
              }}
            >
              <TouchableOpacity
                onPress={handleLogin}
                activeOpacity={0.88}
                disabled={loginLoading}
                style={{
                  borderRadius: 14,
                  height: 52,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isDarkLanding ? 'rgba(10,10,15,0.94)' : 'rgba(255,255,255,0.97)',
                }}
              >
                <Text
                  style={{
                    color: isDarkLanding ? '#FFFFFF' : '#0A0A0F',
                    fontSize: 17,
                    fontWeight: '800',
                    letterSpacing: 0.2,
                  }}
                >
                  Sign In
                </Text>
              </TouchableOpacity>
            </LinearGradient>

            {/* OR divider */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                width: '100%',
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)',
                }}
              />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDarkLanding ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.4)',
                  marginHorizontal: 12,
                }}
              >
                OR
              </Text>
              <View
                style={{
                  flex: 1,
                  height: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.12)',
                }}
              />
            </View>

            {/* Apple + Google */}
            <View
              style={{
                flexDirection: 'row',
                gap: 12,
                width: '100%',
                marginBottom: 32,
              }}
            >
              <TouchableOpacity
                onPress={onApple}
                activeOpacity={0.8}
                disabled={loginLoading || isLoadingApple}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.86)',
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: loginLoading || isLoadingApple ? 0.6 : 1,
                }}
              >
                <Image
                  source={appleLogo}
                  style={{
                    width: 20,
                    height: 20,
                    resizeMode: 'contain',
                    tintColor: isDarkLanding ? '#FFFFFF' : '#0F172A',
                  }}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDarkLanding ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Apple
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onGoogle}
                activeOpacity={0.8}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 12,
                  borderWidth: 1,
                  backgroundColor: isDarkLanding ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.86)',
                  borderColor: isDarkLanding ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                }}
              >
                <Image
                  source={googleIcon}
                  style={{ width: 20, height: 20, resizeMode: 'contain' }}
                />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: isDarkLanding ? '#FFFFFF' : '#0F172A',
                  }}
                >
                  Google
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up link */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 14,
                  color: isDarkLanding ? 'rgba(255,255,255,0.5)' : 'rgba(15,23,42,0.55)',
                }}
              >
                Don’t have an account?{' '}
              </Text>
              <TouchableOpacity onPress={() => setCurrentView('signup')} activeOpacity={0.7}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '800',
                    color: isDarkLanding ? '#C084FC' : '#C1265A',
                  }}
                >
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
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
          : currentView === 'login'
            ? renderLoginViewLiquid()
            : null}
      <ErrorModal
        visible={!!errorModal}
        title={errorModal?.title ?? 'Error'}
        message={errorModal?.message ?? ''}
        icon={errorModal?.icon}
        onDismiss={() => setErrorModal(null)}
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
    shadowColor: '#5856D6',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
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
    textShadowColor: '#FF6B9D',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  headlineLight: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 4,
    color: 'rgba(0,0,0,0.87)',
    lineHeight: 56,
    textShadowColor: '#FF6B9D',
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

