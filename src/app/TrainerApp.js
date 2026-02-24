/**
 * TrainerApp - Trainer-specific application interface
 * 
 * Responsibilities:
 * - Trainer dashboard rendering
 * - Trainer screen navigation and state management
 * - Trainer-specific data loading (unread messages, clients)
 * 
 * Assumes: User is authenticated and role === 'trainer'
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, StatusBar, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../shared/ui/ThemeContext';
import FluidGlass from '../shared/ui/FluidGlass';
import BottomNavBar from '../navigation/BottomNavBar';
import CreateModal from '../shared/components/CreateModal';
import PremiumTrainerDashboard from '../trainer/components/PremiumTrainerDashboard';
import TrainerSearchScreen from '../trainer/screens/TrainerSearchScreen';
import TrainerMessagingScreen from '../trainer/screens/TrainerMessagingScreen';
import ConversationsListScreen from '../trainer/screens/ConversationsListScreen';
import { getUnreadMessageCount, subscribeToUnreadCount } from '../ai/services/trainerMessaging';

export default function TrainerApp({ user }) {
  const { colors, spacing, isDark } = useTheme();
  const [showTrainerSearch, setShowTrainerSearch] = useState(false);
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

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

  // Navigation handler
  const handleNavigate = (screen) => {
    // Close all screens first
    setShowTrainerSearch(false);
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowCreateModal(false);

    // Open requested screen
    switch (screen) {
      case 'trainer-search':
        setShowTrainerSearch(true);
        break;
      case 'trainer-messaging':
        setShowTrainerMessaging(true);
        break;
      case 'conversations-list':
        setShowConversationsList(true);
        break;
      case 'create':
        setShowCreateModal(true);
        break;
      default:
        // For any other case, just ensure home is shown
        break;
    }
  };

  // Handle home navigation (close all screens)
  const handleHomePress = () => {
    setShowTrainerSearch(false);
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowCreateModal(false);
  };

  // Render trainer-specific screens
  if (showTrainerSearch) {
    return (
      <TrainerSearchScreen
        onSelectTrainer={(trainer, conversationId) => {
          setSelectedTrainer(trainer);
          setShowTrainerSearch(false);
          setShowTrainerMessaging(true);
        }}
        onClose={() => setShowTrainerSearch(false)}
      />
    );
  }

  if (showConversationsList) {
    return (
      <ConversationsListScreen
        onSelectConversation={(conversation, otherParticipantId) => {
          setSelectedConversation(conversation);
          setSelectedTrainer({ id: otherParticipantId });
          setShowConversationsList(false);
          setShowTrainerMessaging(true);
        }}
        onClose={() => setShowConversationsList(false)}
      />
    );
  }

  if (showTrainerMessaging) {
    return (
      <TrainerMessagingScreen
        trainer={selectedTrainer}
        conversation={selectedConversation}
        onClose={() => {
          setShowTrainerMessaging(false);
          setSelectedTrainer(null);
          setSelectedConversation(null);
        }}
      />
    );
  }

  // Show loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />

      <View style={styles.container}>
        {/* Header */}
        <FluidGlass
          transmission={0.92}
          roughness={0.1}
          tint={isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(255, 255, 255, 0.9)'}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>ANATROX</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.settingsButton}>
              <Text style={styles.settingsIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </FluidGlass>

        {/* Premium Trainer Dashboard */}
        <PremiumTrainerDashboard
          trainerId={user?.uid}
          onMessage={() => setShowTrainerMessaging(true)}
          onCall={() => {}}
          onSchedule={() => {}}
          onProgress={() => {}}
          onViewReports={() => {}}
          onClientSelect={(client) => {}}
          onNewClient={() => setShowCreateModal(true)}
        />

        {/* Bottom Navigation Bar */}
        <BottomNavBar
          onHomePress={handleHomePress}
          onPlusPress={() => setShowCreateModal(true)}
          onVoicePress={() => {}} // Trainers don't use Voice AI
          onWorkoutPress={() => {}}
          onNutritionPress={() => {}}
          onProfilePress={() => {}}
        />

        {/* Create Modal */}
        <CreateModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          userRole="trainer"
          onManageClients={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: isDark ? '#0F0B1E' : '#F5F3FF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md + 8,
    paddingBottom: spacing.md,
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
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  settingsButton: {
    padding: spacing.xs,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark 
      ? 'rgba(139, 92, 246, 0.2)' 
      : 'rgba(139, 92, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 22,
    color: colors.primary,
  },
});
