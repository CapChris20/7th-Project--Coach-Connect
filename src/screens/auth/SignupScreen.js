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
import { createUserWithEmailAndPassword, signInWithCredential, GoogleAuthProvider, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase/config';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export default function SignupScreen({ navigation, onSignupSuccess }) {
  const { colors, typography, spacing } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('client'); // 'trainer' or 'client'
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
      handleGoogleSignUp(response.authentication);
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
    
    // Name validation
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
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
    
    // Confirm password validation
    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Email/Password signup
  const handleSignup = async () => {
    if (!validateForm()) return;
    
    if (!auth || !db) {
      Alert.alert('Error', 'Firebase is not initialized. Please check your configuration.');
      return;
    }

    setLoading(true);
    try {
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Update user profile with name
      await updateProfile(userCredential.user, {
        displayName: name.trim(),
      });
      
      // Save user data to Firestore with role
      const userData = {
        uid: userCredential.user.uid,
        name: name.trim(),
        email: email.trim(),
        role: role, // 'trainer' or 'client'
        createdAt: new Date().toISOString(),
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      
      console.log('Signup successful:', userCredential.user.email, 'Role:', role);
      
      // Navigate to main app (MAIN_APP_SCREEN)
      if (onSignupSuccess) {
        onSignupSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Signup error:', error);
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
      
      Alert.alert('Signup Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-Up
  const handleGoogleSignUp = async (authentication) => {
    if (!auth || !db) {
      Alert.alert('Error', 'Firebase is not initialized.');
      return;
    }

    setLoading(true);
    try {
      const { id_token, access_token } = authentication;
      
      if (!id_token) {
        throw new Error('No ID token received from Google');
      }
      
      const credential = GoogleAuthProvider.credential(id_token, access_token);
      const userCredential = await signInWithCredential(auth, credential);
      
      // Check if user document exists
      const userRef = doc(db, 'users', userCredential.user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // New user - create document with selected role
        const userData = {
          uid: userCredential.user.uid,
          name: userCredential.user.displayName || 'User',
          email: userCredential.user.email || '',
          role: role, // Use selected role from signup screen
          createdAt: new Date().toISOString(),
          authProvider: 'google',
        };
        await setDoc(userRef, userData);
        console.log('New user created with Google sign-up:', userCredential.user.email, 'Role:', role);
      } else {
        // Existing user - just update if needed
        await setDoc(userRef, {
          updatedAt: new Date().toISOString(),
        }, { merge: true });
        console.log('Existing user signed in with Google:', userCredential.user.email);
      }
      
      // Navigate to main app
      if (onSignupSuccess) {
        onSignupSuccess(userCredential.user);
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
      
      Alert.alert('Google Sign-Up Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0F0B1E', // APP_THEME: Using dark purple background
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
      marginBottom: spacing.xl,
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
      borderColor: errors.name || errors.email || errors.password || errors.confirmPassword ? '#F87171' : 'rgba(139, 92, 246, 0.3)',
      borderRadius: 12,
      padding: spacing.md,
      fontSize: 16,
      color: '#FFFFFF',
      backgroundColor: '#2A2342',
      minHeight: 50, // Ensure inputs are easily tappable
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
      color: '#FFFFFF',
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
      borderColor: 'rgba(139, 92, 246, 0.3)',
      backgroundColor: '#2A2342',
      alignItems: 'center',
    },
    roleButtonActive: {
      borderColor: '#8B5CF6',
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    roleButtonText: {
      fontSize: 14,
      color: '#A78BFA',
      fontWeight: '600',
    },
    roleButtonTextActive: {
      color: '#FFFFFF',
      fontWeight: '700',
    },
    signupButton: {
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
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    footerText: {
      fontSize: 14,
      color: '#A78BFA',
      marginRight: spacing.sm,
    },
    loginLink: {
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
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>ANATROX</Text>
            <Text style={styles.subtitle}>Create Your Account</Text>
          </View>

          {/* Signup Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Get Started</Text>
            
            {/* Role Selection */}
            <View style={styles.roleContainer}>
              <Text style={styles.roleLabel}>I am a:</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[styles.roleButton, role === 'client' && styles.roleButtonActive]}
                  onPress={() => setRole('client')}
                  disabled={loading}
                >
                  <Text style={[styles.roleButtonText, role === 'client' && styles.roleButtonTextActive]}>
                    💪 Client
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleButton, role === 'trainer' && styles.roleButtonActive]}
                  onPress={() => setRole('trainer')}
                  disabled={loading}
                >
                  <Text style={[styles.roleButtonText, role === 'trainer' && styles.roleButtonTextActive]}>
                    🏋️ Trainer
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#6B7280"
                value={name}
                onChangeText={(text) => {
                  setName(text);
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                autoCapitalize="words"
                editable={!loading}
              />
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

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
                placeholder="Create a password (min. 6 characters)"
                placeholderTextColor="#6B7280"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) setErrors({ ...errors, password: '' });
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!loading}
                returnKeyType="next"
              />
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                placeholderTextColor="#6B7280"
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: '' });
                }}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="password"
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
              {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
            </View>

            <TouchableOpacity 
              style={[styles.signupButton, loading && { opacity: 0.6 }]} 
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.signupButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-Up Button */}
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
              <Text style={styles.googleButtonText}>Sign up with Google</Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity 
              onPress={() => navigation?.navigate('Login')}
              disabled={loading}
            >
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
      </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
