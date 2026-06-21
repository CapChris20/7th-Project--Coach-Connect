/**
 * Workout Reminders Settings Screen
 *
 * Purpose: UI screen or component: Workout Reminders Settings Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: WorkoutRemindersSettingsScreen
 *
 * @file-header
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';

export default function WorkoutRemindersSettingsScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [selectedTime, setSelectedTime] = useState(null);

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
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.lg,
      lineHeight: 20,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: 12,
      marginBottom: spacing.lg,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    switchLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
    },
    timeButton: {
      backgroundColor: colors.surface,
      padding: spacing.md,
      borderRadius: 12,
      marginBottom: spacing.sm,
      borderWidth: 2,
      borderColor: 'transparent',
      alignItems: 'center',
    },
    timeButtonSelected: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.purple[100],
    },
    timeButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    timeButtonTextSelected: {
      color: colors.primary,
      fontWeight: '700',
    },
  });

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Reminders</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Enable workout reminders to help you stay consistent with your fitness routine.
        </Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Enable reminders</Text>
          <Switch
            value={remindersEnabled}
            onValueChange={setRemindersEnabled}
            trackColor={{ false: '#767577', true: colors.primary }}
            thumbColor={remindersEnabled ? '#FFFFFF' : '#f4f3f4'}
          />
        </View>

        {remindersEnabled && (
          <>
            <TouchableOpacity
              style={[styles.timeButton, selectedTime === 'morning' && styles.timeButtonSelected]}
              onPress={() => setSelectedTime('morning')}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeButtonText, selectedTime === 'morning' && styles.timeButtonTextSelected]}>
                Morning
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeButton, selectedTime === 'afternoon' && styles.timeButtonSelected]}
              onPress={() => setSelectedTime('afternoon')}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeButtonText, selectedTime === 'afternoon' && styles.timeButtonTextSelected]}>
                Afternoon
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.timeButton, selectedTime === 'evening' && styles.timeButtonSelected]}
              onPress={() => setSelectedTime('evening')}
              activeOpacity={0.7}
            >
              <Text style={[styles.timeButtonText, selectedTime === 'evening' && styles.timeButtonTextSelected]}>
                Evening
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}











