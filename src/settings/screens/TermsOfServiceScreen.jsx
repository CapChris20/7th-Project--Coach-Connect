import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function TermsOfServiceScreen({ onClose }) {
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.note}>
          Effective Date: {new Date().toLocaleDateString()}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CoachConnect Terms of Service</Text>
          <Text style={styles.sectionText}>
            By accessing or using CoachConnect, you agree to these Terms. If you do not agree, do not use the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Subscription Terms</Text>
          <Text style={styles.sectionText}>
            CoachConnect may offer optional paid subscriptions or in-app purchases (for example, trainer tools or client
            features). Pricing, billing period, free trial terms (if any), and renewal information are shown in the app
            and in Apple’s purchase flow immediately before you confirm payment. Subscriptions billed through Apple renew
            automatically unless you cancel as described below.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Cancellation & Refunds</Text>
          <Text style={styles.sectionText}>
            Cancellation & Refunds:
            {'\n'}{'\n'}- For purchases through Apple: on iOS, open Settings → [your name] → Subscriptions (or the App
            Store account subscriptions page), select CoachConnect, and cancel your subscription. You can also use
            Apple’s subscription management links from your receipt or Apple ID settings.
            {'\n'}- No refunds for partial billing periods except where required by law or Apple’s policies.
            {'\n'}- Cancellation stops renewal at the end of the current billing period; you keep access until that date.
            {'\n'}- If we offer a free trial, its length and how to avoid being charged will be shown in the app before
            you start the trial.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Disclaimer</Text>
          <Text style={styles.sectionText}>
            The materials on CoachConnect are provided on an “as is” basis. CoachConnect makes no warranties, expressed
            or implied, and hereby disclaims and negates all other warranties including without limitation, implied
            warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of
            intellectual property or other violation of rights.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. AI-Generated Content</Text>
          <Text style={styles.sectionText}>
            Workouts and coaching generated by AI may not be perfect. Always review generated content before use.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Acceptable Use</Text>
          <Text style={styles.sectionText}>
            {'\n'}- Do not use the app for commercial purposes without permission
            {'\n'}- Do not share your login credentials
            {'\n'}- Do not attempt to hack or reverse-engineer the app
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Liability</Text>
          <Text style={styles.sectionText}>
            CoachConnect is provided “as-is.” We are not liable for injuries, data loss, or app downtime.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}











