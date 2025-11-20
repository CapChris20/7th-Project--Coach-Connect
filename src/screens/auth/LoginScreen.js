import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { signInWithEmailAndPassword, signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/config';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Complete web browser auth session for Google OAuth
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation, onLoginSuccess }) {
  const { colors, typography, spacing } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Google OAuth configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: '421005574501-v4090b84ff5521cioeb2jsg5mqj2plhn.apps.googleusercontent.com',
    iosClientId: '421005574501-v4090b84ff5521cioeb2jsg5mqj2plhn.apps.googleusercontent.com',
    // Using same client ID for iOS (for development)
    // For production, create separate iOS OAuth client in Google Cloud Console
  });

  // Handle Google OAuth response
  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response.authentication);
    } else if (response?.type === 'error') {
      setLoading(false);
      console.error('Google OAuth error:', response.error);
      Alert.alert(
        'Google Sign-In Error',
        `Error: ${response.error?.message || 'Unknown error'}\n\nPlease ensure:\n1. Google Sign-In is enabled in Firebase Console\n2. OAuth consent screen is configured in Google Cloud Console\n3. Authorized domains are set correctly`
      );
    }
  }, [response]);

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Password validation
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Email/Password login
  const handleLogin = async () => {
    if (!validateForm()) return;
    
    if (!auth) {
      Alert.alert('Error', 'Firebase authentication is not initialized. Please check your configuration.');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      console.log('Login successful:', userCredential.user.email);
      
      // Navigate to main app (MAIN_APP_SCREEN)
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
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async (authentication) => {
    if (!auth || !db) {
      Alert.alert('Error', 'Firebase is not initialized.');
      return;
    }

    setLoading(true);
    try {
      const { id_token, access_token } = authentication;
      
      // Use id_token for Firebase authentication
      if (!id_token) {
        throw new Error('No ID token received from Google');
      }
      
      const credential = GoogleAuthProvider.credential(id_token, access_token);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Check if user document exists, if not create it
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // Create user document for new Google sign-in users
        await setDoc(userRef, {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          name: userCredential.user.displayName || 'User',
          role: 'client', // Default role
          createdAt: new Date().toISOString(),
          authProvider: 'google',
        });
        console.log('User document created for Google sign-in');
      }
      
      console.log('Google sign-in successful:', userCredential.user.email);
      
      // Navigate to main app
      if (onLoginSuccess) {
        onLoginSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      let errorMessage = 'Failed to sign in with Google. ';
      
      // Provide helpful error messages
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
      
      Alert.alert('Google Sign-In Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0F0B1E', // APP_THEME: Using dark purple background from app theme
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    header: {
      alignItems: 'center',
      marginBottom: spacing.xxl,
    },
    logo: {
      fontSize: 36,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 2,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: 16,
      color: '#A78BFA',
      textAlign: 'center',
    },
    form: {
      backgroundColor: '#1E1B2E',
      padding: spacing.lg,
      borderRadius: 16,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.2)',
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    formTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    inputContainer: {
      marginBottom: spacing.md,
    },
    inputLabel: {
      fontSize: 14,
      color: '#FFFFFF',
      marginBottom: spacing.sm,
      fontWeight: '600',
    },
    input: {
      borderWidth: 1,
      borderColor: errors.email || errors.password ? '#F87171' : 'rgba(139, 92, 246, 0.3)',
      borderRadius: 12,
      padding: spacing.md,
      fontSize: 16,
      color: '#FFFFFF',
      backgroundColor: '#2A2342',
    },
    errorText: {
      fontSize: 12,
      color: '#F87171',
      marginTop: spacing.xs,
    },
    loginButton: {
      backgroundColor: '#8B5CF6',
      padding: spacing.md,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.md,
      shadowColor: '#8B5CF6',
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
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    dividerText: {
      marginHorizontal: spacing.md,
      fontSize: 14,
      color: '#A78BFA',
    },
    googleButton: {
      flexDirection: 'row',
      backgroundColor: '#2A2342',
      padding: spacing.md,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.2)',
    },
    googleButtonText: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '600',
      marginLeft: spacing.sm,
    },
    forgotPassword: {
      alignItems: 'center',
      marginTop: spacing.sm,
    },
    forgotPasswordText: {
      fontSize: 14,
      color: '#8B5CF6',
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
      color: '#A78BFA',
      marginRight: spacing.sm,
    },
    signupLink: {
      fontSize: 14,
      color: '#8B5CF6',
      fontWeight: '700',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>ANATROX</Text>
            <Text style={styles.subtitle}>Your AI Fitness Companion</Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  if (errors.email) setErrors({ ...errors, email: '' });
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                secureTextEntry
                editable={!loading}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <TouchableOpacity 
              style={[styles.loginButton, loading && { opacity: 0.6 }]} 
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.forgotPassword}
              onPress={() => navigation?.navigate('ForgotPassword')}
              disabled={loading}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account?</Text>
              <TouchableOpacity 
                onPress={() => navigation?.navigate('Signup')}
                disabled={loading}
              >
                <Text style={styles.signupLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={[styles.googleButton, (loading || !request) && { opacity: 0.6 }]}
              onPress={() => {
                if (!request) {
                  Alert.alert(
                    'Google Sign-In Not Ready',
                    'Google Sign-In is not configured. Please check:\n\n1. Firebase Console > Authentication > Sign-in methods > Enable Google\n2. Google Cloud Console > OAuth consent screen\n3. Add authorized domains'
                  );
                  return;
                }
                promptAsync();
              }}
              disabled={loading}
            >
              <Text style={{ fontSize: 20 }}>🔵</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
