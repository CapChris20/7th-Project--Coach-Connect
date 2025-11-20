/**
 * ANATROX - AI Fitness Coach App
 */
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, Animated, Easing, ScrollView } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import SettingsScreen from './src/screens/profile/SettingsScreen';
import ChatListScreen from './src/screens/chat/ChatListScreen';
import ChatScreen from './src/screens/chat/ChatScreen';
import BottomNavBar from './src/components/navigation/BottomNavBar';
import CreateModal from './src/components/common/CreateModal';
import NavIcon from './src/components/common/NavIcon';
import LoginScreen from './src/screens/auth/LoginScreen';
import SignupScreen from './src/screens/auth/SignupScreen';
import ForgotPasswordScreen from './src/screens/auth/ForgotPasswordScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';
import OnboardingScreen from './src/screens/onboarding/OnboardingScreen';
import { auth, db } from './src/services/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { loadApiKey } from './src/services/ai/apiKeyService';
import { getUnreadMessageCount, subscribeToUnreadCount } from './src/services/firebase/trainerMessaging';

// Minimal, premium animated splash built with RN Animated API
function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current; // container fade
  const scale = useRef(new Animated.Value(0.8)).current; // overall scale
  const translateY = useRef(new Animated.Value(12)).current; // subtle rise
  const tilt = useRef(new Animated.Value(0)).current; // emoji tilt control
  const titleOpacity = useRef(new Animated.Value(0)).current; // staggered title
  const taglineOpacity = useRef(new Animated.Value(0)).current; // staggered tagline

  useEffect(() => {
    // 6.5s premium sequence:
    // 0-1.2s: Fade in + scale up slightly + rise
    // 1.2-2.2s: Settle with a gentle spring
    // 2.2-3.4s: Emoji micro-tilt left->right
    // 3.4-5.0s: Subtle pulse to 1.03 and back
    // 4.2-5.4s: Staggered text reveal (title then tagline)
    // 5.4-6.5s: Calm hold before navigation
    const intro = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1.06,
        duration: 900,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 900,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);

    const settle = Animated.spring(scale, {
      toValue: 1,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    });

    const tiltLeft = Animated.timing(tilt, {
      toValue: -1,
      duration: 500,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const tiltRight = Animated.timing(tilt, {
      toValue: 1,
      duration: 500,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const tiltCenter = Animated.timing(tilt, {
      toValue: 0,
      duration: 350,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });

    const pulseUp = Animated.timing(scale, {
      toValue: 1.03,
      duration: 500,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    const pulseDown = Animated.timing(scale, {
      toValue: 1,
      duration: 550,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });

    const revealTitle = Animated.timing(titleOpacity, {
      toValue: 1,
      duration: 500,
      delay: 2200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    const revealTagline = Animated.timing(taglineOpacity, {
      toValue: 1,
      duration: 600,
      delay: 2600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

    Animated.sequence([
      intro,
      settle,
      Animated.sequence([tiltLeft, tiltRight, tiltCenter]),
      Animated.sequence([pulseUp, pulseDown, pulseUp, pulseDown]),
      Animated.parallel([revealTitle, revealTagline]),
      Animated.delay(900),
    ]).start();

    const timer = setTimeout(() => {
      onFinish && onFinish();
    }, 6500); // Navigate to main app after 6.5s

    return () => clearTimeout(timer);
  }, [onFinish, opacity, scale]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000', // Pure black for premium look
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 60,
      marginBottom: 16,
    },
    title: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#FFFFFF',
      letterSpacing: 4,
    },
    tagline: {
      marginTop: 8,
      fontSize: 16,
      color: '#9DA3AF', // Light gray
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <Animated.View style={{ alignItems: 'center', opacity, transform: [{ scale }, { translateY }] }}>
        <Animated.Text
          style={{
            ...styles.emoji,
            transform: [
              {
                rotate: tilt.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ['-6deg', '6deg'],
                }),
              },
            ],
          }}
        >
          💪
        </Animated.Text>
        <Animated.Text style={{ ...styles.title, opacity: titleOpacity }}>ANATROX</Animated.Text>
        <Animated.Text style={{ ...styles.tagline, opacity: taglineOpacity }}>
          Your AI Fitness Coach
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

function AppContent({ user }) {
  const { colors, typography, spacing, isDark } = useTheme();
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [showNutrition, setShowNutrition] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userRole, setUserRole] = useState('client');
  const [userData, setUserData] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const fabAnim = useRef(new Animated.Value(0)).current;

  // Load user role from Firestore
  useEffect(() => {
    if (user && db) {
      const loadUserData = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setUserRole(data.role || 'client');
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };
      loadUserData();
    }
  }, [user]);

  // Subscribe to unread message count
  useEffect(() => {
    if (!user || !user.uid) return;

    // Initial count
    getUnreadMessageCount(user.uid).then(count => {
      setUnreadMessageCount(count);
    });

    // Subscribe to real-time updates
    const unsubscribe = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadMessageCount(count);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
      overflow: 'visible', // Allow floating button to be visible
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.6)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderBottomWidth: 1,
      borderBottomColor: isDark 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: 1.2,
      textShadowColor: isDark ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.2)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 6,
    },
    settingsButton: {
      padding: spacing.xs,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.25)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    settingsIcon: {
      fontSize: 22,
      color: colors.primary,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
    },
    greetingSection: {
      marginBottom: spacing.lg,
      padding: spacing.lg,
      borderRadius: 24,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    greetingText: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs,
      letterSpacing: 0.5,
    },
    welcomeText: {
      fontSize: 36,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.xs,
      letterSpacing: 0.8,
      textShadowColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    subtitleText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: 24,
    },
    mainContent: {
      flex: 1,
    },
    fab: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: isDark 
        ? 'rgba(255, 255, 255, 0.3)' 
        : 'rgba(255, 255, 255, 0.4)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 20,
      elevation: 16,
    },
    fabText: {
      fontSize: 28,
      color: colors.white,
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    actionsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    actionCard: {
      width: '47%',
      minWidth: 140,
      padding: spacing.lg,
      borderRadius: 20,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    actionEmoji: {
      fontSize: 36,
      marginBottom: spacing.sm,
    },
    actionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.xs / 2,
      textAlign: 'center',
    },
    actionSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    sectionCard: {
      padding: spacing.lg,
      borderRadius: 20,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      marginBottom: spacing.md,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
    },
    activityItem: {
      paddingVertical: spacing.md,
    },
    activityText: {
      fontSize: 15,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    activitySubtext: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
    },
    statItem: {
      alignItems: 'center',
    },
    statValue: {
      fontSize: 32,
      fontWeight: '800',
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    statLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });

  useEffect(() => {
    // Gentle hover animation for the floating button
    Animated.loop(
      Animated.sequence([
        Animated.timing(fabAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(fabAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [fabAnim]);

  if (showProfile) {
    return (
      <ProfileScreen
        onClose={() => setShowProfile(false)}
        onSignOut={() => {
          // User will be signed out and auth state will change
          // App.js will automatically show login screen
          setShowProfile(false);
        }}
      />
    );
  }

  if (showSettings) {
    return <SettingsScreen onClose={() => setShowSettings(false)} />;
  }

  // Handle GPT chat navigation (for floating button)
  const handleOpenChatList = () => {
    setShowChatList(true);
    setShowMessages(false);
    setCurrentChatId(null);
  };

  const handleSelectChat = (chatId) => {
    if (chatId) {
      setCurrentChatId(chatId);
      setShowChatList(false);
      setShowMessages(true);
    }
  };

  const handleCreateNewChat = () => {
    // Set to null to trigger new chat creation
    setCurrentChatId(null);
    setShowChatList(false);
    setShowMessages(true);
  };

  const handleNewChatCreated = (newChatId) => {
    // Update the current chat ID when a new chat is created
    if (newChatId) {
      setCurrentChatId(newChatId);
    }
  };

  const handleCloseChat = () => {
    setShowMessages(false);
    setCurrentChatId(null);
  };

  const handleBackToChatList = () => {
    setShowMessages(false);
    setShowChatList(true);
    // Don't clear currentChatId here, so we can highlight it in the list
  };

  if (showChatList) {
    return (
      <ChatListScreen
        onClose={() => {
          setShowChatList(false);
        }}
        onSelectChat={handleSelectChat}
        onCreateNewChat={handleCreateNewChat}
      />
    );
  }

  if (showMessages) {
    return (
      <ChatScreen
        chatId={currentChatId}
        onClose={handleCloseChat}
        onBackToChatList={handleBackToChatList}
        onNewChatCreated={handleNewChatCreated}
      />
    );
  }


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      {/* Header with Settings Icon */}
      <View style={[styles.header, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
        <Text style={styles.headerTitle}>ANATROX</Text>
        <TouchableOpacity
          onPress={() => setShowSettings(true)}
          style={styles.settingsButton}
        >
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <ScrollView 
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {userRole === 'trainer' ? (
            // TRAINER HOME PAGE
            <>
              <View style={[styles.greetingSection, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={styles.greetingText}>Hello, Trainer! 🏋️</Text>
                <Text style={styles.welcomeText}>Manage Your Clients</Text>
                <Text style={styles.subtitleText}>
                  Track progress, create programs, and grow your fitness business
                </Text>
              </View>

              {/* Trainer Quick Actions */}
              <View style={styles.actionsGrid}>
                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to client list
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>👥</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>My Clients</Text>
                      <Text style={styles.actionSubtitle}>View all clients</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to create program
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>📝</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Create Program</Text>
                      <Text style={styles.actionSubtitle}>Design workouts</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to analytics
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>📊</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Analytics</Text>
                      <Text style={styles.actionSubtitle}>Track performance</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to messages
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>💬</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Messages</Text>
                      <Text style={styles.actionSubtitle}>Client communication</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Recent Activity */}
              <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <View style={styles.activityItem}>
                  <Text style={styles.activityText}>No recent activity</Text>
                  <Text style={styles.activitySubtext}>Start by adding your first client</Text>
                </View>
              </View>
            </>
          ) : (
            // CLIENT HOME PAGE
            <>
              <View style={[styles.greetingSection, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={styles.greetingText}>Hello! 👋</Text>
                <Text style={styles.welcomeText}>Welcome to Anatrox</Text>
                <Text style={styles.subtitleText}>
                  Your AI-powered fitness companion
                </Text>
              </View>

              {/* Client Quick Actions */}
              <View style={styles.actionsGrid}>
                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to today's workout
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>💪</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Today's Workout</Text>
                      <Text style={styles.actionSubtitle}>Start training</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to progress
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>📈</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Progress</Text>
                      <Text style={styles.actionSubtitle}>Track results</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => setShowNutrition(true)}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>🍎</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Nutrition</Text>
                      <Text style={styles.actionSubtitle}>Meal tracking</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity 
                  onPress={() => {
                    // TODO: Navigate to programs
                  }}
                >
                  <View style={[styles.actionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                    <Text style={styles.actionEmoji}>📋</Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                      <Text style={styles.actionTitle}>Programs</Text>
                      <Text style={styles.actionSubtitle}>View plans</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Today's Stats */}
              <View style={[styles.sectionCard, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.7)' : 'rgba(255, 255, 255, 0.7)' }]}>
                <Text style={styles.sectionTitle}>Today's Stats</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Workouts</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Calories</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>0</Text>
                    <Text style={styles.statLabel}>Minutes</Text>
                  </View>
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* Floating GPT button (bottom-right) - Opens Chat List */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 120, // Fixed position above navbar
          right: spacing.lg,
          zIndex: 1000,
          transform: [
            {
              translateY: fabAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -4],
              }),
            },
            {
              scale: fabAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.03],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          onPress={handleOpenChatList}
          style={styles.fab}
          activeOpacity={0.8}
        >
          <NavIcon name="gpt" size={60} />
        </TouchableOpacity>
      </Animated.View>

      {/* Bottom Navigation Bar */}
      <BottomNavBar
        onProfilePress={() => setShowProfile(true)}
        onPlusPress={() => setShowCreateModal(true)}
        onMessagesPress={() => {
          // TODO: CRM Messages feature - coming soon
        }}
        onVoicePress={() => setShowVoice(true)}
        onNutritionPress={() => setShowNutrition(true)}
        unreadMessageCount={unreadMessageCount}
      />

      {/* Create Modal */}
      <CreateModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
      {/* Voice AI placeholder modal (kept separate from GPT chat) */}
      <CreateModal
        visible={showVoice}
        onClose={() => setShowVoice(false)}
      >
        <View style={{ padding: 16 }}>
          <Text style={{ ...typography.h3, color: colors.text, marginBottom: 8 }}>Voice AI Coach</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: 12 }}>
            Speak to your coach hands‑free. Start/stop controls will be here.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={{ backgroundColor: colors.primary, padding: spacing.md, borderRadius: 12 }} onPress={() => { setShowVoice(false); handleOpenChatList(); }}>
              <Text style={{ color: colors.white, fontWeight: '700' }}>Open Text Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12, borderWidth: 1, borderColor: colors.border }} onPress={() => setShowVoice(false)}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CreateModal>
      {/* Nutrition placeholder modal */}
      <CreateModal
        visible={showNutrition}
        onClose={() => setShowNutrition(false)}
      >
        <View style={{ padding: 16 }}>
          <Text style={{ ...typography.h3, color: colors.text, marginBottom: 8 }}>Nutrition Tracker</Text>
          <Text style={{ ...typography.body, color: colors.textSecondary }}>
            Daily nutrition tracking coming soon. Choose calendar-based logging or quick food entries.
          </Text>
        </View>
      </CreateModal>
    </SafeAreaView>
  );
}

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authScreen, setAuthScreen] = useState('login'); // 'login', 'signup', 'forgotPassword'
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  // Load API key on app start
  useEffect(() => {
    (async () => {
      try {
        await loadApiKey();
      } catch (e) {
        console.error('Failed to load API key:', e);
      } finally {
        setKeyLoaded(true);
      }
    })();
  }, []);

  // Firebase auth state listener
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      // Check if user needs onboarding
      if (firebaseUser && db) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            // Show onboarding if not completed
            if (!userData.onboardingCompleted) {
              setShowOnboarding(true);
            }
          } else {
            // New user, show onboarding
            setShowOnboarding(true);
          }
        } catch (error) {
          console.error('Error checking onboarding status:', error);
          // Default to showing onboarding on error
          setShowOnboarding(true);
        }
      }
      
      setAuthLoading(false);
      setOnboardingChecked(true);
      
      // If user signs out, reset app state
      if (!firebaseUser) {
        console.log('User signed out');
        setShowOnboarding(false);
        setOnboardingChecked(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Show splash screen first (only wait for splash to finish)
  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />;
  }

  // Show auth screens if user is not logged in (show immediately after splash)
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
              onSignupSuccess={(userData) => {
                setUser(userData);
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

  // For logged-in users, wait for onboarding check
  if (user && (!keyLoaded || !onboardingChecked)) {
    return null; // Loading
  }

  // Show onboarding if needed
  if (user && showOnboarding) {
    return (
      <SafeAreaProvider>
        <ThemeProvider>
          <OnboardingScreen
            onComplete={() => {
              setShowOnboarding(false);
            }}
          />
        </ThemeProvider>
      </SafeAreaProvider>
    );
  }

  // User is authenticated - show main app
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent user={user} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}