import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function PrivacyPolicyScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    backButton: {
      padding: spacing.sm,
    },
    backButtonText: {
      fontSize: 18,
      color: colors.primary,
      fontWeight: '600',
    },
    scrollContent: {
      padding: spacing.lg,
    },
    note: {
      fontSize: 12,
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginBottom: spacing.lg,
      padding: spacing.md,
      backgroundColor: colors.surface,
      borderRadius: 8,
    },
    section: {
      marginBottom: spacing.xl,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.md,
    },
    sectionText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: spacing.md,
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.note}>
          Effective Date: {new Date().toLocaleDateString()}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.sectionText}>
            CoachConnect collects the following data:
            {'\n'}{'\n'}- Profile info (name, email, age, fitness level, goals, injuries)
            {'\n'}- Workout logs (exercises, sets, reps, weight, notes)
            {'\n'}- Nutrition logs (foods logged, macros, calories)
            {'\n'}- Progress photos (uploaded to Firebase Storage)
            {'\n'}- Sleep, water intake, energy levels, soreness data
            {'\n'}- Messages between trainer and client
            {'\n'}- City or region you add to your profile for discovery (we do not collect GPS location from your device in the current app version)
            {'\n'}- Push notification preferences
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          <Text style={styles.sectionText}>
            We use this data to:
            {'\n'}{'\n'}- Personalize AI-generated workouts and coaching
            {'\n'}- Track your progress with graphs and reports
            {'\n'}- Enable trainer-client communication
            {'\n'}- Improve app features via Firebase Analytics
            {'\n'}- Process purchases you initiate on iOS through Apple’s In-App Purchase system (Apple handles payment details; we do not receive your full card number)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Permissions</Text>
          <Text style={styles.sectionText}>
            CoachConnect may request certain device permissions to provide features. You can deny permissions, and you
            can change them later in iOS Settings.
            {'\n'}            {'\n'}- Camera / Photo Library: upload progress photos and add images to chats/files
            {'\n'}- Microphone (if enabled): voice features such as voice coaching or voice messages
            {'\n'}- Notifications: workout reminders and messages from your trainer
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
          <Text style={styles.sectionText}>
            We use the following third-party services:
            {'\n'}            {'\n'}- Firebase (data storage, authentication)
            {'\n'}- Apple (In-App Purchases and payment processing on iOS, when you buy a subscription or other digital item in the app)
            {'\n'}- Claude API (AI workout generation)
            {'\n'}- DeepSeek API (AI Coach responses)
            {'\n'}- Perplexity API (web search for AI Coach)
            {'\n'}- YouTube API (exercise videos)
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Data Security</Text>
          <Text style={styles.sectionText}>
            Your data is encrypted in transit and at rest. No method of transmission or storage is 100% secure, but we
            use industry-standard safeguards to protect your information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Your Choices & Account Deletion</Text>
          <Text style={styles.sectionText}>
            You can access and update certain information in the app. You can delete your account anytime in Settings.
            When you delete your account, your account and associated data in Firestore and files stored under your user
            folder in Firebase Storage are permanently deleted.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}











