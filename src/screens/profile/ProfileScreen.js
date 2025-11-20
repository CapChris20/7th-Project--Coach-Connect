import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { auth } from '../../services/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/config';

export default function ProfileScreen({ onSignOut, onClose }) {
  const { colors, typography, spacing } = useTheme();
  const [user, setUser] = useState(auth?.currentUser || null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Get user data from Firestore
      if (db) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              if (onSignOut) {
                onSignOut();
              }
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#0F0B1E', // APP_THEME: Dark purple background
    },
    scrollContent: {
      flexGrow: 1,
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xl,
      paddingTop: spacing.md,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    closeButton: {
      padding: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 12,
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
    },
    closeButtonText: {
      fontSize: 16,
      color: '#8B5CF6',
      fontWeight: '700',
    },
    profileSection: {
      alignItems: 'center',
      marginBottom: spacing.xl,
    },
    avatar: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#8B5CF6',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      borderWidth: 3,
      borderColor: 'rgba(139, 92, 246, 0.5)',
    },
    avatarText: {
      fontSize: 40,
      color: '#FFFFFF',
      fontWeight: '700',
    },
    userName: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: spacing.xs,
    },
    userEmail: {
      fontSize: 14,
      color: '#A78BFA',
      marginBottom: spacing.sm,
    },
    userRole: {
      fontSize: 16,
      color: '#8B5CF6',
      fontWeight: '600',
      backgroundColor: 'rgba(139, 92, 246, 0.2)',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: 20,
    },
    card: {
      backgroundColor: '#1E1B2E',
      borderRadius: 16,
      padding: spacing.lg,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(139, 92, 246, 0.2)',
      shadowColor: '#8B5CF6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: spacing.md,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(139, 92, 246, 0.1)',
    },
    infoLabel: {
      fontSize: 14,
      color: '#A78BFA',
      fontWeight: '500',
    },
    infoValue: {
      fontSize: 14,
      color: '#FFFFFF',
      fontWeight: '600',
    },
    signOutButton: {
      backgroundColor: '#EF4444',
      padding: spacing.md,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: spacing.lg,
      shadowColor: '#EF4444',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    signOutButtonText: {
      fontSize: 16,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  // Get user initials for avatar
  const getInitials = (name) => {
    if (!name) return 'U';
    const names = name.split(' ');
    if (names.length >= 2) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const displayName = userData?.name || user?.displayName || 'User';
  const userEmail = user?.email || 'No email';
  const userRole = userData?.role || 'client';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="light" backgroundColor="#0F0B1E" />
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          {onClose && (
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            {user?.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={{ width: 100, height: 100, borderRadius: 50 }}
              />
            ) : (
              <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
            )}
          </View>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{userEmail}</Text>
          <Text style={styles.userRole}>
            {userRole === 'trainer' ? '🏋️ Trainer' : '💪 Client'}
          </Text>
        </View>

        {/* Account Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Account Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>User ID</Text>
            <Text style={[styles.infoValue, { fontSize: 10 }]} numberOfLines={1}>
              {user?.uid?.substring(0, 8)}...
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{userEmail}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Type</Text>
            <Text style={styles.infoValue}>
              {userRole === 'trainer' ? 'Trainer' : 'Client'}
            </Text>
          </View>
          {userData?.createdAt && (
            <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {new Date(userData.createdAt).toLocaleDateString()}
              </Text>
            </View>
          )}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
