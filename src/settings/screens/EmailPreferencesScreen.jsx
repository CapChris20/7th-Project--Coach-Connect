/**
 * Email Preferences Screen
 *
 * Purpose: UI screen or component: Email Preferences Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: EmailPreferencesScreen
 *
 * @file-header
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function EmailPreferencesScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [workoutSummaries, setWorkoutSummaries] = useState(false);
  const [progressReports, setProgressReports] = useState(false);
  const [securityAlerts, setSecurityAlerts] = useState(true);

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
    preferenceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    preferenceLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      flex: 1,
    },
    note: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: spacing.md,
      fontStyle: 'italic',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Workout summaries</Text>
          <Switch
            value={workoutSummaries}
            onValueChange={setWorkoutSummaries}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={workoutSummaries ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Progress reports</Text>
          <Switch
            value={progressReports}
            onValueChange={setProgressReports}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={progressReports ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <Text style={styles.preferenceLabel}>Security alerts</Text>
          <Switch
            value={securityAlerts}
            onValueChange={setSecurityAlerts}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={securityAlerts ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        <Text style={styles.note}>These preferences are local only for now.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}











